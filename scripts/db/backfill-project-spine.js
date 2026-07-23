#!/usr/bin/env node
/**
 * backfill-project-spine.js — 项目主线（Project Spine）P1 回填。
 *
 * 设计与决策见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md（方案 A：扶正 lifecycle_links）。
 *
 * 目标（幂等，仅填 NULL）：
 *   ① lifecycle_links.phone_hash        ← 从 customers.phone_hash 拷贝（已哈希，保证与客户键一致）
 *   ② lifecycle_links.address_normalized← normalizeAddress(project_address ?? customers.address)
 *   ③ 各阶段表.project_id               ← 归属 lifecycle_link.id（主线即 Project）
 *
 * 匹配优先级（阶段行 → lifecycle_link）：
 *   opportunities      : link.opportunity_id=opp.id → 同 customer_id
 *   quotations         : link.quotation_id=q.id     → 同 customer_id
 *   contracts          : link.contract_id=c.id      → 同 customer_id
 *   delivery_projects  : link.contract_id=dp.contract_id → 同 customer_id
 *   bim_projects       : link.bim_project_id=b.id   → link.quotation_id=b.quotation_id → 同 customer_id
 *   service_tickets    : link.bim_project_id=t.bim_project_id → 同 customer_id
 *   warranties         : link.bim_project_id=w.bim_project_id → 同 customer_id
 *   diagnosis_sessions : link.opportunity_id=d.opportunity_id → 同 customer_id
 *
 * 安全：
 *   - 默认 dry-run（只读报告，零写入）。--apply 才写。
 *   - RLS：FORCE ROW LEVEL SECURITY 对 owner 也生效 → 逐租户 set_config('app.tenant_id')。
 *   - 幂等：只更新 project_id/phone_hash/address_normalized 为 NULL 的行，可重跑。
 *   - 多地址塌缩：不自动拆分（风险高）；仅在报告中列出候选，交人工二次处理。
 *
 * Usage:
 *   node scripts/db/backfill-project-spine.js            # dry-run 报告（默认，只读）
 *   node scripts/db/backfill-project-spine.js --apply    # 执行回填（逐租户事务）
 *   node scripts/db/backfill-project-spine.js --json      # 报告以 JSON 输出
 */
const path = require('path');
const { Client } = require('pg');

// 复用单一真相源的地址规范化规则（避免与应用/前端漂移）。
process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT || path.join(__dirname, '..', '..', 'services', 'api', 'tsconfig.json');
require('ts-node/register/transpile-only');
const { normalizeAddress } = require('../../services/api/src/modules/common/address');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const AS_JSON = args.has('--json');

const SCHEMA = 'rhautt_nexus';

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

