import { Readable } from 'stream';
import { NextResponse, type NextRequest } from 'next/server';
import {
  cleanupDevObjectStore,
  createDevObjectReadStream,
  filePathForDevObjectKey,
  getDevObjectStore,
  legacyFilePathForDevObjectKey,
  statDevObject,
  writeDevObjectRequestBody,
} from '@/lib/im/dev-object-store';

export const runtime = 'nodejs';

function keyFromRequest(req: NextRequest): string | null {
  const key = new URL(req.url).searchParams.get('key');
  if (!key || !key.startsWith('im/')) return null;
  return key;
}

function encodeDownloadName(name: string): string {
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'attachment';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function PUT(req: NextRequest) {
  const key = keyFromRequest(req);
  if (!key) return NextResponse.json({ error: 'invalid key' }, { status: 400 });

  const filePath = filePathForDevObjectKey(key);
  let size = 0;
  try {
    size = await writeDevObjectRequestBody(req, filePath);
  } catch (error) {
    if ((error as Error).message === 'file too large') {
      return NextResponse.json({ error: 'file too large' }, { status: 413 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const store = getDevObjectStore();
  store.set(key, {
    filePath,
    size,
    contentType: req.headers.get('content-type') ?? 'application/octet-stream',
    updatedAt: Date.now(),
  });
  await cleanupDevObjectStore(store);

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const key = keyFromRequest(req);
  if (!key) return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  const params = new URL(req.url).searchParams;

  const store = getDevObjectStore();
  const stored = store.get(key);
  let filePath = stored?.filePath ?? filePathForDevObjectKey(key);
  let fileStat = await statDevObject(filePath);
  if (!fileStat && !stored) {
    const legacyFilePath = legacyFilePathForDevObjectKey(key);
    const legacyFileStat = await statDevObject(legacyFilePath);
    if (legacyFileStat) {
      filePath = legacyFilePath;
      fileStat = legacyFileStat;
    }
  }
  if (!fileStat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const stream = Readable.toWeb(createDevObjectReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      'Content-Type': params.get('contentType') || stored?.contentType || 'application/octet-stream',
      'Content-Length': String(fileStat.size),
      ...(params.get('download') === '1'
        ? { 'Content-Disposition': encodeDownloadName(params.get('name') || key.split('/').pop() || 'attachment') }
        : {}),
      'Cache-Control': 'no-store',
    },
  });
}
