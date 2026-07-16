import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requirePermission } from '@/lib/auth/require-auth';
import { getObject, getS3, putObject, BUCKET_ATTACHMENTS } from '@/lib/infra/s3-client';
import { generateId } from '@/lib/storage/repository';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

const VALID_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 25 * 1024 * 1024;

function keyPrefix(tenantId: string): string {
  return `intranet/${tenantId}/`;
}

function validatedKey(req: NextRequest, tenantId: string): string | null {
  const key = new URL(req.url).searchParams.get('key');
  return key?.startsWith(keyPrefix(tenantId)) ? key : null;
}

function localPath(key: string): string {
  const root = path.resolve(process.env.INTRANET_ASSET_DIR ?? path.join(process.cwd(), '.data', 'intranet-assets'));
  const target = path.resolve(root, ...key.split('/'));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('invalid asset path');
  return target;
}

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requirePermission(auth, 'intranet.manage');
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({})) as { fileName?: string; contentType?: string; size?: number };
  if (!body.fileName || !body.contentType || !VALID_MIME.has(body.contentType)) {
    return NextResponse.json({ error: '仅支持 PDF、JPG、PNG、WebP' }, { status: 400 });
  }
  if (!Number.isFinite(body.size) || Number(body.size) <= 0 || Number(body.size) > MAX_SIZE) {
    return NextResponse.json({ error: '文件大小必须在 25 MB 以内' }, { status: 400 });
  }

  const safeName = body.fileName.replace(/[^\w.\-\u4e00-\u9fff]/g, '_').slice(0, 160);
  const id = `${Date.now()}-${generateId()}-${safeName}`;
  const key = `${keyPrefix(auth.tenantId)}${id}`;
  const url = `/api/intranet/assets?key=${encodeURIComponent(key)}`;
  return NextResponse.json({
    uploadUrl: url,
    attachment: { id, name: body.fileName.slice(0, 200), mimeType: body.contentType, size: Number(body.size), url },
  });
}

async function PUTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requirePermission(auth, 'intranet.manage');
  if (forbidden) return forbidden;
  const key = validatedKey(req, auth.tenantId);
  if (!key) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const contentType = req.headers.get('content-type') ?? '';
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (!VALID_MIME.has(contentType) || contentLength > MAX_SIZE) {
    return NextResponse.json({ error: 'invalid file' }, { status: 400 });
  }
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_SIZE) return NextResponse.json({ error: 'invalid file' }, { status: 400 });
  if (getS3()) {
    await putObject(key, bytes, { bucket: BUCKET_ATTACHMENTS, contentType });
  } else {
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return new NextResponse(null, { status: 204 });
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const key = validatedKey(req, auth.tenantId);
  if (!key) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (getS3()) {
    try {
      const object = await getObject(key, BUCKET_ATTACHMENTS);
      const responseBody = new ArrayBuffer(object.body.byteLength);
      new Uint8Array(responseBody).set(object.body);
      return new NextResponse(responseBody, {
        headers: {
          'Content-Type': object.contentType ?? 'application/octet-stream',
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
  }
  try {
    const bytes = await readFile(localPath(key));
    const extension = path.extname(key).toLowerCase();
    const contentType = extension === '.pdf' ? 'application/pdf'
      : extension === '.png' ? 'image/png'
        : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/intranet/assets' });
export const PUT = withApiLog(PUTApiHandler, { route: '/api/intranet/assets' });
export const GET = withApiLog(GETApiHandler, { route: '/api/intranet/assets' });
