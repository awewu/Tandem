/**
 * lib/product/manifesto.ts · 产品定位 / 灵魂 / 不变量 的代码级 SSOT
 *
 * 这是 Owner 2026-05-30 立宪后从 docs 提升到代码的第一刀:
 *   docs/MANIFESTO.md / docs/OKR-DRIVEN-ARCHITECTURE.md / docs/SELF-USE-FIRST.md
 *   只能被人读, 代码不引用 → 跑偏成本低, 一脱就漂.
 *
 * 本文件让灵魂层成为代码可引用的 const + type:
 *   - import { TANDEM_SOULS, TANDEM_INVARIANTS, IS_SELF_USE_PHASE } from '@/lib/product/manifesto';
 *   - 任何业务校验/守卫/系统提示构造都应引用本文件而非朗读 docs.
 *
 * 修改规则: 仅 Owner 立宪可改本文件. 改本文件 = 改产品灵魂, 不是普通重构.
 */

// ============================================================================
// §A · 产品阶段 (Self-Use First · 2026-05-27 立宪)
// ============================================================================

/**
 * 产品当前阶段.
 *
 * `self-use` = Tandem 是 Owner 自家"完整产研销企业"内部协作 AI 平台, 不是 SaaS.
 *              路径类比: 字节内部飞书 2016-2020 自用 4 年再对外.
 *              "你先不要管商务的问题" (Owner 2026-05-27).
 *
 * `pilot` = 自用 70%+ 周活持续 3 月达标后, 才进入 pilot 客户阶段.
 * `commercial` = pilot 验证后才进入商业化, 远期可选项.
 */
export type ProductPhase = 'self-use' | 'pilot' | 'commercial';

export const TANDEM_PHASE: ProductPhase = 'self-use';

export const IS_SELF_USE_PHASE = TANDEM_PHASE === 'self-use';

/**
 * 自用阶段成功标准 (达到 4 条全部 = 可考虑进入 pilot 阶段).
 * 引用源: docs/SELF-USE-FIRST.md
 */
export const SELF_USE_SUCCESS_CRITERIA = {
  weeklyActiveRate: 0.7,
  weeklyActiveMonths: 3,
  okrConvergence1on1InTandemRate: 0.8,
  personaTrainingRate: 0.5,
  minTimeSavingStories: 3,
} as const;

/**
 * 自用阶段红线 (不该被推荐 / 不该投入工程量的话题).
 * Cascade 在自用阶段被禁止主动提及以下方向, 除非 Owner 显式问起.
 */
export const SELF_USE_FORBIDDEN_TOPICS = [
  'pricing',
  'arpu',
  'customer-acquisition',
  'gtm',
  'seo',
  'sales-funnel',
  'multi-tenant',
  'stripe',
  'sso-enterprise',
  'iso-27001',
  'soc-2',
  'i18n',
  'app-store',
  'product-hunt',
  'seed-customer',
  'pilot-customer-roll-out',
] as const;

// ============================================================================
// §B · 灵魂层 6 条 (OKR-DRIVEN-ARCHITECTURE.md · 2026-05-27 立宪)
// ============================================================================

/**
 * 产品灵魂 — 6 条不可改写的初心.
 * Owner 钦定, 跟 MANIFESTO 同等地位, 不可频繁修改.
 */
