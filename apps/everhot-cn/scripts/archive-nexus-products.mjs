#!/usr/bin/env node
/**
 * 维护操作（**破坏性**）：归档 Nexus 中该品牌当前 active 的产品。
 *
 * 为什么独立成脚本：seed/同步脚本受「只能 seed/upsert、不得使用破坏性动词」纪律约束
 * （guard:product-authoring 规则 4）。原先本能力内嵌在 sync-products-to-nexus.mjs 的
 * `--archive-existing` 开关里，使一个"导入脚本"同时具备批量归档能力——即便是 opt-in，
 * 也模糊了"灌数据"与"清数据"的边界。现拆分：
 *   · sync-products-to-nexus.mjs  → 纯幂等 upsert（安全、可反复跑）
 *   · 本脚本                       → 显式的破坏性维护，必须单独有意识地调用
 *
 * 归档语义为**软归档**（status=archived），非物理删除：优先调用归档端点，
 * 端点 5xx 时回退 PATCH status=archived。
 *
 * 运行：node apps/everhot-cn/scripts/archive-nexus-products.mjs --confirm
 *      [--base http://localhost:5500/api/v2] [--tenant <brand-tenant-uuid>] [--dry]
 * 依赖环境：JWT_SECRET（与 API 一致；缺省从 .env.nestjs/.env 读取）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = join(SCRIPT_DIR, '..', '..', '..');

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
const CONFIRM = process.argv.includes('--confirm');
const BASE = arg('base', process.env.EVERHOT_API_BASE || 'http://localhost:5500/api/v2');
const BRAND = arg('brand', 'everhot');
const TENANT = arg('tenant', process.env.EVERHOT_TENANT_ID);
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

if (!TENANT || !UUID_RE.test(TENANT)) {
  console.error('✗ 门牌必须是品牌运营租户 UUID（模型B 第1律）。请配置 EVERHOT_TENANT_ID 或传 --tenant <UUID>。');
  process.exit(1);
}
if (!DRY && !CONFIRM) {
  console.error('✗ 这是破坏性操作（批量归档）。请显式加 --confirm 执行，或用 --dry 预演。');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('✗ 缺少 JWT_SECRET（.env.nestjs / .env 未找到）'); process.exit(1); }

const IMPORTER_USER_ID = '00000000-0000-4000-8000-000000000001';
const token = jwt.sign({ userId: IMPORTER_USER_ID, tenantId: TENANT, role: 'brand_admin' }, SECRET, { expiresIn: '10m' });
const authHeaders = { authorization: `Bearer ${token}` };
const jsonHeaders = { ...authHeaders, 'content-type': 'application/json' };

async function fetchExistingActiveProducts() {
  const url = new URL(`${BASE}/product-catalog/devices`);
  url.searchParams.set('tenantId', TENANT);
  url.searchParams.set('brand', BRAND);
  url.searchParams.set('status', 'active');
  url.searchParams.set('pageSize', '100');
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) throw new Error(`list active products HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return Array.isArray(json?.data?.items) ? json.data.items : [];
}

const existing = await fetchExistingActiveProducts();
console.log(`${DRY ? '[dry] ' : ''}归档 ${BRAND} 现有 active 产品：${existing.length} 条 (tenant=${TENANT})`);

let archived = 0;
for (const product of existing) {
  if (!product.id) continue;
  if (DRY) { console.log('[dry archive]', product.sku, product.name); archived++; continue; }
  const url = new URL(`${BASE}/product-catalog/devices/${product.id}`);
  url.searchParams.set('tenantId', TENANT);
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    if (res.status < 500) throw new Error(`archive ${product.sku || product.id} HTTP ${res.status}: ${text}`);
    console.warn(`archive endpoint failed for ${product.sku || product.id}; fallback PATCH status=archived`);
    const patchRes = await fetch(`${BASE}/product-catalog/devices/${product.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ tenantId: TENANT, status: 'archived' }),
    });
    if (!patchRes.ok) {
      throw new Error(`archive fallback ${product.sku || product.id} HTTP ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
    }
  }
  archived++;
}
console.log(`${DRY ? '[dry] ' : ''}已归档：${archived} 条`);
