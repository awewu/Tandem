/**
 * TenantAiPolicy · 企业 AI 使用治理策略
 *
 * 管理员通过此策略控制:
 *   1. 员工个人AI 是否允许调用中央AI token (allowPersonalAiTokens)
 *   2. 中央AI 每用户每月 token 配额 (monthlyTokenBudgetPerUser)
 *   3. 个人AI 调用是否锁定只能选公司已审批的 provider 白名单
 */

export interface TenantAiPolicy {
  id: string;
  tenantId: string;

  /**
   * 是否允许员工个人AI 场景消耗中央AI (tenant) 的 token 配额.
   *
   * true  (默认): 员工个人AI 调用时, 若个人无 key, 自动 fallback 到中央AI provider.
   * false:        员工个人AI 只能使用自己配置的 provider; 中央AI 仅用于企业级业务
   *               (议事室 / Memory / 自动复盘 等服务端场景).
   */
  allowPersonalAiTokens: boolean;

  /**
   * 中央AI 每用户每自然月最大 token 数 (inputTokens + outputTokens 合计).
   * 0 或 undefined = 不限额.
   * 仅在 allowPersonalAiTokens=true 时生效.
   */
  monthlyTokenBudgetPerUser?: number;

  /**
   * 员工个人AI 允许调用的 provider 白名单.
   * 空数组 = 不限制 (任何已注册 provider 均可).
   * 配置后, 员工在个人AI 设置里只能选白名单内的 provider.
   */
  personalAiProviderWhitelist: string[];

  /**
   * 中央AI 旗舰 provider 名称 (只读展示用, 实际由 llmPreferences scope=tenant 驱动).
   * 例: 'claude-opus-4-5'
   */
  centralAiFlagshipProvider?: string;

  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 默认策略 (新租户) */
export const DEFAULT_TENANT_AI_POLICY: Omit<TenantAiPolicy, 'id' | 'tenantId' | 'updatedBy' | 'createdAt' | 'updatedAt'> = {
  allowPersonalAiTokens: true,
  monthlyTokenBudgetPerUser: 500_000,   // 50 万 token/人/月 (企业默认)
  personalAiProviderWhitelist: [],       // 不限制
  centralAiFlagshipProvider: 'claude-opus-4-5',
};
