import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  actorFromAuth,
  completeWorkflowTask,
  getWorkflowRuntimeSnapshot,
  startWorkflowInstance,
  withdrawWorkflowInstance,
} from '@/lib/workflows/lowcode-runtime';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const snapshot = await getWorkflowRuntimeSnapshot(actorFromAuth(auth));
  return NextResponse.json({ snapshot });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/workflows/runtime' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const actor = actorFromAuth(auth);
  const body = await req.json();
  const action = String(body.action ?? 'start');

  if (action === 'start') {
    const result = await startWorkflowInstance(body, actor);
    return NextResponse.json({ result }, { status: 201 });
  }

  if (action === 'complete') {
    const result = await completeWorkflowTask(body, actor);
    return NextResponse.json({ result });
  }

  if (action === 'withdraw') {
    const result = await withdrawWorkflowInstance({ id: body.id, reason: body.reason }, actor);
    return NextResponse.json({ result });
  }

  return NextResponse.json({ error: 'Unknown action; expected start | complete | withdraw' }, { status: 400 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/workflows/runtime' });
