import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  actorFromAuth,
  getWorkflowConfig,
  requireWorkflowAdmin,
  setWorkflowConfigStatus,
  upsertBusinessWorkflowBinding,
  upsertWorkflowForm,
  upsertWorkflowTemplate,
  type WorkflowConfigKind,
} from '@/lib/workflows/lowcode-runtime';

const CONFIG_KINDS: WorkflowConfigKind[] = ['form', 'workflow', 'binding'];

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const config = await getWorkflowConfig(auth.tenantId);
  return NextResponse.json({ config });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/workflows/config' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const body = await req.json();
  const kind = body.kind as WorkflowConfigKind;
  if (!CONFIG_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind must be form | workflow | binding' }, { status: 400 });
  }

  const actor = actorFromAuth(auth);
  const payload = body.config ?? body;
  const saved =
    kind === 'form'
      ? await upsertWorkflowForm(payload, actor)
      : kind === 'workflow'
        ? await upsertWorkflowTemplate(payload, actor)
        : await upsertBusinessWorkflowBinding(payload, actor);

  return NextResponse.json({ config: saved }, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/workflows/config' });

const PATCHApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const body = await req.json();
  const kind = body.kind as WorkflowConfigKind;
  if (!CONFIG_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind must be form | workflow | binding' }, { status: 400 });
  }
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const saved = await setWorkflowConfigStatus(kind, id, body.status, actorFromAuth(auth));
  return NextResponse.json({ config: saved });
});

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/workflows/config' });
