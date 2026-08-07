#!/usr/bin/env node
/**
 * 品牌站本地预览服务（零依赖）。
 *
 * 为什么需要它：品牌站页面用绝对路径引 `/packages/tokens/<site>.css`（VI token 在仓库根），
 * 直接把 apps/<site>/public 当根目录起服务会 404、样式全丢。本服务同时映射：
 *   /                → apps/<site>/public
 *   /packages/...    → 仓库根 packages/...
 *   /<site-slug>/... → 切换品牌站（便于一个端口预览全部）
 *
 * 运行：node scripts/dev/serve-brand-sites.mjs [--port 4180]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const PORT = Number((() => { const i = args.indexOf('--port'); return i > -1 ? args[i + 1] : 4180; })());

const registry = JSON.parse(readFileSync(join(ROOT, 'brand-registry.json'), 'utf8'));
const SITES = (registry.brands || [])
  .filter((b) => ['brand-site', 'group', 'consumer-app'].includes(b.type))
  .map((b) => ({ slug: b.slug, dir: join(ROOT, b.app, 'public'), name: `${b.name_cn || b.slug}` }))
  .filter((s) => existsSync(s.dir));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const send = (res, code, body, type = 'text/html; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};

function tryFile(base, rel) {
  let p = join(base, rel);
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p) || !statSync(p).isFile()) return null;
  return p;
}

function indexHtml() {
  const cards = SITES.map((s) => {
    const tech = existsSync(join(s.dir, 'tech', 'index.html'));
    return `<li><a href="/${s.slug}/">${s.name}</a> <code>${s.slug}</code>`
      + (tech ? ` — <a href="/${s.slug}/tech/">技术标准速查</a>` : '')
      + `<br><small>${['/', '/products/', '/tech/'].filter((p) => tryFile(s.dir, p)).join('　')}</small></li>`;
  }).join('\n');
  // 走品牌 token，不写死 hex（宪章 §5.5.6-A）——开发工具也不例外。
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>品牌站本地预览</title>
<link rel="stylesheet" href="/packages/tokens/rhautt.css">
<style>
body{font-family:var(--brand-font,system-ui,'Microsoft YaHei',sans-serif);max-width:820px;margin:0 auto;padding:48px 24px;
     line-height:1.8;color:var(--brand-ink,#111);background:var(--brand-surface,#f8f8f8)}
h1{font-size:26px;margin:0 0 6px}
.sub{color:#777;font-size:14px;margin-bottom:28px}
ul{list-style:none;padding:0;margin:0}
li{background:#fff;border:1px solid var(--brand-border,#e5e5e5);border-radius:var(--brand-radius,8px);padding:16px 18px;margin-bottom:12px}
li a{color:var(--brand-primary,#E4002B);font-weight:700;text-decoration:none}
code{background:var(--brand-surface,#f5f5f5);padding:1px 6px;border-radius:4px;font-size:12px;color:#888}
small{color:#999;font-size:12px}
.tag{display:inline-block;border-left:3px solid var(--brand-primary,#E4002B);padding-left:8px;margin-left:8px;font-size:13px;color:#555}
</style></head><body>
<h1>品牌站本地预览</h1>
<p class="sub">开发用索引（非产品页面）。共 ${SITES.length} 个对外站；技术标准速查页的数值由 hvac-kernels 内核直接导出。</p>
<ul>${cards}</ul></body></html>`;
}

createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') return send(res, 200, indexHtml());

  // /packages/... → 仓库根（VI token）
  if (urlPath.startsWith('/packages/')) {
    const f = tryFile(ROOT, urlPath);
    if (!f) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, readFileSync(f), MIME[extname(f)] || 'application/octet-stream');
  }

  const seg = urlPath.split('/').filter(Boolean);
  const site = SITES.find((s) => s.slug === seg[0]);
  if (!site) return send(res, 404, `未知站点。<a href="/">返回列表</a>`);
  const rest = '/' + seg.slice(1).join('/');
  const f = tryFile(site.dir, rest === '/' ? '/index.html' : rest);
  if (!f) return send(res, 404, `404: ${rest} <a href="/${site.slug}/">站点首页</a> · <a href="/">列表</a>`);
  send(res, 200, readFileSync(f), MIME[extname(f)] || 'application/octet-stream');
}).listen(PORT, () => {
  console.log(`品牌站预览: http://localhost:${PORT}/  （${SITES.length} 站）`);
});
