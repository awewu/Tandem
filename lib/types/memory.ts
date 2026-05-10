/**
 * Memory Layers · 四层知识架构
 *
 * 对应 KNOWLEDGE-ARCHITECTURE + MANIFESTO 第七/八/十四条
 */

export type KnowledgeLayer = 'origins' | 'materials' | 'memory' | 'baseline';

// ---------------------------------------------------------------------------
// Layer 1: ORIGINS (起源层) - 仅当事人可见, 加密
// ---------------------------------------------------------------------------

export type OriginType =
  | 'meeting_recording'
  | 'chat_thread'
  | 'file_upload'
  | 'email_thread'
  | 'screen_recording';

export interface Origin {
  id: string;
  type: OriginType;
  sourceUrl?: string;
  participants: string[];      // user IDs (only these can access)
  encryptedBlobRef?: string;   // S3/MinIO key
  retentionDays: number;       // 30-365
  createdAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Layer 2: MATERIALS (材料层) - 全员可见, 永久保留
// ---------------------------------------------------------------------------

export type MaterialType =
  | 'meeting_minutes'
  | 'decision_card'
  | 'checkin_report'
  | 'retrospective'
  | 'one_on_one'
  | 'training_note'
  | 'project_doc';

export interface Material {
  id: string;
  type: MaterialType;
  title: string;
  body: unknown;              // structured (Yjs doc / Decision Card)
  originRefs: string[];       // 链接到 ORIGINS
  participants: string[];
  visibility: 'public' | 'team' | 'private';
  embedding?: number[];       // pgvector
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Layer 3: MEMORY (记忆层) - 经签批后入, 全员引用
// ---------------------------------------------------------------------------

export type MemoryType = 'sop' | 'case' | 'redline' | 'value' | 'lesson';

export type MemoryStatus = 'active' | 'revising' | 'inactive' | 'deprecated';

/**
 * 签字角色 (宪章 §8.1 三级签批门).
 * - team_leader: Lv1 团队级 (与 Steward 共签 SOP)
 * - dept_leader: Lv2 部门级 (与 Steward + KR Owner 共签)
 * - kr_owner:    Lv2 部门级中 KR 关联人
 * - ceo:         Lv3 公司级 (C-level 集体之一)
 * - clevel:      Lv3 其他 C-level 委员
 * - steward:     全级别都需要 (利益冲突隔离)
 * - business_leader: 历史角色, 兼容 V1 早期数据 (= dept_leader)
 */
export type MemorySignerRole =
  | 'team_leader'
  | 'dept_leader'
  | 'kr_owner'
  | 'ceo'
  | 'clevel'
  | 'steward'
  | 'business_leader';

export interface MemorySigner {
  userId: string;
  role: MemorySignerRole;
  signedAt: string;
  comment?: string;
}

/**
 * 升级级别 (宪章 §8.1 铁律).
 * Lv1 团队级 SOP / 小型案例 → 团队 Leader + Steward, SLA 3 工作日
 * Lv2 部门级 SOP / 跨团队案例 → 部门 Leader + Steward + KR Owner, SLA 5 工作日
 * Lv3 公司级 红线 / 价值观 / 战略 → C-level 集体 + Steward, SLA 14 工作日
 *
 * 逾期机制: 自动 escalate +1 级 (Lv1 → Lv2 → Lv3 → 通知 CEO + 治理委员会).
 */
export type PromotionLevel = 'team' | 'dept' | 'company';

export const PROMOTION_SLA_DAYS: Record<PromotionLevel, number> = {
  team: 3,
  dept: 5,
  company: 14,
};

/** 各级别需要的签字角色 (steward 全级别都要) */
export const PROMOTION_REQUIRED_ROLES: Record<PromotionLevel, MemorySignerRole[]> = {
  team: ['team_leader', 'steward'],
  dept: ['dept_leader', 'steward', 'kr_owner'],
  company: ['ceo', 'clevel', 'steward'],
};

/**
 * Q1 (2026-05-10): Memory ownership 4 级.
 *   company    全员可见 + 强注入 Persona  ·  Lv3 签批 (CEO + clevel + steward, 14d)
 *   department 部门内可见 + 跨部门借鉴   ·  Lv2 签批 (dept + steward + kr_owner, 5d)
 *   team       团队内可见                ·  Lv1 签批 (team_leader + steward, 3d)
 *   personal   自己 + 主管可见 (TTI 评估) ·  无需签批 (个人笔记)
 *
 * 取代旧的 visibility 字段语义 ('public'|'team'|'private'). 旧字段已删.
 */
export type MemoryOwnershipLevel = 'company' | 'department' | 'team' | 'personal';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  body: string;
  status: MemoryStatus;
  sourceMaterialId?: string;
  signers: MemorySigner[];
  publicReviewUntil?: string;
  embedding?: number[];

  /** Q1 ownership */
  ownershipLevel: MemoryOwnershipLevel;
  ownerUserId?: string;       // personal 时
  ownerDepartmentId?: string; // department / team 时

