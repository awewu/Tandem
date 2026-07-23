const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('./helpers/in-process-request');

const createV2Router = require('../../server/modules/v2.router');
const RysnovaArtifactService = require('../../server/modules/rysnova-bim/rysnova-bim-artifact.service');

const REQUIRED_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];

function makeApp(router) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/v2', router);
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      details: error.details
    });
  });
  return app;
}

describe('Rysnova v2 end-to-end delivery flow', () => {
  const jwtSecret = 'unit-test-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
  });

  test('generates visuals and deliverables, shares signoff artifacts, and reaches handoff-ready deepening package', async () => {
    const memoryDb = { rysnovaBimArtifacts: [] };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb,
      now: () => new Date('2026-06-12T10:00:00.000Z')
    });
    const app = makeApp(createV2Router({ rysnovaBim: { service } }));
    const token = jwt.sign({
      userId: '64f000000000000000000101',
      tenantId: '64f000000000000000000201',
      dealerId: '64f000000000000000000301',
      role: 'designer'
    }, jwtSecret);
    const customerId = '64f000000000000000000501';
    const projectId = 'project-rysnova-bim-e2e';
    const auth = req => req.set('Authorization', `Bearer ${token}`);

    const visualRes = await auth(request(app)
      .post(`/api/v2/rysnova-bim/projects/${projectId}/visual-artifacts`))
      .send({
        tier: 'balanced',
        customerId,
        result: {
          input: { area: 168, city: '上海', houseType: '大平层' },
          recommendation: { recommendedTier: 'balanced' },
          solutions: {
            balanced: {
              id: 'balanced',
              name: '均衡深化方案',
              systems: [
                { type: 'hot_water', name: 'Rheem 中央热水' },
                { type: 'heating', name: 'Ruud 低温采暖' },
                { type: 'fresh_air', name: 'Ruud 新风' },
                { type: 'air', name: 'Ruud 全空气' },
                { type: 'smart_control', name: '智能控制' }
              ],
              estimatedTotal: 328000
            }
          }
        }
      })
      .expect(201);

    expect(visualRes.body.data.artifactTypes).toEqual([
      'principle-diagram',
      'construction-drawing',
      'bim-model'
    ]);

    const deliverableRes = await auth(request(app)
      .post(`/api/v2/rysnova-bim/projects/${projectId}/deliverable-artifacts`))
      .send({
        tier: 'balanced',
        customerId,
        project: {
          name: 'Rysnova 端到端交付项目',
          city: '上海',
          area: 168,
          houseType: '大平层',
          contractId: 'CNT-LITH-E2E-001'
        },
        pricing: {
          targetMarginRate: 0.26,
          minMarginRate: 0.18,
          taxRate: 0.09,
          financingMonths: 36
        },
        systems: [
          { type: 'hot_water', name: '中央热水' },
          { type: 'heating', name: '低温采暖' },
          { type: 'fresh_air', name: '新风' },
          { type: 'air', name: '全空气' },
          { type: 'smart_control', name: '智能控制' }
        ]
      })
      .expect(201);

    expect(deliverableRes.body.data.artifactTypes).toEqual([
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]);
    expect(deliverableRes.body.data.storageEvidence).toHaveLength(4);
    expect(deliverableRes.body.data.storageEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'bom',
        storageReady: true,
        provider: 'memory-object-storage',
        contentHash: expect.stringMatching(/^sha256:/)
      })
    ]));

    const generatedArtifactIds = [
      ...visualRes.body.data.artifacts.map(item => item.id || item._id || item.objectKey),
      ...deliverableRes.body.data.artifacts.map(item => item.id || item._id || item.objectKey)
    ];
    expect(generatedArtifactIds).toHaveLength(7);

    for (const artifactId of generatedArtifactIds) {
      await auth(request(app)
        .post(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(artifactId)}/approval`))
        .send({ shareToCustomer: true })
        .expect(200);

      const integrity = await auth(request(app)
        .get(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(artifactId)}/integrity`))
        .expect(200);
      expect(integrity.body.data.passed).toBe(true);

      const download = await auth(request(app)
        .get(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(artifactId)}/download`))
        .expect(200);
      expect(download.body.data).toEqual(expect.objectContaining({
        artifactId: expect.any(String),
        projectId,
        type: expect.any(String),
        label: expect.any(String),
        fileRole: expect.any(String),
        objectKey: expect.any(String),
        contentHash: expect.stringMatching(/^sha256:/),
        provider: 'memory-object-storage',
        integrityPassed: true,
        downloadReady: true,
        accessMode: 'object-storage-gateway',
        downloadUrl: expect.stringContaining('/api/v2/rysnova-bim/artifacts/'),
        customerSafe: true,
        qualityGate: expect.objectContaining({ passed: true })
      }));
      const downloadText = JSON.stringify(download.body.data);
      for (const forbidden of ['permissions', 'metadata', 'dealerMargin', 'directCost', 'marginGuard', 'internalApprovalNotes']) {
        expect(downloadText).not.toContain(forbidden);
      }

      const content = await auth(request(app)
        .get(download.body.data.downloadUrl))
        .expect(200);
      expect(content.text.length).toBeGreaterThan(0);
      expect(content.headers['x-content-sha256']).toBe(download.body.data.contentHash);
      expect(content.headers['x-rysnova-bim-artifact-id']).toBe(download.body.data.artifactId);
      expect(content.headers['x-rysnova-bim-artifact-type']).toBe(download.body.data.type);
      expect(content.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    }

    const deepeningRes = await auth(request(app)
      .get(`/api/v2/rysnova-bim/projects/${projectId}/deepening-package`))
      .expect(200);

    expect(deepeningRes.body.data.handoffReady).toBe(true);
    expect(deepeningRes.body.data.status).toBe('handoff-ready');
    expect(deepeningRes.body.data.engineeringReadiness.ready).toBe(true);
    expect(deepeningRes.body.data.visualReadiness.ready).toBe(true);
    expect(deepeningRes.body.data.commercialReadiness.ready).toBe(true);
    expect(deepeningRes.body.data.customerSignoff.ready).toBe(true);
    expect(deepeningRes.body.data.evidenceGaps).toEqual([]);
    expect(deepeningRes.body.data.nextActions).toEqual([]);
    expect(deepeningRes.body.data.customerVisibleCount).toBe(7);
    expect(deepeningRes.body.data.quoteCostSummary.marginGuard.status).toBe('pass');
    expect(deepeningRes.body.data.quantityTakeoffSummary.pipeMeters).toBeGreaterThan(0);

	    const customerPackage = await auth(request(app)
	      .get(`/api/v2/rysnova-bim/projects/${projectId}/customer-package`))
	      .expect(200);
	    expect(customerPackage.body.data.count).toBe(7);
	    expect(customerPackage.body.data.requiredTypes).toHaveLength(REQUIRED_SIGNOFF_TYPES.length);
	    expect([...customerPackage.body.data.requiredTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
	    expect(customerPackage.body.data.missingTypes).toEqual([]);
	    const customerPackageTypes = customerPackage.body.data.artifacts.map(item => item.type);
	    expect(customerPackageTypes).toHaveLength(REQUIRED_SIGNOFF_TYPES.length);
	    expect([...customerPackageTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
	    expect(customerPackage.body.data.visibility.hiddenFields).toEqual(expect.arrayContaining([
	      'dealerMargin',
	      'costBaseline',
	      'internalApprovalNotes',
	      'metadata',
	      'permissions'
	    ]));
	    expect(customerPackage.body.data.artifacts[0]).toEqual(expect.objectContaining({
	      id: expect.any(String),
	      type: expect.any(String),
	      objectKey: expect.any(String),
	      contentHash: expect.stringMatching(/^sha256:/),
	      storage: expect.objectContaining({
	        provider: 'memory-object-storage',
	        integrityPassed: true
	      }),
	      summary: expect.any(Object)
	    }));
    expect(customerPackage.body.data.readiness).toEqual(expect.objectContaining({
      packageReady: true,
      visualReady: true,
      commercialReady: true,
      standardsPassed: true,
      lifecycleHandoffReady: true,
      customerSignoffReady: true,
      objectStorageIntegrityReady: true
    }));
    expect(customerPackage.body.data.deliveryStage).toBe('customer-signoff-ready');
    expect(customerPackage.body.data.qualityGateSummary).toEqual(expect.objectContaining({
      passed: true,
      requiredTypes: REQUIRED_SIGNOFF_TYPES,
      missingTypes: [],
      failedArtifacts: [],
      warningCount: 0,
      checkedAt: expect.any(String)
    }));
    expect([...customerPackage.body.data.qualityGateSummary.checkedTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect(customerPackage.body.data.artifacts.every(item => item.qualityGate?.passed === true)).toBe(true);
    expect(customerPackage.body.data.artifacts.every(item => item.signoff?.approved === true)).toBe(true);
    expect(customerPackage.body.data.artifacts.every(item => item.deliveryStage === 'customer-ready')).toBe(true);
    const visualCustomerArtifacts = customerPackage.body.data.artifacts.filter(item => (
      ['principle-diagram', 'construction-drawing', 'bim-model'].includes(item.type)
    ));
    expect(visualCustomerArtifacts).toHaveLength(3);
    expect(visualCustomerArtifacts.every(item => item.engineeringTraceability?.sourceHash?.startsWith('sha256:'))).toBe(true);
    expect(visualCustomerArtifacts.every(item => item.engineeringTraceability?.handoffBoundary === 'lifecycle_handoff_only')).toBe(true);
    expect(visualCustomerArtifacts.every(item => item.engineeringTraceability?.realtimeControl === false)).toBe(true);
    expect(visualCustomerArtifacts[0].engineeringTraceability).toEqual(expect.objectContaining({
      visualArtifacts: expect.objectContaining({
        principleDiagram: 'principle-diagram',
        layout2d: 'construction-drawing',
        scene3d: 'bim-model'
      }),
      standardsRefs: expect.arrayContaining([
        'GB 55015-2021',
        'GB 55020-2021',
        'GB 50736-2012'
      ])
    }));
    expect(customerPackage.body.data.downloadManifest.items.filter(item => (
      ['principle-diagram', 'construction-drawing', 'bim-model'].includes(item.type)
    )).every(item => item.engineeringTraceability?.sourceHash?.startsWith('sha256:'))).toBe(true);
    expect(customerPackage.body.data.customerSignoffManifest).toEqual(expect.objectContaining({
      manifestId: expect.stringMatching(/^rysnova-bim-signoff-/),
      packageType: 'rysnova-bim-customer-signoff-manifest',
      projectId,
      deliveryStage: 'customer-signoff-ready',
      ready: true,
      artifactCount: 7,
      missingTypes: [],
      download: expect.objectContaining({
        ready: true,
        readyCount: 7,
        blockedCount: 0
      }),
      signoffAction: expect.objectContaining({
        allowed: true,
        required: 'customer-signature-required',
        requiredCustomerAcknowledgements: expect.arrayContaining([
          'solution-scope-reviewed',
          'quotation-summary-reviewed',
          'engineering-deliverables-received',
          'standards-precheck-reviewed',
          'lifecycle-handoff-boundary-reviewed'
        ])
      }),
      lifecycleHandoff: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        targetPlatform: 'external-iot-lifecycle-platform',
        assetCount: 5
      }),
      boundary: expect.objectContaining({
        customerSafe: true,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      })
    }));
    expect([...customerPackage.body.data.customerSignoffManifest.requiredTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect([...customerPackage.body.data.customerSignoffManifest.artifactTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect(customerPackage.body.data.customerSignoffManifest.artifacts).toHaveLength(7);
    expect(customerPackage.body.data.customerSignoffManifest.artifacts.every(item => (
      item.downloadReady === true &&
      item.signoffStatus === 'customer-visible' &&
      item.qualityStatus === 'passed' &&
      String(item.contentHash).startsWith('sha256:')
    ))).toBe(true);
	    expect(customerPackage.body.data.quoteSummary).toEqual(expect.objectContaining({
	      currency: 'CNY',
	      customerTotal: expect.any(Number),
	      monthlyPayment: expect.any(Number),
	      validDays: 30
	    }));
	    expect(customerPackage.body.data.lifecycleHandoff).toEqual(expect.objectContaining({
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false,
	      targetPlatform: 'external-iot-lifecycle-platform',
	      assetCount: 5,
	      requiredBeforeCustomerCare: expect.arrayContaining([
	        'contract-signed',
	        'installation-completed',
	        'asset-serial-collected',
	        'homeowner-care-plan-created'
	      ])
	    }));
	    expect(customerPackage.body.data.lifecycleHandoff.assets).toHaveLength(5);
	    expect(customerPackage.body.data.lifecycleHandoff.assets[0]).toEqual(expect.objectContaining({
	      assetId: expect.any(String),
	      brand: expect.any(String),
	      model: expect.any(String),
	      lifecycleState: 'pending-installation',
	      warrantyRegistration: 'required-after-installation',
	      iotBinding: expect.objectContaining({
	        status: 'handoff-ready-not-bound',
	        requiredIdentifier: 'installed_asset_id_or_device_serial',
	        realtimeControl: false
	      })
	    }));
	    expect(customerPackage.body.data.standardsSummary.passed).toBe(true);
	    const customerPackageText = JSON.stringify(customerPackage.body.data.artifacts);
	    for (const forbidden of ['permissions', 'metadata', 'dealerMargin', 'costBaseline', 'internalApprovalNotes', 'directCost', 'marginGuard']) {
	      expect(customerPackageText).not.toContain(forbidden);
	    }
	    const customerLifecycleText = JSON.stringify({
	      quoteSummary: customerPackage.body.data.quoteSummary,
	      lifecycleHandoff: customerPackage.body.data.lifecycleHandoff
	    });
	    for (const forbidden of ['dealerMargin', 'costBaseline', 'internalApprovalNotes', 'directCost', 'marginGuard', 'costBreakdown', 'targetBeforeTax', 'quoteFloor']) {
	      expect(customerLifecycleText).not.toContain(forbidden);
	    }
	    const signoffManifestText = JSON.stringify(customerPackage.body.data.customerSignoffManifest);
	    for (const forbidden of ['permissions', 'metadata', 'dealerMargin', 'costBaseline', 'internalApprovalNotes', 'directCost', 'marginGuard', 'costBreakdown', 'targetBeforeTax', 'quoteFloor', 'approvedBy']) {
	      expect(signoffManifestText).not.toContain(forbidden);
	    }

	    const customerToken = jwt.sign({
	      userId: customerId,
	      tenantId: '64f000000000000000000201',
	      customerId,
	      role: 'customer'
	    }, jwtSecret);
	    const otherCustomerToken = jwt.sign({
	      userId: '64f000000000000000000599',
	      tenantId: '64f000000000000000000201',
	      customerId: '64f000000000000000000599',
	      role: 'customer'
	    }, jwtSecret);
	    const missingCustomerIdToken = jwt.sign({
	      userId: '64f000000000000000000598',
	      tenantId: '64f000000000000000000201',
	      role: 'customer'
	    }, jwtSecret);

	    const customerSignoff = await request(app)
	      .post(`/api/v2/rysnova-bim/projects/${projectId}/customer-signoff`)
	      .set('Authorization', `Bearer ${customerToken}`)
	      .send({
	        acknowledgements: [
	          'solution-scope-reviewed',
	          'quotation-summary-reviewed',
	          'engineering-deliverables-received',
	          'standards-precheck-reviewed',
	          'lifecycle-handoff-boundary-reviewed'
	        ],
	        method: 'customer_portal_confirmation',
	        signerName: '端到端客户',
	        signerMobile: '13800000000',
	        signatureEvidence: { ip: '127.0.0.1', userAgent: 'jest-e2e' },
	        termsVersion: 'rysnova-bim-signoff-v1',
	        confirmedAt: '2026-06-12T10:00:00.000Z'
	      })
	      .expect(201);
	    expect(customerSignoff.body.data.status).toBe('customer-signoff-confirmed');
	    expect(customerSignoff.body.data.receipt).toEqual(expect.objectContaining({
	      receiptNo: expect.stringMatching(/^LITH-SIGNOFF-/),
	      packageType: 'rysnova-bim-customer-signoff-receipt',
	      status: 'customer-signed',
	      projectId,
	      tenantId: '64f000000000000000000201',
	      customerId,
	      manifestId: customerPackage.body.data.customerSignoffManifest.manifestId,
	      artifactCount: 7,
	      acknowledgements: expect.arrayContaining([
	        'solution-scope-reviewed',
	        'quotation-summary-reviewed',
	        'engineering-deliverables-received',
	        'standards-precheck-reviewed',
	        'lifecycle-handoff-boundary-reviewed'
	      ]),
	      boundary: expect.objectContaining({
	        customerSafe: true,
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false,
	        noRealtimeControlGranted: true
	      }),
	      customerSignature: expect.objectContaining({
	        method: 'customer_portal_confirmation',
	        signerName: '端到端客户',
	        signerMobileHash: expect.stringMatching(/^sha256:/),
	        evidenceHash: expect.stringMatching(/^sha256:/),
	        termsVersion: 'rysnova-bim-signoff-v1',
	        confirmedAt: '2026-06-12T10:00:00.000Z'
	      })
	    }));
	    expect(customerSignoff.body.data.receipt.lifecycleHandoff).toEqual(expect.objectContaining({
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false
	    }));
	    expect(customerSignoff.body.data.customerPackage.readiness.packageReady).toBe(true);
	    expect(customerSignoff.body.data.customerSignoffManifest.ready).toBe(true);
	    const customerSignoffText = JSON.stringify(customerSignoff.body.data.receipt);
	    for (const forbidden of ['13800000000', '127.0.0.1', 'dealerMargin', 'directCost', 'marginGuard', 'costBreakdown']) {
	      expect(customerSignoffText).not.toContain(forbidden);
	    }

	    await request(app)
	      .post(`/api/v2/rysnova-bim/projects/${projectId}/customer-signoff`)
	      .set('Authorization', `Bearer ${customerToken}`)
	      .send({ acknowledgements: ['solution-scope-reviewed'] })
	      .expect(400);

	    await request(app)
	      .post(`/api/v2/rysnova-bim/projects/${projectId}/customer-signoff`)
	      .set('Authorization', `Bearer ${otherCustomerToken}`)
	      .send({
	        acknowledgements: [
	          'solution-scope-reviewed',
	          'quotation-summary-reviewed',
	          'engineering-deliverables-received',
	          'standards-precheck-reviewed',
	          'lifecycle-handoff-boundary-reviewed'
	        ]
	      })
	      .expect(404);

	    const customerScopedPackage = await request(app)
	      .get(`/api/v2/rysnova-bim/projects/${projectId}/customer-package`)
	      .set('Authorization', `Bearer ${customerToken}`)
	      .expect(200);
	    expect(customerScopedPackage.body.data.count).toBe(7);
	    expect([...customerScopedPackage.body.data.requiredTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
	    expect(customerScopedPackage.body.data.missingTypes).toEqual([]);
	    expect([...customerScopedPackage.body.data.artifacts.map(item => item.type)].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
	    expect(customerScopedPackage.body.data.artifacts.every(item => item.customerVisible === true)).toBe(true);
	    expect(customerScopedPackage.body.data.readiness.packageReady).toBe(true);
	    expect(customerScopedPackage.body.data.lifecycleHandoff.handoffBoundary).toBe('lifecycle_handoff_only');
	    expect(customerScopedPackage.body.data.lifecycleHandoff.realtimeControl).toBe(false);

	    await request(app)
	      .get(`/api/v2/rysnova-bim/projects/${projectId}/customer-package`)
	      .set('Authorization', `Bearer ${otherCustomerToken}`)
	      .expect(404);

	    const customerFirstArtifactId = customerScopedPackage.body.data.artifacts[0].id;
	    const customerDownload = await request(app)
	      .get(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(customerFirstArtifactId)}/download`)
	      .set('Authorization', `Bearer ${customerToken}`)
	      .expect(200);
	    await request(app)
	      .get(customerDownload.body.data.downloadUrl)
	      .set('Authorization', `Bearer ${customerToken}`)
	      .expect(200);
	    await request(app)
	      .get(customerDownload.body.data.downloadUrl)
	      .set('Authorization', `Bearer ${otherCustomerToken}`)
	      .expect(404);

	    await request(app)
	      .get(`/api/v2/rysnova-bim/projects/${projectId}/customer-package`)
	      .set('Authorization', `Bearer ${missingCustomerIdToken}`)
	      .expect(403);
	  });

  test('signoff package orchestration generates all seven artifacts and only shares them when explicitly approved', async () => {
    const memoryDb = { rysnovaBimArtifacts: [] };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb,
      now: () => new Date('2026-06-12T12:00:00.000Z')
    });
    const app = makeApp(createV2Router({ rysnovaBim: { service } }));
    const token = jwt.sign({
      userId: '64f000000000000000000103',
      tenantId: '64f000000000000000000203',
      dealerId: '64f000000000000000000303',
      role: 'designer'
    }, jwtSecret);
    const customerId = '64f000000000000000000503';
    const projectId = 'project-rysnova-bim-signoff';
    const auth = req => req.set('Authorization', `Bearer ${token}`);
    const payload = {
      tier: 'balanced',
      customerId,
      project: {
        name: 'Rysnova 完整签核包项目',
        city: '上海',
        area: 188,
        houseType: '大平层',
        contractId: 'CNT-LITH-SIGNOFF-001'
      },
      pricing: {
        targetMarginRate: 0.26,
        minMarginRate: 0.18,
        taxRate: 0.09,
        financingMonths: 36
      },
      systems: [
        { type: 'hot_water', name: '中央热水' },
        { type: 'heating', name: '低温采暖' },
        { type: 'fresh_air', name: '新风' },
        { type: 'air', name: '全空气' },
        { type: 'smart_control', name: '智能控制' }
      ],
      result: {
        input: { area: 188, city: '上海', houseType: '大平层' },
        recommendation: { recommendedTier: 'balanced' },
        solutions: {
          balanced: {
            id: 'balanced',
            name: '签核深化方案',
            systems: [
              { type: 'hot_water', name: 'Rheem 中央热水' },
              { type: 'heating', name: 'Ruud 低温采暖' },
              { type: 'fresh_air', name: 'Ruud 新风' },
              { type: 'air', name: 'Ruud 全空气' },
              { type: 'smart_control', name: '智能控制' }
            ],
            estimatedTotal: 358000
          }
        }
      }
    };

    const reviewOnly = await auth(request(app)
      .post(`/api/v2/rysnova-bim/projects/${projectId}/signoff-package`))
      .send({ ...payload, approvalMode: 'review-only' })
      .expect(201);

    expect(reviewOnly.body.data.count).toBe(7);
    expect([...reviewOnly.body.data.requiredTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect([...reviewOnly.body.data.artifactTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect(reviewOnly.body.data.approvalMode).toBe('review-only');
    expect(reviewOnly.body.data.customerPackageReady).toBe(false);
    expect(reviewOnly.body.data.handoffReady).toBe(false);
    expect(reviewOnly.body.data.customerPackage.count).toBe(0);
    expect(reviewOnly.body.data.deepeningPackage.customerSignoff.approvalMissingTypes)
      .toEqual(expect.arrayContaining(REQUIRED_SIGNOFF_TYPES));
    expect(reviewOnly.body.data.tierComparison).toEqual(expect.objectContaining({
      projectId,
      selectedTier: 'balanced',
      recommendedTier: 'balanced',
      tierCount: 3,
      boundary: expect.objectContaining({
        customerSafe: true,
        internalCostHiddenFromCustomer: true,
        lifecycleHandoffOnly: true,
        realtimeControl: false
      })
    }));
    expect(reviewOnly.body.data.tierComparison.tiers.map(item => item.tier)).toEqual([
      'essential',
      'balanced',
      'premium'
    ]);
    expect(reviewOnly.body.data.tierComparison.tiers.find(item => item.tier === 'balanced')).toEqual(expect.objectContaining({
      selected: true,
      recommended: true,
      currency: 'CNY',
      customerTotal: expect.any(Number),
      monthlyPayment: expect.any(Number),
      marginGuard: expect.objectContaining({ status: 'pass' }),
      standardsCoverageStatus: 'complete',
      lifecycleHandoff: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: 5
      })
    }));
    expect(reviewOnly.body.data.tierComparison.tiers[0].customerTotal)
      .toBeLessThan(reviewOnly.body.data.tierComparison.tiers[1].customerTotal);
    expect(reviewOnly.body.data.tierComparison.tiers[1].customerTotal)
      .toBeLessThan(reviewOnly.body.data.tierComparison.tiers[2].customerTotal);

    const approvedProjectId = `${projectId}-approved`;
    const shared = await auth(request(app)
      .post(`/api/v2/rysnova-bim/projects/${approvedProjectId}/signoff-package`))
      .send({ ...payload, approvalMode: 'share-to-customer' })
      .expect(201);

    expect(shared.body.data.count).toBe(7);
    expect(shared.body.data.approvalMode).toBe('share-to-customer');
    expect(shared.body.data.status).toBe('signoff-ready');
    expect(shared.body.data.customerPackageReady).toBe(true);
    expect(shared.body.data.handoffReady).toBe(true);
    expect(shared.body.data.evidenceGaps).toEqual([]);
    expect(shared.body.data.nextActions).toEqual([]);
    expect(shared.body.data.customerPackage.count).toBe(7);
    expect(shared.body.data.deepeningPackage.handoffReady).toBe(true);
    expect(shared.body.data.approvalResults).toHaveLength(7);
    expect(shared.body.data.storageEvidence).toHaveLength(7);
    expect(shared.body.data.storageEvidence.every(item => item.storageReady === true)).toBe(true);
    expect(shared.body.data.signoffEvidence).toHaveLength(7);
    expect(shared.body.data.signoffEvidence.every(item => item.qualityGate.passed === true)).toBe(true);
    expect(shared.body.data.signoffEvidence.filter(item => (
      ['principle-diagram', 'construction-drawing', 'bim-model'].includes(item.type)
    )).every(item => item.qualityGate.checks.visualQualityPassed === true)).toBe(true);
    expect(shared.body.data.visualArtifacts).toHaveLength(3);
    expect(shared.body.data.visualArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'principle-diagram',
        metadata: expect.objectContaining({
          visualTraceability: expect.objectContaining({
            traceabilityId: expect.stringMatching(/^visual-trace-balanced-/),
            handoffBoundary: 'lifecycle_handoff_only',
            realtimeControl: false,
            systemNodes: expect.arrayContaining([
              expect.objectContaining({
                drawingRefs: expect.objectContaining({
                  principleDiagramNode: expect.stringMatching(/^principle-node-/)
                })
              })
            ])
          }),
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'principleDiagram',
            checks: expect.objectContaining({
              nonBlank: true,
              hasTraceability: true,
              hasExpectedRefs: true,
              lifecycleHandoffOnly: true,
              realtimeControl: false
            }),
            expectedRefs: expect.arrayContaining(['principle-node-1'])
          })
        })
      }),
      expect.objectContaining({
        type: 'construction-drawing',
        metadata: expect.objectContaining({
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'layout2d',
            expectedRefs: expect.arrayContaining(['layout-device-1'])
          })
        })
      }),
      expect.objectContaining({
        type: 'bim-model',
        metadata: expect.objectContaining({
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'illustration3d',
            expectedRefs: expect.arrayContaining(['scene3d-device-1'])
          })
        })
      })
    ]));
    expect(shared.body.data.tierComparison).toEqual(expect.objectContaining({
      selectedTier: 'balanced',
      tierCount: 3
    }));
    expect(shared.body.data.tierComparison.tiers.map(item => item.tier)).toEqual([
      'essential',
      'balanced',
      'premium'
    ]);
    expect([...shared.body.data.customerPackage.artifacts.map(item => item.type)].sort())
      .toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect(shared.body.data.customerPackage.artifacts.every(item => item.customerVisible === true)).toBe(true);
    expect(shared.body.data.customerPackage.artifacts.every(item => item.storage.integrityPassed === true)).toBe(true);
    expect(shared.body.data.customerPackage.readiness).toEqual(expect.objectContaining({
      packageReady: true,
      lifecycleHandoffReady: true,
      objectStorageIntegrityReady: true
    }));
    expect(shared.body.data.customerPackage.qualityGateSummary.passed).toBe(true);
    expect(shared.body.data.customerPackage.deliveryStage).toBe('customer-signoff-ready');
    expect(shared.body.data.customerSignoffManifest).toEqual(expect.objectContaining({
      manifestId: shared.body.data.customerPackage.customerSignoffManifest.manifestId,
      packageType: 'rysnova-bim-customer-signoff-manifest',
      ready: true,
      artifactCount: 7,
      deliveryStage: 'customer-signoff-ready',
      signoffAction: expect.objectContaining({
        allowed: true,
        required: 'customer-signature-required'
      }),
      boundary: expect.objectContaining({
        customerSafe: true,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      })
    }));
    expect(shared.body.data.customerSignoffManifest.artifacts).toHaveLength(7);
    expect(JSON.stringify(shared.body.data.customerSignoffManifest)).not.toContain('dealerMargin');
    expect(shared.body.data.customerPackage.lifecycleHandoff).toEqual(expect.objectContaining({
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      assetCount: 5
    }));
    expect(shared.body.data.quoteCostSummary.marginGuard.status).toBe('pass');
  });

  test('keeps partial visual-only packages blocked until engineering and commercial artifacts exist', async () => {
    const memoryDb = { rysnovaBimArtifacts: [] };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb,
      now: () => new Date('2026-06-12T11:00:00.000Z')
    });
    const app = makeApp(createV2Router({ rysnovaBim: { service } }));
    const token = jwt.sign({
      userId: '64f000000000000000000102',
      tenantId: '64f000000000000000000202',
      dealerId: '64f000000000000000000302',
      role: 'designer'
    }, jwtSecret);
    const customerId = '64f000000000000000000502';
    const projectId = 'project-rysnova-bim-partial';
    const auth = req => req.set('Authorization', `Bearer ${token}`);

    const visualRes = await auth(request(app)
      .post(`/api/v2/rysnova-bim/projects/${projectId}/visual-artifacts`))
      .send({
        tier: 'balanced',
        customerId,
        result: {
          input: { area: 128, city: '杭州', houseType: '改善住宅' },
          recommendation: { recommendedTier: 'balanced' },
          solutions: {
            balanced: {
              id: 'balanced',
              name: '视觉预沟通方案',
              systems: [
                { type: 'hot_water', name: 'Rheem 中央热水' },
                { type: 'fresh_air', name: 'Ruud 新风' }
              ],
              estimatedTotal: 188000
            }
          }
        }
      })
      .expect(201);

    expect(visualRes.body.data.artifactTypes).toEqual([
      'principle-diagram',
      'construction-drawing',
      'bim-model'
    ]);

    for (const artifactId of visualRes.body.data.artifacts.map(item => item.id || item._id || item.objectKey)) {
      await auth(request(app)
        .post(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(artifactId)}/approval`))
        .send({ shareToCustomer: true })
        .expect(200);
    }

    const customerPackage = await auth(request(app)
      .get(`/api/v2/rysnova-bim/projects/${projectId}/customer-package`))
      .expect(200);
    const presentTypes = customerPackage.body.data.artifacts.map(item => item.type);
    const expectedMissingTypes = [
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ];

    expect(customerPackage.body.data.count).toBe(3);
    expect([...customerPackage.body.data.requiredTypes].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
    expect([...presentTypes].sort()).toEqual([
      'bim-model',
      'construction-drawing',
      'principle-diagram'
    ]);
    expect(customerPackage.body.data.missingTypes).toEqual(expectedMissingTypes);
    expect(customerPackage.body.data.readiness).toEqual(expect.objectContaining({
      packageReady: false,
      visualReady: true,
      commercialReady: false,
      lifecycleHandoffReady: false,
      customerSignoffReady: false,
      objectStorageIntegrityReady: true
    }));
    expect(customerPackage.body.data.deliveryStage).toBe('customer-review-incomplete');
    expect(customerPackage.body.data.qualityGateSummary).toEqual(expect.objectContaining({
      passed: false,
      missingTypes: expectedMissingTypes,
      failedArtifacts: []
    }));
    expect(customerPackage.body.data.customerSignoffManifest).toEqual(expect.objectContaining({
      packageType: 'rysnova-bim-customer-signoff-manifest',
      projectId,
      deliveryStage: 'customer-review-incomplete',
      ready: false,
      artifactCount: 3,
      missingTypes: expectedMissingTypes,
      download: expect.objectContaining({
        ready: true,
        readyCount: 3,
        blockedCount: 0
      }),
      signoffAction: expect.objectContaining({
        allowed: false,
        required: 'complete-evidence-before-signature'
      }),
      lifecycleHandoff: null,
      boundary: expect.objectContaining({
        customerSafe: true,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      })
    }));
    expect(customerPackage.body.data.quoteSummary).toBeNull();
    expect(customerPackage.body.data.lifecycleHandoff).toBeNull();

    const deepeningRes = await auth(request(app)
      .get(`/api/v2/rysnova-bim/projects/${projectId}/deepening-package`))
      .expect(200);
    expect(deepeningRes.body.data.handoffReady).toBe(false);
    expect(deepeningRes.body.data.status).toBe('blocked-or-in-progress');
    expect(deepeningRes.body.data.customerSignoff.ready).toBe(false);
    expect(deepeningRes.body.data.customerSignoff.requiredTypes).toEqual(REQUIRED_SIGNOFF_TYPES);
    expect(deepeningRes.body.data.customerSignoff.missingTypes).toEqual(expectedMissingTypes);
    expect(deepeningRes.body.data.commercialReadiness.ready).toBe(false);
    expect(deepeningRes.body.data.evidenceGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'commercial-readiness', code: 'missing-bom-artifact' }),
      expect.objectContaining({ area: 'customer-signoff', code: 'missing-customer-signoff-artifact', type: 'bom' }),
      expect.objectContaining({ area: 'customer-signoff', code: 'missing-customer-signoff-artifact', type: 'customer-report' })
    ]));
  });
	});
