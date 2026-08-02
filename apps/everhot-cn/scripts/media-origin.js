'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = Number(process.env.EVERHOT_MEDIA_SYNC_MAX_BYTES || 40 * 1024 * 1024);
const MIME_EXTENSIONS = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])],
  ['image/gif', new Set(['.gif'])],
  ['image/x-icon', new Set(['.ico'])],
]);

function createMediaOrigin(options) {
  const publicDir = path.resolve(options.publicDir);
  const mediaRoot = path.resolve(
    process.env.EVERHOT_MEDIA_ROOT || path.join(publicDir, 'assets', 'runtime-media'),
  );
  const siteMaterialsRoot = path.join(mediaRoot, 'site-materials');
  const artifactRoot = path.join(mediaRoot, 'artifacts');

  function tryServe(urlPath, req, res, send, types) {
    const mapping = resolvePublicPath(urlPath, siteMaterialsRoot, artifactRoot);
    if (!mapping) return false;
    const filePath = safeResolve(mapping.root, mapping.relative);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': urlPath.endsWith('/manifest.json')
        ? 'no-store'
        : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.method === 'HEAD') return send(res, 200, null, headers), true;
    send(res, 200, fs.readFileSync(filePath), headers);
    return true;
  }

  function handleSync(req, res, send) {
    if (req.method !== 'POST' || requestPath(req.url) !== '/internal/media-sync') return false;
    const expectedToken = String(process.env.EVERHOT_MEDIA_SYNC_TOKEN || '');
    const receivedToken = String(req.headers['x-everhot-media-token'] || '');
    if (!expectedToken || !safeTokenEqual(expectedToken, receivedToken)) {
      sendJson(res, send, 401, { success: false, error: 'unauthorized' });
      return true;
    }

    readJsonBody(req, MAX_BODY_BYTES)
      .then((body) => {
        if (body.kind === 'site-material-bundle') {
          const files = Array.isArray(body.files) ? body.files : [];
          for (const file of files) writeImage(siteMaterialsRoot, file.path, file.mimeType, file.dataBase64);
          if (!body.manifest || typeof body.manifest !== 'object' || Array.isArray(body.manifest)) {
            throw new Error('manifest is required');
          }
          writeJsonAtomic(path.join(siteMaterialsRoot, 'manifest.json'), body.manifest);
          sendJson(res, send, 200, { success: true, data: body.manifest });
          return;
        }

        if (body.kind === 'artifact-image') {
          const relative = normalizeRelativePath(body.key);
          writeImage(artifactRoot, relative, body.mimeType, body.dataBase64);
          sendJson(res, send, 200, {
            success: true,
            data: { path: `/media/${relative.split('/').map(encodeURIComponent).join('/')}` },
          });
          return;
        }

        throw new Error('unsupported media sync kind');
      })
      .catch((error) => sendJson(res, send, error.code === 'BODY_TOO_LARGE' ? 413 : 400, {
        success: false,
        error: error.message || 'media sync failed',
      }));
    return true;
  }

  return { mediaRoot, tryServe, handleSync };
}

function requestPath(rawUrl) {
  try {
    return new URL(rawUrl || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function resolvePublicPath(urlPath, siteMaterialsRoot, artifactRoot) {
  if (urlPath.startsWith('/assets/img/site-materials/')) {
    return { root: siteMaterialsRoot, relative: urlPath.slice('/assets/img/site-materials/'.length) };
  }
  if (urlPath.startsWith('/media/')) {
    return { root: artifactRoot, relative: urlPath.slice('/media/'.length) };
  }
  return null;
}

function normalizeRelativePath(value) {
  const decoded = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = decoded.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '.' || part === '..' || !/^[a-zA-Z0-9._-]+$/.test(part))) {
    throw new Error('invalid media path');
  }
  return parts.join('/');
}

function safeResolve(root, relative) {
  let normalized;
  try {
    normalized = normalizeRelativePath(decodeURIComponent(relative));
  } catch {
    return null;
  }
  const resolved = path.resolve(root, normalized);
  return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null;
}

function writeImage(root, relativeInput, mimeTypeInput, dataBase64Input) {
  const relative = normalizeRelativePath(relativeInput);
  const mimeType = String(mimeTypeInput || '').toLowerCase();
  const allowedExtensions = MIME_EXTENSIONS.get(mimeType);
  if (!allowedExtensions || !allowedExtensions.has(path.extname(relative).toLowerCase())) {
    throw new Error('unsupported image type or extension');
  }
  const raw = String(dataBase64Input || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('empty image data');
  const destination = safeResolve(root, relative);
  if (!destination) throw new Error('invalid image destination');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, buffer);
  fs.renameSync(temporary, destination);
}

function writeJsonAtomic(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temporary, destination);
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error('request body too large');
        error.code = 'BODY_TOO_LARGE';
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function safeTokenEqual(expected, received) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sendJson(res, send, status, value) {
  send(res, status, JSON.stringify(value), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

module.exports = { createMediaOrigin };
