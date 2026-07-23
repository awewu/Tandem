const QuotationService = require('../../server/modules/quotation/quotation.service');

describe('quotation v2 persistence service', () => {
  function makeService(overrides = {}) {
    const created = [];
    const quoteRepo = {
      create: jest.fn(async (scope, payload) => {
        created.push({ scope, payload });
        return { _id: 'quote-v2-id', ...payload };
      }),
      list: jest.fn(async (scope, query) => ({ items: [{ scope, query }], pagination: { total: 1 } }))
    };
    const engine = {
      generateQuoteFromBOM: jest.fn(() => ({
        quoteId: 'QT-ENGINE-1',
        source: 'designer-bom',
        project: { name: '测试项目' },
        items: [],
        summary: {
          materialSubtotal: 47070,
          laborSubtotal: 6200,
          managementFee: 1800,
          warrantyReserve: 900,
          riskReserve: 1200,
          directCost: 53500,
          targetBeforeTax: 69000,
          taxAmount: 4140,
          customerTotal: 73140,
          dealerMargin: 15500,
          monthlyPayment: 2200
        },
        marginGuard: {
          status: 'pass',
          minMarginRate: 0.15,
          targetMarginRate: 0.2,
          quoteFloor: 62941,
          adjustment: 0
        },
        assumptions: ['后端成本模型']
      }))
    };
    const outboxService = {
      publish: jest.fn(async (scope, event) => ({ _id: 'outbox-1', ...event }))
    };

    return {
      service: new QuotationService({
        quoteRepo,
        engine,
        outboxService,
        now: () => new Date('2026-06-05T12:00:00.000Z'),
        ...overrides
      }),
      quoteRepo,
      engine,
      outboxService,
      created
    };
  }

  test('persists BOM quote into tenant-scoped v2 customer graph', async () => {
    const { service, quoteRepo, outboxService } = makeService();
    const scope = {
      tenantId: '665f10000000000000000001',
      dealerId: '665f10000000000000000002',
      storeId: '665f10000000000000000003',
      userId: '665f10000000000000000004'
    };

    const result = await service.persistFromBOM(scope, {
      customerId: '665f10000000000000000005',
      project: { name: '上海中央热水+全空气', city: '上海', area: 140 },
      items: [
        { id: 'rheem-water', name: '中央热水主机', category: 'hotwater', qty: 1, unit: '台', unitPrice: 38000, total: 38000 },
        { id: 'ruud-air', name: 'Ruud 全空气系统', category: 'hvac', qty: 1, unit: '套', unitPrice: 42000, total: 42000 },
        { id: 'iot', name: 'IoT 控制网关', category: 'control', qty: 1, unit: '套', unitPrice: 2800, total: 2800 }
      ],
      productModuleId: 'rysnova-consumer-system',
      productDeploymentMode: 'rhautt-portal-embedded',
      lifecycleHandoff: { iotBridgeKey: 'bridge-001', servicePlanCode: 'CARE-5Y' }
    });

    expect(result.persisted).toBe(true);
    expect(quoteRepo.create).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        tenantId: scope.tenantId,
        dealerId: scope.dealerId,
        storeId: scope.storeId,
        customerId: '665f10000000000000000005',
        productModuleId: 'rysnova-consumer-system',
        productDeploymentMode: 'rhautt-portal-embedded',
        productNamespace: 'rysnova',
        productDataNamespace: 'rysnova',
        quotationNo: expect.stringContaining('Q2-'),
        systemFamilies: expect.arrayContaining(['hot_water', 'air', 'smart_control']),
        lifecycleHandoff: expect.objectContaining({
          status: 'ready',
          iotBridgeKey: 'bridge-001',
          servicePlanCode: 'CARE-5Y'
        }),
        costBreakdown: expect.objectContaining({
          directCost: 53500,
          customerTotal: 73140
        }),
        marginGuard: expect.objectContaining({
          status: 'pass',
          quoteFloor: 62941
        })
      }),
      {}
    );
    expect(outboxService.publish).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        aggregateType: 'quotation',
        aggregateId: 'quote-v2-id',
        eventType: 'quotation.persisted',
        idempotencyKey: expect.stringContaining(':quotation.persisted'),
        payload: expect.objectContaining({
          quotationId: 'quote-v2-id',
          customerId: '665f10000000000000000005',
          productModuleId: 'rysnova-consumer-system',
          productDeploymentMode: 'rhautt-portal-embedded',
          productNamespace: 'rysnova',
          productDataNamespace: 'rysnova',
          systemFamilies: expect.arrayContaining(['hot_water', 'air', 'smart_control'])
        })
      }),
      {}
    );
  });

  test('rejects persistence without tenant or customer scope', async () => {
    const { service } = makeService();

    await expect(service.persistFromBOM({}, { customerId: 'c1', items: [{ name: '设备', total: 1 }] }))
      .rejects.toThrow('tenantId is required');
    await expect(service.persistFromBOM({ tenantId: 't1' }, { items: [{ name: '设备', total: 1 }] }))
      .rejects.toThrow('customerId is required');
  });

  test('list always applies tenant scope through repository', async () => {
    const { service, quoteRepo } = makeService();
    const scope = { tenantId: 'tenant-a' };
    await service.list(scope, { customerId: 'customer-a', status: 'draft' });

    expect(quoteRepo.list).toHaveBeenCalledWith(
      scope,
      { customerId: 'customer-a', status: 'draft' },
      expect.objectContaining({ sort: { updatedAt: -1 } })
    );
  });

  test('migrates legacy standard QuoteEngine calculation into quotation service target module', () => {
    const { service } = makeService();

    const quote = service.generateStandardQuote({
      design: { area: 120 },
      devices: [
        { name: '中央热水主机', price: 38000, quantity: 1 },
        { name: '全空气系统', price: 42000, quantity: 1 }
      ],
      services: ['design', 'maintenance_1y', 'unknown_service']
    });

    expect(quote.quoteId).toBe('QT1780660800000');
    expect(quote.timestamp).toBe('2026-06-05T12:00:00.000Z');
    expect(quote.summary).toEqual({
      subtotal: 104000,
      tax: 13520,
      total: 117520,
      currency: 'CNY'
    });
    expect(quote.details.devices.total).toBe(80000);
    expect(quote.details.installation).toEqual({
      description: '标准安装',
      total: 18000
    });
    expect(quote.details.services.total).toBe(6000);
    expect(quote.validUntil).toBe('2026-07-05T12:00:00.000Z');
    expect(quote.terms).toContain('报价有效期30天');
  });

  test('normalizes engine summary tax into persisted cost breakdown', async () => {
    const { service } = makeService();

    expect(service.normalizeCostBreakdown({
      summary: {
        materialSubtotal: 100000,
        directCost: 76000,
        targetBeforeTax: 98000,
        tax: 5880,
        customerTotal: 103880
      }
    })).toEqual(expect.objectContaining({
      materialSubtotal: 100000,
      directCost: 76000,
      targetBeforeTax: 98000,
      taxAmount: 5880,
      customerTotal: 103880
    }));
  });

  test('migrates commercial tax calculation into quotation service target module', async () => {
    const { service, quoteRepo, outboxService } = makeService({
      engine: {
        generateQuoteFromBOM: jest.fn(() => ({
          quoteId: 'QT-COMMERCIAL-1',
          source: 'designer-bom',
          project: { city: '上海', area: 260 },
          items: [],
          summary: {
            materialSubtotal: 120000,
            labor: 30000,
            auxiliary: 10000,
            management: 8000,
            riskReserve: 2000,
            directCost: 155000,
            targetBeforeTax: 200000,
            tax: 0,
            customerTotal: 212000
          },
          marginGuard: { status: 'pass' },
          assumptions: ['后端成本模型']
        }))
      }
    });
    const scope = {
      tenantId: '665f10000000000000000001',
      dealerId: '665f10000000000000000002',
      storeId: '665f10000000000000000003',
      userId: '665f10000000000000000004'
    };

    const tax = service.calculateCommercialTax({
      equipmentAmount: 120000,
      installationAmount: 50000,
      designAmount: 10000,
      taxpayerType: 'general',
      cityTier: '1'
    });

    expect(tax.tax.vat.totalVAT).toBe(21400);
    expect(tax.tax.surcharge.total).toBe(2568);
    expect(tax.tax.stampDuty.total).toBe(54);
    expect(tax.tax.total).toBe(24022);
    expect(tax.totalWithTax).toBe(204022);

    await service.persistFromBOM(scope, {
      customerId: '665f10000000000000000005',
      project: { city: '上海', area: 260 },
      items: [
        { id: 'equipment', name: '商用中央热水设备', category: 'hotwater', qty: 1, unitPrice: 120000, total: 120000 }
      ],
      options: {
        taxMode: 'commercial',
        taxpayerType: 'general',
        equipmentAmount: 120000,
        installationAmount: 50000,
        designAmount: 10000,
        cityTier: '1'
      }
    });

    expect(quoteRepo.create).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        costBreakdown: expect.objectContaining({
          taxAmount: 24022
        }),
        assumptions: expect.arrayContaining([
          expect.stringContaining('商用税费由 quotation service')
        ])
      }),
      {}
    );
    expect(outboxService.publish).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        payload: expect.objectContaining({
          taxProfile: expect.objectContaining({
            mode: 'commercial',
            amount: 24022
          })
        })
      }),
      {}
    );
  });
});
