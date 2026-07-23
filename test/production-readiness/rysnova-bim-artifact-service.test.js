const RysnovaArtifactService = require('../../server/modules/rysnova-bim/rysnova-bim-artifact.service');
const {
  LocalArtifactStorageAdapter,
  MemoryArtifactStorageAdapter,
  S3CompatibleArtifactStorageAdapter,
  proofCapabilities
} = require('../../server/modules/rysnova-bim/artifact-storage.adapter');

const VISUAL_REF_FIELD_BY_TYPE = {
  'principle-diagram': 'principleDiagramNode',
  'construction-drawing': 'layoutDeviceNode',
  'bim-model': 'scene3dDeviceNode'
};

const VISUAL_KEY_BY_TYPE = {
  'principle-diagram': 'principleDiagram',
  'construction-drawing': 'layout2d',
  'bim-model': 'illustration3d'
};

const visualQualityEvidenceForTest = (type, traceability = {}, overrides = {}) => {
  const refField = VISUAL_REF_FIELD_BY_TYPE[type];
  const expectedRefs = refField
    ? [...new Set((traceability.systemNodes || []).map(node => node.drawingRefs?.[refField]).filter(Boolean))]
    : [];
  return {
    passed: true,
    status: 'passed',
    type,
    visualKey: VISUAL_KEY_BY_TYPE[type],
    checks: {
      nonBlank: true,
      hasPreview: true,
      hasTraceability: true,
      hasExpectedRefs: true,
      lifecycleHandoffOnly: true,
      realtimeControl: false
    },
    expectedRefs,
    traceabilityId: traceability.traceabilityId || null,
    blockers: [],
    warnings: [],
    evidenceGeneratedAt: '2026-06-12T08:00:00.000Z',
    ...overrides
  };
};

const withRysnovaStorageEvidence = artifact => {
  const metadata = artifact.metadata || {};
  const visualTraceability = metadata.visualTraceability || metadata.traceability || null;
  const shouldAddVisualQuality = VISUAL_REF_FIELD_BY_TYPE[artifact.type] &&
    visualTraceability &&
    !metadata.visualQualityEvidence &&
    !metadata.qualityEvidence;
  return {
    objectKey: artifact.objectKey || `${artifact.tenantId}/${artifact.projectId}/${artifact.type}/v${artifact.version || 1}/${artifact.id || artifact.type}.json`,
    contentHash: artifact.contentHash || `sha256:${artifact.id || artifact.type}-hash`,
    ...artifact,
    metadata: {
      ...metadata,
      ...(shouldAddVisualQuality ? {
        visualQualityEvidence: visualQualityEvidenceForTest(artifact.type, visualTraceability)
      } : {})
    }
  };
};

const completeStandardsCoverageImpact = {
  status: 'complete',
  coveredDomains: [
    'thermal-comfort',
    'ventilation-iaq',
    'hot-water-safety',
    'potable-water',
    'energy',
    'smart-interoperability'
  ],
  missingRequiredDomains: [],
  quoteDrivers: ['循环泵', '网关/控制器'],
  deliverableEvidence: ['热水负荷计算', 'IoT 设备绑定清单'],
  lifecycleHandoffImpact: ['remote_control', 'service_ticket']
};

const rysnovaBimVisualTraceabilityFixture = traceabilityId => ({
  traceabilityId,
  sourceHash: `sha256:${traceabilityId}-source`,
  tier: 'balanced',
  project: { name: 'Rysnova 工程追溯测试项目', city: '上海', area: 168, houseType: '大平层' },
  systemCount: 1,
  systemNodes: [
    {
      nodeId: 'hot_water-1',
      sourceSystemId: 'hot_water',
      type: 'hot_water',
      name: '中央热水',
      drawingRefs: {
        principleDiagramNode: 'principle-node-1',
        layoutDeviceNode: 'layout-device-1',
        scene3dDeviceNode: 'scene3d-device-1'
      }
    }
  ],
  visualArtifacts: {
    principleDiagram: 'principle-diagram',
    layout2d: 'construction-drawing',
    scene3d: 'bim-model'
  },
  standardsRefs: ['GB 55020-2021', 'GB 55015-2021'],
  handoffBoundary: 'lifecycle_handoff_only',
  realtimeControl: false
});

