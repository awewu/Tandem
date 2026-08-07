#!/usr/bin/env node
/**
 * 导入：apps/everhot-cn/public/js/products-data.js → Nexus product-catalog（写入库）。
 * 幂等 upsert（按 tenantId + sku=slug）。完整原始产品对象存入 meta.everhot，
 * 保证公开端点回读时无损往返（EVERHOT-NEXUS-INTEGRATION-DESIGN §5.1 / §7-P1）。
 *
 * 运行：node apps/everhot-cn/scripts/sync-products-to-nexus.mjs
 *      [--base http://localhost:5500/api/v2] [--tenant <brand-tenant-uuid>] [--dry]
 * 依赖环境：JWT_SECRET（与 API 一致；缺省从 .env.nestjs/.env 读取）。
 *
 * 纪律：本脚本**只做幂等 upsert**，不含任何破坏性动词（guard:product-authoring 规则 4）。
 * 批量归档等破坏性维护已拆出为 `archive-nexus-products.mjs`，须显式 --confirm 调用。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVERHOT = join(SCRIPT_DIR, '..');
const REPO = join(EVERHOT, '..', '..');
const DATA_FILE = join(EVERHOT, 'public', 'js', 'products-data.js');

// —— 极简 .env 读取（不覆盖已有 process.env）——
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(join(REPO, '.env.nestjs'));
loadEnv(join(REPO, '.env'));

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const BASE = arg('base', process.env.EVERHOT_API_BASE || 'http://localhost:5500/api/v2');
const SOURCE = arg('source', process.env.EVERHOT_PRODUCT_SOURCE || '');
const ARCHIVE_EXISTING = process.argv.includes('--archive-existing') || process.argv.includes('--archive');
// 门牌（模型B 第1律）：产品写入门牌必须是品牌运营租户 UUID；共享哨兵已退役、无回退。
// 优先级：--tenant <UUID> > EVERHOT_TENANT_ID(品牌运营租户 UUID)。
const TENANT = arg('tenant', process.env.EVERHOT_TENANT_ID);
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
if (!TENANT || !UUID_RE.test(TENANT)) {
  console.error('✗ 产品写入门牌必须是品牌运营租户 UUID（模型B 第1律）；共享哨兵已退役。请配置 EVERHOT_TENANT_ID 或传 --tenant <UUID>。');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('✗ 缺少 JWT_SECRET（.env.nestjs / .env 未找到）'); process.exit(1); }

// 铸造后台写入令牌：payload 须满足 AuthGuard.isValidScope（userId + tenantId 为 id-like）
const IMPORTER_USER_ID = '00000000-0000-4000-8000-000000000001';
const token = jwt.sign({ userId: IMPORTER_USER_ID, tenantId: TENANT, role: 'brand_admin' }, SECRET, { expiresIn: '10m' });
const authHeaders = { authorization: `Bearer ${token}` };
const jsonHeaders = { ...authHeaders, 'content-type': 'application/json' };

// 载入 products-data.js（window 垫片）
function evalWindowScript(script) {
  const win = {};
  new Function('window', script)(win);
  return win;
}

async function readSourceScript(pathname) {
  if (!SOURCE) return readFileSync(DATA_FILE, 'utf8');
  const url = new URL(pathname, SOURCE.endsWith('/') ? SOURCE : `${SOURCE}/`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`source ${url} HTTP ${res.status}`);
  return res.text();
}

function sourceOrigin() {
  if (!SOURCE) return '';
  return new URL(SOURCE.endsWith('/') ? SOURCE : `${SOURCE}/`).origin;
}

function normalizeSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (!SOURCE) return value;
  return new URL(value, SOURCE.endsWith('/') ? SOURCE : `${SOURCE}/`).toString();
}

async function loadProducts() {
  const win = evalWindowScript(await readSourceScript('js/products-data.js'));
  const products = Array.isArray(win.EVERHOT_PRODUCTS) ? win.EVERHOT_PRODUCTS : [];
  if (SOURCE) {
    try {
      const imageWin = evalWindowScript(await readSourceScript('js/product-images.js'));
      const images = imageWin.EVERHOT_PRODUCT_IMAGES || {};
      const specImages = imageWin.EVERHOT_PRODUCT_SPECIMAGES || {};
      for (const product of products) {
        const slug = String(product.slug || '');
        const image = product.image || images[slug];
        const specImage = product.specImage || specImages[slug];
        if (image) product.image = normalizeSourceUrl(image);
        if (specImage) product.specImage = normalizeSourceUrl(specImage);
      }
    } catch (e) {
      console.warn(`⚠️  产品图映射未同步：${e.message}`);
    }
  }
  return products;
}

const products = await loadProducts();
console.log(`读取 ${products.length} 个产品 → ${BASE}/product-catalog/devices  (tenant=${TENANT})`);

if (SOURCE) console.log(`source=${SOURCE}`);
if (ARCHIVE_EXISTING) {
  console.error('✗ --archive-existing 已从本导入脚本移除：seed 脚本只做幂等 upsert，不做破坏性操作。');
  console.error('  批量归档请显式执行：node apps/everhot-cn/scripts/archive-nexus-products.mjs --confirm');
  process.exit(1);
}

function toDto(p) {
  const everhot = { ...p };
  if (SOURCE) everhot.sourceOrigin = sourceOrigin();
  return {
    tenantId: TENANT,
    sku: p.slug,
    name: p.name,
    brand: 'everhot',
    category: p.cat || null,
    status: 'active',
    // 结构化摘要（可被后台/其它消费方直接用），完整对象存 meta.everhot
    spec: { sys: p.sys || null, series: p.series || null, en: p.en || null, tagline: p.tagline || null },
    meta: {
      everhot,
      source: SOURCE ? `${sourceOrigin()}/js/products-data.js` : 'products-data.js',
      imageSource: SOURCE ? `${sourceOrigin()}/js/product-images.js` : 'product-images.js',
      syncedAt: new Date().toISOString(),
    },
  };
}

let ok = 0, fail = 0;
for (const p of products) {
  const dto = toDto(p);
  if (DRY) { console.log('[dry]', dto.sku, '→', dto.name); ok++; continue; }
  try {
    const res = await fetch(`${BASE}/product-catalog/devices`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(dto),
    });
    if (!res.ok) { console.error(`✗ ${dto.sku}  HTTP ${res.status}  ${(await res.text()).slice(0, 160)}`); fail++; continue; }
    const j = await res.json();
    console.log(`✓ ${dto.sku}  id=${j?.data?.id || '?'}`);
    ok++;
  } catch (e) { console.error(`✗ ${dto.sku}  ${e.message}`); fail++; }
}
console.log(`\n完成：成功 ${ok} / 失败 ${fail}${DRY ? '（dry-run）' : ''}`);
process.exit(fail ? 1 : 0);
