export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { runHermes } from '@/lib/hermes-cli';
import { withApiLog } from '@/lib/api-log/with-api-log';

const SAFE_ID = /^[A-Za-z0-9_\-]+$/;
type Action = 'remove' | 'run' | 'pause' | 'resume';

async function cronAction(action: Action, id: string) {
  if (!SAFE_ID.test(id)) {
    return Response.json({ success: false, error: 'Invalid id' }, { status: 400 });
  }
  try {
    const { stdout, stderr, code } = await runHermes(['cron', action, id]);
    if (code !== 0) {
      return Response.json({ success: false, error: stderr || `exit ${code}` }, { status: 500 });
    }
    return Response.json({ success: true, raw: stdout });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message }, { status: 500 });
  }
}

async function DELETEApiHandler(_req: Request, { params }: { params: { id: string } }) {
  return cronAction('remove', params.id);
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/cron/[id]' });

async function POSTApiHandler(_req: Request, { params }: { params: { id: string } }) {
  return cronAction('run', params.id);
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/cron/[id]' });

async function PATCHApiHandler(req: Request, { params }: { params: { id: string } }) {
  try {
    const { action } = await req.json();
    if (action !== 'pause' && action !== 'resume') {
      return Response.json({ success: false, error: 'action must be pause|resume' }, { status: 400 });
    }
    return cronAction(action, params.id);
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/cron/[id]' });
