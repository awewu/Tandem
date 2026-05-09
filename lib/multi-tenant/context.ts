/**
 * Multi-Tenant Context · 多租户上下文
 *
 * V2 SaaS 启用. V1 单租户期使用 'default' tenantId.
 *
 * 用法:
 *   const ctx = await resolveTenantContext(req);
 *   const cards = await ctx.store.decisionCards.list();
 *
 * 设计:
 *   - 所有 API 路由通过 resolveTenantContext 解析当前租户
 *   - Store 接口增强: 自动注入 tenantId 到查询
 *   - 解析顺序: subdomain → header → JWT claim → 'default'
 */

import type { NextRequest } from 'next/server';
import type { TandemStore } from '../storage/repository';
import { getStore } from '../boot';

export interface TenantContext {
  tenantId: string;
  store: TandemStore;
  /** 当前用户 ID (从 session) */
  userId?: string;
  /** 当前用户角色 */
  roles: string[];
}

/**
 * 从 request 解析 tenant.
 *
 * 解析优先级:
 *   1. X-Tenant-ID header (内部 / 测试)
 *   2. subdomain (acme.tandem.app → 'acme')
 *   3. session.user.tenantId (NextAuth)
 *   4. 'default' (V1 单租户)
 */
export async function resolveTenantContext(req: NextRequest): Promise<TenantContext> {
  // 1. Header
  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant) {
    return makeContext(headerTenant);
  }

  // 2. Subdomain
  const host = req.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    return makeContext(subdomain);
  }

  // 3. Session (TODO: integrate NextAuth)
  // const session = await auth();
  // if (session?.user.tenantId) return makeContext(session.user.tenantId, session.user.id, session.user.roles);

  // 4. Default (V1)
  return makeContext('default');
}

function extractSubdomain(host: string): string | null {
  const parts = host.split('.');
  if (parts.length < 3) return null;
  return parts[0];
}

function makeContext(tenantId: string, userId?: string, roles: string[] = []): TenantContext {
  return {
    tenantId,
    store: getStore(), // V2: wrap with TenantScopedStore
    userId,
    roles,
  };
}

/**
 * 检查角色 / 权限
 */
export function requireRole(ctx: TenantContext, role: string): void {
  if (!ctx.roles.includes(role)) {
    throw new Error(`Forbidden: requires role ${role}`);
  }
}

export function requireAnyRole(ctx: TenantContext, roles: string[]): void {
  if (!roles.some((r) => ctx.roles.includes(r))) {
    throw new Error(`Forbidden: requires one of ${roles.join(', ')}`);
  }
}
