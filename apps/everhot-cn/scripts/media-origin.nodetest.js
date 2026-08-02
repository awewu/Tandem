'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMediaOrigin } = require('./media-origin');

test('server A accepts authenticated JPG sync and serves site material manifest', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'everhot-media-origin-'));
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  const previousRoot = process.env.EVERHOT_MEDIA_ROOT;
  const previousToken = process.env.EVERHOT_MEDIA_SYNC_TOKEN;
  process.env.EVERHOT_MEDIA_ROOT = path.join(root, 'media');
  process.env.EVERHOT_MEDIA_SYNC_TOKEN = 'test-shared-token';
  const media = createMediaOrigin({ publicDir });

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, headers);
    res.end(body);
  };
  const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    if (media.handleSync(req, res, send)) return;
    if (media.tryServe(urlPath, req, res, send, { '.jpg': 'image/jpeg', '.json': 'application/json' })) return;
    send(res, 404, 'not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.EVERHOT_MEDIA_ROOT;
    else process.env.EVERHOT_MEDIA_ROOT = previousRoot;
    if (previousToken === undefined) delete process.env.EVERHOT_MEDIA_SYNC_TOKEN;
    else process.env.EVERHOT_MEDIA_SYNC_TOKEN = previousToken;
  });

  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const manifest = {
    'brand-story': {
      src: '/assets/img/site-materials/brand-story-1.jpg',
      filename: 'brand-story.jpg',
      mimeType: 'image/jpeg',
      size: 4,
      updatedAt: new Date().toISOString(),
    },
  };
  const sync = await fetch(`${base}/internal/media-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Everhot-Media-Token': 'test-shared-token' },
    body: JSON.stringify({
      kind: 'site-material-bundle',
      manifest,
      files: [{ path: 'brand-story-1.jpg', mimeType: 'image/jpeg', dataBase64: Buffer.from('jpg!').toString('base64') }],
    }),
  });
  assert.equal(sync.status, 200);

  const image = await fetch(`${base}/assets/img/site-materials/brand-story-1.jpg`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from('jpg!'));

  const manifestResponse = await fetch(`${base}/assets/img/site-materials/manifest.json`);
  assert.equal(manifestResponse.status, 200);
  assert.deepEqual(await manifestResponse.json(), manifest);

  const artifactSync = await fetch(`${base}/internal/media-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Everhot-Media-Token': 'test-shared-token' },
    body: JSON.stringify({
      kind: 'artifact-image',
      key: 'tenant/product-image/example.jpg',
      mimeType: 'image/jpeg',
      dataBase64: Buffer.from('public-jpg').toString('base64'),
    }),
  });
  assert.equal(artifactSync.status, 200);
  const artifactImage = await fetch(`${base}/media/tenant/product-image/example.jpg`);
  assert.equal(artifactImage.status, 200);
  assert.deepEqual(Buffer.from(await artifactImage.arrayBuffer()), Buffer.from('public-jpg'));
});

test('server A rejects media sync without the shared token', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'everhot-media-origin-auth-'));
  const previousRoot = process.env.EVERHOT_MEDIA_ROOT;
  const previousToken = process.env.EVERHOT_MEDIA_SYNC_TOKEN;
  process.env.EVERHOT_MEDIA_ROOT = path.join(root, 'media');
  process.env.EVERHOT_MEDIA_SYNC_TOKEN = 'expected-token';
  const media = createMediaOrigin({ publicDir: root });
  const send = (res, status, body, headers = {}) => { res.writeHead(status, headers); res.end(body); };
  const server = http.createServer((req, res) => {
    if (!media.handleSync(req, res, send)) send(res, 404, 'not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/internal/media-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 401);
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
  if (previousRoot === undefined) delete process.env.EVERHOT_MEDIA_ROOT;
  else process.env.EVERHOT_MEDIA_ROOT = previousRoot;
  if (previousToken === undefined) delete process.env.EVERHOT_MEDIA_SYNC_TOKEN;
  else process.env.EVERHOT_MEDIA_SYNC_TOKEN = previousToken;
});
