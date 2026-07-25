#!/usr/bin/env node
/**
 * PMS Demo 种子 · 查重记录 + 撞单申诉 (点亮信息管理岗工作台)
 *
 * 直连本地 Postgres (localhost:5432 via .env.local DATABASE_URL).
 * 幂等: 已存在 tenant=default 的申诉则跳过.
 *
 * 用法: node scripts/seed-pms-appeals.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) { console.error('❌ .env.local not found'); process.exit(1); }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (!k) continue;
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[k.trim()] = val;
  }
}
loadEnv();

const TENANT = 'default';
const APPEALER = 'demo-dealer-user';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('❌ DATABASE_URL missing'); process.exit(1); }
  // postgres 包不识别 ?schema=public 参数, 去掉
  const sql = postgres(url.split('?')[0], { max: 1 });

  try {
    const now = new Date();

    // --- 生命周期做旧 (点亮预警区; 独立幂等: 已有超期商机则跳过) ---
    const [{ aged }] = await sql`
      SELECT count(*)::int AS aged FROM pms_opportunities
      WHERE "tenantId" = ${TENANT} AND status = 'active' AND "archivedAt" IS NULL
        AND coalesce("lastFollowUpAt", "createdAt") < ${new Date(now.getTime() - 75 * 86400_000)}`;
    if (aged === 0) {
      const stale = await sql`
        SELECT id FROM pms_opportunities
        WHERE "tenantId" = ${TENANT} AND status = 'active' AND "archivedAt" IS NULL
        ORDER BY "createdAt" ASC LIMIT 2`;
      const ageDays = [95, 80];
      for (let i = 0; i < stale.length; i++) {
        await sql`UPDATE pms_opportunities SET "lastFollowUpAt" = ${new Date(now.getTime() - ageDays[i] * 86400_000)} WHERE id = ${stale[i].id}`;
      }
      console.log(`[seed] 生命周期做旧 ${stale.length} 条商机 (95/80 天无跟进)`);
    } else {
      console.log(`[seed] 已有 ${aged} 条超期商机, 跳过做旧`);
    }

    // 幂等守卫: 仅当无"进行中"申诉 (pending/under_review) 时补种, 让被仲裁消费后可再点亮
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM pms_duplicate_appeals
      WHERE "tenantId" = ${TENANT} AND status IN ('pending', 'under_review')`;
    if (count > 0) {
      console.log(`[seed] 已存在 ${count} 条进行中申诉, 跳过 (幂等)`);
      await sql.end();
      return;
    }

    // 取 3 条活跃商机作为撞单参照
    const opps = await sql`
      SELECT id, "customerName" FROM pms_opportunities
      WHERE "tenantId" = ${TENANT} AND status = 'active' AND "archivedAt" IS NULL
      ORDER BY "createdAt" DESC LIMIT 3`;
    if (opps.length === 0) {
      console.error('❌ 无活跃商机, 请先 node scripts/seed-pms-demo.mjs');
      await sql.end();
      process.exit(1);
    }

    const checks = [
      { status: 'duplicate', score: '0.86', dims: ['customerName', 'address', 'phone'] },
      { status: 'warning', score: '0.68', dims: ['customerName', 'projectName'] },
      { status: 'warning', score: '0.63', dims: ['address', 'phone'] },
    ];

    const checkIds = [];
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      const opp = opps[i % opps.length];
      const id = randomUUID();
      checkIds.push(id);
      await sql`
        INSERT INTO pms_duplicate_checks
          (id, "tenantId", "opportunityId", "duplicateOpportunityId", "similarityScore", dimensions, status, "resolvedBy", "resolvedAt", "createdAt")
        VALUES
          (${id}, ${TENANT}, '', ${opp.id}, ${c.score}, ${sql.json(c.dims)}, ${c.status}, NULL, NULL, ${new Date(now.getTime() - i * 3600_000)})`;
    }
    console.log(`[seed] 插入 ${checkIds.length} 条查重记录 (2 warning + 1 duplicate)`);

    // 对前 2 条查重发起申诉 (pending + under_review)
    const appeals = [
      { checkId: checkIds[0], status: 'pending', reason: '该客户为我方三个月前首报, 有拜访记录与报价单为证, 请求撤销撞单判定' },
      { checkId: checkIds[1], status: 'under_review', reason: '同名不同项目, 实为客户旗下另一栋楼独立立项, 附立项批文' },
    ];
    for (const a of appeals) {
      await sql`
        INSERT INTO pms_duplicate_appeals
          (id, "tenantId", "duplicateCheckId", "appealerId", reason, evidence, status,
           "arbitratedBy", "arbitrationResult", "arbitrationReason", "arbitratedAt", "createdAt")
        VALUES
          (${randomUUID()}, ${TENANT}, ${a.checkId}, ${APPEALER}, ${a.reason},
           ${sql.json(['evidence://demo/visit-log.pdf', 'evidence://demo/quotation.pdf'])}, ${a.status},
           NULL, NULL, NULL, NULL, ${now})`;
    }
    console.log(`[seed] 插入 ${appeals.length} 条申诉 (1 pending + 1 under_review)`);
    console.log('✅ 完成 — 打开 /pms/deal-desk 查看待仲裁申诉与未解决查重');

    await sql.end();
  } catch (e) {
    console.error('FAIL:', e.message);
    await sql.end();
    process.exit(1);
  }
}

main();
