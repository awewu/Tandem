/**
 * Governance Types · 三省六部项目治理协同模型 (Phase 2 后端类型)
 *
 * 详见 docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md
 *
 * 关键概念:
 *   - GovernanceProject = 战略项目实体 (公司有多个并行项目)
 *   - GovernanceTemplate = 该项目下的三省六部协同结构 (Department[])
 *   - 默认模板 = projectId='default' 表示「公司级总治理模板」
 *
 * 数据落 KvStore:
 *   - collection 'governance_projects'
 *   - collection 'governance_templates' (id = projectId)
 *
 * 客户端 zustand (useOrgStore @ lib/store.ts) 仍可用作 Phase 1 fixture 兼容层,
 * 但新写代码请直接读 /api/governance/projects/:id/template.
 */

/** 三省 pillar: 决策 → 审议 → 执行三段式 */
export type GovernancePillar = 'decision' | 'review' | 'execution';

/** RACI 责任标签 (R=负责, A=问责, C=咨询, I=知会, O=旁观) */
export type RaciTag = 'R' | 'A' | 'C' | 'I' | 'O';

export interface Ministry {
  id: string;
  name: string;
  /** 短标签 (decision/hr/resources/...) */
  tag: string;
  description: string;
  /** 指派 Agent / User ID 列表 (混合可, 前端按 id 前缀区分) */
  agents: string[];
  /** 在本项目中的具体职责描述 (RACI 视角) */
  purpose?: string;
  /** RACI 标签 (Phase 2 新增, 默认 'R') */
  raci?: RaciTag;
}

export interface Department {
  id: string;
  name: string;
  /** 三省语义: 中书=decision / 门下=review / 尚书=execution */
  pillar?: GovernancePillar;
  ministries: Ministry[];
}

// ---------------------------------------------------------------------------
// Phase 2 · 战略项目实体
// ---------------------------------------------------------------------------

export type GovernanceProjectStatus = 'draft' | 'active' | 'archived';

