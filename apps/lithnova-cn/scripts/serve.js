const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv.includes('--port') ? Number(process.argv[process.argv.indexOf('--port') + 1]) : 4013;
const ROOT = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (urlPath === '/lithnova') urlPath = '/lithnova/';
  if (urlPath.startsWith('/lithnova/')) urlPath = urlPath.replace('/lithnova/', '/');

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const index = path.join(filePath, 'index.html');
    if (fs.existsSync(index)) filePath = index;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Lithnova 瓦瑞节能品牌站已启动: http://localhost:${PORT}`);
  console.log(`基路径访问: http://localhost:${PORT}/lithnova`);
});
