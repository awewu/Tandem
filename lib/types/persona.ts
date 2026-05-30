/**
 * Persona · 拿捏老板 (个体 AI 分身)
 *
 * 对应 PERSONA-EVOLUTION + MANIFESTO 第十三条 (数据归公司, 尊严归员工)
 */

/**
 * v2 命名 (2026-05-29): 新手 → 上手 → 熟手 → 老手 → 拿手
 * SSOT: lib/persona/stage-meta.ts (含 emoji / 称谓 / blurb / Lv / 实习权限)
 */
export type PersonaStage =
  | 'newborn'   // 🥚 Lv.1 新手 (0-2w): 仅旁听
  | 'apprentice' // 🐣 Lv.2 上手 (2w-2m): 简单 standup
  | 'assistant' // 🐤 Lv.3 熟手 (2m-6m): 绿区会议 + 表态
  | 'deputy'    // 🦅 Lv.4 老手 (6m-1y): 黄区会议 + 短承诺
  | 'partner';  // 🐉 Lv.5 拿手 (>1y): 跨企业 (除红区)

export type DelegationLevel =
  | 'observe_only'      // 仅旁听
  | 'report_only'       // 可汇报数据
  | 'soft_opinion'      // 可表态 (不承诺)
  | 'commit_short'      // 可承诺 ≤ 1 工作日动作
  | 'commit_long'       // 可承诺 ≤ 1 周动作
  | 'cross_company';    // 可参与跨企业 (红区除外)

export interface DecisionHistoryStats {
  totalDecisions: number;
  selfMade: number;
  aiAssisted: number;
  vetoedByUser: number;
  /** 员工对 AI 决议否决率 (健康区间 5-15%) */
  vetoRate: number;
}

export interface StyleProfile {
  decisionSpeed: 'fast' | 'medium' | 'slow';
  riskAppetite: number;          // 0-1
  communicationStyle: 'direct' | 'diplomatic' | 'analytical';
  preferredOptions: ('SOP' | 'reasoning' | 'historical' | 'original')[];
  /** 历史发言样本 (用于 LLM few-shot) */
  communicationExamples: string[];
}

export interface GrowthArea {
  id: string;
  category: string;
  description: string;
  identifiedAt: string;
  /**
   * identified: 初识别 (cron 或 AI 标注)
   * in_progress: 员工正在改进
   * mastered: 已达成
   * addressed: 针对 upgrade_proposal 场景 — 员工已确认升级, 本条处理完毕
   * dismissed: 针对 upgrade_proposal 场景 — 员工拒绝/推迟升级, 本条已撤销 (不再弹)
   */
  status: 'identified' | 'in_progress' | 'mastered' | 'addressed' | 'dismissed';
  /** addressed/dismissed 的时间 (仅在 status 进入 terminal 状态时写入) */
  addressedAt?: string;
}

export interface Persona {
  id: string;
  userId: string;
  schemaVersion: 'tandem.v1';

  /** 当前阶段 */
  stage: PersonaStage;
  stageEnteredAt: string;

  /** 委托级别 (员工授权 AI 能做什么) */
  delegationLevel: DelegationLevel;

  /** 历史统计 */
  decisionHistory: DecisionHistoryStats;

  /** 风格画像 */
  styleProfile: StyleProfile;

  /** 成长区域 */
  growthAreas: GrowthArea[];

  /** "拿捏老板"度 (0-100, 衡量员工与老板沟通的得心应手程度) */
  bossCaptureScore: number;

  /** 数据所有权 (MANIFESTO 第十三条) */
  dataOwnership: {
    /** 数据归公司 */
    companyOwnsData: true;
    /** 员工尊严保障: 离职后画像匿名化 (true=未处理, false=已完成或无需) */
    anonymizationPending: boolean;
    /** 已完成匿名化的时戳 (只有 admin anonymize 端点会写入) */
    anonymizedAt?: string;
    /** 员工本人对个人原始 ORIGINS 的导出权 */
    employeeCanExportOrigins: true;
  };

