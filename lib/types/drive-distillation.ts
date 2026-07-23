/**
 * 组织云盘 · AI 蒸馏候选 (Phase D)
 *
 * 中央 AI 扫描【共享面】工作云盘内容, 产出"蒸馏候选"草稿 (只读产物, 非提案)。
 * 员工/管家审阅后点「提议入库」→ 走 promotion-flow (proposer=本人)。
 *
 * 宪章 Rule A: AI 永不作 proposer。本表只存 AI 的建议草稿, 真正的 proposePromotion
 * 由真人触发 (candidate.status: pending → promoted, 记录 promotionId)。
 */
import type { MemoryType } from './memory';

export type DistillationCandidateStatus = 'pending' | 'dismissed' | 'promoted';

export interface DriveDistillationCandidate {
  id: string;
  tenantId: string;
  /** 来源云盘文件 id */
  sourceFileId: string;
  /** 来源文件名 (denormalized, 便于审阅列表显示) */
  sourceFileName: string;
  /** AI 建议的记忆类型 */
  suggestedType: MemoryType;
  /** AI 建议的标题 */
  suggestedTitle: string;
  /** AI 建议的正文草稿 (人可编辑后再提议) */
  suggestedBody: string;
  /** 为什么建议蒸馏 (可解释性) */
  rationale: string;
  status: DistillationCandidateStatus;
  /** 提议入库后关联的 promotion id (status=promoted 时) */
  promotionId?: string | null;
  /** 审阅/提议/忽略的操作人 */
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}
