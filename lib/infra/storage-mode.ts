import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function isDevMemoryMode(): boolean {
  return process.env.TANDEM_DEV_MEMORY === '1' || existsSync(join(process.cwd(), '.dev-memory'));
}

export function isDatabaseMode(): boolean {
  return Boolean(process.env.DATABASE_URL) && !isDevMemoryMode();
}
