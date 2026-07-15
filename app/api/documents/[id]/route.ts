import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { docAccess } from '@/lib/documents/access';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { documentRepo } = createAppContext();
  const doc = await documentRepo.findById(params.id);
  if (!doc || doc.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.tenantId !== auth.tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...doc, ...docAccess(auth, doc) });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/documents/[id]' });

async function applyUpdate(
  req: NextRequest,
  params: { id: string },
): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { documentRepo } = createAppContext();
  const doc = await documentRepo.findById(params.id);
  if (!doc || doc.deletedAt || doc.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!docAccess(auth, doc).canWrite) {
    return NextResponse.json({ error: 'No write permission' }, { status: 403 });
  }
  const body = await req.json();
  let updated: typeof doc = doc;
  if (typeof body.title === 'string') updated = await documentRepo.updateTitle(params.id, body.title);
  if (typeof body.content === 'string') updated = await documentRepo.updateContent(params.id, body.content);
  if (body.permissions !== undefined) updated = await documentRepo.updatePermissions(params.id, body.permissions);
  if (typeof body.isLocked === 'boolean') {
    updated = body.isLocked ? await documentRepo.lock(params.id) : await documentRepo.unlock(params.id);
  }
  return NextResponse.json(updated);
}

async function PUTApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  return applyUpdate(req, params);
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/documents/[id]' });

async function PATCHApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  return applyUpdate(req, params);
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/documents/[id]' });

async function DELETEApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { documentRepo } = createAppContext();
  const doc = await documentRepo.findById(params.id);
  if (!doc || doc.deletedAt || doc.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!docAccess(auth, doc).canDelete) {
    return NextResponse.json({ error: 'Only owner can delete' }, { status: 403 });
  }
  await documentRepo.softDelete(params.id);
  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/documents/[id]' });
