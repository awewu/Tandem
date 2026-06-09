#!/usr/bin/env node
/**
 * Backfill · 给历史 Memory 落库 embedding 向量 (CA-13 语义召回的氧气)
 *
 * 背景: baseline-guard / OKR drift / memory rerank 优先用 embedding cosine, 缺则降级
 *   Jaccard 字面匹配。配好 EMBEDDING_PROVIDER 后, 运行时会对未落库向量的 Memory 现算
 *   (N+1, 慢)。本脚本一次性把存量 Memory 的向量算好写回 KvStore.data.embedding,
 *   让运行时直接命中。
 *
 * 依赖: .env.local 的 DATABASE_URL + EMBEDDING_PROVIDER/MODEL/API_URL/API_KEY
 *   (与 lib/infra/embedding.ts 同一套配置; 本脚本内联 embed 逻辑, 保持一致)。
 *
 * 用法:
 *   node scripts/backfill-embeddings.mjs            # dry-run (只统计需要回填的条数)
 *   node scripts/backfill-embeddings.mjs --apply    # 真正计算并写回
 *   node scripts/backfill-embeddings.mjs --apply --force  # 连已有向量也重算 (换模型时用)
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

const PROVIDER = process.env.EMBEDDING_PROVIDER ?? 'none';
if (PROVIDER === 'none') {
  console.error(
    '[backfill-embed] EMBEDDING_PROVIDER=none — 未配置 embedding, 无可回填。\n' +
      '  先在 .env.local 配 EMBEDDING_PROVIDER/MODEL/API_URL (见 .env.example), 再跑本脚本。',
  );
  process.exit(1);
}

const MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const API_URL = process.env.EMBEDDING_API_URL ?? 'https://api.openai.com/v1/embeddings';
const API_KEY = process.env.EMBEDDING_API_KEY;

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

/** 与 lib/infra/embedding.ts embed() 同逻辑 */
async function embed(text) {
  const key = (text ?? '').slice(0, 4000);
  if (!key.trim()) return null;
  const headers = { 'Content-Type': 'application/json' };
  if (PROVIDER !== 'ollama' && API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const body =
    PROVIDER === 'ollama'
      ? JSON.stringify({ model: MODEL, prompt: key })
      : JSON.stringify({ model: MODEL, input: key });
  const res = await fetch(API_URL, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`embed http ${res.status}`);
  const data = await res.json();
  const vector = PROVIDER === 'ollama' ? data.embedding : data.data?.[0]?.embedding;
  return Array.isArray(vector) ? vector : null;
}

const sql = postgres(url.split('?')[0], { max: 1 });

console.log(
  `[backfill-embed] provider=${PROVIDER} model=${MODEL} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}${FORCE ? ' --force' : ''}\n`,
);

let scanned = 0;
let needBackfill = 0;
let written = 0;
const errors = [];

try {
  const rows = await sql`SELECT data FROM "KvStore" WHERE collection = 'memories'`;
  scanned = rows.length;

  for (const r of rows) {
    const d = r.data;
    if (!d || !d.id) continue;
    const hasVec = Array.isArray(d.embedding) && d.embedding.length > 0;
    if (hasVec && !FORCE) continue;
    needBackfill += 1;
    if (!APPLY) continue;

    try {
      const vec = await embed(`${d.title ?? ''}\n${d.body ?? ''}`);
      if (!vec) {
        errors.push(`${d.id}: empty vector`);
        continue;
      }
      const next = { ...d, embedding: vec };
      await sql`
        UPDATE "KvStore" SET data = ${sql.json(next)}
        WHERE collection = 'memories' AND data->>'id' = ${d.id}
      `;
      written += 1;
    } catch (e) {
      errors.push(`${d.id}: ${String(e.message).split('\n')[0]}`);
    }
  }

  console.log(`[backfill-embed] 扫描 Memory: ${scanned}`);
  console.log(`[backfill-embed] 需回填: ${needBackfill}${FORCE ? ' (含已有向量, --force 重算)' : ' (缺向量)'}`);
  if (APPLY) console.log(`[backfill-embed] 已写回: ${written}`);
  if (errors.length) {
    console.error(`\n[backfill-embed] ${errors.length} 条错误:`);
    for (const e of errors.slice(0, 20)) console.error(`  ✗ ${e}`);
  }
  console.log(
    APPLY
      ? '\n[backfill-embed] 完成. baseline/drift/rerank 现在命中落库向量, 无需运行时重算.'
      : '\n[backfill-embed] DRY-RUN 完成. 加 --apply 真正计算写回.',
  );
  await sql.end();
  if (errors.length) process.exit(1);
} catch (e) {
  console.error('[backfill-embed] FAIL', e.message);
  await sql.end();
  process.exit(1);
}
