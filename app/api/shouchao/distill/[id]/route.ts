/**
 * 搭子手抄 · A2 蒸馏候选操作
 *   POST /api/shouchao/distill/:id   body: { action: 'apply' | 'dismiss' }
 * 承 C3: apply 才落地 (link 互加双链); dismiss 忽略。ownerId 隔离。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyCandidate, dismissCandidate } from '@/lib/shouchao/distillation';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function POSTApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.action === 'dismiss') {
    const ok = await dismissCandidate(auth.userId, params.id);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'apply') {
    const candidate = await applyCandidate(auth.userId, params.id);
    if (!candidate) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ candidate });
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/distill/[id]' });
