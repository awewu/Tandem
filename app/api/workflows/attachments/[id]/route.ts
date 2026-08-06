import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import type { WorkflowAttachmentRecord } from '@/lib/types/workflow';
import { deleteWorkflowAttachment, readWorkflowAttachment } from '@/lib/workflows/attachment-storage';

export const runtime = 'nodejs';

function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'attachment';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

type AttachmentLookup =
  | { response: NextResponse }
  | { auth: AuthContext; attachment: WorkflowAttachmentRecord };

async function findAttachment(req: NextRequest, id: string): Promise<AttachmentLookup> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { response: auth };
  await boot();
  const attachment = await getStore().workflowAttachments.get(id);
  if (!attachment || attachment.tenantId !== auth.tenantId) {
    return { response: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  }
  return { auth, attachment };
}

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const found = await findAttachment(req, params.id);
  if ('response' in found) return found.response;
  try {
    const object = await readWorkflowAttachment(found.attachment.storageKey);
    const body = new ArrayBuffer(object.body.byteLength);
    new Uint8Array(body).set(object.body);
    return new NextResponse(body, {
      headers: {
        'Content-Type': object.contentType || found.attachment.mimeType || 'application/octet-stream',
        'Content-Length': String(found.attachment.size),
        'Content-Disposition': contentDisposition(found.attachment.name),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: '附件文件不存在' }, { status: 404 });
  }
}

async function DELETEApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const found = await findAttachment(req, params.id);
  if ('response' in found) return found.response;
  if (found.attachment.ownerId !== found.auth.userId && !found.auth.roles.some((role) => ['admin', 'owner'].includes(role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    await deleteWorkflowAttachment(found.attachment.storageKey);
    await getStore().workflowAttachments.delete(found.attachment.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ error: `附件删除失败：${message}` }, { status: 502 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/workflows/attachments/[id]' });
export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/workflows/attachments/[id]' });
