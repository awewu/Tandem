import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  actorFromAuth,
  adminCompleteWorkflowTask,
  adminTerminateWorkflowInstance,
  adminTransferWorkflowTask,
  requireWorkflowAdmin,
} from '@/lib/workflows/lowcode-runtime';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const actor = actorFromAuth(auth);
  const body = await req.json();
  const action = String(body.action ?? '');

  if (action === 'transfer') {
    const result = await adminTransferWorkflowTask({
      taskId: body.taskId,
      assigneeId: body.assigneeId,
      reason: body.reason,
    }, actor);
    return NextResponse.json({ result });
  }

  if (action === 'complete') {
    const result = await adminCompleteWorkflowTask({
      taskId: body.taskId,
      decision: body.decision,
      comment: body.comment,
      reason: body.reason,
      formData: body.formData,
    }, actor);
    return NextResponse.json({ result });
  }

  if (action === 'terminate') {
    const result = await adminTerminateWorkflowInstance({
      id: body.id,
      reason: body.reason,
    }, actor);
    return NextResponse.json({ result });
  }

  return NextResponse.json({ error: 'Unknown action; expected transfer | complete | terminate' }, { status: 400 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/workflows/runtime/admin' });
