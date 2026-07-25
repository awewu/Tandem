import { join } from 'path';

const LOCAL_DRIVE_PREFIX = 'local-drive/';
const LOCAL_DRIVE_STORAGE_DIR = join(process.cwd(), '.drive-local-storage');

export function safeDriveStorageName(fileName: string): string {
  return fileName.replace(/[^\w.\-]/g, '_').slice(0, 200) || 'file';
}

export function createLocalDriveStorageKey(tenantId: string, userId: string, fileName: string, uniqueId: string): string {
  return `${LOCAL_DRIVE_PREFIX}${tenantId}/${userId}/${Date.now()}-${uniqueId}-${safeDriveStorageName(fileName)}`;
}

export function isLocalDriveStorageKey(storageKey: string): boolean {
  return storageKey.startsWith(LOCAL_DRIVE_PREFIX);
}

export function localDriveObjectPath(storageKey: string): string {
  if (!isLocalDriveStorageKey(storageKey)) {
    throw new Error('invalid local drive storage key');
  }
  return join(LOCAL_DRIVE_STORAGE_DIR, Buffer.from(storageKey).toString('base64url'));
}

