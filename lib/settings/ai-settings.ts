/**
 * AI Settings Service
 *
 * 读取优先级 (高 → 低):
 *   1. DB KvStore (aiSettings collection) — Admin UI 写入, 热更新无需重启
 *   2. 环境变量 (.env / process.env) — 初次部署兜底
 *
 * getAiSettings() 返回合并后的完整配置, 供 boot.ts / embedding.ts 消费.
 */

import { getStore } from '../storage/repository';
import type { AiSettings, AiSettingsPatch } from '../types/ai-settings';

const DEFAULT_TENANT = 'default';

function env(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

/** 从环境变量构造兜底配置 (未配置字段为 undefined) */
function fromEnv(): Partial<AiSettings> {
  return {
    deepseekApiKey: env('DEEPSEEK_API_KEY'),
    deepseekBaseUrl: env('DEEPSEEK_BASE_URL'),
    deepseekModel: env('DEEPSEEK_MODEL'),
    deepseekR1Model: env('DEEPSEEK_R1_MODEL'),
    anthropicApiKey: env('ANTHROPIC_API_KEY'),
    anthropicBaseUrl: env('ANTHROPIC_BASE_URL'),
    anthropicModel: env('ANTHROPIC_MODEL'),
    qwenApiKey: env('QWEN_API_KEY'),
    qwenBaseUrl: env('QWEN_BASE_URL'),
    qwenModel: env('QWEN_MODEL'),
    doubaoApiKey: env('DOUBAO_API_KEY'),
    doubaoBaseUrl: env('DOUBAO_BASE_URL'),
    doubaoModel: env('DOUBAO_MODEL'),
    kimiApiKey: env('KIMI_API_KEY'),
    kimiBaseUrl: env('KIMI_BASE_URL'),
    kimiModel: env('KIMI_MODEL'),
    hermesBaseUrl: env('HERMES_BASE_URL') ?? env('OLLAMA_BASE_URL'),
    hermesModel: env('HERMES_MODEL'),
    embeddingProvider: (env('EMBEDDING_PROVIDER') as AiSettings['embeddingProvider']) ?? 'none',
    embeddingModel: env('EMBEDDING_MODEL'),
    embeddingApiUrl: env('EMBEDDING_API_URL'),
    embeddingApiKey: env('EMBEDDING_API_KEY'),
    tavilyApiKey: env('TAVILY_API_KEY'),
    braveSearchApiKey: env('BRAVE_SEARCH_API_KEY'),
    smtpHost: env('SMTP_HOST'),
    smtpPort: env('SMTP_PORT'),
    imapPort: env('IMAP_PORT'),
    smtpUser: env('SMTP_USER'),
    smtpPass: env('SMTP_PASS'),
    smtpFrom: env('SMTP_FROM'),
    smtpSecure: env('SMTP_SECURE'),
  };
}

/** 读取 DB 中存储的配置 (不存在返回 null) */
async function fromDb(tenantId = DEFAULT_TENANT): Promise<AiSettings | null> {
  try {
    const store = getStore();
    const all = await store.aiSettings.list();
    return all.find((s) => s.tenantId === tenantId) ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取合并后的 AI 配置 (DB 覆盖 env).
 * 任何字段: DB 有值则用 DB, 否则 fallback 到 env.
 */
export async function getAiSettings(tenantId = DEFAULT_TENANT): Promise<Partial<AiSettings>> {
  const base = fromEnv();
  const db = await fromDb(tenantId);
  if (!db) return base;

  const merged: Partial<AiSettings> = { ...base };
  for (const key of Object.keys(db) as (keyof AiSettings)[]) {
    const v = db[key];
    if (v !== undefined && v !== null && v !== '') {
      (merged as Record<string, unknown>)[key] = v;
    }
  }
  return merged;
}

/** 管理员写入 (upsert) */
export async function upsertAiSettings(
  patch: AiSettingsPatch,
  updatedBy: string,
  tenantId = DEFAULT_TENANT,
): Promise<AiSettings> {
  const store = getStore();
  const all = await store.aiSettings.list();
  const existing = all.find((s) => s.tenantId === tenantId);
  const now = new Date().toISOString();

  if (existing) {
    return store.aiSettings.update(existing.id, {
      ...patch,
      updatedBy,
      updatedAt: now,
    } as never) as Promise<AiSettings>;
  }

  return store.aiSettings.create({
    id: `ais_${tenantId}_${Date.now().toString(36)}`,
    tenantId,
    ...patch,
    updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * 脱敏: 把 key 字段替换成 "sk-****xxxx" 格式, 供前端展示.
 * 不传出真实 key.
 */
export function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return key ? '******' : '';
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

/** 将完整 AiSettings 脱敏后返回 (用于 GET API 响应) */
export function maskAiSettings(s: Partial<AiSettings>): Partial<AiSettings> {
  const KEY_FIELDS: (keyof AiSettings)[] = [
    'deepseekApiKey', 'anthropicApiKey', 'qwenApiKey',
    'doubaoApiKey', 'kimiApiKey', 'embeddingApiKey',
    'tavilyApiKey', 'braveSearchApiKey', 'smtpPass',
  ];
  const out = { ...s };
  for (const f of KEY_FIELDS) {
    if (out[f]) {
      (out as Record<string, unknown>)[f] = maskKey(out[f] as string);
    }
  }
  return out;
}
