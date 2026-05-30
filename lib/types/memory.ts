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

/**
 * §2026 Mem0 State of AI Agent Memory · 三类认知记忆 (与 type 正交)
 *
 *   episodic   "发生了什么"   — 会话/事件流水 (议事 transcript, IM 记录, BossAI 问答历史)
 *   semantic   "已知事实"     — SOP / 价值观 / 红线 / 案例知识点 (现有 type 多数属此)
 *   procedural "怎么做"       — 团队工作流 / 评审套路 / 决策习惯 (学院课程通过后落地的过程性知识)
 *
 * 默认 semantic (向后兼容): 旧数据无此字段时按 semantic 处理.
 * 检索分桶时建议: brief 用 semantic+procedural, 复盘用 episodic, 教学用 procedural.
 */
export type MemoryKind = 'episodic' | 'semantic' | 'procedural';

/**
 * §2026 Mem0 4-Scope Memory Identifier (与 ownershipLevel 正交)
 *
 * ownershipLevel 解决"谁可见", scope 解决"哪个 agent / 哪次会话产出的".
 * 多分身/子分身/外部 AI 反哺时, 同一条 Memory 可能挂在不同 scope 上.
 *
 *   orgId      公司 (CompanyBrain 训练数据多挂这)
 *   agentId    分身 ID (CompanyBrain / 个人主分身 / 子分身)
 *   userId     用户 (员工自己的 personal memory)
 *   sessionId  会话 (议事/1on1/BossAI 单次会话, 短期)
 */
export interface MemoryScope {
  orgId?: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
}

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

  // ── 个人记事本 UI 元数据 (P1-1, 仅 ownershipLevel='personal' 时使用) ──
  /** UI 分类: requirement/consensus/standard/context (与 type 正交, 仅 UI 展示) */
  uiCategory?: 'requirement' | 'consensus' | 'standard' | 'context';
  /** 优先级 (UI 排序 + getBaselineSystemPrompt 注入门槛) */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** 标签 */
  tags?: string[];
  /** 客户端文件夹归属 (UI 树状导航) */
  parentId?: string | null;
  /** 是否激活 (个人 memory 默认 true, 停用后不参与 baseline 注入) */
  isActive?: boolean;
  /** 版本号 (每次 update +1) */
  version?: number;

  // ── §2026 4-Scope + 三类认知记忆 (P0 #3) ────────────────────────
  /** 认知类型. 默认 semantic (向后兼容). */
  kind?: MemoryKind;
  /** 哪个 agent 产出/拥有 (CompanyBrain / 主分身 / 子分身 / 外部 AI) */
  agentId?: string;
  /** 哪次会话产出 (议事/1on1/BossAI session) */
  sessionId?: string;
  /** 组织 id (多租户时 = tenantId, 单租户时可省) */
  orgId?: string;
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

/**
 * §P0 #3 · Memory kind 推断 (向后兼容旧数据)
 *
 * 优先用显式 entry.kind. 没有时按 type 推断:
 *   sop / value / redline → procedural (做事方法/原则)
 *   case / lesson         → episodic (具体事件)
 *   其他                  → semantic (默认事实)
 */
export function getMemoryKind(entry: Pick<MemoryEntry, 'kind' | 'type'>): MemoryKind {
  if (entry.kind) return entry.kind;
  switch (entry.type) {
    case 'sop':
    case 'value':
    case 'redline':
      return 'procedural';
    case 'case':
    case 'lesson':
      return 'episodic';
    default:
      return 'semantic';
  }
}

/**
 * §P0 #3 · 按 scope 过滤 Memory.
 *
 * 任一字段命中即视为匹配 (OR 语义). 多字段同时要满足时调用方自行 AND.
 * 空 scope (无任一字段) 等价"不过滤", 全量返回.
 *
 * 用于 brief 注入 / Persona 检索时的范围限定.
 *
 * @example
 *   // 拉 BossAI 当前 session 的 episodic 记忆 (短期)
 *   filterMemoriesByScope(all, { sessionId: 'sess-abc' })
 *
 *   // 拉公司级 procedural (团队 SOP)
 *   all.filter(m => m.ownershipLevel === 'company' && getMemoryKind(m) === 'procedural')
 */
export function filterMemoriesByScope(
  memories: MemoryEntry[],
  scope: MemoryScope,
): MemoryEntry[] {
  const { orgId, agentId, userId, sessionId } = scope;
  if (!orgId && !agentId && !userId && !sessionId) return memories;
  return memories.filter((m) => {
    if (orgId && m.orgId === orgId) return true;
    if (agentId && m.agentId === agentId) return true;
    if (userId && m.ownerUserId === userId) return true;
    if (sessionId && m.sessionId === sessionId) return true;
    return false;
  });
}

/**
 * §P0 #3 · 按 kind 分桶 (检索建议用法)
 *
 * @example
 *   const { semantic, procedural, episodic } = bucketMemoriesByKind(all);
 *   // brief: [...procedural, ...semantic]
 *   // retro: [...episodic]
 */
export function bucketMemoriesByKind(memories: MemoryEntry[]): {
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
} {
  const out = { episodic: [] as MemoryEntry[], semantic: [] as MemoryEntry[], procedural: [] as MemoryEntry[] };
  for (const m of memories) {
    out[getMemoryKind(m)].push(m);
  }
  return out;
}

export function isPromotionApproved(req: MemoryPromotionRequest): boolean {
  return (
    req.status === 'approved' &&
    !!req.signers.businessLeader &&
    !!req.signers.steward
  );
}