describe('production Rysnova artifact service', () => {
  test('marks memory and local artifact storage as ineligible for final launch proof', () => {
    expect(proofCapabilities(new MemoryArtifactStorageAdapter())).toEqual(expect.objectContaining({
      adapterType: 'memory',
      externalRoundTrip: false,
      finalLaunchEligible: false
    }));
    expect(proofCapabilities(new LocalArtifactStorageAdapter({ rootDir: '/tmp/rhautt-rysnova-bim-test-artifacts' }))).toEqual(expect.objectContaining({
      adapterType: 'local-filesystem',
      externalRoundTrip: false,
      finalLaunchEligible: false
    }));
  });

  test('marks configured S3-compatible artifact storage as external launch-proof capable', () => {
    const adapter = new S3CompatibleArtifactStorageAdapter({
      provider: 'minio',
      endpoint: 'https://object-storage.example.test',
      bucket: 'rhautt-nexus-artifacts',
      region: 'cn-east-1',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key'
    });

    expect(proofCapabilities(adapter)).toEqual(expect.objectContaining({
      provider: 'minio',
      adapterType: 's3-compatible',
      externalRoundTrip: true,
      finalLaunchEligible: true
    }));
  });

  test('creates tenant-scoped artifact metadata with standards and content hashes', async () => {
    const repo = {
      create: jest.fn(async (scope, data) => ({ ...data, _id: 'artifact-1' }))
    };
    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-artifact', ...event })) };
    const service = new RysnovaArtifactService({ artifactRepo: repo, outboxService });

    const result = await service.createArtifact(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', storeId: 'store-1', userId: 'designer-1' },
      {
        projectId: 'project-1',
        customerId: '64f000000000000000000501',
        type: 'principle-diagram',
        source: 'rysnova-bim',
        version: 2,
        status: 'reviewing',
        inputs: { systemPack: 'rheem-central-hot-water' },
        content: { nodes: ['tank', 'pump', 'controller'] },
        standards: [
          { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
        ]
      }
    );

    expect(result).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      dealerId: 'dealer-1',
      storeId: 'store-1',
      moduleId: 'rysnova-bim-engineering-support',
      moduleDeploymentMode: 'rhautt-portal-embedded',
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      projectId: 'project-1',
      type: 'principle-diagram',
      version: 2,
      status: 'reviewing',
      objectKey: 'tenant-1/project-1/principle-diagram/v2/principle-diagram.json'
    }));
    expect(result.contentHash).toMatch(/^sha256:/);
    expect(result.inputsHash).toMatch(/^sha256:/);
    expect(result.standards).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GB 55020-2021', level: 'mandatory-general-code', softwareCheck: 'passed' })
    ]));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.objectContaining({ objectKey: 'tenant-1/project-1/principle-diagram/v2/principle-diagram.json' })
    );
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.objectContaining({
        aggregateType: 'rysnova-bim_artifact',
        aggregateId: 'artifact-1',
        eventType: 'rysnova-bim.artifact.created',
        payload: expect.objectContaining({
          projectId: 'project-1',
          moduleId: 'rysnova-bim-engineering-support',
          moduleDeploymentMode: 'rhautt-portal-embedded',
          moduleNamespace: 'rysnova-bim',
          dataNamespace: 'rysnova-bim',
          type: 'principle-diagram',
          contentHash: expect.stringMatching(/^sha256:/)
        })
      })
    );
  });

  test('persists artifact content through object storage adapter and verifies integrity', async () => {
    const storageAdapter = new MemoryArtifactStorageAdapter();
    const repo = {
      create: jest.fn(async (scope, data) => ({ ...data, _id: 'artifact-1' }))
    };
    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter });

    const result = await service.createArtifact(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', userId: 'designer-1' },
      {
        projectId: 'project-1',
        type: 'construction-drawing',
        source: 'rysnova-bim',
        version: 3,
        contentType: 'application/pdf',
        content: '施工图 PDF bytes placeholder',
        metadata: { drawingNo: 'DWG-003' }
      }
    );

    expect(result.objectKey).toBe('tenant-1/project-1/construction-drawing/v3/construction-drawing.pdf');
    expect(result.contentHash).toMatch(/^sha256:/);
    expect(result.metadata.storage).toEqual(expect.objectContaining({
      provider: 'memory-object-storage',
      sizeBytes: expect.any(Number),
      contentType: 'application/pdf'
    }));

    await expect(storageAdapter.verifyObject(result.objectKey, result.contentHash)).resolves.toEqual(
      expect.objectContaining({ exists: true, passed: true })
    );
  });

  test('rejects custom object keys outside the current tenant and project namespace', async () => {
    const storageAdapter = new MemoryArtifactStorageAdapter();
    const repo = {
      create: jest.fn(async (scope, data) => ({ ...data, _id: 'artifact-1' }))
    };
    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter });

    await expect(service.createArtifact(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', userId: 'designer-1' },
      {
        projectId: 'project-1',
        type: 'principle-diagram',
        source: 'rysnova-bim',
        objectKey: 'tenant-2/project-1/principle-diagram/v1/principle-diagram.json',
        content: { nodes: ['wrong-tenant'] }
      }
    )).rejects.toThrow('Rysnova artifact objectKey must be tenant/project scoped');

    await expect(service.createArtifact(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', userId: 'designer-1' },
      {
        projectId: 'project-1',
        type: 'principle-diagram',
        source: 'rysnova-bim',
        objectKey: 'tenant-1/project-1/../escape.json',
        content: { nodes: ['escape'] }
      }
    )).rejects.toThrow('Rysnova artifact objectKey must be tenant/project scoped');

    expect(repo.create).not.toHaveBeenCalled();
  });

  test('supports read-side integrity verification without publishing outbox events', async () => {
    const storageAdapter = new MemoryArtifactStorageAdapter();
    const put = await storageAdapter.putObject({
      objectKey: 'tenant-1/project-1/principle-diagram/v1/principle-diagram.json',
      contentType: 'application/json',
      content: { nodes: ['tank', 'pump'] }
    });
    const artifact = {
      _id: 'artifact-read-integrity-1',
      tenantId: 'tenant-1',
      projectId: 'project-1',
      type: 'principle-diagram',
      version: 1,
      status: 'shared',
      objectKey: put.objectKey,
      contentHash: put.contentHash,
      permissions: { customerVisible: true },
      metadata: { storage: { provider: put.provider } }
    };
    const repo = {
      findById: jest.fn(async () => artifact)
    };
    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-read-side', ...event })) };
    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter, outboxService });

    const result = await service.verifyArtifactIntegrity(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      'artifact-read-integrity-1',
      null,
      { publishEvent: false }
    );

    expect(result).toEqual(expect.objectContaining({
      artifactId: 'artifact-read-integrity-1',
      passed: true,
      expectedContentHash: put.contentHash,
      actualContentHash: put.contentHash
    }));
    expect(outboxService.publish).not.toHaveBeenCalled();
  });

  test('rejects customer sharing when stored artifact content hash does not match metadata', async () => {
    const storageAdapter = new MemoryArtifactStorageAdapter();
    const artifact = {
      _id: 'artifact-1',
      tenantId: 'tenant-1',
      projectId: 'project-1',
      type: 'principle-diagram',
      version: 1,
      status: 'reviewing',
      objectKey: 'tenant-1/project-1/principle-diagram/v1/principle-diagram.json',
      contentHash: 'sha256:expected-but-wrong',
      permissions: { customerVisible: false }
    };
    await storageAdapter.putObject({
      objectKey: artifact.objectKey,
      content: { nodes: ['tampered'] }
    });
    const repo = {
      findById: jest.fn(async () => artifact),
      updateById: jest.fn()
    };
    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter });

    await expect(service.approveArtifact(
      { tenantId: 'tenant-1', userId: 'reviewer-1' },
      'artifact-1',
      { shareToCustomer: true }
    )).rejects.toThrow('Rysnova artifact storage integrity check failed');
    expect(repo.updateById).not.toHaveBeenCalled();
  });

	  test('allows approval without customer sharing for draft metadata while storage catches up', async () => {
	    const storageAdapter = new MemoryArtifactStorageAdapter();
	    const artifact = {
      _id: 'artifact-1',
      tenantId: 'tenant-1',
      projectId: 'project-1',
      type: 'principle-diagram',
      version: 1,
      status: 'reviewing',
      objectKey: 'tenant-1/project-1/principle-diagram/v1/principle-diagram.json',
      contentHash: 'sha256:expected-but-not-yet-uploaded',
      permissions: { customerVisible: false }
    };
    const repo = {
      findById: jest.fn(async () => artifact),
      updateById: jest.fn(async (scope, id, update) => ({ ...artifact, ...update }))
    };
    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-approved', ...event })) };
    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter, outboxService });

    const result = await service.approveArtifact(
      { tenantId: 'tenant-1', userId: 'reviewer-1' },
      'artifact-1',
      { shareToCustomer: false }
    );

    expect(result.status).toBe('approved');
    expect(repo.updateById).toHaveBeenCalled();
    expect(outboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.objectContaining({
        aggregateType: 'rysnova-bim_artifact',
        aggregateId: 'artifact-1',
        eventType: 'rysnova-bim.artifact.approved',
        payload: expect.objectContaining({
          status: 'approved',
          customerVisible: false
        })
      })
	    );
	  });

	  test('repository approval share persists customer visibility and integrity evidence', async () => {
	    const storageAdapter = new MemoryArtifactStorageAdapter();
	    const put = await storageAdapter.putObject({
	      objectKey: 'tenant-1/project-1/bom/v1/bom.json',
	      contentType: 'application/json',
	      content: { items: [{ sku: 'RHEEM-DHW-300', qty: 1 }] }
	    });
	    const artifact = {
	      _id: 'artifact-share-1',
	      tenantId: 'tenant-1',
	      projectId: 'project-1',
	      type: 'bom',
	      version: 1,
	      status: 'reviewing',
	      objectKey: put.objectKey,
	      contentHash: put.contentHash,
	      permissions: { customerVisible: false, dealerVisible: true },
	      metadata: {
	        storage: {
	          provider: put.provider,
	          uri: put.uri,
	          sizeBytes: put.sizeBytes,
	          contentType: put.contentType,
	          updatedAt: put.updatedAt
	        }
	      }
	    };
	    const repo = {
	      findById: jest.fn(async () => artifact),
	      updateById: jest.fn(async (scope, id, update) => ({ ...artifact, ...update, _id: id }))
	    };
	    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-shared', ...event })) };
	    const service = new RysnovaArtifactService({ artifactRepo: repo, storageAdapter, outboxService });

	    const result = await service.approveArtifact(
	      { tenantId: 'tenant-1', userId: 'reviewer-1' },
	      'artifact-share-1',
	      { shareToCustomer: true }
	    );

	    expect(result.status).toBe('shared');
	    expect(result.permissions).toEqual(expect.objectContaining({
	      customerVisible: true,
	      dealerVisible: true
	    }));
	    expect(result.metadata.integrity).toEqual(expect.objectContaining({
	      passed: true,
	      expectedContentHash: put.contentHash,
	      actualContentHash: put.contentHash
	    }));
	    expect(result.metadata.storage).toEqual(expect.objectContaining({
	      provider: put.provider,
	      integrityPassed: true,
	      integrityCheckedAt: expect.any(String)
	    }));
	    expect(repo.updateById).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1' }),
	      'artifact-share-1',
	      expect.objectContaining({
	        status: 'shared',
	        permissions: expect.objectContaining({ customerVisible: true }),
	        metadata: expect.objectContaining({
	          integrity: expect.objectContaining({ passed: true }),
	          storage: expect.objectContaining({ integrityPassed: true })
	        })
	      })
	    );
	    expect(outboxService.publish).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1' }),
	      expect.objectContaining({
	        eventType: 'rysnova-bim.artifact.integrity.verified',
	        payload: expect.objectContaining({
	          artifactId: 'artifact-share-1',
	          customerVisible: false,
	          contentHash: put.contentHash
	        })
	      })
	    );
	    expect(outboxService.publish).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1' }),
	      expect.objectContaining({
	        eventType: 'rysnova-bim.artifact.shared',
	        payload: expect.objectContaining({
	          artifactId: 'artifact-share-1',
	          customerVisible: true,
	          contentHash: put.contentHash
	        })
	      })
	    );
	  });

	  test('filters customer package to approved or shared customer-visible artifacts', async () => {
	    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-unexpected', ...event })) };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      outboxService,
      memoryDb: {
        rysnovaBimArtifacts: [
          {
            id: 'a1',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            type: 'customer-report',
            status: 'shared',
            permissions: { customerVisible: true }
          },
          {
            id: 'a2',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            type: 'bom',
            status: 'approved',
            permissions: { customerVisible: true }
          },
          {
            id: 'a3',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            type: 'principle-diagram',
            status: 'reviewing',
            permissions: { customerVisible: true }
          },
          {
            id: 'a4',
            tenantId: 'tenant-2',
            projectId: 'project-1',
            type: 'customer-report',
            status: 'shared',
            permissions: { customerVisible: true }
          }
        ]
      }
    });

    const result = await service.buildCustomerPackage({ tenantId: 'tenant-1' }, 'project-1');

	    expect(result.count).toBe(2);
	    expect(result.artifacts.map(item => item.id)).toEqual(['a1', 'a2']);
	    expect(result.requiredTypes).toEqual([
	      'principle-diagram',
	      'construction-drawing',
	      'bim-model',
	      'bom',
	      'quantity-takeoff',
	      'standards-check',
	      'customer-report'
	    ]);
	    expect(result.missingTypes).toEqual([
	      'principle-diagram',
	      'construction-drawing',
	      'bim-model',
	      'quantity-takeoff',
	      'standards-check'
	    ]);
	    expect(result.visibility.hiddenFields).toEqual(expect.arrayContaining([
	      'dealerMargin',
	      'costBaseline',
	      'internalApprovalNotes',
	      'metadata',
	      'permissions'
	    ]));
	    expect(outboxService.publish).not.toHaveBeenCalledWith(
	      expect.anything(),
	      expect.objectContaining({ eventType: 'rysnova-bim.customer_package.ready' })
	    );
	  });

	  test('sanitizes customer package artifacts, hides internal commercial fields, and emits package-ready outbox', async () => {
	    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-customer-package-ready', ...event })) };
	    const visualTraceability = {
	      traceabilityId: 'visual-trace-customer-package',
	      sourceHash: 'sha256:customer-package-visual-source',
	      tier: 'balanced',
	      project: { name: '客户签收包', city: '上海', area: 168, houseType: '大平层' },
	      systemCount: 1,
	      systemNodes: [
	        {
	          nodeId: 'hot_water-1',
	          sourceSystemId: 'hot_water',
	          type: 'hot_water',
	          name: '中央热水系统',
	          drawingRefs: {
	            principleDiagramNode: 'principle-node-1',
	            layoutDeviceNode: 'layout-device-1',
	            scene3dDeviceNode: 'scene3d-device-1'
	          }
	        }
	      ],
	      visualArtifacts: {
	        principleDiagram: 'principle-diagram',
	        layout2d: 'construction-drawing',
	        scene3d: 'bim-model'
	      },
	      standardsRefs: ['GB 55020-2021'],
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false
	    };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      outboxService,
	      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            id: 'customer-bom',
	            tenantId: 'tenant-1',
	            dealerId: 'dealer-secret',
	            storeId: 'store-secret',
	            projectId: 'project-customer-package',
	            type: 'bom',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/bom/v1/bom.json',
	            contentHash: 'sha256:customer-bom-hash',
	            permissions: { customerVisible: true, dealerVisible: true, headquartersVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 512,
	                contentType: 'application/json',
	                integrityPassed: true
	              },
	              bomSummary: {
	                itemCount: 12,
	                currency: 'CNY',
	                totalCost: 180000,
	                costBreakdown: {
	                  directCost: 150000,
	                  dealerMargin: 30000,
	                  costBaseline: 148000
	                }
		              },
		              quoteCostSummary: {
		                quotationSummary: { quotationNo: 'Q-CUSTOMER-001', status: 'draft-ready', tier: 'balanced', customerTotal: 230000, currency: 'CNY' },
		                costBreakdown: {
		                  directCost: 150000,
		                  dealerMargin: 80000,
		                  costBaseline: 148000
		                },
		                marginGuard: { status: 'pass', targetMarginRate: 0.26 },
		                systemQuoteExplanations: [
		                  {
		                    systemFamily: 'water',
		                    systemName: '中央热水系统',
		                    standardsDomains: ['hot-water-safety', 'potable-water'],
		                    quoteDrivers: ['热源容量', '循环泵'],
		                    deliverableEvidence: ['热水负荷计算'],
		                    lifecycleHandoffImpact: ['water_temperature', 'service_ticket'],
		                    itemIds: ['water-equipment-1', 'water-pipe-1'],
		                    itemCount: 2,
		                    customerSafeExplanation: '中央热水报价由设备、管路/附件、控制点和安装调试组成。'
		                  }
		                ],
		                installedAssetHandoff: {
		                  handoffBoundary: 'lifecycle_handoff_only',
		                  realtimeControl: false,
		                  targetPlatform: 'external-iot-lifecycle-platform',
		                  assetCount: 1,
		                  standardsCoverageImpact: completeStandardsCoverageImpact,
		                  assets: [
		                    {
		                      assetId: 'project-customer-package-water-01',
		                      systemFamily: 'water',
		                      category: 'hot_water',
		                      systemName: '中央热水系统',
		                      brand: 'Rheem',
		                      model: 'DHW-CENTRAL',
		                      iotBinding: { status: 'handoff-ready-not-bound', realtimeControl: false }
		                    }
		                  ]
		                },
                    standardsCoverageImpact: completeStandardsCoverageImpact
		              },
	              internalApprovalNotes: 'do not expose to customer'
	            },
	            standards: [
	              { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed', note: 'internal passed note' }
	            ],
	            createdBy: 'internal-user',
	            approvedBy: 'internal-reviewer',
	            updatedAt: '2026-06-12T08:00:00.000Z'
	          },
	          {
	            id: 'customer-report',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'customer-report',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/customer-report/v1/customer-report.json',
	            contentHash: 'sha256:customer-report-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 1024,
	                contentType: 'application/pdf',
	                integrityPassed: true
	              },
	              customerFacingReport: true,
	              internalApprovalNotes: 'hidden'
	            }
	          },
	          {
	            id: 'customer-principle',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'principle-diagram',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/principle-diagram/v1/principle-diagram.svg',
	            contentHash: 'sha256:customer-principle-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 2048,
	                contentType: 'image/svg+xml',
	                integrityPassed: true
	              },
	              label: '设计原理图',
	              visualTraceability,
	              visualQualityEvidence: visualQualityEvidenceForTest('principle-diagram', visualTraceability),
	              internalApprovalNotes: 'hidden'
	            }
	          },
	          {
	            id: 'customer-drawing',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'construction-drawing',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/construction-drawing/v1/construction-drawing.svg',
	            contentHash: 'sha256:customer-drawing-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 4096,
	                contentType: 'image/svg+xml',
	                integrityPassed: true
	              },
	              label: '2D布局图',
	              drawingType: 'layout-2d',
	              visualTraceability,
	              visualQualityEvidence: visualQualityEvidenceForTest('construction-drawing', visualTraceability)
	            }
	          },
	          {
	            id: 'customer-bim',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'bim-model',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/bim-model/v1/bim-model.json',
	            contentHash: 'sha256:customer-bim-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 8192,
	                contentType: 'application/vnd.rhautt.rysnova-bim.scene3d+json',
	                integrityPassed: true
	              },
	              label: '3D示意图',
	              visualTraceability,
	              visualQualityEvidence: visualQualityEvidenceForTest('bim-model', visualTraceability)
	            }
	          },
	          {
	            id: 'customer-quantity',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'quantity-takeoff',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/quantity-takeoff/v1/quantity-takeoff.json',
	            contentHash: 'sha256:customer-quantity-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 1024,
	                contentType: 'application/json',
	                integrityPassed: true
	              },
	              quantityTakeoffSummary: { pipeMeters: 86, valves: 18 }
	            }
	          },
	          {
	            id: 'customer-standards',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-package',
	            type: 'standards-check',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-package/standards-check/v1/standards-check.json',
	            contentHash: 'sha256:customer-standards-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 1024,
	                contentType: 'application/json',
	                integrityPassed: true
	              },
	              standardsSummary: { passed: true, counts: { failed: 0, warning: 0 } }
	            }
	          }
	        ]
	      }
	    });

	    const result = await service.buildCustomerPackage({ tenantId: 'tenant-1' }, 'project-customer-package');
	    const serialized = JSON.stringify(result.artifacts);

	    expect(result.count).toBe(7);
	    expect(result.requiredTypes).toEqual([
	      'principle-diagram',
	      'construction-drawing',
	      'bim-model',
	      'bom',
	      'quantity-takeoff',
	      'standards-check',
	      'customer-report'
	    ]);
	    expect(result.missingTypes).toEqual([]);
	    expect(result.artifacts[0]).toEqual(expect.objectContaining({
	      id: 'customer-bom',
	      type: 'bom',
	      objectKey: 'tenant-1/project-customer-package/bom/v1/bom.json',
	      contentHash: 'sha256:customer-bom-hash',
	      customerVisible: true,
	      storage: expect.objectContaining({
	        provider: 's3-compatible-object-storage',
	        integrityPassed: true
	      }),
	      summary: expect.objectContaining({
	        itemCount: 12,
	        currency: 'CNY',
	        customerTotal: 230000
	      }),
	      qualityGate: expect.objectContaining({
	        passed: true,
	        status: 'passed',
	        checks: expect.objectContaining({
	          approvedForCustomer: true,
	          storageReady: true,
	          integrityPassed: true,
	          standardsPassed: true
	        }),
	        blockers: []
	      }),
	      signoff: expect.objectContaining({
	        approved: true,
	        customerVisible: true
	      }),
	      deliveryStage: 'customer-ready'
	    }));
	    expect(result.readiness.packageReady).toBe(true);
	    expect(result.quoteSummary.standardsCoverageImpact).toEqual(expect.objectContaining({
	      status: 'complete',
	      quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器']),
	      deliverableEvidence: expect.arrayContaining(['热水负荷计算', 'IoT 设备绑定清单']),
	      lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
	    }));
	    expect(result.selectedTierDecision).toEqual(expect.objectContaining({
	      tier: 'balanced',
	      tierName: '均衡方案',
	      positioning: expect.stringContaining('舒适、预算和后期服务均衡'),
	      selectionRationale: expect.stringContaining('签收回执冻结该档位'),
	      commercialDecision: expect.objectContaining({
	        commercialApprovalStatus: 'pass',
	        internalCostHiddenFromCustomer: true
	      }),
	      standardsDecision: expect.objectContaining({
	        coverageStatus: 'complete',
	        quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器'])
	      }),
	      lifecycleDecision: expect.objectContaining({
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false,
	        assetCount: 1
	      }),
	      customerSafe: true
	    }));
	    expect(result.lifecycleHandoff.standardsCoverageImpact).toEqual(expect.objectContaining({
	      status: 'complete',
	      lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket']),
	      deliverableEvidence: expect.arrayContaining(['热水负荷计算', 'IoT 设备绑定清单'])
	    }));
	    expect(result.engineeringTraceabilityManifest).toEqual(expect.objectContaining({
	      manifestId: expect.stringMatching(/^rysnova-bim-trace-/),
	      projectId: 'project-customer-package',
	      tier: 'balanced',
	      traceability: expect.objectContaining({
	        traceabilityId: 'visual-trace-customer-package',
	        systemCount: 1,
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false
	      }),
	      linkedArtifacts: expect.objectContaining({
	        principleDiagram: expect.objectContaining({ artifactId: 'customer-principle', role: 'principle-diagram' }),
	        layout2d: expect.objectContaining({ artifactId: 'customer-drawing', role: 'layout-2d' }),
	        scene3d: expect.objectContaining({ artifactId: 'customer-bim', role: 'bim-or-3d-preview' }),
	        bom: expect.objectContaining({ artifactId: 'customer-bom', role: 'commercial-bom' })
	      }),
	      drawingToCommercialLinks: expect.arrayContaining([
	        expect.objectContaining({
	          systemFamily: 'water',
	          itemIds: expect.arrayContaining(['water-equipment-1']),
	          quoteDrivers: expect.arrayContaining(['热源容量', '循环泵'])
	        })
	      ]),
	      commercialTraceability: expect.objectContaining({
	        quoteStatus: 'draft-ready',
	        commercialApprovalStatus: 'pass',
	        internalCostHiddenFromCustomer: true
	      }),
	      lifecycleTraceability: expect.objectContaining({
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false,
	        assetIds: expect.arrayContaining(['project-customer-package-water-01'])
	      })
	    }));
	    expect(result.customerSignoffManifest.engineeringTraceabilityManifest).toEqual(
	      expect.objectContaining({
	        manifestId: result.engineeringTraceabilityManifest.manifestId,
	        boundary: expect.objectContaining({
	          customerSafe: true,
	          internalCostHiddenFromCustomer: true
	        })
	      })
	    );
	    expect(result.customerSignoffManifest.selectedTierDecision).toEqual(
	      expect.objectContaining({
	        tier: 'balanced',
	        customerSafe: true,
	        commercialDecision: expect.objectContaining({
	          internalCostHiddenFromCustomer: true
	        }),
	        lifecycleDecision: expect.objectContaining({
	          realtimeControl: false
	        })
	      })
	    );
	    expect(result.deliveryStage).toBe('customer-signoff-ready');
	    expect(result.qualityGateSummary).toEqual(expect.objectContaining({
	      passed: true,
	      requiredTypes: [
	        'principle-diagram',
	        'construction-drawing',
	        'bim-model',
	        'bom',
	        'quantity-takeoff',
	        'standards-check',
	        'customer-report'
	      ],
	      missingTypes: [],
	      failedArtifacts: [],
	      checkedAt: expect.any(String)
	    }));
	    for (const forbidden of [
	      'dealer-secret',
	      'store-secret',
	      'createdBy',
	      'approvedBy',
	      'permissions',
	      'metadata',
	      'dealerMargin',
	      'costBaseline',
	      'internalApprovalNotes',
	      'directCost',
	      'marginGuard'
	    ]) {
	      expect(serialized).not.toContain(forbidden);
	    }
	    expect(outboxService.publish).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1' }),
	      expect.objectContaining({
	        aggregateType: 'rysnova-bim_customer_package',
	        aggregateId: 'project-customer-package',
	        eventType: 'rysnova-bim.customer_package.ready',
	        payload: expect.objectContaining({
	          projectId: 'project-customer-package',
	          count: 7,
	          requiredTypes: [
	            'principle-diagram',
	            'construction-drawing',
	            'bim-model',
	            'bom',
	            'quantity-takeoff',
	            'standards-check',
	            'customer-report'
	          ],
	          missingTypes: [],
	          customerVisible: true,
	          customerSignoffReady: true
	        })
	      })
	    );
	  });

	  test('confirms customer signoff with a customer-safe receipt and lifecycle-only outbox event', async () => {
	    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-customer-signoff', ...event })) };
	    const visualTraceability = {
	      traceabilityId: 'visual-trace-customer-signoff',
	      sourceHash: 'sha256:customer-signoff-visual-source',
	      tier: 'balanced',
	      project: { name: '客户确认项目', city: '上海', area: 168, houseType: '大平层' },
	      systemCount: 1,
	      systemNodes: [
	        {
	          nodeId: 'hot_water-1',
	          sourceSystemId: 'hot_water',
	          type: 'hot_water',
	          name: '中央热水系统',
	          drawingRefs: {
	            principleDiagramNode: 'principle-node-1',
	            layoutDeviceNode: 'layout-device-1',
	            scene3dDeviceNode: 'scene3d-device-1'
	          }
	        }
	      ],
	      visualArtifacts: {
	        principleDiagram: 'principle-diagram',
	        layout2d: 'construction-drawing',
	        scene3d: 'bim-model'
	      },
	      standardsRefs: ['GB 55020-2021'],
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false
	    };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      outboxService,
	      now: () => new Date('2026-06-12T08:30:00.000Z'),
	      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            id: 'signoff-bom',
	            tenantId: 'tenant-1',
	            customerId: 'customer-1',
	            projectId: 'project-customer-signoff',
	            type: 'bom',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-signoff/bom/v1/bom.json',
	            contentHash: 'sha256:signoff-bom-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: { provider: 's3-compatible-object-storage', sizeBytes: 512, contentType: 'application/json', integrityPassed: true },
	              bomSummary: { itemCount: 12, currency: 'CNY', totalCost: 180000 },
	              quoteCostSummary: {
	                quotationSummary: { quotationNo: 'Q-SIGNOFF-001', status: 'draft-ready', tier: 'balanced', customerTotal: 230000, monthlyPayment: 6389, validDays: 30, currency: 'CNY' },
	                costBreakdown: { directCost: 150000, targetBeforeTax: 211009, taxAmount: 18991, customerTotal: 230000 },
	                marginGuard: { status: 'pass', targetMarginRate: 0.26 },
	                systemQuoteExplanations: [
	                  {
	                    systemFamily: 'water',
	                    systemName: '中央热水系统',
	                    standardsDomains: ['hot-water-safety', 'potable-water'],
	                    quoteDrivers: ['热源容量', '循环泵'],
	                    deliverableEvidence: ['热水负荷计算'],
	                    lifecycleHandoffImpact: ['water_temperature', 'service_ticket'],
	                    itemIds: ['water-equipment-1', 'water-pipe-1'],
	                    itemCount: 2,
	                    customerSafeExplanation: '中央热水报价由设备、管路/附件、控制点和安装调试组成。'
	                  }
	                ],
	                installedAssetHandoff: {
	                  handoffBoundary: 'lifecycle_handoff_only',
	                  realtimeControl: false,
	                  targetPlatform: 'external-iot-lifecycle-platform',
	                  assetCount: 1,
	                  standardsCoverageImpact: completeStandardsCoverageImpact,
	                  assets: [
	                    {
	                      assetId: 'project-customer-signoff-water-01',
	                      systemFamily: 'water',
	                      category: 'hot_water',
	                      systemName: '中央热水系统',
	                      brand: 'Rheem',
	                      model: 'DHW-CENTRAL',
	                      iotBinding: { status: 'handoff-ready-not-bound', realtimeControl: false }
	                    }
	                  ]
	                },
	                standardsCoverageImpact: completeStandardsCoverageImpact
	              }
	            },
	            standards: [{ code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
	          },
	          ...[
	            ['signoff-principle', 'principle-diagram', 'principle-diagram.svg', 'image/svg+xml'],
	            ['signoff-drawing', 'construction-drawing', 'construction-drawing.svg', 'image/svg+xml'],
	            ['signoff-bim', 'bim-model', 'bim-model.json', 'application/json'],
	            ['signoff-quantity', 'quantity-takeoff', 'quantity-takeoff.json', 'application/json'],
	            ['signoff-standards', 'standards-check', 'standards-check.json', 'application/json'],
	            ['signoff-report', 'customer-report', 'customer-report.json', 'application/json']
	          ].map(([id, type, fileName, contentType]) => ({
	            id,
	            tenantId: 'tenant-1',
	            customerId: 'customer-1',
	            projectId: 'project-customer-signoff',
	            type,
	            version: 1,
	            status: 'shared',
	            objectKey: `tenant-1/project-customer-signoff/${type}/v1/${fileName}`,
	            contentHash: `sha256:${id}-hash`,
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 1024,
	                contentType,
	                integrityPassed: true
	              },
	              ...(type === 'quantity-takeoff' ? { quantityTakeoffSummary: { pipeMeters: 86, valves: 18 } } : {}),
	              ...(type === 'standards-check' ? { standardsSummary: { passed: true, counts: { failed: 0, warning: 0 } } } : {}),
	              ...(type === 'customer-report' ? { customerFacingReport: true } : { label: type }),
	              ...(['principle-diagram', 'construction-drawing', 'bim-model'].includes(type) ? {
	                visualTraceability,
	                visualQualityEvidence: visualQualityEvidenceForTest(type, visualTraceability),
	                ...(type === 'construction-drawing' ? { drawingType: 'layout-2d' } : {})
	              } : {})
	            },
	            standards: [{ code: 'GB 55015-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
	          }))
	        ]
	      }
	    });

	    const result = await service.confirmCustomerSignoff(
	      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1', userId: 'customer-1' },
	      'project-customer-signoff',
	      {
	        acknowledgements: [
	          'solution-scope-reviewed',
	          'quotation-summary-reviewed',
	          'engineering-deliverables-received',
	          'standards-precheck-reviewed',
	          'lifecycle-handoff-boundary-reviewed'
	        ],
	        method: 'customer_portal_confirmation',
	        signerName: '张先生',
	        signerMobile: '13800000000',
	        signatureEvidence: { ip: '127.0.0.1', userAgent: 'jest' },
	        termsVersion: 'rysnova-bim-signoff-v1',
	        confirmedAt: '2026-06-12T08:30:00.000Z'
	      }
	    );

	    expect(result.status).toBe('customer-signoff-confirmed');
	    expect(result.customerPackage.readiness.packageReady).toBe(true);
	    expect(result.customerSignoffManifest.ready).toBe(true);
	    expect(result.customerPackage.engineeringTraceabilityManifest).toEqual(expect.objectContaining({
	      manifestId: expect.stringMatching(/^rysnova-bim-trace-/),
	      projectId: 'project-customer-signoff',
	      tier: 'balanced',
	      traceability: expect.objectContaining({
	        traceabilityId: 'visual-trace-customer-signoff',
	        systemCount: 1,
	        realtimeControl: false
	      }),
	      drawingToCommercialLinks: expect.arrayContaining([
	        expect.objectContaining({
	          systemFamily: 'water',
	          itemIds: expect.arrayContaining(['water-equipment-1'])
	        })
	      ])
	    }));
	    expect(result.customerSignoffManifest.engineeringTraceabilityManifest).toEqual(
	      expect.objectContaining({
	        manifestId: result.customerPackage.engineeringTraceabilityManifest.manifestId,
	        lifecycleTraceability: expect.objectContaining({
	          handoffBoundary: 'lifecycle_handoff_only',
	          realtimeControl: false,
	          assetIds: expect.arrayContaining(['project-customer-signoff-water-01'])
	        })
	      })
	    );
	    expect(result.customerPackage.selectedTierDecision).toEqual(expect.objectContaining({
	      tier: 'balanced',
	      customerSafe: true,
	      riskControls: expect.arrayContaining(['仅交接生命周期资产，不开放实时控制'])
	    }));
	    expect(result.customerSignoffManifest.selectedTierDecision).toEqual(expect.objectContaining({
	      tier: 'balanced',
	      selectionRationale: expect.stringContaining('签收回执冻结该档位')
	    }));
	    expect(result.receipt).toEqual(expect.objectContaining({
	      receiptNo: expect.stringMatching(/^LITH-SIGNOFF-/),
	      packageType: 'rysnova-bim-customer-signoff-receipt',
	      status: 'customer-signed',
	      tenantId: 'tenant-1',
	      selectedTierDecision: expect.objectContaining({
	        tier: 'balanced',
	        customerSafe: true,
	        lifecycleDecision: expect.objectContaining({
	          handoffBoundary: 'lifecycle_handoff_only',
	          realtimeControl: false
	        })
	      }),
	      customerId: 'customer-1',
	      artifactCount: 7,
	      boundary: expect.objectContaining({
	        customerSafe: true,
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false,
	        noRealtimeControlGranted: true
	      }),
	      customerSignature: expect.objectContaining({
	        method: 'customer_portal_confirmation',
	        signerName: '张先生',
	        signerMobileHash: expect.stringMatching(/^sha256:/),
	        evidenceHash: expect.stringMatching(/^sha256:/),
	        termsVersion: 'rysnova-bim-signoff-v1',
	        confirmedAt: '2026-06-12T08:30:00.000Z'
	      })
	    }));
	    const receiptText = JSON.stringify(result.receipt);
	    expect(receiptText).not.toContain('13800000000');
	    expect(receiptText).not.toContain('127.0.0.1');
	    expect(result.receipt.lifecycleHandoff).toEqual(expect.objectContaining({
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false,
	      standardsCoverageImpact: expect.objectContaining({
	        status: 'complete',
	        lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
	      })
	    }));
	    expect(outboxService.publish).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' }),
	      expect.objectContaining({
	        aggregateType: 'rysnova-bim_customer_signoff',
	        eventType: 'rysnova-bim.customer_signoff.confirmed',
	        payload: expect.objectContaining({
	          projectId: 'project-customer-signoff',
	          receiptNo: result.receipt.receiptNo,
	          manifestId: result.receipt.manifestId,
	          customerId: 'customer-1',
	          status: 'customer-signed',
	          artifactCount: 7,
	          handoffBoundary: 'lifecycle_handoff_only',
	          realtimeControl: false,
	          confirmedAt: '2026-06-12T08:30:00.000Z'
	        })
	      })
	    );

	    await expect(service.confirmCustomerSignoff(
	      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
	      'project-customer-signoff',
	      { acknowledgements: ['solution-scope-reviewed'] }
	    )).rejects.toThrow('Rysnova customer signoff acknowledgements are incomplete');

	    await expect(service.confirmCustomerSignoff(
	      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
	      'project-customer-signoff',
	      {
	        acknowledgements: [
	          'solution-scope-reviewed',
	          'quotation-summary-reviewed',
	          'engineering-deliverables-received',
	          'standards-precheck-reviewed',
	          'lifecycle-handoff-boundary-reviewed'
	        ],
	        method: 'raw-signature-upload'
	      }
	    )).rejects.toThrow('unsupported Rysnova customer signoff method');

	    await expect(service.confirmCustomerSignoff(
	      { tenantId: 'tenant-1', role: 'customer', customerId: 'other-customer' },
	      'project-customer-signoff',
	      {
	        acknowledgements: [
	          'solution-scope-reviewed',
	          'quotation-summary-reviewed',
	          'engineering-deliverables-received',
	          'standards-precheck-reviewed',
	          'lifecycle-handoff-boundary-reviewed'
	        ]
	      }
	    )).rejects.toThrow('Rysnova customer package not found');
	  });

	  test('requires an explicit matching customer id when staff confirms Rysnova customer signoff', async () => {
	    const outboxService = { publish: jest.fn(async (scope, event) => ({ _id: 'outbox-staff-signoff', ...event })) };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      memoryDb: { rysnovaBimArtifacts: [] },
	      outboxService,
	      now: () => new Date('2026-06-12T09:00:00.000Z')
	    });
	    const scope = {
	      tenantId: 'tenant-1',
	      dealerId: 'dealer-1',
	      storeId: 'store-1',
	      role: 'designer',
	      userId: 'designer-1'
	    };
	    const acknowledgements = [
	      'solution-scope-reviewed',
	      'quotation-summary-reviewed',
	      'engineering-deliverables-received',
	      'standards-precheck-reviewed',
	      'lifecycle-handoff-boundary-reviewed'
	    ];

	    await service.generateSignoffPackage(scope, 'project-staff-signoff', {
	      approvalMode: 'share-to-customer',
	      customerId: 'customer-1',
	      tier: 'balanced',
	      project: {
	        name: '员工协助签收项目',
	        city: '上海',
	        area: 168,
	        houseType: '大平层',
	        contractId: 'CNT-LITH-STAFF-SIGNOFF-001'
	      },
	      pricing: {
	        targetMarginRate: 0.26,
	        minMarginRate: 0.18,
	        taxRate: 0.09,
	        financingMonths: 36
	      },
	      systems: [
	        { type: 'hot_water', name: 'Rheem 中央热水' },
	        { type: 'heating', name: 'Ruud 低温采暖' },
	        { type: 'water_treatment', name: 'Everhot 全屋净水' },
	        { type: 'fresh_air', name: 'Ruud 新风' },
	        { type: 'air', name: 'Ruud 全空气' },
	        { type: 'smart_control', name: '智能控制' }
	      ]
	    });

	    await expect(service.confirmCustomerSignoff(
	      scope,
	      'project-staff-signoff',
	      {
	        acknowledgements,
	        method: 'dealer_assisted_confirmation'
	      }
	    )).rejects.toMatchObject({
	      message: 'customerId is required for Rysnova customer signoff confirmation',
	      status: 403
	    });

	    await expect(service.confirmCustomerSignoff(
	      scope,
	      'project-staff-signoff',
	      {
	        customerId: 'customer-2',
	        acknowledgements,
	        method: 'dealer_assisted_confirmation'
	      }
	    )).rejects.toMatchObject({
	      message: 'Rysnova customer signoff package must belong to exactly one matching customer',
	      status: 409
	    });

	    const result = await service.confirmCustomerSignoff(
	      scope,
	      'project-staff-signoff',
	      {
	        customerId: 'customer-1',
	        acknowledgements,
	        method: 'dealer_assisted_confirmation',
	        signerName: '客户授权签收',
	        signerMobile: '13800000000',
	        signatureEvidence: { ip: '127.0.0.1', device: 'dealer-tablet' },
	        confirmedAt: '2026-06-12T09:10:00.000Z'
	      }
	    );

	    expect(result.status).toBe('customer-signoff-confirmed');
	    expect(result.receipt).toEqual(expect.objectContaining({
	      packageType: 'rysnova-bim-customer-signoff-receipt',
	      customerId: 'customer-1',
	      boundary: expect.objectContaining({
	        customerSafe: true,
	        handoffBoundary: 'lifecycle_handoff_only',
	        realtimeControl: false
	      }),
	      customerSignature: expect.objectContaining({
	        method: 'dealer_assisted_confirmation',
	        signerMobileHash: expect.stringMatching(/^sha256:/),
	        evidenceHash: expect.stringMatching(/^sha256:/)
	      })
	    }));
	    const receiptText = JSON.stringify(result.receipt);
	    expect(receiptText).not.toContain('13800000000');
	    expect(receiptText).not.toContain('127.0.0.1');
	    expect(outboxService.publish).toHaveBeenCalledWith(
	      expect.objectContaining({ tenantId: 'tenant-1', role: 'designer' }),
	      expect.objectContaining({
	        aggregateType: 'rysnova-bim_customer_signoff',
	        eventType: 'rysnova-bim.customer_signoff.confirmed',
	        payload: expect.objectContaining({
	          projectId: 'project-staff-signoff',
	          customerId: 'customer-1',
	          handoffBoundary: 'lifecycle_handoff_only',
	          realtimeControl: false
	        })
	      })
	    );
	  });

	  test('builds sanitized customer package through repository path with tenant-scoped query', async () => {
	    const repo = {
	      list: jest.fn(async (scope, query, options) => ({
	        items: [
	          {
	            _id: 'repo-bom',
	            tenantId: scope.tenantId,
	            dealerId: 'dealer-secret',
	            projectId: query.projectId,
	            type: 'bom',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-repo/bom/v1/bom.json',
	            contentHash: 'sha256:repo-bom-hash',
	            permissions: { customerVisible: true },
	            metadata: {
	              storage: {
	                provider: 's3-compatible-object-storage',
	                sizeBytes: 512,
	                contentType: 'application/json',
	                integrityPassed: true
	              },
	              bomSummary: { itemCount: 8, currency: 'CNY', costBreakdown: { dealerMargin: 42000 } },
	              quoteCostSummary: {
	                quotationSummary: { customerTotal: 198000, currency: 'CNY' },
	                costBreakdown: { directCost: 130000, dealerMargin: 68000, costBaseline: 128000 },
	                marginGuard: { status: 'pass' }
	              },
	              internalApprovalNotes: 'repo hidden'
	            }
	          },
	          {
	            _id: 'repo-reviewing',
	            tenantId: scope.tenantId,
	            projectId: query.projectId,
	            type: 'customer-report',
	            version: 1,
	            status: 'reviewing',
	            objectKey: 'tenant-1/project-repo/customer-report/v1/customer-report.json',
	            contentHash: 'sha256:hidden',
	            permissions: { customerVisible: true },
	            metadata: { internalApprovalNotes: 'not shared' }
	          },
	          {
	            _id: 'repo-not-visible',
	            tenantId: scope.tenantId,
	            projectId: query.projectId,
	            type: 'principle-diagram',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-repo/principle-diagram/v1/principle-diagram.svg',
	            contentHash: 'sha256:not-visible',
	            permissions: { customerVisible: false },
	            metadata: { internalApprovalNotes: 'not visible' }
	          }
	        ],
	        pagination: { page: 1, limit: 100, total: 3, pages: 1 }
	      }))
	    };
	    const service = new RysnovaArtifactService({ artifactRepo: repo });

	    const result = await service.buildCustomerPackage({ tenantId: 'tenant-1' }, 'project-repo');
	    const artifactText = JSON.stringify(result.artifacts);

	    expect(repo.list).toHaveBeenCalledWith(
	      { tenantId: 'tenant-1' },
	      {
	        projectId: 'project-repo',
	        status: { $in: ['approved', 'shared'] },
	        'permissions.customerVisible': true
	      },
	      expect.objectContaining({
	        limit: undefined,
	        sort: { updatedAt: -1 }
	      })
	    );
	    expect(result.count).toBe(1);
	    expect(result.artifacts).toEqual([
	      expect.objectContaining({
	        id: 'repo-bom',
	        type: 'bom',
	        customerVisible: true,
	        summary: expect.objectContaining({
	          itemCount: 8,
	          customerTotal: 198000
	        }),
	        qualityGate: expect.objectContaining({
	          passed: true,
	          checks: expect.objectContaining({
	            storageReady: true,
	            integrityPassed: true
	          })
	        }),
	        deliveryStage: 'customer-ready'
	      })
	    ]);
	    expect(result.readiness.packageReady).toBe(false);
	    expect(result.deliveryStage).toBe('customer-review-incomplete');
	    expect(result.qualityGateSummary).toEqual(expect.objectContaining({
	      passed: false,
	      missingTypes: expect.arrayContaining([
	        'principle-diagram',
	        'construction-drawing',
	        'bim-model',
	        'quantity-takeoff',
	        'standards-check',
	        'customer-report'
	      ])
	    }));
	    for (const forbidden of [
	      'dealer-secret',
	      'permissions',
	      'metadata',
	      'dealerMargin',
	      'costBaseline',
	      'internalApprovalNotes',
	      'directCost',
	      'marginGuard',
	      'repo-reviewing',
	      'repo-not-visible'
	    ]) {
	      expect(artifactText).not.toContain(forbidden);
	    }
	  });

	  test('customer role can only build package for matching customer-owned artifacts', async () => {
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            id: 'own-report',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-owned',
	            customerId: 'customer-1',
	            type: 'customer-report',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-owned/customer-report/v1/customer-report.json',
	            contentHash: 'sha256:own-report',
	            permissions: { customerVisible: true },
	            metadata: { storage: { provider: 'memory-object-storage', integrityPassed: true } }
	          },
	          {
	            id: 'other-report',
	            tenantId: 'tenant-1',
	            projectId: 'project-customer-owned',
	            customerId: 'customer-2',
	            type: 'customer-report',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-customer-owned/customer-report/v1/customer-report-other.json',
	            contentHash: 'sha256:other-report',
	            permissions: { customerVisible: true },
	            metadata: { storage: { provider: 'memory-object-storage', integrityPassed: true } }
	          }
	        ]
	      }
	    });

	    const result = await service.buildCustomerPackage({
	      tenantId: 'tenant-1',
	      role: 'customer',
	      customerId: 'customer-1'
	    }, 'project-customer-owned');

	    expect(result.count).toBe(1);
	    expect(result.artifacts).toEqual([
	      expect.objectContaining({ id: 'own-report', type: 'customer-report' })
	    ]);
	    expect(JSON.stringify(result.artifacts)).not.toContain('other-report');
	  });

	  test('customer role cannot enumerate another customer package or omit customer identity', async () => {
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            id: 'other-report',
	            tenantId: 'tenant-1',
	            projectId: 'project-other-customer',
	            customerId: 'customer-2',
	            type: 'customer-report',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-other-customer/customer-report/v1/customer-report.json',
	            contentHash: 'sha256:other-report',
	            permissions: { customerVisible: true },
	            metadata: { storage: { provider: 'memory-object-storage', integrityPassed: true } }
	          }
	        ]
	      }
	    });

	    await expect(service.buildCustomerPackage({
	      tenantId: 'tenant-1',
	      role: 'customer',
	      customerId: 'customer-1'
	    }, 'project-other-customer')).rejects.toMatchObject({
	      message: 'Rysnova customer package not found',
	      status: 404
	    });

	    await expect(service.buildCustomerPackage({
	      tenantId: 'tenant-1',
	      role: 'customer'
	    }, 'project-other-customer')).rejects.toMatchObject({
	      message: 'customerId is required for Rysnova customer package access',
	      status: 403
	    });
	  });

	  test('repository customer package query includes customerId for customer role', async () => {
	    const repo = {
	      list: jest.fn(async () => ({
	        items: [
	          {
	            _id: 'repo-own-report',
	            tenantId: 'tenant-1',
	            projectId: 'project-repo-customer',
	            customerId: 'customer-1',
	            type: 'customer-report',
	            version: 1,
	            status: 'shared',
	            objectKey: 'tenant-1/project-repo-customer/customer-report/v1/customer-report.json',
	            contentHash: 'sha256:repo-own-report',
	            permissions: { customerVisible: true },
	            metadata: { storage: { provider: 's3-compatible-object-storage', integrityPassed: true } }
	          }
	        ],
	        pagination: { page: 1, limit: 100, total: 1, pages: 1 }
	      }))
	    };
	    const service = new RysnovaArtifactService({ artifactRepo: repo });

	    const result = await service.buildCustomerPackage({
	      tenantId: 'tenant-1',
	      role: 'customer',
	      customerId: 'customer-1'
	    }, 'project-repo-customer');

	    expect(repo.list).toHaveBeenCalledWith(
	      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
	      {
	        projectId: 'project-repo-customer',
	        status: { $in: ['approved', 'shared'] },
	        'permissions.customerVisible': true,
	        customerId: 'customer-1'
	      },
	      expect.objectContaining({ sort: { updatedAt: -1 } })
	    );
	    expect(result.count).toBe(1);
	    expect(result.artifacts[0]).toEqual(expect.objectContaining({ id: 'repo-own-report' }));
	  });

	  test('generates Rysnova visual artifacts through unified artifact storage contract', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: { rysnovaBimArtifacts: [] }
    });

    const result = await service.generateVisualArtifacts(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', userId: 'designer-1' },
      'project-visual-1',
      {
        tier: 'balanced',
        result: {
          input: { area: 168, city: '上海', houseType: '大平层' },
          recommendation: { recommendedTier: 'balanced' },
          solutions: {
            balanced: {
              id: 'balanced',
              name: '均衡方案',
              systems: [
                { type: 'hot_water', name: '中央热水' },
                { type: 'fresh_air', name: '新风系统' },
                { type: 'smart_control', name: '智能控制' }
              ]
            }
          }
        }
      }
    );

    expect(result.count).toBe(3);
    expect(result.artifactTypes).toEqual(['principle-diagram', 'construction-drawing', 'bim-model']);
    expect(result.engineeringTraceabilityManifest).toEqual(expect.objectContaining({
      manifestId: expect.stringMatching(/^rysnova-bim-trace-/),
      projectId: 'project-visual-1',
      tier: 'balanced',
      visualArtifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model'],
      deliverableArtifactTypes: [],
      traceability: expect.objectContaining({
        traceabilityId: expect.stringMatching(/^visual-trace-balanced-/),
        systemCount: 3,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      }),
      linkedArtifacts: expect.objectContaining({
        principleDiagram: expect.objectContaining({ type: 'principle-diagram', role: 'principle-diagram' }),
        layout2d: expect.objectContaining({ type: 'construction-drawing', role: 'layout-2d' }),
        scene3d: expect.objectContaining({ type: 'bim-model', role: 'bim-or-3d-preview' })
      }),
      boundary: expect.objectContaining({
        customerSafe: true,
        lifecycleHandoffOnly: true,
        realtimeControl: false,
        internalCostHiddenFromCustomer: true
      })
    }));
    expect(result.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tenantId: 'tenant-1',
        projectId: 'project-visual-1',
        type: 'principle-diagram',
        objectKey: 'tenant-1/project-visual-1/principle-diagram/v1/principle-diagram.svg',
        contentHash: expect.stringMatching(/^sha256:/),
        metadata: expect.objectContaining({
          label: '设计原理图',
          storage: expect.objectContaining({ provider: 'memory-object-storage', contentType: 'image/svg+xml' }),
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'principleDiagram',
            checks: expect.objectContaining({
              nonBlank: true,
              hasExpectedRefs: true,
              lifecycleHandoffOnly: true,
              realtimeControl: false
            }),
            expectedRefs: expect.arrayContaining(['principle-node-1'])
          }),
          visualTraceability: expect.objectContaining({
            sourceHash: expect.stringMatching(/^sha256:/),
            handoffBoundary: 'lifecycle_handoff_only',
            realtimeControl: false,
            visualArtifacts: expect.objectContaining({
              principleDiagram: 'principle-diagram',
              layout2d: 'construction-drawing',
              scene3d: 'bim-model'
            })
          })
        })
      }),
      expect.objectContaining({
        type: 'construction-drawing',
        objectKey: 'tenant-1/project-visual-1/construction-drawing/v1/construction-drawing.svg',
        metadata: expect.objectContaining({
          label: '2D布局图',
          drawingType: 'layout-2d',
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'layout2d',
            expectedRefs: expect.arrayContaining(['layout-device-1'])
          }),
          visualTraceability: expect.objectContaining({
            sourceHash: expect.stringMatching(/^sha256:/),
            systemCount: 3
          })
        })
      }),
      expect.objectContaining({
        type: 'bim-model',
        objectKey: 'tenant-1/project-visual-1/bim-model/v1/bim-model.json',
        metadata: expect.objectContaining({
          label: '3D示意图',
          visualQualityEvidence: expect.objectContaining({
            passed: true,
            visualKey: 'illustration3d',
            expectedRefs: expect.arrayContaining(['scene3d-device-1'])
          }),
          visualTraceability: expect.objectContaining({
            sourceHash: expect.stringMatching(/^sha256:/),
            systemNodes: expect.arrayContaining([
              expect.objectContaining({
                drawingRefs: expect.objectContaining({
                  principleDiagramNode: expect.stringMatching(/^principle-node-/),
                  layoutDeviceNode: expect.stringMatching(/^layout-device-/),
                  scene3dDeviceNode: expect.stringMatching(/^scene3d-device-/)
                })
              })
            ])
          })
        })
      })
    ]));
  });

  test('generates Rysnova deliverable artifacts for BOM, quantity takeoff, standards check and customer report', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: { rysnovaBimArtifacts: [] },
      now: () => new Date('2026-06-12T08:00:00.000Z')
    });

    const result = await service.generateDeliverableArtifacts(
      { tenantId: 'tenant-1', dealerId: 'dealer-1', userId: 'designer-1' },
      'project-deliverable-1',
      {
        tier: 'premium',
        customerId: '64f000000000000000000501',
        project: { name: '浦东大平层深化', city: '上海', area: 180, houseType: '大平层' },
        pricing: { targetMarginRate: 0.28, minMarginRate: 0.18, taxRate: 0.09 },
        result: {
          input: { area: 180, city: '上海', houseType: '大平层' },
          recommendation: { recommendedTier: 'premium' },
          solutions: {
            premium: {
              id: 'premium',
              name: '尊享方案',
              systems: [
                { type: 'hot_water', name: 'Rheem 中央热水' },
                { type: 'heating', name: 'Ruud 水系统采暖' },
                { type: 'fresh_air', name: 'Ruud 新风系统' },
                { type: 'smart_control', name: '智能控制' }
              ]
            }
          }
        }
      }
    );

    expect(result.count).toBe(4);
    expect(result.artifactTypes).toEqual(['bom', 'quantity-takeoff', 'standards-check', 'customer-report']);
    expect(result.project).toEqual(expect.objectContaining({ name: '浦东大平层深化', city: '上海', area: 180 }));
    expect(result.tierComparison).toEqual(expect.objectContaining({
      selectedTier: 'premium',
      recommendedTier: 'premium',
      tierCount: 3,
      boundary: expect.objectContaining({
        customerSafe: true,
        internalCostHiddenFromCustomer: true,
        lifecycleHandoffOnly: true,
        realtimeControl: false
      })
    }));
    expect(result.tierComparison.tiers.map(item => item.tier)).toEqual(['essential', 'balanced', 'premium']);
    expect(result.tierComparison.tiers.map(item => item.customerTotal)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    ]);
    expect(result.tierComparison.tiers[0].customerTotal).toBeLessThan(result.tierComparison.tiers[1].customerTotal);
    expect(result.tierComparison.tiers[1].customerTotal).toBeLessThan(result.tierComparison.tiers[2].customerTotal);
    expect(result.tierComparison.tiers.find(item => item.tier === 'premium')).toEqual(expect.objectContaining({
      selected: true,
      recommended: true,
      tierName: '尊享方案',
      marginGuard: expect.objectContaining({ status: 'pass' }),
      standardsCoverageStatus: 'complete',
      lifecycleHandoff: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: 4
      }),
      decisionEvidence: expect.objectContaining({
        positioning: expect.stringContaining('体验优先'),
        idealFor: expect.arrayContaining(['大宅或高净值家庭']),
        valueDrivers: expect.arrayContaining(['更高舒适冗余']),
        tradeoffs: expect.arrayContaining(['初始投入最高']),
        selectionRationale: expect.stringContaining('当前推荐/签核档位'),
        engineeringDelta: expect.objectContaining({
          systemCount: 4,
          itemCount: expect.any(Number),
          pipeMeters: expect.any(Number),
          controlPoints: expect.any(Number)
        }),
        commercialDecision: expect.objectContaining({
          currency: 'CNY',
          customerTotal: expect.any(Number),
          commercialApprovalStatus: 'pass',
          internalCostHiddenFromCustomer: true
        }),
        standardsDecision: expect.objectContaining({
          coverageStatus: 'complete',
          coveredDomains: expect.arrayContaining(['thermal-comfort', 'smart-interoperability']),
          quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器'])
        }),
        lifecycleDecision: expect.objectContaining({
          handoffBoundary: 'lifecycle_handoff_only',
          realtimeControl: false,
          assetCount: 4
        }),
        riskControls: expect.arrayContaining([
          '报价已通过毛利底线保护',
          '标准覆盖完整',
          '仅交接生命周期资产，不开放实时控制'
        ]),
        customerSafe: true
      })
    }));
    expect(result.tierComparison.tiers.every(item => item.decisionEvidence?.customerSafe === true)).toBe(true);
    expect(result.tierComparison.tiers.map(item => item.decisionEvidence.engineeringDelta.pipeMeters)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    ]);
    expect(result.tierComparison.tiers[0].decisionEvidence.engineeringDelta.pipeMeters)
      .toBeLessThan(result.tierComparison.tiers[2].decisionEvidence.engineeringDelta.pipeMeters);
    expect(result.bomSummary.itemCount).toBeGreaterThanOrEqual(12);
    expect(result.quantityTakeoffSummary.pipeMeters).toBeGreaterThan(0);
    expect(result.quoteCostSummary.quotationSummary.customerTotal).toBeGreaterThan(result.quoteCostSummary.costBreakdown.directCost);
    expect(result.quoteCostSummary.marginGuard.status).toBe('pass');
    expect(result.quoteCostSummary.installedAssetHandoff).toEqual(expect.objectContaining({
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      assetCount: 4,
      standardsCoverageImpact: expect.objectContaining({
        status: 'complete',
        quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器']),
        lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
      })
    }));
    expect(result.quoteCostSummary.standardsCoverageImpact).toEqual(expect.objectContaining({
      status: 'complete',
      coveredDomains: expect.arrayContaining([
        'thermal-comfort',
        'ventilation-iaq',
        'hot-water-safety',
        'potable-water',
        'energy',
        'smart-interoperability'
      ]),
      quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器']),
      deliverableEvidence: expect.arrayContaining(['热水负荷计算', 'IoT 设备绑定清单']),
      lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
    }));
    expect(result.engineeringTraceabilityManifest).toEqual(expect.objectContaining({
      manifestId: expect.stringMatching(/^rysnova-bim-trace-/),
      projectId: 'project-deliverable-1',
      tier: 'premium',
      visualArtifactTypes: [],
      deliverableArtifactTypes: ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
      linkedArtifacts: expect.objectContaining({
        bom: expect.objectContaining({ type: 'bom', role: 'commercial-bom' }),
        quantityTakeoff: expect.objectContaining({ type: 'quantity-takeoff', role: 'quantity-takeoff' }),
        standardsCheck: expect.objectContaining({ type: 'standards-check', role: 'standards-compliance' }),
        customerReport: expect.objectContaining({ type: 'customer-report', role: 'customer-report' })
      }),
      drawingToCommercialLinks: expect.arrayContaining([
        expect.objectContaining({
          systemFamily: 'water',
          itemIds: expect.arrayContaining(['water-equipment-1']),
          quoteDrivers: expect.arrayContaining(['热源容量', '循环泵']),
          lifecycleHandoffImpact: expect.arrayContaining(['water_temperature', 'service_ticket'])
        }),
        expect.objectContaining({
          systemFamily: 'control',
          itemIds: expect.arrayContaining(['control-equipment-4']),
          quoteDrivers: expect.arrayContaining(['网关/控制器'])
        })
      ]),
      commercialTraceability: expect.objectContaining({
        itemCount: expect.any(Number),
        systemCount: 4,
        internalCostHiddenFromCustomer: true
      }),
      lifecycleTraceability: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: 4,
        lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
      })
    }));
    expect(result.quoteCostSummary.systemQuoteExplanations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        systemFamily: 'water',
        standardsDomains: expect.arrayContaining(['hot-water-safety', 'potable-water']),
        quoteDrivers: expect.arrayContaining(['热源容量', '循环泵']),
        deliverableEvidence: expect.arrayContaining(['热水负荷计算']),
        lifecycleHandoffImpact: expect.arrayContaining(['water_temperature', 'service_ticket']),
        itemCount: 4,
        customerSafeExplanation: expect.stringContaining('报价由设备、管路/附件、控制点和安装调试组成')
      }),
      expect.objectContaining({
        systemFamily: 'control',
        standardsDomains: expect.arrayContaining(['smart-interoperability']),
        quoteDrivers: expect.arrayContaining(['网关/控制器']),
        lifecycleHandoffImpact: expect.arrayContaining(['remote_control'])
      })
    ]));
    expect(result.quoteCostSummary.installedAssetHandoff.assets.map(asset => asset.systemFamily))
      .toEqual(['water', 'heating', 'fresh_air', 'control']);
    expect(result.quoteCostSummary.installedAssetHandoff.assets.every(asset => asset.iotBinding.realtimeControl === false)).toBe(true);
    expect(result.standardsSummary.passed).toBe(true);
    expect(result.standardsSummary.coverageStatus).toBe('complete');
    expect(result.standardsSummary.coveredCoverageDomains).toEqual(expect.arrayContaining([
      'thermal-comfort',
      'ventilation-iaq',
      'hot-water-safety',
      'potable-water',
      'energy',
      'smart-interoperability'
    ]));
    expect(result.standardsCoverage).toEqual(expect.objectContaining({
      status: 'complete',
      coveredDomains: expect.arrayContaining([
        'thermal-comfort',
        'ventilation-iaq',
        'hot-water-safety',
        'potable-water',
        'energy',
        'smart-interoperability'
      ]),
      missingRequiredDomains: [],
      packIds: expect.arrayContaining([
        'rheem-central-hot-water',
        'rheem-heating',
        'rheem-whole-air',
        'rheem-smart-control'
      ])
    }));
    expect(result.customerReportSummary.iotBoundary).toBe('lifecycle_handoff_only');
    expect(result.customerReportSummary.standardsCoverageStatus).toBe('complete');
    const standardsArtifact = result.artifacts.find(item => item.type === 'standards-check');
    const standardsObject = await service.storageAdapter.getObject(standardsArtifact.objectKey);
    const standardsContent = JSON.parse(standardsObject.bytes.toString('utf8'));
    expect(standardsContent.standardsCoverage).toEqual(expect.objectContaining({
      status: 'complete',
      coveredDomains: expect.arrayContaining([
        'thermal-comfort',
        'ventilation-iaq',
        'hot-water-safety',
        'potable-water',
        'energy',
        'smart-interoperability'
      ]),
      quoteImpact: expect.arrayContaining(['循环泵', '网关/控制器']),
      lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
    }));
    const bomArtifact = result.artifacts.find(item => item.type === 'bom');
    const bomObject = await service.storageAdapter.getObject(bomArtifact.objectKey);
    const bomContent = JSON.parse(bomObject.bytes.toString('utf8'));
    expect(bomContent.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'water-equipment-1',
        standardsCoverageTrace: expect.objectContaining({
          status: 'complete',
          domains: expect.arrayContaining(['hot-water-safety', 'potable-water']),
          quoteDrivers: expect.arrayContaining(['热源容量', '循环泵']),
          deliverableEvidence: expect.arrayContaining(['热水负荷计算']),
          lifecycleHandoffImpact: expect.arrayContaining(['water_temperature', 'service_ticket'])
        })
      }),
      expect.objectContaining({
        itemId: 'control-valve-control-4',
        standardsCoverageTrace: expect.objectContaining({
          domains: expect.arrayContaining(['smart-interoperability']),
          quoteDrivers: expect.arrayContaining(['网关/控制器'])
        })
      })
    ]));
    const customerReportArtifact = result.artifacts.find(item => item.type === 'customer-report');
    const customerReportObject = await service.storageAdapter.getObject(customerReportArtifact.objectKey);
    const customerReportContent = JSON.parse(customerReportObject.bytes.toString('utf8'));
    expect(customerReportContent).toEqual(expect.objectContaining({
      type: 'rysnova-bim-customer-engineering-report',
      iotBoundary: 'lifecycle_handoff_only',
      internalFieldsExcluded: expect.arrayContaining([
        'directCost',
        'dealerMargin',
        'costBreakdown',
        'marginGuard'
      ]),
      estimationBoundary: expect.objectContaining({
        quantityTakeoff: expect.stringContaining('software-estimated'),
        pricing: expect.stringContaining('customer-facing quotation summary only'),
        iot: expect.stringContaining('lifecycle_handoff_only')
      })
    }));
    expect(customerReportContent.standardsCoverage).toEqual(expect.objectContaining({
      status: 'complete',
      coveredDomains: expect.arrayContaining([
        'thermal-comfort',
        'ventilation-iaq',
        'hot-water-safety',
        'potable-water',
        'energy',
        'smart-interoperability'
      ]),
      deliverableEvidence: expect.arrayContaining(['热水负荷计算', 'IoT 设备绑定清单'])
    }));
    expect(customerReportContent.standardsCoverageImpact).toEqual(expect.objectContaining({
      status: 'complete',
      quoteDrivers: expect.arrayContaining(['循环泵', '网关/控制器']),
      deliverableEvidence: expect.arrayContaining(['热水负荷计算', 'IoT 设备绑定清单']),
      lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
    }));
    expect(customerReportContent.systemQuoteExplanations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        systemFamily: 'water',
        quoteDrivers: expect.arrayContaining(['热源容量', '循环泵']),
        customerSafeExplanation: expect.stringContaining('交付证据')
      }),
      expect.objectContaining({
        systemFamily: 'control',
        lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
      })
    ]));
    expect(customerReportContent.quotationSummary).toEqual(expect.objectContaining({
      currency: 'CNY',
      customerTotal: expect.any(Number),
      monthlyPayment: expect.any(Number),
      validDays: 30
    }));
    const customerReportJson = JSON.stringify(customerReportContent);
    for (const internalField of [
      '"directCost":',
      '"dealerMargin":',
      '"costBreakdown":',
      '"marginGuard":',
      '"targetBeforeTax":',
      '"quoteFloor":'
    ]) {
      expect(customerReportJson).not.toContain(internalField);
    }
    expect(result.storageEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'bom',
        version: 1,
        objectKey: 'tenant-1/project-deliverable-1/bom/v1/bom.json',
        provider: 'memory-object-storage',
        sizeBytes: expect.any(Number),
        contentHash: expect.stringMatching(/^sha256:/),
        storageReady: true
      })
    ]));
    expect(result.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'bom',
        objectKey: 'tenant-1/project-deliverable-1/bom/v1/bom.json',
        contentHash: expect.stringMatching(/^sha256:/),
        metadata: expect.objectContaining({
          bomSummary: expect.objectContaining({ itemCount: expect.any(Number) }),
          quoteCostSummary: expect.objectContaining({
            quotationSummary: expect.objectContaining({ status: 'draft-ready' })
          }),
          storage: expect.objectContaining({ provider: 'memory-object-storage', contentType: 'application/json' })
        })
      }),
      expect.objectContaining({
        type: 'quantity-takeoff',
        objectKey: 'tenant-1/project-deliverable-1/quantity-takeoff/v1/quantity-takeoff.json',
        metadata: expect.objectContaining({
          quantityTakeoffSummary: expect.objectContaining({ pipeMeters: expect.any(Number) })
        })
      }),
      expect.objectContaining({
        type: 'standards-check',
        metadata: expect.objectContaining({
          standardsSummary: expect.objectContaining({ passed: true, coverageStatus: 'complete' }),
          standardsCoverage: expect.objectContaining({
            status: 'complete',
            coveredDomains: expect.arrayContaining(['smart-interoperability'])
          })
        })
      }),
      expect.objectContaining({
        type: 'customer-report',
        objectKey: 'tenant-1/project-deliverable-1/customer-report/v1/customer-report.json',
        metadata: expect.objectContaining({
          customerFacingReport: true,
          quotationSummary: expect.objectContaining({ currency: 'CNY' }),
          standardsCoverage: expect.objectContaining({ status: 'complete' })
        })
      })
    ]));

    const deepening = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-deliverable-1');
    expect(deepening.missingTypes).toEqual(['principle-diagram', 'construction-drawing', 'bim-model']);
    expect(deepening.commercialReadiness.ready).toBe(true);
    expect(deepening.commercialReadiness.bomSummary.itemCount).toBeGreaterThanOrEqual(12);
  });

  test('increments Rysnova generated artifact versions instead of overwriting object keys', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: { rysnovaBimArtifacts: [] },
      now: () => new Date('2026-06-12T08:00:00.000Z')
    });
    const scope = { tenantId: 'tenant-1', userId: 'designer-1' };
    const payload = {
      tier: 'balanced',
      project: { name: '重复生成测试', city: '上海', area: 120 },
      systems: [
        { type: 'hot_water', name: '中央热水' },
        { type: 'fresh_air', name: '新风系统' }
      ]
    };

    const first = await service.generateDeliverableArtifacts(scope, 'project-version-1', payload);
    const second = await service.generateDeliverableArtifacts(scope, 'project-version-1', payload);

    expect(first.artifacts.map(item => item.version)).toEqual([1, 1, 1, 1]);
    expect(second.artifacts.map(item => item.version)).toEqual([2, 2, 2, 2]);
    expect(second.artifacts.map(item => item.objectKey)).toEqual([
      'tenant-1/project-version-1/bom/v2/bom.json',
      'tenant-1/project-version-1/quantity-takeoff/v2/quantity-takeoff.json',
      'tenant-1/project-version-1/standards-check/v2/standards-check.json',
      'tenant-1/project-version-1/customer-report/v2/customer-report.json'
    ]);
  });

  test('builds project-level deepening package when required Rysnova artifacts are approved and storage-backed', async () => {
    const visualTraceability = {
      traceabilityId: 'visual-trace-premium-test',
      sourceHash: 'sha256:visual-source-test',
      tier: 'premium',
      project: { name: '项目1', city: '上海', area: 180, houseType: '大平层' },
      systemCount: 2,
      systemNodes: [
        {
          nodeId: 'hot_water-1',
          sourceSystemId: 'hot_water',
          type: 'hot_water',
          name: '中央热水',
          drawingRefs: {
            principleDiagramNode: 'principle-node-1',
            layoutDeviceNode: 'layout-device-1',
            scene3dDeviceNode: 'scene3d-device-1'
          }
        },
        {
          nodeId: 'fresh_air-2',
          sourceSystemId: 'fresh_air',
          type: 'fresh_air',
          name: '新风系统',
          drawingRefs: {
            principleDiagramNode: 'principle-node-2',
            layoutDeviceNode: 'layout-device-2',
            scene3dDeviceNode: 'scene3d-device-2'
          }
        }
      ],
      visualArtifacts: {
        principleDiagram: 'principle-diagram',
        layout2d: 'construction-drawing',
        scene3d: 'bim-model'
      },
      standardsRefs: ['GB 55020-2021', 'GB 55015-2021'],
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    };
    const baseArtifact = {
      tenantId: 'tenant-1',
      projectId: 'project-1',
      status: 'approved',
      permissions: { customerVisible: false },
      metadata: {
        storage: {
          provider: 's3-compatible-object-storage',
          uri: 's3://bucket/key',
          sizeBytes: 128,
          contentType: 'application/json'
        }
      },
      standards: [
        { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
      ],
      updatedAt: '2026-06-08T08:00:00.000Z'
    };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            ...baseArtifact,
	            id: 'a-principle',
            type: 'principle-diagram',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              visualTraceability,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' }
            }
          },
          {
            ...baseArtifact,
            id: 'a-drawing',
            type: 'construction-drawing',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              visualTraceability,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' }
            }
          },
          {
            ...baseArtifact,
            id: 'a-bim',
            type: 'bim-model',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              visualTraceability,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' }
            }
          },
          {
            ...baseArtifact,
            id: 'a-bom',
            type: 'bom',
            version: 2,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' },
              bomSummary: {
                itemCount: 24,
                totalCost: 180000,
                currency: 'CNY',
                costBreakdown: { directCost: 180000, customerTotal: 260000 }
              },
              quoteCostSummary: {
                quotationSummary: { quotationNo: 'Q2-001', customerTotal: 260000, currency: 'CNY', tier: 'premium' },
                costBreakdown: { directCost: 180000, taxAmount: 23000, customerTotal: 260000 },
                marginGuard: { status: 'pass', minMarginRate: 0.18, targetMarginRate: 0.25 },
                standardsCoverageImpact: completeStandardsCoverageImpact,
                systemQuoteExplanations: [
                  {
                    systemFamily: 'water',
                    systemName: '中央热水',
                    standardsDomains: ['hot-water-safety', 'potable-water'],
                    quoteDrivers: ['热源容量', '循环泵'],
                    deliverableEvidence: ['热水负荷计算'],
                    lifecycleHandoffImpact: ['water_temperature', 'service_ticket'],
                    itemIds: ['water-equipment-1', 'water-pipe-1'],
                    itemCount: 2,
                    customerSafeExplanation: '中央热水报价由设备、管路/附件、控制点和安装调试组成。'
                  },
                  {
                    systemFamily: 'fresh_air',
                    systemName: '新风系统',
                    standardsDomains: ['ventilation-iaq'],
                    quoteDrivers: ['风管材料'],
                    deliverableEvidence: ['新风量校核'],
                    lifecycleHandoffImpact: ['filter_maintenance'],
                    itemIds: ['fresh_air-equipment-2'],
                    itemCount: 1,
                    customerSafeExplanation: '新风报价由主机、风管、控制点和调试组成。'
                  }
                ],
                installedAssetHandoff: {
                  handoffBoundary: 'lifecycle_handoff_only',
                  realtimeControl: false,
                  targetPlatform: 'external-iot-lifecycle-platform',
                  assetCount: 2,
                  standardsCoverageImpact: completeStandardsCoverageImpact,
                  assets: [
                    {
                      assetId: 'project-1-water-01',
                      systemFamily: 'water',
                      brand: 'Rheem',
                      model: 'DHW-CENTRAL',
                      iotBinding: { status: 'handoff-ready-not-bound', realtimeControl: false }
                    },
                    {
                      assetId: 'project-1-fresh_air-01',
                      systemFamily: 'fresh_air',
                      brand: 'Ruud',
                      model: 'ERV-DOAS',
                      iotBinding: { status: 'handoff-ready-not-bound', realtimeControl: false }
                    }
                  ]
                }
              }
            }
          },
          {
            ...baseArtifact,
            id: 'a-quantity',
            type: 'quantity-takeoff',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' },
              quantityTakeoffSummary: { pipeMeters: 86, valves: 18 }
            }
          },
          {
            ...baseArtifact,
            id: 'a-standards',
            type: 'standards-check',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' }
            }
          },
          {
            ...baseArtifact,
            id: 'a-report',
            type: 'customer-report',
            version: 1,
            status: 'shared',
            permissions: { customerVisible: true },
            metadata: {
              ...baseArtifact.metadata,
              integrity: { passed: true, verifiedAt: '2026-06-08T08:30:00.000Z' }
            }
          },
          {
            ...baseArtifact,
            id: 'a-other-tenant',
            tenantId: 'tenant-2',
            type: 'standards-check',
            standards: [
	              { code: 'GB 50019-2015', level: 'domain-design-standard', edition: '2015', softwareCheck: 'failed' }
	            ]
	          }
	        ].map(withRysnovaStorageEvidence)
	      }
	    });

    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-1');

    expect(result.handoffReady).toBe(true);
    expect(result.status).toBe('handoff-ready');
    expect(result.missingTypes).toEqual([]);
    expect(result.approvalMissingTypes).toEqual([]);
    expect(result.standardsSummary.counts.passed).toBe(7);
    expect(result.standardsSummary.blockingFailures).toEqual([]);
    expect(result.storageIntegrityTodo).toEqual([]);
    expect(result.requiredArtifacts.bom.version).toBe(2);
    expect(result.engineeringReadiness.ready).toBe(true);
    expect(result.visualReadiness.ready).toBe(true);
    expect(result.visualReadiness.requiredVisuals.map(item => item.key)).toEqual(['principleDiagram', 'layout2d', 'illustration3d']);
    expect(result.commercialReadiness.ready).toBe(true);
    expect(result.installedAssetReadiness.ready).toBe(true);
    expect(result.installedAssetHandoff).toEqual(expect.objectContaining({
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      assetCount: 2
    }));
    expect(result.engineeringTraceabilityManifest).toEqual(expect.objectContaining({
      manifestId: expect.stringMatching(/^rysnova-bim-trace-/),
      projectId: 'project-1',
      tier: 'premium',
      traceability: expect.objectContaining({
        traceabilityId: 'visual-trace-premium-test',
        systemCount: 2,
        standardsRefs: expect.arrayContaining(['GB 55020-2021'])
      }),
      visualArtifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model'],
      deliverableArtifactTypes: ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
      linkedArtifacts: expect.objectContaining({
        principleDiagram: expect.objectContaining({ artifactId: 'a-principle', type: 'principle-diagram' }),
        bom: expect.objectContaining({ artifactId: 'a-bom', type: 'bom' })
      }),
      drawingToCommercialLinks: expect.arrayContaining([
        expect.objectContaining({
          systemFamily: 'water',
          itemIds: expect.arrayContaining(['water-equipment-1']),
          standardsDomains: expect.arrayContaining(['hot-water-safety'])
        })
      ]),
      standardsTraceability: expect.objectContaining({
        impact: expect.objectContaining({
          status: 'complete',
          lifecycleHandoffImpact: expect.arrayContaining(['remote_control', 'service_ticket'])
        }),
        standardsArtifactId: 'a-standards'
      }),
      lifecycleTraceability: expect.objectContaining({
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: 2,
        assetIds: expect.arrayContaining(['project-1-water-01', 'project-1-fresh_air-01'])
      })
    }));
    expect(result.customerSignoff.ready).toBe(true);
    expect(result.downloadManifest).toEqual(expect.objectContaining({
      ready: true,
      count: 6,
      readyCount: 6,
      blockedCount: 0
    }));
    expect(result.downloadManifest.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'principle-diagram',
        label: '设计原理图',
        fileRole: 'principle-diagram',
        downloadReady: true,
        signoffStatus: 'customer-visible',
        visualQualityEvidence: expect.objectContaining({
          passed: true,
          visualKey: 'principleDiagram',
          checks: expect.objectContaining({
            nonBlank: true,
            hasTraceability: true,
            realtimeControl: false
          }),
          expectedRefs: expect.arrayContaining(['principle-node-1'])
        })
      }),
      expect.objectContaining({
        type: 'construction-drawing',
        label: '2D 施工布局图',
        fileRole: 'construction-drawing',
        downloadReady: true,
        visualQualityEvidence: expect.objectContaining({
          passed: true,
          visualKey: 'layout2d',
          checks: expect.objectContaining({
            realtimeControl: false
          }),
          expectedRefs: expect.arrayContaining(['layout-device-1'])
        })
      }),
      expect.objectContaining({
        type: 'bim-model',
        label: '3D / BIM 示意模型',
        fileRole: 'bim-or-3d-preview',
        downloadReady: true,
        visualQualityEvidence: expect.objectContaining({
          passed: true,
          visualKey: 'illustration3d',
          checks: expect.objectContaining({
            realtimeControl: false
          }),
          expectedRefs: expect.arrayContaining(['scene3d-device-1'])
        })
      }),
      expect.objectContaining({
        type: 'bom',
        label: 'BOM 材料清单',
        fileRole: 'commercial-bom',
        downloadReady: true,
        visualQualityEvidence: null
      })
    ]));
    expect(result.evidenceGaps).toEqual([]);
    expect(result.nextActions).toEqual([]);
    expect(result.bomSummary).toEqual({
      itemCount: 24,
      totalCost: 180000,
      currency: 'CNY',
      costBreakdown: { directCost: 180000, customerTotal: 260000 }
    });
    expect(result.quantityTakeoffSummary).toEqual({ pipeMeters: 86, valves: 18 });
    expect(result.quoteCostSummary.marginGuard.status).toBe('pass');
  });

  test('prepares customer-safe artifact download only after quality gate passes', async () => {
    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-download-ready');
    const storage = {
      provider: 's3-compatible-object-storage',
      uri: 's3://bucket/project-download-ready/artifact.svg',
      sizeBytes: 256,
      contentType: 'image/svg+xml',
      integrityPassed: true
    };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [
          withRysnovaStorageEvidence({
            id: 'download-ready-principle',
            tenantId: 'tenant-1',
            projectId: 'project-download-ready',
            type: 'principle-diagram',
            version: 1,
            status: 'shared',
            objectKey: 'tenant-1/project-download-ready/principle-diagram/v1/principle-diagram.svg',
      contentHash: 'sha256:download-ready',
      customerId: 'customer-1',
      permissions: { customerVisible: true },
            metadata: {
              storage,
              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' },
              visualTraceability,
              visualQualityEvidence: visualQualityEvidenceForTest('principle-diagram', visualTraceability),
              label: '设计原理图',
              internalApprovalNotes: 'internal-only'
            },
            standards: [
              { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
            ]
          })
        ]
      },
      now: () => new Date('2026-06-12T08:00:00.000Z')
    });

    const result = await service.prepareArtifactDownload(
      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
      'download-ready-principle',
      { ttlSeconds: 1200 }
    );

    expect(result).toEqual(expect.objectContaining({
      artifactId: 'download-ready-principle',
      projectId: 'project-download-ready',
      type: 'principle-diagram',
      label: '设计原理图',
      fileRole: 'principle-diagram',
      objectKey: 'tenant-1/project-download-ready/principle-diagram/v1/principle-diagram.svg',
      contentHash: 'sha256:download-ready',
      contentType: 'image/svg+xml',
      sizeBytes: 256,
      provider: 's3-compatible-object-storage',
      integrityPassed: true,
      downloadReady: true,
      accessMode: 'object-storage-gateway',
      downloadUrl: '/api/v2/rysnova-bim/artifacts/download-ready-principle/download/content',
      expiresInSeconds: 1200,
      expiresAt: '2026-06-12T08:20:00.000Z',
      customerSafe: true,
      visualQualityEvidence: expect.objectContaining({
        passed: true,
        type: 'principle-diagram',
        visualKey: 'principleDiagram',
        checks: expect.objectContaining({
          nonBlank: true,
          hasTraceability: true,
          hasExpectedRefs: true,
          lifecycleHandoffOnly: true,
          realtimeControl: false
        }),
        expectedRefs: expect.arrayContaining(['principle-node-1'])
      }),
      engineeringTraceability: expect.objectContaining({
        traceabilityId: 'visual-trace-download-ready',
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      }),
      generatedAt: '2026-06-12T08:00:00.000Z'
    }));
    expect(result.qualityGate.passed).toBe(true);
    expect(result.qualityGate.checks.visualQualityPassed).toBe(true);
    expect(JSON.stringify(result)).not.toContain('internalApprovalNotes');
    expect(JSON.stringify(result)).not.toContain('uri');
  });

  test('downloads customer-safe artifact content through storage gateway with hash verification', async () => {
    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-download-content');
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: { rysnovaBimArtifacts: [] },
      now: () => new Date('2026-06-12T08:00:00.000Z')
    });
    const artifact = await service.createArtifact(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      {
        projectId: 'project-download-content',
        customerId: 'customer-1',
        type: 'principle-diagram',
        status: 'draft',
        contentType: 'image/svg+xml',
        extension: 'svg',
        content: '<svg xmlns="http://www.w3.org/2000/svg"><g id="principle-node-1"><text>Principle</text></g></svg>',
        metadata: {
          label: '设计原理图',
          visualTraceability,
          visualQualityEvidence: visualQualityEvidenceForTest('principle-diagram', visualTraceability)
        },
        standards: [
          { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
        ],
        permissions: { customerVisible: false }
      }
    );
    await service.approveArtifact(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      artifact.id,
      { shareToCustomer: true }
    );

    const result = await service.downloadArtifactContent(
      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
      artifact.id
    );

    expect(Buffer.isBuffer(result.bytes)).toBe(true);
    expect(result.bytes.toString('utf8')).toContain('<text>Principle</text>');
    expect(result).toEqual(expect.objectContaining({
      artifactId: artifact.id,
      projectId: 'project-download-content',
      type: 'principle-diagram',
      contentType: 'image/svg+xml',
      provider: 'memory-object-storage',
      downloadReady: true,
      customerSafe: true,
      visualQualityEvidence: expect.objectContaining({
        passed: true,
        type: 'principle-diagram',
        checks: expect.objectContaining({
          realtimeControl: false
        })
      }),
      engineeringTraceability: expect.objectContaining({
        traceabilityId: 'visual-trace-download-content',
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      }),
      qualityGate: expect.objectContaining({ passed: true })
    }));
    expect(result.qualityGate.checks.visualQualityPassed).toBe(true);
    expect(result.contentHash).toMatch(/^sha256:/);
    expect(result.sizeBytes).toBe(result.bytes.length);
  });

  test('blocks customer download for visual artifacts without quality evidence', async () => {
    const storage = {
      provider: 's3-compatible-object-storage',
      uri: 's3://bucket/project-download-visual-quality/artifact.svg',
      sizeBytes: 256,
      contentType: 'image/svg+xml',
      integrityPassed: true
    };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [
          {
            id: 'download-blocked-visual-quality',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            projectId: 'project-download-visual-quality',
            type: 'principle-diagram',
            version: 1,
            status: 'shared',
            objectKey: 'tenant-1/project-download-visual-quality/principle-diagram/v1/principle-diagram.svg',
            contentHash: 'sha256:download-blocked-visual-quality',
            permissions: { customerVisible: true },
            metadata: {
              storage,
              integrity: { passed: true },
              label: '设计原理图'
            },
            standards: [
              { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
            ]
          }
        ]
      }
    });

    await expect(service.prepareArtifactDownload(
      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
      'download-blocked-visual-quality'
    )).rejects.toMatchObject({
      status: 409,
      message: 'Rysnova artifact is not ready for customer download',
      details: expect.objectContaining({
        artifactId: 'download-blocked-visual-quality',
        type: 'principle-diagram',
        downloadReady: false,
        qualityGate: expect.objectContaining({
          passed: false,
          checks: expect.objectContaining({
            visualQualityPassed: false
          }),
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: 'visual-quality-evidence-missing' })
          ])
        })
      })
    });
  });

  test('blocks customer artifact download when customer scope does not own the artifact', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: { rysnovaBimArtifacts: [] }
    });
    const artifact = await service.createArtifact(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      {
        projectId: 'project-download-owner',
        customerId: 'customer-1',
        type: 'customer-report',
        status: 'draft',
        content: { title: '客户报告' },
        standards: [
          { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
        ],
        permissions: { customerVisible: false }
      }
    );
    await service.approveArtifact(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      artifact.id,
      { shareToCustomer: true }
    );

    await expect(service.prepareArtifactDownload(
      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-2' },
      artifact.id
    )).rejects.toMatchObject({
      status: 404,
      message: 'Rysnova artifact not found'
    });
    await expect(service.downloadArtifactContent(
      { tenantId: 'tenant-1', role: 'customer' },
      artifact.id
    )).rejects.toMatchObject({
      status: 403,
      message: 'customerId is required for Rysnova artifact download access'
    });
  });

  test('blocks customer artifact download when integrity or customer visibility is missing', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [
          withRysnovaStorageEvidence({
            id: 'download-blocked-report',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            projectId: 'project-download-blocked',
            type: 'customer-report',
            version: 1,
            status: 'approved',
            objectKey: 'tenant-1/project-download-blocked/customer-report/v1/customer-report.json',
            contentHash: 'sha256:download-blocked',
            permissions: { customerVisible: false },
            metadata: {
              storage: {
                provider: 'memory-object-storage',
                sizeBytes: 0,
                contentType: 'application/json'
              }
            },
            standards: [
              { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
            ]
          })
        ]
      }
    });

    await expect(service.prepareArtifactDownload(
      { tenantId: 'tenant-1', role: 'customer', customerId: 'customer-1' },
      'download-blocked-report'
    )).rejects.toMatchObject({
      status: 409,
      message: 'Rysnova artifact is not ready for customer download',
      details: expect.objectContaining({
        artifactId: 'download-blocked-report',
        type: 'customer-report',
        downloadReady: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'not-approved-for-customer' }),
          expect.objectContaining({ code: 'storage-not-ready' }),
          expect.objectContaining({ code: 'integrity-not-verified' })
        ])
      })
    });
  });

  test('keeps customer signoff ready when a newer internal draft is generated after shared artifacts', async () => {
    const storage = {
      provider: 's3-compatible-object-storage',
      uri: 's3://bucket/project-signed-v1/artifact.json',
      sizeBytes: 256,
      contentType: 'application/json'
    };
    const standards = [
      { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
    ];
    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-signed-v1');
    const baseShared = {
      tenantId: 'tenant-1',
      projectId: 'project-signed-v1',
      version: 1,
      status: 'shared',
      permissions: { customerVisible: true },
      metadata: {
        storage,
        integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }
      },
      standards
    };
	    const sharedArtifacts = [
	      {
	        ...baseShared,
	        id: 'signed-principle-v1',
	        type: 'principle-diagram',
	        metadata: { ...baseShared.metadata, visualTraceability }
	      },
	      {
	        ...baseShared,
	        id: 'signed-drawing-v1',
	        type: 'construction-drawing',
	        metadata: { ...baseShared.metadata, drawingType: 'layout-2d', visualTraceability }
	      },
      {
        ...baseShared,
        id: 'signed-bim-v1',
        type: 'bim-model',
        metadata: { ...baseShared.metadata, visualTraceability }
      },
      {
        ...baseShared,
        id: 'signed-bom-v1',
        type: 'bom',
        metadata: {
          ...baseShared.metadata,
          bomSummary: { itemCount: 16, totalCost: 160000, currency: 'CNY' },
          quoteCostSummary: {
            quotationSummary: { quotationNo: 'Q-SIGNED-001', customerTotal: 230000, currency: 'CNY' },
            costBreakdown: { directCost: 160000, customerTotal: 230000 },
            marginGuard: { status: 'pass', minMarginRate: 0.18, targetMarginRate: 0.25 },
            installedAssetHandoff: {
              handoffBoundary: 'lifecycle_handoff_only',
              realtimeControl: false,
              targetPlatform: 'external-iot-lifecycle-platform',
              assetCount: 1,
              assets: [
                {
                  assetId: 'project-signed-v1-water-01',
                  systemFamily: 'water',
                  brand: 'Rheem',
                  model: 'DHW-CENTRAL',
                  iotBinding: { status: 'handoff-ready-not-bound', realtimeControl: false }
                }
              ]
            }
          }
        }
      },
      {
        ...baseShared,
        id: 'signed-quantity-v1',
        type: 'quantity-takeoff',
        metadata: {
          ...baseShared.metadata,
          quantityTakeoffSummary: { pipeMeters: 86, valves: 18 }
        }
	      },
	      { ...baseShared, id: 'signed-standards-v1', type: 'standards-check' },
	      { ...baseShared, id: 'signed-report-v1', type: 'customer-report' }
	    ].map(withRysnovaStorageEvidence);
    const newerInternalDrafts = ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'].map(type => ({
      tenantId: 'tenant-1',
      projectId: 'project-signed-v1',
      id: `draft-${type}-v2`,
      type,
      version: 2,
      status: 'reviewing',
      permissions: { customerVisible: false },
      metadata: { storage },
      standards,
      updatedAt: '2026-06-12T09:00:00.000Z'
    }));
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [...sharedArtifacts, ...newerInternalDrafts]
      }
    });

    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-signed-v1');

    expect(result.requiredArtifacts.bom.version).toBe(2);
    expect(result.customerSignoff.ready).toBe(true);
    expect(result.commercialReadiness.ready).toBe(true);
    expect(result.installedAssetReadiness.ready).toBe(true);
    expect(result.installedAssetHandoff.assetCount).toBe(1);
    expect(result.storageIntegrityTodo).toEqual([]);
    expect(result.handoffReady).toBe(true);
    expect(result.status).toBe('handoff-ready');
    expect(result.customerVisibleCount).toBe(7);
    expect(result.evidenceGaps).toEqual([]);
  });

  test('blocks deepening handoff when required artifacts are missing or standards fail', async () => {
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [
          {
            id: 'a-principle',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            type: 'principle-diagram',
            version: 1,
            status: 'approved',
            permissions: { customerVisible: false },
            metadata: { storage: { provider: 's3-compatible-object-storage', sizeBytes: 32, contentType: 'application/json' } },
            standards: [
              { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'failed', note: 'Hot-water circulation check failed' }
            ]
          },
          {
            id: 'a-drawing',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            type: 'construction-drawing',
            version: 1,
            status: 'reviewing',
            permissions: { customerVisible: false },
            standards: [
              { code: 'GB 55015-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'warning' }
            ]
          },
          {
            id: 'a-bim-tenant-2',
            tenantId: 'tenant-2',
            projectId: 'project-1',
            type: 'bim-model',
            version: 1,
            status: 'approved',
            permissions: { customerVisible: false },
            metadata: { storage: { provider: 's3-compatible-object-storage', sizeBytes: 32, contentType: 'model/gltf-binary' } },
            standards: []
          }
        ]
      }
    });

    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-1');

    expect(result.handoffReady).toBe(false);
    expect(result.status).toBe('blocked-or-in-progress');
    expect(result.missingTypes).toEqual(['bim-model', 'bom', 'quantity-takeoff', 'standards-check']);
    expect(result.approvalMissingTypes).toEqual(['construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check']);
    expect(result.standardsSummary.counts.failed).toBe(1);
    expect(result.standardsSummary.blockingFailures).toEqual([
      expect.objectContaining({
        artifactId: 'a-principle',
        type: 'principle-diagram',
        code: 'GB 55020-2021',
        note: 'Hot-water circulation check failed'
      })
    ]);
	    expect(result.storageIntegrityTodo).toEqual([
	      expect.objectContaining({
	        artifactId: 'a-principle',
	        type: 'principle-diagram',
	        reason: 'incomplete-storage-evidence',
	        requiredBefore: 'production-handoff'
	      }),
	      expect.objectContaining({
	        artifactId: 'a-drawing',
	        type: 'construction-drawing',
        reason: 'missing-storage-metadata'
      })
    ]);
    expect(result.engineeringReadiness.ready).toBe(false);
    expect(result.visualReadiness.ready).toBe(false);
    expect(result.visualReadiness.missingVisuals).toEqual(['illustration3d']);
    expect(result.commercialReadiness.ready).toBe(false);
    expect(result.commercialReadiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-bom-artifact' }),
      expect.objectContaining({ code: 'missing-quotation-summary' })
    ]));
    expect(result.customerSignoff.ready).toBe(false);
    expect(result.downloadManifest).toEqual(expect.objectContaining({
      ready: false,
      count: 2,
      readyCount: 0,
      blockedCount: 2
    }));
    expect(result.downloadManifest.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'principle-diagram',
        downloadReady: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'not-approved-for-customer' }),
          expect.objectContaining({ code: 'storage-not-ready' }),
          expect.objectContaining({ code: 'integrity-not-verified' }),
          expect.objectContaining({ code: 'standard-failed' })
        ])
      }),
      expect.objectContaining({
        type: 'construction-drawing',
        downloadReady: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'not-approved-for-customer' }),
          expect.objectContaining({ code: 'storage-not-ready' }),
          expect.objectContaining({ code: 'integrity-not-verified' })
        ])
      })
    ]));
    expect(result.evidenceGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'engineering-artifact', code: 'missing-artifact', type: 'bim-model' }),
      expect.objectContaining({ area: 'standards', code: 'standard-failed', type: 'principle-diagram' }),
      expect.objectContaining({ area: 'commercial-readiness', code: 'missing-bom-artifact' }),
      expect.objectContaining({ area: 'customer-signoff', code: 'commercial-quote-cost-not-ready' })
    ]));
    expect(result.nextActions).toEqual(expect.arrayContaining([
      'Complete and approve the principle diagram, 2D layout, and 3D illustration.',
      'Connect BOM, quantity takeoff, quotation, cost breakdown, and margin guard before customer signoff.'
    ]));
  });

  test('blocks visual readiness when imported Rysnova diagrams lack quality evidence', async () => {
    const visualTraceability = {
      traceabilityId: 'visual-trace-quality-missing',
      sourceHash: 'sha256:quality-missing-source',
      tier: 'balanced',
      systemCount: 1,
      systemNodes: [
        {
          nodeId: 'hot_water-1',
          sourceSystemId: 'hot_water',
          type: 'hot_water',
          name: '中央热水',
          drawingRefs: {
            principleDiagramNode: 'principle-node-1',
            layoutDeviceNode: 'layout-device-1',
            scene3dDeviceNode: 'scene3d-device-1'
          }
        }
      ],
      visualArtifacts: {
        principleDiagram: 'principle-diagram',
        layout2d: 'construction-drawing',
        scene3d: 'bim-model'
      },
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    };
    const storage = {
      provider: 's3-compatible-object-storage',
      uri: 's3://bucket/project-visual-quality/artifact',
      sizeBytes: 512,
      contentType: 'image/svg+xml',
      integrityPassed: true
    };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
        rysnovaBimArtifacts: [
          {
            id: 'quality-missing-principle',
            tenantId: 'tenant-1',
            projectId: 'project-visual-quality',
            type: 'principle-diagram',
            version: 1,
            status: 'shared',
            objectKey: 'tenant-1/project-visual-quality/principle-diagram/v1/principle-diagram.svg',
            contentHash: 'sha256:quality-missing-principle',
            permissions: { customerVisible: true },
            metadata: {
              storage,
              integrity: { passed: true },
              visualTraceability
            },
            standards: [{ code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
          },
          {
            id: 'quality-ready-drawing',
            tenantId: 'tenant-1',
            projectId: 'project-visual-quality',
            type: 'construction-drawing',
            version: 1,
            status: 'shared',
            objectKey: 'tenant-1/project-visual-quality/construction-drawing/v1/construction-drawing.svg',
            contentHash: 'sha256:quality-ready-drawing',
            permissions: { customerVisible: true },
            metadata: {
              storage,
              integrity: { passed: true },
              drawingType: 'layout-2d',
              visualTraceability,
              visualQualityEvidence: visualQualityEvidenceForTest('construction-drawing', visualTraceability)
            },
            standards: [{ code: 'GB 55015-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
          },
          {
            id: 'quality-failed-bim',
            tenantId: 'tenant-1',
            projectId: 'project-visual-quality',
            type: 'bim-model',
            version: 1,
            status: 'shared',
            objectKey: 'tenant-1/project-visual-quality/bim-model/v1/bim-model.json',
            contentHash: 'sha256:quality-failed-bim',
            permissions: { customerVisible: true },
            metadata: {
              storage: { ...storage, contentType: 'application/vnd.rhautt.rysnova-bim.scene3d+json' },
              integrity: { passed: true },
              visualTraceability,
              visualQualityEvidence: visualQualityEvidenceForTest('bim-model', visualTraceability, {
                passed: false,
                status: 'blocked',
                blockers: [{ code: 'visual-trace-ref-missing', missingRefs: ['scene3d-device-1'] }]
              })
            },
            standards: [{ code: 'GB 55015-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }]
          }
        ]
      }
    });

    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-visual-quality');

    expect(result.visualReadiness.ready).toBe(false);
    expect(result.visualReadiness.qualityFailedVisuals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'principleDiagram',
        artifactId: 'quality-missing-principle',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'visual-quality-evidence-missing' })
        ])
      }),
      expect.objectContaining({
        key: 'illustration3d',
        artifactId: 'quality-failed-bim',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'visual-trace-ref-missing' })
        ])
      })
    ]));
    expect(result.evidenceGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: 'visual-package',
        code: 'visual-quality-failed',
        visual: 'principleDiagram',
        artifactId: 'quality-missing-principle'
      }),
      expect.objectContaining({
        area: 'visual-package',
        code: 'visual-quality-failed',
        visual: 'illustration3d',
        artifactId: 'quality-failed-bim'
      })
    ]));
    expect(result.handoffReady).toBe(false);
  });

	  test('does not mark deepening handoff ready when customer signoff or commercial package is incomplete', async () => {
	    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-signoff-gate');
	    const baseArtifact = {
      tenantId: 'tenant-1',
      projectId: 'project-signoff-gate',
      status: 'approved',
      permissions: { customerVisible: false },
      metadata: {
        storage: {
          provider: 's3-compatible-object-storage',
          uri: 's3://bucket/project-signoff-gate/artifact.json',
          sizeBytes: 256,
          contentType: 'application/json'
        }
      },
      standards: [
        { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
      ]
    };
    const service = new RysnovaArtifactService({
      artifactRepo: {},
      memoryDb: {
	        rysnovaBimArtifacts: [
		          {
		            ...baseArtifact,
		            id: 'gate-principle',
	            type: 'principle-diagram',
	            version: 1,
	            status: 'shared',
	            permissions: { customerVisible: true },
	            metadata: { ...baseArtifact.metadata, integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }, visualTraceability }
	          },
	          {
	            ...baseArtifact,
	            id: 'gate-drawing',
	            type: 'construction-drawing',
	            version: 1,
	            status: 'shared',
	            permissions: { customerVisible: true },
	            metadata: { ...baseArtifact.metadata, integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }, drawingType: 'layout-2d', visualTraceability }
	          },
	          {
	            ...baseArtifact,
	            id: 'gate-bim',
	            type: 'bim-model',
	            version: 1,
	            status: 'shared',
	            permissions: { customerVisible: true },
	            metadata: { ...baseArtifact.metadata, integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }, visualTraceability }
	          },
          {
            ...baseArtifact,
            id: 'gate-bom',
            type: 'bom',
            version: 1,
            status: 'approved',
            permissions: { customerVisible: false },
            metadata: {
              ...baseArtifact.metadata,
              bomSummary: { itemCount: 16, totalCost: 160000, currency: 'CNY' }
            }
		          },
		          { ...baseArtifact, id: 'gate-quantity', type: 'quantity-takeoff', version: 1 },
		          { ...baseArtifact, id: 'gate-standards', type: 'standards-check', version: 1 }
	        ].map(withRysnovaStorageEvidence)
	      }
	    });

    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-signoff-gate');

    expect(result.missingTypes).toEqual([]);
    expect(result.approvalMissingTypes).toEqual([]);
    expect(result.standardsSummary.passed).toBe(true);
    expect(result.engineeringReadiness.storageReady).toBe(true);
    expect(result.visualReadiness.ready).toBe(true);
    expect(result.commercialReadiness.ready).toBe(false);
    expect(result.installedAssetReadiness.ready).toBe(false);
    expect(result.customerSignoff.ready).toBe(false);
    expect(result.handoffReady).toBe(false);
    expect(result.status).toBe('blocked-or-in-progress');
	    expect(result.evidenceGaps).toEqual(expect.arrayContaining([
	      expect.objectContaining({ area: 'commercial-readiness', code: 'missing-quantity-takeoff-summary' }),
	      expect.objectContaining({ area: 'commercial-readiness', code: 'missing-quotation-summary' }),
	      expect.objectContaining({ area: 'installed-asset-handoff', code: 'missing-installed-asset-handoff' }),
	      expect.objectContaining({ area: 'customer-signoff', code: 'missing-customer-signoff-artifact', type: 'customer-report' }),
	      expect.objectContaining({ area: 'customer-signoff', code: 'customer-signoff-artifact-not-visible', type: 'bom' }),
	      expect.objectContaining({ area: 'customer-signoff', code: 'customer-signoff-artifact-not-visible', type: 'quantity-takeoff' }),
	      expect.objectContaining({ area: 'customer-signoff', code: 'customer-signoff-artifact-not-visible', type: 'standards-check' })
	    ]));
	  });

	  test('blocks deepening handoff when commercial package lacks installed asset lifecycle handoff manifest', async () => {
	    const storage = {
	      provider: 's3-compatible-object-storage',
	      uri: 's3://bucket/project-no-asset-handoff/artifact.json',
	      sizeBytes: 256,
	      contentType: 'application/json',
	      integrityPassed: true
	    };
	    const standards = [
	      { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
	    ];
	    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-no-asset-handoff');
	    const baseArtifact = {
	      tenantId: 'tenant-1',
	      projectId: 'project-no-asset-handoff',
	      version: 1,
	      status: 'shared',
	      permissions: { customerVisible: true },
	      metadata: {
	        storage,
	        integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }
	      },
	      standards
	    };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      memoryDb: {
	        rysnovaBimArtifacts: [
	          {
	            ...baseArtifact,
	            id: 'asset-principle',
	            type: 'principle-diagram',
	            metadata: { ...baseArtifact.metadata, visualTraceability }
	          },
	          {
	            ...baseArtifact,
	            id: 'asset-drawing',
	            type: 'construction-drawing',
	            metadata: { ...baseArtifact.metadata, drawingType: 'layout-2d', visualTraceability }
	          },
	          {
	            ...baseArtifact,
	            id: 'asset-bim',
	            type: 'bim-model',
	            metadata: { ...baseArtifact.metadata, visualTraceability }
	          },
	          {
	            ...baseArtifact,
	            id: 'asset-bom',
	            type: 'bom',
	            metadata: {
	              ...baseArtifact.metadata,
	              bomSummary: { itemCount: 16, totalCost: 160000, currency: 'CNY' },
	              quoteCostSummary: {
	                quotationSummary: { quotationNo: 'Q-ASSET-001', customerTotal: 230000, currency: 'CNY' },
	                costBreakdown: { directCost: 160000, customerTotal: 230000 },
	                marginGuard: { status: 'pass', minMarginRate: 0.18, targetMarginRate: 0.25 }
	              }
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'asset-quantity',
	            type: 'quantity-takeoff',
	            metadata: {
	              ...baseArtifact.metadata,
	              quantityTakeoffSummary: { pipeMeters: 86, valves: 18 }
	            }
	          },
	          { ...baseArtifact, id: 'asset-standards', type: 'standards-check' },
	          { ...baseArtifact, id: 'asset-report', type: 'customer-report' }
	        ].map(withRysnovaStorageEvidence)
	      }
	    });

	    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-no-asset-handoff');

	    expect(result.commercialReadiness.ready).toBe(true);
	    expect(result.customerSignoff.ready).toBe(true);
	    expect(result.installedAssetReadiness.ready).toBe(false);
	    expect(result.installedAssetHandoff).toBeNull();
	    expect(result.handoffReady).toBe(false);
	    expect(result.evidenceGaps).toEqual(expect.arrayContaining([
	      expect.objectContaining({ area: 'installed-asset-handoff', code: 'missing-installed-asset-handoff' })
	    ]));
	    expect(result.nextActions).toEqual(expect.arrayContaining([
	      'Prepare installed-asset handoff manifest for lifecycle IoT customer care.'
	    ]));
	  });

	  test('blocks deepening handoff when shared customer-visible artifacts lack integrity proof', async () => {
	    const storage = {
	      provider: 's3-compatible-object-storage',
	      uri: 's3://bucket/project-integrity-gate/artifact.json',
	      sizeBytes: 256,
	      contentType: 'application/json'
	    };
	    const standards = [
	      { code: 'GB 55020-2021', level: 'mandatory-general-code', edition: '2021', softwareCheck: 'passed' }
	    ];
	    const visualTraceability = rysnovaBimVisualTraceabilityFixture('visual-trace-integrity-gate');
	    const baseArtifact = {
	      tenantId: 'tenant-1',
	      projectId: 'project-integrity-gate',
	      version: 1,
	      status: 'shared',
	      permissions: { customerVisible: true },
	      metadata: { storage },
	      standards
	    };
	    const service = new RysnovaArtifactService({
	      artifactRepo: {},
	      memoryDb: {
	        rysnovaBimArtifacts: [
		          {
		            ...baseArtifact,
		            id: 'integrity-principle',
		            type: 'principle-diagram',
		            metadata: { ...baseArtifact.metadata, visualTraceability }
		          },
	          {
	            ...baseArtifact,
	            id: 'integrity-drawing',
	            type: 'construction-drawing',
	            metadata: {
	              storage,
	              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' },
	              drawingType: 'layout-2d',
	              visualTraceability
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'integrity-bim',
	            type: 'bim-model',
	            metadata: {
	              storage,
	              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' },
	              visualTraceability
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'integrity-bom',
	            type: 'bom',
	            metadata: {
	              storage,
	              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' },
	              bomSummary: { itemCount: 16, totalCost: 160000, currency: 'CNY' },
	              quoteCostSummary: {
	                quotationSummary: { quotationNo: 'Q-INT-001', customerTotal: 230000, currency: 'CNY' },
	                costBreakdown: { directCost: 160000, customerTotal: 230000 },
	                marginGuard: { status: 'pass', minMarginRate: 0.18, targetMarginRate: 0.25 }
	              }
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'integrity-quantity',
	            type: 'quantity-takeoff',
	            metadata: {
	              storage,
	              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' },
	              quantityTakeoffSummary: { pipeMeters: 86, valves: 18 }
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'integrity-standards',
	            type: 'standards-check',
	            metadata: {
	              storage,
	              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }
	            }
	          },
	          {
	            ...baseArtifact,
	            id: 'integrity-report',
	            type: 'customer-report',
	            metadata: {
	              storage,
		              integrity: { passed: true, checkedAt: '2026-06-12T08:00:00.000Z' }
		            }
		          }
		        ].map(withRysnovaStorageEvidence)
		      }
		    });

	    const result = await service.buildDeepeningPackage({ tenantId: 'tenant-1' }, 'project-integrity-gate');

	    expect(result.missingTypes).toEqual([]);
	    expect(result.approvalMissingTypes).toEqual([]);
	    expect(result.standardsSummary.passed).toBe(true);
	    expect(result.visualReadiness.ready).toBe(true);
	    expect(result.commercialReadiness.ready).toBe(true);
	    expect(result.customerSignoff.ready).toBe(true);
	    expect(result.storageIntegrityTodo).toEqual([
	      expect.objectContaining({
	        artifactId: 'integrity-principle',
	        type: 'principle-diagram',
	        reason: 'verify-object-integrity-before-customer-access',
	        requiredBefore: 'customer-download'
	      })
	    ]);
	    expect(result.engineeringReadiness.storageReady).toBe(false);
	    expect(result.handoffReady).toBe(false);
	    expect(result.status).toBe('blocked-or-in-progress');
	    expect(result.evidenceGaps).toEqual(expect.arrayContaining([
	      expect.objectContaining({
	        area: 'object-storage',
	        code: 'verify-object-integrity-before-customer-access',
	        type: 'principle-diagram'
	      })
	    ]));
	    expect(result.nextActions).toEqual(expect.arrayContaining([
	      'Upload artifacts to production object storage and verify content hashes.'
	    ]));
	  });

	  test('rejects unsupported artifact type before persistence', async () => {
	    const repo = { create: jest.fn() };
    const service = new RysnovaArtifactService({ artifactRepo: repo });

    await expect(service.createArtifact(
      { tenantId: 'tenant-1', userId: 'designer-1' },
      { projectId: 'project-1', type: 'random-demo' }
    )).rejects.toThrow('unsupported Rysnova artifact type');
    expect(repo.create).not.toHaveBeenCalled();
  });
});
