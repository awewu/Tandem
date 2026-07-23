#!/usr/bin/env node
/**
 * 零依赖静态服务器（恒热 Everhot 中国站）。
 * 默认把 public/ 挂载到域名根路径；可通过 --base 兼容调试子路径挂载。
 *
 *   node apps/everhot-cn/scripts/serve.js [--port 5011] [--base ""]
 *
 * - GET /            → public/index.html
 * - GET <base>/...   → public/... （目录回退到 index.html；base 为空时为根路径）
 * - 未命中           → 404 + public/404 占位（若有）否则纯文本
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
}
const PORT = Number(process.env.PORT || arg('--port', '4011'));
const BASE = normalizeBase(arg('--base', process.env.EVERHOT_BASE_PATH || ''));
const PUBLIC = path.join(__dirname, '..', 'public');
const API_TARGET = (process.env.EVERHOT_API_TARGET || process.env.NEXUS_API_ORIGIN || 'http://localhost:5500').replace(/\/+$/, '');

function normalizeBase(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '';
  return ('/' + raw.replace(/^\/+|\/+$/g, '')).replace(/\/+/g, '/');
}

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

function safeJoin(base, target) {
  const resolved = path.join(base, target);
  if (!resolved.startsWith(base)) return null; // path traversal guard
  return resolved;
}

function proxyApi(req, res) {
  let target;
  try {
    target = new URL(req.url, API_TARGET);
  } catch {
    return send(res, 502, 'Bad API target', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const transport = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  const upstream = transport.request(target, { method: req.method, headers }, (upstreamRes) => {
    const outHeaders = { ...upstreamRes.headers, 'cache-control': 'no-store' };
    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    upstreamRes.pipe(res);
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      send(res, 502, `API proxy error: ${err.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    } else {
      res.destroy(err);
    }
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    // Split query manually so raw (non-encoded) bytes in the query string
    // never break path resolution (browsers always encode, but be resilient).
    const rawPath = req.url.split('?')[0].split('#')[0];
    try { urlPath = decodeURIComponent(rawPath); }
    catch { urlPath = rawPath; }
  } catch {
    return send(res, 400, 'Bad Request');
  }

  if (urlPath.startsWith('/api/v2/')) {
    return proxyApi(req, res);
  }

  if (BASE && (urlPath === '/' || urlPath === '')) {
    return send(res, 302, null, { Location: `${BASE}/` });
  }
  if (BASE && !urlPath.startsWith(`${BASE}/`) && urlPath !== BASE) {
    return send(res, 404, `Not under ${BASE}/`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (BASE && urlPath === BASE) {
    return send(res, 302, null, { Location: `${BASE}/` });
  }

  let rel = BASE ? urlPath.slice(BASE.length).replace(/^\/+/, '') : urlPath.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  let filePath = safeJoin(PUBLIC, rel);
  if (!filePath) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        return send(res, 404, `404 Not Found: ${urlPath}`, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      const ext = path.extname(filePath).toLowerCase();
      const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
      if (ext === '.css' || ext === '.js') headers['Cache-Control'] = 'no-store';
      send(res, 200, data, headers);
    });
  });
});

server.listen(PORT, () => {
  const mountPath = BASE ? `${BASE}/` : '/';
  console.log(`恒热 Everhot 静态站 → http://localhost:${PORT}${mountPath}`);
  console.log(`(serving ${path.relative(process.cwd(), PUBLIC)} at base ${BASE || '/'})`);
});
