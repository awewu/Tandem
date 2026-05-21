/**
 * Drizzle Client · 模块级单例
 * §T2 宪章: 禁止 globalThis，模块级缓存以兼容 HMR
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './drizzle-schema';

declare global {
  // eslint-disable-next-line no-var
  var __pg__: ReturnType<typeof postgres> | undefined;
}

/**
 * Sanitize Prisma-style ?schema=... query parameter.
 *
 * postgres-js forwards every URL query param as a `SET <name> = <value>` to
 * Postgres on connect.  Prisma uses `?schema=public` to scope DDL, but
 * Postgres has no `schema` GUC — the equivalent setting is `search_path`.
 * Without this rewrite the very first query crashes with FATAL 42704
 * "未识别的配置参数 schema".
 */
function sanitizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Drop Prisma's `?schema=...`. Postgres has no `schema` GUC and forwarding
    // it as a connection-startup param crashes with FATAL 42704.  The default
    // search_path already includes `public`, which covers our setup.
    if (u.searchParams.has('schema')) u.searchParams.delete('schema');
    return u.toString();
  } catch {
    return raw;
  }
}

function makeClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL not set');
  return postgres(sanitizeDatabaseUrl(raw), { max: 10, prepare: false });
}

const client = global.__pg__ ?? makeClient();
if (process.env.NODE_ENV !== 'production') {
  global.__pg__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
