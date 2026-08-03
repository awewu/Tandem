import { ContractsService } from './contracts.service';

const mockRepo = () => ({
  create: jest.fn((row) => row),
  save: jest.fn(async (row) => ({ id: 'ct-1', ...row })),
  findOne: jest.fn(async () => null),
  createQueryBuilder: jest.fn(() => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => []),
    };
    return qb;
  }),
});

const mockEm = () => ({
  getRepository: jest.fn(() => mockRepo()),
});

const mockDs = () => ({
  transaction: jest.fn(async (cb: any) => cb(mockEm())),
}) as any;

const user = {
  userId: 'u1',
  tenantId: 't1',
  dealerId: 'd1',
  role: 'dealer_admin',
} as any;

describe('ContractsService', () => {
  let svc: ContractsService;

  beforeEach(() => {
    svc = new ContractsService(mockDs());
  });

  it('creates a contract from quotation', async () => {
    const result = await svc.createFromQuotation(user, {
      customerId: 'c1',
      quotationId: 'q1',
      totalAmount: 50000,
    });
    expect(result.contractNo).toContain('CT-');
    expect(result.customerId).toBe('c1');
    expect(result.quotationId).toBe('q1');
  });

  it('throws BadRequestException when customerId is missing', async () => {
    await expect(svc.createFromQuotation(user, {})).rejects.toThrow('customerId is required');
  });

  it('lists contracts with filters', async () => {
    const result = await svc.list(user, { status: 'draft', customerId: 'c1' });
    expect(result).toEqual([]);
  });

  it('throws NotFoundException for unknown contractNo', async () => {
    await expect(svc.getByContractId(user, 'NOPE')).rejects.toThrow('contract not found');
  });

  it('marks a contract as signed', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'pending_signature', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    const result = await svc.markSigned(user, 'CT-1', { method: 'portal' });
    expect(result.status).toBe('signed');
    expect(result.signedAt).toBeInstanceOf(Date);
  });

  it('throws ConflictException when signing a pending_approval contract', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'pending_approval', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    await expect(svc.markSigned(user, 'CT-1', {})).rejects.toThrow('contract approval is required before signature');
  });

  it('decides approval — approved moves to pending_signature', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'pending_approval', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    const result = await svc.decideApproval(user, 'CT-1', { decision: 'approved' });
    expect(result.status).toBe('pending_signature');
  });

  it('decides approval — rejected moves to voided', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'pending_approval', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    const result = await svc.decideApproval(user, 'CT-1', { decision: 'rejected' });
    expect(result.status).toBe('voided');
  });

  it('records a payment', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({
      id: 'ct-1', contractNo: 'CT-1', status: 'signed',
      terms: { paymentSchedule: [{ key: 'deposit', amount: 15000, paidAmount: 0 }] },
    }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    const result = await svc.recordPayment(user, 'CT-1', { amount: 5000 });
    expect(result.terms.lastPayment.amount).toBe(5000);
  });

  it('throws BadRequestException for zero payment', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'signed', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    await expect(svc.recordPayment(user, 'CT-1', { amount: 0 })).rejects.toThrow('payment amount must be greater than zero');
  });

  it('starts delivery on a signed contract', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'signed', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    const result = await svc.startDelivery(user, 'CT-1', { projectAddress: '123 Main St' });
    expect(result.status).toBe('delivery_started');
  });

  it('throws ConflictException when starting delivery on draft contract', async () => {
    const ds = mockDs();
    const repo = mockRepo();
    repo.findOne = jest.fn(async () => ({ id: 'ct-1', contractNo: 'CT-1', status: 'draft', terms: {} }));
    ds.transaction = jest.fn(async (cb: any) => cb({ getRepository: () => repo }));
    svc = new ContractsService(ds);

    await expect(svc.startDelivery(user, 'CT-1', {})).rejects.toThrow('contract must be signed before delivery can start');
  });
});
