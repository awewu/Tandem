/**
 * lib/memory/capture-types.ts · 产出捕获层 (#17) 候选类型
 *
 * ─────────────────────────────────────────────────────────
 * 器官 #17 · 产出捕获 (OUTPUT CAPTURE)
 *   缺口: 员工与 AI 协作产出的可复用知识 (方案/结论/复盘/SOP) 停在对话里,
 *         只有手动点「沉淀」才进组织记忆 → 飞轮"从工作中学习"这一环靠人自觉, 大量流失。
 *
 *   本层: 对话/交付产出结束后, 后台 captureOutputPass 用 LLM 提炼 0..N 条可复用知识,
 *         去重后落成 MemoryCaptureCandidate (候选, 非直接入库)。
 *
 * 诚实边界 (不越界 · 防噪声):
 *   - 候选 ≠ 组织记忆。候选进"待沉淀队列", 由本人/Steward 一键采纳才走
 *     promoteTextToMemory → 宪章 §8.1 三级签批 → materializePromotion。
 *   - 绝不自动 proposePromotion (否则噪声灌爆签批流)。捕获只负责"发现 + 建议"。
 *   - fail-soft: 提炼失败绝不阻塞主回复。
 */

/** 候选来源通道 */
export type CaptureSource =
  | 'persona_chat' // 个人分身工作台对话
  | 'boss_ai' // 中央 AI 对话
  | 'convergence' // 作战室/会议收敛
  | 'deliverable' // 交付产出
  | 'document'; // 文档

/** 候选处置状态 */
export type CaptureCandidateStatus = 'pending' | 'accepted' | 'dismissed';

/** 建议的 Memory 类型 (与 promotion proposedType 对齐) */
export type CaptureProposedType = 'sop' | 'case' | 'redline' | 'value' | 'lesson';

/** 建议的签批级别 (与 PromotionLevel 对齐) */
export type CaptureLevel = 'team' | 'dept' | 'company';

export interface MemoryCaptureCandidate {
  id: string;
  tenantId: string;
  /** 产出者 userId (候选归属本人待沉淀队列; 采纳时作为 proposer) */
  authorUserId: string;
  /** 来源通道 */
  source: CaptureSource;
  /** 来源会话 id (persona/boss-ai sessionId 等), 用于反链 originRef */
  sessionId?: string;
  /** 反链引用 (例: `persona:${sessionId}`), 采纳时写进 Material originRefs */
  originRef?: string;

  /** 提炼出的知识标题 */
  title: string;
  /** 提炼出的知识正文 (自包含, 可直接作为 Memory body) */
  body: string;
  /** 建议 Memory 类型 */
  proposedType: CaptureProposedType;
  /** 建议签批级别 (redline/value 会在 promote 时被强制升 company) */
  suggestedLevel: CaptureLevel;
  /** 提炼置信度 0..1 (低于门槛的不落库) */
  confidence: number;
  /** 为何可复用 (给审阅者看) */
  rationale?: string;

  status: CaptureCandidateStatus;
  /** 采纳后生成的 promotionId (可追溯到签批流) */
  promotionId?: string;
  /** 命中的近似已有记忆 id (去重标记; 有值表示疑似重复, 默认仍入队但标注) */
  dedupOfMemoryId?: string;

  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}
