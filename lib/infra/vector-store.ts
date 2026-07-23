/**
 * Vector Store · pgvector 统一向量检索层 (A3)
 *
 * 目标: 把 memory / 手抄 note / 手抄 row 的语义检索从"KvStore 暴力 cosine + 限 50 条"
 *   升级为 pgvector ANN 索引。供 baseline-guard / memory retriever / 手抄 ask 共用。
 *
 * 三段降级 (承 megaplan C6, 永不硬失败):
 *   1. pgvector 可用 + embedding 已配 → ANN (本模块)
 *   2. 否则调用方回退到 lib/infra/embedding 的内存 cosine
 *   3. 再回退 Jaccard 关键词
 *
 * 命名空间隔离: 不同 embedding 模型维度不同, 只在同 model 内比对 (WHERE model=)。
 * 物理列 vec 为固定维度 vector(EMBEDDING_DIM, 默认 1536); 换不同维度模型需重跑迁移 + 回填。
 *
 * 注意: embeddings 表不是 KvStore JSON 表, 用 db.execute 原生 SQL (postgres-js)。
 */

import { sql } from 'drizzle-orm';
import { db } from './drizzle-client';
import { embed, isEmbeddingConfigured, getEmbeddingModelInfo } from './embedding';
import { logger } from './logger';

export type VectorEntityType = 'memory' | 'shouchao_note' | 'shouchao_row';

/** 期望向量维度 (与迁移脚本 EMBEDDING_DIM 一致)。默认 1536 = text-embedding-3-small。 */
export const EXPECTED_DIM = Number(process.env.EMBEDDING_DIM ?? '1536');

// pgvector 就绪探测缓存 (进程级; 迁移后重启生效)。
let _pgvectorReady: boolean | null = null;

/** 把向量数组转成 pgvector 字面量 '[1,2,3]' (供 ::vector 转换)。 */
export function formatVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

/** cosine 距离 (<=>, 值域 [0,2]) → 相似度 [-1,1]。 */
export function distanceToSim(distance: number): number {
  return 1 - distance;
}

/** postgres-js 经 drizzle execute 返回的行集合归一为数组。 */
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const maybe = result as { rows?: unknown };
  if (maybe && Array.isArray(maybe.rows)) return maybe.rows as Array<Record<string, unknown>>;
  return [];
}

/** embeddings 表是否存在 (迁移已跑)。任何异常 (无 DB/无表) → false。 */
async function isPgvectorReady(): Promise<boolean> {
  if (_pgvectorReady !== null) return _pgvectorReady;
  try {
    const res = await db.execute(sql`SELECT to_regclass('public.embeddings') AS t`);
    const t = rowsOf(res)[0]?.t;
    _pgvectorReady = t != null;
  } catch {
    _pgvectorReady = false;
  }
  return _pgvectorReady;
}

/** 测试/迁移后手动清缓存。 */
export function __resetVectorStoreProbe(): void {
  _pgvectorReady = null;
}

/** 统一开关: embedding 已配 且 pgvector 表就绪。 */
export async function isVectorStoreEnabled(): Promise<boolean> {
  if (!(await isEmbeddingConfigured())) return false;
  return isPgvectorReady();
}

export interface UpsertEmbeddingInput {
  entityType: VectorEntityType;
  entityId: string;
  tenantId: string;
  ownerId?: string | null;
  /** 用于向量化的文本 (标题+正文等)。 */
  text: string;
}

/**
 * 写入/更新一条向量。未启用或维度不符 → 静默跳过 (承 C6)。
 * id = `${entityType}:${entityId}` 保证同实体幂等 upsert。
 */
export async function upsertEmbedding(input: UpsertEmbeddingInput): Promise<void> {
  if (!(await isVectorStoreEnabled())) return;
  const text = (input.text ?? '').trim();
  if (!text) return;
  const vec = await embed(text);
  if (!vec || vec.length === 0) return;
  if (vec.length !== EXPECTED_DIM) {
    logger.warn(
      { entityType: input.entityType, got: vec.length, expected: EXPECTED_DIM },
      '[vector-store] dim mismatch, skip upsert (换模型请重跑迁移+回填)',
    );
    return;
  }
  const info = await getEmbeddingModelInfo();
  const model = info?.model ?? 'unknown';
  const id = `${input.entityType}:${input.entityId}`;
  const lit = formatVectorLiteral(vec);
  try {
    await db.execute(sql`
      INSERT INTO embeddings (id, tenant_id, owner_id, entity_type, entity_id, model, dim, vec, updated_at)
      VALUES (${id}, ${input.tenantId}, ${input.ownerId ?? null}, ${input.entityType}, ${input.entityId}, ${model}, ${vec.length}, ${lit}::vector, now())
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        owner_id = EXCLUDED.owner_id,
        model = EXCLUDED.model,
        dim = EXCLUDED.dim,
        vec = EXCLUDED.vec,
        updated_at = now()
    `);
  } catch (err) {
    logger.warn({ id, err: (err as Error).message }, '[vector-store] upsert failed (non-fatal)');
  }
}

/** 删除一条向量 (实体物删/软删时调, 幂等)。 */
export async function deleteEmbedding(entityType: VectorEntityType, entityId: string): Promise<void> {
  if (!(await isPgvectorReady())) return;
  try {
    await db.execute(sql`DELETE FROM embeddings WHERE id = ${`${entityType}:${entityId}`}`);
  } catch (err) {
    logger.warn({ entityType, entityId, err: (err as Error).message }, '[vector-store] delete failed');
  }
}

export interface SearchEmbeddingsInput {
  queryText: string;
  tenantId: string;
  entityType: VectorEntityType;
  /** 传则限本人 (手抄个人隔离); 组织实体 (memory) 不传。 */
  ownerId?: string | null;
  topK?: number;
  /** 相似度下限 (cosine sim), 默认 0.18 与现有 SEMANTIC_MIN_SIM 一致。 */
  minSim?: number;
}

export interface VectorHit {
  entityId: string;
  sim: number;
}

/**
 * ANN 检索, 返回按相似度降序的 entityId 列表。
 * 返回 null = 向量层不可用 → 调用方应回退到内存 cosine / Jaccard。
 * 返回 [] = 可用但零命中。
 */
export async function searchEmbeddings(input: SearchEmbeddingsInput): Promise<VectorHit[] | null> {
  if (!(await isVectorStoreEnabled())) return null;
  const q = (input.queryText ?? '').trim();
  if (!q) return [];
  const qvec = await embed(q);
  if (!qvec || qvec.length !== EXPECTED_DIM) return null;
  const info = await getEmbeddingModelInfo();
  const model = info?.model ?? 'unknown';
  const topK = input.topK ?? 8;
  const minSim = input.minSim ?? 0.18;
  const lit = formatVectorLiteral(qvec);
  const ownerCond =
    input.ownerId != null ? sql`AND owner_id = ${input.ownerId}` : sql``;
  try {
    const res = await db.execute(sql`
      SELECT entity_id, 1 - (vec <=> ${lit}::vector) AS sim
      FROM embeddings
      WHERE tenant_id = ${input.tenantId}
        AND entity_type = ${input.entityType}
        AND model = ${model}
        ${ownerCond}
      ORDER BY vec <=> ${lit}::vector
      LIMIT ${topK}
    `);
    return rowsOf(res)
      .map((r) => ({ entityId: String(r.entity_id), sim: Number(r.sim) }))
      .filter((h) => Number.isFinite(h.sim) && h.sim >= minSim);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[vector-store] search failed → fallback');
    return null;
  }
}
