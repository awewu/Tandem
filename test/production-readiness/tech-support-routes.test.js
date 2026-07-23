const express = require('express');
const request = require('./helpers/in-process-request');

const createTechSupportRouter = require('../../server/routes/tech-support.routes');

function makeDb() {
  return {
    contracts: [{
      id: 'contract-1',
      contractNumber: 'HT-001',
      customerName: '王先生',
      customerPhone: '13812345678',
      projectAddress: '上海徐汇',
      houseType: '大平层',
      area: 180,
      systems: ['中央热水', '新风'],
      totalPrice: 200000,
      status: 'signed',
      signedAt: '2026-01-01',
      expectedCompletion: '2026-02-01',
      materials: [{ items: [{ totalPrice: 30000 }, { totalPrice: 20000 }] }],
      drawings: [{ id: 'dwg-1' }]
    }],
    techMaterials: [{
      id: 'mat-1',
      category: 'pipe',
      stock: 10,
      safetyStock: 8
    }],
    constructionTeams: [{
      id: 'team-1',
      name: '一队',
      leader: '李工',
      leaderPhone: '13912345678',
      members: 4,
      specialty: ['中央热水', '新风'],
      status: 'idle',
      unitPrice: { standard: 500 }
    }],
    settlementRecords: [{
      id: 'set-1',
      contractId: 'contract-1',
      teamId: 'team-1',
      totalAmount: 4000,
      materialCost: 1000,
      totalSettlement: 5000,
      status: 'pending'
    }],
    constructionTasks: []
  };
}

function makeApp(db = makeDb()) {
  const app = express();
  app.use(express.json());
  app.use(createTechSupportRouter({
    db,
    maskSensitiveData: (value, type) => type === 'phone' ? value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : value,
    authenticateToken: (req, res, next) => {
      req.user = { id: 'user-1', role: 'store_admin' };
      next();
    },
    checkRole: () => (req, res, next) => next()
  }));
  return { app, db };
}

describe('tech support route module', () => {
  test('searches contracts and masks customer phone numbers', async () => {
    const { app } = makeApp();

    const res = await request(app)
      .get('/api/tech-support/contracts/search?contractNumber=HT')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      contractNumber: 'HT-001',
      customerPhone: '138****5678'
    }));
  });

  test('returns contract detail with material cost and profit margin', async () => {
    const { app } = makeApp();

    const res = await request(app)
      .get('/api/tech-support/contracts/contract-1')
      .expect(200);

    expect(res.body.data.materialCost).toBe(50000);
    expect(res.body.data.profit).toBe(150000);
    expect(res.body.data.profitMargin).toBe('75.0');
  });

  test('updates material stock and warning state', async () => {
    const { app, db } = makeApp();

    const res = await request(app)
      .post('/api/tech-support/materials/mat-1/stock')
      .send({ stock: 5, operation: 'out' })
      .expect(200);

    expect(res.body.data.stock).toBe(5);
    expect(res.body.data.warning).toBe('库存不足');
    expect(db.techMaterials[0].stock).toBe(5);
  });

  test('assigns a construction team to a contract and creates task record', async () => {
    const { app, db } = makeApp();

    const res = await request(app)
      .post('/api/tech-support/contracts/contract-1/assign-team')
      .send({ teamId: 'team-1', estimatedWorkDays: 3, tasks: ['install'] })
      .expect(200);

    expect(res.body.data.task).toEqual(expect.objectContaining({
      contractId: 'contract-1',
      teamId: 'team-1',
      estimatedLaborCost: 6000
    }));
    expect(db.constructionTeams[0].status).toBe('busy');
    expect(db.constructionTasks).toHaveLength(1);
  });

  test('creates settlement, marks payment, and reports contract summary', async () => {
    const { app, db } = makeApp();

    const created = await request(app)
      .post('/api/tech-support/settlements')
      .send({
        contractId: 'contract-1',
        teamId: 'team-1',
        settlementType: 'labor',
        workDays: 2,
        dailyRate: 500,
        materialCost: 300,
        remarks: '阶段结算'
      })
      .expect(200);

    expect(created.body.data.totalSettlement).toBe(4300);

    await request(app)
      .put(`/api/tech-support/settlements/${created.body.data.id}/pay`)
      .send({ paymentMethod: 'bank', invoiceNumber: 'INV-1' })
      .expect(200);

    expect(db.settlementRecords.find(s => s.id === created.body.data.id).status).toBe('paid');

    const summary = await request(app)
      .get('/api/tech-support/contracts/contract-1/settlements/summary')
      .expect(200);

    expect(summary.body.data.summary.totalSettlements).toBe(2);
    expect(summary.body.data.summary.totalPaid).toBe(4300);
    expect(summary.body.data.summary.totalPending).toBe(5000);
  });
});
