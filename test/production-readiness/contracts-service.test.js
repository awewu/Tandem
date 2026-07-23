const ContractsService = require('../../server/modules/contracts/contracts.service');

function makeScope(overrides = {}) {
  return {
    tenantId: '64f000000000000000000201',
    dealerId: '64f000000000000000000301',
    storeId: '64f000000000000000000401',
    userId: '64f000000000000000000101',
    ...overrides
  };
}

function makeQuote(overrides = {}) {
  return {
    _id: '64f000000000000000000901',
    tenantId: '64f000000000000000000201',
    dealerId: '64f000000000000000000301',
    storeId: '64f000000000000000000401',
    customerId: '64f000000000000000000501',
    opportunityId: '64f000000000000000000601',
    quotationNo: 'Q2-000201-20260606100000-900001',
    revision: 2,
    source: 'designer-bom',
    project: {
      name: '上海中央热水+全空气',
      city: '上海',
      address: '浦东新区',
      area: 168
    },
    systemFamilies: ['hot_water', 'air', 'fresh_air', 'smart_control'],
    costBreakdown: {
      directCost: 180000,
      customerTotal: 268000,
      dealerMargin: 68000,
      monthlyPayment: 7444
    },
    marginGuard: {
      status: 'pass',
      minMarginRate: 0.15,
      targetMarginRate: 0.22,
      quoteFloor: 211765,
      adjustment: 0
    },
    lifecycleHandoff: {
      iotBridgeKey: 'bridge-quote-001',
      servicePlanCode: 'CARE-5Y'
    },
    deliverables: {
      quotePdfUrl: '/exports/quote.pdf'
    },
    ...overrides
  };
}

function makeService(overrides = {}) {
  const state = {
    contracts: [],
    quoteUpdates: [],
    audits: [],
    outbox: [],
    lifecyclePayloads: []
  };

  const contractRepo = {
    create: jest.fn(async (scope, payload) => {
      const item = {
        _id: `contract-${state.contracts.length + 1}`,
        ...payload,
        createdAt: '2026-06-06T10:00:00.000Z',
        updatedAt: '2026-06-06T10:00:00.000Z'
      };
      state.contracts.push(item);
      return item;
    }),
    findOne: jest.fn(async (scope, query) => {
      return state.contracts.find(item => (
        String(item.tenantId) === String(scope.tenantId) &&
        (!query.contractNo || item.contractNo === query.contractNo)
      )) || null;
    }),
    list: jest.fn(async (scope, query) => ({
      items: state.contracts.filter(item => {
        if (String(item.tenantId) !== String(scope.tenantId)) return false;
        if (query.customerId && String(item.customerId) !== String(query.customerId)) return false;
        if (query.status && item.status !== query.status) return false;
        return true;
      }),
      pagination: { page: 1, limit: 20, total: state.contracts.length, pages: 1 }
    })),
    updateById: jest.fn(async (scope, id, update) => {
      const index = state.contracts.findIndex(item => item._id === id && String(item.tenantId) === String(scope.tenantId));
      if (index < 0) return null;
      state.contracts[index] = {
        ...state.contracts[index],
        ...update,
        updatedAt: '2026-06-06T10:00:00.000Z'
      };
      return state.contracts[index];
    })
  };

  const quote = overrides.quote || makeQuote();
  const quotationRepo = {
    findById: jest.fn(async (scope, id) => (String(id) === String(quote._id) ? quote : null)),
    findOne: jest.fn(async (scope, query) => (query.quotationNo === quote.quotationNo ? quote : null)),
    updateById: jest.fn(async (scope, id, update) => {
      state.quoteUpdates.push({ scope, id, update });
      return { ...quote, ...update };
    })
  };

  const auditService = {
    record: jest.fn(async (scope, entry) => {
      state.audits.push({ scope, entry });
      return { id: `audit-${state.audits.length}`, ...entry };
    })
  };
  const outboxService = {
    publish: jest.fn(async (scope, event) => {
      state.outbox.push({ scope, event });
      return { id: `outbox-${state.outbox.length}`, ...event };
    })
  };
  const lifecycleService = {
    createOrUpdateHandover: jest.fn(async (scope, payload) => {
      state.lifecyclePayloads.push({ scope, payload });
      return {
        _id: 'lifecycle-link-1',
        contractId: payload.contractId,
        handoverStatus: 'ready',
        iot: { handoffBoundary: 'lifecycle_handoff_only' }
      };
    })
  };

  return {
    state,
    contractRepo,
    quotationRepo,
    auditService,
    outboxService,
    lifecycleService,
    service: new ContractsService({
      contractRepo,
      quotationRepo,
      auditService,
      outboxService,
      lifecycleService,
      now: () => new Date('2026-06-06T10:00:00.000Z')
    })
  };
}

