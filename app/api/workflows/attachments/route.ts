import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { generateId, getStore } from '@/lib/storage/repository';
import {
  WORKFLOW_ATTACHMENT_MAX_BYTES,
  deleteWorkflowAttachment,
  writeWorkflowAttachment,
} from '@/lib/workflows/attachment-storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '附件表单解析失败' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: '不能上传空文件' }, { status: 400 });
  if (file.size > WORKFLOW_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: '单个附件不能超过 25MB' }, { status: 413 });
  }

  const id = `wf-att-${generateId()}`;
  const storageKey = `workflows/${encodeURIComponent(auth.tenantId)}/${id}`;
  const mimeType = file.type || 'application/octet-stream';
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await writeWorkflowAttachment(storageKey, bytes, mimeType);
    const attachment = await getStore().workflowAttachments.create({
      id,
      tenantId: auth.tenantId,
      ownerId: auth.userId,
      storageKey,
      name: (file.name || '附件').slice(0, 240),
      mimeType,
      size: file.size,
      url: `/api/workflows/attachments/${id}`,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({
      attachment: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        url: attachment.url,
      },
    });
  } catch (error) {
    await deleteWorkflowAttachment(storageKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ error: `附件上传失败：${message}` }, { status: 502 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/workflows/attachments' });
