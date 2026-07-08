/**
 * POST /api/im/channels/[id]/attachments/presign
 *
 * Body:
 *   { mode: 'upload', fileName, contentType? }  → 返回 { uploadUrl, storageKey, expiresInSec }
 *   { mode: 'download', storageKey }            → 返回 { url, expiresInSec }
 *
 * 鉴权: 仅频道成员 (getChannelIfMember, 同租户). 非成员/跨租户 → 404 (不泄露存在性).
 * 防 IDOR: storageKey 强制落在 `im/{tenantId}/{channelId}/` 前缀下;
 *          download 时校验 storageKey 属于当前频道, 阻止跨频道读取他人附件.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getChannelIfMember } from '@/lib/im/service';
import {
  getS3,
  presignUpload,
  presignDownload,
  BUCKET_ATTACHMENTS,
} from '@/lib/infra/s3-client';
import { generateId } from '@/lib/storage/repository';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const channelId = params.id;
  const channel = await getChannelIfMember(channelId, auth.userId, auth.tenantId);
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!getS3()) {
    return NextResponse.json(
      { error: 'object storage not configured' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'upload' | 'download';
    fileName?: string;
    contentType?: string;
    storageKey?: string;
  };

  const tenantId = auth.tenantId ?? 'default';
  const keyPrefix = `im/${tenantId}/${channelId}/`;

  if (body.mode === 'upload') {
    if (!body.fileName) {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 });
    }
    const safeName = body.fileName.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const storageKey = `${keyPrefix}${Date.now()}-${generateId()}-${safeName}`;
    const uploadUrl = await presignUpload(storageKey, {
      bucket: BUCKET_ATTACHMENTS,
      contentType: body.contentType,
      expiresInSec: 900,
    });
    return NextResponse.json({ uploadUrl, storageKey, expiresInSec: 900 });
  }

  if (body.mode === 'download') {
    if (!body.storageKey) {
      return NextResponse.json({ error: 'storageKey required' }, { status: 400 });
    }
    // 防跨频道 IDOR: storageKey 必须属于当前频道前缀
    if (!body.storageKey.startsWith(keyPrefix)) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const url = await presignDownload(body.storageKey, {
      bucket: BUCKET_ATTACHMENTS,
      expiresInSec: 900,
    });
    return NextResponse.json({ url, expiresInSec: 900 });
  }

  return NextResponse.json(
    { error: 'mode must be upload | download' },
    { status: 400 },
  );
}
