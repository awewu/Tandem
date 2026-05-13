/**
 * Memory Retriever · 知识检索
 *
 * V1: 简单文本相似 (无 embedding 依赖, 可立即跑)
 * V2+: pgvector + 多模型 embedding (DeepSeek-Embed / BGE / Qwen-Embed)
 *
 * 实现 DecisionEngine 的 MemoryRetriever 接口.
 */

import type { MemoryRetriever, MemorySearchResult } from '../convergence/decision-engine';
import { getStore } from '../storage/repository';
import type { MemoryEntry, Material } from '../types/memory';
import {
  VectorMemoryRetriever,
  createHybridRetriever,
  isVectorSearchAvailable,
} from './vector-retriever';
import { embedMaterial, embedMemoryEntry } from './vector-retriever';

// ---------------------------------------------------------------------------
// Tokenization (中英文混合简单分词)
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  // 中文按字, 英文/数字按词
  const tokens: string[] = [];
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push((m[1] ?? m[2]).toLowerCase());
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// 相似度算法 (Jaccard + TF 加权)
// ---------------------------------------------------------------------------

function similarity(query: string, doc: string): number {
  const q = new Set(tokenize(query));
  const d = tokenize(doc);
  if (q.size === 0 || d.length === 0) return 0;

  // 计算 query 中有多少 token 出现在 doc, 加权 doc 长度归一
  let hits = 0;
  for (const tok of d) {
    if (q.has(tok)) hits++;
  }
  const docTokens = new Set(d);
  const qArr = Array.from(q);
  const intersection = qArr.filter((t) => docTokens.has(t)).length;
  const union = new Set(qArr.concat(Array.from(docTokens))).size;
  const jaccard = intersection / union;
  const tf = hits / d.length;

  // 平滑加权
  return Math.min(1, jaccard * 0.6 + tf * 4);
}

// ---------------------------------------------------------------------------
// Store-backed retriever (V1)
// ---------------------------------------------------------------------------

export class StoreBackedMemoryRetriever implements MemoryRetriever {
  async findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]> {
    const store = getStore();
    const all = await store.memories.list();
    const sops = all.filter(
      (m: MemoryEntry) => m.type === 'sop' && m.status === 'active'
    );
    return rank(sops, query, limit);
  }

  async findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]> {
    const store = getStore();
    const all = await store.memories.list();
    const cases = all.filter(
      (m: MemoryEntry) => m.type === 'case' && m.status === 'active'
    );
    return rank(cases, query, limit);
  }
}

function rank(entries: MemoryEntry[], query: string, limit: number): MemorySearchResult[] {
  const scored = entries.map((e) => ({
    id: e.id,
    title: e.title,
    body: e.body,
    similarity: Math.max(
      similarity(query, e.title) * 1.5,
      similarity(query, e.body)
    ),
  }));
  return scored
    .filter((s) => s.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Composite retriever (材料 + 记忆混合, V2 升级)
// ---------------------------------------------------------------------------

export interface MaterialMatch extends MemorySearchResult {
  source: 'material';
}
export interface MemoryMatch extends MemorySearchResult {
  source: 'memory';
}

export class CompositeRetriever implements MemoryRetriever {
  private hybrid: MemoryRetriever;
  private vector: VectorMemoryRetriever | null = null;

  constructor() {
    const fallback = new StoreBackedMemoryRetriever();
    const vector = new VectorMemoryRetriever();
    this.vector = vector;
    // Lazy-init hybrid: vector search if available, else pure text fallback
    this.hybrid = fallback;
    isVectorSearchAvailable().then((ok) => {
      if (ok) {
        this.hybrid = createHybridRetriever(vector, fallback);
      }
    }).catch(() => { /* keep fallback */ });
  }

  async findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]> {
    return this.hybrid.findRelatedSOP(query, limit);
  }

  async findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]> {
    return this.hybrid.findHistoricalCases(query, limit);
  }

  async search(query: string, limit = 5): Promise<(MaterialMatch | MemoryMatch)[]> {
    // Search memories via hybrid retriever
    const memResults = await this.hybrid.findRelatedSOP(query, limit).catch(() => []);
    const caseResults = await this.hybrid.findHistoricalCases(query, limit).catch(() => []);

    // Search materials via vector if available, else text fallback
    let matMatches: MaterialMatch[] = [];
    if (this.vector) {
      const vecMats = await this.vector.findRelatedMaterials(query, limit).catch(() => []);
      if (vecMats.length) {
        matMatches = vecMats.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          similarity: r.similarity,
          source: 'material' as const,
        }));
      }
    }

    // Text fallback for materials if vector returned nothing
    if (matMatches.length === 0) {
      const store = getStore();
      const materials = await store.materials.list().catch(() => [] as Material[]);
      matMatches = materials.map((m: Material) => ({
        id: m.id,
        title: m.title,
        body: serializeBody(m.body),
        similarity:
          Math.max(similarity(query, m.title) * 1.5, similarity(query, serializeBody(m.body))) * 0.85,
        source: 'material' as const,
      }));
    }

    const memMatches = [...memResults, ...caseResults].map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      similarity: r.similarity,
      source: 'memory' as const,
    }));

    return [...matMatches, ...memMatches]
      .filter((s) => s.similarity > 0.05)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

function serializeBody(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}
