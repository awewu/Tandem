/**
 * Import latest OKR/KR detail export.
 *
 * Default is dry-run. Use --commit to replace OKR collections for the tenant:
 * cycles, objectives, key_results, check_ins, initiatives.
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import XLSX from 'xlsx';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const COMMIT = process.argv.includes('--commit');
const TENANT = process.env.TENANT_ID || 'default';
const XLSX_PATH =
  process.argv.find((arg) => /\.(xlsx|xls)$/i.test(arg)) ||
  'C:/Users/E00949/Desktop/OKR-KR 明细表_2026-07-23_10-13-03-667.xlsx';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
if (!existsSync(XLSX_PATH)) {
  console.error(`xlsx not found: ${XLSX_PATH}`);
  process.exit(1);
}

const now = new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${randomBytes(5).toString('hex')}`;
const clean = (v) => String(v ?? '').trim();
const normalizeName = (v) => clean(v).replace(/\s+/g, '');
const SYSTEM_NAME_ALIASES = {
  '4294967251': '营销体系',
  '2754088': '营销体系',
};
const normalizeSystemName = (v) => {
  const text = clean(v);
  return SYSTEM_NAME_ALIASES[text] ?? text;
};
const parsePercent = (v) => {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace('%', ''));
  if (!Number.isFinite(n)) return null;
  return s.includes('%') || n > 1 ? n / 100 : n;
};
const parseDate = (v) => {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s.replace(/\//g, '-'));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const confidenceOf = (p) => (p >= 0.7 ? 'on-track' : p >= 0.4 ? 'at-risk' : 'off-track');
const riskOf = (p) => (p >= 0.7 ? 'on_track' : p >= 0.4 ? 'at_risk' : 'off_track');
const percentWeight = (ratio) => Math.round(ratio * 1000) / 10;
const levelOf = (type) => {
  if (type === '公司') return 'company';
  if (type === '体系' || type === '部门' || type === '团队') return 'team';
  return 'individual';
};
const cycleByPeriod = {
  年度: {
    id: 'cycle_2026',
    period: 'year',
    name: '2026',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.999Z',
    isActive: true,
  },
  第一季度: {
    id: 'cycle_2026_q1',
    period: 'quarter',
    name: '2026 Q1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-03-31T23:59:59.999Z',
    isActive: false,
  },
  第二季度: {
    id: 'cycle_2026_q2',
    period: 'quarter',
    name: '2026 Q2',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-06-30T23:59:59.999Z',
    isActive: false,
  },
  第三季度: {
    id: 'cycle_2026_q3',
    period: 'quarter',
    name: '2026 Q3',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-09-30T23:59:59.999Z',
    isActive: false,
  },
  第四季度: {
    id: 'cycle_2026_q4',
    period: 'quarter',
    name: '2026 Q4',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.999Z',
    isActive: false,
  },
};

const workbook = XLSX.readFile(XLSX_PATH, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

const userClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
await userClient.connect();
const userRows = (
  await userClient.query(
    'select id,email,name,roles,disabled from "User" where "tenantId"=$1',
    [TENANT],
  )
).rows;
await userClient.end();

const usersByName = new Map();
for (const u of userRows) {
  const k = normalizeName(u.name);
  if (!k) continue;
  if (!usersByName.has(k)) usersByName.set(k, []);
  usersByName.get(k).push(u);
}
for (const users of usersByName.values()) {
  users.sort((a, b) => Number(a.disabled) - Number(b.disabled));
}

const ownerNames = new Set();
for (const r of rows) {
  for (const k of ['目标负责人', 'KR负责人']) {
    const n = normalizeName(r[k]);
    if (n) ownerNames.add(n);
  }
}
const duplicateNames = [...usersByName.entries()]
  .filter(([name, users]) => ownerNames.has(name) && users.filter((u) => !u.disabled).length > 1)
  .map(([name, users]) => ({ name, emails: users.map((u) => u.email) }));
if (duplicateNames.length > 0) {
  console.error('Duplicate user names matched OKR owners. Resolve before import:');
  console.error(JSON.stringify(duplicateNames, null, 2));
  process.exit(1);
}

const missingNames = [...ownerNames].filter((name) => !usersByName.has(name)).sort();
const placeholderUsers = missingNames.map((name, index) => ({
  id: id('user'),
  email: `okr-owner-${String(index + 1).padStart(3, '0')}@rhenext.local`,
  name,
  roles: ['employee'],
  tenantId: TENANT,
}));
for (const u of placeholderUsers) usersByName.set(normalizeName(u.name), [u]);

const objectiveMap = new Map();
for (const r of rows) {
  const objectiveTitle = clean(r['目标名称']);
  const krTitle = clean(r['KR名称']);
  if (!objectiveTitle || !krTitle) continue;
  const periodName = clean(r['OKR所属周期']) || '年度';
  const cycle = cycleByPeriod[periodName] ?? cycleByPeriod['年度'];
  const type = clean(r['目标类型']) || '个人';
  const ownerName = normalizeName(r['目标负责人'] || r['KR负责人']);
  const dept = normalizeSystemName(r['目标负责人所属部门'] || r['KR负责人所属部门']);
  const key = [cycle.id, type, ownerName, dept, objectiveTitle].join('||');
  if (!objectiveMap.has(key)) {
    objectiveMap.set(key, {
      id: id('obj'),
      cycleId: cycle.id,
      level: levelOf(type),
      sourceType: type,
      ownerName,
      ownerDept: dept,
      ownerId: usersByName.get(ownerName)?.[0]?.id,
      title: objectiveTitle,
      description: clean(r['目标描述']),
      weight: parsePercent(r['目标权重']),
      krs: [],
    });
  }
  const objective = objectiveMap.get(key);
  const progress = parsePercent(r['KR进度']) ?? 0;
  const krOwnerName = normalizeName(r['KR负责人'] || r['目标负责人']);
  objective.krs.push({
    id: id('kr'),
    ownerName: krOwnerName,
    ownerId: usersByName.get(krOwnerName)?.[0]?.id ?? objective.ownerId,
    title: krTitle,
    progress,
    latest: clean(r['KR最新进展']),
    description: clean(r['KR描述']),
    weight: parsePercent(r['KR权重']),
    startDate: parseDate(r['KR开始时间']),
    dueDate: parseDate(r['KR结束时间']),
  });
}

const objectives = [...objectiveMap.values()].filter((o) => o.ownerId);
for (const objective of objectives) {
  const explicitTotal = objective.krs.reduce((sum, kr) => sum + (kr.weight ?? 0), 0);
  const fallbackWeight = objective.krs.length ? 1 / objective.krs.length : 1;
  const totalWeight = explicitTotal > 0 ? explicitTotal : 1;
  const progress = objective.krs.reduce((sum, kr) => {
    const weight = explicitTotal > 0 ? (kr.weight ?? 0) / totalWeight : fallbackWeight;
    return sum + kr.progress * weight;
  }, 0);
  objective.currentProgress = Math.max(0, Math.min(1, progress));
}

const levelCounts = objectives.reduce((m, o) => {
  m[o.level] = (m[o.level] ?? 0) + 1;
  return m;
}, {});
const cycleCounts = objectives.reduce((m, o) => {
  m[o.cycleId] = (m[o.cycleId] ?? 0) + 1;
  return m;
}, {});
const krCount = objectives.reduce((sum, o) => sum + o.krs.length, 0);
const checkInCount = objectives.reduce((sum, o) => sum + o.krs.filter((kr) => kr.latest).length, 0);

console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'} | tenant=${TENANT}`);
console.log(`Source: ${XLSX_PATH}`);
console.table([
  { entity: 'source rows', count: rows.length },
  { entity: 'matched existing users', count: ownerNames.size - missingNames.length },
  { entity: 'placeholder users', count: placeholderUsers.length },
  { entity: 'objectives', count: objectives.length },
  { entity: 'key results', count: krCount },
  { entity: 'check-ins from latest progress', count: checkInCount },
]);
console.log('level counts:', JSON.stringify(levelCounts));
console.log('cycle counts:', JSON.stringify(cycleCounts));
console.log('missing names:', JSON.stringify(missingNames));

if (!COMMIT) {
  console.log('Dry-run complete. Re-run with --commit to replace OKR data.');
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
try {
  for (const collection of ['cycles', 'objectives', 'key_results', 'check_ins', 'initiatives']) {
    await client.query('delete from "KvStore" where "tenantId"=$1 and collection=$2', [TENANT, collection]);
  }

  for (const u of placeholderUsers) {
    const existing = await client.query(
      'select id from "User" where "tenantId"=$1 and name=$2 limit 1',
      [TENANT, u.name],
    );
    if (existing.rowCount > 0) {
      u.id = existing.rows[0].id;
      continue;
    }
    await client.query(
      'insert into "User" (id,email,name,roles,"tenantId",disabled,"createdAt","updatedAt") values ($1,$2,$3,$4,$5,false,$6,$6)',
      [u.id, u.email, u.name, u.roles, TENANT, new Date()],
    );
    await client.query(
      'insert into "KvStore" (collection,id,data,"tenantId") values ($1,$2,$3,$4)',
      [
        'auth_user_extras',
        u.id,
        {
          id: u.id,
          departmentId: '瑞合瑞德集团 / OKR 负责人占位',
          orgId: 'org_anchor_default',
          membershipType: 'internal',
        },
        TENANT,
      ],
    );
  }

  const usedOwnerIds = [
    ...new Set(objectives.flatMap((o) => [o.ownerId, ...o.krs.map((kr) => kr.ownerId)]).filter(Boolean)),
  ];
  if (usedOwnerIds.length > 0) {
    await client.query(
      'update "User" set disabled=false, "updatedAt"=$1 where "tenantId"=$2 and id = any($3::text[])',
      [new Date(), TENANT, usedOwnerIds],
    );
  }

  for (const cycle of Object.values(cycleByPeriod)) {
    await client.query(
      'insert into "KvStore" (collection,id,data,"tenantId") values ($1,$2,$3,$4)',
      ['cycles', cycle.id, { ...cycle, tenantId: TENANT, createdAt: now, updatedAt: now }, TENANT],
    );
  }

  for (const o of objectives) {
    await client.query(
      'insert into "KvStore" (collection,id,data,"tenantId") values ($1,$2,$3,$4)',
      [
        'objectives',
        o.id,
        {
          id: o.id,
          cycleId: o.cycleId,
          level: o.level,
          ownerId: o.ownerId,
          title: o.title,
          description: o.description,
          visibility: 'public',
          weight: percentWeight(o.weight ?? 1),
          status: 'active',
          confidence: confidenceOf(o.currentProgress),
          tags: [o.sourceType, o.ownerDept].filter(Boolean),
          collaboratorIds: [],
          watcherIds: [],
          currentProgress: o.currentProgress,
          progressOverride: null,
          tenantId: TENANT,
          createdAt: now,
          updatedAt: now,
        },
        TENANT,
      ],
    );
    const explicitTotal = o.krs.reduce((sum, kr) => sum + (kr.weight ?? 0), 0);
    const defaultWeight = o.krs.length ? Math.round(100 / o.krs.length) : 100;
    for (const kr of o.krs) {
      const krWeight = explicitTotal > 0 ? percentWeight(kr.weight ?? 0) : defaultWeight;
      await client.query(
        'insert into "KvStore" (collection,id,data,"tenantId") values ($1,$2,$3,$4)',
        [
          'key_results',
          kr.id,
          {
            id: kr.id,
            objectiveId: o.id,
            ownerId: kr.ownerId,
            coOwnerIds: [],
            title: kr.title,
            measureType: 'percentage',
            computeMethod: 'latest',
            startValue: 0,
            targetValue: 100,
            currentValue: Math.round(kr.progress * 10000) / 100,
            unit: '%',
            confidence: confidenceOf(kr.progress),
            riskStatus: riskOf(kr.progress),
            weight: krWeight,
            status: 'active',
            dueDate: kr.dueDate,
            tags: [],
            collaboratorIds: [],
            watcherIds: [],
            createdAt: now,
            updatedAt: now,
            tenantId: TENANT,
          },
          TENANT,
        ],
      );
      if (kr.latest) {
        const checkInId = id('checkin');
        await client.query(
          'insert into "KvStore" (collection,id,data,"tenantId") values ($1,$2,$3,$4)',
          [
            'check_ins',
            checkInId,
            {
              id: checkInId,
              scope: 'kr',
              scopeId: kr.id,
              authorId: kr.ownerId,
              progressBefore: 0,
              progressAfter: kr.progress,
              confidenceBefore: 'off-track',
              confidenceAfter: confidenceOf(kr.progress),
              achievements: kr.latest,
              nextSteps: null,
              blockers: null,
              createdAt: now,
              updatedAt: now,
              tenantId: TENANT,
            },
            TENANT,
          ],
        );
      }
    }
  }

  await client.query('COMMIT');
  console.log(`Committed: ${objectives.length} objectives, ${krCount} key results.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('ROLLBACK:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
