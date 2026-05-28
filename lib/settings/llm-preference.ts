/**
 * LLM Preference Service
 *
 * 负责读写 中央AI / 个人AI 的模型偏好, 并向 router.chat 注入 forceProvider.
 */

import { getStore } from '../storage/repository';
import type { LlmPreference } from '../types/llm-preference';
import { resolveProvider } from '../types/llm-preference';
import type { ScenarioTag } from '../taf/provider/types';

/** 获取租户级 (中央AI) 偏好 */
export async function getTenantPreference(tenantId: string): Promise<LlmPreference | null> {
  const store = getStore();
  const all = await store.llmPreferences.list();
  return all.find((p) => p.scope === 'tenant' && p.tenantId === tenantId) ?? null;
}

/** 获取员工级 (个人AI) 偏好 */
export async function getUserPreference(
  userId: string,
  tenantId: string,
): Promise<LlmPreference | null> {
  const store = getStore();
  const all = await store.llmPreferences.list();
  return (
    all.find((p) => p.scope === 'user' && p.userId === userId && p.tenantId === tenantId) ?? null
  );
}

/** 解析最终使用的 provider 名 (供 IM/Persona/议事室调用前 lookup) */
export async function resolveProviderForUser(
  userId: string,
  tenantId: string,
  scenario?: ScenarioTag,
): Promise<string | null> {
  const [user, tenant] = await Promise.all([
    getUserPreference(userId, tenantId),
    getTenantPreference(tenantId),
  ]);
  return resolveProvider(scenario, user, tenant);
}

export interface UpsertPreferenceInput {
  scope: 'tenant' | 'user';
  userId: string | null;
  tenantId: string;
  byScenario?: Partial<Record<ScenarioTag, string>>;
  defaultProvider?: string;
  updatedBy: string;
}

/** 创建或更新偏好 (幂等, 同 scope+userId+tenantId 唯一) */
export async function upsertPreference(input: UpsertPreferenceInput): Promise<LlmPreference> {
  const store = getStore();
  const all = await store.llmPreferences.list();
  const existing = all.find(
    (p) => p.scope === input.scope && p.userId === input.userId && p.tenantId === input.tenantId,
  );

  const now = new Date().toISOString();

  if (existing) {
    return store.llmPreferences.update(existing.id, {
      byScenario: input.byScenario ?? existing.byScenario,
      defaultProvider: input.defaultProvider ?? existing.defaultProvider,
      updatedBy: input.updatedBy,
      updatedAt: now,
    } as never) as Promise<LlmPreference>;
  }

  return store.llmPreferences.create({
    id: generateId(),
    scope: input.scope,
    userId: input.userId,
    tenantId: input.tenantId,
    byScenario: input.byScenario ?? {},
    defaultProvider: input.defaultProvider,
    updatedBy: input.updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}

function generateId(): string {
  return `llmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
