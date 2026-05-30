/**
 * Academy Enrollment 类型 · KvStore 形态 (P0 真闭环用)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 *
 * 注:
 *   - P0: 课程概念暂用 fixture lessons, 不强制 courseId
 *   - P2 升级: 切换到 drizzle Enrollment 表 (courseId 必填 + status 状态机)
 *
 * 一人一份 (id = `enroll_${userId}`), 持续 append lessonsCompleted.
 */

export interface LearningEnrollment {
  id: string;
  userId: string;
  /** P2: 课程 ID; P0 可为空 (按 lesson 维度记录) */
  courseId?: string;
  /** 已完成的 lesson IDs (去重 append) */
  lessonsCompleted: string[];
  /** 累计得分 (各 lesson attempt 平均) */
  totalScore?: number;
  enrolledAt: string;
  completedAt?: string;
  tenantId?: string;
}

/** 幂等 enrollment ID (KvStore 不允许重复, 用此规则保证一人一份) */
export function enrollmentIdFor(userId: string): string {
  return `enroll_${userId}`;
}
