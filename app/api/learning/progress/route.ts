/**
 * GET /api/learning/progress
 *
 * 返回当前用户的学习进度快照 (目录/分类页填真实状态用):
 *   - completedLessonIds: 已完成课程 ID 列表 (来自 LearningEnrollment)
 *   - certificationCount: 持有认证数 (本人 + 未过期统计)
 *   - certificationCountValid: 未过期认证数
 *
 * 真扭转: 数据来自 store.learningEnrollments + store.learningCertifications,
 * 与 closure.ts 写入的真实闭环对齐 (反"硬编码 0").
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { enrollmentIdFor } from '@/lib/learning/enrollment';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const store = getStore();

    const enrollment = await withTenantScope(store.learningEnrollments, auth.tenantId).get(
      enrollmentIdFor(auth.userId),
    );
    const completedLessonIds = enrollment?.lessonsCompleted ?? [];

    const allCerts = await withTenantScope(store.learningCertifications, auth.tenantId).list();
    const myCerts = allCerts.filter((c) => c.userId === auth.userId);
    const now = Date.now();
    const certificationCountValid = myCerts.filter(
      (c) => !c.expiresAt || Date.parse(c.expiresAt) > now,
    ).length;

    return NextResponse.json({
      completedLessonIds,
      certificationCount: myCerts.length,
      certificationCountValid,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
