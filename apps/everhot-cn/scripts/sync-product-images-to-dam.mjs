#!/usr/bin/env node
/**
 * 导入产品图 → Nexus DAM（file-artifact / uploaded_files）。
 * 每张图 base64 上传得 objectKey + artifactId，回写到对应产品的
 * meta.imageObjectKey / meta.imageArtifactId / meta.imageRole（card|spec）。
 * 构建期 fetch-product-images-from-dam.mjs 据此拉回静态资源并重生成 product-images.js。
 * （EVERHOT-NEXUS-INTEGRATION-DESIGN §7-P2）
 *
 * 授权底线：默认只上传 manifest 中 "owned": true 的自有/授权白底图。
 * 传 --include-placeholders 才会上传当前带第三方字样的 dev 占位图（仅本地验证用）。
 *
 * 运行：node apps/everhot-cn/scripts/sync-product-images-to-dam.mjs
 *      [--base http://localhost:5500/api/v2] [--tenant rhautt_shared] [--include-placeholders] [--dry]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVERHOT = join(SCRIPT_DIR, '..');
const REPO = join(EVERHOT, '..', '..');
const IMG_DIR = join(EVERHOT, 'public', 'assets', 'img', 'products');
const MANIFEST = join(EVERHOT, 'data', 'product-image-manifest.json');

// 竖长参数海报（进详情页「产品参数」区，不进卡片）——沿用 product-images.js 现状
const SPEC_SLUGS = new Set(['everboiler', 'everelec-80', 'everflow-z16', 'everguard']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

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
const INCLUDE_PLACEHOLDERS = process.argv.includes('--include-placeholders');
const BASE = arg('base', process.env.EVERHOT_API_BASE || 'http://localhost:5500/api/v2');
const TENANT = arg('tenant', 'rhautt_shared');
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('✗ 缺少 JWT_SECRET'); process.exit(1); }
const token = jwt.sign({ userId: 'everhot-image-importer', tenantId: TENANT }, SECRET, { expiresIn: '15m' });
const authH = { authorization: `Bearer ${token}` };

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { products: {} };
const owned = (slug) => manifest.products?.[slug]?.owned === true;

// 拉现有产品，建 sku→product 映射（用于 meta 合并，避免覆盖 meta.everhot）
const listRes = await fetch(`${BASE}/product-catalog/devices?tenantId=${TENANT}`, { headers: authH });
if (!listRes.ok) { console.error(`✗ 无法读取产品列表 HTTP ${listRes.status}`); process.exit(1); }
const products = (await listRes.json()).data.items;
const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));

const files = readdirSync(IMG_DIR).filter((f) => MIME[extname(f).toLowerCase()]);
console.log(`发现 ${files.length} 张图；模式：${INCLUDE_PLACEHOLDERS ? '含 dev 占位图' : '仅 owned 授权图'}${DRY ? '（dry-run）' : ''}`);

let ok = 0, skip = 0, fail = 0;
for (const file of files) {
  const slug = basename(file, extname(file));
  const product = bySku[slug];
  if (!product) { console.log(`- 跳过 ${slug}：产品目录无此 sku`); skip++; continue; }
  if (!owned(slug) && !INCLUDE_PLACEHOLDERS) { console.log(`- 跳过 ${slug}：非 owned（加 --include-placeholders 强制）`); skip++; continue; }

  const ext = extname(file).toLowerCase();
  const mimeType = MIME[ext];
  const role = SPEC_SLUGS.has(slug) ? 'spec' : 'card';
  if (DRY) { console.log(`[dry] ${slug} (${role}) → DAM`); ok++; continue; }

  try {
    const dataBase64 = readFileSync(join(IMG_DIR, file)).toString('base64');
    const up = await fetch(`${BASE}/file-artifact/upload-base64`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...authH },
      body: JSON.stringify({ entityType: 'product-image', entityId: slug, filename: file, mimeType, dataBase64 }),
    });
    if (!up.ok) { console.error(`✗ ${slug} 上传 HTTP ${up.status} ${(await up.text()).slice(0, 140)}`); fail++; continue; }
    const artifact = (await up.json()).data;

    const meta = {
      ...(product.meta || {}),
      imageArtifactId: artifact.id,
      imageObjectKey: artifact.fileKey,
      imageMimeType: mimeType,
      imageRole: role,
      imageOwned: owned(slug),
    };
    const save = await fetch(`${BASE}/product-catalog/devices`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...authH },
      body: JSON.stringify({ tenantId: TENANT, sku: slug, name: product.name, brand: 'everhot', meta }),
    });
    if (!save.ok) { console.error(`✗ ${slug} 回写 meta HTTP ${save.status}`); fail++; continue; }
    console.log(`✓ ${slug} (${role})  artifact=${artifact.id}`);
    ok++;
  } catch (e) { console.error(`✗ ${slug} ${e.message}`); fail++; }
}
console.log(`\n完成：入库 ${ok} / 跳过 ${skip} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
