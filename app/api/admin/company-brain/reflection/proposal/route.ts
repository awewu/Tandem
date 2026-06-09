/**
 * ON-3 · OKR 优化提议处置 API
 *
 * PATCH /api/admin/company-brain/reflection/proposal
 *   body: { reportId, proposalId, status: 'acknowledged' | 'dismissed' }
 *
 * 治理委员会/Owner 对中央 AI 产出的"参谋建议"做处置。
 * 宪法裁定 A: 仅改提议自身 status (advisory 生命周期), 绝不触碰任何 OKR 写。
 * 仅 admin / champion 可访问 (跟反思签批同级)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { setOptimizationProposalStatus } from '@/lib/persona/company-brain-reflection';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'champion']);
  if (roleErr) return roleErr;

  let body: { reportId?: string; proposalId?: string; status?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  if (
    !body.reportId ||
    !body.proposalId ||
    (body.status !== 'acknowledged' && body.status !== 'dismissed')
  ) {
    return NextResponse.json(
      {
        error:
          'reportId (string), proposalId (string) and status ("acknowledged" | "dismissed") are required',
      },
      { status: 400 },
    );
  }

  const updated = await setOptimizationProposalStatus(
    body.reportId,
    body.proposalId,
    body.status,
    auth.userId,
  );
  if (!updated) {
    return NextResponse.json({ error: 'report or proposal not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, report: updated });
}
