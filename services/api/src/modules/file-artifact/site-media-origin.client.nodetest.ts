import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  publicSiteImageUrl,
  readPublicSiteImage,
  shouldSyncPublicSiteImage,
  siteMediaOriginEnabled,
  syncPublicSiteImage,
} from './site-media-origin.client';

test('B mirrors public website JPG files to A and verifies the public URL', async (t) => {
  const files = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'POST' && pathname === '/internal/media-sync') {
      assert.equal(req.headers['x-everhot-media-token'], 'shared-test-token');
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        files.set(`/media/${body.key}`, Buffer.from(body.dataBase64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { path: `/media/${body.key}` } }));
      });
      return;
    }
    const file = files.get(pathname);
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    if (req.method === 'HEAD') res.end();
    else res.end(file);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address() as { port: number };
  const previousOrigin = process.env.SITE_MEDIA_ORIGIN_URL;
  const previousToken = process.env.SITE_MEDIA_SYNC_TOKEN;
  process.env.SITE_MEDIA_ORIGIN_URL = `http://127.0.0.1:${address.port}`;
  process.env.SITE_MEDIA_SYNC_TOKEN = 'shared-test-token';
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.SITE_MEDIA_ORIGIN_URL;
    else process.env.SITE_MEDIA_ORIGIN_URL = previousOrigin;
    if (previousToken === undefined) delete process.env.SITE_MEDIA_SYNC_TOKEN;
    else process.env.SITE_MEDIA_SYNC_TOKEN = previousToken;
  });

  assert.equal(siteMediaOriginEnabled(), true);
  assert.equal(shouldSyncPublicSiteImage('product-image', 'image/jpeg'), true);
  assert.equal(shouldSyncPublicSiteImage('floor_plan', 'image/jpeg'), false);
  const fileKey = 'tenant/product-image/example.jpg';
  const url = await syncPublicSiteImage({ fileKey, mimeType: 'image/jpeg', buffer: Buffer.from('jpg') });
  assert.equal(url, publicSiteImageUrl(fileKey));
  assert.deepEqual(await readPublicSiteImage(fileKey), Buffer.from('jpg'));
});

test('B fails closed when only half of the A-server configuration is present', () => {
  const previousOrigin = process.env.SITE_MEDIA_ORIGIN_URL;
  const previousToken = process.env.SITE_MEDIA_SYNC_TOKEN;
  process.env.SITE_MEDIA_ORIGIN_URL = 'https://www.everhot.com.cn';
  delete process.env.SITE_MEDIA_SYNC_TOKEN;
  assert.throws(() => siteMediaOriginEnabled(), /must be configured together/);
  if (previousOrigin === undefined) delete process.env.SITE_MEDIA_ORIGIN_URL;
  else process.env.SITE_MEDIA_ORIGIN_URL = previousOrigin;
  if (previousToken === undefined) delete process.env.SITE_MEDIA_SYNC_TOKEN;
  else process.env.SITE_MEDIA_SYNC_TOKEN = previousToken;
});
