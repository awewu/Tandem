import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { docAccess } from '@/lib/documents/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { documentRepo } = createAppContext();
  const doc = await documentRepo.findById(params.id);
  if (!doc || doc.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.tenantId !== auth.tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...doc, ...docAccess(auth, doc) });
}

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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return applyUpdate(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return applyUpdate(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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
