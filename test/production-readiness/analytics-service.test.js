const AnalyticsService = require('../../server/modules/analytics/analytics.service');

function modelMock({ count = 0, aggregate = [] } = {}) {
  return {
    countDocuments: jest.fn().mockResolvedValue(count),
    aggregate: jest.fn().mockResolvedValue(aggregate)
  };
}

describe('analytics multitenant service', () => {
  test('hq scope can request tenant-wide dealer aggregation', async () => {
    const opportunityModel = modelMock({
      aggregate: [
        { _id: 'quoted', count: 4, amount: 800000 },
        { _id: 'won', count: 2, amount: 500000 }
      ]
    });
    const service = new AnalyticsService({
      dealerModel: modelMock({ count: 12 }),
      storeModel: modelMock({ count: 30 }),
      userModel: modelMock({ count: 120 }),
      customerModel: modelMock({ count: 900 }),
      opportunityModel
    });

    const result = await service.getOverview({
      tenantId: 'tenant-1',
      role: 'hq_admin'
    });

    expect(result.scope.visibility).toBe('tenant-wide');
    expect(result.totals.dealers).toBe(12);
    expect(result.totals.pipeline).toBe(1300000);
    expect(opportunityModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      { $match: { tenantId: 'tenant-1' } }
    ]));
  });

  test('dealer scope is automatically constrained to its own dealer id', async () => {
    const opportunityModel = modelMock();
    const service = new AnalyticsService({
      dealerModel: modelMock(),
      storeModel: modelMock(),
      userModel: modelMock(),
      customerModel: modelMock(),
      opportunityModel
    });

    await service.getOverview({
      tenantId: 'tenant-1',
      dealerId: 'dealer-a',
      role: 'dealer_admin'
    }, {
      dealerId: 'dealer-b'
    });

    expect(opportunityModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      { $match: { tenantId: 'tenant-1', dealerId: 'dealer-a' } }
    ]));
  });

  test('analytics queries reject missing tenant scope', async () => {
    const service = new AnalyticsService({
      dealerModel: modelMock(),
      storeModel: modelMock(),
      userModel: modelMock(),
      customerModel: modelMock(),
      opportunityModel: modelMock()
    });

    await expect(service.getOverview({ role: 'hq_admin' })).rejects.toThrow('tenantId is required');
  });
});
