import { createReadStream, createWriteStream } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface DevObjectEntry {
  filePath: string;
  contentType: string;
  size: number;
  updatedAt: number;
}

const STORE_KEY = '__tandem_im_dev_object_store__';
const MAX_OBJECT_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_OBJECTS = 200;
const STORE_DIR = join(process.cwd(), '.data', 'im-dev-objects');
const LEGACY_STORE_DIR = join(tmpdir(), 'tandem-im-dev-objects');

type DevObjectStore = Map<string, DevObjectEntry>;

export function getDevObjectStore(): DevObjectStore {
  const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: DevObjectStore };
  if (!globalStore[STORE_KEY]) globalStore[STORE_KEY] = new Map<string, DevObjectEntry>();
  return globalStore[STORE_KEY];
}

export function filePathForDevObjectKey(key: string): string {
  return join(STORE_DIR, Buffer.from(key).toString('base64url'));
}

export function legacyFilePathForDevObjectKey(key: string): string {
  return join(LEGACY_STORE_DIR, Buffer.from(key).toString('base64url'));
}

export function createDevObjectReadStream(filePath: string) {
  return createReadStream(filePath);
}

export async function statDevObject(filePath: string) {
  return stat(filePath).catch(() => null);
}

export async function cleanupDevObjectStore(store: DevObjectStore) {
  if (store.size <= MAX_OBJECTS) return;
  const entries = Array.from(store.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [key, entry] of entries.slice(0, store.size - MAX_OBJECTS)) {
    store.delete(key);
    await unlink(entry.filePath).catch(() => undefined);
  }
}

export async function writeDevObjectRequestBody(req: Request, filePath: string): Promise<number> {
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