export const TANDEM_SOULS = [
  {
    id: 'soul-1',
    title: '企业 AI vs 个人 AI = 组织目标聚焦达成',
    summary: '差异是目的, 不是程度. 个人 AI 服务个人智能, 企业 AI 必须服务组织 OKR.',
  },
  {
    id: 'soul-2',
    title: '进化方向 = 整体组织能力提升 + 约束工作聚焦',
    summary: '双向: 能力扩张 + 偏离收敛. OKR Drift 检测 (B-015) 是本条度量入口.',
  },
  {
    id: 'soul-3',
    title: '兼容开放个人 AI + 反哺企业级 AI',
    summary: '员工自由用 Claude Code/Cursor/OpenClaw/Hermes, Tandem 不重发明轮子.\n外部 skill 经 Skill Gateway 4 道闸反哺企业.',
  },
  {
    id: 'soul-4',
    title: '牛马 (事半) = OKR 驱动器, 严格版',
    summary: '任何任务必须可回溯到当前 OKR. validateOkrAnchor XOR 是本条代码实现.',
  },
  {
    id: 'soul-5',
    title: '拿捏 + 搭子 = 个人工作平台和成长机制, 跟 OKR 解耦',
    summary: '拿捏 = 自我成长. 搭子 = 主分身, 开放接入市面智能体.',
  },
  {
    id: 'soul-6',
    title: '闭环互动相互赋能',
    summary: 'CompanyBrain 看板 (CA-13) 度量决议采纳率/推翻率/版本对比, 持续迭代.',
  },
] as const;

export type SoulId = (typeof TANDEM_SOULS)[number]['id'];

// ============================================================================
// §C · 4 件不变量 (代码不变量 · 永不可妥协)
// ============================================================================

/**
 * 4 件不变量是 6 条灵魂的代码化承诺.
 * 不是营销话术, 而是写进 TypeScript/SQL 的强制约束.
 */
export const TANDEM_INVARIANTS = [
  {
    id: 'inv-1',
    title: '决议必锚 OKR',
    enforceAt: 'lib/types/decision-card.ts:validateOkrAnchor',
    rule: 'DecisionCard 必须 XOR 满足: 锚定 KR | 锚定 Objective | 显式 noKrReason',
    serves: 'soul-4',
  },
  {
    id: 'inv-2',
    title: '议事 17 分钟硬上限 + 自动 ESCALATE',
    enforceAt: 'lib/convergence/orchestrator.ts:HARD_TIME_LIMIT_SECONDS',
    rule: '议事室 17 * 60 秒后由 scanner 自动 ESCALATE, 反"聊到天荒地老"',
    serves: 'soul-4',
  },
  {
    id: 'inv-3',
    title: '3+1 决策 D 选项 humanOnly',
    enforceAt: 'lib/decision-layer/three-plus-one-engine.ts',
    rule: 'D=ORIGINAL+humanOnly 选项不可由 AI 自动选择, 反 AI 替员工劳动',
    serves: 'soul-1',
  },
  {
    id: 'inv-4',
    title: 'Memory 4 层 + 三级签批 SLA',
    enforceAt: 'lib/memory/promotion-flow.ts',
    rule: 'Material → Memory 升级必须经 Lv1/Lv2/Lv3 签批, SLA 逾期自动 escalate',
    serves: 'soul-6',
  },
] as const;

export type InvariantId = (typeof TANDEM_INVARIANTS)[number]['id'];

// ============================================================================
// §D · 三元结构 (产品心智模型 · 不是功能分类)
// ============================================================================

/**
 * 事半 / 拿捏 / 搭子 是 Tandem 的三元心智模型, 不是 nav 模块分类.
 * Cascade 描述产品时应使用此三元, 不应压缩为 "OKR 决议链 OS" 这种单维口径.
 */
export const TANDEM_TRINITY = {
  shiban: {
    nameZh: '事半',
    role: 'OKR 驱动器 · 严格版',
    coupling: 'OKR-coupled',
    summary: '一切任务可回溯到当前 OKR. 不到 OKR 不算事.',
    primaryRoutes: ['/okr', '/tti', '/convergence', '/kpi', '/report'],
    soulRefs: ['soul-2', 'soul-4'] as SoulId[],
  },
  naina: {
    nameZh: '拿捏',
    role: '个人工作平台 · 自我成长',
    coupling: 'OKR-decoupled',
    summary: '认识自己 / 积累技能 / Persona 进化. 不强制锚 OKR.',
    primaryRoutes: ['/persona', '/skills', '/learning', '/portfolio', '/retros', '/360', '/nine-box'],
    soulRefs: ['soul-5'] as SoulId[],
  },
  dazi: {
    nameZh: '搭子',
    role: '主分身 · 开放接入个人 AI',
    coupling: 'gateway',
    summary: '拥抱 Claude Code/Cursor/Hermes 等市面智能体, 经 Skill Gateway 4 道闸反哺企业.',
    primaryRoutes: ['/tandem', '/agents', '/chat', '/summon', '/summon/external'],
    soulRefs: ['soul-3', 'soul-5'] as SoulId[],
  },
} as const;

