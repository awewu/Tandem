/**
 * Tenant / Workspace Context Resolution
 *
 * Middleware injects x-tandem-* headers. This layer resolves the effective
 * tenant and workspace for the current request.
 *
 * Migration path:
 *   - V1 (single-tenant): tenantId = "default", workspaceId = null
 *   - V2 (SaaS): tenantId derived from workspace, workspaceId = actual workspace
 */

import { type NextRequest } from 'next/server';

export interface TenantContext {
  tenantId: string;
  workspaceId?: string;
}

/**
 * Extract tenant/workspace from middleware-injected headers.
 */
export function resolveTenant(req: NextRequest): TenantContext {
  const tenantId = req.headers.get('x-tandem-tenant-id') || 'default';
  const workspaceId = req.headers.get('x-tandem-workspace-id') || undefined;
  return { tenantId, workspaceId };
}

/**
 * Prisma WHERE clause helper: inject tenant filter into queries.
 */
export function tenantWhere<T extends Record<string, unknown>>(
  base: T,
  tenantId: string
): T & { tenantId: string } {
  return { ...base, tenantId };
}

/**
 * Prisma WHERE clause helper for workspace-scoped resources.
 * If workspaceId is provided, filters by workspace; otherwise falls back to tenant.
 */
export function workspaceWhere<T extends Record<string, unknown>>(
  base: T,
  tenantId: string,
  workspaceId?: string
): T & { tenantId: string } & ({ workspaceId: string } | {}) {
  if (workspaceId) {
    return { ...base, tenantId, workspaceId } as any;
  }
  return { ...base, tenantId } as any;
}