  createdAt: string;
  updatedAt: string;
  /** 引用次数 (Steward 评估归档时参考) */
  referenceCount: number;
  /** 最近被引用时间 */
  lastReferencedAt?: string;
  /** 取代关系 (新版 Memory 替代旧版) */
  supersedes?: string;
  supersededBy?: string;
}

/**
 * 决定 Memory 对当前用户是否可见.
 * 用于 /memories 列表过滤 + Persona 调用时的注入.
 */
export function canViewMemory(
  memory: Pick<MemoryEntry, 'ownershipLevel' | 'ownerUserId' | 'ownerDepartmentId'>,
  viewer: { userId: string; departmentId?: string; isManagerOf?: string[] }
): boolean {
  switch (memory.ownershipLevel) {
    case 'company':
      return true;
    case 'department':
    case 'team':
      // 同部门可见 (team 也用 departmentId, team = parentId != null 的 Department)
      return !!memory.ownerDepartmentId && viewer.departmentId === memory.ownerDepartmentId;
    case 'personal':
      if (memory.ownerUserId === viewer.userId) return true;
      // 主管可见 (TTI 评估需要)
      return !!memory.ownerUserId && (viewer.isManagerOf ?? []).includes(memory.ownerUserId);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// 升级签批门 (Material → Memory)
// ---------------------------------------------------------------------------

export type PromotionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface MemoryPromotionRequest {
  id: string;
  materialId: string;
  proposedType: MemoryType;
  proposedTitle: string;
  proposedBody: string;
  status: PromotionStatus;
  /**
   * 升级级别 (宪章 §8.1).
   * V1 早期数据无此字段, 默认按 'company' 处理 (向后兼容).
   */
  level?: PromotionLevel;
  /**
   * 签批进度. V2 模型: 数组 (按 role 索引).
   * V1 兼容: 同时保留 businessLeader/steward/ceo 旧 key (非空表示已签).
   */
  signers: {
    /** 旧 V1 key, 等价于 dept_leader */
    businessLeader?: MemorySigner;
    steward?: MemorySigner;
    ceo?: MemorySigner;
    /** 新 V2 key */
    teamLeader?: MemorySigner;
    deptLeader?: MemorySigner;
    krOwner?: MemorySigner;
    clevel?: MemorySigner;
    /** 全部签字记录 (含历史 escalate 留痕) */
    history?: MemorySigner[];
  };
  /** SLA 截止时间 (= createdAt + slaDays * 工作日, V1 简化为自然日) */
  slaDeadline?: string;
  publicReviewUntil?: string;
  createdBy: string;
  createdAt: string;
  finalDecisionAt?: string;
  /** 紧急通道 (24h, 危机后用) */
  isEmergencyTrack: boolean;
  /** 逾期 escalate 历史 (Lv1 → Lv2 → Lv3) */
  escalationHistory?: Array<{
    fromLevel: PromotionLevel;
    toLevel: PromotionLevel;
    at: string;
    reason: string;
  }>;
}

// ---------------------------------------------------------------------------
// 降级评估 (Memory → Material/归档, 宪章 §8.2)
// ---------------------------------------------------------------------------

export type DowngradeStatus =
  | 'proposed'
  | 'under_review'
  | 'kept'
  | 'revising'
  | 'archived'
  | 'historical_only';

export interface MemoryDowngradeRequest {
  id: string;
  memoryId: string;
  /** AI 触发 / 人工触发 */
  proposedBy: 'ai' | string; // userId or 'ai'
  /** 触发理由 (引用率 / Steward 主观) */
  reason: string;
  /** 触发时的引用率统计 */
  metrics: {
    referenceCount: number;
    quartersBelowAverage?: number;
    averageReferenceCount?: number;
  };
  status: DowngradeStatus;
  /** 评估决议 (kept/revising/archived/historical_only) */
  decision?: {
    by: string;       // steward userId
    decidedAt: string;
    note?: string;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Steward (知识治理官)
// ---------------------------------------------------------------------------

export interface Steward {
  userId: string;
  appointedAt: string;
  /** 反腐败: 不能由这些角色兼任 */
  conflictWith: ('business_leader' | 'hr' | 'legal' | 'ai_engineer' | 'ceo')[];
}

// ---------------------------------------------------------------------------
// Layer 4: BASELINE (基线层) 抽象描述
// ---------------------------------------------------------------------------

export interface Baseline {
  /** 当前激活的基础模型 */
  foundationModel: string;     // e.g. 'deepseek-v3'
  /** 向量库元数据 */
  vectorStoreVersion: string;
  /** 是否启用公司专属 LoRA (V2) */
  loraActive: boolean;
  /** 最近一次基线训练时间 */
  lastTrainedAt: string;
  /** 公司基因评分 (基于 Memory 引用与决议成功率) */
  companyGenomeScore?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isMemoryActive(entry: MemoryEntry): boolean {
  return entry.status === 'active';
}

export function isPromotionApproved(req: MemoryPromotionRequest): boolean {
  return (
    req.status === 'approved' &&
    !!req.signers.businessLeader &&
    !!req.signers.steward
  );
}