describe('contracts production service', () => {
  test('creates tenant-scoped contract from quotation with pricing snapshot, payment plan and events', async () => {
    const { service, contractRepo, auditService, outboxService } = makeService();
    const result = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    expect(result.created).toBe(true);
    expect(contractRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        storeId: '64f000000000000000000401',
        customerId: '64f000000000000000000501',
        quotationId: '64f000000000000000000901',
        contractNo: expect.stringContaining('CT-'),
        status: 'pending_signature',
        paymentStatus: 'not_started',
        systemFamilies: expect.arrayContaining(['hot_water', 'air', 'fresh_air', 'smart_control']),
        pricingSnapshot: expect.objectContaining({
          customerTotal: 268000,
          directCost: 180000,
          dealerMargin: 68000,
          monthlyPayment: 7444,
          marginGuard: expect.objectContaining({ status: 'pass', quoteFloor: 211765 })
        }),
        lifecycleHandoff: expect.objectContaining({
          status: 'not_started',
          iotBridgeKey: 'bridge-quote-001',
          servicePlanCode: 'CARE-5Y',
          handoffBoundary: 'lifecycle_handoff_only'
        })
      }),
      {}
    );
    expect(result.contract.paymentSchedule).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'deposit', amount: 80400, status: 'pending' }),
      expect.objectContaining({ key: 'mobilization', amount: 134000, status: 'pending' }),
      expect.objectContaining({ key: 'acceptance', amount: 53600, status: 'pending' })
    ]));
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        action: 'contract.created_from_quotation',
        resourceType: 'ContractV2',
        after: expect.objectContaining({
          status: 'pending_signature',
          customerTotal: 268000
        })
      })
    );
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        aggregateType: 'contract',
        eventType: 'contract.created',
        payload: expect.objectContaining({
          customerId: '64f000000000000000000501',
          quotationId: '64f000000000000000000901',
          handoffBoundary: 'lifecycle_handoff_only'
        })
      })
    );
  });

  test('marks contract signed, contracts quotation and prepares lifecycle handoff', async () => {
    const { service, state, quotationRepo, outboxService } = makeService();
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    const signed = await service.markSigned(makeScope(), created.contract.contractNo, {
      method: 'electronic',
      customerSigner: '王女士',
      companySigner: '销售顾问A',
      evidenceUrl: '/contracts/evidence/ct-1.pdf',
      customerIp: '127.0.0.1'
    });

    expect(signed).toEqual(expect.objectContaining({
      status: 'signed',
      signedAt: new Date('2026-06-06T10:00:00.000Z'),
      signature: expect.objectContaining({
        method: 'electronic',
        status: 'signed',
        customerSigner: '王女士',
        evidenceUrl: '/contracts/evidence/ct-1.pdf'
      }),
      lifecycleHandoff: expect.objectContaining({
        status: 'ready',
        handoffBoundary: 'lifecycle_handoff_only'
      })
    }));
    expect(quotationRepo.updateById).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      '64f000000000000000000901',
      expect.objectContaining({ status: 'contracted' }),
      {}
    );
    expect(state.audits.map(item => item.entry.action)).toEqual(expect.arrayContaining([
      'contract.signature.marked'
    ]));
    expect(outboxService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        eventType: 'contract.signed',
        payload: expect.objectContaining({ status: 'signed' })
      })
    );
  });

  test('records payment against schedule and updates payment status', async () => {
    const { service } = makeService();
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    const paid = await service.recordPayment(makeScope(), created.contract.contractNo, {
      key: 'deposit',
      amount: 80400,
      method: 'bank_transfer',
      receiptNo: 'RCPT-001'
    });

    expect(paid.paymentStatus).toBe('partial');
    expect(paid.paymentSchedule.find(item => item.key === 'deposit')).toEqual(expect.objectContaining({
      status: 'paid',
      paidAmount: 80400,
      method: 'bank_transfer',
      receiptNo: 'RCPT-001'
    }));
  });

  test('starts delivery only after signature and creates lifecycle handoff payload', async () => {
    const { service, lifecycleService } = makeService();
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });
    await expect(service.startDelivery(makeScope(), created.contract.contractNo, {}))
      .rejects.toThrow('contract must be signed');

    await service.markSigned(makeScope(), created.contract.contractNo, { customerSigner: '王女士' });
    const result = await service.startDelivery(makeScope(), created.contract.contractNo, {
      devices: [
        { sourceDeviceId: 'wh-1', brand: 'Rheem', name: '中央热水主机', system: '热水系统' },
        { sourceDeviceId: 'ctrl-1', brand: 'Ruud', name: '智能控制网关', system: '智能控制' }
      ],
      servicePlan: { warrantyMonths: 60 }
    });

    expect(result.contract).toEqual(expect.objectContaining({
      status: 'delivery_started',
      lifecycleLinkId: 'lifecycle-link-1',
      lifecycleHandoff: expect.objectContaining({
        status: 'linked',
        handoffBoundary: 'lifecycle_handoff_only'
      })
    }));
    expect(lifecycleService.createOrUpdateHandover).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        customerId: '64f000000000000000000501',
        contractId: created.contract.contractNo,
        quoteId: '64f000000000000000000901',
        projectState: 'construction-planning',
        iot: expect.objectContaining({
          platform: 'rhautt-iot',
          handoffBoundary: 'lifecycle_handoff_only'
        }),
        devices: expect.arrayContaining([
          expect.objectContaining({ brand: 'Rheem', system: '热水系统' }),
          expect.objectContaining({ brand: 'Ruud', system: '智能控制' })
        ])
      })
    );
  });

  test('blocks signature when approval is still pending', async () => {
    const { service } = makeService({
      quote: makeQuote({
        marginGuard: {
          status: 'blocked',
          minMarginRate: 0.15,
          targetMarginRate: 0.22,
          quoteFloor: 300000,
          adjustment: 20000
        }
      })
    });
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    expect(created.contract.status).toBe('pending_approval');
    expect(created.contract.approval).toEqual(expect.objectContaining({
      required: true,
      status: 'pending'
    }));
    await expect(service.markSigned(makeScope(), created.contract.contractNo, {}))
      .rejects.toThrow('contract approval is required');
  });

  test('approves blocked-margin contract before customer signature and records audit/outbox', async () => {
    const { service, outboxService } = makeService({
      quote: makeQuote({
        marginGuard: {
          status: 'blocked',
          minMarginRate: 0.15,
          targetMarginRate: 0.22,
          quoteFloor: 300000,
          adjustment: 20000
        }
      })
    });
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    const approved = await service.decideApproval(makeScope({ userId: '64f000000000000000000888' }), created.contract.contractNo, {
      decision: 'approved',
      reason: '总部确认战略客户项目，允许进入签约'
    });

    expect(approved.status).toBe('pending_signature');
    expect(approved.approval).toEqual(expect.objectContaining({
      required: true,
      status: 'approved',
      approvedBy: '64f000000000000000000888',
      reason: '总部确认战略客户项目，允许进入签约'
    }));
    const signed = await service.markSigned(makeScope(), created.contract.contractNo, {
      customerSigner: '王女士'
    });
    expect(signed.status).toBe('signed');
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.objectContaining({
        eventType: 'contract.approval.approved',
        payload: expect.objectContaining({
          approvalStatus: 'approved',
          status: 'pending_signature'
        })
      })
    );
  });

  test('rejects blocked-margin contract and prevents signature', async () => {
    const { service } = makeService({
      quote: makeQuote({
        marginGuard: {
          status: 'blocked',
          minMarginRate: 0.15,
          targetMarginRate: 0.22,
          quoteFloor: 300000,
          adjustment: 20000
        }
      })
    });
    const created = await service.createFromQuotation(makeScope(), {
      quotationId: '64f000000000000000000901'
    });

    const rejected = await service.decideApproval(makeScope(), created.contract.contractNo, {
      decision: 'rejected',
      reason: '低于总部毛利底线'
    });

    expect(rejected.status).toBe('voided');
    expect(rejected.approval).toEqual(expect.objectContaining({
      status: 'rejected',
      rejectedBy: '64f000000000000000000101',
      reason: '低于总部毛利底线'
    }));
    await expect(service.markSigned(makeScope(), created.contract.contractNo, {}))
      .rejects.toThrow('cancelled or voided contract cannot be signed');
  });

  test('requires tenant and quote/customer context', async () => {
    const { service } = makeService();

    await expect(service.createFromQuotation({}, { quotationId: '64f000000000000000000901' }))
      .rejects.toThrow('tenantId is required');
    await expect(service.createFromQuotation(makeScope(), {}))
      .rejects.toThrow('quotationId, quotationNo or quote payload is required');
    await expect(service.createFromQuotation(makeScope(), {
      quote: makeQuote({ customerId: null })
    })).rejects.toThrow('customerId is required');
  });
});
