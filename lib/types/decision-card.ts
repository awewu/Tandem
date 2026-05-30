/**
 * Decision Card · 决议卡 (牛马搭子的工作原子单元)
 *
 * 对应 MANIFESTO 第一条 + AGENT-FRAMEWORK Layer 3
 */

export type DecisionClass = 'simple' | 'complex' | 'strategic';

export type ConvergenceState =
  | 'DIVERGE'    // 发散中 (员工在思考)
  | 'CONVERGE'   // 收敛中 (议事室进行中)
  | 'COMMIT'     // 已承诺 (决议生效)
  | 'ESCALATED'  // 已升级 (超时或卡顿)
  | 'VETOED';    // 已否决 (24h 窗口内员工撤回)

export type OptionType =
  | 'SOP'                // A: 标准操作流程
  | 'AGENT_REASONING'    // B: AI 推演
  | 'HISTORICAL'         // C: 历史案例
  | 'ORIGINAL';          // D: 员工原创 (强制 human only)

export interface DecisionOption {
  id: 'A' | 'B' | 'C' | 'D';
  type: OptionType;
  description: string;
  reasoning?: string;
  confidence: number;        // 0-1
  risk: 'low' | 'medium' | 'high';
  timelineDays?: number;
  citedMaterials?: string[]; // Material IDs
  citedMemory?: string[];    // Memory IDs (SOP / case)
  novelInsight?: string;     // 仅 D 选项必填
  humanOnly?: boolean;       // D 选项强制 true
}

export interface ActionItem {
  id: string;
  owner: string;             // user_id
  task: string;
  due: string;               // ISO date
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  decisionCardId: string;    // 反向引用
}

export interface DecisionCardWatermark {
  /** 是否由 AI 分身代为提交 (反 AI 欺诈, 第九条) */
  isProxy: boolean;
  proxyType?: 'persona' | 'meeting_proxy';
  proxyForUserId?: string;
  proxySignedAt?: string;
}

export interface DecisionCard {
  id: string;
  schemaVersion: 'tandem.v1';
  title: string;
  decisionClass: DecisionClass;

  /** 状态机 */
  convergenceState: ConvergenceState;
  elapsedSeconds: number;
  hardDeadlineAt?: string;   // 17min hard limit (议事室)

  /**
   * OKR Anchor (V1.5 灵魂层升级 · 2026-05-28):
   *   - 现有字段 primaryKrId 即 OKR Anchor (KR-level), 通过 KR.objectiveId 可反查到 Objective.
   *   - OKR-DRIVEN-ARCHITECTURE.md § 三 第 4 条 严绑定: 任何 DecisionCard 必须可回溯到当前 OKR.
   *   - 不变量: primaryKrId XOR noKrReason 必须非空 (validateOkrAnchor 守门).
   *   - escape hatch 门槛升级: noKrReason ≥ 30 字符 (从 V1 的 ≥10 提高), 防"占位理由"; 进 audit decision_card.unanchored_created 度量月审.
   */
  primaryKrId?: string;      // OKR Anchor (KR-level) — 通过 KR.objectiveId 解析 cascade 路径
  noKrReason?: string;       // 无锚理由 (≥ 30 字, Steward 月审)

  /** 次要关联 OKR/TTI (多对多) */
  relatedKr?: string[];      // KR IDs
  relatedTti?: string[];     // TTI IDs

  /** 上下文链路 */
  origins?: {
    meetingRecording?: string;
    chatThread?: string;
    fileRefs?: string[];
  };
  materialRefs?: string[];

  /** 选项 */
  options: DecisionOption[];
  selected?: 'A' | 'B' | 'C' | 'D';
  selectedBy?: string;       // user_id
  selectedAt?: string;

  /** Action Items */
  actionItems: ActionItem[];

  /** 影响 KR 预期 */
  expectedKrImpact?: { kr: string; deltaPp: number }[];

  /** 复盘指针 (回填) */
  retrospective?: {
    reviewAt: string;
    actualOutcome?: string;
    learning?: string;
  };

  /** 元数据 */
  createdBy: string;
  createdAt: string;
  /** 多租户隔离: 议事室所属租户 (默认 'default') */
  tenantId?: string;
  watermark: DecisionCardWatermark;

  /** 24h 否决窗口 (员工对 AI 提交决议的撤回权) */
  vetoWindowEnds?: string;
}

/** 决议卡快速分类 */
export function classifyDecision(card: Partial<DecisionCard>): DecisionClass {
  if (card.relatedKr && card.relatedKr.length > 1) return 'strategic';
  if (card.elapsedSeconds && card.elapsedSeconds > 600) return 'complex';
  return 'simple';
}

/** 议事室硬上限校验 */
export const HARD_TIME_LIMIT_SECONDS = 17 * 60;

export function isOverHardLimit(card: DecisionCard): boolean {
  return card.elapsedSeconds >= HARD_TIME_LIMIT_SECONDS;
}

/**
 * OKR Anchor 严绑定守门 (V1.5 升级 · 2026-05-28 · OKR-DRIVEN-ARCHITECTURE §三第4条):
 *   - 优先路径: primaryKrId 非空 (anchored — 决议直接锚到 KR/Objective)
 *   - escape hatch: noKrReason 非空 + 长度 ≥ 30 字符 (unanchored_with_reason — 进月审看板)
 *   - 二者必须 XOR (恰一个非空)
 *
 * 历史: V1 KR_BINDING_REASON_MIN_LENGTH = 10 (软绑定)
 *      V1.5 升级到 30 (严绑定, 防"占位理由"; Owner 拍板 2026-05-27 PT 22:55).
 */
export const KR_BINDING_REASON_MIN_LENGTH = 30;

/** Anchor 状态: 决议是直接锚 KR, 还是带理由无锚 */
export type DecisionAnchorState = 'anchored' | 'unanchored_with_reason';

export type KrBindingValidation =
  | { ok: true; anchorState: DecisionAnchorState }
  | { ok: false; code: 'missing_both' | 'both_present' | 'reason_too_short'; message: string };

export function validateOkrAnchor(
  input: { primaryKrId?: string | null; noKrReason?: string | null }
): KrBindingValidation {
  const hasKr = !!input.primaryKrId && input.primaryKrId.trim().length > 0;
  const hasReason = !!input.noKrReason && input.noKrReason.trim().length > 0;

  if (!hasKr && !hasReason) {
    return {
      ok: false,
      code: 'missing_both',
      message: '必须选择关联 KR (OKR Anchor), 或填写"无关 KR"的充分理由 (≥30 字)',
    };
  }
  if (hasKr && hasReason) {
    return {
      ok: false,
      code: 'both_present',
      message: '请只选其一: 关联 KR 或 填写理由 (不能同时)',
    };
  }
  if (hasReason && (input.noKrReason ?? '').trim().length < KR_BINDING_REASON_MIN_LENGTH) {
    return {
      ok: false,
      code: 'reason_too_short',
      message: `无锚理由至少 ${KR_BINDING_REASON_MIN_LENGTH} 字符 (V1.5 严绑定, 反"占位理由"). 当前 ${(input.noKrReason ?? '').trim().length} 字符.`,
    };
  }
  return { ok: true, anchorState: hasKr ? 'anchored' : 'unanchored_with_reason' };
}
