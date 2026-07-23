const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('./helpers/in-process-request');

const quotationRoutes = require('../../server/routes/quotation-v2');
const { createQuotationV2Routes } = quotationRoutes;

function makeApp(routeOptions = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/quotation-v2', routeOptions.useDefaultRouter ? quotationRoutes : createQuotationV2Routes(routeOptions));
  return app;
}

describe('quotation v2 BOM facade', () => {
  let consoleErrorSpy;
  const jwtSecret = 'quotation-route-test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('generates backend-controlled quote with cost floor and margin guard', async () => {
    const res = await request(makeApp())
      .post('/api/quotation-v2/from-bom')
      .send({
        items: [
          { id: 'heatpump-l', name: '空气源热泵·大', category: 'equipment', qty: 1, unit: '台', unitPrice: 38000, total: 38000 },
          { id: 'water-supply', name: '冷热水管 PPR DN25', category: 'pipe', qty: 42, unit: 'm', unitPrice: 85, total: 3570 },
          { id: 'air-duct', name: '风管 200x100', category: 'pipe', qty: 25, unit: 'm', unitPrice: 220, total: 5500 }
        ],
        project: { name: '生产可用报价测试', city: '上海', area: 140, floor: 18 },
        dealer: { tier: 'premium' },
        options: { discountRate: 0.05, taxRate: 0.06, financingMonths: 36 }
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.source).toBe('designer-bom');
    expect(res.body.data.summary.materialSubtotal).toBe(47070);
    expect(res.body.data.summary.customerTotal).toBeGreaterThan(res.body.data.summary.directCost);
    expect(res.body.data.summary.monthlyPayment).toBeGreaterThan(0);
    expect(res.body.data.marginGuard.quoteFloor).toBeGreaterThan(res.body.data.summary.directCost);
    expect(['pass', 'floor_adjusted']).toContain(res.body.data.marginGuard.status);
    expect(res.body.data.assumptions.join(' ')).toContain('后端成本模型');
  });

  test('adjusts quote when requested discount would break minimum margin', async () => {
    const res = await request(makeApp())
      .post('/api/quotation-v2/from-bom')
      .send({
        items: [
          { name: '中央热水主机', category: 'equipment', qty: 1, unit: '台', unitPrice: 18000, total: 18000 },
          { name: '回水管 PPR DN25', category: 'pipe', qty: 80, unit: 'm', unitPrice: 85, total: 6800 }
        ],
        options: { discountRate: 0.18, targetMarginRate: 0.16, minMarginRate: 0.15 }
      })
      .expect(200);

    expect(res.body.data.marginGuard.status).toBe('floor_adjusted');
    expect(res.body.data.marginGuard.adjustment).toBeGreaterThan(0);
    expect(res.body.data.summary.targetBeforeTax).toBeGreaterThanOrEqual(res.body.data.marginGuard.quoteFloor);
  });

  test('rejects empty BOM with client error contract', async () => {
    const res = await request(makeApp())
      .post('/api/quotation-v2/from-bom')
      .send({ items: [] })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('BOM items are required');
  });

  test('requires authenticated tenant scope when persisting BOM quote', async () => {
    const res = await request(makeApp())
      .post('/api/quotation-v2/persist-from-bom')
      .send({
        customerId: '665f10000000000000000005',
        items: [{ name: '中央热水主机', category: 'hotwater', qty: 1, unitPrice: 18000, total: 18000 }]
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('缺少访问令牌');
  });

  test('does not allow spoofed x-tenant-id to persist BOM quote without JWT', async () => {
    const res = await request(makeApp())
      .post('/api/quotation-v2/persist-from-bom')
      .set('x-tenant-id', '665f10000000000000000001')
      .send({
        customerId: '665f10000000000000000005',
        items: [{ name: '中央热水主机', category: 'hotwater', qty: 1, unitPrice: 18000, total: 18000 }]
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('缺少访问令牌');
  });

  test('allows authenticated tenant user to persist and list BOM quotes', async () => {
    const quotationService = {
      persistFromBOM: jest.fn(async (scope, payload) => ({
        quotation: {
          _id: 'quote-route-1',
          tenantId: scope.tenantId,
          dealerId: scope.dealerId,
          storeId: scope.storeId,
          customerId: payload.customerId,
          quotationNo: 'Q2-ROUTE-1'
        },
        quote: { quoteId: 'QT-ROUTE-1' },
        persisted: true
      })),
      list: jest.fn(async (scope, query) => ({
        items: [{ tenantId: scope.tenantId, query }],
        pagination: { total: 1 }
      }))
    };
    const token = jwt.sign({
      userId: '665f10000000000000000004',
      tenantId: '665f10000000000000000001',
      dealerId: '665f10000000000000000002',
      storeId: '665f10000000000000000003',
      role: 'designer'
    }, jwtSecret);

    const create = await request(makeApp({ quotationService }))
      .post('/api/quotation-v2/persist-from-bom')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: '665f10000000000000000005',
        items: [{ id: 'rheem-dhw', name: '中央热水主机', category: 'hotwater', qty: 1, unit: '台', unitPrice: 18000, total: 18000 }],
        project: { name: 'JWT 租户报价', city: '上海', area: 120 }
      })
      .expect(201);

    expect(create.body.success).toBe(true);
    expect(create.body.data.quotation.tenantId).toBe('665f10000000000000000001');
    expect(create.body.data.quotation.dealerId).toBe('665f10000000000000000002');
    expect(quotationService.persistFromBOM).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '665f10000000000000000001',
        dealerId: '665f10000000000000000002',
        storeId: '665f10000000000000000003',
        userId: '665f10000000000000000004'
      }),
      expect.objectContaining({
        customerId: '665f10000000000000000005'
      })
    );

    const list = await request(makeApp({ quotationService }))
      .get('/api/quotation-v2/persisted')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(quotationService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '665f10000000000000000001',
        dealerId: '665f10000000000000000002'
      }),
      expect.anything()
    );
  });
});
