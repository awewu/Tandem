import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { listSkillRecords, submitForReview, reviewSkill, suspendSkill } from '@/lib/taf/skills/governance';

/**
 * GET  /api/skills/governance              · 列出所有 Skill 治理记录
 * POST /api/skills/governance              · { action, recordId, ...payload }
 *   action='submit'   作者提审
 *   action='review'   治理委员会审批 (approve/reject/request-changes)
 *   action='suspend'  紧急下线 (admin only)
 */
export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const records = await listSkillRecords({ tenantId: auth.tenantId });
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'submit' | 'review' | 'suspend';
    recordId?: string;
    decision?: 'approve' | 'reject' | 'request-changes';
    comment?: string;
    stagingScope?: { departmentIds?: string[]; userIds?: string[] };
    reason?: string;
  };
  if (!body.action || !body.recordId) {
    return NextResponse.json({ error: 'action + recordId required' }, { status: 400 });
  }

  try {
    if (body.action === 'submit') {
      const r = await submitForReview(body.recordId, auth.userId);
      return NextResponse.json({ record: r });
    }
    if (body.action === 'review') {
      if (!auth.roles.some((r) => (DATA_STEWARD_ROLES as string[]).includes(r))) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (!body.decision) {
        return NextResponse.json({ error: 'decision required' }, { status: 400 });
      }
      const r = await reviewSkill(
        body.recordId,
        auth.userId,
        auth.roles[0] ?? 'steward',
        body.decision,
        body.comment,
        body.stagingScope,
      );
      return NextResponse.json({ record: r });
    }
    if (body.action === 'suspend') {
      if (!auth.roles.includes('admin')) {
        return NextResponse.json({ error: 'admin only' }, { status: 403 });
      }
      const r = await suspendSkill(body.recordId, auth.userId, body.reason ?? 'manual suspend');
      return NextResponse.json({ record: r });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
