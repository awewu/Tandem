const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '../..');

function readRysnovaHtml() {
  return fs.readFileSync(path.join(ROOT, 'public/rysnova-bim-designer.html'), 'utf8');
}

function extractDeliverableScript() {
  const html = readRysnovaHtml();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const script = scripts.find(item => item.includes('function doGenerateDeliverables'));
  if (!script) throw new Error('Rysnova deliverable script not found');
  return script;
}

function tierDecisionEvidence(tier, overrides = {}) {
  const names = {
    essential: '预算优先，覆盖核心舒适需求和必要工程交付',
    balanced: '舒适、预算和后期服务均衡，适合作为默认成交方案',
    premium: '体验优先，强化系统冗余、控制精度和长期服务能力'
  };
  return {
    positioning: names[tier] || names.balanced,
    idealFor: tier === 'premium' ? ['大宅或高净值家庭', '追求长期服务'] : ['预算可控', '标准化交付'],
    valueDrivers: tier === 'premium' ? ['更高舒适冗余', '更多控制点和资产交接'] : ['控制初始投入', '保留标准化交付证据'],
    tradeoffs: tier === 'premium' ? ['初始投入最高'] : ['舒适冗余较少'],
    upgradeTriggers: ['增加全空气/新风/智能联动'],
    selectionRationale: tier === 'premium'
      ? '尊享方案是当前推荐/签核档位，后续七件套和客户签收以此档为准。'
      : '用于横向比选，不替代当前签核档位。',
    engineeringDelta: {
      systemFamilies: ['water', 'heating', 'fresh_air', 'air', 'control'],
      systemCount: 5,
      itemCount: 18,
      pipeMeters: tier === 'premium' ? 154 : 108,
      ductSqm: tier === 'premium' ? 46 : 31,
      valveCount: tier === 'premium' ? 30 : 20,
      controlPoints: tier === 'premium' ? 18 : 12,
      estimatedLaborHours: tier === 'premium' ? 112 : 84
    },
    commercialDecision: {
      currency: 'CNY',
      customerTotal: tier === 'premium' ? 398000 : 268000,
      monthlyPayment: tier === 'premium' ? 11056 : 7444,
      validDays: 30,
      commercialApprovalStatus: 'pass',
      internalCostHiddenFromCustomer: true
    },
    standardsDecision: {
      coverageStatus: 'complete',
      coveredDomains: ['thermal-comfort', 'smart-interoperability'],
      missingRequiredDomains: [],
      quoteDrivers: ['循环泵', '网关/控制器'],
      deliverableEvidence: ['热水负荷计算', 'IoT 设备绑定清单']
    },
    lifecycleDecision: {
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      assetCount: 5,
      requiredBeforeCustomerCare: ['contract-signed', 'installation-completed']
    },
    riskControls: ['报价已通过毛利底线保护', '标准覆盖完整', '仅交接生命周期资产，不开放实时控制'],
    customerSafe: true,
    ...overrides
  };
}

