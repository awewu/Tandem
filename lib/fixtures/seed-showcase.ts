/**
 * Showcase Seed · 连贯虚拟公司「恒热中央热水 Everhot」全流程演示数据
 *
 * 目标: 让 112 个页面/14 条业务流都有真实、互相关联的内容。
 *   同一批人/部门 串起 OKR → KR check-in → 1on1 → 360 → 决策 → Memory → IM。
 *
 * 设计:
 *   - 幂等: 以哨兵用户 (CEO 邮箱) 是否存在判定是否已 seed, 已有则整体跳过。
 *   - fail-soft: 每个域 try/catch 独立, 单域失败不阻断其余 (照搬 seed.ts 风格)。
 *   - 多租户: 全部 tenantId='default', 内部员工 orgId=anchor, membershipType='internal'。
 *
 * 由 boot.ts 的幂等 seed 链调用 (seedShowcaseIfEmpty)。
 */

import { getStore } from '../storage/repository';
import { hashPassword } from '../auth/password';
import { ANCHOR_ORG_ID } from '../types/organization';
import type { Role } from '../auth/roles';
import { createChannel, sendMessage } from '../im/service';
import { createDownstreamOrg, inviteDownstreamMember } from '../auth/organizations';
import type { Cycle, Objective, KeyResult, CheckIn, Initiative } from '../types/okr-tti';
import type { DecisionCard } from '../types/decision-card';
import type { MemoryEntry } from '../types/memory';
import type { Persona } from '../types/persona';
import type { IntranetPost } from '../types/intranet-post';
import type { KnowledgeNode } from '../types/knowledge';
import type { Kpi } from '../types/kpi';

const TENANT = 'default';
const DEMO_PASSWORD = 'Everhot@2026'; // 10+ 大小写+数字+符号, 满足 password 策略
const DOMAIN = 'everhot.com.cn';
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ahead = (d: number) => new Date(Date.now() + d * DAY).toISOString();

// ---------------------------------------------------------------------------
// 花名册 (handle → 定义). handle 仅用于本文件内引用, 真 userId 创建后回填。
// ---------------------------------------------------------------------------

interface PersonSpec {
  handle: string;
  name: string;
  emailLocal: string;
  roles: Role[];
  dept: string;
  title: string;
}

const ROSTER: PersonSpec[] = [
  { handle: 'ceo',     name: '何恒',   emailLocal: 'heheng',        roles: ['owner', 'admin'], dept: '总经办',     title: '创始人 / CEO' },
  { handle: 'coo',     name: '周明',   emailLocal: 'zhouming',      roles: ['manager'],         dept: '总经办',     title: '运营 COO' },
  { handle: 'salesvp', name: '李伟',   emailLocal: 'liwei',         roles: ['manager'],         dept: '销售部',     title: '销售副总' },
  { handle: 'salesmgr',name: '王芳',   emailLocal: 'wangfang',      roles: ['manager'],         dept: '销售部',     title: '区域销售经理' },
  { handle: 'sales1',  name: '张强',   emailLocal: 'zhangqiang',    roles: ['employee'],        dept: '销售部',     title: '销售代表' },
  { handle: 'sales2',  name: '赵敏',   emailLocal: 'zhaomin',       roles: ['employee'],        dept: '销售部',     title: '销售代表' },
  { handle: 'mktg',    name: '孙磊',   emailLocal: 'sunlei',        roles: ['manager', 'champion'], dept: '市场部', title: '市场总监' },
  { handle: 'mktg1',   name: '刘洋',   emailLocal: 'liuyang',       roles: ['employee'],        dept: '市场部',     title: '市场专员' },
  { handle: 'rd',      name: '陈静',   emailLocal: 'chenjing',      roles: ['manager'],         dept: '研发部',     title: '研发总监' },
  { handle: 'eng1',    name: '杨帆',   emailLocal: 'yangfan',       roles: ['employee'],        dept: '研发部',     title: '高级工程师' },
  { handle: 'eng2',    name: '黄磊',   emailLocal: 'huanglei',      roles: ['employee'],        dept: '研发部',     title: '工程师' },
  { handle: 'pm',      name: '吴婷',   emailLocal: 'wuting',        roles: ['employee', 'champion'], dept: '研发部', title: '产品经理' },
  { handle: 'ops',     name: '郑浩',   emailLocal: 'zhenghao',      roles: ['manager'],         dept: '生产部',     title: '生产总监' },
  { handle: 'supply',  name: '冯丽',   emailLocal: 'fengli',        roles: ['manager'],         dept: '供应链部',   title: '供应链经理' },
  { handle: 'hr',      name: '何娟',   emailLocal: 'hejuan',        roles: ['steward'],         dept: '人力资源部', title: 'HR 总监 / 数据管家' },
  { handle: 'finance', name: '林峰',   emailLocal: 'linfeng',       roles: ['finance'],         dept: '财务部',     title: '财务总监' },
  { handle: 'cs',      name: '唐悦',   emailLocal: 'tangyue',       roles: ['employee'],        dept: '客户成功部', title: '客户成功专员' },
];

