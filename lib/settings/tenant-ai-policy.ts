/**
 * TenantAiPolicy Service
 *
 * 企业 AI 使用治理:
 *   - 读写 tenant-level AI 策略 (allowPersonalAiTokens / 配额 / 白名单)
 *   - 校验员工个人AI 调用是否在策略允许范围内
 *   - 月度 token 用量追踪 (简版: 存 KV, 生产应换 Redis/PG 聚合)
 */

import { getStore } from '../storage/repository';
import {
  type TenantAiPolicy,
  DEFAULT_TENANT_AI_POLICY,
} from '../types/tenant-ai-policy';

/** 读取租户策略 (不存在时返回默认值, 不报错) */
export async function getTenantAiPolicy(tenantId: string): Promise<TenantAiPolicy> {
  const store = getStore();
  const all = await store.tenantAiPolicies.list();
  const existing = all.find((p) => p.tenantId === tenantId);
  if (existing) return existing;

  // 返回内存默认值 (未持久化, 首次 PUT 后才落库)
  const now = new Date().toISOString();
  return {
    id: `tap_${tenantId}`,
    tenantId,
    ...DEFAULT_TENANT_AI_POLICY,
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

/** 管理员更新策略 */
export async function upsertTenantAiPolicy(
  tenantId: string,
  patch: Partial<Omit<TenantAiPolicy, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  updatedBy: string,
): Promise<TenantAiPolicy> {
  const store = getStore();
  const all = await store.tenantAiPolicies.list();
  const existing = all.find((p) => p.tenantId === tenantId);
  const now = new Date().toISOString();

  if (existing) {
    return store.tenantAiPolicies.update(existing.id, {
      ...patch,
      updatedBy,
      updatedAt: now,
    } as never) as Promise<TenantAiPolicy>;
  }

  return store.tenantAiPolicies.create({
    id: `tap_${tenantId}_${Date.now().toString(36)}`,
    tenantId,
    ...DEFAULT_TENANT_AI_POLICY,
    ...patch,
    updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * 检查员工个人AI 调用是否被策略允许.
 *
 * 返回:
 *   { allowed: true }                   — 可以调用
 *   { allowed: false, reason: string }  — 被策略拦截
 */
export async function checkPersonalAiAllowed(
  tenantId: string,
  userId: string,
  requestedProvider?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = await getTenantAiPolicy(tenantId);

  // 1. 总开关
  if (!policy.allowPersonalAiTokens) {
    return {
      allowed: false,
      reason: '企业策略不允许个人AI 使用中央AI token，请联系管理员或配置个人 API key',
    };
  }

  // 2. Provider 白名单
  if (
    requestedProvider &&
    policy.personalAiProviderWhitelist.length > 0 &&
    !policy.personalAiProviderWhitelist.includes(requestedProvider)
  ) {
    return {
      allowed: false,
      reason: `provider "${requestedProvider}" 不在企业允许列表中，可用: ${policy.personalAiProviderWhitelist.join(', ')}`,
    };
  }

  // 3. 月度 token 配额 (简版: 读 KV 中的月度累计)
  if (policy.monthlyTokenBudgetPerUser && policy.monthlyTokenBudgetPerUser > 0) {
    const used = await getMonthlyTokenUsage(tenantId, userId);
    if (used >= policy.monthlyTokenBudgetPerUser) {
      return {
        allowed: false,
        reason: `本月个人AI token 配额已用完 (${used.toLocaleString()} / ${policy.monthlyTokenBudgetPerUser.toLocaleString()})，请联系管理员申请增额`,
      };
    }
  }

  return { allowed: true };
}

/** 记录 token 用量 (调用后写入) */
export async function recordTokenUsage(
  tenantId: string,
  userId: string,
  tokens: number,
): Promise<void> {
  const key = monthlyKey(tenantId, userId);
  const store = getStore();
  const all = await store.tenantAiPolicies.list();
  // 复用 KV — 用特殊 ID 存月度用量记录
  const usageRecord = all.find((r) => (r as unknown as { _usageKey?: string })._usageKey === key);
  const now = new Date().toISOString();

  if (usageRecord) {
    const prev = (usageRecord as unknown as { _tokens?: number })._tokens ?? 0;
    await store.tenantAiPolicies.update(usageRecord.id, {
      _tokens: prev + tokens,
      updatedAt: now,
    } as never);
  } else {
    await store.tenantAiPolicies.create({
      id: `usage_${key}`,
      tenantId,
      _usageKey: key,
      _tokens: tokens,
      _userId: userId,
      allowPersonalAiTokens: true,
      personalAiProviderWhitelist: [],
      updatedBy: 'system',
      createdAt: now,
      updatedAt: now,
    } as unknown as TenantAiPolicy);
  }
}

async function getMonthlyTokenUsage(tenantId: string, userId: string): Promise<number> {
  const key = monthlyKey(tenantId, userId);
  const store = getStore();
  const all = await store.tenantAiPolicies.list();
  const record = all.find((r) => (r as unknown as { _usageKey?: string })._usageKey === key);
  return (record as unknown as { _tokens?: number })?._tokens ?? 0;
}

function monthlyKey(tenantId: string, userId: string): string {
  const d = new Date();
  return `${tenantId}:${userId}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
