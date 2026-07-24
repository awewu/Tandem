/**
 * PMS 认证与权限辅助 · orgId 双层隔离
 *
 * 设计:
 *   - PMS 主要使用方 = 经销商(外部), 必须严格 orgId 隔离
 *   - 内部角色: 可见全部 orgId (管理视角)
 *   - 外部 dealer_*: 仅可见本 orgId + 下级 orgId (二级经销商归属一级)
 *
 * 用法:
 *   const auth = await requirePmsAuth(req);
 *   // auth.visibleOrgIds = 该用户可见的 orgId 集合
 *   // 查询时: record.orgId ∈ auth.visibleOrgIds
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { hasInternalRole } from '@/lib/auth/roles';

export interface PmsAuthResult extends AuthContext {
  /** 可见的 orgId 集合 (含本 orgId + 下级 orgId) */
  visibleOrgIds: string[];
  /** 是否为内部角色 (内部全通, 外部受限) */
  isInternal: boolean;
  /** 是否为经销商角色 */
  isDealer: boolean;
  /** 所属组织 (经销商 orgId, 可能为 null) */
  orgId?: string | null;
}

/**
 * PMS 路由专用认证 (替代 requireAuth)
 *
 * 返回:
 *   - 内部角色: visibleOrgIds = 全部 (不限制)
 *   - 外部 dealer_*: visibleOrgIds = [本 orgId, ...下级 orgIds]
 *
 * 抛出 401/403 如果未登录或无权限
 */
export async function requirePmsAuth(req: NextRequest): Promise<PmsAuthResult> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) {
    throw auth; // 401 未登录
  }

  const isInternal = hasInternalRole(auth.roles);
  const isDealer = auth.roles.some((r: string) => r === 'dealer_sales' || r === 'dealer_admin');

  // 获取用户的 orgId (从 user 记录)
  const store = getStore();
  const user = await store.auth.users.findById(auth.userId);
  const userOrgId = user?.orgId || null;

  let visibleOrgIds: string[] = [];

  if (isInternal) {
    // 内部角色: 全部可见 (不限制, 返回空数组表示"全通")
    visibleOrgIds = [];
  } else if (isDealer && userOrgId) {
    // 外部经销商: 本 orgId + 下级 orgIds
    visibleOrgIds = await getVisibleOrgIdsForDealer(userOrgId, auth.tenantId);
  } else {
    // 其他外部角色 (guest/partner/contractor) 不可访问 PMS
    throw new Response('Forbidden: PMS access requires dealer role', { status: 403 });
  }

  return {
    ...auth,
    orgId: userOrgId,
    visibleOrgIds,
    isInternal,
    isDealer,
  };
}

/**
 * 获取经销商可见的 orgId 集合 (本 orgId + 下级 orgIds)
 *
 * 逻辑:
 *   - 一级经销商: 可见自己 + 所有归属自己的二级经销商
 *   - 二级经销商: 仅可见自己
 */
async function getVisibleOrgIdsForDealer(orgId: string, tenantId: string): Promise<string[]> {
  const store = getStore();
  const orgStore = store.organizations;

  const org = await orgStore.get(orgId);
  if (!org || org.tenantId !== tenantId) {
    return [orgId]; // 组织不存在, 仅返回本 orgId (安全降级)
  }

  // 查找所有 parentOrgId = orgId 的下游组织 (二级经销商)
  const allOrgs = await orgStore.list({ tenantId });
  const childOrgIds = allOrgs
    .filter((o) => o.parentOrgId === orgId && o.type === 'downstream')
    .map((o) => o.id);

  return [orgId, ...childOrgIds];
}

/**
 * 检查记录的 orgId 是否在可见范围内
 *
 * 用法:
 *   const auth = await requirePmsAuth(req);
 *   const record = await store.opportunities.findById(id);
 *   if (!canAccessRecord(auth, record)) {
 *     throw new Response('Forbidden', { status: 403 });
 *   }
 */
export function canAccessRecord(
  auth: PmsAuthResult,
  record: { orgId: string; tenantId: string }
): boolean {
  // tenantId 必须匹配
  if (record.tenantId !== auth.tenantId) return false;

  // 内部角色: 全通
  if (auth.isInternal) return true;

  // 外部角色: 检查 orgId 是否在可见集合中
  return auth.visibleOrgIds.includes(record.orgId);
}