export interface GovernanceProject {
  id: string;
  name: string;
  description?: string;
  status: GovernanceProjectStatus;
  /** 项目负责人 (User ID) */
  ownerId?: string;
  /** 战略目标 / 北极星指标 (一句话) */
  northStar?: string;
  /**
   * OKR Anchor 严绑定 (与 DecisionCard.primaryKrId 同款灵魂层规则):
   *   - 战略项目必须可回溯到至少 1 个 Objective, 否则需填写 noOkrReason ≥ 30 字
   *   - 不变量: primaryObjectiveId XOR noOkrReason 必须非空 (status='draft' 例外)
   *   - escape hatch 进 audit metadata, Steward 月审
   *   - default 项目豁免 (公司级总模板, 不绑定具体 OKR)
   */
  primaryObjectiveId?: string;
  noOkrReason?: string;
  /** 次要关联 OKR Objective ID 列表 (软链接, 多对多) */
  linkedObjectiveIds?: string[];
  /** 关联 DecisionCard ID 列表 (软链接, 真实存在性 UI 加载时校验) */
  linkedDecisionIds?: string[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * 一个项目对应一套三省六部协同模板.
 * id == projectId. 'default' 表示公司级总治理模板 (始终存在, 不可删).
 */
export interface GovernanceTemplate {
  id: string;
  projectId: string;
  departments: Department[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模板版本快照 (每次 saveTemplate 自动创建).
 * 支持回滚: rollbackTemplate(projectId, version) → 整体替换当前 departments.
 */
export interface GovernanceTemplateVersion {
  /** {projectId}:{version} */
  id: string;
  projectId: string;
  /** 单调递增, 1-based */
  version: number;
  departments: Department[];
  /** 操作描述 (可选, 如"加入安全合规职能司") */
  note?: string;
  /** 触发动作 'save' | 'rollback' */
  action: 'save' | 'rollback' | 'create';
  /** 回滚时记录回滚到的源版本号 */
  rolledBackFrom?: number;
  createdBy?: string;
  tenantId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants / Defaults
// ---------------------------------------------------------------------------

/** 公司级总治理模板的固定 ID */
export const DEFAULT_PROJECT_ID = 'default';

/** OKR Anchor 严绑定守门 (与 DecisionCard.validateOkrAnchor 同款规则) */
export const PROJECT_OKR_REASON_MIN_LENGTH = 30;

export type ProjectAnchorState = 'anchored' | 'unanchored_with_reason' | 'exempt';

export type ProjectAnchorValidation =
  | { ok: true; anchorState: ProjectAnchorState }
  | { ok: false; code: 'missing_both' | 'both_present' | 'reason_too_short'; message: string };

export function validateProjectOkrAnchor(input: {
  projectId?: string;
  status?: GovernanceProjectStatus;
  primaryObjectiveId?: string | null;
  noOkrReason?: string | null;
}): ProjectAnchorValidation {
  // default 公司级总模板豁免 (不绑定具体 OKR)
  if (input.projectId === DEFAULT_PROJECT_ID) {
    return { ok: true, anchorState: 'exempt' };
  }
  // draft 阶段允许暂未绑定 (鼓励先创建再补 OKR)
  if (input.status === 'draft') {
    return { ok: true, anchorState: 'exempt' };
  }
  const hasObj = !!input.primaryObjectiveId && input.primaryObjectiveId.trim().length > 0;
  const hasReason = !!input.noOkrReason && input.noOkrReason.trim().length > 0;
  if (!hasObj && !hasReason) {
    return {
      ok: false,
      code: 'missing_both',
      message: '战略项目激活前必须关联 OKR Objective, 或填写"无关 OKR"的充分理由 (≥30 字)',
    };
  }
  if (hasObj && hasReason) {
    return {
      ok: false,
      code: 'both_present',
      message: '请只选其一: 关联 Objective 或 填写理由 (不能同时)',
    };
  }
  if (hasReason && (input.noOkrReason ?? '').trim().length < PROJECT_OKR_REASON_MIN_LENGTH) {
    return {
      ok: false,
      code: 'reason_too_short',
      message: `无 OKR 理由至少 ${PROJECT_OKR_REASON_MIN_LENGTH} 字符. 当前 ${(input.noOkrReason ?? '').trim().length} 字符.`,
    };
  }
  return { ok: true, anchorState: hasObj ? 'anchored' : 'unanchored_with_reason' };
}

/** Pillar UI 元数据 (label / 单字 / Tailwind color) */
export const PILLAR_META: Record<GovernancePillar, { label: string; short: string; color: string }> = {
  decision: { label: '中书 · 提案', short: '提', color: 'violet' },
  review: { label: '门下 · 审议', short: '审', color: 'amber' },
  execution: { label: '尚书 · 执行', short: '执', color: 'emerald' },
};

/** RACI 中文 + 颜色 */
export const RACI_META: Record<RaciTag, { label: string; full: string; color: string }> = {
  R: { label: 'R', full: 'Responsible · 执行', color: 'emerald' },
  A: { label: 'A', full: 'Accountable · 问责', color: 'rose' },
  C: { label: 'C', full: 'Consulted · 咨询', color: 'sky' },
  I: { label: 'I', full: 'Informed · 知会', color: 'amber' },
  O: { label: 'O', full: 'Observer · 旁观', color: 'zinc' },
};

/**
 * 公司级总治理模板的默认结构 (新 project 创建时也以此为种子复制).
 */
export function defaultDepartments(): Department[] {
  return [
    {
      id: 'dept-decision',
      name: '中书省',
      pillar: 'decision',
      ministries: [
        {
          id: 'min-decision',
          name: '决策司',
          tag: 'decision',
          description: '战略决策与目标制定 (提案起草)',
          agents: [],
          raci: 'A',
        },
      ],
    },
    {
      id: 'dept-review',
      name: '门下省',
      pillar: 'review',
      ministries: [
        {
          id: 'min-review',
          name: '审核司',
          tag: 'review',
          description: '审议 / 封驳 / 风险把控',
          agents: [],
          raci: 'A',
        },
      ],
    },
    {
      id: 'dept-execution',
      name: '尚书省',
      pillar: 'execution',
      ministries: [
        { id: 'min-hr',        name: '吏部', tag: 'hr',        description: '项目班子搭建与角色任免',     agents: [], raci: 'R' },
        { id: 'min-resources', name: '户部', tag: 'resources', description: '预算 / 资源 / 知识资产',      agents: [], raci: 'R' },
        { id: 'min-protocol',  name: '礼部', tag: 'protocol',  description: '对外接口 / 协议 / 标准规范',  agents: [], raci: 'C' },
        { id: 'min-ops',       name: '兵部', tag: 'ops',       description: '任务派发 / 调度 / 运维',      agents: [], raci: 'R' },
        { id: 'min-security',  name: '刑部', tag: 'security',  description: '安全 / 合规 / 审计',          agents: [], raci: 'C' },
        { id: 'min-dev',       name: '工部', tag: 'dev',       description: '开发 / 工程实施 / 技术落地', agents: [], raci: 'R' },
      ],
    },
  ];
}
