/**
 * Skill Governance · 企业级 Skill 治理状态机
 *
 * §T15: Skill 不能"开发者一行代码注册就全员能用". 任何新 Skill 必须经审批,
 *       才能从 'draft' → 'staging' → 'approved' (全员可调用).
 *
 * 状态机:
 *   draft       开发者注册的初始状态, 仅作者本人可调
 *   submitted   作者提交审批, 等待治理委员会
 *   staging     governance 半通过, 限定团队/部门可调 (灰度)
 *   approved    全公司可调
 *   rejected    驳回, 附理由, 作者可改后重新 submitted
 *   suspended   生产事故后人工拉闸
 *
 * 持久化: KvStore collection='skill_registry' + 'skill_audit'
 */

import { getStore, generateId } from '@/lib/storage/repository';
import type { Skill, SkillZone } from './registry';
import { logger } from '@/lib/infra/logger';

export type SkillStatus = 'draft' | 'submitted' | 'staging' | 'approved' | 'rejected' | 'suspended';

export interface SkillRecord {
  id: string;
  /** Skill 业务 ID (如 file.read), 全局唯一 */
  skillId: string;
  /** 版本号, 同 skillId 可有多个版本 */
  version: string;
  description: string;
  tags: string[];
  zone: SkillZone;
  proxyAllowed: boolean;
  estimatedTokens: number;
  /** 序列化的 schema (JSON) */
  schemaJson: string;
  /** 当前状态 */
  status: SkillStatus;
  /** 创建者 (开发者) */
  authorUserId: string;
  /** 审批 history (append-only) */
  reviewHistory: SkillReview[];
  /** staging 限定的 scope (departmentIds / userIds) */
  stagingScope?: { departmentIds?: string[]; userIds?: string[] };
  /** 调用统计 (metrics, denormalized) */
  invocationCount: number;
  errorCount: number;
  lastInvokedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** 租户 (多租户隔离) */
  tenantId: string;
}

export interface SkillReview {
  id: string;
  reviewerId: string;
  /** 审批角色: governance | security | product */
  reviewerRole: string;
  decision: 'approve' | 'reject' | 'request-changes';
  comment?: string;
  at: string;
}

function repo() {
  return getStore().skillRegistry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function registerSkillDraft(
  skill: Skill,
  authorUserId: string,
  tenantId = 'default',
  version = '0.1.0',
): Promise<SkillRecord> {
  const now = new Date().toISOString();
  return repo().create({
    skillId: skill.id,
    version,
    description: skill.description,
    tags: skill.tags,
    zone: skill.zone,
    proxyAllowed: skill.proxyAllowed,
    estimatedTokens: skill.estimatedTokens,
    schemaJson: JSON.stringify(skill.schema),
    status: 'draft',
    authorUserId,
    reviewHistory: [],
    invocationCount: 0,
    errorCount: 0,
    createdAt: now,
    updatedAt: now,
    tenantId,
  });
}

export async function submitForReview(recordId: string, byUserId: string): Promise<SkillRecord> {
  const cur = await repo().get(recordId);
  if (!cur) throw new Error('skill not found');
  if (cur.authorUserId !== byUserId) throw new Error('only author can submit');
  if (!['draft', 'rejected'].includes(cur.status))
    throw new Error(`cannot submit from status ${cur.status}`);
  return repo().update(recordId, { status: 'submitted' });
}

export async function reviewSkill(
  recordId: string,
  reviewerId: string,
  reviewerRole: string,
  decision: SkillReview['decision'],
  comment?: string,
  stagingScope?: SkillRecord['stagingScope'],
): Promise<SkillRecord> {
  const cur = await repo().get(recordId);
  if (!cur) throw new Error('skill not found');
  const review: SkillReview = {
    id: generateId('rev'),
    reviewerId,
    reviewerRole,
    decision,
    comment,
    at: new Date().toISOString(),
  };
  let nextStatus: SkillStatus = cur.status;
  if (decision === 'approve') {
    // 简化策略: 一票通过即 approved (生产应 2/3 多数 + 强制各角色一票)
    nextStatus = stagingScope ? 'staging' : 'approved';
  } else if (decision === 'reject') {
    nextStatus = 'rejected';
  } else {
    nextStatus = 'submitted';
  }
  logger.info({ recordId, reviewerId, decision, nextStatus }, '[skill-gov] review');
  return repo().update(recordId, {
    status: nextStatus,
    reviewHistory: [...cur.reviewHistory, review],
    stagingScope,
  });
}

export async function suspendSkill(recordId: string, byUserId: string, reason: string): Promise<SkillRecord> {
  const cur = await repo().get(recordId);
  if (!cur) throw new Error('skill not found');
  const review: SkillReview = {
    id: generateId('rev'),
    reviewerId: byUserId,
    reviewerRole: 'incident-response',
    decision: 'reject',
    comment: `SUSPEND: ${reason}`,
    at: new Date().toISOString(),
  };
  logger.warn({ recordId, byUserId, reason }, '[skill-gov] suspended');
  return repo().update(recordId, {
    status: 'suspended',
    reviewHistory: [...cur.reviewHistory, review],
  });
}

/** 是否允许 user 调用 skill (基于 status + scope). */
export async function canInvokeSkill(
  skillId: string,
  user: { userId: string; departmentId?: string; tenantId?: string },
): Promise<{ allowed: boolean; record?: SkillRecord; reason?: string }> {
  const records = await repo().list({ skillId, tenantId: user.tenantId ?? 'default' } as Partial<SkillRecord>);
  if (records.length === 0) return { allowed: false, reason: 'skill not registered in governance' };
  // 取最新已批准/staging 的
  const live = records.find((r) => r.status === 'approved') ??
    records.find((r) => r.status === 'staging') ??
    records.find((r) => r.status === 'draft' && r.authorUserId === user.userId);
  if (!live) return { allowed: false, reason: 'no approved version', record: records[0] };
  if (live.status === 'suspended') return { allowed: false, reason: 'skill suspended', record: live };
  if (live.status === 'staging') {
    const scope = live.stagingScope;
    const userOk = scope?.userIds?.includes(user.userId);
    const deptOk = user.departmentId && scope?.departmentIds?.includes(user.departmentId);
    if (!userOk && !deptOk) {
      return { allowed: false, reason: 'staging scope mismatch', record: live };
    }
  }
  if (live.status === 'draft' && live.authorUserId !== user.userId) {
    return { allowed: false, reason: 'draft only callable by author', record: live };
  }
  return { allowed: true, record: live };
}

export async function recordInvocation(
  recordId: string,
  ok: boolean,
): Promise<void> {
  const cur = await repo().get(recordId);
  if (!cur) return;
  await repo().update(recordId, {
    invocationCount: cur.invocationCount + 1,
    errorCount: cur.errorCount + (ok ? 0 : 1),
    lastInvokedAt: new Date().toISOString(),
  });
}

export async function listSkillRecords(filter?: Partial<SkillRecord>): Promise<SkillRecord[]> {
  return repo().list(filter);
}
