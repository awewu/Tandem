// Copies the pdfjs-dist worker to public/ so the browser/Tauri webview can load it
// from a known static path (/pdf.worker.min.mjs). Re-runs after every npm install.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const destDir = resolve(root, 'public');
const dest = resolve(destDir, 'pdf.worker.min.mjs');

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] source not found at ${src}; skipping (pdfjs-dist may not be installed yet)`);
  process.exit(0);
}
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied to ${dest}`);
