/**
 * seed-admin.js — 创建第一个平台管理员账号
 *
 * 运行：
 *   node scripts/seed-admin.js
 *   或自定义：ADMIN_PHONE=13900000000 ADMIN_PASSWORD=MyPass123 node scripts/seed-admin.js
 */

require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const PHONE    = process.env.ADMIN_PHONE    || '13800000001';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Rhautt@2026';
const NAME     = process.env.ADMIN_NAME     || '平台管理员';
const TENANT_ID = uuidv4();  // 新建默认租户

async function run() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD || 'rhautt_dev',
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });

  await client.connect();

  // 1. 创建默认租户
  const existTenant = await client.query('SELECT id FROM tenants WHERE code = $1', ['DEFAULT']);
  let tenantId;
  if (existTenant.rows.length > 0) {
    tenantId = existTenant.rows[0].id;
    console.log('已有默认租户:', tenantId);
  } else {
    const t = await client.query(
      `INSERT INTO tenants (id, code, name, type, status, settings, created_at, updated_at)
       VALUES ($1, 'DEFAULT', '瑞合瑞德暖通科技集团', 'hq', 'active', '{}', NOW(), NOW())
       RETURNING id`,
      [TENANT_ID]
    );
    tenantId = t.rows[0].id;
    console.log('✅ 创建默认租户:', tenantId);
  }

  // 2. 创建管理员账号
  const existUser = await client.query('SELECT id, phone FROM users WHERE phone = $1', [PHONE]);
  if (existUser.rows.length > 0) {
    console.log('⚠️  账号已存在:', PHONE, '(id:', existUser.rows[0].id + ')');
  } else {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const userId = uuidv4();
    await client.query(
      `INSERT INTO users (id, tenant_id, phone, password_hash, name, role, permissions, status, login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'platform_admin', '', 'active', 0, NOW(), NOW())`,
      [userId, tenantId, PHONE, hash, NAME]
    );
    console.log('✅ 管理员账号创建成功');
    console.log('   手机号:', PHONE);
    console.log('   密码:', PASSWORD);
    console.log('   角色: platform_admin');
    console.log('   tenantId:', tenantId);
    console.log('\n📌 登录地址: http://localhost:5000');
  }

  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
