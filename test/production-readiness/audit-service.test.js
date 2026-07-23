const AuditService = require('../../server/modules/audit/audit.service');

describe('production audit service', () => {
  test('records tenant-scoped audit event through repository', async () => {
    const auditRepo = {
      create: jest.fn(async (scope, data) => ({ _id: 'audit-1', ...data }))
    };
    const service = new AuditService({ auditRepo });

    const result = await service.record(
      { tenantId: 'tenant-1', userId: 'user-1' },
      {
        action: 'lifecycle.project_state.update',
        resourceType: 'LifecycleLink',
        resourceId: 'CNT-001',
        after: { projectState: 'construction-in-progress' }
      }
    );

    expect(result).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      action: 'lifecycle.project_state.update',
      resourceType: 'LifecycleLink',
      resourceId: 'CNT-001'
    }));
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'lifecycle.project_state.update'
      })
    );
  });

  test('rejects missing tenant or incomplete audit event', async () => {
    const service = new AuditService({ auditRepo: { create: jest.fn() } });

    await expect(service.record({}, {
      action: 'x',
      resourceType: 'LifecycleLink'
    })).rejects.toThrow('tenantId is required for audit logging');

    await expect(service.record({ tenantId: 'tenant-1' }, {
      action: 'x'
    })).rejects.toThrow('audit action and resourceType are required');
  });

  test('memory mode lists only current tenant audit events', async () => {
    const memoryDb = {};
    const service = new AuditService({ memoryDb });

    await service.record(
      { tenantId: 'tenant-a', userId: 'user-a' },
      { action: 'lifecycle.handover.upsert', resourceType: 'LifecycleLink', resourceId: 'CNT-A' }
    );
    await service.record(
      { tenantId: 'tenant-b', userId: 'user-b' },
      { action: 'lifecycle.handover.upsert', resourceType: 'LifecycleLink', resourceId: 'CNT-B' }
    );

    const result = await service.list({ tenantId: 'tenant-a' }, { resourceType: 'LifecycleLink' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      tenantId: 'tenant-a',
      resourceId: 'CNT-A',
      storageMode: 'memory'
    }));
  });
});
