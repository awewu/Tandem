// 临时脚本: 抽取 docs/_comp-2026 下所有 PDF 的文本到 _text/*.txt (读后可删)
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const ROOT = 'docs/_comp-2026';
const OUT = join(ROOT, '_text');
mkdirSync(OUT, { recursive: true });

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.toLowerCase().endsWith('.pdf')) out.push(p);
  }
  return out;
}

async function extract(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = '';
    let lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        parts.push(line);
        line = '';
      }
      line += it.str;
      lastY = y;
    }
    if (line) parts.push(line);
    parts.push(`\n--- [page ${i}/${doc.numPages}] ---\n`);
  }
  await doc.destroy();
  return parts.join('\n');
}

const pdfs = walk(ROOT);
console.log(`found ${pdfs.length} pdfs`);
for (const p of pdfs) {
  try {
    const text = await extract(p);
    const rel = relative(ROOT, p).replace(/[\\/]/g, '__').replace(/\.pdf$/i, '.txt');
    const outPath = join(OUT, rel);
    writeFileSync(outPath, text, 'utf8');
    console.log(`OK  ${rel}  (${text.length} chars)`);
  } catch (e) {
    console.log(`ERR ${basename(p)}: ${e.message}`);
  }
}
console.log('done');
