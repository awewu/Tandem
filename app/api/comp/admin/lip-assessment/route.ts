import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { db } from '@/lib/infra/drizzle-client';
import { kvStore } from '@/lib/infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

const COLLECTION = 'comp_lip_assessment';

/**
 * GET /api/comp/admin/lip-assessment — 列出 LIP 考核历史记录
 * POST /api/comp/admin/lip-assessment — 保存一条 LIP 考核结果
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, COLLECTION), eq(kvStore.tenantId, auth.tenantId)))
    .orderBy(desc(kvStore.updatedAt))
    .limit(50);

  const records = rows.map((r) => (r.data as Record<string, unknown>));
  return NextResponse.json({ rows: records });
}

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    department?: string;
    qualityRate?: number;
    efficiencyRate?: number;
    departmentBase?: number;
    personalCoefficient?: number;
    attendanceRate?: number;
    assessmentRate?: number;
    coefficient?: number;
    lipBonus?: number;
    qualityBelow?: boolean;
    efficiencyBelow?: boolean;
  };

  if (body.lipBonus == null || !body.department) {
    return NextResponse.json({ error: 'department and lipBonus are required' }, { status: 400 });
  }

  const id = `lip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    department: body.department,
    qualityRate: body.qualityRate,
    efficiencyRate: body.efficiencyRate,
    departmentBase: body.departmentBase,
    personalCoefficient: body.personalCoefficient,
    attendanceRate: body.attendanceRate,
    assessmentRate: body.assessmentRate,
    coefficient: body.coefficient,
    lipBonus: body.lipBonus,
    qualityBelow: body.qualityBelow,
    efficiencyBelow: body.efficiencyBelow,
    savedAt: new Date().toISOString(),
    savedBy: auth.userId,
  };

  await db
    .insert(kvStore)
    .values({ collection: COLLECTION, id, data: record, tenantId: auth.tenantId })
    .onConflictDoUpdate({
      target: [kvStore.collection, kvStore.id],
      set: { data: record, tenantId: auth.tenantId, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true, id });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/lip-assessment' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/lip-assessment' });
