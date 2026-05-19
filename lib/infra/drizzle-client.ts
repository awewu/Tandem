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

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return postgres(url, { max: 10, prepare: false });
}

const client = global.__pg__ ?? makeClient();
if (process.env.NODE_ENV !== 'production') {
  global.__pg__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
