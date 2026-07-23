/**
 * D4 归属过滤（dealer / store）。
 *
 * 背景：PostgreSQL RLS 策略仅按租户隔离（tenant_id = current_tenant_id()），
 * 但 D4 的权限键是 tenant+dealer+store+role（governance/permission-domains.json）。
 * 因此所有「按 id」的读写必须在应用层，在 tenant 谓词之上再叠加 dealer/store 谓词，
 * 否则同一租户内 A 经销商可通过 id 读/写 B 经销商的客户、商机、报价、合同、设计
 * （横向越权 / IDOR）。
 *
 * 语义与各模块 list 方法保持一致：
 *  - 门店级用户（有 storeId）：按 store 收敛（仅当目标实体有 store_id 列）；
 *  - 经销商级用户（有 dealerId）：按 dealer 收敛；
 *  - 总部 / 平台（无 dealerId / storeId）：保持租户级可见（不额外收敛）。
 *
 * 对没有 store_id 列的实体（合同 / 设计），门店级用户退化为 dealer 级过滤——
 * dealer 隔离仍然成立。
 */
export interface OwnershipScopeUser {
  dealerId?: string | null;
  storeId?: string | null;
}

export function ownershipScope(
  user: OwnershipScopeUser,
  opts: { hasStore?: boolean } = {},
): { dealerId?: string; storeId?: string } {
  if (opts.hasStore && user.storeId) return { storeId: user.storeId };
  if (user.dealerId) return { dealerId: user.dealerId };
  return {};
}
