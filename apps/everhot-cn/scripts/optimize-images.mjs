/* 图片轻量化：把 public/assets/img 下的 png/jpg 转为优化后的 WebP（同名 .webp）。
 * 卡片/海报限宽 1200px、quality 80。产物明显更小 → 降低 LCP 与带宽。
 * 用法：npm run opt:img    （幂等：源图更新才重转，除非 --force）
 * 注意：不删除源图；引用改为 .webp 后仅 .webp 会被加载。DAM 拉取脚本也会输出 .webp（见 fetch-product-images-from-dam.mjs）。
 */
import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public/assets/img', import.meta.url));
const FORCE = process.argv.includes('--force');
const MAX_W = 1200, QUALITY = 80;
const exts = new Set(['.png', '.jpg', '.jpeg']);

let converted = 0, skipped = 0, srcBytes = 0, outBytes = 0;

async function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { await walk(p); continue; }
    if (!exts.has(extname(name).toLowerCase())) continue;
    const out = p.replace(/\.(png|jpe?g)$/i, '.webp');
    if (!FORCE && existsSync(out) && statSync(out).mtimeMs >= s.mtimeMs) { skipped++; continue; }
    const img = sharp(p);
    const meta = await img.metadata();
    if (meta.width && meta.width > MAX_W) img.resize({ width: MAX_W });
    await img.webp({ quality: QUALITY }).toFile(out);
    srcBytes += s.size; outBytes += statSync(out).size; converted++;
    console.log(`  ${name} → ${name.replace(/\.(png|jpe?g)$/i, '.webp')}  ${(s.size/1024|0)}K → ${(statSync(out).size/1024|0)}K`);
  }
}

await walk(ROOT);
const pct = srcBytes ? (100 - outBytes / srcBytes * 100).toFixed(0) : 0;
console.log(`\n转换 ${converted}、跳过 ${skipped}；${(srcBytes/1024/1024).toFixed(2)}M → ${(outBytes/1024/1024).toFixed(2)}M（省 ${pct}%）。`);