function createDeliverableHarness({
  token = '',
  response,
  contractId = 'CNT-LITH-001',
  projectId = 'project-ui-001',
  tier = 'premium'
} = {}) {
  function element({ value = '', selectedText = '' } = {}) {
    const item = { value, style: {}, selectedOptions: selectedText ? [{ text: selectedText }] : [] };
    Object.defineProperty(item, 'innerHTML', {
      get() {
        return this._innerHTML || '';
      },
      set(html) {
        this._innerHTML = html;
        this.textContent = String(html).replace(/<[^>]*>/g, '');
      }
    });
    item.innerHTML = '';
    return item;
  }

  const elements = {
    'deliverables-overlay': element(),
    'deliverable-contract-id': element({ value: contractId }),
    'deliverable-project-id': element({ value: projectId }),
    'deliverable-tier': element({ value: tier }),
    buildingArea: element({ value: '168' }),
    city: element({ value: '上海' }),
    projectName: element({ value: 'Rysnova UI合同项目' }),
    buildingFloors: element({ value: '2' }),
    floorHeight: element({ value: '3.1' }),
    heatingSystem: element({ selectedText: '低温地暖系统' }),
    coolingSystem: element({ selectedText: '全空气系统' }),
    'deliverables-result': element()
  };

  const document = {
    getElementById: id => elements[id] || null
  };

  const fetch = jest.fn(async () => ({
	    json: async () => response || {
	      success: true,
	      data: {
	        projectId: 'project-ui-001',
	        approvalMode: 'share-to-customer',
	        status: 'signoff-ready',
	        count: 7,
	        customerPackageReady: true,
	        handoffReady: true,
	        artifactTypes: [
	          'principle-diagram',
	          'construction-drawing',
	          'bim-model',
	          'bom',
	          'quantity-takeoff',
	          'standards-check',
	          'customer-report'
	        ],
	        artifacts: [
	          { type: 'principle-diagram', objectKey: 'tenant/project-ui-001/principle-diagram/v1/principle-diagram.svg' },
	          { type: 'construction-drawing', objectKey: 'tenant/project-ui-001/construction-drawing/v1/construction-drawing.svg' },
	          { type: 'bim-model', objectKey: 'tenant/project-ui-001/bim-model/v1/bim-model.json' },
	          { type: 'bom', objectKey: 'tenant/project-ui-001/bom/v1/bom.json' },
	          { type: 'quantity-takeoff', objectKey: 'tenant/project-ui-001/quantity-takeoff/v1/quantity-takeoff.json' },
	          { type: 'standards-check', objectKey: 'tenant/project-ui-001/standards-check/v1/standards-check.json' },
	          { type: 'customer-report', objectKey: 'tenant/project-ui-001/customer-report/v1/customer-report.json' }
	        ],
	        visualArtifacts: [
	          { type: 'principle-diagram' },
	          { type: 'construction-drawing' },
	          { type: 'bim-model' }
	        ],
	        tierComparison: {
	          selectedTier: 'premium',
	          recommendedTier: 'premium',
	          tierCount: 3,
	          tiers: [
	            { tier: 'essential', tierName: '基础方案', selected: false, recommended: false, currency: 'CNY', customerTotal: 268000, monthlyPayment: 7444, itemCount: 18, systemCount: 5, quantityTakeoffSummary: { pipeMeters: 108, valveCount: 20 }, marginGuard: { status: 'pass' }, standardsCoverageStatus: 'complete', lifecycleHandoff: { assetCount: 5, realtimeControl: false }, decisionEvidence: tierDecisionEvidence('essential') },
	            { tier: 'balanced', tierName: '均衡方案', selected: false, recommended: false, currency: 'CNY', customerTotal: 328000, monthlyPayment: 9111, itemCount: 18, systemCount: 5, quantityTakeoffSummary: { pipeMeters: 126, valveCount: 24 }, marginGuard: { status: 'pass' }, standardsCoverageStatus: 'complete', lifecycleHandoff: { assetCount: 5, realtimeControl: false }, decisionEvidence: tierDecisionEvidence('balanced') },
	            { tier: 'premium', tierName: '尊享方案', selected: true, recommended: true, currency: 'CNY', customerTotal: 398000, monthlyPayment: 11056, itemCount: 18, systemCount: 5, quantityTakeoffSummary: { pipeMeters: 154, valveCount: 30 }, marginGuard: { status: 'pass' }, standardsCoverageStatus: 'complete', lifecycleHandoff: { assetCount: 5, realtimeControl: false }, decisionEvidence: tierDecisionEvidence('premium') }
	          ]
	        },
	        deliverableArtifacts: [
	          { type: 'bom' },
	          { type: 'quantity-takeoff' },
	          { type: 'standards-check' },
	          { type: 'customer-report' }
	        ],
	        storageEvidence: [
	          { type: 'principle-diagram', version: 1, provider: 'memory-object-storage', sizeBytes: 6144, contentHash: 'sha256:principlehash' },
	          { type: 'construction-drawing', version: 1, provider: 'memory-object-storage', sizeBytes: 7168, contentHash: 'sha256:drawinghash' },
	          { type: 'bim-model', version: 1, provider: 'memory-object-storage', sizeBytes: 8192, contentHash: 'sha256:bimhash' },
	          { type: 'bom', version: 1, provider: 'memory-object-storage', sizeBytes: 4096, contentHash: 'sha256:bomhash' },
	          { type: 'quantity-takeoff', version: 1, provider: 'memory-object-storage', sizeBytes: 3072, contentHash: 'sha256:qtohash' },
	          { type: 'standards-check', version: 1, provider: 'memory-object-storage', sizeBytes: 2048, contentHash: 'sha256:stdhash' },
	          { type: 'customer-report', version: 1, provider: 'memory-object-storage', sizeBytes: 5120, contentHash: 'sha256:reporthash' }
	        ],
	        customerPackage: {
	          count: 7,
	          missingTypes: [],
	          readiness: { packageReady: true, objectStorageIntegrityReady: true },
	          downloadManifest: {
	            ready: true,
	            count: 7,
	            readyCount: 7,
	            blockedCount: 0,
	            generatedAt: '2026-06-12T09:00:00.000Z',
		            items: [
	              { artifactId: 'principle-ui', type: 'principle-diagram', label: '设计原理图', fileRole: 'principle-diagram', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/principle-diagram/v1/principle-diagram.svg', contentHash: 'sha256:principlehash', contentType: 'image/svg+xml', sizeBytes: 6144, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', visualQualityEvidence: { passed: true, status: 'passed', checks: { nonBlank: true, hasTraceability: true, realtimeControl: false }, expectedRefs: ['HW-1', 'AIR-1'], blockers: [] }, blockers: [] },
	              { artifactId: 'drawing-ui', type: 'construction-drawing', label: '2D 施工布局图', fileRole: 'layout-2d', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/construction-drawing/v1/construction-drawing.svg', contentHash: 'sha256:drawinghash', contentType: 'image/svg+xml', sizeBytes: 7168, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', visualQualityEvidence: { passed: true, status: 'passed', checks: { nonBlank: true, hasTraceability: true, realtimeControl: false }, expectedRefs: ['PIPE-1', 'VALVE-1', 'CTRL-1'], blockers: [] }, blockers: [] },
	              { artifactId: 'bim-ui', type: 'bim-model', label: '3D / BIM 示意模型', fileRole: 'bim-or-3d-preview', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/bim-model/v1/bim-model.json', contentHash: 'sha256:bimhash', contentType: 'application/json', sizeBytes: 8192, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', visualQualityEvidence: { passed: true, status: 'passed', checks: { nonBlank: true, hasTraceability: true, realtimeControl: false }, expectedRefs: ['ZONE-1'], blockers: [] }, blockers: [] },
	              { artifactId: 'bom-ui', type: 'bom', label: 'BOM 材料清单', fileRole: 'commercial-bom', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/bom/v1/bom.json', contentHash: 'sha256:bomhash', contentType: 'application/json', sizeBytes: 4096, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'qto-ui', type: 'quantity-takeoff', label: '工程量清单', fileRole: 'quantity-takeoff', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/quantity-takeoff/v1/quantity-takeoff.json', contentHash: 'sha256:qtohash', contentType: 'application/json', sizeBytes: 3072, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'std-ui', type: 'standards-check', label: '标准校核报告', fileRole: 'standards-compliance', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/standards-check/v1/standards-check.json', contentHash: 'sha256:stdhash', contentType: 'application/json', sizeBytes: 2048, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'report-ui', type: 'customer-report', label: '客户深化报告', fileRole: 'customer-report', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/customer-report/v1/customer-report.json', contentHash: 'sha256:reporthash', contentType: 'application/json', sizeBytes: 5120, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] }
		            ]
		          },
		          customerSignoffManifest: {
		            manifestId: 'rysnova-bim-signoff-ui-ready',
		            packageType: 'rysnova-bim-customer-signoff-manifest',
		            projectId: 'project-ui-001',
		            deliveryStage: 'customer-signoff-ready',
		            ready: true,
		            requiredTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
		            artifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
		            artifactCount: 7,
		            missingTypes: [],
		            download: { ready: true, readyCount: 7, blockedCount: 0 },
		            quoteSummary: { currency: 'CNY', customerTotal: 328000, monthlyPayment: 9111, validDays: 30 },
		            lifecycleHandoff: { handoffBoundary: 'lifecycle_handoff_only', realtimeControl: false, targetPlatform: 'external-iot-lifecycle-platform', assetCount: 5 },
		            signoffAction: {
		              allowed: true,
		              required: 'customer-signature-required',
		              requiredCustomerAcknowledgements: [
		                'solution-scope-reviewed',
		                'quotation-summary-reviewed',
		                'engineering-deliverables-received',
		                'standards-precheck-reviewed',
		                'lifecycle-handoff-boundary-reviewed'
		              ]
		            },
		            artifacts: [],
		            boundary: {
		              customerSafe: true,
		              omittedFieldGroups: ['internal-costing', 'tenant-scope', 'approval-audit', 'raw-records'],
		              handoffBoundary: 'lifecycle_handoff_only',
		              realtimeControl: false
		            },
		            generatedAt: '2026-06-12T09:00:00.000Z'
		          },
		          artifacts: [
	            { type: 'principle-diagram', objectKey: 'tenant/project-ui-001/principle-diagram/v1/principle-diagram.svg', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 6144, integrityPassed: true }, contentHash: 'sha256:principlehash' },
	            { type: 'construction-drawing', objectKey: 'tenant/project-ui-001/construction-drawing/v1/construction-drawing.svg', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 7168, integrityPassed: true }, contentHash: 'sha256:drawinghash' },
	            { type: 'bim-model', objectKey: 'tenant/project-ui-001/bim-model/v1/bim-model.json', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 8192, integrityPassed: true }, contentHash: 'sha256:bimhash' },
	            { type: 'bom', objectKey: 'tenant/project-ui-001/bom/v1/bom.json', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 4096, integrityPassed: true }, contentHash: 'sha256:bomhash' },
	            { type: 'quantity-takeoff', objectKey: 'tenant/project-ui-001/quantity-takeoff/v1/quantity-takeoff.json', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 3072, integrityPassed: true }, contentHash: 'sha256:qtohash' },
	            { type: 'standards-check', objectKey: 'tenant/project-ui-001/standards-check/v1/standards-check.json', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 2048, integrityPassed: true }, contentHash: 'sha256:stdhash' },
	            { type: 'customer-report', objectKey: 'tenant/project-ui-001/customer-report/v1/customer-report.json', customerVisible: true, storage: { provider: 'memory-object-storage', sizeBytes: 5120, integrityPassed: true }, contentHash: 'sha256:reporthash' }
	          ]
	        },
	        deepeningPackage: {
	          visualReadiness: { ready: true },
	          commercialReadiness: { ready: true },
	          customerSignoff: { ready: true }
	        },
	        evidenceGaps: [],
	        nextActions: [],
	        generatedAt: '2026-06-12T09:00:00.000Z',
	        customerReportSummary: { sectionCount: 7, iotBoundary: 'lifecycle_handoff_only' },
	        bomSummary: { itemCount: 18 },
        quoteCostSummary: { quotationSummary: { customerTotal: 328000 }, marginGuard: { status: 'pass' } },
        quantityTakeoffSummary: { pipeMeters: 126, valveCount: 24 },
        standardsSummary: { counts: { passed: 18, warning: 1, failed: 0 } }
      }
    }
  }));

  const localStorage = {
    getItem: jest.fn(key => (key === 'token' ? token : ''))
  };

  const context = vm.createContext({
    window: { document },
    document,
    localStorage,
    fetch,
    console,
    encodeURIComponent,
    parseFloat,
    parseInt,
    Date,
    Error,
    JSON
  });

  vm.runInContext(extractDeliverableScript(), context, {
    filename: 'public/rysnova-bim-designer.html:inline-deliverables'
  });

  return { elements, context, fetch, localStorage };
}

