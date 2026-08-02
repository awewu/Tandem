#!/usr/bin/env node
/**
 * IM · KvStore im_messages 频道热路径部分函数索引 (幂等 DDL)
 *
 * 配合 lib/storage/drizzle-store.ts DrizzleImMessageRepository.listByChannel:
 *   WHERE collection='im_messages' AND data->>'channelId'=? ... ORDER BY data->>'createdAt' DESC LIMIT N
 * 部分索引 (仅 im_messages 行) 覆盖 (channelId, createdAt), 使"取频道最新 N 条"走索引而非扫描,
 * 消除旧实现"整个频道历史全量读入内存"的每频道 O(N) 上限.
 *
 * IF NOT EXISTS 守卫, 可重复执行。绝不 drizzle-kit push。
 * 运行: node scripts/migrate-im-messages-channel-index.mjs
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { loadPmsEnv } from './pms-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

loadPmsEnv(projectRoot);

const DDL = `
CREATE INDEX IF NOT EXISTS "KvStore_im_channel_created_idx"
  ON "KvStore" ((data->>'channelId'), (data->>'createdAt'))
  WHERE collection = 'im_messages';
`;

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  databaseUrl = databaseUrl.split('?')[0];
  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    console.log('Applying KvStore_im_channel_created_idx (idempotent)...');
    await sql.unsafe(DDL);
    const idx = await sql`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'KvStore' AND indexname = 'KvStore_im_channel_created_idx'`;
    console.log(idx.length ? 'OK. index present: KvStore_im_channel_created_idx' : 'WARN: index not found after DDL');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
