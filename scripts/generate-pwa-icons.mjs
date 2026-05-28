#!/usr/bin/env node
/**
 * Generate PWA PNG icons from public/icon.svg using Playwright Chromium.
 *
 * Outputs:
 *   public/icon-192.png   (192×192, PWA standard)
 *   public/icon-512.png   (512×512, PWA standard + splash)
 *   public/icon-180.png   (180×180, iOS apple-touch-icon)
 *   public/favicon-32.png ( 32× 32, browser tab fallback)
 *
 * Usage:
 *   node scripts/generate-pwa-icons.mjs
 *
 * Idempotent: overwrites existing files each run.
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = dirname(__dirname);

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-180.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
];

const svgSource = readFileSync(join(root, 'public', 'icon.svg'), 'utf8');

const browser = await chromium.launch();

try {
  for (const { name, size } of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // 拼一个完全居中、无 margin 的 HTML, 让 SVG 撑满整个 viewport
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style></head><body>${svgSource}</body></html>`;

    await page.setContent(html, { waitUntil: 'load' });
    const svgEl = await page.$('svg');
    const buffer = await svgEl.screenshot({ omitBackground: false, type: 'png' });

    const out = join(root, 'public', name);
    writeFileSync(out, buffer);
    console.log(`✅ ${name.padEnd(18)} ${size}×${size}  ${(buffer.length / 1024).toFixed(1)} KB`);

    await context.close();
  }
} finally {
  await browser.close();
}

console.log('\n所有 PWA icons 生成完毕.');
