/**
 * §CA-13 · CompanyBrain Monthly Reflection API
 *
 * GET  /api/admin/company-brain/reflection            列出已生成的反思报告 (近 20 条)
 * POST /api/admin/company-brain/reflection            生成新反思报告 (默认 windowDays=30, useLlm=true)
 * PATCH /api/admin/company-brain/reflection           签批 (approve/reject) 已有报告
 *
 * 仅 admin / steward / champion 可访问.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  generateReflection,
  listReflections,
  approveReflection,
} from '@/lib/persona/company-brain-reflection';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  let limit = Number(url.searchParams.get('limit') ?? 20);
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  if (limit > 100) limit = 100;

  const reports = await listReflections({ tenantId: auth.tenantId, limit });
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  let body: { windowDays?: number; useLlm?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* 允许空 body */
  }

  let windowDays = Number(body.windowDays ?? 30);
  if (!Number.isFinite(windowDays) || windowDays <= 0) windowDays = 30;
  if (windowDays > 90) windowDays = 90;

  const report = await generateReflection({
    windowDays,
    tenantId: auth.tenantId,
    useLlm: body.useLlm ?? true,
    actorUserId: auth.userId,
  });

  if (!report) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'no decisions in window or generation failed (see server logs)',
      },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true, report });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 签批权限收紧: 仅 owner / champion (跟 Memory promotion 同级)
  const roleErr = requireRole(auth, ['admin', 'champion']);
  if (roleErr) return roleErr;

  let body: { reportId?: string; approve?: boolean; reason?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  if (!body.reportId || typeof body.approve !== 'boolean') {
    return NextResponse.json(
      { error: 'reportId (string) and approve (boolean) are required' },
      { status: 400 },
    );
  }

  const updated = await approveReflection(body.reportId, body.approve, auth.userId, body.reason);
  if (!updated) {
    return NextResponse.json({ error: 'report not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, report: updated });
}
