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
   * KR 软绑定 (Q2): 默认必选, 可选 escape hatch.
   * 不变量: primaryKrId XOR noKrReason 必须非空 (validateKrBinding 守门).
   */
  primaryKrId?: string;      // 主关联 KR (默认路径)
  noKrReason?: string;       // 不挂任何 KR 时强制填的理由 (≥ 10 字符)

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
 * KR 软绑定守门 (Q2 决策):
 *   - 优先路径: primaryKrId 非空 (默认期望)
 *   - escape hatch: noKrReason 非空 + 长度 ≥ 10 字符 (反"占位理由")
 *   - 二者必须 XOR (恰一个非空)
 */
export const KR_BINDING_REASON_MIN_LENGTH = 10;

export type KrBindingValidation =
  | { ok: true }
  | { ok: false; code: 'missing_both' | 'both_present' | 'reason_too_short'; message: string };

export function validateKrBinding(
  input: { primaryKrId?: string | null; noKrReason?: string | null }
): KrBindingValidation {
  const hasKr = !!input.primaryKrId && input.primaryKrId.trim().length > 0;
  const hasReason = !!input.noKrReason && input.noKrReason.trim().length > 0;

  if (!hasKr && !hasReason) {
    return {
      ok: false,
      code: 'missing_both',
      message: '必须选择关联 KR, 或填写"无关 KR"的理由',
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
      message: `理由至少 ${KR_BINDING_REASON_MIN_LENGTH} 字符 (反"占位理由")`,
    };
  }
  return { ok: true };
}
