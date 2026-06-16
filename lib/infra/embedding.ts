/**
 * Embedding Service · 文本向量化
 *
 * 配置优先级 (高 → 低):
 *   1. DB AiSettings (Admin UI 热更新)
 *   2. 环境变量 EMBEDDING_PROVIDER / MODEL / API_URL / API_KEY
 *
 * 未配置时: isEmbeddingConfigured() → false, 调用方降级到 Jaccard.
 * 缓存: 同一文本 LRU 缓存 1000 条, 避免 baseline-guard 频繁调用.
 */

import { logger } from './logger';

const cache = new Map<string, number[]>();
const MAX_CACHE = 1000;

async function resolveEmbedConfig(): Promise<{
  provider: string;
  model: string;
  url: string;
  apiKey: string | undefined;
}> {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings();
    const provider = s.embeddingProvider ?? process.env.EMBEDDING_PROVIDER ?? 'none';
    const model = s.embeddingModel ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
    const url = s.embeddingApiUrl ?? process.env.EMBEDDING_API_URL ?? 'https://api.openai.com/v1/embeddings';
    const apiKey = s.embeddingApiKey ?? process.env.EMBEDDING_API_KEY;
    return { provider, model, url, apiKey };
  } catch {
    return {
      provider: process.env.EMBEDDING_PROVIDER ?? 'none',
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
      url: process.env.EMBEDDING_API_URL ?? 'https://api.openai.com/v1/embeddings',
      apiKey: process.env.EMBEDDING_API_KEY,
    };
  }
}

export async function isEmbeddingConfigured(): Promise<boolean> {
  const { provider } = await resolveEmbedConfig();
  return provider !== 'none';
}

export async function embed(text: string): Promise<number[] | null> {
  const cfg = await resolveEmbedConfig();
  if (cfg.provider === 'none') return null;
  const key = (text ?? '').slice(0, 4000);
  if (!key.trim()) return null;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const provider = cfg.provider;
    const model = cfg.model;
    const url = cfg.url;
    const apiKey = cfg.apiKey;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider !== 'ollama' && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const body =
      provider === 'ollama'
        ? JSON.stringify({ model, prompt: key })
        : JSON.stringify({ model, input: key, encoding_format: 'float' });

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      logger.warn({ status: res.status }, '[embed] http error');
      return null;
    }
    const data = await res.json();
    const vector: number[] | undefined =
      provider === 'ollama' ? data.embedding : data.data?.[0]?.embedding;
    if (!Array.isArray(vector)) return null;

    // LRU evict
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, vector);
    return vector;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[embed] failed');
    return null;
  }
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  const denom = Math.sqrt(aNorm) * Math.sqrt(bNorm);
  return denom === 0 ? 0 : dot / denom;
}
