import { createReadStream, createWriteStream } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

interface DevObjectEntry {
  filePath: string;
  contentType: string;
  size: number;
  updatedAt: number;
}

const STORE_KEY = '__tandem_im_dev_object_store__';
const MAX_OBJECT_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_OBJECTS = 200;
const STORE_DIR = join(tmpdir(), 'tandem-im-dev-objects');

type DevObjectStore = Map<string, DevObjectEntry>;

function getDevObjectStore(): DevObjectStore {
  const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: DevObjectStore };
  if (!globalStore[STORE_KEY]) globalStore[STORE_KEY] = new Map<string, DevObjectEntry>();
  return globalStore[STORE_KEY];
}

function filePathForKey(key: string): string {
  return join(STORE_DIR, Buffer.from(key).toString('base64url'));
}

async function cleanupStore(store: DevObjectStore) {
  if (store.size <= MAX_OBJECTS) return;
  const entries = Array.from(store.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [key, entry] of entries.slice(0, store.size - MAX_OBJECTS)) {
    store.delete(key);
    await unlink(entry.filePath).catch(() => undefined);
  }
}

function keyFromRequest(req: NextRequest): string | null {
  const key = new URL(req.url).searchParams.get('key');
  if (!key || !key.startsWith('im/')) return null;
  return key;
}

async function writeRequestBodyToFile(req: NextRequest, filePath: string): Promise<number> {
  if (!req.body) throw new Error('request body required');

  await mkdir(STORE_DIR, { recursive: true });
  const writer = createWriteStream(filePath);
  const reader = req.body.getReader();
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_OBJECT_BYTES) {
        writer.destroy();
        await unlink(filePath).catch(() => undefined);
        throw new Error('file too large');
      }
      if (!writer.write(value)) {
        await new Promise<void>((resolve, reject) => {
          writer.once('drain', resolve);
          writer.once('error', reject);
        });
      }
    }
  } finally {
    reader.releaseLock();
  }

  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.once('error', reject);
  });

  return size;
}

export async function PUT(req: NextRequest) {
  const key = keyFromRequest(req);
  if (!key) return NextResponse.json({ error: 'invalid key' }, { status: 400 });

  const filePath = filePathForKey(key);
  let size = 0;
  try {
    size = await writeRequestBodyToFile(req, filePath);
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
  await cleanupStore(store);

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const key = keyFromRequest(req);
  if (!key) return NextResponse.json({ error: 'invalid key' }, { status: 400 });

  const store = getDevObjectStore();
  const stored = store.get(key);
  const filePath = stored?.filePath ?? filePathForKey(key);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      'Content-Type': stored?.contentType ?? 'application/octet-stream',
      'Content-Length': String(fileStat.size),
      'Cache-Control': 'no-store',
    },
  });
}
