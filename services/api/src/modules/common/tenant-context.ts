import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant scope propagated via AsyncLocalStorage so any code in
 * the async call tree (services, repositories) can read the current tenant/actor
 * without threading it through every function signature. Populated by
 * TenantContextInterceptor from the authenticated JWT (after AuthGuard).
 */
export interface TenantScope {
  tenantId: string;
  actorId?: string;
  role?: string;
}

const storage = new AsyncLocalStorage<TenantScope>();

export function runWithTenantScope<T>(scope: TenantScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function getTenantScope(): TenantScope | undefined {
  return storage.getStore();
}

export function requireTenantScope(): TenantScope {
  const scope = storage.getStore();
  if (!scope?.tenantId) {
    throw new Error('No tenant scope in context — a tenant-scoped operation ran outside an authenticated request.');
  }
  return scope;
}