// 各阶段表 → 匹配 SQL（返回 stage_id, project_id 候选）。占位 $1 = tenant_id。
// 用 COALESCE 依优先级选第一命中的 link。
const STAGE_MATCHERS = {
  opportunities: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lo.id, lc.id) AS project_id
    FROM ${SCHEMA}.opportunities s
    LEFT JOIN ${SCHEMA}.lifecycle_links lo ON lo.tenant_id = s.tenant_id AND lo.opportunity_id::text = s.id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL`,
  quotations: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lq.id, lc.id) AS project_id
    FROM ${SCHEMA}.quotations s
    LEFT JOIN ${SCHEMA}.lifecycle_links lq ON lq.tenant_id = s.tenant_id AND lq.quotation_id::text = s.id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL`,
  contracts: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lk.id, lc.id) AS project_id
    FROM ${SCHEMA}.contracts s
    LEFT JOIN ${SCHEMA}.lifecycle_links lk ON lk.tenant_id = s.tenant_id AND lk.contract_id::text = s.id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL`,
  delivery_projects: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lk.id, lc.id) AS project_id
    FROM ${SCHEMA}.delivery_projects s
    LEFT JOIN ${SCHEMA}.lifecycle_links lk ON lk.tenant_id = s.tenant_id AND lk.contract_id::text = s.contract_id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL`,
  bim_projects: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lb.id, lq.id, lc.id) AS project_id
    FROM ${SCHEMA}.bim_projects s
    LEFT JOIN ${SCHEMA}.lifecycle_links lb ON lb.tenant_id = s.tenant_id AND lb.bim_project_id::text = s.id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lq ON lq.tenant_id = s.tenant_id AND lq.quotation_id::text = s.quotation_id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL`,
  service_tickets: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lb.id, lc.id) AS project_id
    FROM ${SCHEMA}.service_tickets s
    LEFT JOIN ${SCHEMA}.lifecycle_links lb ON lb.tenant_id = s.tenant_id AND lb.bim_project_id::text = s.bim_project_id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL AND s.customer_id IS NOT NULL`,
  warranties: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lb.id, lc.id) AS project_id
    FROM ${SCHEMA}.warranties s
    LEFT JOIN ${SCHEMA}.lifecycle_links lb ON lb.tenant_id = s.tenant_id AND lb.bim_project_id::text = s.bim_project_id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL AND s.customer_id IS NOT NULL`,
  diagnosis_sessions: `
    SELECT s.id AS stage_id, s.project_id AS existing,
           COALESCE(lo.id, lc.id) AS project_id
    FROM ${SCHEMA}.diagnosis_sessions s
    LEFT JOIN ${SCHEMA}.lifecycle_links lo ON lo.tenant_id = s.tenant_id AND lo.opportunity_id::text = s.opportunity_id::text
    LEFT JOIN ${SCHEMA}.lifecycle_links lc ON lc.tenant_id = s.tenant_id AND lc.customer_id::text = s.customer_id::text
    WHERE s.tenant_id = $1 AND s.project_id IS NULL AND s.customer_id IS NOT NULL`,
};

async function columnExists(client, table, column) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
    [SCHEMA, table, column],
  );
  return rows.length > 0;
}

async function preflight(client) {
  const missing = [];
  if (!(await columnExists(client, 'lifecycle_links', 'phone_hash'))) missing.push('lifecycle_links.phone_hash');
  if (!(await columnExists(client, 'lifecycle_links', 'address_normalized'))) missing.push('lifecycle_links.address_normalized');
  for (const t of Object.keys(STAGE_MATCHERS)) {
    if (!(await columnExists(client, t, 'project_id'))) missing.push(`${t}.project_id`);
  }
  return missing;
}

async function listTenants(client) {
  const { rows } = await client.query(`SELECT DISTINCT tenant_id FROM ${SCHEMA}.lifecycle_links`);
  return rows.map((r) => r.tenant_id);
}

async function setTenant(client, tenantId) {
  await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
}

// 逐租户处理，各租户一个事务（RLS 生效）。
async function processTenant(client, tenantId, report) {
  await client.query('BEGIN');
  try {
    await setTenant(client, tenantId);

    // ── ① + ② lifecycle_links: phone_hash / address_normalized ──
    const { rows: links } = await client.query(
      `SELECT l.id, l.customer_id, l.project_address, l.phone_hash, l.address_normalized,
              c.phone_hash AS cust_phone_hash, c.address AS cust_address
       FROM ${SCHEMA}.lifecycle_links l
       LEFT JOIN ${SCHEMA}.customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
       WHERE l.tenant_id = $1`,
      [tenantId],
    );

    for (const l of links) {
      const patch = {};
      if (l.phone_hash == null && l.cust_phone_hash) patch.phone_hash = l.cust_phone_hash;
      if (l.address_normalized == null) {
        const norm = normalizeAddress(l.project_address || l.cust_address);
        if (norm) patch.address_normalized = norm;
      }
      const keys = Object.keys(patch);
      report.links.scanned++;
      if (keys.length === 0) continue;
      report.links.filled++;
      if (!patch.phone_hash && l.phone_hash == null && !l.cust_phone_hash) report.links.noPhone++;
      if (patch.address_normalized == null && l.address_normalized == null) report.links.noAddress++;
      if (APPLY) {
        const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        await client.query(
          `UPDATE ${SCHEMA}.lifecycle_links SET ${sets} WHERE id = $1`,
          [l.id, ...keys.map((k) => patch[k])],
        );
      }
    }

    // 缺手机号/地址无法组唯一键的行（P2 唯一约束前必须清零）
    for (const l of links) {
      const finalPhone = l.phone_hash || l.cust_phone_hash;
      const finalAddr = l.address_normalized || normalizeAddress(l.project_address || l.cust_address);
      if (!finalPhone || !finalAddr) {
        report.links.unkeyable.push({ id: l.id, customerId: l.customer_id, hasPhone: !!finalPhone, hasAddress: !!finalAddr });
      }
    }

    // ── 多地址塌缩探测：同一 customer 在下游出现 >1 规范化地址 ──
    const { rows: addrRows } = await client.query(
      `SELECT customer_id, project_address FROM ${SCHEMA}.lifecycle_links WHERE tenant_id = $1
       UNION ALL
       SELECT id AS customer_id, address FROM ${SCHEMA}.customers WHERE tenant_id = $1
       UNION ALL
       SELECT customer_id, (project->>'address') FROM ${SCHEMA}.bim_projects WHERE tenant_id = $1
       UNION ALL
       SELECT customer_id, (project->>'address') FROM ${SCHEMA}.quotations WHERE tenant_id = $1`,
      [tenantId],
    );
    const addrByCustomer = new Map();
    for (const r of addrRows) {
      const norm = normalizeAddress(r.project_address);
      if (!norm || !r.customer_id) continue;
      if (!addrByCustomer.has(r.customer_id)) addrByCustomer.set(r.customer_id, new Set());
      addrByCustomer.get(r.customer_id).add(norm);
    }
    for (const [customerId, set] of addrByCustomer) {
      if (set.size > 1) {
        // 信息项：一客户多地址 = 合法的 Customer 1:N Project（非阻塞）。
        report.multiAddress.push({ tenantId, customerId, addresses: [...set] });
      }
    }

    // ── P2 真正阻塞：重复项目键（同 tenant+phone_hash+address_normalized 出现在 ≥2 条 link）──
    const { rows: dups } = await client.query(
      `SELECT phone_hash, address_normalized, count(*) AS c, array_agg(id::text) AS ids
       FROM ${SCHEMA}.lifecycle_links
       WHERE tenant_id = $1 AND phone_hash IS NOT NULL AND address_normalized IS NOT NULL
       GROUP BY phone_hash, address_normalized HAVING count(*) > 1`,
      [tenantId],
    );
    for (const d of dups) {
      report.duplicateKeys.push({ tenantId, count: Number(d.c), ids: d.ids });
    }

    // ── ③ 各阶段表 project_id ──
    for (const [table, sql] of Object.entries(STAGE_MATCHERS)) {
      const { rows } = await client.query(sql, [tenantId]);
      const st = (report.stages[table] ||= { scanned: 0, matched: 0, unmatched: 0 });
      for (const row of rows) {
        st.scanned++;
        if (!row.project_id) { st.unmatched++; continue; }
        st.matched++;
        if (APPLY) {
          await client.query(`UPDATE ${SCHEMA}.${table} SET project_id = $2 WHERE id = $1`, [row.stage_id, row.project_id]);
        }
      }
    }

    await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

function printReport(report) {
  if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); return; }
  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(`项目主线回填${APPLY ? '（已执行 --apply）' : '（DRY-RUN，只读，未写入）'}`);
  console.log(line);
  console.log(`租户数: ${report.tenants}`);
  console.log(`\nlifecycle_links:`);
  console.log(`  扫描 ${report.links.scanned} · 需回填 ${report.links.filled} · 缺手机号 ${report.links.noPhone} · 缺地址 ${report.links.noAddress}`);
  console.log(`  无法组唯一键（P2 前须清零）: ${report.links.unkeyable.length}`);
  for (const u of report.links.unkeyable.slice(0, 10)) {
    console.log(`    - link ${u.id} customer=${u.customerId} phone=${u.hasPhone} addr=${u.hasAddress}`);
  }
  if (report.links.unkeyable.length > 10) console.log(`    …(+${report.links.unkeyable.length - 10} 更多)`);

  console.log(`\n各阶段 project_id 匹配:`);
  for (const [t, s] of Object.entries(report.stages)) {
    const flag = s.unmatched > 0 ? ' ⚠' : '';
    console.log(`  ${t.padEnd(20)} 扫描 ${String(s.scanned).padStart(5)} · 匹配 ${String(s.matched).padStart(5)} · 未匹配 ${String(s.unmatched).padStart(5)}${flag}`);
  }

  console.log(`\n[信息] 一客户多地址（合法 Customer 1:N Project，非阻塞）: ${report.multiAddress.length}`);
  for (const m of report.multiAddress.slice(0, 5)) {
    console.log(`  - tenant ${m.tenantId} customer ${m.customerId}: ${m.addresses.join(' | ')}`);
  }
  if (report.multiAddress.length > 5) console.log(`  …(+${report.multiAddress.length - 5} 更多)`);

  console.log(`\n[阻塞] 重复项目键 (tenant+phone_hash+address_normalized 撞车，P2 前须清零): ${report.duplicateKeys.length}`);
  for (const d of report.duplicateKeys.slice(0, 10)) {
    console.log(`  - tenant ${d.tenantId} ×${d.count}: ${d.ids.join(', ')}`);
  }
  if (report.duplicateKeys.length > 10) console.log(`  …(+${report.duplicateKeys.length - 10} 更多)`);

  const stageUnmatched = Object.values(report.stages).reduce((n, s) => n + s.unmatched, 0);
  const clean = report.links.unkeyable.length === 0 && report.duplicateKeys.length === 0 && stageUnmatched === 0;
  console.log(`\n${line}`);
  console.log(clean ? '✅ 报告干净：可进入 P2（唯一约束 + NOT NULL）。' :
    '⚠ 存在阻塞项：先清理无法组键/重复键/未匹配行，再进 P2。');
  console.log(`${line}\n`);
}

async function main() {
  const client = new Client(buildClientConfig());
  await client.connect();
  try {
    const missing = await preflight(client);
    if (missing.length) {
      console.error(`✗ 迁移 036 尚未应用，缺列：\n  ${missing.join('\n  ')}\n请先运行: npm run db:migrate`);
      process.exit(2);
    }
    const tenants = await listTenants(client);
    const report = {
      tenants: tenants.length,
      links: { scanned: 0, filled: 0, noPhone: 0, noAddress: 0, unkeyable: [] },
      stages: {},
      multiAddress: [],
      duplicateKeys: [],
    };
    for (const t of tenants) await processTenant(client, t, report);
    printReport(report);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`backfill error: ${err.message}`);
  process.exit(1);
});
