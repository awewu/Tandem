#!/usr/bin/env node
/**
 * 构建期拉取产品图：Nexus DAM → 静态资源 + 重生成 product-images.js。
 * 用 ops 令牌读产品目录取 meta.imageArtifactId/imageRole，再按 id 从 file-artifact
 * base64 拉回字节，写入 public/assets/img/products/<slug>.<ext>，并重建
 * EVERHOT_PRODUCT_IMAGES（卡片）与 EVERHOT_PRODUCT_SPECIMAGES（参数长图）两张映射。
 * 站点保持纯静态、匿名（图片经 CDN/静态目录直供，DAM 仅作事实源）。
 *
 * 离线回退：DAM/API 不可达时保留现有 product-images.js 与资源不动，退出 0。
 * （EVERHOT-NEXUS-INTEGRATION-DESIGN §7-P2 / §6）
 *
 * 运行：node apps/everhot-cn/scripts/fetch-product-images-from-dam.mjs
 *      [--base http://localhost:5500/api/v2] [--tenant rhautt_shared]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVERHOT = join(SCRIPT_DIR, '..');
const REPO = join(EVERHOT, '..', '..');
const IMG_DIR = join(EVERHOT, 'public', 'assets', 'img', 'products');
const OUT = join(EVERHOT, 'public', 'js', 'product-images.js');
const WEB_PREFIX = '/assets/img/products';
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

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
const BASE = arg('base', process.env.EVERHOT_API_BASE || 'http://localhost:5500/api/v2');
const TENANT = arg('tenant', 'rhautt_shared');
const SECRET = process.env.JWT_SECRET;

function bail(msg) {
  console.warn(`⚠️  ${msg}\n    → 离线回退：保留现有 product-images.js 与资源不变。`);
  process.exit(0);
}
if (!SECRET) bail('缺少 JWT_SECRET');

function imageRef(product) {
  const refs = Array.isArray(product.assetRefs) ? product.assetRefs : [];
  return refs.find((r) => r?.role === 'main')
    || refs.find((r) => r?.role === 'card')
    || refs.find((r) => r?.role === 'spec')
    || (product.meta?.imageArtifactId ? { role: product.meta.imageRole || 'main', artifactId: product.meta.imageArtifactId } : null);
}

const token = jwt.sign({ userId: 'everhot-image-fetcher', tenantId: TENANT }, SECRET, { expiresIn: '15m' });
const authH = { authorization: `Bearer ${token}` };

let products;
try {
  const res = await fetch(`${BASE}/product-catalog/devices?tenantId=${TENANT}`, { headers: authH });
  if (!res.ok) bail(`读取产品目录失败 HTTP ${res.status}`);
  products = (await res.json()).data.items
    .filter((p) => p.brand === 'everhot')
    .map((p) => ({ ...p, _imageRef: imageRef(p) }))
    .filter((p) => p._imageRef);
} catch (e) { bail(`无法连接后台：${e.message}`); }

if (!products.length) bail('后台无带图产品（meta.imageArtifactId 为空）');

const cards = {}, specs = {};
let wrote = 0;
for (const p of products) {
  try {
    const ref = p._imageRef;
    const res = await fetch(`${BASE}/file-artifact/${ref.artifactId}/base64`, { headers: authH });
    if (!res.ok) { console.warn(`- ${p.sku}：DAM 拉取 HTTP ${res.status}，跳过`); continue; }
    const j = await res.json();
    if (!j.success) { console.warn(`- ${p.sku}：${j.error}，跳过`); continue; }
    // 统一输出优化 WebP（限宽 1200 · q80），降低 LCP/带宽
    const img = sharp(Buffer.from(j.data.dataBase64, 'base64'));
    const meta = await img.metadata();
    if (meta.width && meta.width > 1200) img.resize({ width: 1200 });
    await img.webp({ quality: 80 }).toFile(join(IMG_DIR, `${p.sku}.webp`));
    const url = `${WEB_PREFIX}/${p.sku}.webp`;
    (ref.role === 'spec' ? specs : cards)[p.sku] = url;
    wrote++;
  } catch (e) { console.warn(`- ${p.sku}：${e.message}，跳过`); }
}
if (!wrote) bail('没有成功拉取任何图片');

const dump = (obj) => Object.keys(obj).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(',\n');
const out =
`/* 产品图映射：slug → 图片 URL。渲染端 catalog.js 的 imgSrc() 优先用此映射。
   AUTO-GENERATED 自 Nexus DAM（file-artifact）${new Date().toISOString()}；勿手改，
   改图请更新 DAM 后重跑 fetch-product-images-from-dam.mjs。
   替换为正规白底图：把授权图入 DAM（sync-product-images-to-dam.mjs）即可，无需改渲染代码。 */
window.EVERHOT_PRODUCT_IMAGES = {
${dump(cards)}
};

/* 产品参数长图：slug → 竖长参数海报。只在「产品详情页」的「产品参数」区展示，
   不进卡片（卡片里会被裁切）。imageRole='spec' 的产品归此表。 */
window.EVERHOT_PRODUCT_SPECIMAGES = {
${dump(specs)}
};
`;
writeFileSync(OUT, out, 'utf8');
console.log(`✓ 从 DAM 拉回 ${wrote} 张图；卡片 ${Object.keys(cards).length} / 参数图 ${Object.keys(specs).length} → product-images.js`);
