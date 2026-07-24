import * as path from 'path';

const DEFAULT_STORAGE_LOCAL_PATH = './storage';

export function resolveStorageRoot() {
  const configured = process.env.STORAGE_LOCAL_PATH || DEFAULT_STORAGE_LOCAL_PATH;
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export function artifactContentUrl(id: string) {
  return `/api/v2/file-artifact/${encodeURIComponent(id)}/content`;
}

export function artifactBase64Url(id: string) {
  return `/api/v2/file-artifact/${encodeURIComponent(id)}/base64`;
}
