/**
 * Academy Service · Phase 2 MVP (2026-05-29)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 *
 * 职责: 课程目录 / 选课 / 答题 / 颁证 的核心 DB 读写.
 *
 * 设计原则:
 *   - 单文件聚合 (类似 launchpad-service.ts), 不拆 5 个 repo
 *   - 所有写操作必经 audit 留痕 (academy.* AuditAction)
 *   - 所有读操作支持 tenantId 隔离
 *   - mandatory_quarterly cert 90 天过期 (closure.ts 兜底)
 *
 * P2 范围:
 *   ✅ Course CRUD (HR)
 *   ✅ Lesson 读 + 答题写
 *   ✅ Enrollment 状态机
 *   ✅ Certification 颁发 + 过期扫描
 *   ⛔ AI 课程生成 (走 /api/learning/generate, P3)
 *   ⛔ HR 派课批量 (CourseAssignment, P3)
 */

import { and, eq, desc, sql, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import { audit } from '@/lib/audit/log';

const c = schema.course;
const l = schema.lesson;
const e = schema.enrollment;
const cert = schema.certification;

// ---------------------------------------------------------------------------
// ID 生成
// ---------------------------------------------------------------------------

function cuid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// 类型 (与 drizzle row 解耦, 给 UI 用)
// ---------------------------------------------------------------------------

export type CourseStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type CourseRequirement =
  | 'mandatory_once'
  | 'mandatory_quarterly'
  | 'mandatory_yearly'
  | 'recommended'
  | 'elective';

export interface CourseDTO {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: CourseStatus;
  requirement: CourseRequirement;
  level: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  estMinutes: number;
  modeAffinity: string[];
  coverUrl: string | null;
  ownerUserId: string;
  publishedAt: string | null;
  bossCaptureBonus: number;
  unlocksDelegationLevel: string | null;
  lockOnExpiry: boolean;
  version: number;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

function toCourseDTO(row: typeof c.$inferSelect): CourseDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    status: row.status as CourseStatus,
    requirement: row.requirement as CourseRequirement,
    level: row.level as CourseDTO['level'],
    description: row.description,
    estMinutes: row.estMinutes,
    modeAffinity: row.modeAffinity,
    coverUrl: row.coverUrl,
    ownerUserId: row.ownerUserId,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    bossCaptureBonus: row.bossCaptureBonus,
    unlocksDelegationLevel: row.unlocksDelegationLevel,
    lockOnExpiry: row.lockOnExpiry,
    version: row.version,
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Course: 读
// ---------------------------------------------------------------------------

export interface CourseListFilter {
  tenantId: string;
  status?: CourseStatus | CourseStatus[];
  category?: string;
  requirement?: CourseRequirement;
  /** 软删 deletedAt IS NULL */
  includeDeleted?: boolean;
  limit?: number;
}

export async function listCourses(filter: CourseListFilter): Promise<CourseDTO[]> {
  const conds = [eq(c.tenantId, filter.tenantId)];
  if (filter.status) {
    if (Array.isArray(filter.status)) conds.push(inArray(c.status, filter.status));
    else conds.push(eq(c.status, filter.status));
  }
  if (filter.category) conds.push(eq(c.category, filter.category));
  if (filter.requirement) conds.push(eq(c.requirement, filter.requirement));
  if (!filter.includeDeleted) conds.push(sql`${c.deletedAt} IS NULL`);

  const q = db
    .select()
    .from(c)
    .where(and(...conds))
    .orderBy(desc(c.publishedAt), desc(c.createdAt));

  const rows = filter.limit ? await q.limit(filter.limit) : await q;
  return rows.map(toCourseDTO);
}

export async function getCourseById(
  id: string,
  tenantId: string,
): Promise<CourseDTO | null> {
  const rows = await db
    .select()
    .from(c)
    .where(and(eq(c.id, id), eq(c.tenantId, tenantId)))
    .limit(1);
  return rows[0] ? toCourseDTO(rows[0]) : null;
}

export async function getCourseBySlug(
  slug: string,
  tenantId: string,
): Promise<CourseDTO | null> {
  const rows = await db
    .select()
    .from(c)
    .where(and(eq(c.slug, slug), eq(c.tenantId, tenantId)))
    .limit(1);
  return rows[0] ? toCourseDTO(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Course: 写
// ---------------------------------------------------------------------------

export interface CreateCourseInput {
  title: string;
  slug: string;
  category: string;
  description?: string;
  requirement?: CourseRequirement;
  level?: 'beginner' | 'intermediate' | 'advanced';
  estMinutes?: number;
  modeAffinity?: string[];
  bossCaptureBonus?: number;
  unlocksDelegationLevel?: 'L1' | 'L2' | 'L3' | null;
  lockOnExpiry?: boolean;
  ownerUserId: string;
  createdByUserId: string;
  tenantId: string;
}

export async function createCourse(input: CreateCourseInput): Promise<CourseDTO> {
  const id = cuid('course');
  const now = new Date();
  const row = {
    id,
    title: input.title,
    slug: input.slug,
    category: input.category,
    modeAffinity: input.modeAffinity ?? [],
    level: input.level ?? 'beginner',
    estMinutes: input.estMinutes ?? 0,
    description: input.description ?? '',
    coverUrl: null,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    reviewedByUserIds: [],
    status: 'draft' as const,
    publishedAt: null,
    requirement: input.requirement ?? 'elective',
    proficiencyReward: null,
    bossCaptureBonus: input.bossCaptureBonus ?? 0,
    unlocksDelegationLevel: input.unlocksDelegationLevel ?? null,
    lockOnExpiry: input.lockOnExpiry ?? false,
    version: 1,
    contentHash: '',
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.insert(c).values(row);

  await audit('academy.course_created', input.createdByUserId, {
    targetType: 'course',
    targetId: id,
    tenantId: input.tenantId,
    metadata: {
      title: input.title,
      category: input.category,
      requirement: row.requirement,
    },
  });

  return toCourseDTO(row as typeof c.$inferSelect);
}

export async function publishCourse(
  courseId: string,
  reviewerUserId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(c)
    .set({
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(c.id, courseId), eq(c.tenantId, tenantId)));

  await audit('academy.course_published', reviewerUserId, {
    targetType: 'course',
    targetId: courseId,
    tenantId,
  });
}

export async function archiveCourse(
  courseId: string,
  actorUserId: string,
  tenantId: string,
): Promise<void> {
  await db
    .update(c)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(c.id, courseId), eq(c.tenantId, tenantId)));

  await audit('academy.course_archived', actorUserId, {
    targetType: 'course',
    targetId: courseId,
    tenantId,
  });
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export async function listLessonsByCourse(
  courseId: string,
  tenantId: string,
): Promise<(typeof l.$inferSelect)[]> {
  return db
    .select()
    .from(l)
    .where(and(eq(l.courseId, courseId), eq(l.tenantId, tenantId)))
    .orderBy(l.orderIdx);
}

export async function getLessonById(
  id: string,
  tenantId: string,
): Promise<(typeof l.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(l)
    .where(and(eq(l.id, id), eq(l.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export type EnrollmentSource =
  | 'self_elected'
  | 'hr_assigned'
  | 'manager_assigned'
  | 'ai_recommended'
  | 'track_required';

export type EnrollmentStatus =
  | 'enrolled'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'dropped';

export async function enrollUser(input: {
  userId: string;
  courseId: string;
  source?: EnrollmentSource;
  assignmentId?: string;
  dueAt?: Date;
  tenantId: string;
}): Promise<typeof e.$inferSelect> {
  // 幂等: 已存在则返回 (一人一课唯一)
  const existing = await db
    .select()
    .from(e)
    .where(
      and(
        eq(e.userId, input.userId),
        eq(e.courseId, input.courseId),
        eq(e.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const id = cuid('enroll');
  const now = new Date();
  const row: typeof e.$inferInsert = {
    id,
    userId: input.userId,
    courseId: input.courseId,
    source: input.source ?? 'self_elected',
    assignmentId: input.assignmentId ?? null,
    status: 'enrolled',
    enrolledAt: now,
    startedAt: null,
    completedAt: null,
    dueAt: input.dueAt ?? null,
    lessonsCompleted: [],
    totalScore: null,
    tenantId: input.tenantId,
  };

  await db.insert(e).values(row);

  await audit('academy.enrollment_created', input.userId, {
    targetType: 'enrollment',
    targetId: id,
    tenantId: input.tenantId,
    metadata: { courseId: input.courseId, source: row.source },
  });

  return { ...row, assignmentId: row.assignmentId ?? null, status: row.status as string } as typeof e.$inferSelect;
}

export async function getEnrollment(
  userId: string,
  courseId: string,
  tenantId: string,
): Promise<(typeof e.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(e)
    .where(
      and(
        eq(e.userId, userId),
        eq(e.courseId, courseId),
        eq(e.tenantId, tenantId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listEnrollmentsForUser(
  userId: string,
  tenantId: string,
  opts?: { status?: EnrollmentStatus | EnrollmentStatus[] },
): Promise<(typeof e.$inferSelect)[]> {
  const conds = [eq(e.userId, userId), eq(e.tenantId, tenantId)];
  if (opts?.status) {
    if (Array.isArray(opts.status)) conds.push(inArray(e.status, opts.status));
    else conds.push(eq(e.status, opts.status));
  }
  return db.select().from(e).where(and(...conds)).orderBy(desc(e.enrolledAt));
}

// ---------------------------------------------------------------------------
// Certification
// ---------------------------------------------------------------------------

export async function grantCertification(input: {
  userId: string;
  courseId: string;
  enrollmentId: string;
  /** 90 天后过期 (季度复训) */
  validForDays?: number;
  unlockedDelegationLevel?: 'L1' | 'L2' | 'L3';
  unlockedProficiencyBoost?: { mode: string; score: number };
  contentHashAtEarning?: string;
  signedBy?: string;
  tenantId: string;
}): Promise<typeof cert.$inferSelect> {
  const id = cuid('cert');
  const now = new Date();
  const expiresAt = input.validForDays
    ? new Date(Date.now() + input.validForDays * 86400_000)
    : null;
  const certNo = `TANDEM-${now.getFullYear()}-${id.slice(-6).toUpperCase()}`;
  const row: typeof cert.$inferInsert = {
    id,
    userId: input.userId,
    courseId: input.courseId,
    enrollmentId: input.enrollmentId,
    earnedAt: now,
    expiresAt,
    status: 'valid',
    certNo,
    contentHashAtEarning: input.contentHashAtEarning ?? '',
    signedBy: input.signedBy ?? null,
    unlockedDelegationLevel: input.unlockedDelegationLevel ?? null,
    unlockedProficiencyBoost: input.unlockedProficiencyBoost ?? null,
    tenantId: input.tenantId,
  };

  await db.insert(cert).values(row);

  await audit('academy.certification_earned', input.userId, {
    targetType: 'certification',
    targetId: id,
    tenantId: input.tenantId,
    metadata: {
      courseId: input.courseId,
      validForDays: input.validForDays,
    },
  });

  return { ...row, createdAt: now, status: row.status as string } as typeof cert.$inferSelect;
}

/**
 * 扫描已过期证书 (cron 用), 标记 `inGracePeriod=true` 等动作.
 * P3: 真接锁权限触发 (academy.delegation_locked).
 */
export async function scanExpiredCertifications(tenantId: string): Promise<{
  expired: number;
  inGrace: number;
}> {
  const now = new Date();
  const GRACE_MS = 24 * 3600 * 1000;
  const graceCutoff = new Date(now.getTime() - GRACE_MS);

  const rows = await db
    .select()
    .from(cert)
    .where(and(eq(cert.tenantId, tenantId), sql`${cert.expiresAt} IS NOT NULL`));

  let expired = 0;
  let inGrace = 0;
  for (const r of rows) {
    if (!r.expiresAt) continue;
    if (r.expiresAt < graceCutoff) {
      if (r.status !== 'expired') {
        await db.update(cert).set({ status: 'expired' }).where(eq(cert.id, r.id));
      }
      expired++;
    } else if (r.expiresAt < now) {
      if (r.status !== 'expiring_soon') {
        await db.update(cert).set({ status: 'expiring_soon' }).where(eq(cert.id, r.id));
      }
      inGrace++;
    }
  }

  return { expired, inGrace };
}
