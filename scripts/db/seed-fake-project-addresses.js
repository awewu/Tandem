#!/usr/bin/env node
/**
 * seed-fake-project-addresses.js — DEV ONLY · 给历史 lifecycle_links 填 fake 项目地址。
 *
 * 背景：P1 dry-run 显示历史数据全无地址（project_address / customers.address 皆空），
 * 导致 (phone_hash + address_normalized) 唯一键组不成，P2 无法推进。本脚本为**开发/演示环境**
 * 造一批 fake 地址，用于端到端验证项目主线唯一键，不用于生产。
 *
 * 策略：
 *   - 每条 lifecycle_link 生成**唯一**的 fake 地址（按租户内序号），
 *     这样"一客户多链路"会得到多个不同地址 → 正好演示 Customer 1:N Project。
 *   - 同步派生 address_normalized（复用 common/address.normalizeAddress，规则不漂移）。
 *   - 回填 phone_hash（从 customers.phone_hash 拷贝，与客户键一致）。
 *   - 同步 customers.address（取该客户第一条 link 的地址；仅当为空）。
 *   - 幂等：只填空值，可重跑。
 *
 * 安全：默认 dry-run（只读预览）；--apply 才写。RLS 逐租户 set_config。
 *   生产环境护栏：NODE_ENV=production 时拒绝执行（除非显式 --force-prod）。
 *
 * Usage:
 *   node scripts/db/seed-fake-project-addresses.js           # 预览（只读）
 *   node scripts/db/seed-fake-project-addresses.js --apply   # 写入 fake 地址
 */
const path = require('path');
const { Client } = require('pg');

process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT || path.join(__dirname, '..', '..', 'services', 'api', 'tsconfig.json');
require('ts-node/register/transpile-only');
const { normalizeAddress } = require('../../services/api/src/modules/common/address');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const FORCE_PROD = args.has('--force-prod');
const SCHEMA = 'rhautt_nexus';

if (process.env.NODE_ENV === 'production' && !FORCE_PROD) {
  console.error('✗ 生产环境禁止运行 fake 地址脚本（如确需，加 --force-prod）。');
  process.exit(2);
}

const CITIES = ['上海', '杭州', '南京', '苏州', '成都', '宁波'];
const STREETS = ['世纪大道', '中山路', '解放路', '人民路', '和平街', '滨江道', '科技路', '文一西路'];
const BUILDINGS = ['A栋', 'B栋', 'C栋', '1号楼', '2号楼', '3号楼'];

function fakeAddress(seq) {
  const city = CITIES[seq % CITIES.length];
  const street = STREETS[Math.floor(seq / CITIES.length) % STREETS.length];
  const building = BUILDINGS[seq % BUILDINGS.length];
  const no = 100 + seq;
  const room = 101 + (seq % 30);
  return `${city}市${street}${no}号${building}${room}室`;
}

function buildClientConfig() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (url) return { connectionString: url };
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.USER,
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

async function listTenants(client) {
  const { rows } = await client.query(`SELECT DISTINCT tenant_id FROM ${SCHEMA}.lifecycle_links`);
  return rows.map((r) => r.tenant_id);
}

async function processTenant(client, tenantId, report) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);

    const { rows: links } = await client.query(
      `SELECT l.id, l.customer_id, l.project_address, l.phone_hash, l.address_normalized,
              c.phone_hash AS cust_phone_hash, c.address AS cust_address
       FROM ${SCHEMA}.lifecycle_links l
       LEFT JOIN ${SCHEMA}.customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
       WHERE l.tenant_id = $1
       ORDER BY l.created_at ASC NULLS LAST, l.id ASC`,
      [tenantId],
    );

    // customer → 该客户已分配地址列表（供 customers.address 取第一条）
    const custFirstAddr = new Map();
    let seq = 0;

    for (const l of links) {
      report.scanned++;
      const needAddr = !l.project_address;
      const addr = needAddr ? fakeAddress(seq++) : l.project_address;
      const norm = normalizeAddress(addr);
      const phone = l.phone_hash || l.cust_phone_hash || null;

      if (!custFirstAddr.has(l.customer_id)) custFirstAddr.set(l.customer_id, { addr, custAddr: l.cust_address });

      if (needAddr) report.filledAddr++;
      if (l.phone_hash == null && phone) report.filledPhone++;

      if (APPLY) {
        await client.query(
          `UPDATE ${SCHEMA}.lifecycle_links
           SET project_address = COALESCE(project_address, $2),
               address_normalized = COALESCE(address_normalized, $3),
               phone_hash = COALESCE(phone_hash, $4)
           WHERE id = $1`,
          [l.id, addr, norm || null, phone],
        );
      } else if (report.samples.length < 12) {
        report.samples.push({ link: l.id, customer: l.customer_id, address: addr });
      }
    }

    // customers.address 兜底（仅填空）
    for (const [customerId, { addr, custAddr }] of custFirstAddr) {
      if (custAddr) continue;
      report.filledCustAddr++;
      if (APPLY) {
        await client.query(
          `UPDATE ${SCHEMA}.customers SET address = COALESCE(address, $2) WHERE id = $1 AND tenant_id = $3`,
          [customerId, addr, tenantId],
        );
      }
    }

    await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function main() {
  const client = new Client(buildClientConfig());
  await client.connect();
  try {
    const tenants = await listTenants(client);
    const report = { tenants: tenants.length, scanned: 0, filledAddr: 0, filledPhone: 0, filledCustAddr: 0, samples: [] };
    for (const t of tenants) await processTenant(client, t, report);

    const line = '─'.repeat(64);
    console.log(`\n${line}`);
    console.log(`FAKE 项目地址回填${APPLY ? '（已写入 --apply）' : '（DRY-RUN，只读预览）'} · DEV ONLY`);
    console.log(line);
    console.log(`租户 ${report.tenants} · 扫描 links ${report.scanned}`);
    console.log(`将填地址 ${report.filledAddr} · 将填 phone_hash ${report.filledPhone} · customers.address 兜底 ${report.filledCustAddr}`);
    if (report.samples.length) {
      console.log(`\n样例（前 ${report.samples.length}）：`);
      for (const s of report.samples) console.log(`  - ${s.address}   (link ${s.link})`);
    }
    console.log(`\n${line}`);
    console.log(APPLY ? '✅ 已写入。可重跑 npm run db:backfill-project-spine 复核。' :
      '预览完成。加 --apply 写入。');
    console.log(`${line}\n`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`fake-address error: ${err.message}`);
  process.exit(1);
});