  /** 元数据 */
  createdAt: string;
  updatedAt: string;

  /** 是否在线学习中 */
  learningActive: boolean;

  /**
   * 5 主修 GPA · Mode Proficiency map (0-100)
   * 来源: 学习闭环 closure.ts onLessonCompleted 累加 lesson.rewardScore.
   * 缺省/未学过的主修不出现, 由 UI fallback.
   * 这是学院架构 (ACADEMY-METAPHOR §1.2) 的核心数据通道.
   */
  modeProficiency?: Partial<Record<'design' | 'pm' | 'tech' | 'marketing' | 'strategy', number>>;

  /**
   * 该 Persona 已解锁的 Agent Skill ID 列表 (S1, CHARTER §16).
   * Skill 解锁随 stage 渐进, 见 STAGE_TO_DEFAULT_SKILLS.
   * 红区 (奖金正式下发 / 离职辅导) 永远不解锁, 必须 human-only.
   */
  enabledSkills?: string[];
}

/** 阶段 → 委托级别默认映射 */
export const STAGE_TO_DEFAULT_DELEGATION: Record<PersonaStage, DelegationLevel> = {
  newborn: 'observe_only',
  apprentice: 'report_only',
  assistant: 'soft_opinion',
  deputy: 'commit_short',
  partner: 'cross_company',
};

/** 阶段升级条件 */
export interface StageUpgradeCriteria {
  minDays: number;
  minDecisions: number;
  maxVetoRate: number;
}

export const STAGE_UPGRADE_CRITERIA: Record<
  PersonaStage,
  StageUpgradeCriteria | null
> = {
  newborn: { minDays: 14, minDecisions: 10, maxVetoRate: 0.5 },
  apprentice: { minDays: 60, minDecisions: 50, maxVetoRate: 0.3 },
  assistant: { minDays: 180, minDecisions: 200, maxVetoRate: 0.2 },
  deputy: { minDays: 365, minDecisions: 800, maxVetoRate: 0.1 },
  partner: null,
};

/**
 * 阶段 → 默认解锁的 Agent Skill IDs (S1)
 *
 * 设计原则:
 *   - newborn: 啥都不能做 (仅观察)
 *   - apprentice: 只读 / coaching
 *   - assistant: + 建议性能力 (建决策卡 / 试算)
 *   - deputy: + 真正能开议事室 + 调岗讨论
 *   - partner: 几乎全部 (除红区)
 *
 * 红区永远不解锁的 skill (human-only):
 *   - 奖金正式下发 (kpi-bonus 的 commit:true 路径) — 即使 skill 解锁, audit 端的 commit 仍由人触发
 *   - 离职辅导 (must-intervene 模板的 D 选项)
 */
export const STAGE_TO_DEFAULT_SKILLS: Record<PersonaStage, string[]> = {
  newborn: [],
  apprentice: ['tti-coaching'],
  assistant: ['tti-coaching', 'nine-box-action'],
  deputy: ['tti-coaching', 'nine-box-action', 'decision-card-template', 'kpi-bonus'],
  partner: [
    'tti-coaching',
    'nine-box-action',
    'decision-card-template',
    'kpi-bonus',
    'audit-verify',
  ],
};

/** 是否允许对该 persona 调用某 skill */
export function canPersonaUseSkill(persona: Pick<Persona, 'stage' | 'enabledSkills'>, skillId: string): boolean {
  const enabled = persona.enabledSkills ?? STAGE_TO_DEFAULT_SKILLS[persona.stage] ?? [];
  return enabled.includes(skillId);
}

export function canUpgradeStage(persona: Persona): boolean {
  const criteria = STAGE_UPGRADE_CRITERIA[persona.stage];
  if (!criteria) return false;

  const ageDays =
    (Date.now() - new Date(persona.stageEnteredAt).getTime()) / 86400000;

  return (
    ageDays >= criteria.minDays &&
    persona.decisionHistory.totalDecisions >= criteria.minDecisions &&
    persona.decisionHistory.vetoRate <= criteria.maxVetoRate
  );
}
