import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BUCKET_ATTACHMENTS,
  deleteObject,
  getObject,
  getS3,
  putObject,
} from '@/lib/infra/s3-client';

export const WORKFLOW_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

function localRoot(): string {
  return path.resolve(process.env.WORKFLOW_ATTACHMENT_DIR ?? path.join(process.cwd(), '.data', 'workflow-attachments'));
}

function localPath(storageKey: string): string {
  const root = localRoot();
  const target = path.resolve(root, ...storageKey.split('/'));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('invalid workflow attachment path');
  return target;
}

export async function writeWorkflowAttachment(storageKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (getS3()) {
    await putObject(storageKey, bytes, { bucket: BUCKET_ATTACHMENTS, contentType });
    return;
  }
  const target = localPath(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

export async function readWorkflowAttachment(storageKey: string): Promise<{ body: Uint8Array; contentType?: string }> {
  if (getS3()) {
    try {
      return await getObject(storageKey, BUCKET_ATTACHMENTS);
    } catch {
      // Files uploaded before S3 was configured remain readable from local storage.
    }
  }
  return { body: await readFile(localPath(storageKey)) };
}

export async function deleteWorkflowAttachment(storageKey: string): Promise<void> {
  if (getS3()) await deleteObject(storageKey, BUCKET_ATTACHMENTS);
  try {
    await unlink(localPath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