type IdMap = Record<string, string>;

/** 主入口: 幂等 seed 整家公司 */
export async function seedShowcaseIfEmpty(): Promise<void> {
  const s = getStore();
  if (!s.auth) return;

  // CEO 是否已存在 → 决定第一批 (非幂等) 是否跑; 第二批各 phase 自带幂等守卫。
  const sentinelEmail = `${ROSTER[0].emailLocal}@${DOMAIN}`;
  let ceoExisted = false;
  try {
    ceoExisted = !!(await s.auth.users.findByEmail(sentinelEmail));
  } catch {
    return;
  }

  // eslint-disable-next-line no-console
  console.info('[seed:showcase] 注入「恒热中央热水 Everhot」…(ceoExisted=' + ceoExisted + ')');

  // 花名册 (findByEmail-or-create, 幂等) — 始终执行以拿到 id 映射
  const ids = await seedRoster();
  if (Object.keys(ids).length === 0) {
    console.warn('[seed:showcase] 花名册创建失败, 中止');
    return;
  }

  // 第一批 (非幂等): 仅首次 (CEO 此前不存在) 执行, 防重复插入
  if (!ceoExisted) {
    await seedOkr(ids);
    await seedOneOnOne(ids);
    await seed360(ids);
    await seedDecisions(ids);
    await seedMemory(ids);
    await seedIm(ids);
  }

  // 第二批 (各 phase 自带 exists 守卫, 可安全重入)
  await seedPersonas(ids);
  await seedIntranet(ids);
  await seedKnowledge(ids);
  await seedDocsAndCalendar(ids);
  await seedKpiRoster(ids);
  await seedDownstream(ids);

  // eslint-disable-next-line no-console
  console.info('[seed:showcase] 完成。');
}

// ---------------------------------------------------------------------------
// Phase 1 · 花名册 (users + 密码)
// ---------------------------------------------------------------------------

async function seedRoster(): Promise<IdMap> {
  const s = getStore();
  const ids: IdMap = {};
  for (const p of ROSTER) {
    try {
      const email = `${p.emailLocal}@${DOMAIN}`;
      let user = await s.auth.users.findByEmail(email);
      if (!user) {
        user = await s.auth.users.create({
          email,
          name: p.name,
          roles: [...p.roles],
          tenantId: TENANT,
          orgId: ANCHOR_ORG_ID,
          membershipType: 'internal',
          departmentId: p.dept,
          emailVerifiedAt: new Date().toISOString(),
        });
        await s.auth.users.savePasswordHash(user.id, hashPassword(DEMO_PASSWORD));
      }
      ids[p.handle] = user.id;
    } catch (err) {
      console.warn(`[seed:showcase] 用户 ${p.handle} 创建失败:`, (err as Error).message);
    }
  }
  console.info(`[seed:showcase] 花名册: ${Object.keys(ids).length}/${ROSTER.length} 人`);
  return ids;
}

// ---------------------------------------------------------------------------
// Phase 2 · OKR 三层树 + check-in + initiative
// ---------------------------------------------------------------------------

