#!/usr/bin/env node
/**
 * 零依赖静态服务器 —— Ruud 中国独立品牌站（自有域名 ruud.com.cn）。
 *
 *   node apps/ruud-cn/scripts/serve.js [--port 5015]
 *
 * 职责：
 *  - 在自有端口（默认 4015）以「独立站」形式托管 public/（根路径即站点首页）。
 *  - 映射 /packages/tokens/* → monorepo packages/tokens（品牌 CSS token）。
 *  - 跨站绝对链接（集团官网 / AI 问诊 / 兄弟品牌）在本地按各自独立端口 302 跳转；
 *    生产用环境变量覆盖为真实域名（见 SITES）。HTML 因此无需硬编码 localhost。
 *  - 本品牌自身路径 /ruud-cn/* 去前缀后回落到 public/（骨架页缺失则 404）。
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BRAND = 'ruud';
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
}
const PORT = Number(process.env.PORT || arg('--port', '4015'));
const PUBLIC = path.join(__dirname, '..', 'public');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const API_TARGET = (process.env.RUUD_API_TARGET || process.env.NEXUS_API_ORIGIN || 'http://localhost:5500').replace(/\/+$/, '');

// 跨站地址（本地默认独立端口；生产用 SITE_*_URL 覆盖为真实域名）。
const SITES = {
  group: process.env.SITE_GROUP_URL || 'http://localhost:5005',
  diagnosis: process.env.SITE_DIAGNOSIS_URL || 'http://localhost:5001',
  everhot: process.env.SITE_EVERHOT_URL || 'http://localhost:5011',
  lithnova: process.env.SITE_LITHNOVA_URL || 'http://localhost:5013',
  rheem: process.env.SITE_RHEEM_URL || 'http://localhost:5014',
  ruud: process.env.SITE_RUUD_URL || 'http://localhost:5015',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}
function redirect(res, location) {
  send(res, 302, `Redirecting to ${location}`, { Location: location });
}
function safeJoin(base, target) {
  const resolved = path.join(base, target);
  if (!resolved.startsWith(base)) return null; // 路径穿越防护
  return resolved;
}
function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    let fp = filePath;
    if (!err && stat.isDirectory()) fp = path.join(filePath, 'index.html');
    fs.readFile(fp, (e, data) => {
      if (e) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      send(res, 200, data, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' });
    });
  });
}
function proxyApi(req, res) {
  let target;
  try {
    target = new URL(req.url, API_TARGET);
  } catch {
    return send(res, 502, 'Bad API target', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const transport = target.protocol === 'https:' ? https : http;
  const upstream = transport.request(target, {
    method: req.method,
    headers: { ...req.headers, host: target.host },
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, { ...upstreamRes.headers, 'cache-control': 'no-store' });
    upstreamRes.pipe(res);
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) return send(res, 502, `API proxy error: ${err.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.destroy(err);
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  if (urlPath.startsWith('/api/v2/')) return proxyApi(req, res);

  // ① 跨站绝对链接 → 各自独立端口（本地）/ 真实域名（生产）
  if (urlPath === '/') return serveFile(res, path.join(PUBLIC, 'index.html'));
  if (urlPath === '/index-ready.html') return redirect(res, SITES.group + '/');
  if (urlPath === '/pain-diagnosis.html') return redirect(res, SITES.diagnosis + '/');
  if (urlPath.startsWith('/everhot-cn')) return redirect(res, SITES.everhot + '/');
  if (urlPath.startsWith('/lithnova-cn')) return redirect(res, SITES.lithnova + '/');
  if (urlPath.startsWith('/rheem-cn')) return redirect(res, SITES.rheem + '/');

  // ② monorepo 共享 token
  if (urlPath.startsWith('/packages/')) {
    const fp = safeJoin(REPO_ROOT, urlPath);
    if (!fp) return send(res, 400, 'Bad Request');
    return serveFile(res, fp);
  }

  // ③ 本品牌自身路径：去掉 /ruud-cn 前缀后回落 public/
  if (urlPath.startsWith('/ruud-cn')) urlPath = urlPath.slice('/ruud-cn'.length) || '/';

  const fp = safeJoin(PUBLIC, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  if (!fp) return send(res, 400, 'Bad Request');
  serveFile(res, fp);
});

server.listen(PORT, () => {
  console.log(`[${BRAND}-cn] static site on http://localhost:${PORT}`);
});
