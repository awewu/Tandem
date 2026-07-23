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

  test('design workspace routes save and load tenant-scoped designer state without enabling React candidate surface', async () => {
    const service = {
      saveWorkspaceState: jest.fn().mockResolvedValue({
        projectId: 'project-design-001',
        tenantId: '64f000000000000000000201',
        sourceSurface: 'designer-workbench',
        moduleId: 'designer-workbench',
        moduleDeploymentMode: 'rhautt-portal-embedded',
        moduleNamespace: 'designer',
        dataNamespace: 'designer',
        canvas: {
          walls: [{ id: 'wall-1' }],
          devices: [{ id: 'dev-1', type: 'rheem-dhw' }],
          pipes: [{ id: 'pipe-1', type: 'hot-water' }],
          doors: [],
          windows: [],
          texts: []
        },
        bomSummary: { itemCount: 2, customerTotal: 186000, currency: 'CNY' },
        quoteSummary: { status: 'draft-ready', customerTotal: 186000, marginGuardStatus: 'pass' },
        rysnovaBimReadiness: { visualReady: false, deliverableReady: false, customerPackageReady: false, handoffBoundary: 'lifecycle_handoff_only' },
        contentHash: 'sha256:design-state',
        version: 3
      }),
      getWorkspaceState: jest.fn().mockResolvedValue({
        projectId: 'project-design-001',
        tenantId: '64f000000000000000000201',
        sourceSurface: 'designer-workbench',
        moduleId: 'designer-workbench',
        moduleDeploymentMode: 'rhautt-portal-embedded',
        moduleNamespace: 'designer',
        dataNamespace: 'designer',
        canvas: { walls: [], devices: [], pipes: [], doors: [], windows: [], texts: [] },
        rysnovaBimReadiness: { handoffBoundary: 'lifecycle_handoff_only' },
        contentHash: 'sha256:design-state',
        version: 3
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      storeId: '64f000000000000000000401',
      role: 'designer'
    }, jwtSecret);
    const app = makeApp(createV2Router({ design: { service } }));

    const payload = {
      sourceSurface: 'designer-workbench',
      name: '上海大平层设计',
      canvas: {
        walls: [{ id: 'wall-1' }],
        devices: [{ id: 'dev-1', type: 'rheem-dhw' }],
        pipes: [{ id: 'pipe-1', type: 'hot-water' }]
      },
      bomItems: [{ id: 'rheem-dhw', total: 42000 }],
      quoteSummary: { customerTotal: 186000, marginGuard: { status: 'pass' } }
    };

    const saveRes = await request(app)
      .post('/api/v2/design/projects/project-design-001/workspace-state')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200);
    const getRes = await request(app)
      .get('/api/v2/design/projects/project-design-001/workspace-state')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const candidateStatus = await request(app)
      .get('/api/v2/react-candidate/status')
      .expect(200);

    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.data.rysnovaBimReadiness.handoffBoundary).toBe('lifecycle_handoff_only');
    expect(getRes.body.data.projectId).toBe('project-design-001');
    expect(candidateStatus.body.data.enabled).toBe(false);
    expect(service.saveWorkspaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        storeId: '64f000000000000000000401',
        userId: '64f000000000000000000101'
      }),
      'project-design-001',
      expect.objectContaining(payload)
    );
    expect(service.getWorkspaceState).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-design-001'
    );
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

  test('rysnova-bim artifact routes expose production artifact contract', async () => {
    const service = {
      createArtifact: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        type: 'principle-diagram',
        version: 1,
        status: 'reviewing',
        objectKey: 'tenant/project-001/principle-diagram/v1/principle-diagram.json',
        contentHash: 'sha256:abc',
        inputsHash: 'sha256:def',
        standards: [{ code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
      }),
      listArtifacts: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }),
      approveArtifact: jest.fn().mockResolvedValue({ id: 'artifact-1', status: 'shared', permissions: { customerVisible: true } }),
      verifyArtifactIntegrity: jest.fn().mockResolvedValue({
        artifactId: 'artifact-1',
        objectKey: 'tenant/project-001/principle-diagram/v1/principle-diagram.json',
        exists: true,
        passed: true,
        expectedContentHash: 'sha256:abc',
        actualContentHash: 'sha256:abc'
      }),
      buildCustomerPackage: jest.fn().mockResolvedValue({ projectId: 'project-001', count: 1, missingTypes: [] }),
      generateVisualArtifacts: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        tier: 'balanced',
        count: 3,
        artifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model'],
        artifacts: [
          { id: 'visual-1', type: 'principle-diagram' },
          { id: 'visual-2', type: 'construction-drawing' },
          { id: 'visual-3', type: 'bim-model' }
        ]
      }),
      generateDeliverableArtifacts: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        tier: 'balanced',
        count: 4,
        artifactTypes: ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
        bomSummary: { itemCount: 12, totalCost: 180000, currency: 'CNY' },
        quantityTakeoffSummary: { pipeMeters: 86, valveCount: 18 },
        quoteCostSummary: {
          quotationSummary: { status: 'draft-ready', customerTotal: 260000, currency: 'CNY' },
          marginGuard: { status: 'pass' }
        },
        standardsSummary: { counts: { passed: 4, warning: 0, failed: 0, 'not-applicable': 0 }, blockingFailures: [], passed: true },
        artifacts: [
          { id: 'deliverable-1', type: 'bom' },
          { id: 'deliverable-2', type: 'quantity-takeoff' },
          { id: 'deliverable-3', type: 'standards-check' },
          { id: 'deliverable-4', type: 'customer-report' }
        ]
      }),
      generateSignoffPackage: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        tier: 'balanced',
        approvalMode: 'share-to-customer',
        status: 'signoff-ready',
        requiredTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
        artifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
        count: 7,
        artifacts: [
          { id: 'signoff-1', type: 'principle-diagram' },
          { id: 'signoff-2', type: 'construction-drawing' },
          { id: 'signoff-3', type: 'bim-model' },
          { id: 'signoff-4', type: 'bom' },
          { id: 'signoff-5', type: 'quantity-takeoff' },
          { id: 'signoff-6', type: 'standards-check' },
          { id: 'signoff-7', type: 'customer-report' }
        ],
        customerPackageReady: true,
        handoffReady: true,
        evidenceGaps: [],
        nextActions: []
      }),
      confirmCustomerSignoff: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        tenantId: '64f000000000000000000201',
        status: 'customer-signoff-confirmed',
        receipt: {
          receiptNo: 'LITH-SIGNOFF-ROUTETEST001',
          packageType: 'rysnova-bim-customer-signoff-receipt',
          status: 'customer-signed',
          manifestId: 'rysnova-bim-signoff-route-test',
          artifactCount: 7,
          boundary: {
            customerSafe: true,
            handoffBoundary: 'lifecycle_handoff_only',
            realtimeControl: false,
            noRealtimeControlGranted: true
          },
          customerSignature: {
            method: 'customer_portal_confirmation',
            signerName: 'route-signer',
            signerMobileHash: 'sha256:route-mobile',
            evidenceHash: 'sha256:route-evidence',
            termsVersion: 'rysnova-bim-signoff-v1',
            confirmedAt: '2026-06-12T09:00:00.000Z'
          }
        },
        lifecycleHandoff: { handoffBoundary: 'lifecycle_handoff_only', realtimeControl: false },
        generatedAt: '2026-06-12T09:00:00.000Z'
      }),
      buildDeepeningPackage: jest.fn().mockResolvedValue({
        projectId: 'project-001',
        requiredTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check'],
        missingTypes: [],
        approvalMissingTypes: [],
        handoffReady: true,
        status: 'handoff-ready',
        engineeringReadiness: { ready: true },
        visualReadiness: { ready: true },
        commercialReadiness: { ready: true },
        customerSignoff: { ready: true },
        standardsSummary: { counts: { passed: 6, warning: 0, failed: 0, 'not-applicable': 0 }, blockingFailures: [], passed: true },
        storageIntegrityTodo: [],
        evidenceGaps: [],
        nextActions: []
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      role: 'designer'
    }, jwtSecret);
    const app = makeApp(createV2Router({ rysnovaBim: { service } }));

    const payload = {
      projectId: 'project-001',
      type: 'principle-diagram',
      source: 'rysnova-bim',
      status: 'reviewing',
      inputs: { systemPack: 'rheem-central-hot-water' },
      standards: [{ code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
    };

    const created = await request(app)
      .post('/api/v2/rysnova-bim/artifacts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(created.body.success).toBe(true);
    expect(created.body.data.type).toBe('principle-diagram');
    expect(service.createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '64f000000000000000000201',
        dealerId: '64f000000000000000000301',
        userId: '64f000000000000000000101'
      }),
      expect.objectContaining(payload)
    );

    await request(app)
      .get('/api/v2/rysnova-bim/artifacts?projectId=project-001&type=principle-diagram')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post('/api/v2/rysnova-bim/artifacts/artifact-1/approval')
      .set('Authorization', `Bearer ${token}`)
      .send({ shareToCustomer: true })
      .expect(200);

    const integrity = await request(app)
      .get('/api/v2/rysnova-bim/artifacts/artifact-1/integrity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(integrity.body.data.passed).toBe(true);
    expect(service.verifyArtifactIntegrity).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'artifact-1',
      null,
      { publishEvent: false }
    );

    await request(app)
      .get('/api/v2/rysnova-bim/projects/project-001/customer-package')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(service.buildCustomerPackage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001',
      { publishEvent: false }
    );

    const visualArtifacts = await request(app)
      .post('/api/v2/rysnova-bim/projects/project-001/visual-artifacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tier: 'balanced',
        result: {
          input: { area: 168 },
          solutions: { balanced: { systems: ['hot_water', 'fresh_air'] } }
        }
      })
      .expect(201);
    expect(visualArtifacts.body.data.artifactTypes).toEqual(['principle-diagram', 'construction-drawing', 'bim-model']);
    expect(service.generateVisualArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001',
      expect.objectContaining({ tier: 'balanced' })
    );

    const deliverableArtifacts = await request(app)
      .post('/api/v2/rysnova-bim/projects/project-001/deliverable-artifacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tier: 'balanced',
        project: { name: '路由测试项目', city: '上海', area: 168 },
        systems: [
          { type: 'hot_water', name: '中央热水' },
          { type: 'fresh_air', name: '新风系统' }
        ]
      })
      .expect(201);
    expect(deliverableArtifacts.body.data.artifactTypes).toEqual(['bom', 'quantity-takeoff', 'standards-check', 'customer-report']);
    expect(deliverableArtifacts.body.data.quoteCostSummary.marginGuard.status).toBe('pass');
    expect(service.generateDeliverableArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001',
      expect.objectContaining({ tier: 'balanced' })
    );

    const signoffPackage = await request(app)
      .post('/api/v2/rysnova-bim/projects/project-001/signoff-package')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tier: 'balanced',
        approvalMode: 'share-to-customer',
        project: { name: '路由测试项目', city: '上海', area: 168 },
        systems: [
          { type: 'hot_water', name: '中央热水' },
          { type: 'fresh_air', name: '新风系统' }
        ]
      })
      .expect(201);
    expect(signoffPackage.body.data.artifactTypes).toEqual([
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]);
    expect(signoffPackage.body.data.customerPackageReady).toBe(true);
    expect(signoffPackage.body.data.handoffReady).toBe(true);
    expect(service.generateSignoffPackage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001',
      expect.objectContaining({ approvalMode: 'share-to-customer' })
    );

    const customerSignoff = await request(app)
      .post('/api/v2/rysnova-bim/projects/project-001/customer-signoff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        acknowledgements: [
          'solution-scope-reviewed',
          'quotation-summary-reviewed',
          'engineering-deliverables-received',
          'standards-precheck-reviewed',
          'lifecycle-handoff-boundary-reviewed'
        ],
        method: 'customer_portal_confirmation',
        signerName: 'route-signer'
      })
      .expect(201);
    expect(customerSignoff.body.data.status).toBe('customer-signoff-confirmed');
    expect(customerSignoff.body.data.receipt).toEqual(expect.objectContaining({
      packageType: 'rysnova-bim-customer-signoff-receipt',
      boundary: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      })
    }));
    expect(service.confirmCustomerSignoff).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001',
      expect.objectContaining({
        acknowledgements: expect.arrayContaining([
          'solution-scope-reviewed',
          'lifecycle-handoff-boundary-reviewed'
        ])
      })
    );

    const deepeningPackage = await request(app)
      .get('/api/v2/rysnova-bim/projects/project-001/deepening-package')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deepeningPackage.body.data.handoffReady).toBe(true);
    expect(deepeningPackage.body.data.visualReadiness.ready).toBe(true);
    expect(deepeningPackage.body.data.commercialReadiness.ready).toBe(true);
    expect(deepeningPackage.body.data.customerSignoff.ready).toBe(true);
    expect(service.buildDeepeningPackage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: '64f000000000000000000201' }),
      'project-001'
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
          designPackageId: 'DESIGN-PKG-001',
          rysnovaBimPackageId: 'RYSNOVA-PKG-001'
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

  test('governance agent progress exposes headquarters-only development lane progress', async () => {
    const service = {
      getAgentProgress: jest.fn().mockReturnValue({
        platform: 'Rhautt Nexus / 瑞合数智枢纽',
        status: 'active-auditable-orchestration-not-independent-parallel-runtime',
        generatedAt: '2026-06-06T15:40:00.000Z',
        ledgerUpdatedAt: '2026-06-06T15:40:00.000Z',
        truth: 'auditable-progress-not-production-completion-proof',
        scope: { tenantId: '64f000000000000000000201', role: 'hq_admin', visibility: 'tenant-wide-governance' },
        summary: { totalLanes: 19, averageProgress: 47, activeLanes: 19, blockedLanes: 7, highestProgress: 72, lowestProgress: 31 },
        remainingProductionGaps: ['browser visual', 'PostgreSQL staging'],
        lanes: [{
          owner: 'ui-vi-director',
          lane: 'ui-vi-system-and-visual-acceptance',
          status: 'active',
          updatedAt: '2026-06-06T15:40:00.000Z',
          progress: {
            percent: 60,
            stage: 'rheem-vi-strict-pass-visual-proof-pending',
            currentFocus: 'Rheem VI strict audit passes with 0 findings while browser visual proof remains pending.',
            latestEvidence: 'audit/rheem-vi-production-triage.json',
            nextMilestone: 'Refresh browser visual proof and keep Rheem VI strict green.',
            blockerSummary: 'Rheem VI strict audit is green; browser visual proof remains pending.'
          },
          guards: ['guard:rysnova-diagnosis-ui-vi'],
          harnesses: ['harness:operational'],
          blockers: ['NX-UI-002 requires approved refactor'],
          openRisks: ['Browser visual proof is stale.'],
          nextActions: ['Refactor after confirmation.']
        }]
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'hq_admin'
    }, jwtSecret);
    const app = makeApp(createV2Router({ governance: { service } }));

    const res = await request(app)
      .get('/api/v2/governance/agent-progress')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.truth).toBe('auditable-progress-not-production-completion-proof');
    expect(res.body.data.summary.totalLanes).toBe(19);
    expect(res.body.data.lanes[0].owner).toBe('ui-vi-director');
    expect(service.getAgentProgress).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: '64f000000000000000000201',
      role: 'hq_admin'
    }));
  });

  test('governance agent progress rejects dealer-scoped users', async () => {
    const service = {
      getAgentProgress: jest.fn(() => {
        const error = new Error('开发组进度仅允许总部或平台管理员查看');
        error.status = 403;
        throw error;
      })
    };
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      role: 'dealer_admin'
    }, jwtSecret);
    const app = makeApp(createV2Router({ governance: { service } }));

    const res = await request(app)
      .get('/api/v2/governance/agent-progress')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(service.getAgentProgress).toHaveBeenCalledWith(expect.objectContaining({ role: 'dealer_admin' }));
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

  test('React candidate design contracts stay frozen by default and mount only for explicit contract validation', async () => {
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      role: 'designer'
    }, jwtSecret);

    const frozenApp = makeApp(createV2Router());
    const status = await request(frozenApp)
      .get('/api/v2/react-candidate/status')
      .expect(200);

    expect(status.body.data.enabled).toBe(false);
    expect(status.body.data.status).toBe('frozen');

    await request(frozenApp)
      .post('/api/v2/design/load/calculation')
      .set('Authorization', `Bearer ${token}`)
      .send({ area: 140 })
      .expect(404);

    const app = makeApp(createV2Router({ enableReactCandidate: true }));

    const enabled = await request(app)
      .get('/api/v2/react-candidate/status')
      .expect(200);

    expect(enabled.body.data.enabled).toBe(true);
    expect(enabled.body.data.status).toBe('enabled-for-contract-validation');

    const load = await request(app)
      .post('/api/v2/design/load/calculation')
      .set('Authorization', `Bearer ${token}`)
      .send({ area: 140 })
      .expect(200);

    expect(load.body.success).toBe(true);
    expect(load.body.data.standardBasis).toContain('GB 55015-2021');

    const devices = await request(app)
      .get('/api/v2/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(devices.body.data.length).toBeGreaterThan(0);

    const projects = await request(app)
      .post('/api/v2/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '候选 React 合同项目' })
      .expect(201);

    expect(projects.body.data.tenantId).toBe('64f000000000000000000201');
  });
});
