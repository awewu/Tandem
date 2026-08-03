import { AuditEventsController, AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

const mockUser = { userId: 'u1', tenantId: 't1', role: 'platform_admin' } as any;

const mockService = () => ({
  list: jest.fn(async () => ({ logs: [], total: 0, page: 1, limit: 100 })),
}) as any;

describe('AuditLogController', () => {
  it('delegates list to service', async () => {
    const svc = mockService();
    const ctrl = new AuditLogController(svc);
    const result = await ctrl.list({ user: mockUser }, { page: '1', limit: '50' });
    expect(svc.list).toHaveBeenCalledWith(mockUser, { page: '1', limit: '50' });
    expect(result.total).toBe(0);
  });
});

describe('AuditEventsController', () => {
  it('delegates events to service.list (alias)', async () => {
    const svc = mockService();
    const ctrl = new AuditEventsController(svc);
    const result = await ctrl.events({ user: mockUser }, { action: 'contract.created_from_quotation' });
    expect(svc.list).toHaveBeenCalledWith(mockUser, { action: 'contract.created_from_quotation' });
    expect(result.logs).toEqual([]);
  });

  it('passes through pagination query params', async () => {
    const svc = mockService();
    const ctrl = new AuditEventsController(svc);
    await ctrl.events({ user: mockUser }, { page: '2', limit: '25', search: 'contract' });
    expect(svc.list).toHaveBeenCalledWith(mockUser, { page: '2', limit: '25', search: 'contract' });
  });
});
