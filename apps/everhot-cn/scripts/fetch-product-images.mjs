#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 产品图片抓取管线（零依赖，Node 18+ 内置 fetch）

   读取 data/product-image-manifest.json，对每个产品：
     1) 依次尝试 pages 中的产品页 URL；
     2) 抓取页面 HTML，提取主图（og:image > twitter:image > 最优 <img>）；
     3) 下载图片到 public/assets/img/products/<slug>.<ext>；
     4) 全部完成后生成 public/js/product-images.js 映射，并写抓取报告。

   设计原则（可后期替换）：
     - 渲染代码只认 window.EVERHOT_PRODUCT_IMAGES 映射与 products-data.image，
       与抓取来源解耦；替换图片不需改代码。
     - 失败安全：任一产品抓取失败 → 跳过，渲染端回退到 SVG 矢量插画。

   用法：
     node apps/everhot-cn/scripts/fetch-product-images.mjs           # 跳过已存在
     node apps/everhot-cn/scripts/fetch-product-images.mjs --force   # 强制重抓
   ═══════════════════════════════════════════════════════════ */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');                 // apps/everhot-cn
const MANIFEST = join(ROOT, 'data', 'product-image-manifest.json');
const IMG_DIR = join(ROOT, 'public', 'assets', 'img', 'products');
const MAP_OUT = join(ROOT, 'public', 'js', 'product-images.js');
const REPORT_OUT = join(ROOT, 'data', 'product-image-report.json');
const WEB_BASE = '/assets/img/products';
const FORCE = process.argv.includes('--force');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

async function fileExists(p){ try { await stat(p); return true; } catch { return false; } }

async function fetchText(url){
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return await res.text();
}

function abs(base, src){
  try { return new URL(src, base).href; } catch { return null; }
}

// 从 HTML 提取候选主图 URL（按可信度排序）
function extractImage(html, pageUrl){
  const metas = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metas){ const m = html.match(re); if (m && m[1]) { const u = abs(pageUrl, m[1]); if (u) return u; } }

  // 退而求其次：扫描 <img>，挑选像"产品图"的（排除 logo/icon/banner/loading 等）
  const imgs = [];
  const re = /<img\b[^>]*?(?:data-original|data-src|src)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))){
    const raw = m[1];
    if (!raw || raw.startsWith('data:')) continue;
    if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(raw)) continue;
    if (/(logo|icon|sprite|banner|bg|background|loading|placeholder|qrcode|wechat|weixin)/i.test(raw)) continue;
    const u = abs(pageUrl, raw);
    if (u) imgs.push(u);
  }
  // 优先包含 upload/product 路径的
  imgs.sort((a, b) => score(b) - score(a));
  return imgs[0] || null;
}
function score(u){ let s = 0; if (/upload|product|goods|prod/i.test(u)) s += 5; if (/\.png/i.test(u)) s += 1; return s; }

async function downloadImage(url, slug){
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for image ' + url);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  let ext = EXT_BY_TYPE[type];
  if (!ext){ const m = url.match(/\.(jpe?g|png|webp|gif|svg)(?:\?|#|$)/i); ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('image too small (' + buf.length + ' bytes), likely not a product image');
  const file = join(IMG_DIR, slug + '.' + ext);
  await writeFile(file, buf);
  return { file, ext, bytes: buf.length, type };
}

async function main(){
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const products = manifest.products || {};
  await mkdir(IMG_DIR, { recursive: true });

  const map = {};       // slug -> web path
  const report = [];

  for (const [slug, entry] of Object.entries(products)){
    const pages = entry.pages || [];
    // 已存在且非强制 → 沿用
    if (!FORCE){
      for (const ext of ['webp', 'png', 'jpg', 'gif', 'svg']){
        if (await fileExists(join(IMG_DIR, slug + '.' + ext))){
          map[slug] = WEB_BASE + '/' + slug + '.' + ext;
          report.push({ slug, status: 'cached', file: slug + '.' + ext });
          break;
        }
      }
      if (map[slug]) continue;
    }

    let done = false;

    // 直链优先：manifest 中 image 字段（手选的干净产品图 URL）最可靠，跳过页面解析
    const directs = entry.image ? (Array.isArray(entry.image) ? entry.image : [entry.image]) : [];
    for (const url of directs){
      try {
        const r = await downloadImage(url, slug);
        map[slug] = WEB_BASE + '/' + slug + '.' + r.ext;
        report.push({ slug, status: 'fetched-direct', image: url, bytes: r.bytes, type: r.type, note: entry.note || '' });
        console.log('✓ ' + slug + '  ←  (direct) ' + url + '  (' + r.bytes + ' bytes)');
        done = true;
        break;
      } catch (err){
        console.warn('… ' + slug + '  direct image failed: ' + url + '  → ' + err.message);
      }
    }
    if (done) continue;

    for (const page of pages){
      try {
        const html = await fetchText(page);
        const imgUrl = extractImage(html, page);
        if (!imgUrl) throw new Error('no candidate image found on page');
        const r = await downloadImage(imgUrl, slug);
        map[slug] = WEB_BASE + '/' + slug + '.' + r.ext;
        report.push({ slug, status: 'fetched', page, image: imgUrl, bytes: r.bytes, type: r.type, note: entry.note || '' });
        console.log('✓ ' + slug + '  ←  ' + imgUrl + '  (' + r.bytes + ' bytes)');
        done = true;
        break;
      } catch (err){
        console.warn('… ' + slug + '  page failed: ' + page + '  → ' + err.message);
      }
    }
    if (!done){
      report.push({ slug, status: 'failed', pages, note: 'fallback to SVG art' });
      console.warn('✗ ' + slug + '  no image; SVG art fallback retained');
    }
  }

  // 生成图片映射（仅含成功项；渲染端找不到则用 SVG 插画）
  const banner = '/* AUTO-GENERATED by scripts/fetch-product-images.mjs — do not edit by hand.\n'
    + '   替换图片请改 data/product-image-manifest.json 后重跑脚本，或直接替换 public/assets/img/products/ 下文件。 */\n';
  const js = banner + 'window.EVERHOT_PRODUCT_IMAGES = ' + JSON.stringify(map, null, 2) + ';\n';
  await writeFile(MAP_OUT, js);
  await writeFile(REPORT_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));

  const ok = report.filter(r => r.status === 'fetched' || r.status === 'fetched-direct' || r.status === 'cached').length;
  console.log('\nDone. ' + ok + '/' + Object.keys(products).length + ' products have images. Map → ' + MAP_OUT);
}

main().catch(err => { console.error('FATAL', err); process.exit(1); });
