import { EntityManager } from 'typeorm';
import { AuditLogEntity } from '../governance/governance.entity';

/**
 * 统一审计写入（在租户绑定事务内调用，满足各模块 module-boundary 的 requiresAuditLog 契约）。
 * 关键治理/审批/合规动作必须落审计：谁、对什么、做了什么、前后态。
 */
export async function writeAudit(
  manager: EntityManager,
  entry: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    beforeState?: unknown;
    afterState?: unknown;
  },
): Promise<void> {
  const repo = manager.getRepository(AuditLogEntity);
  await repo.save(repo.create({
    tenantId: entry.tenantId,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    beforeState: (entry.beforeState ?? null) as any,
    afterState: (entry.afterState ?? null) as any,
    requestId: null,
    traceId: null,
    ipHash: null,
  }));
}
