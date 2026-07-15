import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from 'drizzle-kit';

// drizzle-kit 不会自动加载 .env.local, 手动注入 (.env 后 .env.local 覆盖),
// 否则 db:migrate/generate/push/studio 会回退到默认串, 连错库导致"假成功"。
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(process.cwd(), '.env'));
loadEnvFile(join(process.cwd(), '.env.local'));

export default {
  schema: './lib/infra/drizzle-schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://tandem:tandem@localhost:5432/tandem',
  },
  strict: true,
  verbose: true,
} satisfies Config;
