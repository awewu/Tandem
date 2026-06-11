/**
 * Import 瑞合瑞德集团 正式样板数据 (组织架构 + 人员 + OKR)
 *
 * 用途: 用真实体量数据 (159 人 / 242 Objective / 735 KR) 压力验证 Tandem 全系统。
 *       上线前用 reset 脚本整体清空。
 *
 * 安全: 默认 DRY-RUN (只打印计划, 不写库)。--commit 才真正执行 (先清空再导入)。
 *
 *   node scripts/import-ruihe.mjs            # dry-run
 *   node scripts/import-ruihe.mjs --commit   # 清空全部 + 导入瑞合瑞德 (DESTRUCTIVE)
 *
 * 前置: boot.ts 已用 DISABLE_DEMO_SEED=1 关闭 demo 种子, 否则重启会重新注入演示数据。
 *
 * ─────────────────────────────── 映射决策 ───────────────────────────────
 *  - 单租户 tenantId='default', 全员 orgId=anchor, membershipType='internal'。
 *  - email = {员工编码}@ruihe.local (小写); OKR 里出现但人员清单缺失的负责人 →
 *    建占位用户 okrowner{n}@ruihe.local (role=employee)。
 *  - 统一初始密码 = Ruihe@2026 (满足强度策略)。
 *  - departmentId = 完整层级路径 (修齐部门层级):
 *      瑞合瑞德集团 / {事业部} / {组织} / ... / {叶子部门}
 *    其中新增事业部层夹在集团与组织之间, 售后服务独立成顶层单元:
 *      · 含「瑞合智造」    → 瑞合制造事业部 (从恒热中国下重挂出来)
 *      · 含「售后服务」    → 售后服务 (独立顶层单元, 与事业部同级)
 *      · 含「瑞德宜居」    → 空气事业部
 *      · 恒热中国 / 瑞美中国 → 热水事业部
 *    组织树解析: 上级按「名称」连边, 同名歧义用「编码」前缀消歧 (真实数据有 18 个重名节点)。
 *    departmentId 路径唯一, /admin/organization 据此渲染可折叠部门树。
 *  - 角色: E00001(总裁)→owner+admin; 职位含 总裁/总经理/总监/副总/经理/部长/厂长/
 *    主任/主管/CEO/COO/CFO/CTO/VP → manager; 人力部门 manager 加 steward;
 *    财务部门 → finance; 其余 employee。
 *  - OKR: 1 个年度 cycle(2026); 每个 distinct Object名称 → 1 Objective(level=team,
 *    owner=首个OKR负责人, 其余负责人入 collaboratorIds); 每行 → 1 KR(owner=KR负责人)。
 *  - 进度: 由标题哈希派生的确定性伪进度 (0..1), 让进度条/置信度有真实分布、可复现。
 * ────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import pg from 'pg';
import XLSX from 'xlsx';

// ── env ──
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const COMMIT = process.argv.includes('--commit');
const XLSX_PATH = 'C:/Users/steve/Desktop/组织架构及OKR基础数据.xlsx';
const TENANT = 'default';
const DOMAIN = 'ruihe.local';
const PASSWORD = 'Ruihe@2026';
const ANCHOR_ORG_ID = 'org_anchor_default';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
if (!existsSync(XLSX_PATH)) { console.error('xlsx not found:', XLSX_PATH); process.exit(1); }

// ── id + hash helpers (复刻 lib/storage/repository.generateId + lib/auth/password) ──
let _ctr = 0;
const genId = (prefix = '') => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  const c = (_ctr++).toString(36);
  return prefix ? `${prefix}_${ts}${rnd}${c}` : `${ts}${rnd}${c}`;
};
const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
};
// 确定性伪进度 0..1 (标题哈希)
const pseudo = (s) => {
  const h = createHash('md5').update(String(s)).digest();
  return h[0] / 255;
};
const confOf = (p) => (p >= 0.7 ? 'on-track' : p >= 0.4 ? 'at-risk' : 'off-track');
const riskOf = (p) => (p >= 0.7 ? 'on_track' : p >= 0.4 ? 'at_risk' : 'off_track');

const MANAGER_RE = /总裁|总经理|总监|副总|经理|部长|厂长|主任|主管|CEO|COO|CFO|CTO|VP|总助/;

// ── parse xlsx ──
const wb = XLSX.readFile(XLSX_PATH);
const J = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' });
const peopleRows = J('人员清单');
const okrRows = J('OKR清单');

// ── 组织树解析 (修齐部门层级) ── 上级按名称连边, 重名用编码前缀消歧
const orgNodes = J('部门组织清单').map((r) => ({
  code: String(r['编码']).trim(), name: String(r['名称']).trim(),
  parent: String(r['上级']).trim(), type: String(r['类型']).trim(),
}));
function resolveParent(node) {
  if (!node.parent) return null;
  const cands = orgNodes.filter((n) => n.name === node.parent);
  if (cands.length <= 1) return cands[0] ?? null;
  const pref = cands.filter((c) => node.code.startsWith(c.code) && c.code !== node.code);
  if (pref.length) return pref.sort((a, b) => b.code.length - a.code.length)[0];
  const lcp = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
  return cands.sort((a, b) => lcp(b.code, node.code) - lcp(a.code, node.code))[0];
}
const _pcache = new Map();
const parentNodeOf = (n) => { if (!_pcache.has(n.code)) _pcache.set(n.code, resolveParent(n)); return _pcache.get(n.code); };
const codePath = (node, d = 0) => { if (!node || d > 12) return []; const p = parentNodeOf(node); return [...(p ? codePath(p, d + 1) : []), node]; };
const ancestorNames = (node) => new Set(codePath(node).map((n) => n.name));
// 事业部归类 (按 owner 所属组织链), 优先级: 制造 > 售后(独立) > 空气 > 热水
//   · 瑞合智造          → 瑞合制造事业部 (从恒热中国下重挂出来)
//   · 售后服务          → 售后服务 (独立顶层单元, 与事业部同级, 自身即该层节点)
//   · 瑞德宜居          → 空气事业部
//   · 恒热中国 / 瑞美中国 → 热水事业部
function classifyBU(names) {
  if (names.includes('瑞合智造')) return { layer: '瑞合制造事业部', drop: ['恒热中国'] };
  if (names.includes('售后服务')) return { layer: null, drop: ['恒热中国'] }; // 售后服务 自身即顶层单元
  if (names.includes('瑞德宜居')) return { layer: '空气事业部', drop: [] };
  return { layer: '热水事业部', drop: [] };
}
function injectBU(pathNodes) {
  const names = pathNodes.map((n) => n.name);
  const cls = classifyBU(names);
  const out = ['瑞合瑞德集团'];
  if (cls.layer) out.push(cls.layer);
  for (const nm of names) {
    if (nm === '瑞合瑞德集团') continue;
    if (cls.drop.includes(nm)) continue;
    out.push(nm);
  }
  return out;
}
function deptPathFor(org, deptName) {
  const cands = orgNodes.filter((n) => n.name === deptName);
  let pick = null;
  if (cands.length === 1) pick = cands[0];
  else if (cands.length > 1) {
    const byOrg = cands.filter((c) => ancestorNames(c).has(org));
    pick = (byOrg.length ? byOrg : cands).sort((a, b) => b.code.length - a.code.length)[0];
  }
  return pick ? injectBU(codePath(pick)).join(' / ') : `瑞合瑞德集团 / ${org || '未归属'} / ${deptName}`;
}

// 人员 → 规格
const people = peopleRows.map((r) => {
  const code = String(r['员工编码']).trim();
  const name = String(r['姓名']).trim();
  const org = String(r['组织']).trim();
  const dept = String(r['部门']).trim();
  const title = String(r['职位']).trim();
  const roles = [];
  if (code === 'E00001') roles.push('owner', 'admin');
  if (MANAGER_RE.test(title)) roles.push('manager');
  if (roles.includes('manager') && /人力|人事|HR/i.test(dept)) roles.push('steward');
  if (/财务/.test(dept)) roles.push('finance');
  if (roles.length === 0) roles.push('employee');
  return { code, name, org, dept, deptPath: deptPathFor(org, dept), title, email: `${code.toLowerCase()}@${DOMAIN}`, roles: [...new Set(roles)] };
});

// OKR 负责人里人员清单缺失的 → 占位用户
const peopleNames = new Set(people.map((p) => p.name));
const okrOwnerNames = new Set();
for (const r of okrRows) {
  const a = String(r['OKR负责人']).trim();
  const b = String(r['KR负责人']).trim();
  if (a) okrOwnerNames.add(a);
  if (b) okrOwnerNames.add(b);
}
const missing = [...okrOwnerNames].filter((n) => !peopleNames.has(n));
const placeholders = missing.map((name, i) => ({
  code: `OKR${String(i + 1).padStart(3, '0')}`,
  name, org: '(外部/未归属)', dept: '(OKR 负责人-未在花名册)',
  deptPath: '瑞合瑞德集团 / (未归属) / OKR 负责人', title: 'OKR 负责人',
  email: `okrowner${i + 1}@${DOMAIN}`, roles: ['employee'],
}));

const allUsers = [...people, ...placeholders];
const nameToEmail = new Map(allUsers.map((u) => [u.name, u.email]));

// objectives: distinct Object名称 → {owners[], krs[]}
const objMap = new Map();
for (const r of okrRows) {
  const title = String(r['Object名称']).trim();
  const oOwner = String(r['OKR负责人']).trim();
  const krTitle = String(r['Key Result 名称']).trim();
  const krOwner = String(r['KR负责人']).trim();
  if (!title) continue;
  if (!objMap.has(title)) objMap.set(title, { title, owners: [], krs: [] });
  const o = objMap.get(title);
  if (oOwner && !o.owners.includes(oOwner)) o.owners.push(oOwner);
  if (krTitle) o.krs.push({ title: krTitle, owner: krOwner || oOwner });
}
const objectives = [...objMap.values()];
const totalKr = objectives.reduce((s, o) => s + o.krs.length, 0);

console.log(`Mode: ${COMMIT ? '\x1b[31mCOMMIT (DESTRUCTIVE)\x1b[0m' : 'DRY-RUN (no changes)'}\n`);
console.log('── 导入计划 ──');
console.table([
  { entity: '人员 (花名册)', n: people.length },
  { entity: '占位 OKR 负责人', n: placeholders.length },
  { entity: '用户合计', n: allUsers.length },
  { entity: 'Cycle', n: 1 },
  { entity: 'Objective', n: objectives.length },
  { entity: 'Key Result', n: totalKr },
]);
const roleDist = {};
for (const u of allUsers) for (const r of u.roles) roleDist[r] = (roleDist[r] || 0) + 1;
console.log('角色分布:', JSON.stringify(roleDist));
console.log('占位负责人:', JSON.stringify(missing));
const admins = allUsers.filter((u) => u.roles.includes('admin'));
console.log('管理员登录:', admins.map((u) => `${u.name} <${u.email}>`).join(', '), `/ 密码 ${PASSWORD}`);
// 部门层级概览
const buDist = {};
for (const u of allUsers) { const bu = u.deptPath.split(' / ')[1] ?? '?'; buDist[bu] = (buDist[bu] || 0) + 1; }
const distinctPaths = new Set(allUsers.map((u) => u.deptPath));
const maxDepth = Math.max(...[...distinctPaths].map((p) => p.split(' / ').length));
console.log('事业部分布:', JSON.stringify(buDist), '| 不同部门路径:', distinctPaths.size, '| 最大层级:', maxDepth);
console.log('部门路径示例:', [...distinctPaths].slice(0, 4).join('  |  '));

if (!COMMIT) {
  console.log('\nDRY-RUN 完成。加 --commit 实际清空并导入。');
  process.exit(0);
}

// ───────────────────────── COMMIT ─────────────────────────
const c = new pg.Client({ connectionString: url });
await c.connect();
const pwdHash = hashPassword(PASSWORD); // 复用 (dev 验证集, 同 hash 可接受)
const now = new Date();

await c.query('BEGIN');
try {
  // 1. 清空 (全表 truncate, 干净重建)
  const truncate = ['KvStore', 'User', 'Document', 'CalendarEvent', 'DriveFile',
    'Kpi', 'KpiCheckIn', 'KpiSnapshot', 'KpiManualEntry', 'KpiBonusPayout', 'KpiCausalLink', 'KpiCycle', 'KpiSubject'];
  for (const t of truncate) {
    try { await c.query(`TRUNCATE TABLE "${t}" CASCADE`); } catch (e) { console.warn(`  skip ${t}: ${e.message}`); }
  }
  console.log('✓ 清空完成');

  // 2. 用户 + extras + password
  const idByEmail = new Map();
  for (const u of allUsers) {
    const id = genId('user');
    idByEmail.set(u.email, id);
    await c.query(
      `INSERT INTO "User" (id,email,name,roles,"tenantId",disabled,"emailVerifiedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,$6,$6,$6)`,
      [id, u.email, u.name, u.roles, TENANT, now],
    );
    await c.query(
      `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('auth_user_extras',$1,$2,$3)`,
      [id, JSON.stringify({ id, departmentId: u.deptPath, orgId: ANCHOR_ORG_ID, membershipType: 'internal' }), TENANT],
    );
    await c.query(
      `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('auth_password',$1,$2,$3)`,
      [id, JSON.stringify({ id, hash: pwdHash, historyHashes: [] }), TENANT],
    );
  }
  console.log(`✓ 用户 ${allUsers.length} 人`);

  // 3. Cycle
  const cycleId = genId();
  await c.query(
    `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('cycles',$1,$2,$3)`,
    [cycleId, JSON.stringify({
      id: cycleId, period: 'year', name: '2026 年度 OKR',
      startDate: new Date('2026-01-01').toISOString(), endDate: new Date('2026-12-31').toISOString(),
      isActive: true,
    }), TENANT],
  );

  // 4. Objectives + KRs
  let objN = 0, krN = 0, skippedOwner = 0;
  const tIso = now.toISOString();
  const E00001 = idByEmail.get('e00001@ruihe.local');

  // 4.0 公司级 OKR 阶梯 (集团北极星 → 事业部 → 团队), 对齐新建的事业部结构。
  //   让中央 AI 推演有公司层锚点 + 完整 rollup 树 (原始 242 条均挂到所属事业部下)。
  const buByEmail = new Map(people.map((p) => [p.email, p.deptPath.split(' / ')[1]]));
  const leaderFor = (bu) => idByEmail.get((people.find((p) => p.roles.includes('manager') && p.deptPath.split(' / ')[1] === bu) || {}).email) ?? E00001;
  async function mkCompanyObj({ title, ownerId, parentId, level, krTitles }) {
    const id = genId();
    const krs = krTitles.map((t) => ({ t, p: pseudo(t) }));
    const prog = Math.round((krs.reduce((s, k) => s + k.p, 0) / krs.length) * 100) / 100;
    await c.query(
      `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('objectives',$1,$2,$3)`,
      [id, JSON.stringify({
        id, cycleId, level, parentObjectiveId: parentId, ownerId, title, description: '',
        visibility: 'public', weight: 100, status: 'active', confidence: confOf(prog),
        tags: ['北极星'], collaboratorIds: [], watcherIds: [],
        currentProgress: prog, progressOverride: null,
        tenantId: TENANT, createdAt: tIso, updatedAt: tIso,
      }), TENANT],
    );
    objN++;
    const w = Math.round(100 / krs.length);
    for (const k of krs) {
      const krId = genId();
      await c.query(
        `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('key_results',$1,$2,$3)`,
        [krId, JSON.stringify({
          id: krId, objectiveId: id, ownerId, coOwnerIds: [], title: k.t,
          measureType: 'percentage', computeMethod: 'latest', startValue: 0, targetValue: 100,
          currentValue: Math.round(k.p * 100), unit: '%', confidence: confOf(k.p), riskStatus: riskOf(k.p),
          weight: w, status: 'active', tags: [], collaboratorIds: [], watcherIds: [],
          createdAt: tIso, updatedAt: tIso,
        }), TENANT],
      );
      krN++;
    }
    return id;
  }
  const groupObjId = await mkCompanyObj({
    title: '瑞合瑞德集团 2026 北极星: 营收与市场份额双增长', ownerId: E00001, parentId: undefined, level: 'company',
    krTitles: ['集团全年营收同比增长 ≥ 20%', '空气能/热水核心品类市占率提升 5 个百分点', '集团经营利润率改善至目标线'],
  });
  const buObjId = {
    '热水事业部': await mkCompanyObj({
      title: '热水事业部 2026: 恒热 / 瑞美双品牌营收与份额提升', ownerId: leaderFor('热水事业部'), parentId: groupObjId, level: 'company',
      krTitles: ['热水器品类营收达成年度目标', '经销/零售渠道网络扩张', '主力机型市占率提升'],
    }),
    '空气事业部': await mkCompanyObj({
      title: '空气事业部 2026: 空气能 / 宜居业务规模突破', ownerId: leaderFor('空气事业部'), parentId: groupObjId, level: 'company',
      krTitles: ['空气能产品营收达成年度目标', '工程/零售渠道开拓', '新品上市与口碑建立'],
    }),
    '瑞合制造事业部': await mkCompanyObj({
      title: '瑞合制造事业部 2026: 智能制造提效与质量跃升', ownerId: leaderFor('瑞合制造事业部'), parentId: groupObjId, level: 'company',
      krTitles: ['订单交付准时率提升至 95%', '单台制造成本下降', '一次交检良品率提升'],
    }),
    '售后服务': await mkCompanyObj({
      title: '售后服务 2026: 服务时效与客户满意度双提升', ownerId: leaderFor('售后服务'), parentId: groupObjId, level: 'company',
      krTitles: ['上门服务准时率提升', '客户 NPS / 满意度提升', '备件齐套率与一次修复率提升'],
    }),
  };

  for (const o of objectives) {
    const ownerEmail = nameToEmail.get(o.owners[0]);
    const ownerId = ownerEmail ? idByEmail.get(ownerEmail) : null;
    if (!ownerId) { skippedOwner++; continue; }
    const parentObjectiveId = buObjId[buByEmail.get(ownerEmail)] ?? groupObjId;
    const collaboratorIds = o.owners.slice(1)
      .map((n) => idByEmail.get(nameToEmail.get(n)))
      .filter(Boolean);
    // KR 进度先算, 用其均值作 Objective 进度
    const krSpecs = o.krs.map((kr) => {
      const p = pseudo(kr.title);
      return { ...kr, p, currentValue: Math.round(p * 100) };
    });
    const objProg = krSpecs.length
      ? Math.round((krSpecs.reduce((s, k) => s + k.p, 0) / krSpecs.length) * 100) / 100
      : pseudo(o.title);
    const objId = genId();
    await c.query(
      `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('objectives',$1,$2,$3)`,
      [objId, JSON.stringify({
        id: objId, cycleId, level: 'team', parentObjectiveId, ownerId, title: o.title, description: '',
        visibility: 'public', weight: 100, status: 'active', confidence: confOf(objProg),
        tags: [], collaboratorIds, watcherIds: [],
        currentProgress: objProg, progressOverride: null,
        tenantId: TENANT, createdAt: tIso, updatedAt: tIso,
      }), TENANT],
    );
    objN++;
    const krWeight = krSpecs.length ? Math.round(100 / krSpecs.length) : 100;
    for (const kr of krSpecs) {
      const krOwnerId = idByEmail.get(nameToEmail.get(kr.owner)) ?? ownerId;
      const krId = genId();
      await c.query(
        `INSERT INTO "KvStore" (collection,id,data,"tenantId") VALUES ('key_results',$1,$2,$3)`,
        [krId, JSON.stringify({
          id: krId, objectiveId: objId, ownerId: krOwnerId, coOwnerIds: [],
          title: kr.title, measureType: 'percentage', computeMethod: 'latest',
          startValue: 0, targetValue: 100, currentValue: kr.currentValue, unit: '%',
          confidence: confOf(kr.p), riskStatus: riskOf(kr.p), weight: krWeight,
          status: 'active', tags: [], collaboratorIds: [], watcherIds: [],
          createdAt: tIso, updatedAt: tIso,
        }), TENANT],
      );
      krN++;
    }
  }
  console.log(`✓ OKR: 1 cycle + ${objN} objective + ${krN} KR (跳过无主 objective ${skippedOwner})`);

  await c.query('COMMIT');
  console.log('\x1b[32m✓ COMMIT 完成。\x1b[0m 重启 server (DISABLE_DEMO_SEED=1) 后即为瑞合瑞德数据。');
} catch (err) {
  await c.query('ROLLBACK');
  console.error('\x1b[31mROLLBACK:\x1b[0m', err.message);
  process.exitCode = 1;
}
await c.end();
