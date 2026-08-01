/**
 * 搭子手抄 · 文件附件上传 (图片/文档原件) — 对标 Notion 图片块 + 附件抽屉
 *
 *   POST /api/shouchao/attachments   (multipart)  file=<图片/文件>, noteId?=<关联笔记>
 *     → { ok, attachment: { id, name, mime, size, url } }
 *
 * 代理上传 (浏览器直连不到内网 MinIO): API 收文件 → putObject 到手抄附件桶
 * → 落一条 ShouchaoAttachment 元数据 → 返回稳定 serving URL /api/shouchao/attachments/{id}.
 * 严格 ownerId 隔离; 未配置对象存储时诚实报错, 不伪造成功.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAttachment } from '@/lib/shouchao/service';
import { generateId } from '@/lib/storage/repository';
import { getS3, putObject, BUCKET_SHOUCHAO_ATTACHMENTS } from '@/lib/infra/s3-client';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 附件大小上限 25MB (图片/常见文档足够, 超大原件请走工作云盘 /drive) */
const ATTACH_MAX_BYTES = 25 * 1024 * 1024;

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  if (!getS3()) {
    return NextResponse.json(
      { ok: false, error: '对象存储未配置 (S3_ENDPOINT)，无法上传附件' },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: '表单解析失败' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: '缺少上传文件 file' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: '文件为空' }, { status: 400 });
  }
  if (file.size > ATTACH_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `文件过大（上限 ${Math.floor(ATTACH_MAX_BYTES / 1024 / 1024)}MB）` },
      { status: 413 },
    );
  }

  const noteIdField = form.get('noteId');
  const noteId = typeof noteIdField === 'string' && noteIdField ? noteIdField : undefined;

  const safeName = (file.name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 200);
  const mime = file.type || 'application/octet-stream';
  const storageKey = `shouchao/${auth.tenantId}/${auth.userId}/${Date.now()}-${generateId()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await putObject(storageKey, bytes, { bucket: BUCKET_SHOUCHAO_ATTACHMENTS, contentType: mime });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: `上传失败：${msg}` }, { status: 502 });
  }

  const attachment = await createAttachment({
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    storageKey,
    name: file.name || safeName,
    mime,
    size: file.size,
    noteId,
  });

  return NextResponse.json({
    ok: true,
    attachment: {
      id: attachment.id,
      name: attachment.name,
      mime: attachment.mime,
      size: attachment.size,
      url: `/api/shouchao/attachments/${attachment.id}`,
    },
  });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/attachments' });
