const crypto = require('crypto');
const BaseRepository = require('../../repositories/BaseRepository');
const RysnovaArtifact = require('../../models/RysnovaArtifact');
const SolutionVisualPackageService = require('../solution-visuals/solution-visual-package.service');
const {
  contentHashFromBytes,
  createDefaultArtifactStorageAdapter
} = require('./artifact-storage.adapter');
const OutboxService = require('../outbox/outbox.service');
const {
  MODULES,
  rysnovaBimModuleContext
} = require('../productModules/product-module-registry');
const SystemPacksService = require('../system-packs/system-packs.service');
const { REQUIRED_STANDARDS_COVERAGE_DOMAINS } = require('../system-packs/rheemSystemPacks');

const ARTIFACT_TYPES = new Set([
  'concept-effect-view',
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
]);

const ARTIFACT_STATUSES = new Set(['draft', 'reviewing', 'approved', 'shared', 'superseded', 'archived']);
const CUSTOMER_VISIBLE_STATUSES = new Set(['approved', 'shared']);
const DEEPENING_REQUIRED_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check'
];
const DEEPENING_APPROVAL_REQUIRED_TYPES = new Set(DEEPENING_REQUIRED_TYPES);
const DEEPENING_VISUAL_REQUIREMENTS = [
  { key: 'principleDiagram', label: '设计原理图', artifactType: 'principle-diagram' },
  { key: 'layout2d', label: '2D布局图', artifactType: 'construction-drawing' },
  { key: 'illustration3d', label: '3D示意图', artifactType: 'bim-model' }
];
const VISUAL_QUALITY_RULES = {
  'principle-diagram': {
    key: 'principleDiagram',
    traceRefField: 'principleDiagramNode',
    expectedPrefix: 'principle-node-',
    contentKind: 'svg'
  },
  'construction-drawing': {
    key: 'layout2d',
    traceRefField: 'layoutDeviceNode',
    expectedPrefix: 'layout-device-',
    contentKind: 'svg'
  },
  'bim-model': {
    key: 'illustration3d',
    traceRefField: 'scene3dDeviceNode',
    expectedPrefix: 'scene3d-device-',
    contentKind: 'bim'
  }
};
const VISUAL_ARTIFACT_TYPES = new Set(Object.keys(VISUAL_QUALITY_RULES));
const CUSTOMER_SIGNOFF_REQUIRED_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];
const CUSTOMER_SIGNOFF_ACKNOWLEDGEMENTS = [
  'solution-scope-reviewed',
  'quotation-summary-reviewed',
  'engineering-deliverables-received',
  'standards-precheck-reviewed',
  'lifecycle-handoff-boundary-reviewed'
];
const CUSTOMER_SIGNOFF_METHODS = new Set([
  'customer_portal_confirmation',
  'onsite_tablet_signature',
  'dealer_assisted_confirmation'
]);
const STANDARD_CHECK_STATUSES = ['passed', 'warning', 'failed', 'not-applicable'];
const DELIVERABLE_ARTIFACT_KEYS = ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'];
const TIER_KEYS = ['essential', 'balanced', 'premium'];
const SYSTEM_FAMILY_DEFAULTS = {
  water: {
    category: 'hot_water',
    brand: 'Rheem',
    equipmentName: '中央热水主机',
    model: 'DHW-CENTRAL',
    baseEquipmentCost: 42000,
    pipePerArea: 0.42,
    valveBase: 8,
    laborPerArea: 95,
    standards: ['GB 55020-2021', 'GB 50015-2019']
  },
  heating: {
    category: 'heating',
    brand: 'Ruud',
    equipmentName: '采暖热源及分集水器',
    model: 'HEAT-HYDRONIC',
    baseEquipmentCost: 38000,
    pipePerArea: 0.72,
    valveBase: 10,
    laborPerArea: 120,
    standards: ['GB 55015-2021', 'GB 50736-2012']
  },
  purification: {
    category: 'water_treatment',
    brand: 'Everhot',
    equipmentName: '全屋净水系统',
    model: 'WATER-PURIFICATION',
    baseEquipmentCost: 18000,
    pipePerArea: 0.18,
    valveBase: 5,
    laborPerArea: 35,
    standards: ['GB 5749-2022', 'GB 55020-2021']
  },
  fresh_air: {
    category: 'fresh_air',
    brand: 'Ruud',
    equipmentName: '全热交换新风主机',
    model: 'ERV-DOAS',
    baseEquipmentCost: 26000,
    pipePerArea: 0.55,
    valveBase: 6,
    laborPerArea: 85,
    standards: ['GB 55015-2021', 'GB/T 18883-2022']
  },
  ac: {
    category: 'air',
    brand: 'Ruud',
    equipmentName: '全空气 / 空调系统主机',
    model: 'AIR-COMFORT',
    baseEquipmentCost: 52000,
    pipePerArea: 0.48,
    valveBase: 7,
    laborPerArea: 135,
    standards: ['GB 55015-2021', 'GB 50736-2012']
  },
  control: {
    category: 'smart_control',
    brand: 'Rheem',
    equipmentName: '智能控制网关',
    model: 'COMFORT-CONTROL',
    baseEquipmentCost: 12000,
    pipePerArea: 0.08,
    valveBase: 2,
    laborPerArea: 25,
    standards: ['GB/T 34043-2017']
  },
  other: {
    category: 'other',
    brand: 'Rheem',
    equipmentName: '舒适家系统设备',
    model: 'COMFORT-SYSTEM',
    baseEquipmentCost: 16000,
    pipePerArea: 0.22,
    valveBase: 4,
    laborPerArea: 50,
    standards: ['GB 55015-2021']
  }
};

