#!/usr/bin/env node
/**
 * A3 · 回填 embeddings 表 (pgvector 统一检索层)
 *
 * 扫描 KvStore 里的实体 (默认 shouchao 笔记), 计算 embedding 写入 embeddings 表。
 * 幂等: 按 id = `${entityType}:${entityId}` ON CONFLICT 覆盖。可重复跑。
 *
 * 前置: 先跑 scripts/apply-pgvector-migration.mjs 建表; .env.local 配好 EMBEDDING_*。
 *
 * 用法:
 *   node scripts/backfill-vector-store.mjs                  # dry-run 统计
 *   node scripts/backfill-vector-store.mjs --apply          # 计算并写入
 *   node scripts/backfill-vector-store.mjs --apply --memories  # 同时回填组织记忆
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
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const PROVIDER = process.env.EMBEDDING_PROVIDER ?? 'none';
if (PROVIDER === 'none') {
  console.error('[backfill-vec] EMBEDDING_PROVIDER=none — 未配 embedding, 无法回填。');
  process.exit(1);
}
const MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const API_URL = process.env.EMBEDDING_API_URL ?? 'https://api.openai.com/v1/embeddings';
const API_KEY = process.env.EMBEDDING_API_KEY;
const DIM = Number(process.env.EMBEDDING_DIM ?? '1536');

const APPLY = process.argv.includes('--apply');
const WITH_MEMORIES = process.argv.includes('--memories');

async function embed(text) {
  const key = (text ?? '').slice(0, 4000);
  if (!key.trim()) return null;
  const headers = { 'Content-Type': 'application/json' };
  if (PROVIDER !== 'ollama' && API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const body = PROVIDER === 'ollama'
    ? JSON.stringify({ model: MODEL, prompt: key })
    : JSON.stringify({ model: MODEL, input: key });
  const res = await fetch(API_URL, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`embed http ${res.status}`);
  const data = await res.json();
  const vector = PROVIDER === 'ollama' ? data.embedding : data.data?.[0]?.embedding;
  return Array.isArray(vector) ? vector : null;
}

const sql = postgres(url.split('?')[0], { max: 1 });

/** collection → { entityType, textOf, ownerOf } */
const SOURCES = [
  {
    collection: 'shouchao_notes',
    entityType: 'shouchao_note',
    textOf: (d) => `${d.title ?? ''}\n${d.content ?? ''}\n${(d.tags ?? []).join(' ')}`,
    ownerOf: (d) => d.ownerId ?? null,
    skip: (d) => !!d.deletedAt,
  },
];
if (WITH_MEMORIES) {
  SOURCES.push({
    collection: 'memories',
    entityType: 'memory',
    textOf: (d) => `${d.title ?? ''}\n${d.body ?? ''}`,
    ownerOf: () => null,
    skip: (d) => d.status && d.status !== 'active',
  });
}

console.log(`[backfill-vec] provider=${PROVIDER} model=${MODEL} dim=${DIM} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

let scanned = 0, written = 0;
const errors = [];

try {
  // 表存在性检查
  const t = await sql`SELECT to_regclass('public.embeddings') AS t`;
  if (!t[0].t) {
    console.error('[backfill-vec] embeddings 表不存在 — 先跑 apply-pgvector-migration.mjs');
    await sql.end();
    process.exit(1);
  }

  for (const src of SOURCES) {
    const rows = await sql`SELECT data FROM "KvStore" WHERE collection = ${src.collection}`;
    console.log(`[backfill-vec] ${src.collection}: ${rows.length} 行`);
    for (const r of rows) {
      const d = r.data;
      if (!d || !d.id || src.skip(d)) continue;
      scanned += 1;
      if (!APPLY) continue;
      try {
        const vec = await embed(src.textOf(d));
        if (!vec) { errors.push(`${d.id}: empty`); continue; }
        if (vec.length !== DIM) { errors.push(`${d.id}: dim ${vec.length}≠${DIM}`); continue; }
        const id = `${src.entityType}:${d.id}`;
        const lit = `[${vec.join(',')}]`;
        await sql`
          INSERT INTO embeddings (id, tenant_id, owner_id, entity_type, entity_id, model, dim, vec, updated_at)
          VALUES (${id}, ${d.tenantId ?? 'default'}, ${src.ownerOf(d)}, ${src.entityType}, ${d.id}, ${MODEL}, ${vec.length}, ${lit}::vector, now())
          ON CONFLICT (id) DO UPDATE SET vec = EXCLUDED.vec, model = EXCLUDED.model, dim = EXCLUDED.dim, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id, updated_at = now()
        `;
        written += 1;
      } catch (e) {
        errors.push(`${d.id}: ${String(e.message).split('\n')[0]}`);
      }
    }
  }

  console.log(`\n[backfill-vec] 扫描: ${scanned}`);
  if (APPLY) console.log(`[backfill-vec] 写入: ${written}`);
  if (errors.length) {
    console.error(`[backfill-vec] ${errors.length} 条错误:`);
    for (const e of errors.slice(0, 20)) console.error(`  ✗ ${e}`);
  }
  console.log(APPLY ? '\n[backfill-vec] 完成.' : '\n[backfill-vec] DRY-RUN. 加 --apply 真正写入.');
  await sql.end();
  if (errors.length) process.exitCode = 1;
} catch (e) {
  console.error('[backfill-vec] FAIL', e.message);
  await sql.end();
  process.exit(1);
}