describe('Rysnova frontend deliverable contract', () => {
  test('binds the deliverable overlay to the v2 download manifest contract', () => {
    const html = readRysnovaHtml();

    expect(html).not.toContain('Math.random');
    expect(html).not.toContain('value="CNT-20260401-001"');
    expect(html).not.toContain('value="project-rysnova-bim-001"');
    expect(html).toContain('输入已签约合同 ID');
    expect(html).toContain('输入客户项目 ID');
    expect(html).toContain('deliverable-tier');
    expect(html).toContain('三档方案报价对比');
    expect(html).toContain('当前签核');
    expect(html).toContain('毛利保护');
    expect(html).toContain('decisionEvidence');
    expect(html).toContain('工程差异');
    expect(html).toContain('风险控制');
    expect(html).toContain('valueDrivers');
    expect(html).toContain('idealFor');
    expect(html).toContain('areaWeights');
    expect(html).toContain('d.customerPackage?.downloadManifest || d.deepeningPackage?.downloadManifest');
    expect(html).toContain('downloadManifest.items');
    expect(html).toContain('downloadByType[item.type]');
    expect(html).toContain('downloadManifest.readyCount');
    expect(html).toContain('downloadManifest.blockedCount');
    expect(html).toContain('download ready');
    expect(html).toContain('download blocked');
    expect(html).toContain('visualQualityEvidence');
    expect(html).toContain('视觉质量');
    expect(html).toContain('refs ${refs}');
    expect(html).toContain('阻塞：');
    expect(html).toContain('download manifest ${downloadSummary}');
    expect(html).toContain('d.customerSignoffManifest || d.customerPackage?.customerSignoffManifest');
    expect(html).toContain('客户签收清单');
    expect(html).toContain('requiredCustomerAcknowledgements');
    expect(html).toContain('omittedFieldGroups');
  });

  test('opens the deliverable overlay without navigating away from the standalone workbench', () => {
    const { context, elements } = createDeliverableHarness();

    context.generateRysnovaDeliverables({ preventDefault: jest.fn() });

    expect(elements['deliverables-overlay'].style.display).toBe('flex');
  });

  test('blocks production deliverable generation when staff or designer token is missing', async () => {
    const { context, elements, fetch } = createDeliverableHarness({ token: '' });

    await context.doGenerateDeliverables();

    expect(fetch).not.toHaveBeenCalled();
    expect(elements['deliverables-result'].textContent).toContain('未检测到员工/设计师登录 token');
  });

  test('blocks customer signoff package generation without explicit contract and project ids', async () => {
    const { context, elements, fetch } = createDeliverableHarness({
      token: 'unit-token',
      contractId: '',
      projectId: ''
    });

    await context.doGenerateDeliverables();

    expect(fetch).not.toHaveBeenCalled();
    expect(elements['deliverables-result'].textContent).toContain('请填写真实合同 ID 和项目 ID');
    expect(elements['deliverables-result'].textContent).toContain('不能使用演示默认编号');
  });

	  test('posts a tenant-authenticated v2 signoff payload and renders all seven customer signoff artifacts', async () => {
    const { context, elements, fetch } = createDeliverableHarness({ token: 'unit-token' });

    await context.doGenerateDeliverables();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
	    expect(url).toBe('/api/v2/rysnova-bim/projects/project-ui-001/signoff-package');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer unit-token');
    expect(options.headers['Content-Type']).toBe('application/json');

    const payload = JSON.parse(options.body);
    expect(payload).toEqual(expect.objectContaining({
	      tier: 'premium',
	      approvalMode: 'share-to-customer',
	      pricing: expect.objectContaining({
        targetMarginRate: 0.25,
        minMarginRate: 0.16,
        taxRate: 0.09
      })
    }));
    expect(payload.project).toEqual(expect.objectContaining({
      name: 'Rysnova UI合同项目',
      city: '上海',
      area: 168,
      contractId: 'CNT-LITH-001',
      floors: 2,
      floorHeight: 3.1
    }));
    expect(payload.systems.map(item => item.type)).toEqual([
      'hot_water',
      'heating',
      'fresh_air',
      'air',
      'smart_control'
    ]);

	    const output = elements['deliverables-result'].textContent;
	    expect(output).toContain('客户签核包已就绪');
	    expect(output).toContain('七类客户签核工件完整');
	    expect(output).toContain('系统设计原理图');
	    expect(output).toContain('2D 施工布局图');
	    expect(output).toContain('3D / BIM 示意模型');
	    expect(output).toContain('客户深化报告');
	    expect(output).toContain('BOM / 报价成本包');
	    expect(output).toContain('工程量清单');
	    expect(output).toContain('标准校核');
	    expect(output).toContain('Rysnova v2 signoff package contract');
	    expect(output).toContain('tenant/project-ui-001/principle-diagram/v1/principle-diagram.svg');
	    expect(output).toContain('tenant/project-ui-001/construction-drawing/v1/construction-drawing.svg');
	    expect(output).toContain('tenant/project-ui-001/bim-model/v1/bim-model.json');
	    expect(output).toContain('tenant/project-ui-001/bom/v1/bom.json');
	    expect(output).toContain('memory-object-storage');
	    expect(output).toContain('sha256:bomhash');
	    expect(output).toContain('4KB');
	    expect(output).toContain('download ready');
	    expect(output).toContain('视觉质量 passed');
	    expect(output).toContain('非空 通过');
	    expect(output).toContain('追溯 通过');
	    expect(output).toContain('refs 2');
	    expect(output).toContain('refs 3');
	    expect(output).toContain('refs 1');
	    expect(output).toContain('实时控制 禁用');
	    expect(output).toContain('全部文件可下载');
	    expect(output).toContain('7/7 可下载');
	    expect(output).toContain('download manifest 7/7 可下载');
	    expect(output).toContain('客户签收清单');
	    expect(output).toContain('三档方案报价对比');
	    expect(output).toContain('基础方案');
	    expect(output).toContain('均衡方案');
	    expect(output).toContain('尊享方案');
	    expect(output).toContain('当前签核');
	    expect(output).toContain('推荐');
	    expect(output).toContain('体验优先，强化系统冗余、控制精度和长期服务能力');
	    expect(output).toContain('适用 大宅或高净值家庭 / 追求长期服务');
	    expect(output).toContain('价值 更高舒适冗余 / 更多控制点和资产交接');
	    expect(output).toContain('工程差异 管线 154m');
	    expect(output).toContain('控制点 18');
	    expect(output).toContain('风险控制 报价已通过毛利底线保护 / 标准覆盖完整');
	    expect(output).toContain('毛利保护 pass');
	    expect(output).toContain('标准 complete');
	    expect(output).toContain('rysnova-bim-signoff-ui-ready');
	    expect(output).toContain('允许客户签署');
	    expect(output).toContain('方案范围 / 报价摘要 / 工程交付物 / 标准预校核 / 生命周期边界');
	    expect(output).toContain('manifest download ready');
	    expect(output).toContain('customer-safe groups internal-costing / tenant-scope / approval-audit / raw-records');
	    expect(output).toContain('3 个视觉工件');
	    expect(output).toContain('4 个工程/商务工件');
	  });

	  test('renders download manifest blockers when customer package files are not ready', async () => {
	    const response = {
	      success: true,
	      data: {
	        projectId: 'project-ui-001',
	        approvalMode: 'share-to-customer',
	        status: 'review-generated',
	        count: 7,
	        customerPackageReady: false,
	        handoffReady: false,
	        artifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
	        artifacts: [],
	        storageEvidence: [],
	        customerPackage: {
	          missingTypes: [],
	          readiness: { packageReady: false, objectStorageIntegrityReady: false },
	          downloadManifest: {
	            ready: false,
	            count: 7,
	            readyCount: 6,
	            blockedCount: 1,
	            generatedAt: '2026-06-12T09:00:00.000Z',
	            items: [
	              { artifactId: 'principle-ui', type: 'principle-diagram', label: '设计原理图', fileRole: 'principle-diagram', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/principle-diagram/v1/principle-diagram.svg', contentHash: 'sha256:principlehash', contentType: 'image/svg+xml', sizeBytes: 6144, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', visualQualityEvidence: { passed: true, status: 'passed', checks: { nonBlank: true, hasTraceability: true, realtimeControl: false }, expectedRefs: ['HW-1'], blockers: [] }, blockers: [] },
	              { artifactId: 'drawing-ui', type: 'construction-drawing', label: '2D 施工布局图', fileRole: 'layout-2d', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/construction-drawing/v1/construction-drawing.svg', contentHash: 'sha256:drawinghash', contentType: 'image/svg+xml', sizeBytes: 7168, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'bim-ui', type: 'bim-model', label: '3D / BIM 示意模型', fileRole: 'bim-or-3d-preview', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/bim-model/v1/bim-model.json', contentHash: 'sha256:bimhash', contentType: 'application/json', sizeBytes: 8192, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', visualQualityEvidence: { passed: false, status: 'blocked', checks: { nonBlank: true, hasTraceability: false, realtimeControl: false }, expectedRefs: [], blockers: [{ code: 'visual-traceability-missing' }] }, blockers: [] },
	              { artifactId: 'bom-ui', type: 'bom', label: 'BOM 材料清单', fileRole: 'commercial-bom', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/bom/v1/bom.json', contentHash: 'sha256:bomhash', contentType: 'application/json', sizeBytes: 4096, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'qto-ui', type: 'quantity-takeoff', label: '工程量清单', fileRole: 'quantity-takeoff', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/quantity-takeoff/v1/quantity-takeoff.json', contentHash: 'sha256:qtohash', contentType: 'application/json', sizeBytes: 3072, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'std-ui', type: 'standards-check', label: '标准校核报告', fileRole: 'standards-compliance', version: 1, status: 'shared', objectKey: 'tenant/project-ui-001/standards-check/v1/standards-check.json', contentHash: 'sha256:stdhash', contentType: 'application/json', sizeBytes: 2048, provider: 'memory-object-storage', integrityPassed: true, downloadReady: true, qualityStatus: 'passed', signoffStatus: 'customer-visible', blockers: [] },
	              { artifactId: 'report-ui', type: 'customer-report', label: '客户深化报告', fileRole: 'customer-report', version: 1, status: 'approved', objectKey: 'tenant/project-ui-001/customer-report/v1/customer-report.json', contentHash: 'sha256:reporthash', contentType: 'application/json', sizeBytes: 0, provider: 'memory-object-storage', integrityPassed: false, downloadReady: false, qualityStatus: 'blocked', signoffStatus: 'customer-visible', blockers: [{ code: 'storage-not-ready' }, { code: 'integrity-not-verified' }] }
		            ]
		          }
		          ,
		          customerSignoffManifest: {
		            manifestId: 'rysnova-bim-signoff-ui-blocked',
		            packageType: 'rysnova-bim-customer-signoff-manifest',
		            projectId: 'project-ui-001',
		            deliveryStage: 'customer-review-incomplete',
		            ready: false,
		            requiredTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
		            artifactTypes: ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
		            artifactCount: 7,
		            missingTypes: [],
		            download: { ready: false, readyCount: 6, blockedCount: 1 },
		            quoteSummary: { currency: 'CNY', customerTotal: 328000, monthlyPayment: 9111, validDays: 30 },
		            lifecycleHandoff: null,
		            signoffAction: {
		              allowed: false,
		              required: 'complete-evidence-before-signature',
		              requiredCustomerAcknowledgements: [
		                'solution-scope-reviewed',
		                'quotation-summary-reviewed',
		                'engineering-deliverables-received',
		                'standards-precheck-reviewed',
		                'lifecycle-handoff-boundary-reviewed'
		              ]
		            },
		            artifacts: [],
		            boundary: {
		              customerSafe: true,
		              omittedFieldGroups: ['internal-costing', 'tenant-scope', 'approval-audit', 'raw-records'],
		              handoffBoundary: 'lifecycle_handoff_only',
		              realtimeControl: false
		            },
		            generatedAt: '2026-06-12T09:00:00.000Z'
		          }
		        },
	        deepeningPackage: {
	          visualReadiness: { ready: true },
	          commercialReadiness: { ready: true },
	          customerSignoff: { ready: false }
	        },
	        evidenceGaps: [{ area: 'object-storage', code: 'integrity-not-verified' }],
	        nextActions: ['Upload artifacts to production object storage and verify content hashes.'],
	        generatedAt: '2026-06-12T09:00:00.000Z',
	        customerReportSummary: { sectionCount: 7, iotBoundary: 'lifecycle_handoff_only' },
	        bomSummary: { itemCount: 18 },
	        quoteCostSummary: { quotationSummary: { customerTotal: 328000 }, marginGuard: { status: 'pass' } },
	        quantityTakeoffSummary: { pipeMeters: 126, valveCount: 24 },
	        standardsSummary: { counts: { passed: 18, warning: 1, failed: 0 } }
	      }
	    };
	    const { context, elements } = createDeliverableHarness({ token: 'unit-token', response });

	    await context.doGenerateDeliverables();

	    const output = elements['deliverables-result'].textContent;
	    expect(output).toContain('签核包仍需复核');
	    expect(output).toContain('存在文件阻塞');
	    expect(output).toContain('6/7 可下载');
	    expect(output).toContain('1 阻塞');
	    expect(output).toContain('download blocked');
	    expect(output).toContain('视觉质量 blocked');
	    expect(output).toContain('阻塞 visual-traceability-missing');
	    expect(output).toContain('阻塞：storage-not-ready / integrity-not-verified');
	    expect(output).toContain('rysnova-bim-signoff-ui-blocked');
	    expect(output).toContain('需补齐证据后签署');
	    expect(output).toContain('manifest download blocked');
	  });
	});