export type TrinityNode = keyof typeof TANDEM_TRINITY;

// ============================================================================
// §E · Skill Gateway 4 道闸 (§19 · 拥抱市面智能体的边界)
//
// 2026-05-31 立宪追加: 4 道闸为**双向**:
//   - 入站 (外部 AI → Tandem 数据/动作): 现有 academy-server.ts 等已落
//   - 出站 (Tandem 分身 → 外部 AIGC): 待落 B-021/B-022/B-023
// 任一方向调用前必须先经 runSkillGateway(). 不调 = 违反 §19.
// ============================================================================

export const SKILL_GATEWAY_GATES = [
  { id: 'baseline-guard',  title: 'Baseline-Guard',        enforceAt: 'lib/memory/baseline-guard.ts' },
  { id: 'okr-drift',       title: 'OKR Drift Detection',   enforceAt: 'lib/governance/okr-drift.ts' },
  { id: 'data-scope',      title: 'Data Scope',            enforceAt: 'lib/skill-gateway (V1 stub)' },
  { id: 'action-scope',    title: 'Action Scope',          enforceAt: 'lib/skill-gateway (V1 stub)' },
] as const;

// ============================================================================
// §F · 战略红线 (永不做的事 · MANIFESTO §17/§18)
// ============================================================================

/**
 * 战略红线 — 任何 PR / 提议 / 路线图都不应包含以下方向.
 * 若代码中出现, 视为越权, 应被 PR review 直接打回.
 */
export const STRATEGIC_RED_LINES = [
  '集成飞书/钉钉/企微 (战略红线, 中性 IM Gateway 允许 Slack/Teams/Email/RocketChat)',
  'OA/审批/考勤/印章/招聘/CRM (MANIFESTO §18)',
  '服务政企/国企 (MANIFESTO §17)',
  'AI 替员工劳动 (违反 inv-3 D 选项 humanOnly)',
  'KPI = DAU/MAU (反 DAU 是序言)',
  '"业内首个企业级智能体" 营销话术 (改用 "首个 OKR 决议链 OS")',
] as const;

// ============================================================================
// §G · 帮助函数
// ============================================================================

/**
 * 自用阶段守卫. 在涉及 SaaS/商业化语境的代码路径中, 调用此函数让代码"问一下".
 *
 * @example
 *   if (assertSelfUsePhase('skip-pricing-calc')) {
 *     return { skipped: true, reason: 'self-use phase, no pricing' };
 *   }
 */
export function assertSelfUsePhase(reason: string): boolean {
  return IS_SELF_USE_PHASE
    ? true
    : false;
}

/**
 * 拼接产品定位的一句话 (供 system prompt / 文档头部 / Boss-AI greeting 使用).
 */
export function tandemPositioningOneLiner(): string {
  return [
    'Tandem 是 OKR 驱动的企业级 AI 协作平台 (自用阶段).',
    '三元结构: 事半(OKR 驱动器) + 拿捏(个人成长) + 搭子(主分身, 接入市面智能体).',
    '6 灵魂 + 4 不变量约束所有功能.',
  ].join(' ');
}

/**
 * 获取灵魂层全文 (供 CompanyBrain system prompt 注入).
 */
export function buildSoulContext(): string {
  const lines = TANDEM_SOULS.map(
    (s, i) => `  ${i + 1}. ${s.title}\n     ${s.summary.replace(/\n/g, '\n     ')}`,
  );
  return `Tandem 产品灵魂 6 条:\n${lines.join('\n')}`;
}
