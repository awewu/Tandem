import type { UserRole } from '../auth/auth.entity';

/**
 * Sprint 5.2 · BIM 角色阶梯（W-BIM-5）
 *
 * 角色与信任状态的最小权限对应：
 *   - sales（销售）           → 只能提交 estimate，用于快速报价
 *   - engineer（技术支持）    → 可将 estimate 提升为 verified
 *   - designer（设计师）      → 可处理 insufficient_data 并产出 verified 方案
 *
 * 该映射是设计信任状态机的一部分；真实权限还受订阅模块与数据归属（RLS）约束。
 */

export type BimTrustState = 'unverified' | 'estimate' | 'verified' | 'insufficient_data';

export const BIM_ROLE_TRUST_STATE: Record<UserRole, BimTrustState[]> = {
  platform_admin: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  hq_admin: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  brand_admin: [],
  regional_manager: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  dealer_admin: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  store_manager: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  designer: ['unverified', 'estimate', 'verified', 'insufficient_data'],
  sales: ['estimate'],
  engineer: ['estimate', 'verified'],
  installer: ['verified'],
  customer: ['estimate'],
};

export function canAccessTrustState(role: UserRole, state: BimTrustState): boolean {
  return BIM_ROLE_TRUST_STATE[role]?.includes(state) ?? false;
}

export function maxTrustState(role: UserRole): BimTrustState {
  const states = BIM_ROLE_TRUST_STATE[role] ?? [];
  if (states.includes('verified')) return 'verified';
  if (states.includes('estimate')) return 'estimate';
  return 'unverified';
}

/**
 * 角色阶梯语义：
 *   sales      → 只给出 estimate，不能提升信任等级
 *   engineer   → 可基于 estimate 做 verified 确认
 *   designer   → 拥有全部状态，包括 insufficient_data 兜底/拒绝默认值
 */
export const ROLE_LADDER = {
  sales: { canCreate: ['estimate'], canPromote: [] },
  engineer: { canCreate: ['estimate'], canPromote: ['verified'] },
  designer: { canCreate: ['estimate', 'verified', 'insufficient_data'], canPromote: ['verified'] },
} as const;
