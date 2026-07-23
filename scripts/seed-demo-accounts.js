require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ACCOUNTS = [
  { phone: '13900000001', password: 'Dealer@2026', name: '王经理',  role: 'dealer_admin' },
  { phone: '13900000002', password: 'Design@2026', name: '李设计师', role: 'designer' },
  { phone: '13900000003', password: 'Sales@2026',  name: '张销售',  role: 'sales' },
];

async function run() {
  const client = new Client({
    host:     process.env.POSTGRES_HOST     || 'localhost',
    port:     Number(process.env.POSTGRES_PORT || 5432),
    user:     process.env.POSTGRES_USER     || 'rhautt',
    password: process.env.POSTGRES_PASSWORD || 'rhautt_dev',
    database: process.env.POSTGRES_DB       || 'rhautt_nexus',
  });
  await client.connect();

  // 1. 获取 DEFAULT tenant
  const { rows: [tenant] } = await client.query('SELECT id FROM tenants WHERE code = $1', ['DEFAULT']);
  if (!tenant) throw new Error('DEFAULT tenant 不存在，请先运行 seed-admin.js');
  const tenantId = tenant.id;
  console.log('DEFAULT tenant id:', tenantId);

  // 2. 创建 dealer
  const { rows: [existDealer] } = await client.query(
    'SELECT id FROM dealers WHERE tenant_id = $1 AND code = $2', [tenantId, 'DEALER001']
  );
  let dealerId;
  if (existDealer) {
    dealerId = existDealer.id;
    console.log('dealer 已存在:', dealerId);
  } else {
    const { rows: [d] } = await client.query(
      `INSERT INTO dealers (id, tenant_id, code, name, contact, status, created_at, updated_at)
       VALUES ($1, $2, 'DEALER001', '上海瑞合旗舰经销商', '{}', 'active', NOW(), NOW()) RETURNING id`,
      [uuidv4(), tenantId]
    );
    dealerId = d.id;
    console.log('✅ dealer 创建成功:', dealerId);
  }

  // 3. 创建 store
  const { rows: [existStore] } = await client.query(
    'SELECT id FROM stores WHERE tenant_id = $1 AND dealer_id = $2 AND code = $3',
    [tenantId, dealerId, 'STORE001']
  );
  let storeId;
  if (existStore) {
    storeId = existStore.id;
    console.log('store 已存在:', storeId);
  } else {
    const { rows: [s] } = await client.query(
      `INSERT INTO stores (id, tenant_id, dealer_id, code, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'STORE001', '上海徐汇门店', 'active', NOW(), NOW()) RETURNING id`,
      [uuidv4(), tenantId, dealerId]
    );
    storeId = s.id;
    console.log('✅ store 创建成功:', storeId);
  }

  // 4. 创建用户
  for (const acct of ACCOUNTS) {
    const { rows: [exist] } = await client.query('SELECT id FROM users WHERE phone = $1', [acct.phone]);
    if (exist) {
      console.log(`⚠️  用户已存在: ${acct.phone}`);
      continue;
    }
    const hash = await bcrypt.hash(acct.password, 10);
    await client.query(
      `INSERT INTO users (id, tenant_id, dealer_id, store_id, phone, password_hash, name, role, permissions, status, login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', 'active', 0, NOW(), NOW())`,
      [uuidv4(), tenantId, dealerId, storeId, acct.phone, hash, acct.name, acct.role]
    );
    console.log(`✅ 创建用户: ${acct.phone} / ${acct.password} / ${acct.role} (${acct.name})`);
  }

  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
