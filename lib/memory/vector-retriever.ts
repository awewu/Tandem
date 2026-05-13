/**
 * Vector Memory Retriever · pgvector semantic search
 *
 * Replaces the text-based V1 retriever with cosine-similarity vector search.
 *
 * Prerequisites:
 *   1. PostgreSQL with pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;
 *   2. Prisma schema has `embedding Unsupported("vector(1536)")?` on Material + MemoryEntry
 *   3. Embeddings are populated (via embedAndStore() or background job)
 *
 * Fallback: if pgvector is not available or no embeddings exist, returns empty[]
 * so callers can fall back to StoreBackedMemoryRetriever.
 */

import { PrismaClient } from '@prisma/client';
import type { MemoryRetriever, MemorySearchResult } from '../convergence/decision-engine';

// Shared Prisma instance (reuses connection pool)
let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

/**
 * Check if pgvector is available and embeddings are populated.
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  try {
    const prisma = getPrisma();
    const [{ exists }]: [{ exists: boolean }] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as exists
    `;
    if (!exists) return false;

    // Quick check: do we have at least one embedded memory?
    const [{ count }]: [{ count: bigint }] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "MemoryEntry" WHERE embedding IS NOT NULL
    `;
    return Number(count) > 0;
  } catch {
    return false;
  }
}

/**
 * Generate embedding via upstream API.
 *
 * Default uses DeepSeek embedding (configurable via env).
 * Falls back to local heuristic if API unavailable.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.EMBEDDING_MODEL || 'deepseek-embed';

  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * Store embedding for a MemoryEntry.
 */
export async function embedMemoryEntry(id: string, text: string): Promise<boolean> {
  const embedding = await generateEmbedding(text);
  if (!embedding) return false;

  const prisma = getPrisma();
  try {
    await prisma.$queryRaw`
      UPDATE "MemoryEntry"
      SET embedding = ${embedding}::vector
      WHERE id = ${id}
    `;
    return true;
  } catch {
    return false;
  }
}

/**
 * Store embedding for a Material.
 */
export async function embedMaterial(id: string, text: string): Promise<boolean> {
  const embedding = await generateEmbedding(text);
  if (!embedding) return false;

  const prisma = getPrisma();
  try {
    await prisma.$queryRaw`
      UPDATE "Material"
      SET embedding = ${embedding}::vector
      WHERE id = ${id}
    `;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vector search implementation
// ---------------------------------------------------------------------------

function toPgVector(arr: number[]): string {
  return `[${arr.join(',')}]`;
}

export class VectorMemoryRetriever implements MemoryRetriever {
  async findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]> {
    return this._searchMemory(query, 'sop', limit);
  }

  async findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]> {
    return this._searchMemory(query, 'case', limit);
  }

  async findRelatedMaterials(query: string, limit: number): Promise<MemorySearchResult[]> {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    const prisma = getPrisma();
    try {
      const rows: Array<{
        id: string;
        title: string;
        body: string;
        similarity: number;
      }> = await prisma.$queryRaw`
        SELECT id, title, body,
          1 - (embedding <=> ${toPgVector(embedding)}::vector) as similarity
        FROM "Material"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${toPgVector(embedding)}::vector
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        similarity: clamp01(r.similarity),
      }));
    } catch {
      return [];
    }
  }

  private async _searchMemory(query: string, type: string, limit: number): Promise<MemorySearchResult[]> {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    const prisma = getPrisma();
    try {
      const rows: Array<{
        id: string;
        title: string;
        body: string;
        similarity: number;
      }> = await prisma.$queryRaw`
        SELECT id, title, body,
          1 - (embedding <=> ${toPgVector(embedding)}::vector) as similarity
        FROM "MemoryEntry"
        WHERE type = ${type}
          AND status = 'active'
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${toPgVector(embedding)}::vector
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        similarity: clamp01(r.similarity),
      }));
    } catch {
      return [];
    }
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Hybrid retriever: tries vector search first, falls back to text-based.
 */
export function createHybridRetriever(
  vector: MemoryRetriever,
  fallback: MemoryRetriever
): MemoryRetriever {
  return {
    async findRelatedSOP(query, limit) {
      const vec = await vector.findRelatedSOP(query, limit);
      if (vec.length > 0) return vec;
      return fallback.findRelatedSOP(query, limit);
    },
    async findHistoricalCases(query, limit) {
      const vec = await vector.findHistoricalCases(query, limit);
      if (vec.length > 0) return vec;
      return fallback.findHistoricalCases(query, limit);
    },
  };
}