class RysnovaArtifactService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || null;
    this.forceMemoryMode = options.forceMemoryMode === true;
    this.artifactRepo = options.artifactRepo || new BaseRepository(RysnovaArtifact);
    this.now = options.now || (() => new Date());
    this.storageAdapter = createDefaultArtifactStorageAdapter(options);
    this.visualPackageService = options.visualPackageService || new SolutionVisualPackageService({
      drawingRenderer: options.drawingRenderer,
      renderer3D: options.renderer3D,
      now: options.now
    });
    this.systemPacksService = options.systemPacksService || new SystemPacksService(options.systemPacks || {});
    this.outboxService = options.outboxService || new OutboxService({
      db: this.memoryDb,
      memoryDb: this.memoryDb,
      outboxRepo: options.outboxRepo
    });
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && (this.forceMemoryMode || !process.env.MONGODB_URI));
  }

  ensureMemoryIndexes() {
    if (!this.memoryDb) return null;
    const artifactCount = Array.isArray(this.memoryDb.rysnovaBimArtifacts)
      ? this.memoryDb.rysnovaBimArtifacts.length
      : 0;
    const indexes = this.memoryDb.rysnovaBimArtifactIndexes;
    if (!indexes || indexes.artifactCount !== artifactCount) {
      return this.rebuildMemoryIndexes();
    }
    return indexes;
  }

  memoryTenantProjectKey(tenantId, projectId) {
    return `${String(tenantId)}:${String(projectId)}`;
  }

  indexMemoryArtifact(artifact, providedIndexes = null) {
    const indexes = providedIndexes || this.ensureMemoryIndexes();
    if (!indexes || !artifact) return;
    const artifactIds = [artifact.id, artifact._id, artifact.objectKey]
      .filter(Boolean)
      .map(value => String(value));
    for (const artifactId of artifactIds) indexes.byId.set(artifactId, artifact);

    const key = this.memoryTenantProjectKey(artifact.tenantId, artifact.projectId);
    const projectArtifacts = indexes.byTenantProject.get(key) || [];
    if (!projectArtifacts.includes(artifact)) projectArtifacts.push(artifact);
    indexes.byTenantProject.set(key, projectArtifacts);
    indexes.artifactCount = this.getMemoryArtifacts().length;
  }

  rebuildMemoryIndexes() {
    if (!this.memoryDb) return null;
    const artifacts = this.getMemoryArtifacts();
    const indexes = {
      byId: new Map(),
      byTenantProject: new Map(),
      artifactCount: artifacts.length
    };
    this.memoryDb.rysnovaBimArtifactIndexes = indexes;
    for (const artifact of artifacts) this.indexMemoryArtifact(artifact, indexes);
    indexes.artifactCount = artifacts.length;
    return indexes;
  }

  getMemoryArtifactsForQuery(scope, query = {}) {
    const artifacts = this.getMemoryArtifacts();
    const indexes = this.ensureMemoryIndexes();
    if (!indexes) return artifacts;
    if (query.projectId) {
      const key = this.memoryTenantProjectKey(scope.tenantId, query.projectId);
      return indexes.byTenantProject.get(key) || [];
    }
    return artifacts;
  }

  findMemoryArtifactById(scope, artifactId) {
    const indexes = this.ensureMemoryIndexes();
    let artifact = indexes?.byId.get(String(artifactId));
    if (!artifact) {
      artifact = this.getMemoryArtifacts().find(item => (
        String(item.id) === String(artifactId) ||
        String(item._id) === String(artifactId) ||
        String(item.objectKey) === String(artifactId)
      ));
      if (artifact) this.indexMemoryArtifact(artifact);
    }
    if (!artifact || String(artifact.tenantId) !== String(scope.tenantId)) return null;
    return artifact;
  }

  createHash(value) {
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
  }

  normalizeContentType(data = {}) {
    if (data.contentType) return data.contentType;
    if (data.type === 'bom' || data.type === 'quantity-takeoff' || data.type === 'standards-check') return 'application/json';
    if (data.type === 'principle-diagram') return 'application/vnd.rhautt.rysnova-bim.diagram+json';
    if (data.type === 'bim-model') return 'model/gltf-binary';
    if (data.type === 'construction-drawing') return 'application/pdf';
    if (data.type === 'concept-effect-view') return 'image/png';
    if (data.type === 'customer-report') return 'application/pdf';
    return 'application/octet-stream';
  }

  artifactExtension(data = {}) {
    if (data.extension) return String(data.extension).replace(/^\./, '');
    if (data.type === 'construction-drawing' || data.type === 'customer-report') return 'pdf';
    if (data.type === 'concept-effect-view') return 'png';
    if (data.type === 'bim-model') return 'glb';
    if (data.type === 'principle-diagram') return 'json';
    return 'json';
  }

  assertTenantProjectObjectKey(scope, projectId, objectKey) {
    const expectedPrefix = `${String(scope.tenantId)}/${String(projectId)}/`;
    const normalized = String(objectKey || '').replace(/\\/g, '/');
    if (
      !normalized.startsWith(expectedPrefix) ||
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      normalized.startsWith('~')
    ) {
      const err = new Error('Rysnova artifact objectKey must be tenant/project scoped');
      err.status = 400;
      err.expectedPrefix = expectedPrefix;
      throw err;
    }
    return normalized;
  }

  hasPersistableContent(data = {}) {
    return Object.prototype.hasOwnProperty.call(data, 'content') ||
      Object.prototype.hasOwnProperty.call(data, 'fileContent') ||
      Object.prototype.hasOwnProperty.call(data, 'artifactContent');
  }

  artifactContent(data = {}) {
    if (Object.prototype.hasOwnProperty.call(data, 'content')) return data.content;
    if (Object.prototype.hasOwnProperty.call(data, 'fileContent')) return data.fileContent;
    if (Object.prototype.hasOwnProperty.call(data, 'artifactContent')) return data.artifactContent;
    return data.metadata || {};
  }

  asVisualText(value) {
    if (typeof value === 'string') return value;
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return '';
  }

  uniqueValues(values = []) {
    return [...new Set(values.filter(Boolean).map(value => String(value)))];
  }

  visualTraceRefs(traceability = {}, rule = {}) {
    const nodes = Array.isArray(traceability?.systemNodes) ? traceability.systemNodes : [];
    return this.uniqueValues(nodes.map(node => node.drawingRefs?.[rule.traceRefField]));
  }

  visualQualityEvidenceForContent(type, content, metadata = {}) {
    const rule = VISUAL_QUALITY_RULES[type];
    if (!rule) return null;

    const traceability = metadata.visualTraceability || metadata.traceability || content?.traceability || null;
    const expectedRefs = this.visualTraceRefs(traceability, rule);
    const blockers = [];
    const warnings = [];
    let nonBlank = false;
    let hasExpectedRefs = false;
    let hasTraceability = Boolean(traceability?.traceabilityId || expectedRefs.length);
    let hasPreview = false;

    if (rule.contentKind === 'svg') {
      const svgText = this.asVisualText(content);
      nonBlank = svgText.trim().length > 80 && /<svg[\s>]/i.test(svgText);
      hasPreview = nonBlank;
      if (!nonBlank) blockers.push({ code: 'visual-svg-empty', message: 'Visual SVG must be nonblank.' });
      if (expectedRefs.length) {
        const missingRefs = expectedRefs.filter(ref => !svgText.includes(ref));
        hasExpectedRefs = missingRefs.length === 0;
        if (missingRefs.length) {
          blockers.push({
            code: 'visual-trace-ref-missing',
            missingRefs,
            message: 'Visual SVG is missing expected traceability node references.'
          });
        }
      } else {
        blockers.push({ code: 'visual-traceability-missing', message: 'Visual traceability nodes are required.' });
      }
    } else {
      const scene = content?.scene || null;
      const previewSvg = content?.previewSvg || content?.inlineSvg || null;
      const previewText = this.asVisualText(previewSvg);
      const sceneText = this.asVisualText(scene);
      hasPreview = previewText.trim().length > 80 && /<svg[\s>]/i.test(previewText);
      const hasScene = scene && typeof scene === 'object' && (
        Object.keys(scene).length > 0 ||
        Array.isArray(scene.devices) ||
        Array.isArray(scene.objects)
      );
      nonBlank = hasPreview || hasScene || sceneText.trim().length > 80;
      if (!nonBlank) blockers.push({ code: 'visual-bim-empty', message: '3D/BIM preview must include a scene or nonblank preview SVG.' });
      if (!hasPreview && !hasScene) warnings.push({ code: 'visual-bim-preview-conceptual', message: '3D/BIM evidence is a conceptual preview until formal BIM export is attached.' });
      if (expectedRefs.length) {
        const combined = `${previewText} ${sceneText}`;
        const missingRefs = expectedRefs.filter(ref => !combined.includes(ref));
        hasExpectedRefs = missingRefs.length === 0;
        if (missingRefs.length) {
          blockers.push({
            code: 'visual-trace-ref-missing',
            missingRefs,
            message: '3D/BIM preview is missing expected traceability device references.'
          });
        }
      } else {
        blockers.push({ code: 'visual-traceability-missing', message: '3D/BIM traceability nodes are required.' });
      }
    }

    if (!hasTraceability) {
      blockers.push({ code: 'visual-traceability-missing', message: 'Visual traceability manifest is required.' });
    }
    if (traceability?.handoffBoundary && traceability.handoffBoundary !== 'lifecycle_handoff_only') {
      blockers.push({ code: 'visual-iot-boundary-invalid', message: 'Visual evidence must preserve lifecycle_handoff_only boundary.' });
    }
    if (traceability?.realtimeControl === true) {
      blockers.push({ code: 'visual-realtime-control-not-allowed', message: 'Visual evidence must not claim realtime IoT control.' });
    }

    return {
      passed: blockers.length === 0,
      status: blockers.length === 0 ? 'passed' : 'blocked',
      type,
      visualKey: rule.key,
      checks: {
        nonBlank,
        hasPreview,
        hasTraceability,
        hasExpectedRefs,
        lifecycleHandoffOnly: (traceability?.handoffBoundary || 'lifecycle_handoff_only') === 'lifecycle_handoff_only',
        realtimeControl: false
      },
      expectedRefs,
      traceabilityId: traceability?.traceabilityId || null,
      blockers,
      warnings,
      evidenceGeneratedAt: this.now().toISOString()
    };
  }

  visualQualityEvidenceForArtifact(artifact = {}) {
    if (!artifact || !VISUAL_ARTIFACT_TYPES.has(artifact.type)) return null;
    const existing = artifact.metadata?.visualQualityEvidence || artifact.metadata?.qualityEvidence || null;
    if (existing) {
      return {
        ...existing,
        type: existing.type || artifact.type,
        visualKey: existing.visualKey || VISUAL_QUALITY_RULES[artifact.type]?.key,
        passed: existing.passed === true,
        status: existing.passed === true ? 'passed' : (existing.status || 'blocked'),
        blockers: Array.isArray(existing.blockers) ? existing.blockers : [],
        warnings: Array.isArray(existing.warnings) ? existing.warnings : []
      };
    }
    if (artifact.metadata?.visualTraceability || artifact.metadata?.traceability) {
      return {
        passed: false,
        status: 'blocked',
        type: artifact.type,
        visualKey: VISUAL_QUALITY_RULES[artifact.type]?.key,
        checks: {
          nonBlank: false,
          hasPreview: false,
          hasTraceability: true,
          hasExpectedRefs: false,
          lifecycleHandoffOnly: true,
          realtimeControl: false
        },
        expectedRefs: this.visualTraceRefs(
          artifact.metadata.visualTraceability || artifact.metadata.traceability,
          VISUAL_QUALITY_RULES[artifact.type]
        ),
        traceabilityId: (artifact.metadata.visualTraceability || artifact.metadata.traceability)?.traceabilityId || null,
        blockers: [{
          code: 'visual-quality-evidence-missing',
          message: 'Imported visual artifact must include visual quality evidence before handoff.'
        }],
        warnings: [],
        evidenceGeneratedAt: this.now().toISOString()
      };
    }
    return {
      passed: false,
      status: 'blocked',
      type: artifact.type,
      visualKey: VISUAL_QUALITY_RULES[artifact.type]?.key,
      checks: {
        nonBlank: false,
        hasPreview: false,
        hasTraceability: false,
        hasExpectedRefs: false,
        lifecycleHandoffOnly: true,
        realtimeControl: false
      },
      expectedRefs: [],
      traceabilityId: null,
      blockers: [{
        code: 'visual-quality-evidence-missing',
        message: 'Visual artifact quality evidence is required before handoff.'
      }],
      warnings: [],
      evidenceGeneratedAt: this.now().toISOString()
    };
  }

  normalizeStandards(standards = []) {
    const normalized = standards.length ? standards : [
      {
        code: 'GB 55015-2021',
        level: 'mandatory-general-code',
        edition: '2021',
        softwareCheck: 'not-applicable',
        note: 'Default energy-code reference until artifact-specific check runs.'
      },
      {
        code: 'GB 55020-2021',
        level: 'mandatory-general-code',
        edition: '2021',
        softwareCheck: 'not-applicable',
        note: 'Default water/hot-water lifecycle reference until artifact-specific check runs.'
      }
    ];

    return normalized.map(item => ({
      code: item.code,
      level: item.level || 'internal-policy',
      edition: String(item.edition || '').trim() || 'current',
      softwareCheck: item.softwareCheck || 'not-applicable',
      note: item.note
    }));
  }

  normalizeArtifact(scope, data = {}) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova artifact operations');
      err.status = 403;
      throw err;
    }
    if (!data.projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }
    if (!ARTIFACT_TYPES.has(data.type)) {
      const err = new Error(`unsupported Rysnova artifact type: ${data.type}`);
      err.status = 400;
      throw err;
    }
    const status = data.status || 'draft';
    if (!ARTIFACT_STATUSES.has(status)) {
      const err = new Error(`unsupported Rysnova artifact status: ${status}`);
      err.status = 400;
      throw err;
    }

    const version = Math.max(parseInt(data.version || 1, 10), 1);
    const source = data.source || MODULES.rysnovaBim.source;
    const moduleContext = rysnovaBimModuleContext(data);
    const objectKey = data.objectKey || [
      String(scope.tenantId),
      String(data.projectId),
      data.type,
      `v${version}`,
      `${data.type}.${this.artifactExtension(data)}`
    ].join('/');
    const tenantProjectScopedObjectKey = this.assertTenantProjectObjectKey(scope, data.projectId, objectKey);
    const permissions = {
      customerVisible: Boolean(data.permissions?.customerVisible),
      dealerVisible: data.permissions?.dealerVisible !== false,
      headquartersVisible: data.permissions?.headquartersVisible !== false
    };

    return {
      tenantId: scope.tenantId,
      dealerId: scope.dealerId || data.dealerId,
      storeId: scope.storeId || data.storeId,
      ...moduleContext,
      projectId: data.projectId,
      customerId: data.customerId,
      source,
      type: data.type,
      version,
      status,
      objectKey: tenantProjectScopedObjectKey,
      contentHash: data.contentHash || this.createHash(this.artifactContent(data)),
      inputsHash: data.inputsHash || this.createHash(data.inputs || { projectId: data.projectId, type: data.type, version }),
      standards: this.normalizeStandards(data.standards),
      permissions,
      metadata: {
        ...(data.metadata || {}),
        contentType: this.normalizeContentType(data)
      },
      createdBy: scope.userId
    };
  }

  normalizeVisualSource(data = {}) {
    if (data.result && (data.result.solutions || data.result.tiers)) return data.result;
    if (data.solutions || data.tiers) return data;
    const tier = this.normalizeTierKey(data.tier || data.tierKey || 'balanced');
    const project = data.project || data.input || {};
    const systems = data.systems || data.solution?.systems || [];
    if (systems.length || data.solution) {
      return {
        input: {
          ...project,
          area: project.area || data.area
        },
        recommendation: { recommendedTier: tier },
        solutions: this.threeTierSolutionsFromSystems(systems, data.solution)
      };
    }
    const err = new Error('result with solutions or tiers is required for Rysnova visual artifact generation');
    err.status = 400;
    throw err;
  }

  threeTierSolutionsFromSystems(systems = [], solution = {}) {
    return TIER_KEYS.reduce((acc, tier) => {
      acc[tier] = {
            id: tier,
            tier,
        name: tier === this.normalizeTierKey(solution.tier) && solution.name ? solution.name : this.tierName(tier),
            systems,
        estimatedTotal: solution.estimatedTotal
      };
      return acc;
    }, {});
  }

  buildTierComparison(projectId, data = {}) {
    const result = this.normalizeDeliverableSource(data);
    const normalized = this.visualPackageService.normalizeResult(result);
    const selectedTier = this.normalizeTierKey(
      data.tier ||
      data.tierKey ||
      normalized.recommendation?.recommendedTier ||
      normalized.recommendedTierId ||
      'balanced'
    );
    const project = this.normalizeProject(normalized, data);
    const selectedSolution = normalized.solutions?.[selectedTier] ||
      normalized.tiers?.[selectedTier] ||
      Object.values(normalized.solutions || normalized.tiers || {})[0] ||
      {};
    const tiers = TIER_KEYS.map(tier => {
      const sourceSolution = normalized.solutions?.[tier] || normalized.tiers?.[tier] || selectedSolution;
      const solution = {
        ...sourceSolution,
        id: tier,
        tier,
        name: this.tierName(tier),
        systems: sourceSolution.systems || selectedSolution.systems || []
      };
      const quantityTakeoff = this.buildQuantityTakeoff(project, solution, tier);
      const standardsCoverage = this.buildStandardsCoverageSnapshot(solution);
      const bomPackage = this.buildBomAndQuote(project, solution, tier, quantityTakeoff, data, standardsCoverage);
      const quote = bomPackage.quoteCostSummary.quotationSummary;
      const decisionEvidence = this.buildTierDecisionEvidence({
        project,
        tier,
        selectedTier,
        solution,
        quantityTakeoff,
        bomPackage,
        standardsCoverage
      });
      return {
        tier,
        tierName: this.tierName(tier),
        selected: tier === selectedTier,
        recommended: tier === selectedTier,
        projectId,
        currency: quote.currency,
        customerTotal: quote.customerTotal,
        monthlyPayment: quote.monthlyPayment,
        validDays: quote.validDays,
        itemCount: bomPackage.bomSummary.itemCount,
        systemCount: bomPackage.bomSummary.systemCount,
        systemFamilies: bomPackage.bomSummary.systemFamilies,
        quantityTakeoffSummary: quantityTakeoff.totals,
        marginGuard: {
          status: bomPackage.quoteCostSummary.marginGuard.status,
          minMarginRate: bomPackage.quoteCostSummary.marginGuard.minMarginRate,
          targetMarginRate: bomPackage.quoteCostSummary.marginGuard.targetMarginRate
        },
        standardsCoverageStatus: standardsCoverage.status,
        coveredCoverageDomains: standardsCoverage.coveredDomains || [],
        lifecycleHandoff: {
          handoffBoundary: bomPackage.quoteCostSummary.installedAssetHandoff.handoffBoundary,
          realtimeControl: false,
          assetCount: bomPackage.quoteCostSummary.installedAssetHandoff.assetCount
        },
        decisionEvidence,
        customerSafeExplanation: `${this.tierName(tier)}按同一项目和系统范围测算，输出工程量、BOM、报价、标准覆盖和生命周期交接摘要；正式签核七件套仅绑定当前选择档位。`
      };
    });

    return {
      projectId,
      selectedTier,
      recommendedTier: selectedTier,
      tierCount: tiers.length,
      tiers,
      boundary: {
        customerSafe: true,
        internalCostHiddenFromCustomer: true,
        lifecycleHandoffOnly: true,
        realtimeControl: false
      }
    };
  }

  tierDecisionProfile(tierKey) {
    const tier = this.normalizeTierKey(tierKey);
    return {
      essential: {
        positioning: '预算优先，覆盖核心舒适需求和必要工程交付',
        idealFor: ['预算敏感', '核心系统先交付', '后续可分阶段升级'],
        valueDrivers: ['控制初始投入', '保留标准化交付证据', '保留生命周期资产交接'],
        tradeoffs: ['舒适冗余较少', '高级联动和扩展点较少', '后续升级需要重新复核工程量'],
        upgradeTriggers: ['家庭成员增加', '增加全空气/新风/智能联动', '希望提高静音、冗余或能效']
      },
      balanced: {
        positioning: '舒适、预算和后期服务均衡，适合作为默认成交方案',
        idealFor: ['多数家庭一次性交付', '希望预算可控但不牺牲关键体验', '经销商标准化签约'],
        valueDrivers: ['系统覆盖更完整', '工程量和报价更稳定', '生命周期交接资产更完整'],
        tradeoffs: ['价格高于基础档', '部分高端冗余仍需尊享档覆盖'],
        upgradeTriggers: ['大宅/别墅', '更高控制精度', '更强设备冗余或高级场景联动']
      },
      premium: {
        positioning: '体验优先，强化系统冗余、控制精度和长期服务能力',
        idealFor: ['大宅或高净值家庭', '追求稳定舒适和长期服务', '需要更完整系统集成'],
        valueDrivers: ['更高舒适冗余', '更多控制点和资产交接', '更充分的标准覆盖证据'],
        tradeoffs: ['初始投入最高', '需要更严格的深化复核和施工组织'],
        upgradeTriggers: ['已经是最高档，后续以专项定制和IoT生命周期服务扩展为主']
      }
    }[tier];
  }

  buildTierDecisionEvidence({
    project,
    tier,
    selectedTier,
    solution,
    quantityTakeoff,
    bomPackage,
    standardsCoverage
  } = {}) {
    const normalizedTier = this.normalizeTierKey(tier);
    const profile = this.tierDecisionProfile(normalizedTier);
    const systems = this.deliverableSystems(solution);
    const quote = bomPackage.quoteCostSummary.quotationSummary;
    const quantity = quantityTakeoff.totals || {};
    const marginGuard = bomPackage.quoteCostSummary.marginGuard || {};
    const lifecycleHandoff = bomPackage.quoteCostSummary.installedAssetHandoff || {};
    const coverageImpact = this.standardsCoverageImpactSummary(standardsCoverage);
    const comfortScope = [...new Set(systems.map(system => system.family))];
    const selected = normalizedTier === this.normalizeTierKey(selectedTier);

    return {
      positioning: profile.positioning,
      idealFor: profile.idealFor,
      valueDrivers: profile.valueDrivers,
      tradeoffs: profile.tradeoffs,
      upgradeTriggers: profile.upgradeTriggers,
      selectionRationale: selected
        ? `${this.tierName(normalizedTier)}是当前推荐/签核档位，后续七件套和客户签收以此档为准。`
        : `${this.tierName(normalizedTier)}用于横向比选，不替代当前签核档位。`,
      engineeringDelta: {
        systemFamilies: comfortScope,
        systemCount: systems.length,
        itemCount: bomPackage.bomSummary.itemCount,
        pipeMeters: this.round(quantity.pipeMeters || 0, 1),
        ductSqm: this.round(quantity.ductSqm || 0, 1),
        valveCount: Number(quantity.valveCount || 0),
        controlPoints: Number(quantity.controlPoints || 0),
        estimatedLaborHours: this.round(quantity.estimatedLaborHours || 0, 1)
      },
      commercialDecision: {
        currency: quote.currency || 'CNY',
        customerTotal: quote.customerTotal,
        monthlyPayment: quote.monthlyPayment,
        validDays: quote.validDays,
        commercialApprovalStatus: marginGuard.status || 'pending',
        internalCostHiddenFromCustomer: true
      },
      standardsDecision: {
        coverageStatus: standardsCoverage.status || 'incomplete',
        coveredDomains: standardsCoverage.coveredDomains || [],
        missingRequiredDomains: standardsCoverage.missingRequiredDomains || [],
        quoteDrivers: coverageImpact.quoteDrivers || [],
        deliverableEvidence: coverageImpact.deliverableEvidence || []
      },
      lifecycleDecision: {
        handoffBoundary: lifecycleHandoff.handoffBoundary || 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: Number(lifecycleHandoff.assetCount || 0),
        requiredBeforeCustomerCare: lifecycleHandoff.requiredBeforeCustomerCare || []
      },
      riskControls: [
        marginGuard.status === 'pass'
          ? '报价已通过毛利底线保护'
          : '报价需完成毛利底线复核',
        standardsCoverage.status === 'complete'
          ? '标准覆盖完整'
          : '标准覆盖需补齐后签核',
        lifecycleHandoff.realtimeControl === false
          ? '仅交接生命周期资产，不开放实时控制'
          : '生命周期边界异常，禁止签核'
      ],
      customerSafe: true
    };
  }

  normalizeDeliverableSource(data = {}) {
    if (data.result && (data.result.solutions || data.result.tiers)) return data.result;
    if (data.solutions || data.tiers) return data;
    const tier = this.normalizeTierKey(data.tier || data.tierKey || 'balanced');
    const project = data.project || data.input || {};
    const systems = data.systems || data.solution?.systems || [];
    if (systems.length || data.solution) {
      return {
        input: {
          ...project,
          area: project.area || data.area
        },
        recommendation: { recommendedTier: tier },
        solutions: this.threeTierSolutionsFromSystems(systems, data.solution)
      };
    }
    const err = new Error('result with solutions, tiers, solution, or systems is required for Rysnova deliverable artifact generation');
    err.status = 400;
    throw err;
  }

  normalizeTierKey(tierKey) {
    const raw = String(tierKey || 'balanced').toLowerCase();
    if (raw === 'basic') return 'essential';
    if (raw === 'comfort') return 'balanced';
    if (['essential', 'balanced', 'premium'].includes(raw)) return raw;
    return 'balanced';
  }

  tierName(tierKey) {
    return {
      essential: '基础方案',
      balanced: '均衡方案',
      premium: '尊享方案'
    }[this.normalizeTierKey(tierKey)] || '均衡方案';
  }

  tierMultiplier(tierKey) {
    return {
      essential: 0.86,
      balanced: 1,
      premium: 1.22
    }[this.normalizeTierKey(tierKey)] || 1;
  }

  round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  roundMoney(value) {
    return Math.round(Number(value || 0));
  }

  normalizeProject(result = {}, data = {}) {
    const input = result.input || {};
    const project = data.project || {};
    return {
      projectId: data.projectId,
      name: project.name || input.projectName || input.name || `Rysnova ${input.area || project.area || 120}㎡深化项目`,
      city: project.city || input.city || '未指定城市',
      address: project.address || input.address,
      area: Number(project.area || input.area || data.area || 120),
      houseType: project.houseType || input.houseType || '住宅',
      familyMembers: project.familyMembers || input.familyMembers
    };
  }

  normalizeSystemFamily(system = {}) {
    const raw = String(
      system.type ||
      system.sourceSystemId ||
      system.systemFamily ||
      system.category ||
      system.id ||
      system.system ||
      ''
    ).toLowerCase();
    const name = String(system.name || system.label || system.system || '').toLowerCase();
    if (['water', 'hot_water', 'hotwater', 'dhw'].includes(raw) || name.includes('热水')) return 'water';
    if (['heating', 'heat', 'boiler'].includes(raw) || name.includes('采暖') || name.includes('地暖')) return 'heating';
    if (['purification', 'water_treatment', 'purifier'].includes(raw) || name.includes('净水')) return 'purification';
    if (['fresh_air', 'ventilation', 'doas', 'erv'].includes(raw) || name.includes('新风')) return 'fresh_air';
    if (['ac', 'air', 'hvac', 'cooling'].includes(raw) || name.includes('空调') || name.includes('全空气')) return 'ac';
    if (['control', 'smart_control', 'iot'].includes(raw) || name.includes('智能') || name.includes('控制')) return 'control';
    return 'other';
  }

  normalizeDeliverableContext(data = {}) {
    const result = this.normalizeDeliverableSource(data);
    const normalized = this.visualPackageService.normalizeResult(result);
    const tier = this.normalizeTierKey(
      data.tier ||
      data.tierKey ||
      normalized.recommendation?.recommendedTier ||
      normalized.recommendedTierId ||
      'balanced'
    );
    const solution = normalized.solutions?.[tier] ||
      normalized.tiers?.[tier] ||
      Object.values(normalized.solutions || normalized.tiers || {})[0];
    if (!solution) {
      const err = new Error('Rysnova deliverable solution could not be resolved for requested tier');
      err.status = 422;
      throw err;
    }
    return {
      result: normalized,
      tier,
      solution,
      project: this.normalizeProject(normalized, data)
    };
  }

  deliverableSystems(solution = {}) {
    const systems = Array.isArray(solution.systems) ? solution.systems : [];
    const normalized = systems.map((system, index) => {
      const family = this.normalizeSystemFamily(system);
      const defaults = SYSTEM_FAMILY_DEFAULTS[family] || SYSTEM_FAMILY_DEFAULTS.other;
      return {
        ...defaults,
        ...system,
        family,
        category: system.category || defaults.category,
        brand: system.brand || defaults.brand,
        name: system.name || system.label || defaults.equipmentName,
        model: system.model || defaults.model,
        sourceIndex: index
      };
    });
    return normalized.length ? normalized : [{
      ...SYSTEM_FAMILY_DEFAULTS.water,
      family: 'water',
      name: SYSTEM_FAMILY_DEFAULTS.water.equipmentName,
      sourceIndex: 0
    }];
  }

  systemPackIdsForSystems(systems = []) {
    const ids = new Set();
    for (const system of systems) {
      if (['water', 'purification'].includes(system.family)) ids.add('rheem-central-hot-water');
      if (system.family === 'heating') ids.add('rheem-heating');
      if (['fresh_air', 'ac'].includes(system.family)) ids.add('rheem-whole-air');
      if (system.family === 'control') ids.add('rheem-smart-control');
    }
    if (!ids.size) ids.add('rheem-central-hot-water');
    ids.add('rheem-smart-control');
    return [...ids];
  }

  buildStandardsCoverageSnapshot(solution = {}) {
    const systems = this.deliverableSystems(solution);
    const composition = this.systemPacksService.compose({
      selectedPackIds: this.systemPackIdsForSystems(systems)
    });
    const coverage = composition.standardsEvidence?.coverage || {
      status: 'incomplete',
      requiredDomains: REQUIRED_STANDARDS_COVERAGE_DOMAINS,
      coveredDomains: [],
      missingRequiredDomains: REQUIRED_STANDARDS_COVERAGE_DOMAINS,
      domains: []
    };

    return {
      status: coverage.status,
      requiredDomains: coverage.requiredDomains,
      coveredDomains: coverage.coveredDomains,
      missingRequiredDomains: coverage.missingRequiredDomains,
      domains: coverage.domains,
      packIds: composition.packs.map(pack => pack.id),
      quoteImpact: [...new Set((coverage.domains || []).flatMap(domain => domain.quoteImpact || []))],
      deliverableEvidence: [...new Set((coverage.domains || []).flatMap(domain => domain.deliverableEvidence || []))],
      lifecycleHandoffImpact: [...new Set((coverage.domains || []).flatMap(domain => domain.lifecycleHandoffImpact || []))]
    };
  }

  standardsCoverageImpactSummary(standardsCoverage = {}) {
    const domains = Array.isArray(standardsCoverage.domains) ? standardsCoverage.domains : [];
    return {
      status: standardsCoverage.status || 'incomplete',
      coveredDomains: standardsCoverage.coveredDomains || [],
      missingRequiredDomains: standardsCoverage.missingRequiredDomains || [],
      quoteDrivers: standardsCoverage.quoteImpact || [],
      deliverableEvidence: standardsCoverage.deliverableEvidence || [],
      lifecycleHandoffImpact: standardsCoverage.lifecycleHandoffImpact || [],
      domainCount: domains.length,
      domainSummaries: domains.map(domain => ({
        domain: domain.domain,
        label: domain.label,
        covered: domain.covered === true,
        quoteImpact: domain.quoteImpact || [],
        deliverableEvidence: domain.deliverableEvidence || [],
        lifecycleHandoffImpact: domain.lifecycleHandoffImpact || []
      }))
    };
  }

  standardsDomainsForSystem(system = {}, standardsCoverage = {}) {
    const domains = Array.isArray(standardsCoverage.domains) ? standardsCoverage.domains : [];
    const family = system.family || this.normalizeSystemFamily(system);
    const category = system.category || '';
    const familyMatchers = {
      water: ['hot-water', 'water', 'potable', 'domestic'],
      purification: ['potable', 'water'],
      heating: ['thermal', 'heating', 'energy'],
      fresh_air: ['ventilation', 'iaq', 'thermal', 'energy'],
      ac: ['thermal', 'ventilation', 'iaq', 'energy'],
      control: ['smart', 'interoperability']
    };
    const matchers = familyMatchers[family] || [family, category].filter(Boolean);
    const matched = domains.filter(domain => {
      const haystack = [
        domain.domain,
        domain.label,
        ...(domain.requiredFor || []),
        ...(domain.quoteImpact || []),
        ...(domain.deliverableEvidence || [])
      ].join(' ').toLowerCase();
      return matchers.some(matcher => haystack.includes(String(matcher).toLowerCase()));
    });
    return matched.length ? matched : domains.filter(domain => domain.domain === 'smart-interoperability');
  }

  standardsCoverageTraceForItem(system = {}, itemCategory = '', standardsCoverage = {}) {
    const domains = this.standardsDomainsForSystem(system, standardsCoverage);
    const quoteDrivers = [...new Set(domains.flatMap(domain => domain.quoteImpact || []))];
    const deliverableEvidence = [...new Set(domains.flatMap(domain => domain.deliverableEvidence || []))];
    const lifecycleHandoffImpact = [...new Set(domains.flatMap(domain => domain.lifecycleHandoffImpact || []))];
    const categoryDriverHints = {
      'installation-material': ['保温管材', '风管材料', '水力平衡附件'],
      'control-and-valves': ['循环泵', '温控器', '网关/控制器', '传感器点位'],
      labor: ['施工交付清单', '售后运维规则']
    };
    const hints = categoryDriverHints[itemCategory] || [];
    const matchedQuoteDrivers = quoteDrivers.filter(driver => (
      hints.length === 0 || hints.some(hint => String(driver).includes(hint) || String(hint).includes(driver))
    ));
    return {
      status: standardsCoverage.status || 'incomplete',
      domains: domains.map(domain => domain.domain).filter(Boolean),
      quoteDrivers: matchedQuoteDrivers.length ? matchedQuoteDrivers : quoteDrivers,
      deliverableEvidence,
      lifecycleHandoffImpact,
      explanation: `${system.name || system.family || '系统'} ${itemCategory || '报价项'} 由 ${domains.map(domain => domain.label || domain.domain).join('、')} 覆盖，影响报价、交付证据和生命周期交接。`
    };
  }

  buildSystemQuoteExplanations(systems = [], standardsCoverage = {}, items = []) {
    return systems.map(system => {
      const domains = this.standardsDomainsForSystem(system, standardsCoverage);
      const relatedItems = items.filter(item => item.systemFamily === system.family);
      return {
        systemFamily: system.family,
        systemName: system.name,
        brand: system.brand,
        model: system.model,
        standardsDomains: domains.map(domain => domain.domain).filter(Boolean),
        quoteDrivers: [...new Set(domains.flatMap(domain => domain.quoteImpact || []))],
        deliverableEvidence: [...new Set(domains.flatMap(domain => domain.deliverableEvidence || []))],
        lifecycleHandoffImpact: [...new Set(domains.flatMap(domain => domain.lifecycleHandoffImpact || []))],
        itemIds: relatedItems.map(item => item.itemId),
        itemCount: relatedItems.length,
        customerSafeExplanation: `${system.name} 的报价由设备、管路/附件、控制点和安装调试组成，并由对应标准域生成交付证据。`
      };
    });
  }

  buildQuantityTakeoff(project, solution, tier) {
    const area = Math.max(Number(project.area || 120), 1);
    const systems = this.deliverableSystems(solution);
    const tierMultiplier = this.tierMultiplier(tier);
    const systemQuantities = systems.map(system => {
      const pipeMeters = this.round(area * Number(system.pipePerArea || 0.2) * tierMultiplier, 1);
      const valves = Math.max(1, Math.ceil(Number(system.valveBase || 4) * tierMultiplier));
      const laborHours = this.round(area * Number(system.laborPerArea || 50) / 100 * tierMultiplier, 1);
      const ductSqm = ['fresh_air', 'ac'].includes(system.family)
        ? this.round(area * (system.family === 'fresh_air' ? 0.22 : 0.3) * tierMultiplier, 1)
        : 0;
      return {
        systemFamily: system.family,
        category: system.category,
        systemName: system.name,
        equipmentCount: 1,
        pipeMeters,
        ductSqm,
        valveCount: valves,
        insulationMeters: this.round(pipeMeters * 0.92, 1),
        controlPoints: system.family === 'control' ? Math.max(4, Math.ceil(area / 35)) : Math.max(1, Math.ceil(area / 80)),
        estimatedLaborHours: laborHours
      };
    });
    const totals = systemQuantities.reduce((acc, item) => ({
      equipmentCount: acc.equipmentCount + item.equipmentCount,
      pipeMeters: this.round(acc.pipeMeters + item.pipeMeters, 1),
      ductSqm: this.round(acc.ductSqm + item.ductSqm, 1),
      valveCount: acc.valveCount + item.valveCount,
      insulationMeters: this.round(acc.insulationMeters + item.insulationMeters, 1),
      controlPoints: acc.controlPoints + item.controlPoints,
      estimatedLaborHours: this.round(acc.estimatedLaborHours + item.estimatedLaborHours, 1)
    }), {
      equipmentCount: 0,
      pipeMeters: 0,
      ductSqm: 0,
      valveCount: 0,
      insulationMeters: 0,
      controlPoints: 0,
      estimatedLaborHours: 0
    });
    return {
      project: {
        name: project.name,
        city: project.city,
        area
      },
      tier,
      systemQuantities,
      totals,
      assumptions: [
        'Quantity takeoff is generated from Rysnova system-family rules and project area.',
        'Formal CAD/BIM quantity extraction can supersede this artifact with a later version.'
      ]
    };
  }

  buildBomAndQuote(project, solution, tier, quantityTakeoff, data = {}, standardsCoverage = null) {
    const systems = this.deliverableSystems(solution);
    const pricing = data.pricing || data.options || {};
    const tierMultiplier = this.tierMultiplier(tier);
    const areaFactor = Math.min(Math.max(Number(project.area || 120) / 120, 0.78), 1.8);
    const targetMarginRate = Number(pricing.targetMarginRate ?? 0.25);
    const minMarginRate = Number(pricing.minMarginRate ?? 0.16);
    const taxRate = Number(pricing.taxRate ?? 0.09);
    const financingMonths = Number(pricing.financingMonths || 36);
    const coverage = standardsCoverage || this.buildStandardsCoverageSnapshot(solution);
    const items = [];

    systems.forEach((system, index) => {
      const q = quantityTakeoff.systemQuantities.find(item => item.systemFamily === system.family) || {};
      const equipmentCost = this.roundMoney(Number(system.price || system.baseEquipmentCost || 16000) * areaFactor * tierMultiplier);
      const equipmentSell = this.roundMoney(equipmentCost * 1.22);
      items.push({
        itemId: `${system.family}-equipment-${index + 1}`,
        name: system.name,
        model: system.model,
        brand: system.brand,
        category: system.category,
        systemFamily: system.family,
        unit: '套',
        quantity: 1,
        unitCost: equipmentCost,
        unitPrice: equipmentSell,
        cost: equipmentCost,
        total: equipmentSell,
        source: 'rysnova-bim-generated-bom',
        standardsCoverageTrace: this.standardsCoverageTraceForItem(system, system.category, coverage)
      });

      const pipeUnitCost = system.family === 'fresh_air' || system.family === 'ac' ? 95 : 42;
      const pipeUnitPrice = system.family === 'fresh_air' || system.family === 'ac' ? 145 : 78;
      items.push({
        itemId: `${system.family}-pipe-${index + 1}`,
        name: system.family === 'fresh_air' || system.family === 'ac' ? `${system.name} 风管/冷媒管及附件` : `${system.name} 管路及辅材`,
        category: 'installation-material',
        systemFamily: system.family,
        unit: 'm',
        quantity: this.round(q.pipeMeters || 0, 1),
        unitCost: pipeUnitCost,
        unitPrice: pipeUnitPrice,
        cost: this.roundMoney((q.pipeMeters || 0) * pipeUnitCost),
        total: this.roundMoney((q.pipeMeters || 0) * pipeUnitPrice),
        source: 'rysnova-bim-generated-quantity-takeoff',
        standardsCoverageTrace: this.standardsCoverageTraceForItem(system, 'installation-material', coverage)
      });

      const valveCost = 180;
      const valvePrice = 320;
      items.push({
        itemId: `${system.family}-valve-control-${index + 1}`,
        name: `${system.name} 阀件 / 控制点`,
        category: 'control-and-valves',
        systemFamily: system.family,
        unit: '点',
        quantity: Number(q.valveCount || q.controlPoints || 1),
        unitCost: valveCost,
        unitPrice: valvePrice,
        cost: this.roundMoney(Number(q.valveCount || q.controlPoints || 1) * valveCost),
        total: this.roundMoney(Number(q.valveCount || q.controlPoints || 1) * valvePrice),
        source: 'rysnova-bim-generated-quantity-takeoff',
        standardsCoverageTrace: this.standardsCoverageTraceForItem(system, 'control-and-valves', coverage)
      });

      const laborCost = this.roundMoney((q.estimatedLaborHours || 1) * 95);
      const laborSell = this.roundMoney((q.estimatedLaborHours || 1) * 150);
      items.push({
        itemId: `${system.family}-labor-${index + 1}`,
        name: `${system.name} 安装调试`,
        category: 'labor',
        systemFamily: system.family,
        unit: '工时',
        quantity: this.round(q.estimatedLaborHours || 1, 1),
        unitCost: 95,
        unitPrice: 150,
        cost: laborCost,
        total: laborSell,
        source: 'rysnova-bim-generated-labor-model',
        standardsCoverageTrace: this.standardsCoverageTraceForItem(system, 'labor', coverage)
      });
    });

    const materialSubtotal = this.roundMoney(items.filter(item => item.category !== 'labor').reduce((sum, item) => sum + item.total, 0));
    const laborSubtotal = this.roundMoney(items.filter(item => item.category === 'labor').reduce((sum, item) => sum + item.total, 0));
    const directCost = this.roundMoney(items.reduce((sum, item) => sum + item.cost, 0));
    const managementFee = this.roundMoney((materialSubtotal + laborSubtotal) * 0.05);
    const riskReserve = this.roundMoney((materialSubtotal + laborSubtotal) * 0.035);
    const quoteFloor = this.roundMoney(directCost / Math.max(1 - minMarginRate, 0.01));
    const targetBeforeTax = this.roundMoney(Math.max(
      quoteFloor,
      (materialSubtotal + laborSubtotal + managementFee + riskReserve) / Math.max(1 - targetMarginRate, 0.01)
    ));
    const taxAmount = this.roundMoney(targetBeforeTax * taxRate);
    const customerTotal = this.roundMoney(targetBeforeTax + taxAmount);
    const dealerMargin = this.roundMoney(targetBeforeTax - directCost);
    const monthlyPayment = financingMonths > 0 ? this.roundMoney(customerTotal / financingMonths) : 0;
    const marginGuard = {
      status: targetBeforeTax >= quoteFloor ? 'pass' : 'floor_adjusted',
      minMarginRate,
      targetMarginRate,
      quoteFloor,
      adjustment: Math.max(0, this.roundMoney(quoteFloor - targetBeforeTax))
    };
    const costBreakdown = {
      materialSubtotal,
      laborSubtotal,
      managementFee,
      riskReserve,
      directCost,
      targetBeforeTax,
      taxAmount,
      customerTotal,
      dealerMargin,
      monthlyPayment
    };
    const quotationSummary = {
      quotationNo: data.quotationNo || `LITH-${String(project.name || project.projectId || 'PROJECT').replace(/\W/g, '').slice(0, 8).toUpperCase()}-${this.now().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)}`,
      status: 'draft-ready',
      tier,
      currency: 'CNY',
      customerTotal,
      monthlyPayment,
      validDays: 30
    };
    const coverageImpact = this.standardsCoverageImpactSummary(coverage);
    const systemQuoteExplanations = this.buildSystemQuoteExplanations(systems, coverage, items);
    const installedAssetHandoff = this.buildInstalledAssetHandoff(project, solution, tier, quantityTakeoff, items, coverageImpact);
    const bomSummary = {
      itemCount: items.length,
      systemCount: systems.length,
      totalCost: directCost,
      totalPrice: customerTotal,
      currency: 'CNY',
      systemFamilies: [...new Set(systems.map(system => system.family))],
      installedAssetCount: installedAssetHandoff.assetCount,
      costBreakdown,
      marginGuard
    };

    return {
      items,
      bomSummary,
      quoteCostSummary: {
        quotationSummary,
        costBreakdown,
        marginGuard,
        installedAssetHandoff,
        standardsCoverageImpact: coverageImpact,
        systemQuoteExplanations,
        taxProfile: {
          mode: 'residential-or-light-commercial',
          taxRate,
          taxAmount
        }
      }
    };
  }

  buildInstalledAssetHandoff(project, solution, tier, quantityTakeoff, items = [], standardsCoverageImpact = null) {
    const systems = this.deliverableSystems(solution);
    const systemQuantities = quantityTakeoff.systemQuantities || [];
    const equipmentItems = items.filter(item => String(item.category || '').includes('hot_water') ||
      String(item.itemId || '').includes('-equipment-') ||
      item.unit === '套');
    const familyCount = {};
    const assets = systems.map((system, index) => {
      const count = familyCount[system.family] || 0;
      familyCount[system.family] = count + 1;
      const quantity = systemQuantities.find(item => item.systemFamily === system.family) || {};
      const equipment = equipmentItems.find(item => item.systemFamily === system.family) || {};
      const servicePlan = ['water', 'heating', 'fresh_air', 'ac'].includes(system.family)
        ? 'annual-maintenance-and-filter-or-safety-check'
        : 'annual-configuration-and-connectivity-check';
      return {
        assetId: [
          String(project.projectId || project.name || 'project').replace(/[^\w-]/g, '').slice(0, 24) || 'project',
          system.family,
          String(count + 1).padStart(2, '0')
        ].join('-'),
        systemFamily: system.family,
        category: system.category,
        systemName: system.name,
        brand: system.brand,
        model: system.model,
        sourceItemId: equipment.itemId || null,
        quantity: Number(equipment.quantity || 1),
        estimatedInstallScope: {
          equipmentCount: Number(quantity.equipmentCount || 1),
          pipeMeters: this.round(quantity.pipeMeters || 0, 1),
          ductSqm: this.round(quantity.ductSqm || 0, 1),
          valveCount: Number(quantity.valveCount || 0),
          controlPoints: Number(quantity.controlPoints || 0)
        },
        lifecycleState: 'pending-installation',
        warrantyRegistration: 'required-after-installation',
        servicePlan,
        iotBinding: {
          status: 'handoff-ready-not-bound',
          requiredIdentifier: 'installed_asset_id_or_device_serial',
          realtimeControl: false
        }
      };
    });

    return {
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      targetPlatform: 'external-iot-lifecycle-platform',
      project: {
        name: project.name,
        city: project.city,
        area: project.area,
        houseType: project.houseType
      },
      tier,
      assetCount: assets.length,
      assets,
      standardsCoverageImpact: standardsCoverageImpact || null,
      requiredBeforeCustomerCare: [
        'contract-signed',
        'installation-completed',
        'asset-serial-collected',
        'homeowner-care-plan-created'
      ]
    };
  }

  buildStandardsCheck(project, solution, quantityTakeoff, bomPackage, providedStandardsCoverage = null) {
    const systems = this.deliverableSystems(solution);
    const standardsCoverage = providedStandardsCoverage || this.buildStandardsCoverageSnapshot(solution);
    const standardCodes = new Set(['GB 55015-2021', 'GB 55020-2021']);
    for (const system of systems) {
      for (const code of system.standards || []) standardCodes.add(code);
    }
    const checks = [...standardCodes].map(code => ({
      code,
      level: code.startsWith('GB 55') ? 'mandatory-general-code' : 'domain-design-standard',
      edition: (String(code).match(/\d{4}/g) || ['current']).slice(-1)[0],
      softwareCheck: 'passed',
      note: `${code} scoped check passed for Rysnova generated ${this.tierName(solution.tier)} package.`
    }));
    const advisoryWarnings = [];
    if (Number(project.area || 0) <= 0) {
      checks.push({
        code: 'PROJECT-AREA',
        level: 'internal-policy',
        edition: 'current',
        softwareCheck: 'failed',
        note: 'Project area must be greater than zero.'
      });
    }
    if (quantityTakeoff.totals.pipeMeters > Number(project.area || 120) * 4) {
      advisoryWarnings.push({
        code: 'PIPE-DENSITY',
        level: 'internal-policy',
        edition: 'current',
        softwareCheck: 'warning',
        note: 'Pipe density is high; require designer review before construction release.'
      });
    }
    const standards = [...checks, ...advisoryWarnings];
    const counts = STANDARD_CHECK_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
    for (const item of standards) counts[item.softwareCheck] += 1;
    return {
      standards,
      standardsSummary: {
        counts,
        blockingFailures: standards.filter(item => item.softwareCheck === 'failed'),
        passed: standards.every(item => item.softwareCheck !== 'failed') &&
          standardsCoverage.status === 'complete',
        coverageStatus: standardsCoverage.status,
        requiredCoverageDomains: standardsCoverage.requiredDomains,
        coveredCoverageDomains: standardsCoverage.coveredDomains,
        missingCoverageDomains: standardsCoverage.missingRequiredDomains
      },
      standardsCoverage,
      checkItems: standards.map(item => ({
        ...item,
        evidence: {
          projectArea: project.area,
          systemFamilies: systems.map(system => system.family),
          directCost: bomPackage.bomSummary.totalCost,
          standardsCoverageStatus: standardsCoverage.status
        }
      })),
      boundary: {
        iot: 'lifecycle_handoff_only',
        realtimeControl: false
      }
    };
  }

  buildCustomerReport(project, solution, tier, quantityTakeoff, bomPackage, standardsCheck) {
    const quotation = bomPackage.quoteCostSummary.quotationSummary;
    return {
      type: 'rysnova-bim-customer-engineering-report',
      title: `${project.name} · Rysnova 深化交付报告`,
      project,
      tier,
      tierName: this.tierName(tier),
      systems: this.deliverableSystems(solution).map(system => ({
        family: system.family,
        name: system.name,
        brand: system.brand,
        model: system.model
      })),
      quantityTakeoffSummary: quantityTakeoff.totals,
      quotationSummary: {
        quotationNo: quotation.quotationNo,
        status: quotation.status,
        tier: quotation.tier,
        currency: quotation.currency,
        customerTotal: quotation.customerTotal,
        monthlyPayment: quotation.monthlyPayment,
        validDays: quotation.validDays
      },
      systemQuoteExplanations: (bomPackage.quoteCostSummary.systemQuoteExplanations || []).map(item => ({
        systemFamily: item.systemFamily,
        systemName: item.systemName,
        brand: item.brand,
        model: item.model,
        standardsDomains: item.standardsDomains,
        quoteDrivers: item.quoteDrivers,
        deliverableEvidence: item.deliverableEvidence,
        lifecycleHandoffImpact: item.lifecycleHandoffImpact,
        customerSafeExplanation: item.customerSafeExplanation
      })),
      standardsSummary: standardsCheck.standardsSummary,
      standardsCoverage: standardsCheck.standardsCoverage,
      standardsCoverageImpact: this.standardsCoverageImpactSummary(standardsCheck.standardsCoverage),
      customerVisibleSections: [
        '系统配置',
        '工程量摘要',
        '报价摘要',
        '标准校核结论',
        '交付边界'
      ],
      iotBoundary: 'lifecycle_handoff_only',
      internalFieldsExcluded: [
        'directCost',
        'dealerMargin',
        'costBreakdown',
        'marginGuard',
        'targetBeforeTax',
        'quoteFloor'
      ],
      estimationBoundary: {
        quantityTakeoff: 'software-estimated; CAD/BIM quantity extraction or designer review can supersede before construction release',
        pricing: 'customer-facing quotation summary only; dealer cost and margin controls stay in internal BOM/quote artifacts',
        standards: 'software pre-check; licensed designer review remains required for construction issue',
        iot: 'lifecycle_handoff_only; no realtime control commands'
      },
      generatedAt: this.now().toISOString()
    };
  }

  buildDeliverablePackage(projectId, data = {}) {
    const { result, tier, solution, project } = this.normalizeDeliverableContext({ ...data, projectId });
    const quantityTakeoff = this.buildQuantityTakeoff(project, solution, tier);
    const standardsCoverage = this.buildStandardsCoverageSnapshot(solution);
    const bomPackage = this.buildBomAndQuote(project, solution, tier, quantityTakeoff, data, standardsCoverage);
    const standardsCheck = this.buildStandardsCheck(project, solution, quantityTakeoff, bomPackage, standardsCoverage);
    const customerReport = this.buildCustomerReport(project, solution, tier, quantityTakeoff, bomPackage, standardsCheck);
    return {
      projectId,
      tier,
      result,
      solution,
      project,
      quantityTakeoff,
      bomPackage,
      standardsCheck,
      customerReport
    };
  }

  async nextArtifactVersion(scope, projectId, type) {
    const result = await this.listArtifacts(scope, { projectId, type, limit: 100 });
    const versions = (result.items || [])
      .filter(item => item.type === type)
      .map(item => Number(item.version || 0))
      .filter(Number.isFinite);
    return versions.length ? Math.max(...versions) + 1 : 1;
  }

  artifactInputsForDeliverables(scope, projectId, data = {}, deliverablePackage) {
    const base = {
      projectId,
      customerId: data.customerId,
      source: 'rysnova-bim',
      status: data.status || 'reviewing',
      permissions: {
        customerVisible: Boolean(data.customerVisible),
        dealerVisible: true,
        headquartersVisible: true
      },
      inputs: {
        tier: deliverablePackage.tier,
        project: deliverablePackage.project,
        sourceHash: this.createHash({
          result: data.result || data.solutions || data.tiers || data.solution || data.systems,
          projectId,
          tier: deliverablePackage.tier
        })
      }
    };

    const bomContent = {
      project: deliverablePackage.project,
      tier: deliverablePackage.tier,
      items: deliverablePackage.bomPackage.items,
      summary: deliverablePackage.bomPackage.bomSummary,
      quoteCostSummary: deliverablePackage.bomPackage.quoteCostSummary
    };
    const quantityContent = deliverablePackage.quantityTakeoff;
    const standardsContent = {
      project: deliverablePackage.project,
      tier: deliverablePackage.tier,
      standards: deliverablePackage.standardsCheck.standards,
      checkItems: deliverablePackage.standardsCheck.checkItems,
      standardsSummary: deliverablePackage.standardsCheck.standardsSummary,
      standardsCoverage: deliverablePackage.standardsCheck.standardsCoverage,
      boundary: deliverablePackage.standardsCheck.boundary
    };
    const reportContent = deliverablePackage.customerReport;

    return [
      {
        ...base,
        type: 'bom',
        extension: 'json',
        contentType: 'application/json',
        content: bomContent,
        standards: deliverablePackage.standardsCheck.standards,
        metadata: {
          generatedBy: 'rysnova-bim-deliverable-artifact-generator',
          label: 'BOM / 报价成本包',
          tier: deliverablePackage.tier,
          bomSummary: deliverablePackage.bomPackage.bomSummary,
          quoteCostSummary: deliverablePackage.bomPackage.quoteCostSummary
        }
      },
      {
        ...base,
        type: 'quantity-takeoff',
        extension: 'json',
        contentType: 'application/json',
        content: quantityContent,
        standards: deliverablePackage.standardsCheck.standards,
        metadata: {
          generatedBy: 'rysnova-bim-deliverable-artifact-generator',
          label: '工程量清单',
          tier: deliverablePackage.tier,
          quantityTakeoffSummary: deliverablePackage.quantityTakeoff.totals
        }
      },
      {
        ...base,
        type: 'standards-check',
        extension: 'json',
        contentType: 'application/json',
        content: standardsContent,
        standards: deliverablePackage.standardsCheck.standards,
        metadata: {
          generatedBy: 'rysnova-bim-deliverable-artifact-generator',
          label: '标准校核报告',
          tier: deliverablePackage.tier,
          standardsSummary: deliverablePackage.standardsCheck.standardsSummary,
          standardsCoverage: deliverablePackage.standardsCheck.standardsCoverage
        }
      },
      {
        ...base,
        type: 'customer-report',
        extension: 'json',
        contentType: 'application/vnd.rhautt.rysnova-bim.customer-report+json',
        content: reportContent,
        standards: deliverablePackage.standardsCheck.standards,
        metadata: {
          generatedBy: 'rysnova-bim-deliverable-artifact-generator',
          label: '客户深化报告',
          tier: deliverablePackage.tier,
          customerFacingReport: true,
          quotationSummary: deliverablePackage.bomPackage.quoteCostSummary.quotationSummary,
          quoteCostSummary: deliverablePackage.bomPackage.quoteCostSummary,
          standardsSummary: deliverablePackage.standardsCheck.standardsSummary,
          standardsCoverage: deliverablePackage.standardsCheck.standardsCoverage
        }
      }
    ];
  }

  artifactInputForVisual(scope, projectId, data = {}, visualPackage, visualKey) {
    const tier = data.tier || data.tierKey || visualPackage.tier || 'balanced';
    const base = {
      projectId,
      customerId: data.customerId,
      source: 'rysnova-bim',
      version: data.version,
      status: data.status || 'reviewing',
      permissions: {
        customerVisible: Boolean(data.customerVisible),
        dealerVisible: true,
        headquartersVisible: true
      },
      standards: data.standards,
      inputs: {
        tier,
        visualKey,
        sourceHash: this.createHash({
          result: data.result || data.solutions || data.tiers,
          tier,
          projectId
        })
      },
      metadata: {
        tier,
        visualKey,
        generatedBy: 'rysnova-bim-visual-artifact-generator',
        quality: 'conceptual-preview',
        customerFacingVisual: true
      }
    };

    if (visualKey === 'principleDiagram') {
      const visual = visualPackage.visuals?.principleDiagram || {};
      const content = visual.inlineSvg || visual;
      const visualMetadata = {
        ...base.metadata,
        label: visual.label || '设计原理图',
        drawingSetId: visual.drawingSetId || null,
        visualTraceability: visual.traceability || null
      };
      return {
        ...base,
        type: 'principle-diagram',
        extension: 'svg',
        contentType: 'image/svg+xml',
        content,
        metadata: {
          ...visualMetadata,
          visualQualityEvidence: this.visualQualityEvidenceForContent('principle-diagram', content, visualMetadata)
        }
      };
    }

    if (visualKey === 'layout2d') {
      const visual = visualPackage.visuals?.layout2d || {};
      const content = visual.inlineSvg || visual;
      const visualMetadata = {
        ...base.metadata,
        label: visual.label || '2D布局图',
        drawingSetId: visual.drawingSetId || null,
        drawingType: 'layout-2d',
        visualTraceability: visual.traceability || null
      };
      return {
        ...base,
        type: 'construction-drawing',
        extension: 'svg',
        contentType: 'image/svg+xml',
        content,
        metadata: {
          ...visualMetadata,
          visualQualityEvidence: this.visualQualityEvidenceForContent('construction-drawing', content, visualMetadata)
        }
      };
    }

    const visual = visualPackage.visuals?.scene3d || {};
    const content = {
      scene: visual.scene || null,
      previewSvg: visual.previewSvg || visual.inlineSvg || null,
      thumbnail: visual.thumbnail || null,
      primaryView: visual.primaryView || null,
      quality: visual.quality || 'conceptual-preview',
      traceability: visual.traceability || null
    };
    const visualMetadata = {
      ...base.metadata,
      label: visual.label || '3D示意图',
      scene3dId: visual.id || null,
      quality: visual.quality || 'conceptual-preview',
      visualTraceability: visual.traceability || null
    };
    return {
      ...base,
      type: 'bim-model',
      extension: 'json',
      contentType: 'application/vnd.rhautt.rysnova-bim.scene3d+json',
      content,
      metadata: {
        ...visualMetadata,
        visualQualityEvidence: this.visualQualityEvidenceForContent('bim-model', content, visualMetadata)
      }
    };
  }

  async generateVisualArtifacts(scope, projectId, data = {}) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova visual artifact generation');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }

    const result = this.normalizeVisualSource(data);
    const visualPackages = this.visualPackageService.generate(result);
    const tier = data.tier || data.tierKey || result.recommendation?.recommendedTier || result.recommendedTierId || 'balanced';
    const visualPackage = visualPackages.tiers?.[tier] || visualPackages.tiers?.balanced || Object.values(visualPackages.tiers || {})[0];
    if (!visualPackage) {
      const err = new Error('Rysnova visual package could not be generated for requested tier');
      err.status = 422;
      throw err;
    }

    const artifacts = [];
    for (const visualKey of ['principleDiagram', 'layout2d', 'illustration3d']) {
      const artifactInput = this.artifactInputForVisual(scope, projectId, { ...data, result, tier }, visualPackage, visualKey);
      artifactInput.version = data.version || await this.nextArtifactVersion(scope, projectId, artifactInput.type);
      artifacts.push(await this.createArtifact(scope, artifactInput));
    }

    return {
      projectId,
      tenantId: scope.tenantId,
      tier,
      visualPackageStatus: visualPackage.status,
      artifacts,
      engineeringTraceabilityManifest: this.engineeringTraceabilityManifest({
        projectId,
        tier,
        visualArtifacts: artifacts
      }),
      artifactTypes: artifacts.map(item => item.type),
      count: artifacts.length,
      generatedAt: this.now().toISOString()
    };
  }

  async generateDeliverableArtifacts(scope, projectId, data = {}) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova deliverable artifact generation');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }

    const deliverablePackage = this.buildDeliverablePackage(projectId, data);
    const artifactInputs = this.artifactInputsForDeliverables(scope, projectId, data, deliverablePackage);
    const artifacts = [];
    for (const artifactInput of artifactInputs) {
      artifactInput.version = data.version || await this.nextArtifactVersion(scope, projectId, artifactInput.type);
      artifacts.push(await this.createArtifact(scope, artifactInput));
    }

    return {
      projectId,
      tenantId: scope.tenantId,
      tier: deliverablePackage.tier,
      tierComparison: this.buildTierComparison(projectId, data),
      project: deliverablePackage.project,
      artifacts,
      storageEvidence: artifacts.map(artifact => this.artifactStorageEvidence(artifact)),
      artifactTypes: artifacts.map(item => item.type),
      count: artifacts.length,
      bomSummary: deliverablePackage.bomPackage.bomSummary,
      quantityTakeoffSummary: deliverablePackage.quantityTakeoff.totals,
      quoteCostSummary: deliverablePackage.bomPackage.quoteCostSummary,
      standardsSummary: deliverablePackage.standardsCheck.standardsSummary,
      standardsCoverage: deliverablePackage.standardsCheck.standardsCoverage,
      engineeringTraceabilityManifest: this.engineeringTraceabilityManifest({
        projectId,
        tier: deliverablePackage.tier,
        deliverableArtifacts: artifacts,
        quoteCostSummary: deliverablePackage.bomPackage.quoteCostSummary,
        standardsSummary: deliverablePackage.standardsCheck.standardsSummary,
        standardsCoverage: deliverablePackage.standardsCheck.standardsCoverage,
        lifecycleHandoff: deliverablePackage.bomPackage.quoteCostSummary.installedAssetHandoff
      }),
      customerReportSummary: {
        title: deliverablePackage.customerReport.title,
        sectionCount: deliverablePackage.customerReport.customerVisibleSections.length,
        iotBoundary: deliverablePackage.customerReport.iotBoundary,
        standardsCoverageStatus: deliverablePackage.customerReport.standardsCoverage.status
      },
      generatedAt: this.now().toISOString()
    };
  }

  async generateSignoffPackage(scope, projectId, data = {}) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova signoff package generation');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }

    const approvalMode = data.approvalMode || (data.shareToCustomer ? 'share-to-customer' : 'review-only');
    if (!['review-only', 'share-to-customer'].includes(approvalMode)) {
      const err = new Error('unsupported Rysnova signoff approvalMode');
      err.status = 400;
      throw err;
    }

    const artifactGenerationOptions = {
      ...data,
      customerVisible: false,
      status: data.status || 'reviewing'
    };
    const [visualResult, deliverableResult] = await Promise.all([
      this.generateVisualArtifacts(scope, projectId, artifactGenerationOptions),
      this.generateDeliverableArtifacts(scope, projectId, artifactGenerationOptions)
    ]);

    let artifacts = [
      ...(visualResult.artifacts || []),
      ...(deliverableResult.artifacts || [])
    ];
    let approvalResults = [];

    if (approvalMode === 'share-to-customer') {
      approvalResults = await Promise.all(artifacts.map(artifact => {
        const artifactId = artifact.id || artifact._id || artifact.objectKey;
        return this.approveArtifact(scope, artifactId, {
          shareToCustomer: true,
          approvedAt: data.approvedAt
        });
      }));
      artifacts = approvalResults;
    }

    const deepeningPackage = await this.buildDeepeningPackage(scope, projectId);
    const customerPackage = await this.buildCustomerPackage(scope, projectId, {
      publishEvent: approvalMode === 'share-to-customer'
    });
    const artifactTypes = artifacts.map(item => item.type);
    const storageEvidence = artifacts.map(artifact => this.artifactStorageEvidence(artifact));
    const signoffEvidence = artifacts.map(artifact => this.artifactSignoffEvidence(artifact));

    return {
      projectId,
      tenantId: scope.tenantId,
      tier: deliverableResult.tier || visualResult.tier || data.tier || 'balanced',
      tierComparison: deliverableResult.tierComparison || this.buildTierComparison(projectId, data),
      approvalMode,
      status: deepeningPackage.handoffReady ? 'signoff-ready' : 'review-generated',
      requiredTypes: CUSTOMER_SIGNOFF_REQUIRED_TYPES,
      artifactTypes,
      count: artifacts.length,
      artifacts,
      visualArtifacts: visualResult.artifacts || [],
      deliverableArtifacts: deliverableResult.artifacts || [],
      approvalResults,
      storageEvidence,
      signoffEvidence,
      bomSummary: deliverableResult.bomSummary,
      quantityTakeoffSummary: deliverableResult.quantityTakeoffSummary,
      quoteCostSummary: deliverableResult.quoteCostSummary,
      standardsSummary: deliverableResult.standardsSummary,
      standardsCoverage: deliverableResult.standardsCoverage,
      engineeringTraceabilityManifest: this.engineeringTraceabilityManifest({
        projectId,
        tier: deliverableResult.tier || visualResult.tier || data.tier || 'balanced',
        visualArtifacts: visualResult.artifacts || [],
        deliverableArtifacts: deliverableResult.artifacts || [],
        quoteCostSummary: deliverableResult.quoteCostSummary,
        standardsSummary: deliverableResult.standardsSummary,
        standardsCoverage: deliverableResult.standardsCoverage,
        lifecycleHandoff: deliverableResult.quoteCostSummary?.installedAssetHandoff || null
      }),
      customerReportSummary: deliverableResult.customerReportSummary,
      customerPackage,
      customerSignoffManifest: customerPackage.customerSignoffManifest,
      deepeningPackage,
      customerPackageReady: customerPackage.missingTypes.length === 0 &&
        customerPackage.count === CUSTOMER_SIGNOFF_REQUIRED_TYPES.length &&
        customerPackage.readiness?.packageReady === true,
      handoffReady: deepeningPackage.handoffReady === true,
      evidenceGaps: deepeningPackage.evidenceGaps || [],
      nextActions: deepeningPackage.nextActions || [],
      generatedAt: this.now().toISOString()
    };
  }

  async createArtifact(scope, data) {
    const payload = this.normalizeArtifact(scope, data);
    const storedObject = this.hasPersistableContent(data)
      ? await this.storageAdapter.putObject({
        objectKey: payload.objectKey,
        content: this.artifactContent(data),
        contentType: this.normalizeContentType(data),
        metadata: {
          tenantId: scope.tenantId,
          projectId: payload.projectId,
          type: payload.type,
          version: payload.version
        }
      })
      : null;
    const storagePayload = storedObject
      ? {
        ...payload,
        contentHash: storedObject.contentHash,
        metadata: {
          ...payload.metadata,
          storage: {
            provider: storedObject.provider,
            uri: storedObject.uri,
            sizeBytes: storedObject.sizeBytes,
            contentType: storedObject.contentType,
            updatedAt: storedObject.updatedAt
          }
        }
      }
      : payload;

    const artifact = this.shouldUseMemoryMode()
      ? this.createMemoryArtifactFromPayload(storagePayload)
      : await this.artifactRepo.create(scope, storagePayload);
    await this.publishOutbox(scope, this.artifactOutboxEvent('rysnova-bim.artifact.created', artifact));
    return artifact;
  }

  async approveArtifact(scope, artifactId, data = {}) {
    if (this.shouldUseMemoryMode()) {
      const updated = await this.approveMemoryArtifact(scope, artifactId, data);
      await this.publishOutbox(
        scope,
        this.artifactOutboxEvent(data.shareToCustomer ? 'rysnova-bim.artifact.shared' : 'rysnova-bim.artifact.approved', updated)
      );
      return updated;
    }

    const artifact = await this.artifactRepo.findById(scope, artifactId);
    if (!artifact) {
      const err = new Error('Rysnova artifact not found');
      err.status = 404;
      throw err;
    }

    let integrity = null;
    if (data.shareToCustomer || data.customerVisible === true) {
      integrity = await this.verifyArtifactIntegrity(scope, artifactId, artifact);
      if (!integrity.passed) {
        const err = new Error('Rysnova artifact storage integrity check failed');
        err.status = 409;
        err.details = integrity;
        throw err;
      }
    }

    const updated = await this.artifactRepo.updateById(scope, artifactId, {
      status: data.shareToCustomer ? 'shared' : 'approved',
      approvedBy: scope.userId,
      approvedAt: data.approvedAt || new Date(),
      permissions: {
        ...artifact.permissions,
        customerVisible: data.shareToCustomer ? true : Boolean(data.customerVisible ?? artifact.permissions?.customerVisible)
      },
      metadata: {
        ...(artifact.metadata || {}),
        ...(integrity
          ? {
            integrity: {
              passed: integrity.passed,
              checkedAt: integrity.checkedAt,
              actualContentHash: integrity.actualContentHash,
              expectedContentHash: integrity.expectedContentHash
            },
            storage: {
              ...(artifact.metadata?.storage || {}),
              integrityPassed: integrity.passed,
              integrityCheckedAt: integrity.checkedAt
            }
          }
          : {})
      }
    });
    await this.publishOutbox(
      scope,
      this.artifactOutboxEvent(data.shareToCustomer ? 'rysnova-bim.artifact.shared' : 'rysnova-bim.artifact.approved', updated)
    );
    return updated;
  }

  async getArtifactById(scope, artifactId) {
    if (this.shouldUseMemoryMode()) {
      const artifact = this.findMemoryArtifactById(scope, artifactId);
      if (!artifact) {
        const err = new Error('Rysnova artifact not found');
        err.status = 404;
        throw err;
      }
      return artifact;
    }
    const artifact = await this.artifactRepo.findById(scope, artifactId);
    if (!artifact) {
      const err = new Error('Rysnova artifact not found');
      err.status = 404;
      throw err;
    }
    return artifact;
  }

  async verifyArtifactIntegrity(scope, artifactId, artifactOverride = null, options = {}) {
    const artifact = artifactOverride || await this.getArtifactById(scope, artifactId);
    const verification = await this.storageAdapter.verifyObject(artifact.objectKey, artifact.contentHash);
    const result = {
      artifactId: artifact.id || artifact._id || artifactId,
      tenantId: artifact.tenantId,
      projectId: artifact.projectId,
      type: artifact.type,
      version: artifact.version,
      status: artifact.status,
      objectKey: artifact.objectKey,
      expectedContentHash: artifact.contentHash,
      ...verification,
      storage: artifact.metadata?.storage || null
    };
    if (result.passed === true && options.publishEvent !== false) {
      await this.publishOutbox(scope, this.artifactOutboxEvent('rysnova-bim.artifact.integrity.verified', artifact));
    }
    return result;
  }

  async prepareArtifactDownload(scope, artifactId, options = {}) {
    const artifact = await this.getArtifactById(scope, artifactId);
    this.assertArtifactDownloadAccess(scope, artifact);
    const descriptor = this.artifactDownloadDescriptor(artifact, { customerSafe: true });
    const qualityGate = this.artifactQualityGate(artifact);
    if (qualityGate.passed !== true || descriptor.downloadReady !== true) {
      const err = new Error('Rysnova artifact is not ready for customer download');
      err.status = 409;
      err.details = {
        artifactId: descriptor.artifactId,
        type: descriptor.type,
        downloadReady: descriptor.downloadReady,
        qualityGate,
        blockers: descriptor.blockers
      };
      throw err;
    }

    const ttlSeconds = Math.max(60, Math.min(Number(options.ttlSeconds || 900), 3600));
    return {
      artifactId: descriptor.artifactId,
      projectId: artifact.projectId,
      type: descriptor.type,
      label: descriptor.label,
      fileRole: descriptor.fileRole,
      version: descriptor.version,
      objectKey: descriptor.objectKey,
      contentHash: descriptor.contentHash,
      contentType: descriptor.contentType,
      sizeBytes: descriptor.sizeBytes,
      provider: descriptor.provider,
      integrityPassed: descriptor.integrityPassed,
      downloadReady: true,
      accessMode: 'object-storage-gateway',
      downloadUrl: `/api/v2/rysnova-bim/artifacts/${encodeURIComponent(descriptor.artifactId)}/download/content`,
      expiresInSeconds: ttlSeconds,
      expiresAt: new Date(this.now().getTime() + ttlSeconds * 1000).toISOString(),
      customerSafe: true,
      visualQualityEvidence: descriptor.visualQualityEvidence,
      engineeringTraceability: descriptor.engineeringTraceability,
      qualityGate,
      generatedAt: this.now().toISOString()
    };
  }

  assertArtifactDownloadAccess(scope = {}, artifact = {}) {
    if (scope.role !== 'customer') return;
    if (!scope.customerId) {
      const err = new Error('customerId is required for Rysnova artifact download access');
      err.status = 403;
      throw err;
    }
    if (String(artifact.customerId || '') !== String(scope.customerId)) {
      const err = new Error('Rysnova artifact not found');
      err.status = 404;
      throw err;
    }
  }

  async downloadArtifactContent(scope, artifactId, options = {}) {
    const descriptor = await this.prepareArtifactDownload(scope, artifactId, options);
    const object = await this.storageAdapter.getObject(descriptor.objectKey);
    const bytes = Buffer.isBuffer(object.bytes) ? object.bytes : Buffer.from(object.bytes || '');
    const actualContentHash = contentHashFromBytes(bytes);
    if (actualContentHash !== descriptor.contentHash) {
      const err = new Error('Rysnova artifact content integrity mismatch');
      err.status = 409;
      err.details = {
        artifactId: descriptor.artifactId,
        objectKey: descriptor.objectKey,
        expectedContentHash: descriptor.contentHash,
        actualContentHash
      };
      throw err;
    }
    return {
      ...descriptor,
      bytes,
      contentHash: actualContentHash,
      contentType: descriptor.contentType || object.contentType || 'application/octet-stream',
      sizeBytes: bytes.length,
      filename: `${descriptor.fileRole || descriptor.type || 'artifact'}-v${descriptor.version || 1}`
    };
  }

  async listArtifacts(scope, query = {}) {
    if (this.shouldUseMemoryMode()) {
      const items = this.getMemoryArtifactsForQuery(scope, query).filter(item => {
        if (String(item.tenantId) !== String(scope.tenantId)) return false;
        if (query.projectId && String(item.projectId) !== String(query.projectId)) return false;
        if (query.customerId && String(item.customerId) !== String(query.customerId)) return false;
        if (query.type && item.type !== query.type) return false;
        if (query.status && item.status !== query.status) return false;
        if (Array.isArray(query.statusIn) && query.statusIn.length && !query.statusIn.includes(item.status)) return false;
        if (Object.prototype.hasOwnProperty.call(query, 'customerVisible') && item.permissions?.customerVisible !== query.customerVisible) return false;
        return true;
      });
      return {
        items,
        pagination: { page: 1, limit: items.length, total: items.length, pages: 1 },
        storageMode: 'memory'
      };
    }

    const q = {};
    if (query.projectId) q.projectId = query.projectId;
    if (query.customerId) q.customerId = query.customerId;
    if (query.type) q.type = query.type;
    if (query.status) q.status = query.status;
    if (Array.isArray(query.statusIn) && query.statusIn.length) q.status = { $in: query.statusIn };
    if (Object.prototype.hasOwnProperty.call(query, 'customerVisible')) q['permissions.customerVisible'] = query.customerVisible;
    return this.artifactRepo.list(scope, q, {
      page: query.page,
      limit: query.limit,
      sort: { updatedAt: -1 }
    });
  }

  customerPackageQuery(scope, projectId) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova customer package operations');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }
    const query = {
      projectId,
      statusIn: [...CUSTOMER_VISIBLE_STATUSES],
      customerVisible: true
    };
    if (scope.role === 'customer') {
      if (!scope.customerId) {
        const err = new Error('customerId is required for Rysnova customer package access');
        err.status = 403;
        throw err;
      }
      query.customerId = scope.customerId;
    }
    return query;
  }

  async publishOutbox(scope, event) {
    if (!this.outboxService || typeof this.outboxService.publish !== 'function') return null;
    return this.outboxService.publish(scope, event);
  }

  artifactOutboxEvent(eventType, artifact = {}) {
    const artifactId = artifact._id || artifact.id || artifact.objectKey;
    return {
      aggregateType: 'rysnova-bim_artifact',
      aggregateId: artifactId,
      eventType,
      idempotencyKey: `${artifact.tenantId}:rysnova-bim_artifact:${artifact.projectId}:${artifact.type}:v${artifact.version}:${eventType}`,
      payload: {
        artifactId,
        projectId: artifact.projectId,
        customerId: artifact.customerId,
        moduleId: artifact.moduleId,
        moduleDeploymentMode: artifact.moduleDeploymentMode,
        moduleNamespace: artifact.moduleNamespace,
        dataNamespace: artifact.dataNamespace,
        type: artifact.type,
        status: artifact.status,
        version: artifact.version,
        objectKey: artifact.objectKey,
        contentHash: artifact.contentHash,
        customerVisible: Boolean(artifact.permissions?.customerVisible)
      }
    };
  }

  customerPackageReadyOutboxEvent(scope, projectId, packageResult = {}) {
    const artifactTypes = (packageResult.artifacts || []).map(item => item.type);
    return {
      aggregateType: 'rysnova-bim_customer_package',
      aggregateId: projectId,
      eventType: 'rysnova-bim.customer_package.ready',
      idempotencyKey: `${scope.tenantId}:rysnova-bim_customer_package:${projectId}:ready:v${artifactTypes.sort().join('.')}`,
      payload: {
        projectId,
        count: packageResult.count,
        requiredTypes: packageResult.requiredTypes,
        missingTypes: packageResult.missingTypes,
        artifactTypes,
        customerVisible: true,
        customerSignoffReady: true,
        customerSignoffManifestId: packageResult.customerSignoffManifest?.manifestId || null
      }
    };
  }

  customerSignoffConfirmedOutboxEvent(scope, projectId, receipt = {}) {
    return {
      aggregateType: 'rysnova-bim_customer_signoff',
      aggregateId: receipt.receiptNo || projectId,
      eventType: 'rysnova-bim.customer_signoff.confirmed',
      idempotencyKey: `${scope.tenantId}:rysnova-bim_customer_signoff:${projectId}:${receipt.manifestId}:${receipt.receiptNo}`,
      payload: {
        projectId,
        receiptNo: receipt.receiptNo,
        manifestId: receipt.manifestId,
        customerId: receipt.customerId || null,
        status: receipt.status,
        artifactCount: receipt.artifactCount,
        requiredTypes: receipt.requiredTypes,
        artifactTypes: receipt.artifactTypes,
        acknowledgements: receipt.acknowledgements,
        handoffBoundary: receipt.lifecycleHandoff?.handoffBoundary || 'lifecycle_handoff_only',
        realtimeControl: false,
        confirmedAt: receipt.customerSignature?.confirmedAt || receipt.generatedAt
      }
    };
  }

  artifactQualityGate(artifact = {}) {
    const standards = Array.isArray(artifact.standards) ? artifact.standards : [];
    const storage = artifact.metadata?.storage || {};
    const integrity = artifact.metadata?.integrity || {};
    const standardsFailed = standards.filter(item => item.softwareCheck === 'failed');
    const standardsWarning = standards.filter(item => item.softwareCheck === 'warning');
	    const { storageReady } = this.artifactStorageReadiness(artifact);
    const integrityPassed = storage.integrityPassed === true || integrity.passed === true;
    const customerVisible = artifact.permissions?.customerVisible === true;
    const approvedForCustomer = CUSTOMER_VISIBLE_STATUSES.has(artifact.status) && customerVisible;
    const visualQuality = VISUAL_ARTIFACT_TYPES.has(artifact.type)
      ? this.visualQualityEvidenceForArtifact(artifact)
      : null;
    const visualQualityPassed = visualQuality ? visualQuality.passed === true : true;
    const passed = Boolean(
      approvedForCustomer &&
      storageReady &&
      integrityPassed &&
      standardsFailed.length === 0 &&
      visualQualityPassed
    );

    return {
      passed,
      status: passed ? 'passed' : 'blocked',
      checks: {
        approvedForCustomer,
        customerVisible,
        storageReady,
        integrityPassed,
        standardsPassed: standardsFailed.length === 0,
        visualQualityPassed
      },
      blockers: [
        ...(!approvedForCustomer ? [{ code: 'not-approved-for-customer', message: 'Artifact must be approved/shared and customer-visible.' }] : []),
        ...(!storageReady ? [{ code: 'storage-not-ready', message: 'Artifact storage metadata, object key, hash, and size are required.' }] : []),
        ...(!integrityPassed ? [{ code: 'integrity-not-verified', message: 'Object storage hash integrity must pass before signoff.' }] : []),
        ...standardsFailed.map(item => ({
          code: 'standard-failed',
          standardCode: item.code,
          level: item.level,
          edition: item.edition,
          message: item.note || 'Standards check failed.'
        })),
        ...(visualQuality && visualQuality.passed !== true
          ? (visualQuality.blockers || [{
              code: 'visual-quality-blocked',
              message: 'Visual artifact quality evidence is required before customer download.'
            }]).map(blocker => ({
              code: blocker.code || 'visual-quality-blocked',
              visualKey: visualQuality.visualKey,
              type: visualQuality.type,
              message: blocker.message || 'Visual artifact quality evidence is required before customer download.',
              missingRefs: blocker.missingRefs
            }))
          : [])
      ],
      warnings: standardsWarning.map(item => ({
        code: 'standard-warning',
        standardCode: item.code,
        level: item.level,
        edition: item.edition,
        message: item.note || 'Standards check warning requires designer review.'
      })).concat(visualQuality?.warnings || [])
    };
  }

  artifactSignoffEvidence(artifact = {}) {
    const qualityGate = this.artifactQualityGate(artifact);
    return {
      artifactId: String(artifact.id || artifact._id || artifact.objectKey),
      type: artifact.type,
      version: Number(artifact.version || 1),
      status: artifact.status,
      approvedBy: artifact.approvedBy || null,
      approvedAt: artifact.approvedAt || null,
      customerVisible: artifact.permissions?.customerVisible === true,
      objectKey: artifact.objectKey,
      contentHash: artifact.contentHash,
      qualityGate
    };
  }

  buildQualityGateSummary(latestByType = {}) {
    const requiredTypes = CUSTOMER_SIGNOFF_REQUIRED_TYPES;
    const artifacts = requiredTypes
      .map(type => latestByType[type])
      .filter(Boolean)
      .map(artifact => this.artifactSignoffEvidence(artifact));
    const missingTypes = requiredTypes.filter(type => !latestByType[type]);
    const failedArtifacts = artifacts.filter(item => item.qualityGate.passed !== true);
    const warningCount = artifacts.reduce((sum, item) => sum + item.qualityGate.warnings.length, 0);

    return {
      passed: missingTypes.length === 0 && failedArtifacts.length === 0,
      requiredTypes,
      checkedTypes: artifacts.map(item => item.type),
      missingTypes,
      failedArtifacts: failedArtifacts.map(item => ({
        artifactId: item.artifactId,
        type: item.type,
        blockers: item.qualityGate.blockers
      })),
      warningCount,
      checkedAt: this.now().toISOString()
    };
  }

  deliveryStageForCustomerPackage(packageResult = {}) {
    if (packageResult.readiness?.packageReady) return 'customer-signoff-ready';
    if ((packageResult.artifacts || []).length > 0) return 'customer-review-incomplete';
    return 'not-ready';
  }

  buildCustomerSignoffManifest(packageResult = {}) {
    const artifacts = Array.isArray(packageResult.artifacts) ? packageResult.artifacts : [];
    const downloadManifest = packageResult.downloadManifest || { ready: false, readyCount: 0, blockedCount: 0, items: [] };
    const lifecycleHandoff = packageResult.lifecycleHandoff || null;
    const quoteSummary = packageResult.quoteSummary || null;
    const selectedTierDecision = packageResult.selectedTierDecision || null;
    const readiness = packageResult.readiness || {};
    const ready = readiness.packageReady === true;
    const artifactSummaries = artifacts.map(artifact => {
      const download = (downloadManifest.items || []).find(item => item.type === artifact.type) || {};
      return {
        artifactId: artifact.id,
        type: artifact.type,
        label: artifact.summary?.title || download.label || this.artifactDisplayLabel(artifact.type),
        version: Number(artifact.version || download.version || 1),
        objectKey: artifact.objectKey || download.objectKey || null,
        contentHash: artifact.contentHash || download.contentHash || null,
        downloadReady: download.downloadReady === true,
        signoffStatus: download.signoffStatus || (artifact.signoff?.approved ? 'customer-visible' : 'internal-review'),
        qualityStatus: download.qualityStatus || artifact.qualityGate?.status || 'blocked',
        updatedAt: artifact.updatedAt || download.updatedAt || null
      };
    });
    const manifestHash = this.createHash({
      projectId: packageResult.projectId,
      requiredTypes: packageResult.requiredTypes,
      missingTypes: packageResult.missingTypes,
      artifactSummaries: artifactSummaries.map(item => ({
        artifactId: item.artifactId,
        type: item.type,
        version: item.version,
        contentHash: item.contentHash,
        downloadReady: item.downloadReady
      })),
      quoteSummary,
      selectedTierDecision,
      lifecycleBoundary: lifecycleHandoff?.handoffBoundary || null,
      standardsPassed: packageResult.standardsSummary?.passed === true
    });

    return {
      manifestId: `rysnova-bim-signoff-${manifestHash.replace(/^sha256:/, '').slice(0, 16)}`,
      packageType: 'rysnova-bim-customer-signoff-manifest',
      projectId: packageResult.projectId,
      deliveryStage: packageResult.deliveryStage || this.deliveryStageForCustomerPackage(packageResult),
      ready,
      requiredTypes: packageResult.requiredTypes || CUSTOMER_SIGNOFF_REQUIRED_TYPES,
      artifactTypes: artifactSummaries.map(item => item.type),
      artifactCount: artifactSummaries.length,
      missingTypes: packageResult.missingTypes || [],
      download: {
        ready: downloadManifest.ready === true,
        readyCount: Number(downloadManifest.readyCount || 0),
        blockedCount: Number(downloadManifest.blockedCount || 0)
      },
      quoteSummary,
      selectedTierDecision,
      engineeringTraceabilityManifest: packageResult.engineeringTraceabilityManifest || null,
      standardsSummary: packageResult.standardsSummary || null,
      standardsCoverage: packageResult.standardsCoverage || null,
      lifecycleHandoff: lifecycleHandoff
        ? {
            handoffBoundary: lifecycleHandoff.handoffBoundary || 'lifecycle_handoff_only',
            realtimeControl: false,
            targetPlatform: lifecycleHandoff.targetPlatform || 'external-iot-lifecycle-platform',
            assetCount: Number(lifecycleHandoff.assetCount || 0),
            standardsCoverageImpact: lifecycleHandoff.standardsCoverageImpact || null
          }
        : null,
      signoffAction: {
        allowed: ready,
        required: ready ? 'customer-signature-required' : 'complete-evidence-before-signature',
        requiredCustomerAcknowledgements: CUSTOMER_SIGNOFF_ACKNOWLEDGEMENTS
      },
      artifacts: artifactSummaries,
      boundary: {
        customerSafe: true,
        omittedFieldGroups: [
          'internal-costing',
          'tenant-scope',
          'approval-audit',
          'raw-records'
        ],
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false
      },
      generatedAt: this.now().toISOString()
    };
  }

	  async buildCustomerPackage(scope, projectId, options = {}) {
	    const result = await this.listArtifacts(scope, this.customerPackageQuery(scope, projectId));
	    const artifacts = (result.items || []).filter(item => (
	      CUSTOMER_VISIBLE_STATUSES.has(item.status) &&
	      item.permissions?.customerVisible === true
	    ));
	    if (scope.role === 'customer' && artifacts.length === 0) {
	      const err = new Error('Rysnova customer package not found');
	      err.status = 404;
	      throw err;
	    }
	    const customerArtifacts = artifacts.map(item => this.customerArtifactDto(item));
    const downloadManifest = this.buildDownloadManifest(artifacts, { customerSafe: true });
    const missingTypes = CUSTOMER_SIGNOFF_REQUIRED_TYPES.filter(type => (
      !customerArtifacts.some(item => item.type === type)
    ));
	    const latestByType = this.latestCustomerSignoffArtifactsByType(artifacts);
	    const standardsSummary = this.summarizeStandards(latestByType);
    const standardsCoverage = this.summarizeStandardsCoverage(latestByType);
	    const visualReadiness = this.buildVisualReadiness(latestByType);
    const commercialReadiness = this.buildCommercialReadiness(latestByType);
    const installedAssetHandoff = this.buildInstalledAssetHandoffReadiness(commercialReadiness);
    const engineeringTraceabilityManifest = this.engineeringTraceabilityManifest({
      projectId,
      tier: commercialReadiness.quotationSummary?.tier || null,
      visualArtifacts: [
        latestByType['principle-diagram'],
        latestByType['construction-drawing'],
        latestByType['bim-model']
      ].filter(Boolean),
      deliverableArtifacts: [
        latestByType.bom,
        latestByType['quantity-takeoff'],
        latestByType['standards-check'],
        latestByType['customer-report']
      ].filter(Boolean),
      quoteCostSummary: commercialReadiness.quoteCostSummary,
      standardsSummary,
      standardsCoverage,
      lifecycleHandoff: installedAssetHandoff.manifest
    });
    const customerSignoff = this.buildCustomerSignoffReadiness(
      latestByType,
      visualReadiness,
      commercialReadiness,
      standardsSummary
    );
    const qualityGateSummary = this.buildQualityGateSummary(latestByType);
    const objectStorageIntegrityReady = customerArtifacts.length > 0 &&
      customerArtifacts.every(item => item.storage?.integrityPassed === true);
    const packageResult = {
	      projectId,
	      artifacts: customerArtifacts,
	      count: customerArtifacts.length,
	      requiredTypes: CUSTOMER_SIGNOFF_REQUIRED_TYPES,
	      missingTypes,
      readiness: {
        packageReady: missingTypes.length === 0 &&
          customerArtifacts.length === CUSTOMER_SIGNOFF_REQUIRED_TYPES.length &&
          customerSignoff.ready === true &&
          installedAssetHandoff.ready === true &&
	        objectStorageIntegrityReady === true &&
	        qualityGateSummary.passed === true,
        visualReady: visualReadiness.ready === true,
        commercialReady: commercialReadiness.ready === true,
        standardsPassed: standardsSummary.passed === true,
        lifecycleHandoffReady: installedAssetHandoff.ready === true,
        customerSignoffReady: customerSignoff.ready === true,
        objectStorageIntegrityReady
      },
      quoteSummary: this.customerQuoteSummary(commercialReadiness),
      selectedTierDecision: this.customerSelectedTierDecision(commercialReadiness),
      engineeringTraceabilityManifest,
	      lifecycleHandoff: this.customerLifecycleHandoffDto(installedAssetHandoff.manifest),
	      standardsSummary,
      standardsCoverage,
	      qualityGateSummary,
      downloadManifest,
	      visibility: {
	        scope: 'customer-visible',
	        hiddenFields: [
	          'tenantId',
	          'dealerId',
	          'storeId',
	          'createdBy',
	          'approvedBy',
	          'permissions',
	          'metadata',
	          'dealerMargin',
	          'costBaseline',
	          'internalApprovalNotes',
	          'costBreakdown',
	          'marginGuard'
	        ]
	      },
      deliveryStage: null
	    };
    packageResult.deliveryStage = this.deliveryStageForCustomerPackage(packageResult);
    packageResult.customerSignoffManifest = this.buildCustomerSignoffManifest(packageResult);
    if (
      options.publishEvent !== false &&
      packageResult.readiness.packageReady === true
    ) {
      await this.publishOutbox(scope, this.customerPackageReadyOutboxEvent(scope, projectId, packageResult));
    }
	    return packageResult;
	  }

  async confirmCustomerSignoff(scope, projectId, data = {}) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova customer signoff confirmation');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }
    const signoffCustomerId = this.resolveSignoffCustomerId(scope, data);

    const customerPackage = await this.buildCustomerPackage(scope, projectId, { publishEvent: false });
    this.assertCustomerPackageBelongsToCustomer(customerPackage, signoffCustomerId);
    const manifest = customerPackage.customerSignoffManifest;
    if (!manifest?.ready || customerPackage.readiness?.packageReady !== true) {
      const err = new Error('Rysnova customer signoff package is not ready');
      err.status = 409;
      err.details = {
        projectId,
        deliveryStage: customerPackage.deliveryStage,
        missingTypes: customerPackage.missingTypes,
        readiness: customerPackage.readiness,
        signoffAction: manifest?.signoffAction || null
      };
      throw err;
    }

    const acknowledgements = Array.isArray(data.acknowledgements)
      ? [...new Set(data.acknowledgements.map(item => String(item)))]
      : [];
    const missingAcknowledgements = CUSTOMER_SIGNOFF_ACKNOWLEDGEMENTS.filter(item => !acknowledgements.includes(item));
    if (missingAcknowledgements.length) {
      const err = new Error('Rysnova customer signoff acknowledgements are incomplete');
      err.status = 400;
      err.details = {
        requiredAcknowledgements: CUSTOMER_SIGNOFF_ACKNOWLEDGEMENTS,
        missingAcknowledgements
      };
      throw err;
    }

    const method = data.method || data.signatureMethod || 'customer_portal_confirmation';
    if (!CUSTOMER_SIGNOFF_METHODS.has(method)) {
      const err = new Error('unsupported Rysnova customer signoff method');
      err.status = 400;
      err.details = {
        allowedMethods: [...CUSTOMER_SIGNOFF_METHODS]
      };
      throw err;
    }

    const confirmedAt = data.confirmedAt || this.now().toISOString();
    const receiptHash = this.createHash({
      tenantId: scope.tenantId,
      projectId,
      customerId: signoffCustomerId,
      manifestId: manifest.manifestId,
      acknowledgements,
      confirmedAt
    });
    const receipt = {
      receiptNo: `LITH-SIGNOFF-${receiptHash.replace(/^sha256:/, '').slice(0, 16).toUpperCase()}`,
      projectId,
      tenantId: scope.tenantId,
      customerId: signoffCustomerId,
      manifestId: manifest.manifestId,
      packageType: 'rysnova-bim-customer-signoff-receipt',
      status: 'customer-signed',
      deliveryStage: customerPackage.deliveryStage,
      artifactCount: manifest.artifactCount,
      requiredTypes: manifest.requiredTypes,
      artifactTypes: manifest.artifactTypes,
      acknowledgements,
      quoteSummary: manifest.quoteSummary,
      selectedTierDecision: manifest.selectedTierDecision || customerPackage.selectedTierDecision || null,
      lifecycleHandoff: manifest.lifecycleHandoff,
      boundary: {
        customerSafe: true,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        noRealtimeControlGranted: true
      },
      customerSignature: {
        method,
        signerName: data.signerName || data.customerSigner || null,
        signerMobileHash: data.signerMobile ? this.createHash(String(data.signerMobile)) : null,
        evidenceHash: data.signatureEvidence ? this.createHash(data.signatureEvidence) : null,
        termsVersion: data.termsVersion || 'rysnova-bim-signoff-v1',
        confirmedAt
      },
      generatedAt: this.now().toISOString()
    };
    await this.publishOutbox(scope, this.customerSignoffConfirmedOutboxEvent(scope, projectId, receipt));
    return {
      projectId,
      tenantId: scope.tenantId,
      status: 'customer-signoff-confirmed',
      receipt,
      customerPackage,
      customerSignoffManifest: manifest,
      lifecycleHandoff: customerPackage.lifecycleHandoff,
      generatedAt: this.now().toISOString()
    };
  }

  customerQuoteSummary(commercialReadiness = {}) {
    const quote = commercialReadiness.quotationSummary || commercialReadiness.quoteCostSummary?.quotationSummary || null;
    if (!quote) return null;
    const coverageImpact = commercialReadiness.quoteCostSummary?.standardsCoverageImpact || null;
    return {
      quotationNo: quote.quotationNo || null,
      status: quote.status || null,
      tier: quote.tier || null,
      currency: quote.currency || 'CNY',
      customerTotal: quote.customerTotal ?? null,
      monthlyPayment: quote.monthlyPayment ?? null,
      validDays: quote.validDays ?? null,
      standardsCoverageImpact: coverageImpact
        ? {
            status: coverageImpact.status,
            coveredDomains: coverageImpact.coveredDomains || [],
            missingRequiredDomains: coverageImpact.missingRequiredDomains || [],
            quoteDrivers: coverageImpact.quoteDrivers || [],
            deliverableEvidence: coverageImpact.deliverableEvidence || [],
            lifecycleHandoffImpact: coverageImpact.lifecycleHandoffImpact || []
          }
        : null
      };
  }

  customerSelectedTierDecision(commercialReadiness = {}) {
    const quoteCostSummary = commercialReadiness.quoteCostSummary || {};
    const quote = commercialReadiness.quotationSummary || quoteCostSummary.quotationSummary || null;
    if (!quote) return null;
    const tier = this.normalizeTierKey(quote.tier || 'balanced');
    const profile = this.tierDecisionProfile(tier);
    const quantity = commercialReadiness.quantityTakeoffSummary || {};
    const bom = commercialReadiness.bomSummary || {};
    const handoff = quoteCostSummary.installedAssetHandoff || {};
    const coverageImpact = quoteCostSummary.standardsCoverageImpact || {};

    return {
      tier,
      tierName: this.tierName(tier),
      quotationNo: quote.quotationNo || null,
      positioning: profile.positioning,
      idealFor: profile.idealFor,
      valueDrivers: profile.valueDrivers,
      tradeoffs: profile.tradeoffs,
      selectionRationale: `${this.tierName(tier)}已进入客户签核包，签收回执冻结该档位的报价、工程量、标准覆盖和生命周期交接边界。`,
      engineeringDelta: {
        systemFamilies: bom.systemFamilies || [],
        systemCount: Number(bom.systemCount || 0),
        itemCount: Number(bom.itemCount || 0),
        pipeMeters: this.round(quantity.pipeMeters || 0, 1),
        ductSqm: this.round(quantity.ductSqm || 0, 1),
        valveCount: Number(quantity.valveCount || 0),
        controlPoints: Number(quantity.controlPoints || 0),
        estimatedLaborHours: this.round(quantity.estimatedLaborHours || 0, 1)
      },
      commercialDecision: {
        currency: quote.currency || 'CNY',
        customerTotal: quote.customerTotal ?? null,
        monthlyPayment: quote.monthlyPayment ?? null,
        validDays: quote.validDays ?? null,
        commercialApprovalStatus: quoteCostSummary.marginGuard?.status || 'pending',
        internalCostHiddenFromCustomer: true
      },
      standardsDecision: {
        coverageStatus: coverageImpact.status || 'incomplete',
        coveredDomains: coverageImpact.coveredDomains || [],
        missingRequiredDomains: coverageImpact.missingRequiredDomains || [],
        quoteDrivers: coverageImpact.quoteDrivers || [],
        deliverableEvidence: coverageImpact.deliverableEvidence || []
      },
      lifecycleDecision: {
        handoffBoundary: handoff.handoffBoundary || 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: Number(handoff.assetCount || 0),
        requiredBeforeCustomerCare: handoff.requiredBeforeCustomerCare || []
      },
      riskControls: [
        quoteCostSummary.marginGuard?.status === 'pass'
          ? '报价已通过毛利底线保护'
          : '报价需完成毛利底线复核',
        coverageImpact.status === 'complete'
          ? '标准覆盖完整'
          : '标准覆盖需补齐后签核',
        handoff.realtimeControl === false
          ? '仅交接生命周期资产，不开放实时控制'
          : '生命周期边界异常，禁止签核'
      ],
      customerSafe: true
    };
  }

  customerLifecycleHandoffDto(manifest = null) {
    if (!manifest) return null;
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    return {
      handoffBoundary: manifest.handoffBoundary,
      realtimeControl: manifest.realtimeControl === true ? false : false,
      targetPlatform: manifest.targetPlatform || 'external-iot-lifecycle-platform',
      project: manifest.project
        ? {
            name: manifest.project.name,
            city: manifest.project.city,
            area: manifest.project.area,
            houseType: manifest.project.houseType
          }
        : undefined,
      tier: manifest.tier,
      assetCount: Number(manifest.assetCount || assets.length || 0),
      standardsCoverageImpact: manifest.standardsCoverageImpact
        ? {
            status: manifest.standardsCoverageImpact.status,
            lifecycleHandoffImpact: manifest.standardsCoverageImpact.lifecycleHandoffImpact || [],
            deliverableEvidence: manifest.standardsCoverageImpact.deliverableEvidence || []
          }
        : null,
      assets: assets.map(asset => ({
        assetId: asset.assetId,
        systemFamily: asset.systemFamily,
        category: asset.category,
        systemName: asset.systemName,
        brand: asset.brand,
        model: asset.model,
        estimatedInstallScope: {
          equipmentCount: Number(asset.estimatedInstallScope?.equipmentCount || 0),
          pipeMeters: Number(asset.estimatedInstallScope?.pipeMeters || 0),
          ductSqm: Number(asset.estimatedInstallScope?.ductSqm || 0),
          valveCount: Number(asset.estimatedInstallScope?.valveCount || 0),
          controlPoints: Number(asset.estimatedInstallScope?.controlPoints || 0)
        },
        lifecycleState: asset.lifecycleState || 'pending-installation',
        warrantyRegistration: asset.warrantyRegistration || 'required-after-installation',
        servicePlan: asset.servicePlan,
        iotBinding: {
          status: asset.iotBinding?.status || 'handoff-ready-not-bound',
          requiredIdentifier: asset.iotBinding?.requiredIdentifier || 'installed_asset_id_or_device_serial',
          realtimeControl: false
        }
      })),
      requiredBeforeCustomerCare: Array.isArray(manifest.requiredBeforeCustomerCare)
        ? manifest.requiredBeforeCustomerCare
        : [
            'contract-signed',
            'installation-completed',
            'asset-serial-collected',
            'homeowner-care-plan-created'
          ]
    };
  }

	  customerArtifactDto(artifact = {}) {
	    const storage = artifact.metadata?.storage || {};
	    const integrity = artifact.metadata?.integrity || {};
	    const summary = this.customerArtifactSummary(artifact);
	    const qualityGate = this.artifactQualityGate(artifact);
	    return {
	      id: String(artifact.id || artifact._id || artifact.objectKey),
	      type: artifact.type,
	      version: artifact.version,
	      status: artifact.status,
	      customerId: artifact.customerId || null,
	      objectKey: artifact.objectKey,
	      contentHash: artifact.contentHash,
	      customerVisible: true,
	      storage: {
	        provider: storage.provider || null,
	        sizeBytes: storage.sizeBytes || 0,
	        contentType: storage.contentType || artifact.metadata?.contentType || null,
	        updatedAt: storage.updatedAt || artifact.updatedAt || artifact.createdAt || null,
	        integrityPassed: artifact.metadata?.storage?.integrityPassed === true || integrity.passed === true
	      },
	      engineeringTraceability: this.customerEngineeringTraceability(artifact),
	      summary,
	      standards: (artifact.standards || []).map(item => ({
	        code: item.code,
	        level: item.level,
	        edition: item.edition,
	        softwareCheck: item.softwareCheck,
	        note: item.softwareCheck === 'failed' ? item.note : undefined
	      })).filter(item => item.code),
	      qualityGate,
		      signoff: {
		        approved: CUSTOMER_VISIBLE_STATUSES.has(artifact.status),
		        approvedAt: artifact.approvedAt || null,
		        customerVisible: true
		      },
	      deliveryStage: qualityGate.passed ? 'customer-ready' : 'blocked',
	      updatedAt: artifact.updatedAt || artifact.createdAt || null
	    };
	  }

  resolveSignoffCustomerId(scope = {}, data = {}) {
    const customerId = scope.role === 'customer' ? scope.customerId : data.customerId;
    if (!customerId) {
      const err = new Error('customerId is required for Rysnova customer signoff confirmation');
      err.status = 403;
      throw err;
    }
    return String(customerId);
  }

  assertCustomerPackageBelongsToCustomer(customerPackage = {}, customerId) {
    const artifactCustomerIds = [
      ...new Set((customerPackage.artifacts || [])
        .map(item => item.customerId)
        .filter(Boolean)
        .map(item => String(item)))
    ];
    if (artifactCustomerIds.length !== 1 || artifactCustomerIds[0] !== String(customerId)) {
      const err = new Error('Rysnova customer signoff package must belong to exactly one matching customer');
      err.status = artifactCustomerIds.length ? 409 : 403;
      err.details = {
        expectedCustomerId: String(customerId),
        artifactCustomerIdCount: artifactCustomerIds.length,
        packageReady: customerPackage.readiness?.packageReady === true
      };
      throw err;
    }
  }

	  customerArtifactSummary(artifact = {}) {
	    const metadata = artifact.metadata || {};
    if (artifact.type === 'bom') {
      const bomSummary = metadata.bomSummary || metadata.summary || {};
      const quote = metadata.quoteCostSummary?.quotationSummary || metadata.quotationSummary || {};
      return {
        title: 'BOM 材料清单',
        itemCount: bomSummary.itemCount || 0,
        currency: bomSummary.currency || quote.currency || 'CNY',
        customerTotal: quote.customerTotal || bomSummary.customerTotal || null,
        systemQuoteExplanations: (metadata.quoteCostSummary?.systemQuoteExplanations || []).map(item => ({
          systemFamily: item.systemFamily,
          systemName: item.systemName,
          standardsDomains: item.standardsDomains || [],
          quoteDrivers: item.quoteDrivers || [],
          customerSafeExplanation: item.customerSafeExplanation
        }))
      };
    }
	    if (artifact.type === 'quantity-takeoff') {
	      const quantity = metadata.quantityTakeoffSummary || metadata.summary || {};
	      return {
	        title: '工程量清单',
	        pipeMeters: quantity.pipeMeters || 0,
	        valveCount: quantity.valveCount || quantity.valves || 0
	      };
	    }
	    if (artifact.type === 'standards-check') {
	      return {
	        title: '标准校验',
	        passed: metadata.standardsSummary?.passed !== false,
	        failedCount: metadata.standardsSummary?.counts?.failed || 0,
	        warningCount: metadata.standardsSummary?.counts?.warning || 0,
        coverageStatus: metadata.standardsCoverage?.status || metadata.standardsSummary?.coverageStatus || 'incomplete',
        coveredDomains: metadata.standardsCoverage?.coveredDomains || metadata.standardsSummary?.coveredCoverageDomains || []
	      };
	    }
	    if (artifact.type === 'customer-report') {
	      return {
	        title: metadata.customerReportTitle || metadata.title || '客户方案报告',
	        customerFacingReport: metadata.customerFacingReport === true
	      };
	    }
	    return {
	      title: metadata.label || metadata.title || artifact.type
	    };
	  }

  latestArtifactsByType(artifacts = []) {
    const latest = {};
    const candidates = artifacts.filter(item => !['archived', 'superseded'].includes(item.status));
    const score = item => {
      const version = Number(item.version || 0);
      const updatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return [version, updatedAt || createdAt || 0];
    };

    for (const artifact of candidates) {
      const current = latest[artifact.type];
      if (!current) {
        latest[artifact.type] = artifact;
        continue;
      }
      const [artifactVersion, artifactTime] = score(artifact);
      const [currentVersion, currentTime] = score(current);
      if (artifactVersion > currentVersion || (artifactVersion === currentVersion && artifactTime >= currentTime)) {
        latest[artifact.type] = artifact;
      }
    }
    return latest;
  }

  latestCustomerSignoffArtifactsByType(artifacts = []) {
    return this.latestArtifactsByType(
      artifacts.filter(item => (
        CUSTOMER_VISIBLE_STATUSES.has(item.status) &&
        item.permissions?.customerVisible === true
      ))
    );
  }

  summarizeStandards(latestByType = {}) {
    const counts = STANDARD_CHECK_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
    const blockingFailures = [];

    for (const artifact of Object.values(latestByType)) {
      for (const standard of artifact.standards || []) {
        const status = STANDARD_CHECK_STATUSES.includes(standard.softwareCheck)
          ? standard.softwareCheck
          : 'not-applicable';
        counts[status] += 1;
        if (status === 'failed') {
          blockingFailures.push({
            artifactId: artifact.id || artifact._id || artifact.objectKey,
            type: artifact.type,
            code: standard.code,
            level: standard.level,
            edition: standard.edition,
            note: standard.note
          });
        }
      }
    }

    return {
      counts,
      blockingFailures,
      passed: blockingFailures.length === 0
    };
  }

  summarizeStandardsCoverage(latestByType = {}) {
    const source = latestByType['standards-check'] ||
      latestByType['customer-report'] ||
      latestByType.bom ||
      null;
    const coverage = source?.metadata?.standardsCoverage || null;
    if (!coverage) {
      return {
        status: 'incomplete',
        requiredDomains: REQUIRED_STANDARDS_COVERAGE_DOMAINS,
        coveredDomains: [],
        missingRequiredDomains: REQUIRED_STANDARDS_COVERAGE_DOMAINS,
        domains: [],
        packIds: [],
        quoteImpact: [],
        deliverableEvidence: [],
        lifecycleHandoffImpact: []
      };
    }

    return {
      status: coverage.status || 'incomplete',
      requiredDomains: coverage.requiredDomains || REQUIRED_STANDARDS_COVERAGE_DOMAINS,
      coveredDomains: coverage.coveredDomains || [],
      missingRequiredDomains: coverage.missingRequiredDomains || [],
      domains: coverage.domains || [],
      packIds: coverage.packIds || [],
      quoteImpact: coverage.quoteImpact || [],
      deliverableEvidence: coverage.deliverableEvidence || [],
      lifecycleHandoffImpact: coverage.lifecycleHandoffImpact || []
    };
  }

  artifactSummary(artifact) {
    if (!artifact) return null;
    return {
      id: artifact.id || artifact._id || artifact.objectKey,
      type: artifact.type,
      version: artifact.version,
      status: artifact.status,
      objectKey: artifact.objectKey,
      contentHash: artifact.contentHash,
      customerVisible: Boolean(artifact.permissions?.customerVisible),
      hasStorageMetadata: Boolean(artifact.metadata?.storage),
      updatedAt: artifact.updatedAt || artifact.createdAt || null
    };
  }

	  artifactStorageEvidence(artifact) {
	    if (!artifact) return null;
	    const storage = artifact.metadata?.storage || {};
	    return {
      id: artifact.id || artifact._id || artifact.objectKey,
      type: artifact.type,
      version: artifact.version,
      objectKey: artifact.objectKey,
      contentHash: artifact.contentHash,
      provider: storage.provider || null,
      sizeBytes: storage.sizeBytes || 0,
      contentType: storage.contentType || artifact.metadata?.contentType || null,
      storageReady: Boolean(storage.provider && artifact.objectKey && artifact.contentHash),
	      updatedAt: storage.updatedAt || artifact.updatedAt || artifact.createdAt || null
	    };
	  }

  artifactStorageReadiness(artifact = {}) {
    const storage = artifact.metadata?.storage || {};
    const providerReady = Boolean(storage.provider);
    const objectKeyReady = Boolean(artifact.objectKey);
    const contentHashReady = Boolean(artifact.contentHash);
	    const sizeReady = Number(storage.sizeBytes || 0) > 0;
	    return {
	      storageReady: providerReady && objectKeyReady && contentHashReady && sizeReady,
	      providerReady,
	      objectKeyReady,
	      contentHashReady,
      sizeReady
    };
  }

  artifactDisplayLabel(type, metadata = {}) {
    if (metadata.label || metadata.title) return metadata.label || metadata.title;
    const labels = {
      'principle-diagram': '设计原理图',
      'construction-drawing': '2D 施工布局图',
      'bim-model': '3D / BIM 示意模型',
      bom: 'BOM 材料清单',
      'quantity-takeoff': '工程量清单',
      'standards-check': '标准校核报告',
      'customer-report': '客户深化报告',
      'concept-effect-view': '方案效果图'
    };
    return labels[type] || type;
  }

  customerEngineeringTraceability(artifact = {}) {
    const traceability = artifact.metadata?.visualTraceability || artifact.metadata?.traceability || null;
    if (!traceability) return null;
    const systemNodes = Array.isArray(traceability.systemNodes) ? traceability.systemNodes : [];
    return {
      traceabilityId: traceability.traceabilityId || null,
      sourceHash: traceability.sourceHash || null,
      tier: traceability.tier || null,
      project: traceability.project
        ? {
            name: traceability.project.name,
            area: traceability.project.area,
            city: traceability.project.city,
            houseType: traceability.project.houseType
          }
        : null,
      systemCount: Number(traceability.systemCount || systemNodes.length || 0),
      systemNodes: systemNodes.map(node => ({
        nodeId: node.nodeId,
        sourceSystemId: node.sourceSystemId,
        type: node.type,
        name: node.name,
        drawingRefs: {
          principleDiagramNode: node.drawingRefs?.principleDiagramNode || null,
          layoutDeviceNode: node.drawingRefs?.layoutDeviceNode || null,
          scene3dDeviceNode: node.drawingRefs?.scene3dDeviceNode || null
        }
      })),
      visualArtifacts: {
        principleDiagram: traceability.visualArtifacts?.principleDiagram || 'principle-diagram',
        layout2d: traceability.visualArtifacts?.layout2d || 'construction-drawing',
        scene3d: traceability.visualArtifacts?.scene3d || 'bim-model'
      },
      standardsRefs: Array.isArray(traceability.standardsRefs) ? traceability.standardsRefs : [],
      handoffBoundary: traceability.handoffBoundary || 'lifecycle_handoff_only',
      realtimeControl: false
    };
  }

  engineeringTraceabilityManifest({
    projectId,
    tier,
    visualArtifacts = [],
    deliverableArtifacts = [],
    quoteCostSummary = null,
    standardsSummary = null,
    standardsCoverage = null,
    lifecycleHandoff = null
  } = {}) {
    const visualTraceability = visualArtifacts
      .map(artifact => this.customerEngineeringTraceability(artifact))
      .find(Boolean);
    const artifacts = [...visualArtifacts, ...deliverableArtifacts].filter(Boolean);
    const artifactRefs = artifacts.map(artifact => ({
      artifactId: String(artifact.id || artifact._id || artifact.objectKey),
      type: artifact.type,
      version: Number(artifact.version || 1),
      objectKey: artifact.objectKey || null,
      contentHash: artifact.contentHash || null,
      role: this.artifactFileRole(artifact.type, artifact.metadata || {}),
      customerVisible: artifact.permissions?.customerVisible === true
    }));
    const bomArtifact = deliverableArtifacts.find(item => item?.type === 'bom');
    const bomSummary = bomArtifact?.metadata?.bomSummary || null;
    const quantityArtifact = deliverableArtifacts.find(item => item?.type === 'quantity-takeoff');
    const standardsArtifact = deliverableArtifacts.find(item => item?.type === 'standards-check');
    const reportArtifact = deliverableArtifacts.find(item => item?.type === 'customer-report');
    const systemQuoteExplanations = quoteCostSummary?.systemQuoteExplanations || [];
    const itemTraceability = systemQuoteExplanations.map(item => ({
      systemFamily: item.systemFamily,
      systemName: item.systemName,
      itemIds: item.itemIds || [],
      standardsDomains: item.standardsDomains || [],
      quoteDrivers: item.quoteDrivers || [],
      deliverableEvidence: item.deliverableEvidence || [],
      lifecycleHandoffImpact: item.lifecycleHandoffImpact || [],
      customerSafeExplanation: item.customerSafeExplanation
    }));
    const manifestHash = this.createHash({
      projectId,
      tier,
      traceabilityId: visualTraceability?.traceabilityId || null,
      artifactRefs: artifactRefs.map(item => ({
        type: item.type,
        version: item.version,
        contentHash: item.contentHash
      })),
      standardsCoverageStatus: standardsCoverage?.status || null,
      quotationNo: quoteCostSummary?.quotationSummary?.quotationNo || null
    });

    return {
      manifestId: `rysnova-bim-trace-${manifestHash.replace(/^sha256:/, '').slice(0, 16)}`,
      projectId,
      tier,
      traceability: visualTraceability || null,
      artifactRefs,
      visualArtifactTypes: visualArtifacts.map(item => item.type),
      deliverableArtifactTypes: deliverableArtifacts.map(item => item.type),
      linkedArtifacts: {
        principleDiagram: artifactRefs.find(item => item.type === 'principle-diagram') || null,
        layout2d: artifactRefs.find(item => item.type === 'construction-drawing') || null,
        scene3d: artifactRefs.find(item => item.type === 'bim-model') || null,
        bom: artifactRefs.find(item => item.type === 'bom') || null,
        quantityTakeoff: artifactRefs.find(item => item.type === 'quantity-takeoff') || null,
        standardsCheck: artifactRefs.find(item => item.type === 'standards-check') || null,
        customerReport: artifactRefs.find(item => item.type === 'customer-report') || null
      },
      drawingToCommercialLinks: itemTraceability,
      commercialTraceability: {
        quotationNo: quoteCostSummary?.quotationSummary?.quotationNo || null,
        itemCount: Number(bomSummary?.itemCount || 0),
        systemCount: Number(bomSummary?.systemCount || itemTraceability.length || 0),
        systemFamilies: bomSummary?.systemFamilies || itemTraceability.map(item => item.systemFamily).filter(Boolean),
        quoteStatus: quoteCostSummary?.quotationSummary?.status || null,
        commercialApprovalStatus: quoteCostSummary?.marginGuard?.status || null,
        internalCostHiddenFromCustomer: true
      },
      standardsTraceability: {
        summary: standardsSummary || null,
        coverage: standardsCoverage || null,
        impact: quoteCostSummary?.standardsCoverageImpact || null,
        standardsArtifactId: standardsArtifact ? String(standardsArtifact.id || standardsArtifact._id || standardsArtifact.objectKey) : null
      },
      lifecycleTraceability: {
        handoffBoundary: lifecycleHandoff?.handoffBoundary || 'lifecycle_handoff_only',
        realtimeControl: false,
        assetCount: Number(lifecycleHandoff?.assetCount || 0),
        assetIds: Array.isArray(lifecycleHandoff?.assets) ? lifecycleHandoff.assets.map(asset => asset.assetId).filter(Boolean) : [],
        lifecycleHandoffImpact: quoteCostSummary?.standardsCoverageImpact?.lifecycleHandoffImpact || []
      },
      deliverableEvidence: {
        bomArtifactId: bomArtifact ? String(bomArtifact.id || bomArtifact._id || bomArtifact.objectKey) : null,
        quantityTakeoffArtifactId: quantityArtifact ? String(quantityArtifact.id || quantityArtifact._id || quantityArtifact.objectKey) : null,
        customerReportArtifactId: reportArtifact ? String(reportArtifact.id || reportArtifact._id || reportArtifact.objectKey) : null
      },
      boundary: {
        customerSafe: true,
        lifecycleHandoffOnly: true,
        realtimeControl: false,
        internalCostHiddenFromCustomer: true
      },
      generatedAt: this.now().toISOString()
    };
  }

  artifactFileRole(type, metadata = {}) {
    if (metadata.drawingType === 'layout-2d') return 'layout-2d';
    const roles = {
      'principle-diagram': 'principle-diagram',
      'construction-drawing': 'construction-drawing',
      'bim-model': 'bim-or-3d-preview',
      bom: 'commercial-bom',
      'quantity-takeoff': 'quantity-takeoff',
      'standards-check': 'standards-compliance',
      'customer-report': 'customer-report',
      'concept-effect-view': 'concept-effect-view'
    };
    return roles[type] || 'artifact';
  }

  artifactDownloadDescriptor(artifact = {}, { customerSafe = false } = {}) {
    const metadata = artifact.metadata || {};
    const storage = metadata.storage || {};
    const qualityGate = this.artifactQualityGate(artifact);
    const visualQualityEvidence = VISUAL_ARTIFACT_TYPES.has(artifact.type)
      ? this.visualQualityEvidenceForArtifact(artifact)
      : null;
    const integrityPassed = storage.integrityPassed === true || metadata.integrity?.passed === true;
    const downloadReady = Boolean(
      artifact.objectKey &&
      artifact.contentHash &&
      storage.provider &&
      Number(storage.sizeBytes || 0) > 0 &&
      integrityPassed &&
      (customerSafe ? qualityGate.passed === true : true)
    );
    return {
      artifactId: String(artifact.id || artifact._id || artifact.objectKey),
      type: artifact.type,
      label: this.artifactDisplayLabel(artifact.type, metadata),
      fileRole: this.artifactFileRole(artifact.type, metadata),
      version: Number(artifact.version || 1),
      status: artifact.status,
      objectKey: artifact.objectKey || null,
      contentHash: artifact.contentHash || null,
      contentType: storage.contentType || metadata.contentType || null,
      sizeBytes: Number(storage.sizeBytes || 0),
      provider: storage.provider || null,
      integrityPassed,
      downloadReady,
      qualityStatus: qualityGate.status,
	      signoffStatus: CUSTOMER_VISIBLE_STATUSES.has(artifact.status) && artifact.permissions?.customerVisible === true
	        ? 'customer-visible'
	        : 'internal-review',
	      visualQualityEvidence: customerSafe ? visualQualityEvidence : null,
	      engineeringTraceability: customerSafe ? this.customerEngineeringTraceability(artifact) : null,
	      updatedAt: storage.updatedAt || artifact.updatedAt || artifact.createdAt || null,
      blockers: downloadReady ? [] : qualityGate.blockers
    };
  }

  buildDownloadManifest(artifacts = [], options = {}) {
    const items = artifacts.map(artifact => this.artifactDownloadDescriptor(artifact, options));
    const readyItems = items.filter(item => item.downloadReady === true);
    return {
      ready: items.length > 0 && readyItems.length === items.length,
      count: items.length,
      readyCount: readyItems.length,
      blockedCount: items.length - readyItems.length,
      items,
      generatedAt: this.now().toISOString()
    };
  }

	  buildStorageIntegrityTodo(latestByType = {}) {
	    const todos = [];

    for (const type of DEEPENING_REQUIRED_TYPES) {
	      const artifact = latestByType[type];
	      if (!artifact) continue;
	      const artifactId = artifact.id || artifact._id || artifact.objectKey;
	      const hasStorageMetadata = Boolean(artifact.metadata?.storage);
	      const storageReadiness = this.artifactStorageReadiness(artifact);
	      const integrityPassed = artifact.metadata?.integrity?.passed === true ||
	        artifact.metadata?.storage?.integrityPassed === true;
	      if (!hasStorageMetadata) {
        todos.push({
          artifactId,
          type,
          reason: 'missing-storage-metadata',
	          requiredBefore: 'production-handoff'
	        });
	      }
	      if (hasStorageMetadata && !storageReadiness.storageReady) {
	        todos.push({
	          artifactId,
	          type,
	          reason: 'incomplete-storage-evidence',
	          checks: storageReadiness,
	          requiredBefore: 'production-handoff'
	        });
	      }
	      if (
	        !integrityPassed &&
	        (artifact.permissions?.customerVisible === true || artifact.status === 'shared')
      ) {
        todos.push({
          artifactId,
          type,
          reason: 'verify-object-integrity-before-customer-access',
          requiredBefore: 'customer-download'
        });
      }
    }

    return todos;
  }

  firstMetadataValue(artifacts = [], keys = []) {
    for (const artifact of artifacts) {
      for (const key of keys) {
        if (artifact?.metadata && Object.prototype.hasOwnProperty.call(artifact.metadata, key)) {
          return artifact.metadata[key];
        }
      }
    }
    return null;
  }

  buildVisualReadiness(latestByType = {}) {
    const requirements = {};
    const missingVisuals = [];
    const approvalMissingVisuals = [];
    const storageMissingVisuals = [];
    const qualityMissingVisuals = [];
    const qualityFailedVisuals = [];

    for (const requirement of DEEPENING_VISUAL_REQUIREMENTS) {
      const artifact = latestByType[requirement.artifactType];
      const summary = this.artifactSummary(artifact);
      const qualityEvidence = this.visualQualityEvidenceForArtifact(artifact);
      const qualityReady = qualityEvidence?.passed === true;
      const ready = Boolean(
        artifact &&
        CUSTOMER_VISIBLE_STATUSES.has(artifact.status) &&
        artifact.metadata?.storage &&
        qualityReady
      );

      requirements[requirement.key] = {
        ...requirement,
        artifact: summary,
        qualityEvidence,
        ready
      };

      if (!artifact) {
        missingVisuals.push(requirement.key);
      } else {
        if (!CUSTOMER_VISIBLE_STATUSES.has(artifact.status)) approvalMissingVisuals.push(requirement.key);
        if (!artifact.metadata?.storage) storageMissingVisuals.push(requirement.key);
        if (!qualityEvidence) {
          qualityMissingVisuals.push(requirement.key);
        } else if (qualityEvidence.passed !== true) {
          qualityFailedVisuals.push({
            key: requirement.key,
            artifactType: requirement.artifactType,
            artifactId: String(artifact.id || artifact._id || artifact.objectKey),
            blockers: qualityEvidence.blockers || []
          });
        }
      }
    }

    return {
      requiredVisuals: DEEPENING_VISUAL_REQUIREMENTS.map(item => ({
        key: item.key,
        label: item.label,
        artifactType: item.artifactType
      })),
      requirements,
      missingVisuals,
      approvalMissingVisuals,
      storageMissingVisuals,
      qualityMissingVisuals,
      qualityFailedVisuals,
      ready: missingVisuals.length === 0 &&
        approvalMissingVisuals.length === 0 &&
        storageMissingVisuals.length === 0 &&
        qualityMissingVisuals.length === 0 &&
        qualityFailedVisuals.length === 0
    };
  }

  buildCommercialReadiness(latestByType = {}) {
    const bom = latestByType.bom;
    const quantityTakeoff = latestByType['quantity-takeoff'];
    const customerReport = latestByType['customer-report'];
    const bomSummary = bom?.metadata?.bomSummary || bom?.metadata?.summary || null;
    const quantityTakeoffSummary = quantityTakeoff?.metadata?.quantityTakeoffSummary ||
      quantityTakeoff?.metadata?.summary ||
      null;
    const quoteCostSummary = this.firstMetadataValue([bom, customerReport, quantityTakeoff], [
      'quoteCostSummary',
      'quotationSummary',
      'quoteSummary',
      'commercialSummary'
    ]);
    const quotationSummary = quoteCostSummary?.quotationSummary || quoteCostSummary || null;
    const costBreakdown = quoteCostSummary?.costBreakdown ||
      quoteCostSummary?.cost ||
      bomSummary?.costBreakdown ||
      null;
    const marginGuard = quoteCostSummary?.marginGuard || bomSummary?.marginGuard || null;
    const blockers = [];

    if (!bom) blockers.push({ code: 'missing-bom-artifact', message: 'BOM artifact is required before quotation and procurement.' });
    if (!bomSummary) blockers.push({ code: 'missing-bom-summary', message: 'BOM summary is required for item count and cost traceability.' });
    if (!quantityTakeoff) blockers.push({ code: 'missing-quantity-takeoff-artifact', message: 'Quantity takeoff artifact is required before engineering cost validation.' });
    if (!quantityTakeoffSummary) blockers.push({ code: 'missing-quantity-takeoff-summary', message: 'Quantity takeoff summary is required for pipe/material/labor validation.' });
    if (!quotationSummary) blockers.push({ code: 'missing-quotation-summary', message: 'Quotation summary is required before customer signoff.' });
    if (!costBreakdown) blockers.push({ code: 'missing-cost-breakdown', message: 'Cost breakdown is required before margin and approval control.' });
    if (!marginGuard) {
      blockers.push({ code: 'missing-margin-guard', message: 'Margin guard is required before dealer quote release.' });
    } else if (['blocked', 'rejected'].includes(marginGuard.status)) {
      blockers.push({ code: 'margin-guard-blocked', message: 'Margin guard blocks customer release.', status: marginGuard.status });
    }

    return {
      ready: blockers.length === 0,
      blockers,
      bomSummary,
      quantityTakeoffSummary,
      quoteCostSummary,
      quotationSummary,
      costBreakdown,
      marginGuard
    };
  }

  buildCustomerSignoffReadiness(latestByType = {}, visualReadiness, commercialReadiness, standardsSummary) {
    const missingTypes = [];
    const approvalMissingTypes = [];
    const customerVisibilityMissingTypes = [];
    const storageMissingTypes = [];
    const blockers = [];

    for (const type of CUSTOMER_SIGNOFF_REQUIRED_TYPES) {
      const artifact = latestByType[type];
      if (!artifact) {
        missingTypes.push(type);
        continue;
      }
      if (!CUSTOMER_VISIBLE_STATUSES.has(artifact.status)) approvalMissingTypes.push(type);
      if (artifact.permissions?.customerVisible !== true) customerVisibilityMissingTypes.push(type);
      if (!artifact.metadata?.storage) storageMissingTypes.push(type);
    }

    if (!visualReadiness.ready) blockers.push({ code: 'visual-package-not-ready', message: 'Three customer-facing visuals are not ready.' });
    if (!commercialReadiness.ready) blockers.push({ code: 'commercial-quote-cost-not-ready', message: 'BOM, quantity takeoff, quote, cost, and margin guard are not ready.' });
    if (!standardsSummary.passed) blockers.push({ code: 'standards-blocking-failure', message: 'Standards check contains failed items.' });
    for (const type of missingTypes) blockers.push({ code: 'missing-customer-signoff-artifact', type });
    for (const type of approvalMissingTypes) blockers.push({ code: 'customer-signoff-artifact-not-approved', type });
    for (const type of customerVisibilityMissingTypes) blockers.push({ code: 'customer-signoff-artifact-not-visible', type });
    for (const type of storageMissingTypes) blockers.push({ code: 'customer-signoff-artifact-missing-storage', type });

    return {
      requiredTypes: CUSTOMER_SIGNOFF_REQUIRED_TYPES,
      missingTypes,
      approvalMissingTypes,
      customerVisibilityMissingTypes,
      storageMissingTypes,
      blockers,
      ready: blockers.length === 0
    };
  }

  buildEvidenceGaps({
    missingTypes = [],
    approvalMissingTypes = [],
    standardsSummary,
    storageIntegrityTodo = [],
    visualReadiness,
    commercialReadiness,
    installedAssetHandoff,
    customerSignoff
  }) {
    const gaps = [];

    for (const type of missingTypes) gaps.push({ area: 'engineering-artifact', code: 'missing-artifact', type });
    for (const type of approvalMissingTypes) gaps.push({ area: 'engineering-approval', code: 'missing-approval', type });
    for (const failure of standardsSummary.blockingFailures || []) {
      gaps.push({
        area: 'standards',
        code: 'standard-failed',
        artifactId: failure.artifactId,
        type: failure.type,
        standardCode: failure.code,
        level: failure.level,
        edition: failure.edition,
        note: failure.note
      });
    }
    for (const todo of storageIntegrityTodo) {
      gaps.push({ area: 'object-storage', code: todo.reason, type: todo.type, artifactId: todo.artifactId, requiredBefore: todo.requiredBefore });
    }
    for (const key of visualReadiness.missingVisuals || []) gaps.push({ area: 'visual-package', code: 'missing-visual', visual: key });
    for (const key of visualReadiness.approvalMissingVisuals || []) gaps.push({ area: 'visual-package', code: 'visual-not-approved', visual: key });
    for (const key of visualReadiness.storageMissingVisuals || []) gaps.push({ area: 'visual-package', code: 'visual-missing-storage', visual: key });
    for (const key of visualReadiness.qualityMissingVisuals || []) gaps.push({ area: 'visual-package', code: 'visual-quality-evidence-missing', visual: key });
    for (const failure of visualReadiness.qualityFailedVisuals || []) {
      gaps.push({
        area: 'visual-package',
        code: 'visual-quality-failed',
        visual: failure.key,
        type: failure.artifactType,
        artifactId: failure.artifactId,
        blockers: failure.blockers || []
      });
    }
    for (const blocker of commercialReadiness.blockers || []) gaps.push({ area: 'commercial-readiness', ...blocker });
    for (const blocker of installedAssetHandoff?.blockers || []) gaps.push({ area: 'installed-asset-handoff', ...blocker });
    for (const blocker of customerSignoff.blockers || []) gaps.push({ area: 'customer-signoff', ...blocker });

    return gaps;
  }

  buildNextActions(evidenceGaps = []) {
    const actions = [];
    const hasCode = code => evidenceGaps.some(item => item.code === code);
    const hasArea = area => evidenceGaps.some(item => item.area === area);

    if (hasCode('missing-artifact')) actions.push('Generate missing Rysnova artifacts before engineering handoff.');
    if (hasArea('visual-package')) actions.push('Complete and approve the principle diagram, 2D layout, and 3D illustration.');
    if (hasArea('commercial-readiness')) actions.push('Connect BOM, quantity takeoff, quotation, cost breakdown, and margin guard before customer signoff.');
    if (hasArea('installed-asset-handoff')) actions.push('Prepare installed-asset handoff manifest for lifecycle IoT customer care.');
    if (hasArea('standards')) actions.push('Resolve failed standards checks and rerun engineering review.');
    if (hasArea('object-storage')) actions.push('Upload artifacts to production object storage and verify content hashes.');
    if (hasArea('customer-signoff')) actions.push('Prepare customer-visible report, BOM, and diagram package for signoff.');

    return [...new Set(actions)];
  }

  async buildDeepeningPackage(scope, projectId) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for Rysnova deepening package operations');
      err.status = 403;
      throw err;
    }
    if (!projectId) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }

    const result = await this.listArtifacts(scope, { projectId, limit: 100 });
    const artifacts = result.items || [];
    const latestByType = this.latestArtifactsByType(artifacts);
    const customerSignoffLatestByType = this.latestCustomerSignoffArtifactsByType(artifacts);
    const readinessByType = {
      ...latestByType,
      ...customerSignoffLatestByType
    };
    const missingTypes = DEEPENING_REQUIRED_TYPES.filter(type => !readinessByType[type]);
    const approvalMissingTypes = DEEPENING_REQUIRED_TYPES.filter(type => {
      if (!DEEPENING_APPROVAL_REQUIRED_TYPES.has(type)) return false;
      const artifact = readinessByType[type];
      return !artifact || !CUSTOMER_VISIBLE_STATUSES.has(artifact.status);
    });
    const customerVisibleArtifacts = artifacts.filter(item => (
      CUSTOMER_VISIBLE_STATUSES.has(item.status) &&
      item.permissions?.customerVisible === true
    ));
	    const standardsSummary = this.summarizeStandards(readinessByType);
    const standardsCoverage = this.summarizeStandardsCoverage(readinessByType);
	    const storageIntegrityTodo = this.buildStorageIntegrityTodo(readinessByType);
    const visualReadiness = this.buildVisualReadiness(readinessByType);
    const commercialReadiness = this.buildCommercialReadiness(readinessByType);
    const installedAssetHandoff = this.buildInstalledAssetHandoffReadiness(commercialReadiness);
    const engineeringTraceabilityManifest = this.engineeringTraceabilityManifest({
      projectId,
      tier: commercialReadiness.quotationSummary?.tier || null,
      visualArtifacts: [
        readinessByType['principle-diagram'],
        readinessByType['construction-drawing'],
        readinessByType['bim-model']
      ].filter(Boolean),
      deliverableArtifacts: [
        readinessByType.bom,
        readinessByType['quantity-takeoff'],
        readinessByType['standards-check'],
        readinessByType['customer-report']
      ].filter(Boolean),
      quoteCostSummary: commercialReadiness.quoteCostSummary,
      standardsSummary,
      standardsCoverage,
      lifecycleHandoff: installedAssetHandoff.manifest
    });
    const customerSignoff = this.buildCustomerSignoffReadiness(
      readinessByType,
      visualReadiness,
      commercialReadiness,
      standardsSummary
    );
    const qualityGateSummary = this.buildQualityGateSummary(readinessByType);
    const requiredArtifacts = {};

    for (const type of DEEPENING_REQUIRED_TYPES) {
      requiredArtifacts[type] = this.artifactSummary(latestByType[type]);
    }
    const downloadManifest = this.buildDownloadManifest(
      DEEPENING_REQUIRED_TYPES.map(type => readinessByType[type]).filter(Boolean),
      { customerSafe: true }
    );

	    const handoffReady = (
	      missingTypes.length === 0 &&
	      approvalMissingTypes.length === 0 &&
	      standardsSummary.passed &&
	      storageIntegrityTodo.length === 0 &&
	      visualReadiness.ready &&
      commercialReadiness.ready &&
	      customerSignoff.ready &&
	      installedAssetHandoff.ready &&
	      qualityGateSummary.passed
	    );
    const engineeringReadiness = {
      ready: handoffReady,
      requiredTypes: DEEPENING_REQUIRED_TYPES,
      missingTypes,
	      approvalMissingTypes,
	      standardsPassed: standardsSummary.passed,
	      storageReady: storageIntegrityTodo.length === 0
	    };
    const evidenceGaps = this.buildEvidenceGaps({
      missingTypes,
      approvalMissingTypes,
      standardsSummary,
      storageIntegrityTodo,
      visualReadiness,
      commercialReadiness,
      installedAssetHandoff,
      customerSignoff
    });

    return {
      projectId,
      tenantId: scope.tenantId,
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      requiredTypes: DEEPENING_REQUIRED_TYPES,
      missingTypes,
      approvalMissingTypes,
      handoffReady,
      status: handoffReady ? 'handoff-ready' : 'blocked-or-in-progress',
      engineeringReadiness,
      visualReadiness,
      commercialReadiness,
      installedAssetReadiness: {
        ready: installedAssetHandoff.ready,
        blockers: installedAssetHandoff.blockers
      },
      customerSignoff,
      requiredArtifacts,
      customerVisibleArtifacts,
	      customerVisibleCount: customerVisibleArtifacts.length,
	      standardsSummary,
      standardsCoverage,
	      qualityGateSummary,
      downloadManifest,
      storageIntegrityTodo,
      engineeringTraceabilityManifest,
      evidenceGaps,
      nextActions: this.buildNextActions(evidenceGaps),
      bomSummary: commercialReadiness.bomSummary,
      quantityTakeoffSummary: commercialReadiness.quantityTakeoffSummary,
      quoteCostSummary: commercialReadiness.quoteCostSummary,
      installedAssetHandoff: installedAssetHandoff.manifest,
      generatedAt: new Date().toISOString()
    };
  }

  buildInstalledAssetHandoffReadiness(commercialReadiness = {}) {
    const manifest = commercialReadiness.quoteCostSummary?.installedAssetHandoff || null;
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    const blockers = [];
    if (!manifest) {
      blockers.push({ code: 'missing-installed-asset-handoff', message: 'Installed asset handoff manifest is required for lifecycle IoT bridge.' });
    } else {
      if (manifest.handoffBoundary !== 'lifecycle_handoff_only') {
        blockers.push({ code: 'invalid-iot-handoff-boundary', message: 'Rysnova handoff must remain lifecycle_handoff_only.' });
      }
      if (manifest.realtimeControl !== false || assets.some(asset => asset.iotBinding?.realtimeControl !== false)) {
        blockers.push({ code: 'realtime-control-not-allowed', message: 'Rysnova package may hand off lifecycle assets only, never realtime control.' });
      }
      if (!assets.length || manifest.assetCount !== assets.length) {
        blockers.push({ code: 'missing-installed-assets', message: 'Installed asset handoff must include one asset per system family instance.' });
      }
      for (const asset of assets) {
        if (!asset.assetId || !asset.systemFamily || !asset.brand || !asset.model || asset.iotBinding?.status !== 'handoff-ready-not-bound') {
          blockers.push({ code: 'installed-asset-incomplete', assetId: asset.assetId || null, systemFamily: asset.systemFamily || null });
        }
      }
    }

    return {
      ready: blockers.length === 0,
      blockers,
      manifest
    };
  }

  getMemoryArtifacts() {
    this.memoryDb.rysnovaBimArtifacts = this.memoryDb.rysnovaBimArtifacts || [];
    return this.memoryDb.rysnovaBimArtifacts;
  }

  createMemoryArtifactFromPayload(payload) {
    const artifacts = this.getMemoryArtifacts();
    const indexes = this.ensureMemoryIndexes();
    const item = {
      id: `ART-${String(artifacts.length + 1).padStart(4, '0')}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'memory'
    };
    artifacts.push(item);
    this.indexMemoryArtifact(item, indexes);
    return item;
  }

  createMemoryArtifact(scope, data) {
    return this.createMemoryArtifactFromPayload(this.normalizeArtifact(scope, data));
  }

  async approveMemoryArtifact(scope, artifactId, data = {}) {
    const artifact = this.findMemoryArtifactById(scope, artifactId);
    if (!artifact) {
      const err = new Error('Rysnova artifact not found');
      err.status = 404;
      throw err;
    }
    let integrity = null;
    if (data.shareToCustomer || data.customerVisible === true) {
      integrity = await this.verifyArtifactIntegrity(scope, artifactId, artifact);
      if (!integrity.passed) {
        const err = new Error('Rysnova artifact storage integrity check failed');
        err.status = 409;
        err.details = integrity;
        throw err;
      }
    }
    artifact.status = data.shareToCustomer ? 'shared' : 'approved';
    artifact.approvedBy = scope.userId;
    artifact.approvedAt = data.approvedAt || new Date().toISOString();
    artifact.permissions = {
      ...artifact.permissions,
      customerVisible: data.shareToCustomer ? true : Boolean(data.customerVisible ?? artifact.permissions?.customerVisible)
    };
    if (integrity) {
      artifact.metadata = {
        ...(artifact.metadata || {}),
        integrity: {
          passed: integrity.passed,
          checkedAt: integrity.checkedAt,
          actualContentHash: integrity.actualContentHash,
          expectedContentHash: integrity.expectedContentHash
        },
        storage: {
          ...(artifact.metadata?.storage || {}),
          integrityPassed: integrity.passed,
          integrityCheckedAt: integrity.checkedAt
        }
      };
    }
    artifact.updatedAt = new Date().toISOString();
    return artifact;
  }
}

module.exports = RysnovaArtifactService;
module.exports.ARTIFACT_TYPES = ARTIFACT_TYPES;
module.exports.DEEPENING_REQUIRED_TYPES = DEEPENING_REQUIRED_TYPES;
module.exports.DEEPENING_VISUAL_REQUIREMENTS = DEEPENING_VISUAL_REQUIREMENTS;
