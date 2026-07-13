/**
 * EVO-7 · 业务领域 redactor 实例集
 *
 * 这里把现有 lib/auth/strip.ts 的逻辑重构为基于 redactor framework 的统一实现.
 * lib/auth/strip.ts 继续 re-export 同名函数, 调用点 0 改动.
 *
 * 新增:
 *   - redactAuthUser: 用户实体的 scope 化抹白 (email/lastLoginIp/lockedUntil 等)
 *
 * 字段抹白策略 (Tandem 化, 比 Ruflo 更宽容因为业务需要看名字):
 *   - email      : tenant/public 抹 (同事看不到邮箱, 防钓鱼)
 *   - lastLoginIp: 永不暴露 (admin 也看不到, 仅审计日志可查)
 *   - 1on1.privateManagerNote : 仅 manager (self scope when viewer=manager) 可见
 *   - 360.raterId (peer/cross): anonymizePeers=true 时对非 raterId 本人匿名化
 */

import { buildRedactor, type Redactor } from './redactor';
import type { OneOnOneMeeting } from '@/lib/types/one-on-one';
import type {
  Review360Submission,
  Review360Cycle,
} from '@/lib/types/review-360';

// ---------------------------------------------------------------------------
// AuthUser — 同租户其他员工 (tenant scope) 不应看到 email 域 / lastLoginIp
// ---------------------------------------------------------------------------

/**
 * AuthUser 抹白. 输入只需要这些字段子集, 不强依赖完整 AuthUser 类型,
 * 方便给 /api/org/users 这种部分字段返回的端点直接复用.
 */
export interface RedactableUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  departmentId: string | null;
  lastLoginIp?: string | null;
  lockedUntil?: string | null;
  failedLoginCount?: number;
  /** 账号是否被禁用 (组织架构管理需读取以展示/切换状态). 无抹白规则 → 各视角可见. */
  disabled?: boolean;
}

export const redactAuthUser: Redactor<RedactableUser> = buildRedactor<
  RedactableUser
>({
  email: { hideAt: ['tenant', 'public'], placeholder: '' },
  lastLoginIp: { hideAt: ['self', 'admin', 'tenant', 'public'] },
  lockedUntil: { hideAt: ['tenant', 'public'] },
  failedLoginCount: { hideAt: ['tenant', 'public'] },
});

// ---------------------------------------------------------------------------
// OneOnOneMeeting — 员工不应看到 主管私语 + 情绪分
// ---------------------------------------------------------------------------

/**
 * 1on1 抹白. 调用方应通过 resolveScope([managerId, reportId], ctx) 得到 scope.
 *
 * 关键: 主管 (managerId === viewer) → self → 看全 privateManagerNote.
 *       员工 (reportId === viewer)  → self → ⚠️ 但仍要抹 privateManagerNote!
 *
 * 因为 1on1 的"主人"有两人, "self scope"对二者均成立,
 * 而员工对 privateManagerNote 不应该有权限. 故这里需要业务 override.
 *
 * 解决方案: 暴露 strip1on1ForRequester 包装函数 (旧 API, 业务感知).
 */
export function strip1on1ForRequester(
  meeting: OneOnOneMeeting,
  requesterId: string,
): OneOnOneMeeting {
  if (meeting.managerId === requesterId) return meeting;
  return {
    ...meeting,
    privateManagerNote: null,
    moodScore: null,
  };
}

// ---------------------------------------------------------------------------
// 360 提交 — anonymizePeers=true 时, peer/cross 类抹 raterId
// ---------------------------------------------------------------------------

export function strip360SubmissionForViewer(
  submission: Review360Submission,
  cycle: Pick<Review360Cycle, 'anonymizePeers'>,
  viewerId: string,
): Review360Submission {
  if (submission.raterId === viewerId) return submission;
  if (!cycle.anonymizePeers) return submission;
  if (submission.raterType === 'peer' || submission.raterType === 'cross') {
    return { ...submission, raterId: 'anonymous' };
  }
  return submission;
}
