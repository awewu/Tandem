#!/usr/bin/env node
/**
 * Dev/bootstrap 管理员种子（幂等）。为本地/演示环境保证有一个可登录的 platform_admin。
 *
 * - 连接用【属主/超级用户】角色（迁移/ops 角色，绕 FORCE RLS 直写 users）。
 *   连接优先级：POSTGRES_ADMIN_URL > 离散 POSTGRES_ADMIN_* > 离散 POSTGRES_*（属主）。
 * - PII 处理与 services/api compliance.pii 完全一致（同 salt/key → login 命中）：
 *   phone_hash = sha256(`${PII_HASH_SALT}:${normalized}`)；phone_encrypted = AES-256-GCM(v1:iv:tag:ct)。
 * - 幂等：ON CONFLICT (tenant_id, phone_hash) 更新口令/角色/状态。
 *
 * 用法：node scripts/db/seed-dev-admin.js
 *   环境：SEED_ADMIN_PHONE(默认 13800138000) · SEED_ADMIN_PASSWORD(默认 Rhautt@2026) · SEED_TENANT_ID(可选)
 */
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env.nestjs'), quiet: true });

function normalizeIdentifier(raw) {
  const s = String(raw ?? '').trim();
  return /[a-zA-Z@]/.test(s) ? s.toLowerCase() : s.replace(/\D/g, '');
}
function hashPII(value) {
  const salt = process.env.PII_HASH_SALT || 'rhautt-nexus-pii-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}
function piiKey() {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  return crypto.createHash('sha256').update('rhautt-nexus-dev-pii-key').digest();
}
function encryptPII(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', piiKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function adminConnConfig() {
  if (process.env.POSTGRES_ADMIN_URL) return { connectionString: process.env.POSTGRES_ADMIN_URL };
  return {
    host: process.env.POSTGRES_ADMIN_HOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_ADMIN_PORT || process.env.POSTGRES_PORT || 5459),
    user: process.env.POSTGRES_ADMIN_USER || process.env.POSTGRES_OWNER_USER || 'rhautt',
    password: process.env.POSTGRES_ADMIN_PASSWORD || process.env.POSTGRES_OWNER_PASSWORD || 'rhautt2026',
    database: process.env.POSTGRES_ADMIN_DB || process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

(async () => {
  const phone = process.env.SEED_ADMIN_PHONE || '13800138000';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Rhautt@2026';
  const normalized = normalizeIdentifier(phone);
  const phoneHash = hashPII(normalized);
  const phoneEncrypted = encryptPII(normalized);
  const passwordHash = bcrypt.hashSync(password, 10);

  const c = new Client(adminConnConfig());
  await c.connect();
  await c.query('SET search_path TO rhautt_nexus, public');

  let tenantId = process.env.SEED_TENANT_ID;
  if (!tenantId) {
    const t = await c.query('SELECT id FROM rhautt_nexus.tenants ORDER BY created_at ASC LIMIT 1');
    if (!t.rows.length) throw new Error('无租户，请先建立租户后再种子管理员');
    tenantId = t.rows[0].id;
  }

  const res = await c.query(
    `INSERT INTO rhautt_nexus.users (tenant_id, phone_hash, phone_encrypted, password_hash, display_name, role, permissions, status)
     VALUES ($1,$2,$3,$4,$5,'platform_admin','["*"]'::jsonb,'active')
     ON CONFLICT (tenant_id, phone_hash) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'platform_admin',
           permissions = '["*"]'::jsonb, status = 'active',
           login_attempts = 0, lock_until = NULL, updated_at = now()
     RETURNING id`,
    [tenantId, phoneHash, phoneEncrypted, passwordHash, '平台超管(dev种子)'],
  );

  console.log('✅ dev 管理员已就绪');
  console.log(`   tenant_id = ${tenantId}`);
  console.log(`   user_id   = ${res.rows[0].id}`);
  console.log(`   登录手机  = ${phone}`);
  console.log(`   登录口令  = ${password}`);
  console.log('   角色      = platform_admin (permissions=["*"])');
  await c.end();
})().catch((e) => { console.error('SEED_FAIL', e.message); process.exit(1); });
