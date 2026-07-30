import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';

const CROSS_TENANT_ROLES = new Set(['platform_admin', 'hq_admin']);
const WRITE_ROLES = new Set(['platform_admin', 'hq_admin', 'brand_admin']);
const WRITE_PERMISSIONS = new Set(['product.catalog.create', 'product.catalog.update', 'product.catalog.delete', 'product.catalog.publish']);
const PRODUCT_TENANT_PERMISSIONS = new Set([
  'product.catalog.view',
  'product.catalog.read',
  'product.catalog.create',
  'product.catalog.update',
  'product.catalog.delete',
  'product.catalog.publish',
  'product.content.read',
  'product.content.create',
  'product.content.update',
  'product.content.delete',
]);

export type ProductCatalogActor = Pick<JwtPayload, 'userId' | 'tenantId' | 'role'> & { permissions?: string[] };

export function resolveProductTenant(actor: ProductCatalogActor, requestedTenantId?: unknown): string {
  if (!actor?.tenantId) throw new ForbiddenException('缺少产品库租户上下文');
  const requested = typeof requestedTenantId === 'string' ? requestedTenantId.trim() : '';
  if (!requested || requested === actor.tenantId) return actor.tenantId;
  if (CROSS_TENANT_ROLES.has(actor.role)) return requested;
  const permissions = new Set(actor.permissions ?? []);
  if (permissions.has('*') || [...PRODUCT_TENANT_PERMISSIONS].some(permission => permissions.has(permission))) return requested;
  throw new ForbiddenException('不可跨品牌租户访问产品库');
}

export function requireProductPermission(actor: ProductCatalogActor, permission: string): void {
  if (WRITE_ROLES.has(actor?.role)) return;
  const permissions = new Set(actor?.permissions ?? []);
  if (permissions.has('*') || permissions.has(permission)) return;
  throw new ForbiddenException('current account lacks the required permission');
}

export function requireProductWrite(actor: ProductCatalogActor): void {
  if (WRITE_ROLES.has(actor?.role)) return;
  const permissions = new Set(actor?.permissions ?? []);
  if (permissions.has('*') || [...WRITE_PERMISSIONS].some(permission => permissions.has(permission))) return;
  throw new ForbiddenException('当前角色无权维护产品库');
}
