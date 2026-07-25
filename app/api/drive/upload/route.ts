import { mkdir, writeFile, unlink } from 'fs/promises';
import { dirname } from 'path';
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { generateId } from '@/lib/storage/repository';
import { resolveDriveActor } from '@/lib/drive/actor';
import { buildAncestorChain, canWrite } from '@/lib/drive/acl';
import { ensureDriveOrgScope, isInDriveOrgScope } from '@/lib/drive/org-scope';
import { createLocalDriveStorageKey, localDriveObjectPath } from '@/lib/drive/local-storage';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const MAX_LOCAL_UPLOAD_BYTES = 200 * 1024 * 1024;

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  if (!file.name.trim()) {
    return NextResponse.json({ error: 'fileName required' }, { status: 400 });
  }
  if (file.size > MAX_LOCAL_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const formParentId = form.get('parentId');
  const parentId = typeof formParentId === 'string' && formParentId ? formParentId : scope.rootFolderId;
  if (!parentId) {
    return NextResponse.json({ error: 'current user has no department drive scope', scope }, { status: 409 });
  }

  const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
  if (!isInDriveOrgScope(all, parentId, scope)) {
    return NextResponse.json({ error: 'folder is outside current department scope', scope }, { status: 403 });
  }
  const parentChain = buildAncestorChain(parentId, new Map(all.map((item) => [item.id, item])));
  if (parentChain.length === 0) {
    return NextResponse.json({ error: 'parent folder not found' }, { status: 404 });
  }
  if (!canWrite(parentChain, actor)) {
    return NextResponse.json({ error: 'No write permission on parent' }, { status: 403 });
  }

  const storageKey = createLocalDriveStorageKey(auth.tenantId, auth.userId, file.name, generateId());
  const filePath = localDriveObjectPath(storageKey);
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);

  try {
    const created = await svc.create({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      parentId,
      storageKey,
      isFolder: false,
      ownerId: auth.userId,
      tenantId: auth.tenantId,
    }, actor);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive/upload' });
