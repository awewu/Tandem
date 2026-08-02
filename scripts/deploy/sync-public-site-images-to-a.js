#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..', '..');
const APPLY = process.argv.includes('--apply');
const PUBLIC_SITE_IMAGE_TYPES = [
  'brand_logo',
  'brand-site-basic-settings',
  'product-image',
  'product-detail-image',
  'product-main-image',
  'product-official-detail-image',
  'product-detail-body',
  'site-news',
  'site-news-body',
];

loadEnvironment();

async function main() {
  const origin = required('SITE_MEDIA_ORIGIN_URL').replace(/\/+$/, '');
  const syncUrl = String(process.env.SITE_MEDIA_SYNC_URL || `${origin}/internal/media-sync`);
  const token = required('SITE_MEDIA_SYNC_TOKEN');
  const storageRoot = resolveStorageRoot();
  const rows = await loadPublicImageRows();
  const available = [];
  const missing = [];

  for (const row of rows) {
    const localPath = safeStoragePath(storageRoot, row.file_key);
    if (!localPath || !fs.existsSync(localPath)) {
      missing.push(row.file_key);
      continue;
    }
    available.push({ ...row, localPath });
  }

  const siteBundle = loadLegacySiteMaterialBundle();
  console.log(`Public artifact images: ${available.length} available, ${missing.length} missing.`);
  console.log(`Homepage material images: ${siteBundle.files.length}.`);
  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to upload these images to server A.');
    if (missing.length) console.log(`Missing examples:\n${missing.slice(0, 20).join('\n')}`);
    return;
  }

  let uploaded = 0;
  for (const row of available) {
    await post(syncUrl, token, {
      kind: 'artifact-image',
      key: normalizeRelative(row.file_key),
      mimeType: row.mime_type,
      dataBase64: fs.readFileSync(row.localPath).toString('base64'),
    });
    uploaded += 1;
    if (uploaded % 20 === 0 || uploaded === available.length) {
      console.log(`Uploaded artifact images: ${uploaded}/${available.length}`);
    }
  }

  if (siteBundle.manifest) {
    await post(syncUrl, token, {
      kind: 'site-material-bundle',
      manifest: siteBundle.manifest,
      files: siteBundle.files,
    });
    console.log(`Uploaded homepage material bundle: ${siteBundle.files.length} image(s).`);
  }

  console.log(`Server A media migration complete: ${uploaded + siteBundle.files.length} image(s).`);
  if (missing.length) {
    console.error(`${missing.length} database image record(s) have no file on server B and must be re-uploaded.`);
    process.exitCode = 2;
  }
}

function loadEnvironment() {
  const candidates = [
    process.env.DOTENV_CONFIG_PATH,
    path.join(ROOT, 'config', '.env.production'),
    path.join(ROOT, '.env.nestjs'),
  ].filter(Boolean);
  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (envPath) dotenv.config({ path: envPath, quiet: true });
}

async function loadPublicImageRows() {
  const schema = String(process.env.POSTGRES_SCHEMA || 'rhautt_nexus');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('POSTGRES_SCHEMA is invalid');
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URI || undefined,
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT file_key, mime_type, entity_type
         FROM ${schema}.uploaded_files
        WHERE status = 'active'
          AND mime_type LIKE 'image/%'
          AND entity_type = ANY($1::text[])
        ORDER BY created_at ASC`,
      [PUBLIC_SITE_IMAGE_TYPES],
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

function loadLegacySiteMaterialBundle() {
  const root = path.join(ROOT, 'apps', 'everhot-cn', 'public', 'assets', 'img', 'site-materials');
  const manifestPath = path.join(root, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { manifest: null, files: [] };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const assets = [];
  for (const key of ['home-hero', 'brand-story', 'service-banner', 'footer-cert']) {
    if (manifest[key]?.src) assets.push(manifest[key]);
  }
  if (Array.isArray(manifest['home-hero-carousel'])) assets.push(...manifest['home-hero-carousel']);
  const files = [];
  for (const asset of assets) {
    const filename = path.basename(String(asset.src || ''));
    const localPath = path.join(root, filename);
    if (!filename || !fs.existsSync(localPath)) continue;
    files.push({
      path: filename,
      mimeType: String(asset.mimeType || mimeType(filename)),
      dataBase64: fs.readFileSync(localPath).toString('base64'),
    });
  }
  return { manifest, files };
}

async function post(url, token, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Everhot-Media-Token': token },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `server A returned HTTP ${response.status}`);
  }
}

function resolveStorageRoot() {
  const configured = process.env.STORAGE_LOCAL_PATH || 'storage';
  return path.isAbsolute(configured) ? configured : path.resolve(ROOT, configured);
}

function safeStoragePath(root, key) {
  try {
    const relative = normalizeRelative(key);
    const resolved = path.resolve(root, relative);
    return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null;
  } catch {
    return null;
  }
}

function normalizeRelative(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) throw new Error('invalid storage key');
  return parts.join('/');
}

function mimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error) => {
  console.error(`Server A media migration failed: ${error.message}`);
  process.exit(1);
});
