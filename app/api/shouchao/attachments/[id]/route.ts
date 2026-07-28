/**
 * 搭子手抄 · 附件读取 / 删除
 *
 *   GET    /api/shouchao/attachments/:id   → 流式返回原件 (owner 鉴权)
 *   DELETE /api/shouchao/attachments/:id   → 软删附件元数据 (blob 由清理任务回收)
 *
 * 稳定 serving URL: 正文 markdown 内嵌图片写 ![alt](/api/shouchao/attachments/{id}),
 * 不用 presign (会 900s 过期)。同源请求自动带 cookie, 按 ownerId 隔离鉴权。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAttachment, deleteAttachment } from '@/lib/shouchao/service';
import { getObject, BUCKET_ATTACHMENTS, BUCKET_SHOUCHAO_ATTACHMENTS } from '@/lib/infra/s3-client';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const att = await getAttachment(auth.userId, params.id);
  if (!att) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    let object: Awaited<ReturnType<typeof getObject>>;
    try {
      object = await getObject(att.storageKey, BUCKET_SHOUCHAO_ATTACHMENTS);
    } catch (err) {
      if (BUCKET_SHOUCHAO_ATTACHMENTS === BUCKET_ATTACHMENTS) throw err;
      object = await getObject(att.storageKey, BUCKET_ATTACHMENTS);
    }
    const { body, contentType } = object;
    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': contentType || att.mime || 'application/octet-stream',
        'Content-Length': String(att.size),
        // 私有资源: 仅本人浏览器缓存, 不进共享缓存
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(att.name)}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: `读取失败：${msg}` }, { status: 502 });
  }
}

async function DELETEApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const ok = await deleteAttachment(auth.userId, params.id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/attachments/[id]' });
export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/shouchao/attachments/[id]' });
