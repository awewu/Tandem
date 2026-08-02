const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('./helpers/in-process-request');

const createV2Router = require('../../server/modules/v2.router');

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/v2', router);
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      success: false,
      error: error.message
    });
  });
  return app;
}

describe('production v2 routes', () => {
  const jwtSecret = 'unit-test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
  });

  test('auth is not mounted by the frozen Express v2 fallback', async () => {
    const app = makeApp(createV2Router());
    await request(app)
      .post('/api/v2/auth/login')
      .send({ phone: '13800000000', password: 'Secret123!' })
      .expect(404);
  });

  test('crm is not mounted by the frozen Express v2 fallback', async () => {
    const app = makeApp(createV2Router({
      crm: {
        service: {
          listCustomers: jest.fn()
        }
      }
    }));

    await request(app)
      .get('/api/v2/crm/customers')
      .expect(404);
  });

  test('contracts routes require authenticated tenant scope', async () => {
    const app = makeApp(createV2Router({
      contracts: {
        service: {
          list: jest.fn()
        }
      }
    }));

    await request(app)
      .get('/api/v2/contracts')
      .expect(401);
  });

  test('contract creation route passes JWT tenant scope into contract service', async () => {
    const service = {
      createFromQuotation: jest.fn().mockResolvedValue({
        contract: {
          contractNo: 'CT-000201-20260606100000-900001',
          status: 'pending_signature',
          paymentStatus: 'not_started',
          lifecycleHandoff: { handoffBoundary: 'lifecycle_handoff_only' }
        },
        created: true
      }),
      list: jest.fn(),
      getByContractId: jest.fn(),
      markSigned: jest.fn(),
      decideApproval: jest.fn(),
      recordPayment: jest.fn(),
      startDelivery: jest.fn()
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      storeId: '64f000000000000000000401',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ contracts: { service } }));

    const payload = {
      quotationId: '64f000000000000000000901',
      customerId: '64f000000000000000000501'
    };
    const res = await request(app)
      .post('/api/v2/contracts/from-quotation')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.contract.lifecycleHandoff.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(service.createFromQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        storeId: '64f000000000000000000401',
        userId: '64f000000000000000000101'
      }),
      expect.objectContaining(payload)
    );
  });

  test('contract signature, payment and delivery routes preserve tenant scope and lifecycle boundary', async () => {
    const service = {
      createFromQuotation: jest.fn(),
      list: jest.fn().mockResolvedValue({ items: [], pagination: { total: 0 } }),
      getByContractId: jest.fn().mockResolvedValue({ contractNo: 'CT-001', status: 'signed' }),
      decideApproval: jest.fn().mockResolvedValue({
        contractNo: 'CT-001',
        status: 'pending_signature',
        approval: { required: true, status: 'approved' }
      }),
      markSigned: jest.fn().mockResolvedValue({
        contractNo: 'CT-001',
        status: 'signed',
        lifecycleHandoff: { status: 'ready', handoffBoundary: 'lifecycle_handoff_only' }
      }),
      recordPayment: jest.fn().mockResolvedValue({
        contractNo: 'CT-001',
        paymentStatus: 'partial'
      }),
      startDelivery: jest.fn().mockResolvedValue({
        contract: {
          contractNo: 'CT-001',
          status: 'delivery_started',
          lifecycleHandoff: { status: 'linked', handoffBoundary: 'lifecycle_handoff_only' }
        },
        lifecycleLink: {
          contractId: 'CT-001',
          iot: { handoffBoundary: 'lifecycle_handoff_only' }
        }
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ contracts: { service } }));

    await request(app)
      .get('/api/v2/contracts?status=signed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .get('/api/v2/contracts/CT-001')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const approvalRes = await request(app)
      .post('/api/v2/contracts/CT-001/approval')
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approved', reason: '总部审批通过' })
      .expect(200);
    const signRes = await request(app)
      .post('/api/v2/contracts/CT-001/signature')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerSigner: '王女士' })
      .expect(200);
    await request(app)
      .post('/api/v2/contracts/CT-001/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'deposit', amount: 10000 })
      .expect(200);
    const deliveryRes = await request(app)
      .post('/api/v2/contracts/CT-001/delivery-start')
      .set('Authorization', `Bearer ${token}`)
      .send({ devices: [{ name: '中央热水主机', system: '热水系统' }] })
      .expect(201);

    expect(approvalRes.body.data.approval.status).toBe('approved');
    expect(signRes.body.data.lifecycleHandoff.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(deliveryRes.body.data.lifecycleLink.iot.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      expect.anything()
    );
    expect(service.getByContractId).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'CT-001'
    );
    for (const fn of [service.decideApproval, service.markSigned, service.recordPayment, service.startDelivery]) {
      expect(fn).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: '64f000000000000000000201' }),
        'CT-001',
        expect.anything()
      );
    }
  });

  test('retired Express CRM list route cannot invoke the legacy service', async () => {
    const service = {
      listCustomers: jest.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      storeId: '64f000000000000000000401',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ crm: { service } }));

    const res = await request(app)
      .get('/api/v2/crm/customers?status=lead')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).not.toBe(true);
    expect(service.listCustomers).not.toHaveBeenCalled();
  });

  test('retired Express CRM customer route cannot invoke the legacy service', async () => {
    const service = {
      getCustomer360: jest.fn().mockResolvedValue(null)
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ crm: { service } }));

    const res = await request(app)
      .get('/api/v2/crm/customers/64f000000000000000000001')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).not.toBe(true);
    expect(service.getCustomer360).not.toHaveBeenCalled();
  });

  test.skip('retired Express diagnosis completion route keeps C-end diagnosis loop tenant scoped', async () => {
    const service = {
      completeDiagnosis: jest.fn().mockResolvedValue({
        source: 'rysnova-ai-diagnosis',
        customer: { id: 'customer-001' },
        opportunity: { id: 'opportunity-001' },
        diagnosis: { systems: ['hot_water', 'fresh_air'], painPoints: ['热水等待'], completedAt: '2026-06-06T09:00:00.000Z' },
        solutions: [],
        recommendedTierId: 'balanced',
        quotationSummary: { status: 'draft-ready', estimatedTotal: 320000, monthlyPayment: 9000, currency: 'CNY' },
        customerReport: { id: 'report-001', shareUrl: '/customer-share.html?reportId=report-001' },
        nextActions: ['designer-bom-quote'],
        iotBoundary: 'lifecycle_handoff_only'
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      storeId: '64f000000000000000000401',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ diagnosis: { service } }));

    const payload = {
      customer: { name: '王女士', phone: '13800000000' },
      painPoints: ['热水等待', '空气差'],
      home: { area: 168, city: '上海' }
    };
    const res = await request(app)
      .post('/api/v2/diagnosis/complete')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.iotBoundary).toBe('lifecycle_handoff_only');
    expect(service.completeDiagnosis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        storeId: '64f000000000000000000401',
        userId: '64f000000000000000000101'
      }),
      expect.objectContaining(payload)
    );
  });

  test.skip('retired Express public diagnosis completion route keeps C-end entry usable without staff JWT but still tenant scoped', async () => {
    const service = {
      completeDiagnosis: jest.fn().mockResolvedValue({
        source: 'rysnova-ai-diagnosis',
        customer: { id: 'customer-public-001' },
        opportunity: { id: 'opportunity-public-001' },
        diagnosis: { systems: ['hot_water', 'fresh_air'], painPoints: ['热水等待'], completedAt: '2026-06-06T09:00:00.000Z' },
        solutions: [],
        recommendedTierId: 'balanced',
        visualPackages: { status: 'ready', tiers: {} },
        quotationSummary: { status: 'draft-ready', estimatedTotal: 320000, monthlyPayment: 9000, currency: 'CNY' },
        customerReport: { id: 'report-public-001', shareUrl: '/customer-share.html?reportId=report-public-001' },
        nextActions: ['customer-share-review'],
        iotBoundary: 'lifecycle_handoff_only'
      })
    };
    const app = makeApp(createV2Router({
      diagnosis: {
        service,
        publicScope: {
          tenantId: '64f000000000000000000901',
          dealerId: '64f000000000000000000902',
          storeId: '64f000000000000000000903'
        }
      }
    }));

    const payload = {
      customer: { name: '王女士', phone: '13800000000' },
      painPoints: ['热水等待', '空气差'],
      home: { area: 168, city: '上海' },
      consent: true,
      consentMeta: { policyVersion: 'rysnova-privacy-v1' }
    };
    const res = await request(app)
      .post('/api/v2/diagnosis/public/complete')
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.iotBoundary).toBe('lifecycle_handoff_only');
    expect(service.completeDiagnosis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000901',
        dealerId: '64f000000000000000000902',
        storeId: '64f000000000000000000903',
        role: 'public_consumer'
      }),
      expect.objectContaining({
        ...payload,
        channel: 'rysnova-public-diagnosis',
        sourceSurface: 'pain-diagnosis.html'
      })
    );
  });

  test.skip('retired Express public diagnosis report route exposes customer-readable v2 report without staff JWT', async () => {
    const service = {
      findPublicReport: jest.fn().mockResolvedValue({
        reportId: 'report-public-001',
        source: 'rysnova-ai-diagnosis',
        status: 'active',
        customer: { id: 'customer-public-001', name: '王女士' },
        project: { area: 168, city: '上海', houseType: '大平层' },
        diagnosis: { systems: ['hot_water', 'fresh_air'], painPoints: ['热水等待'], completedAt: '2026-06-06T09:00:00.000Z' },
        solutions: [{ id: 'essential' }, { id: 'balanced' }, { id: 'premium' }],
        recommendedTierId: 'balanced',
        visualPackages: { status: 'ready', tiers: { essential: {}, balanced: {}, premium: {} } },
        quotationSummary: { status: 'draft-ready', estimatedTotal: 320000, monthlyPayment: 9000, currency: 'CNY' },
        customerReport: { id: 'report-public-001', shareUrl: '/customer-share.html?reportId=report-public-001&shareToken=token-public-001' },
        nextActions: ['customer-share-review'],
        iotBoundary: 'lifecycle_handoff_only'
      })
    };
    const app = makeApp(createV2Router({
      diagnosis: {
        service,
        publicScope: {
          tenantId: '64f000000000000000000901',
          dealerId: '64f000000000000000000902',
          storeId: '64f000000000000000000903'
        }
      }
    }));

    const res = await request(app)
      .get('/api/v2/diagnosis/public/reports/report-public-001?shareToken=token-public-001')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.visualPackages.status).toBe('ready');
    expect(res.body.data.iotBoundary).toBe('lifecycle_handoff_only');
    expect(service.findPublicReport).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000901',
        dealerId: '64f000000000000000000902',
        storeId: '64f000000000000000000903',
        role: 'public_consumer'
      }),
      'report-public-001',
      'token-public-001'
    );
  });

  test.skip('retired Express public diagnosis report route returns 404 when share token cannot access report', async () => {
    const service = {
      findPublicReport: jest.fn().mockResolvedValue(null)
    };
    const app = makeApp(createV2Router({
      diagnosis: {
        service,
        publicScope: {
          tenantId: '64f000000000000000000901'
        }
      }
    }));

    const res = await request(app)
      .get('/api/v2/diagnosis/public/reports/report-public-001?shareToken=wrong-token')
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  test.skip('retired Express lifecycle handover route passes contract assets into lifecycle bridge', async () => {
    const service = {
      createOrUpdateHandover: jest.fn().mockResolvedValue({
        contractId: 'CNT-001',
        iot: { homeId: 'home-1', bindingStatus: 'prepared' },
        handoverStatus: 'ready'
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ lifecycle: { service } }));

    const payload = {
      customerId: '64f000000000000000000001',
      contractId: 'CNT-001',
      devices: [{ name: '新风主机', model: 'FA-350', system: '新风系统' }]
    };

    const res = await request(app)
      .post('/api/v2/lifecycle/handover')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(service.createOrUpdateHandover).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        userId: '64f000000000000000000101'
      }),
      expect.objectContaining(payload)
    );
  });

  test.skip('retired Express lifecycle project state route exposes customer-visible delivery progression', async () => {
    const service = {
      getProjectStateMap: jest.fn().mockReturnValue([
        { state: 'quote-approved', customerVisibleState: '报价已审核，可确认' },
        { state: 'lifecycle-handoff-ready', customerVisibleState: '正在准备全生命周期服务' }
      ]),
      updateProjectState: jest.fn().mockResolvedValue({
        contractId: 'CNT-001',
        projectState: 'construction-in-progress',
        customerVisibleState: '正在施工',
        progressPercent: 76,
        currentMilestone: 'site-installation'
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'project_manager'
    }, jwtSecret);
    const app = makeApp(createV2Router({ lifecycle: { service } }));

    const states = await request(app)
      .get('/api/v2/lifecycle/project-states')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(states.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'lifecycle-handoff-ready' })
    ]));

    const updated = await request(app)
      .patch('/api/v2/lifecycle/handover/CNT-001/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'construction-in-progress' })
      .expect(200);

    expect(updated.body.data.customerVisibleState).toBe('正在施工');
    expect(service.updateProjectState).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'CNT-001',
      expect.objectContaining({ state: 'construction-in-progress' })
    );
  });

  test.skip('retired Express lifecycle customer project route returns customer-visible portal contract with tenant scope', async () => {
    const service = {
      listCustomerProjectViews: jest.fn().mockResolvedValue({
        items: [
          {
            tenantId: '64f000000000000000000201',
            customerId: '64f000000000000000000501',
            contractId: 'CNT-CUSTOMER-001',
            projectState: 'construction-in-progress',
            customerVisibleState: '正在施工',
            progressPercent: 76,
            handoffBoundary: 'lifecycle_handoff_only'
          }
        ],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      }),
      getCustomerProjectView: jest.fn().mockResolvedValue({
        tenantId: '64f000000000000000000201',
        customerId: '64f000000000000000000501',
        contractId: 'CNT-CUSTOMER-001',
        projectState: 'construction-in-progress',
        customerVisibleState: '正在施工',
        progressPercent: 76,
        references: {
          quoteId: 'QUOTE-CUSTOMER-001',
          designPackageId: 'DESIGN-PKG-001'
        },
        solution: {
          systems: ['central-hot-water', 'fresh-air', 'smart-control'],
          equipmentBrands: ['Rheem', 'Ruud']
        },
        construction: { state: 'active', currentMilestone: 'site-installation', progressPercent: 76 },
        acceptance: { status: 'not-started' },
        servicePlan: { planId: 'plan-customer-001', status: 'prepared', warrantyMonths: 60 },
        installedAssets: [{ assetId: 'asset-1', brand: 'Rheem', category: 'central-hot-water' }],
        iot: {
          homeId: 'home-customer-001',
          bindingStatus: 'prepared',
          handoffBoundary: 'lifecycle_handoff_only',
          capabilityRegistry: [{ assetId: 'asset-1', controlBoundary: 'lifecycle_handoff_only' }]
        },
        milestones: [{ state: 'construction-in-progress', status: 'active' }],
        nextAction: { actionType: 'track-construction', visibility: 'customer-visible' },
        visibility: { scope: 'customer-visible', hiddenFields: ['dealerMargin', 'costBaseline'] },
        handoffBoundary: 'lifecycle_handoff_only'
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      customerId: '64f000000000000000000501',
      role: 'customer'
    }, jwtSecret);
    const app = makeApp(createV2Router({ lifecycle: { service } }));

    const list = await request(app)
      .get('/api/v2/lifecycle/customer-projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(list.body.data.items[0].contractId).toBe('CNT-CUSTOMER-001');
    expect(service.listCustomerProjectViews).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        customerId: '64f000000000000000000501',
        userId: '64f000000000000000000101',
        role: 'customer'
      }),
      expect.objectContaining({})
    );

    const res = await request(app)
      .get('/api/v2/lifecycle/customer-projects/CNT-CUSTOMER-001')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.customerVisibleState).toBe('正在施工');
    expect(res.body.data.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(service.getCustomerProjectView).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        customerId: '64f000000000000000000501',
        userId: '64f000000000000000000101',
        role: 'customer'
      }),
      'CNT-CUSTOMER-001'
    );
  });

  test.skip('retired Express lifecycle IoT handoff package route exposes lifecycle-only package under tenant scope', async () => {
    const service = {
      buildIotHandoffPackage: jest.fn().mockResolvedValue({
        packageType: 'rhautt-nexus-iot-lifecycle-handoff',
        packageVersion: '1.0',
        tenantId: '64f000000000000000000201',
        customerId: '64f000000000000000000501',
        contractId: 'CNT-HANDOFF-PKG-001',
        home: { homeId: 'home-handoff-pkg', lifecycleStage: 'iot_handover' },
        installedAssets: [{ assetId: 'asset-1', brand: 'Rheem', category: 'central-hot-water' }],
        capabilityRegistry: [{ assetId: 'asset-1', controlBoundary: 'lifecycle_handoff_only' }],
        servicePlan: { planId: 'plan-1', status: 'prepared' },
        warrantySummary: { assetCount: 1 },
        maintenanceSchedule: { cadence: 'quarterly' },
        handoffBoundary: 'lifecycle_handoff_only',
        forbiddenControl: {
          realtimeControlCommands: false,
          remoteSetpointWrite: false,
          deviceActuation: false
        },
        visibility: {
          scope: 'iot-lifecycle-handoff',
          hiddenFields: ['dealerMargin', 'realtimeControlCommands']
        }
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      customerId: '64f000000000000000000501',
      role: 'customer'
    }, jwtSecret);
    const app = makeApp(createV2Router({ lifecycle: { service } }));

    const res = await request(app)
      .get('/api/v2/lifecycle/handover/CNT-HANDOFF-PKG-001/handoff-package')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(res.body.data.forbiddenControl.realtimeControlCommands).toBe(false);
    expect(service.buildIotHandoffPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        customerId: '64f000000000000000000501',
        userId: '64f000000000000000000101',
        role: 'customer'
      }),
      'CNT-HANDOFF-PKG-001'
    );
  });

  test('retired design and BIM implementations are not mounted by the frozen Express fallback', async () => {
    const app = makeApp(createV2Router());
    await request(app).get('/api/v2/design/projects/project-001').expect(404);
    await request(app).get('/api/v2/rysnova-bim/artifacts').expect(404);
  });

  test('retired Express CRM does not run its legacy tenant middleware', async () => {
    const service = {
      listCustomers: jest.fn()
    };
    const token = jwt.sign({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'sales'
    }, jwtSecret);
    const app = makeApp(createV2Router({ crm: { service } }));

    const res = await request(app)
      .get('/api/v2/crm/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.success).not.toBe(true);
    expect(service.listCustomers).not.toHaveBeenCalled();
  });

  test('system pack compose route exposes plug-and-play Rheem bundle contract', async () => {
    const service = {
      compose: jest.fn().mockReturnValue({
        packs: [{ id: 'rheem-central-hot-water' }, { id: 'rheem-smart-control' }],
        iot: { handoverRequired: true, lifecycleBridge: '/api/v2/lifecycle/handover' }
      })
    };
    const app = makeApp(createV2Router({ systemPacks: { service } }));

    const payload = { selectedPackIds: ['rheem-central-hot-water'] };
    const res = await request(app)
      .post('/api/v2/system-packs/compose')
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.iot.handoverRequired).toBe(true);
    expect(service.compose).toHaveBeenCalledWith(payload);
  });

  test('analytics overview passes tenant and dealer scope into service', async () => {
    const service = {
      getOverview: jest.fn().mockResolvedValue({
        scope: { tenantId: 'tenant-1', dealerId: 'dealer-1', visibility: 'dealer-scoped' },
        totals: { dealers: 1, stores: 3, staff: 20, customers: 120, pipeline: 600000 },
        stages: {},
        dealerPerformance: []
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      storeId: '64f000000000000000000401',
      role: 'dealer_admin'
    }, jwtSecret);
    const app = makeApp(createV2Router({ analytics: { service } }));

    const res = await request(app)
      .get('/api/v2/analytics/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(service.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        storeId: '64f000000000000000000401',
        role: 'dealer_admin'
      }),
      expect.objectContaining({})
    );
  });

  test('audit route lists tenant-scoped events for headquarters oversight', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({
        items: [{ id: 'audit-1', action: 'lifecycle.project_state.update', resourceType: 'LifecycleLink' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'hq_admin'
    }, jwtSecret);
    const app = makeApp(createV2Router({ audit: { service } }));

    const res = await request(app)
      .get('/api/v2/audit/events?resourceType=LifecycleLink')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        userId: '64f000000000000000000101',
        role: 'hq_admin'
      }),
      expect.objectContaining({ resourceType: 'LifecycleLink' })
    );
  });

});
