import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';

const CROSS_TENANT_ROLES = new Set(['platform_admin', 'hq_admin']);
const WRITE_ROLES = new Set(['platform_admin', 'hq_admin', 'brand_admin']);

export type ProductCatalogActor = Pick<JwtPayload, 'userId' | 'tenantId' | 'role'>;

export function resolveProductTenant(actor: ProductCatalogActor, requestedTenantId?: unknown): string {
  if (!actor?.tenantId) throw new ForbiddenException('缺少产品库租户上下文');
  const requested = typeof requestedTenantId === 'string' ? requestedTenantId.trim() : '';
  if (!requested || requested === actor.tenantId) return actor.tenantId;
  if (CROSS_TENANT_ROLES.has(actor.role)) return requested;
  throw new ForbiddenException('不可跨品牌租户访问产品库');
}

export function requireProductWrite(actor: ProductCatalogActor): void {
  if (!WRITE_ROLES.has(actor?.role)) throw new ForbiddenException('当前角色无权维护产品库');
}