async function seedOkr(ids: IdMap): Promise<string | null> {
  const s = getStore();
  try {
    const cycle = await s.cycles.create({
      period: 'quarter',
      name: '2026 Q2',
      startDate: new Date('2026-04-01').toISOString(),
      endDate: new Date('2026-06-30').toISOString(),
      isActive: true,
    } as Omit<Cycle, 'id'>);

    const mkObj = async (o: Partial<Objective> & { ownerId: string; title: string; level: Objective['level'] }) =>
      s.objectives.create({
        cycleId: cycle.id,
        level: o.level,
        parentObjectiveId: o.parentObjectiveId,
        ownerId: o.ownerId,
        title: o.title,
        description: o.description ?? '',
        visibility: 'public',
        weight: o.weight ?? 100,
        status: 'active',
        confidence: o.confidence ?? 'on-track',
        tags: o.tags ?? [],
        collaboratorIds: [],
        watcherIds: [],
        currentProgress: o.currentProgress ?? 0,
        progressOverride: null,
        tenantId: TENANT,
        createdAt: ago(50),
        updatedAt: ago(2),
      } as Omit<Objective, 'id'>);

    const mkKr = async (kr: Partial<KeyResult> & { objectiveId: string; ownerId: string; title: string; startValue: number; targetValue: number; currentValue: number }) =>
      s.keyResults.create({
        objectiveId: kr.objectiveId,
        ownerId: kr.ownerId,
        coOwnerIds: [],
        title: kr.title,
        measureType: kr.measureType ?? 'percentage',
        computeMethod: kr.computeMethod ?? 'latest',
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        unit: kr.unit ?? '%',
        confidence: kr.confidence ?? 'on-track',
        riskStatus: kr.riskStatus ?? 'on_track',
        weight: kr.weight ?? 50,
        status: 'active',
        tags: [],
        collaboratorIds: [],
        watcherIds: [],
        createdAt: ago(50),
        updatedAt: ago(2),
      } as Omit<KeyResult, 'id'>);

    // 公司级 O (CEO)
    const oCompany = await mkObj({
      ownerId: ids.ceo, level: 'company',
      title: '恒热 Everhot · 2026 成为华东中央热水第一品牌',
      description: '营收、口碑、渠道三线齐增, 站稳华东中央热水高端市场。',
      tags: ['北极星'], currentProgress: 0.52,
    });
    await mkKr({ objectiveId: oCompany.id, ownerId: ids.ceo, title: '全年营收达成 2.4 亿', startValue: 0, targetValue: 2.4, currentValue: 1.15, unit: '亿', weight: 40, confidence: 'on-track' });
    await mkKr({ objectiveId: oCompany.id, ownerId: ids.ceo, title: '净推荐值 NPS ≥ 55', startValue: 38, targetValue: 55, currentValue: 47, unit: '分', weight: 30, confidence: 'at-risk' });
    await mkKr({ objectiveId: oCompany.id, ownerId: ids.ceo, title: '经销商网络扩至 120 家', startValue: 80, targetValue: 120, currentValue: 96, unit: '家', weight: 30, confidence: 'on-track' });

    // 团队级 O — 销售 (李伟)
    const oSales = await mkObj({
      ownerId: ids.salesvp, level: 'team', parentObjectiveId: oCompany.id,
      title: '销售: Q2 新签 + 复购双增长', currentProgress: 0.6,
    });
    const krSalesRev = await mkKr({ objectiveId: oSales.id, ownerId: ids.salesmgr, title: 'Q2 新签合同额 6000 万', startValue: 0, targetValue: 6000, currentValue: 3900, unit: '万', weight: 50, confidence: 'on-track' });
    await mkKr({ objectiveId: oSales.id, ownerId: ids.sales1, title: '大客户复购率 ≥ 65%', startValue: 50, targetValue: 65, currentValue: 58, unit: '%', weight: 50, confidence: 'at-risk' });

    // 团队级 O — 研发 (陈静)
    const oRd = await mkObj({
      ownerId: ids.rd, level: 'team', parentObjectiveId: oCompany.id,
      title: '研发: 新一代中央热水机型如期量产', currentProgress: 0.45, confidence: 'at-risk',
    });
    const krRd = await mkKr({ objectiveId: oRd.id, ownerId: ids.eng1, title: '样机能效达到一级标准', startValue: 0, targetValue: 100, currentValue: 70, unit: '%', weight: 60, confidence: 'at-risk' });
    await mkKr({ objectiveId: oRd.id, ownerId: ids.pm, title: '完成 30 户内测并收集反馈', startValue: 0, targetValue: 30, currentValue: 22, unit: '户', measureType: 'numeric', computeMethod: 'cumulative', weight: 40, confidence: 'on-track' });

    // 个人级 O — 销售代表 张强
    const oZhang = await mkObj({
      ownerId: ids.sales1, level: 'individual', parentObjectiveId: oSales.id,
      title: '张强: 成为华东大客户标杆销售', currentProgress: 0.55,
    });
    await mkKr({ objectiveId: oZhang.id, ownerId: ids.sales1, title: '个人新签 1500 万', startValue: 0, targetValue: 1500, currentValue: 880, unit: '万', weight: 100, confidence: 'on-track' });

    // check-in (挂 KR) — 让 /report、KR 进度史有内容
    const mkCheckIn = async (c: Partial<CheckIn> & { scopeId: string; authorId: string; progressBefore: number; progressAfter: number }) =>
      s.checkIns.create({
        scope: 'kr',
        scopeId: c.scopeId,
        authorId: c.authorId,
        progressBefore: c.progressBefore,
        progressAfter: c.progressAfter,
        confidenceBefore: c.confidenceBefore ?? 'on-track',
        confidenceAfter: c.confidenceAfter ?? 'on-track',
        achievements: c.achievements ?? null,
        blockers: c.blockers ?? null,
        nextSteps: c.nextSteps ?? null,
        mood: c.mood ?? 'neutral',
        createdAt: c.createdAt ?? ago(7),
      } as Omit<CheckIn, 'id'>);

    await mkCheckIn({ scopeId: krSalesRev.id, authorId: ids.salesmgr, progressBefore: 45, progressAfter: 65, achievements: '签下宁波两家连锁建材商', nextSteps: '推进苏州大单', mood: 'happy', createdAt: ago(6) });
    await mkCheckIn({ scopeId: krRd.id, authorId: ids.eng1, progressBefore: 55, progressAfter: 70, blockers: '压缩机供货延迟一周', nextSteps: '与供应链冯丽对齐替代方案', mood: 'sad', createdAt: ago(4) });

    // initiative (挂 KR)
    await s.initiatives.create({
      keyResultId: krSalesRev.id, ownerId: ids.sales1,
      title: '华东建材展布展 + 现场签约', status: 'in_progress', dueDate: ahead(10), tenantId: TENANT,
    } as Omit<Initiative, 'id'>);
    await s.initiatives.create({
      keyResultId: krRd.id, ownerId: ids.eng2,
      title: '能效测试台搭建', status: 'done', dueDate: ago(5), tenantId: TENANT,
    } as Omit<Initiative, 'id'>);

    console.info('[seed:showcase] OKR: 4 Objective + 8 KR + check-in/initiative');
    return cycle.id;
  } catch (err) {
    console.warn('[seed:showcase] OKR 失败:', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 3a · 1on1 (多状态)
// ---------------------------------------------------------------------------

async function seedOneOnOne(ids: IdMap): Promise<void> {
  const s = getStore();
  const now = new Date().toISOString();
  try {
    // 已完成的一次 (李伟 ↔ 张强)
    await s.oneOnOneMeetings.create({
      tenantId: TENANT, managerId: ids.salesvp, reportId: ids.sales1,
      cadence: 'biweekly', scheduledAt: ago(7), startedAt: ago(7), completedAt: ago(7),
      status: 'completed',
      agendaManager: '复盘宁波大单 + Q2 个人目标',
      agendaReport: '希望增配一名售前支持',
      noteProgress: '宁波连锁已签, 苏州在谈',
      noteBlockers: '售前人手紧张',
      noteNextSteps: '市场部协助出定制方案',
      linkedKrIds: [], moodScore: 4, privateManagerNote: '状态积极, 可培养为标杆',
      createdAt: now, updatedAt: now,
    } as never);
    // 已排期未开始 (陈静 ↔ 杨帆)
    await s.oneOnOneMeetings.create({
      tenantId: TENANT, managerId: ids.rd, reportId: ids.eng1,
      cadence: 'weekly', scheduledAt: ahead(2), startedAt: null, completedAt: null,
      status: 'scheduled',
      agendaManager: '样机能效攻坚 + 供货风险', agendaReport: '需要采购加急压缩机',
      noteProgress: null, noteBlockers: null, noteNextSteps: null,
      linkedKrIds: [], moodScore: null, privateManagerNote: null,
      createdAt: now, updatedAt: now,
    } as never);
    console.info('[seed:showcase] 1on1: 2 场 (completed + scheduled)');
  } catch (err) {
    console.warn('[seed:showcase] 1on1 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 3b · 360 评估周期 (active)
// ---------------------------------------------------------------------------

async function seed360(ids: IdMap): Promise<void> {
  const s = getStore();
  const now = new Date().toISOString();
  try {
    await s.review360Cycles.create({
      tenantId: TENANT,
      name: '2026 Q2 360 评估',
      startDate: ago(10), endDate: ahead(20),
      status: 'active',
      questions: [
        { id: 'q1', text: '此人在跨部门协作中的表现', type: 'mixed', anonymous: true, qualitative: true },
        { id: 'q2', text: '此人的决策质量与担当', type: 'mixed', anonymous: true, qualitative: true },
        { id: 'q3', text: '此人值得继续发扬的一点', type: 'qualitative', anonymous: true, qualitative: true },
      ],
      anonymizePeers: true,
      createdBy: ids.hr,
      createdAt: now, updatedAt: now,
    } as never);
    void ids;
    console.info('[seed:showcase] 360: 1 个 active 周期');
  } catch (err) {
    console.warn('[seed:showcase] 360 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 4 · 决策卡 (各 convergence 状态)
// ---------------------------------------------------------------------------

async function seedDecisions(ids: IdMap): Promise<void> {
  const s = getStore();
  const cards: Array<Partial<DecisionCard> & { title: string }> = [
    { title: '压缩机供货延迟, 是否切换备用供应商', decisionClass: 'complex', convergenceState: 'COMMIT', elapsedSeconds: 13 * 60 + 40, selected: 'B', createdBy: ids.supply, createdAt: ago(3) },
    { title: '华东建材展预算追加 20 万是否批准', decisionClass: 'strategic', convergenceState: 'COMMIT', elapsedSeconds: 15 * 60 + 12, selected: 'A', createdBy: ids.ceo, createdAt: ago(8) },
    { title: '新机型定价 high vs 走量', decisionClass: 'strategic', convergenceState: 'DIVERGE', elapsedSeconds: 9 * 60, createdBy: ids.pm, createdAt: ago(1) },
    { title: '苏州大单赶工是否加班', decisionClass: 'simple', convergenceState: 'ESCALATED', elapsedSeconds: 17 * 60, createdBy: ids.salesmgr, createdAt: ago(5) },
  ];
  for (const d of cards) {
    try {
      await s.decisionCards.create({
        schemaVersion: 'tandem.v1',
        title: d.title,
        decisionClass: d.decisionClass as never,
        convergenceState: d.convergenceState as never,
        elapsedSeconds: d.elapsedSeconds!,
        selected: d.selected as never,
        options: [],
        actionItems: [],
        createdBy: d.createdBy!,
        createdAt: d.createdAt!,
        watermark: { isProxy: false },
      } as Omit<DecisionCard, 'id'>);
    } catch (err) {
      console.warn('[seed:showcase] 决策卡失败:', (err as Error).message);
    }
  }
  console.info(`[seed:showcase] 决策卡: ${cards.length} 张 (COMMIT/DIVERGE/ESCALATED)`);
}

// ---------------------------------------------------------------------------
// Phase 5a · Memory (SOP / 案例 / 红线 / 价值观)
// ---------------------------------------------------------------------------

async function seedMemory(ids: IdMap): Promise<void> {
  const s = getStore();
  void ids;
  const memories: Omit<MemoryEntry, 'id'>[] = [
    {
      type: 'sop', title: '经销商签约 SOP', body: '1. 资质审核\n2. 区域保护评估\n3. 首批订货量约定\n4. 培训与样机配送\n5. 录入上下游组织',
      status: 'active', ownershipLevel: 'company', signers: [], referenceCount: 9, createdAt: ago(120), updatedAt: ago(10),
    },
    {
      type: 'sop', title: '热水器安装质保 SOP', body: '1. 上门勘测\n2. 标准化安装\n3. 通电测试\n4. 客户签字\n5. 6 年质保登记',
      status: 'active', ownershipLevel: 'company', signers: [], referenceCount: 21, createdAt: ago(200), updatedAt: ago(30),
    },
    {
      type: 'case', title: '宁波连锁建材商攻坚案例', body: '通过区域独家 + 联合促销, 14 天拿下宁波两家连锁, 首批订货 320 万。',
      status: 'active', ownershipLevel: 'department', signers: [], referenceCount: 4, createdAt: ago(20), updatedAt: ago(6),
    },
    {
      type: 'redline', title: '红线: 禁止承诺超 6 年质保', body: '任何销售不得口头/书面承诺超过标准 6 年质保, 违反计入绩效红线。',
      status: 'active', ownershipLevel: 'company', signers: [], referenceCount: 0, createdAt: ago(150), updatedAt: ago(150),
    },
    {
      type: 'value', title: '价值观: 让每一户都有稳定的热水', body: '以用户长期体验为先, 不为短期出货牺牲安装质量与售后。',
      status: 'active', ownershipLevel: 'company', signers: [], referenceCount: 7, createdAt: ago(300), updatedAt: ago(60),
    },
  ];
  for (const m of memories) {
    try {
      await s.memories.create(m);
    } catch (err) {
      console.warn('[seed:showcase] memory 失败:', (err as Error).message);
    }
  }
  console.info(`[seed:showcase] Memory: ${memories.length} 条`);
}

// ---------------------------------------------------------------------------
// Phase 5b · IM 频道 + 消息
// ---------------------------------------------------------------------------

async function seedIm(ids: IdMap): Promise<void> {
  try {
    const all = [ids.ceo, ids.coo, ids.salesvp, ids.salesmgr, ids.rd, ids.pm, ids.hr].filter(Boolean);
    const general = await createChannel({
      type: 'group', name: '全员公告', topic: '全公司广播', visibility: 'public',
      memberIds: all, createdBy: ids.ceo,
    });
    const sales = await createChannel({
      type: 'group', name: '销售战报', topic: '每日签约播报 + 大单协同', visibility: 'public',
      memberIds: [ids.ceo, ids.salesvp, ids.salesmgr, ids.sales1, ids.sales2].filter(Boolean), createdBy: ids.salesvp,
    });
    await sendMessage({ channelId: general.id, senderId: ids.ceo, body: '本季目标: 华东增长第一。各部门 OKR 已对齐, 加油! 🚀' });
    await sendMessage({ channelId: sales.id, senderId: ids.salesmgr, body: '宁波连锁今天签了! 320 万首批订货 🎉' });
    await sendMessage({ channelId: sales.id, senderId: ids.sales1, body: '苏州大单在推进, 需要市场出定制方案支持。' });
    console.info('[seed:showcase] IM: 2 频道 + 3 消息');
  } catch (err) {
    console.warn('[seed:showcase] IM 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 6 · Persona (roster 部分成员, 不同阶段) — /persona/* + 9宫格 TTI
// ---------------------------------------------------------------------------

async function seedPersonas(ids: IdMap): Promise<void> {
  const s = getStore();
  let have = new Set<string>();
  try { have = new Set((await s.personas.list()).map((p) => (p as { userId: string }).userId)); } catch { /* ignore */ }
  const specs: Array<{ handle: string; stage: string; delegation: string; total: number; self: number; ai: number; veto: number; capture: number; speed: string; risk: number; comm: string }> = [
    { handle: 'salesmgr', stage: 'assistant',  delegation: 'soft_opinion', total: 210, self: 170, ai: 35, veto: 5, capture: 64, speed: 'fast',   risk: 0.6, comm: 'direct' },
    { handle: 'rd',       stage: 'apprentice', delegation: 'report_only',  total: 88,  self: 70,  ai: 15, veto: 3, capture: 41, speed: 'medium', risk: 0.35, comm: 'analytical' },
    { handle: 'pm',       stage: 'apprentice', delegation: 'report_only',  total: 52,  self: 40,  ai: 11, veto: 1, capture: 33, speed: 'medium', risk: 0.5, comm: 'collaborative' },
    { handle: 'sales1',   stage: 'apprentice', delegation: 'report_only',  total: 34,  self: 28,  ai: 6,  veto: 2, capture: 26, speed: 'fast',   risk: 0.55, comm: 'direct' },
  ];
  let n = 0;
  for (const p of specs) {
    const userId = ids[p.handle];
    if (!userId || have.has(userId)) continue;
    try {
      await s.personas.create({
        userId,
        schemaVersion: 'tandem.v1',
        stage: p.stage,
        stageEnteredAt: ago(60),
        delegationLevel: p.delegation,
        decisionHistory: {
          totalDecisions: p.total,
          selfMade: p.self,
          aiAssisted: p.ai,
          vetoedByUser: p.veto,
          vetoRate: Math.round((p.veto / p.total) * 1000) / 1000,
        },
        styleProfile: {
          decisionSpeed: p.speed,
          riskAppetite: p.risk,
          communicationStyle: p.comm,
          preferredOptions: ['reasoning', 'SOP', 'historical', 'original', 'reasoning'],
          communicationExamples: [],
        },
        growthAreas: [],
        bossCaptureScore: p.capture,
        dataOwnership: {
          companyOwnsData: true,
          anonymizationPending: false,
          employeeCanExportOrigins: true,
        },
        learningActive: true,
        createdAt: ago(60),
        updatedAt: ago(2),
      } as unknown as Omit<Persona, 'id'>);
      n++;
    } catch (err) {
      console.warn(`[seed:showcase] persona ${p.handle} 失败:`, (err as Error).message);
    }
  }
  console.info(`[seed:showcase] Persona: ${n} 个`);
}

// ---------------------------------------------------------------------------
// Phase 7 · Intranet 帖子 (公告/政策/大事记/福利) — /intranet/*
// ---------------------------------------------------------------------------

async function seedIntranet(ids: IdMap): Promise<void> {
  const s = getStore();
  if (!s.intranetPosts) return;
  try {
    const existing = await s.intranetPosts.list();
    if (existing.some((p) => p.title.includes('华东增长第一'))) { console.info('[seed:showcase] Intranet: 已存在, 跳过'); return; }
  } catch { /* ignore */ }
  const now = new Date().toISOString();
  const posts: Omit<IntranetPost, 'id'>[] = [
    {
      type: 'announcement', title: '恒热 Everhot · 2026 Q2 启动: 华东增长第一', body: '## 季度目标\n营收 2.4 亿 / NPS 55 / 经销商 120 家。各部门 OKR 已对齐, 共同冲刺!',
      summary: 'Q2 启动, 三大北极星指标对齐。', mandatoryRead: false, readBy: [ids.ceo, ids.coo].filter(Boolean),
      publishedAt: ago(12), publishedBy: ids.ceo, tags: ['Q2-2026'], tenantId: TENANT, createdAt: ago(12), updatedAt: ago(12),
    },
    {
      type: 'policy', title: '差旅与报销新政 (2026 版)', body: '## 要点\n- 单程 500km 内优先高铁二等座\n- 报销 7 个工作日内提交\n- 超标需主管 + 财务双签',
      summary: '差旅标准与报销时限更新, 全员需知晓。', mandatoryRead: true, readBy: [ids.finance].filter(Boolean),
      publishedAt: ago(20), publishedBy: ids.hr, tags: ['制度', '财务'], tenantId: TENANT, createdAt: ago(20), updatedAt: ago(20),
    },
    {
      type: 'event', title: '里程碑: 第 100 家经销商签约', body: '本月我们迎来第 100 家经销商加入恒热大家庭, 渠道网络再上台阶! 🎉',
      summary: '渠道破百, 历史性时刻。', mandatoryRead: false, readBy: [], publishedAt: ago(5), publishedBy: ids.salesvp,
      tags: ['里程碑', '渠道'], tenantId: TENANT, createdAt: ago(5), updatedAt: ago(5),
    },
    {
      type: 'benefit', title: '夏季福利: 全员体检 + 高温补贴', body: '7 月起安排年度体检, 一线生产岗位发放高温补贴, 详情见 HR 通知。',
      summary: '夏季员工关怀上线。', mandatoryRead: false, readBy: [], publishedAt: ago(2), publishedBy: ids.hr,
      tags: ['福利', '关怀'], tenantId: TENANT, createdAt: ago(2), updatedAt: ago(2),
    },
  ];
  let n = 0;
  for (const p of posts) {
    try { await s.intranetPosts.create(p); n++; } catch (err) { console.warn('[seed:showcase] intranet 失败:', (err as Error).message); }
  }
  void now;
  console.info(`[seed:showcase] Intranet: ${n} 帖`);
}

// ---------------------------------------------------------------------------
// Phase 8 · Knowledge 知识库 (CEO 的文件树) — /knowledge
// ---------------------------------------------------------------------------

async function seedKnowledge(ids: IdMap): Promise<void> {
  const s = getStore();
  if (!s.knowledgeNodes || !ids.ceo) return;
  const now = new Date().toISOString();
  try {
    const existing = await s.knowledgeNodes.list({ ownerId: ids.ceo } as never);
    if (existing.some((n) => n.name === '产品资料')) { console.info('[seed:showcase] Knowledge: 已存在, 跳过'); return; }
    const folder = await s.knowledgeNodes.create({
      ownerId: ids.ceo, tenantId: TENANT, name: '产品资料', type: 'folder', parentId: 'root',
      ownership: 'company', createdAt: now, updatedAt: now,
    } as Omit<KnowledgeNode, 'id'>);
    const files: Array<{ name: string; content: string }> = [
      { name: '中央热水机型规格.md', content: '# 中央热水机 EH-300\n- 容量: 300L\n- 能效: 一级\n- 噪音: < 45dB' },
      { name: '竞品对比.md', content: '# 竞品对比\n恒热 Everhot vs A 品牌 vs B 品牌: 能效/价格/质保对比表。' },
    ];
    for (const f of files) {
      await s.knowledgeNodes.create({
        ownerId: ids.ceo, tenantId: TENANT, name: f.name, type: 'file', parentId: folder.id,
        content: f.content, ownership: 'company', createdAt: now, updatedAt: now,
      } as Omit<KnowledgeNode, 'id'>);
    }
    console.info('[seed:showcase] Knowledge: 1 文件夹 + 2 文件');
  } catch (err) {
    console.warn('[seed:showcase] knowledge 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 9 · 文档 + 日历 (走 Service 分层) — /documents /drive /calendar
// ---------------------------------------------------------------------------

async function seedDocsAndCalendar(ids: IdMap): Promise<void> {
  try {
    const { createAppContext } = await import('../repositories/app-context-factory');
    const { DocumentService } = await import('../services/document-service');
    const { CalendarService } = await import('../services/calendar-service');
    const ctx = createAppContext();
    const docSvc = new DocumentService(ctx);
    const calSvc = new CalendarService(ctx);

    try {
      const docs = await getStore().documents.list();
      if (docs.some((d) => (d as { title?: string }).title === 'EH-300 产品需求文档 PRD')) { console.info('[seed:showcase] 文档/日历: 已存在, 跳过'); return; }
    } catch { /* ignore */ }

    await docSvc.create({
      title: 'EH-300 产品需求文档 PRD',
      content: JSON.stringify({ type: 'doc', nodes: [{ type: 'paragraph', content: '中央热水机 EH-300 PRD: 目标用户、规格、上市计划…' }] }),
      type: 'doc', ownerId: ids.pm, tenantId: TENANT,
      permissions: { read: [ids.pm, ids.rd, ids.ceo].filter(Boolean), write: [ids.pm].filter(Boolean) },
    });
    await docSvc.create({
      title: 'Q2 销售作战地图',
      content: JSON.stringify({ type: 'sheet', data: {} }),
      type: 'sheet', ownerId: ids.salesvp, tenantId: TENANT,
      permissions: { read: [ids.salesvp, ids.salesmgr, ids.ceo].filter(Boolean), write: [ids.salesvp].filter(Boolean) },
    });

    await calSvc.create({
      title: 'Q2 经营复盘会', description: 'OKR 进度 + KPI/BSC + 决策卡复盘',
      startAt: ahead(1), endAt: new Date(Date.now() + DAY + 90 * 60 * 1000).toISOString(),
      timezone: 'Asia/Shanghai', ownerId: ids.ceo,
      attendees: [ids.ceo, ids.coo, ids.salesvp, ids.rd, ids.hr, ids.finance].filter(Boolean),
      location: '总部大会议室', meetingUrl: 'https://meet.everhot.local/q2review', tenantId: TENANT,
    });
    console.info('[seed:showcase] 文档 2 + 日历 1');
  } catch (err) {
    console.warn('[seed:showcase] 文档/日历 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 10 · KPI/BSC 绑 roster (复用已有 cycle/subjects) — /kpi /nine-box
// ---------------------------------------------------------------------------

async function seedKpiRoster(ids: IdMap): Promise<void> {
  const s = getStore();
  try {
    const cycles = await s.kpiCycles.list();
    const cycle = cycles[0];
    const subjects = await s.kpiSubjects.list();
    if (!cycle || subjects.length === 0) {
      console.info('[seed:showcase] KPI: 无既有 cycle/subjects, 跳过 roster KPI');
      return;
    }
    const subjByCode = new Map(subjects.map((x) => [x.code, x]));
    const pick = (code: string) => subjByCode.get(code) ?? subjects[0];
    const now = new Date().toISOString();
    let haveAssignees = new Set<string>();
    try { haveAssignees = new Set((await s.kpis.list()).map((k) => (k as { assigneeId: string }).assigneeId)); } catch { /* ignore */ }

    // assignee → (科目, 完成度) 让 9 宫格分布有差异
    const specs: Array<{ handle: string; code: string; title: string; start: number; target: number; completion: number; weight: number }> = [
      { handle: 'salesmgr', code: 'FIN.REV', title: '区域新签营收', start: 0, target: 6000, completion: 0.95, weight: 60 },
      { handle: 'sales1',   code: 'FIN.REV', title: '个人新签营收', start: 0, target: 1500, completion: 0.78, weight: 70 },
      { handle: 'sales2',   code: 'CUST.NEW', title: '新客户开拓', start: 0, target: 20, completion: 0.55, weight: 50 },
      { handle: 'rd',       code: 'OPS.LEAD', title: '新机型交付周期', start: 60, target: 40, completion: 0.7, weight: 50 },
      { handle: 'ops',      code: 'OPS.QA', title: '生产质量合格率', start: 92, target: 98, completion: 1.02, weight: 60 },
      { handle: 'cs',       code: 'CUST.CSAT', title: '客户满意度', start: 80, target: 92, completion: 0.85, weight: 50 },
    ];
    let n = 0;
    for (const spec of specs) {
      const userId = ids[spec.handle];
      const subj = pick(spec.code);
      if (!userId || !subj || haveAssignees.has(userId)) continue;
      const range = spec.target - spec.start;
      const currentValue = Math.round((spec.start + range * spec.completion) * 100) / 100;
      try {
        await s.kpis.create({
          cycleId: cycle.id,
          subjectId: subj.id,
          bscPerspective: subj.bscPerspective,
          level: 'individual',
          assigneeId: userId,
          title: spec.title,
          measureType: subj.defaultMeasureType,
          startValue: spec.start,
          targetValue: spec.target,
          currentValue,
          unit: subj.defaultUnit,
          weight: spec.weight,
          dataSource: 'manual',
          scope: 'bonus',
          tenantId: TENANT,
          createdBy: ids.finance ?? ids.ceo,
          createdAt: now,
          updatedAt: now,
        } as Omit<Kpi, 'id'>);
        n++;
      } catch (err) {
        console.warn(`[seed:showcase] KPI ${spec.handle} 失败:`, (err as Error).message);
      }
    }
    console.info(`[seed:showcase] KPI roster: ${n} 条 (绑既有 FY 周期)`);
  } catch (err) {
    console.warn('[seed:showcase] KPI roster 失败:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Phase 11 · 上下游组织 (经销商/供应商 + 邀请) — /admin/organizations
// ---------------------------------------------------------------------------

async function seedDownstream(ids: IdMap): Promise<void> {
  const downstreams: Array<{ name: string; type: 'downstream' | 'individual'; category: 'dealer' | 'supplier' | 'store'; inviteEmail?: string }> = [
    { name: '华东建材连锁 (经销商)', type: 'downstream', category: 'dealer', inviteEmail: 'contact@huadong-dealer.com' },
    { name: '苏州精密压缩机厂 (供应商)', type: 'downstream', category: 'supplier', inviteEmail: 'sales@suzhou-compressor.com' },
    { name: '宁波旗舰体验店', type: 'downstream', category: 'store' },
    { name: '个体经销-王老板', type: 'individual', category: 'dealer', inviteEmail: 'wanglaoban@gmail.com' },
  ];
  let existingNames = new Set<string>();
  try { existingNames = new Set((await getStore().organizations.list()).map((o) => o.name)); } catch { /* ignore */ }
  let orgN = 0;
  let invN = 0;
  for (const d of downstreams) {
    if (existingNames.has(d.name)) continue;
    try {
      const org = await createDownstreamOrg({
        name: d.name, type: d.type, category: d.category,
        createdBy: ids.ceo ?? 'system', tenantId: TENANT,
      });
      orgN++;
      if (d.inviteEmail) {
        try {
          await inviteDownstreamMember({ orgId: org.id, email: d.inviteEmail, invitedById: ids.ceo ?? 'system' });
          invN++;
        } catch (err) {
          console.warn('[seed:showcase] 下游邀请失败:', (err as Error).message);
        }
      }
    } catch (err) {
      console.warn('[seed:showcase] 下游组织失败:', (err as Error).message);
    }
  }
  console.info(`[seed:showcase] 上下游: ${orgN} 组织 + ${invN} 邀请`);
}
