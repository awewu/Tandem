/**
 * PII密钥迁移脚本
 *
 * 同时迁移：
 *   1. CustomerV2.phoneEncrypted  — AES-GCM 重加密
 *   2. CustomerV2.phoneHash       — HMAC-SHA256 重算（换 PHONE_HASH_SECRET 时必须）
 *
 * 运行方式：
 *   OLD_PII_KEY=rhautt-nexus-dev-pii-encryption-key \
 *   OLD_PHONE_SECRET=rhautt-phone-dev-secret \
 *   PII_ENCRYPTION_KEY=<新密钥> \
 *   PHONE_HASH_SECRET=<新HMAC密钥> \
 *   MONGODB_URI=<生产URI> \
 *   node scripts/migrate-pii-reencrypt.js [--dry-run] [--batch=100]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

const OLD_ENC_KEY  = process.env.OLD_PII_KEY         || 'rhautt-nexus-dev-pii-encryption-key';
const NEW_ENC_KEY  = process.env.PII_ENCRYPTION_KEY;
const OLD_HMAC_KEY = process.env.OLD_PHONE_SECRET     || 'rhautt-phone-dev-secret';
const NEW_HMAC_KEY = process.env.PHONE_HASH_SECRET;
const SALT         = 'rhautt-nexus-pii';
const ALGO         = 'aes-256-gcm';
const DRY_RUN      = process.argv.includes('--dry-run');
const BATCH        = parseInt((process.argv.find(a => a.startsWith('--batch=')) || '--batch=100').split('=')[1], 10);

if (!NEW_ENC_KEY)  { console.error('PII_ENCRYPTION_KEY is required');  process.exit(1); }
if (!NEW_HMAC_KEY) { console.error('PHONE_HASH_SECRET is required');    process.exit(1); }
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required'); process.exit(1); }

const SKIP_ENC_REKEY  = OLD_ENC_KEY  === NEW_ENC_KEY;
const SKIP_HMAC_REKEY = OLD_HMAC_KEY === NEW_HMAC_KEY;
if (SKIP_ENC_REKEY && SKIP_HMAC_REKEY) { console.log('No key changes detected, nothing to migrate.'); process.exit(0); }

const oldEncKey = crypto.scryptSync(OLD_ENC_KEY, SALT, 32);
const newEncKey = crypto.scryptSync(NEW_ENC_KEY, SALT, 32);

function decrypt(value) {
  if (!value) return null;
  const parts = String(value).split(':');
  if (parts.length !== 5) return null;
  const [, algorithm, ivHex, authTagHex, encrypted] = parts;
  try {
    const d = crypto.createDecipheriv(algorithm, oldEncKey, Buffer.from(ivHex, 'hex'));
    d.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return d.update(encrypted, 'hex', 'utf8') + d.final('utf8');
  } catch { return null; }
}

function encrypt(plain) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv(ALGO, newEncKey, iv);
  const enc = c.update(String(plain), 'utf8', 'hex') + c.final('hex');
  return `v1:${ALGO}:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc}`;
}

function hmac(secret, phone) {
  return crypto.createHmac('sha256', secret).update(String(phone).replace(/\D/g, '')).digest('hex');
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const C = mongoose.model('CustomerV2', new mongoose.Schema({}, { strict: false }), 'customerv2s');

  let processed = 0, migrated = 0, skipped = 0, errors = 0;
  let lastId = null;
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}, batch=${BATCH}, rekey_enc=${!SKIP_ENC_REKEY}, rekey_hmac=${!SKIP_HMAC_REKEY}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = lastId ? { _id: { $gt: lastId } } : {};
    const batch = await C.find(q).sort({ _id: 1 }).limit(BATCH).lean();
    if (!batch.length) break;
    lastId = batch[batch.length - 1]._id;

    const ops = [];
    for (const doc of batch) {
      processed++;
      const update = {};

      // 1. 重加密 phoneEncrypted
      if (!SKIP_ENC_REKEY && doc.phoneEncrypted) {
        const plain = decrypt(doc.phoneEncrypted);
        if (!plain) { skipped++; continue; }
        update.phoneEncrypted = encrypt(plain);

        // 2. 同步重算 phoneHash（用解密出的明文）
        if (!SKIP_HMAC_REKEY) {
          update.phoneHash = hmac(NEW_HMAC_KEY, plain);
        }
      } else if (!SKIP_HMAC_REKEY && doc.phone) {
        // phoneEncrypted 密钥不变但 HMAC 密钥变了：用明文 phone 重算
        update.phoneHash = hmac(NEW_HMAC_KEY, doc.phone);
      }

      if (Object.keys(update).length === 0) { skipped++; continue; }
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: update } } });
      migrated++;
    }

    if (ops.length && !DRY_RUN) {
      try { await C.bulkWrite(ops, { ordered: false }); }
      catch (e) { errors += ops.length; console.error('bulkWrite error:', e.message); }
    }

    process.stdout.write(`\r  processed=${processed} migrated=${migrated} skipped=${skipped} errors=${errors}`);
  }

  console.log(`\nDone. processed=${processed} migrated=${migrated} skipped=${skipped} errors=${errors}`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
