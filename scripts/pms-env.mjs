import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function loadPmsEnv(projectRoot) {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    '.env.local',
    '.env.production',
    '.env',
    join('..', '.env.local'),
    join('..', '.env.production'),
    join('..', '.env'),
  ];

  for (const rel of candidates) {
    const envPath = join(projectRoot, rel);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
    if (process.env.DATABASE_URL) return;
  }
}
