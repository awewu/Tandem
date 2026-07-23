import { DataSource, EntityManager } from 'typeorm';
import { getTenantScope, TenantScope } from './tenant-context';

/**
 * Runs `work` inside a transaction whose PostgreSQL session is bound to the
 * current tenant scope, so Row Level Security policies (tenant_id =
 * current_tenant_id()) actually isolate data at the database layer.
 *
 * Uses set_config(name, value, is_local => true) which is exactly `SET LOCAL`
 * but parameterized — the tenant/actor ids are bound as parameters, never string
 * -interpolated, so this is injection-safe even though GUC names can't be params.
 *
 * The GUCs (app.tenant_id / app.actor_id) are read by the migration functions
 * rhautt_nexus.current_tenant_id() / current_actor_id().
 */
export async function withRlsTransaction<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
  scopeOverride?: TenantScope,
): Promise<T> {
  const scope = scopeOverride ?? getTenantScope();
  if (!scope?.tenantId) {
    throw new Error('withRlsTransaction requires a tenant scope (tenantId).');
  }
  return dataSource.transaction(async (manager) => {
    await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', scope.tenantId]);
    if (scope.actorId) {
      await manager.query('SELECT set_config($1, $2, true)', ['app.actor_id', scope.actorId]);
    }
    return work(manager);
  });
}
