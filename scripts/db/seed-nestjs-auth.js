#!/usr/bin/env node
/**
 * seed-nestjs-auth.js — 为 NestJS (services/api) 的 PIPL auth 库播种可登录账号。
 *
 * NestJS 登录读 rhautt_nexus.users（phone_hash / phone_encrypted / password_hash），
 * 与 legacy public.users 分离；旧 seed 脚本只写 public.users，故 NestJS 无法登录。
 *
 * 复刻 services/api/src/modules/compliance/compliance.pii.ts：
 *   phone_hash = sha256(`${PII_HASH_SALT||'rhautt-nexus-pii-salt'}:${phoneDigits}`)
 *   phone_encrypted = AES-256-GCM(v1:iv:tag:ct)  key=PII_ENCRYPTION_KEY
 *
 * 以 .env.nestjs 中的 PostgreSQL 超级用户连接，绕过种子阶段各表的 FORCE RLS。
 *
 * Usage: node scripts/db/seed-nestjs-auth.js
 */
require('dotenv').config({ path: '.env.nestjs' });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Client } = require('pg');

const ALGO = 'aes-256-gcm';

function resolveKey() {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  return crypto.createHash('sha256').update('rhautt-nexus-dev-pii-key').digest();
}

function encryptPII(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, resolveKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function hashPII(value) {
  const salt = process.env.PII_HASH_SALT || 'rhautt-nexus-pii-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

// 与 services/api auth.service.ts 的 normalizeIdentifier 保持一致：
// 含字母/@ → 邮箱/用户名(trim+小写)；否则按手机号(仅数字)。
function normalizeIdentifier(raw) {
  const s = String(raw ?? '').trim();
  return /[a-zA-Z@]/.test(s) ? s.toLowerCase() : s.replace(/\D/g, '');
}

const ACCOUNTS = [
  // 全权限超级号：role=platform_admin 命中所有 @Roles 白名单，配合下方给 DEFAULT 租户
  // 开通全部可售模块，即可通过 EntitlementGuard，一个账号进所有应用、看所有功能。
  // 支持邮箱账号登录（normalizeIdentifier 兼容）。
  { phone: 'admin@rhautt.local', password: 'Test1234!', name: '系统管理员', role: 'platform_admin' },
  { phone: '13900000000', password: 'Super@2026',  name: '超级管理员', role: 'platform_admin' },
  // 品牌方员工：准入策略要求企业邮箱（rhautt.com / rhautt.local）。
  { phone: 'hq@rhautt.local',     password: 'Hq@2026',     name: '总部管理员', role: 'hq_admin' },
  { phone: 'region@rhautt.local', password: 'Region@2026', name: '区域经理',   role: 'regional_manager' },
  // 经销商侧员工：手机号登录。
  { phone: '13900000001', password: 'Dealer@2026', name: '王经理',   role: 'dealer_admin' },
  { phone: '13900000005', password: 'Store@2026',  name: '刘店长',   role: 'store_manager' },
  { phone: '13900000002', password: 'Design@2026', name: '李设计师', role: 'designer' },
  { phone: '13900000003', password: 'Sales@2026',  name: '张销售',   role: 'sales' },
  { phone: '13900000004', password: 'Support@2026', name: '陈技术支持', role: 'engineer' },
  { phone: '13900000006', password: 'Install@2026', name: '赵安装',  role: 'installer' },
  // 终端客户：正式登录走短信验证码(/auth/login-sms)，此处播密码仅便于本地测试。
  { phone: '13900000009', password: 'Customer@2026', name: '钱客户', role: 'customer' },
];

// 全部可售模块（与 subscription.entity.ts 的 SELLABLE_MODULES 保持一致）。
const SELLABLE_MODULES = [
  'site', 'product-catalog', 'growth',
  'crm', 'diagnosis', 'quote', 'delivery', 'lifecycle',
  'analytics',
];

const DEFAULT_DEALER_CODE = 'DEFAULT-DEALER';
const DEFAULT_STORE_CODE = 'DEFAULT-STORE';

async function run() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });
  await client.connect();

  // rhautt_nexus.users.tenant_id → rhautt_nexus.tenants(id)。确保 DEFAULT 租户存在于该 schema。
  let { rows: [tenant] } = await client.query("SELECT id FROM rhautt_nexus.tenants WHERE code = 'DEFAULT'");
  if (!tenant) {
    const id = uuidv4();
    await client.query(
      `INSERT INTO rhautt_nexus.tenants (id, code, name, tenant_type, status, settings, created_at, updated_at)
       VALUES ($1,'DEFAULT','瑞合瑞德暖通科技集团','hq','active','{}'::jsonb,NOW(),NOW())`,
      [id]
    );
    tenant = { id };
    console.log('✅ 创建 rhautt_nexus DEFAULT 租户:', id);
  }
  const tenantId = tenant.id;
  console.log('tenantId:', tenantId);

  // DEFAULT 工作台组织骨架：固定业务 code + ON CONFLICT，重复执行不会制造重复组织。
  const { rows: [dealer] } = await client.query(
    `INSERT INTO rhautt_nexus.dealers
       (id, tenant_id, code, name, province, city, status, contract_level, contact, created_at, updated_at)
     VALUES ($1,$2,'DEFAULT-DEALER','瑞合瑞德·默认演示经销商','上海','上海','active','standard','{}'::jsonb,NOW(),NOW())
     ON CONFLICT (tenant_id, code) DO UPDATE
       SET name=EXCLUDED.name, province=EXCLUDED.province, city=EXCLUDED.city,
           status='active', updated_at=NOW()
     RETURNING id`,
    [uuidv4(), tenantId]
  );
  const dealerId = dealer.id;

  const { rows: [store] } = await client.query(
    `INSERT INTO rhautt_nexus.stores
       (id, tenant_id, dealer_id, code, name, city, address, status, created_at, updated_at)
     VALUES ($1,$2,$3,'DEFAULT-STORE','上海默认舒适家体验店','上海',NULL,'active',NOW(),NOW())
     ON CONFLICT (tenant_id, dealer_id, code) DO UPDATE
       SET name=EXCLUDED.name, city=EXCLUDED.city, status='active', updated_at=NOW()
     RETURNING id`,
    [uuidv4(), tenantId, dealerId]
  );
  const storeId = store.id;
  console.log('DEFAULT dealer/store:', dealerId, storeId);

  for (const a of ACCOUNTS) {
    const id = normalizeIdentifier(a.phone);
    const phoneHash = hashPII(id);
    const { rows: exist } = await client.query(
      'SELECT id FROM rhautt_nexus.users WHERE tenant_id = $1 AND phone_hash = $2',
      [tenantId, phoneHash]
    );
    if (exist.length) { console.log(`已存在: ${a.phone} (${a.role})`); continue; }
    await client.query(
      `INSERT INTO rhautt_nexus.users
         (id, tenant_id, phone_hash, phone_encrypted, password_hash, display_name, role, permissions, status, login_attempts, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'[]'::jsonb,'active',0,NOW(),NOW())`,
      [uuidv4(), tenantId, phoneHash, encryptPII(id), await bcrypt.hash(a.password, 10), a.name, a.role]
    );
    console.log(`✅ 创建: ${a.phone} / ${a.password} / ${a.role} (${a.name})`);
  }

  // 账号 scope 与组织树一致：经销商管理员落 dealer；门店员工落 dealer+store。
  await client.query(
    `UPDATE rhautt_nexus.users
        SET dealer_id = $2, store_id = NULL, updated_at = NOW()
      WHERE tenant_id = $1 AND role = 'dealer_admin'`,
    [tenantId, dealerId]
  );
  await client.query(
    `UPDATE rhautt_nexus.users
        SET dealer_id = $2, store_id = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND role IN ('store_manager','designer','sales','engineer','installer')`,
    [tenantId, dealerId, storeId]
  );
  await client.query(
    `UPDATE rhautt_nexus.stores
        SET manager_user_id = (
          SELECT id FROM rhautt_nexus.users
           WHERE tenant_id = $1 AND role = 'store_manager'
           ORDER BY created_at LIMIT 1
        ), updated_at = NOW()
      WHERE id = $2`,
    [tenantId, storeId]
  );

  // ── 给 DEFAULT 租户开通全部可售模块（否则 platform_admin 碰到 @RequireModule 接口仍被挡）──
  for (const moduleId of SELLABLE_MODULES) {
    const { rows: exist } = await client.query(
      'SELECT id FROM rhautt_nexus.tenant_module_subscriptions WHERE tenant_id = $1 AND module_id = $2',
      [tenantId, moduleId]
    );
    if (exist.length) {
      await client.query(
        "UPDATE rhautt_nexus.tenant_module_subscriptions SET status='active', plan='enterprise', ends_at=NULL, updated_at=NOW() WHERE tenant_id=$1 AND module_id=$2",
        [tenantId, moduleId]
      );
      console.log(`模块已存在(置为 active): ${moduleId}`);
      continue;
    }
    await client.query(
      `INSERT INTO rhautt_nexus.tenant_module_subscriptions
         (id, tenant_id, module_id, plan, status, seats, starts_at, ends_at, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,'enterprise','active',NULL,NOW(),NULL,'{}'::jsonb,NOW(),NOW())`,
      [uuidv4(), tenantId, moduleId]
    );
    console.log(`✅ 开通模块: ${moduleId} (enterprise/active)`);
  }

  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
