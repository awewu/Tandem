const { attachLazyRuntime, createLazyEngine } = require('./lazyEngine');
const SolutionVisualPackageService = require('./solution-visuals/solution-visual-package.service');

class NoopRuntimeService {
  constructor(name) {
    this.name = name;
    this.status = 'not_started';
  }

  start() {
    this.status = 'not_started';
    return this;
  }

  initialize() {
    this.status = 'not_started';
    return true;
  }

  startScheduledBackups() {
    this.status = 'not_started';
  }

  getBackupList() {
    return [];
  }

  async createBackup(data = {}, options = {}) {
    return {
      id: `noop-backup-${Date.now()}`,
      status: 'skipped',
      data,
      options
    };
  }

  async restoreBackup(backupId) {
    return {
      success: false,
      status: 'skipped',
      backupId
    };
  }

  getStats() {
    return {
      status: 'not_started',
      runtimeProfile: 'safe'
    };
  }

  healthCheck() {
    return {
      status: 'not_started',
      runtimeProfile: 'safe'
    };
  }
}

function createEvolutionFacade() {
  return {
    getEvolutionStatus() {
      return {
        currentRound: 0,
        targetRounds: 0,
        progress: 0,
        lastScore: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        interruptedTasks: 0,
        completedTasks: 0,
        runtimeProfile: 'safe'
      };
    },
    runFullSelfCheck() {
      return {
        score: 0,
        checks: {},
        issues: [],
        runtimeProfile: 'safe'
      };
    },
    async runClosedLoopImprovement(checkResult) {
      return {
        success: false,
        status: 'skipped',
        checkResult,
        runtimeProfile: 'safe'
      };
    },
    async runEvolution() {
      return {
        completedRounds: [],
        status: 'skipped',
        runtimeProfile: 'safe'
      };
    }
  };
}

function createEnterpriseLoopFacade() {
  return {
    scenarios: [],
    async runEnterpriseLoop(scenario) {
      return {
        success: false,
        status: 'skipped',
        scenario,
        runtimeProfile: 'safe'
      };
    },
    async runBatch(count = 0) {
      return {
        count,
        success: false,
        status: 'skipped',
        runtimeProfile: 'safe'
      };
    },
    getRoleDashboard(role) {
      return {
        role,
        status: 'not_started',
        runtimeProfile: 'safe'
      };
    },
    healthCheck() {
      return {
        status: 'not_started',
        runtimeProfile: 'safe'
      };
    }
  };
}

function createSafeRuntimeStubs() {
  const dataBackup = new NoopRuntimeService('dataBackup');
  return {
    monitoring: new NoopRuntimeService('monitoring'),
    dataBackup,
    dataBackupRestore: dataBackup,
    mqttBroker: new MqttBrokerEngineFacade(),
    ragKnowledgeBase: new NoopRuntimeService('ragKnowledgeBase'),
    yjsCollaboration: new NoopRuntimeService('yjsCollaboration'),
    enterpriseLoop: createEnterpriseLoopFacade(),
    evolution: createEvolutionFacade(),
    selfCheckOrchestrator: null,
    agentCoordinator: null,
    workflowOrchestrator: null
  };
}

class MqttBrokerEngineFacade extends NoopRuntimeService {
  constructor() {
    super('mqttBroker');
    this.devices = new Map();
  }

  getDevices() {
    return [];
  }

  sendControlCommand(deviceId, command) {
    return {
      success: false,
      status: 'skipped',
      deviceId,
      command
    };
  }
}

function lazyClassEngine(name, modulePath, options = {}) {
  return createLazyEngine(name, () => {
    const EngineClass = require(modulePath);
    return new EngineClass();
  }, options);
}

function lazyClassEngineWithArgs(name, modulePath, argsFactory, options = {}) {
  return createLazyEngine(name, () => {
    const EngineClass = require(modulePath);
    return new EngineClass(...argsFactory());
  }, options);
}

function lazyNamedClassEngine(name, modulePath, exportName, options = {}) {
  return createLazyEngine(name, () => {
    const moduleExports = require(modulePath);
    const EngineClass = moduleExports[exportName];
    return new EngineClass();
  }, options);
}

function lazySingletonEngine(name, modulePath, options = {}) {
  return createLazyEngine(name, () => require(modulePath), options);
}

function runtimeClassFactory(modulePath) {
  return (...args) => {
    const RuntimeClass = require(modulePath);
    return new RuntimeClass(...args);
  };
}

function runtimeModuleFactory(modulePath) {
  return () => require(modulePath);
}

function createBaseProductionEngines() {
  const safeRuntime = createSafeRuntimeStubs();
  const engines = {
    loadCalc: lazyClassEngine('loadCalc', '../core/LoadCalculationEngine'),
    deviceSelect: lazyClassEngine('deviceSelect', '../core/DeviceSelectionEngine'),
    quotation: lazyClassEngine('quotation', '../core/QuotationEngine'),
    quotationV2: lazyClassEngine('quotationV2', '../core/QuotationEngine-v2'),
    calculation: lazyClassEngine('calculation', '../core/CalculationEngine'),
    oneClickCalculation: lazyClassEngine('oneClickCalculation', '../core/OneClickCalculationEngine'),
    calculationCache: lazyClassEngine('calculationCache', '../core/CalculationCache'),
    calculationPerformanceMonitor: lazyClassEngine('calculationPerformanceMonitor', '../core/PerformanceMonitor'),
    layout3D: lazyClassEngine('layout3D', '../core/Layout3DEngine'),
    drawing: lazyClassEngine('drawing', '../core/DrawingEngine'),
    renderer3D: lazyClassEngine('renderer3D', '../core/Renderer3DEngine'),
    drawingSvgRenderer: lazyClassEngine('drawingSvgRenderer', '../core/DrawingSVGRenderer'),
    reportGenerator: lazyClassEngine('reportGenerator', '../core/ReportGenerator'),
    threeTier: lazyClassEngine('threeTier', '../core/ThreeTierEngine'),
    heartbeatMonitor: lazyClassEngine('heartbeatMonitor', '../core/HeartbeatMonitor'),
    exportEngine: lazyClassEngine('exportEngine', '../core/ExportEngine'),
    analyticsEngine: lazyClassEngine('analyticsEngine', '../core/AnalyticsEngine'),
    aiDesignAssistant: lazyClassEngine('aiDesignAssistant', '../core/AIDesignAssistant'),
    hotWater: lazyClassEngine('hotWater', '../core/HotWaterEngine'),
    channelManagement: lazyClassEngine('channelManagement', '../core/ChannelManagementEngine'),
    fissionTracking: lazyClassEngine('fissionTracking', '../core/FissionTrackingEngine'),
    llmDiagnosis: lazyClassEngine('llmDiagnosis', '../core/LLMDiagnosisEngine'),
    industryPlatform: lazyClassEngine('industryPlatform', '../core/IndustryPlatformEngine'),
    smartBrain: lazyClassEngine('smartBrain', '../core/SmartBrainEngine'),
    iotPlatform: lazyClassEngine('iotPlatform', '../core/IoTPlatform'),
    digitalTwin: lazyClassEngine('digitalTwin', '../core/DigitalTwinEngine'),
    triEnergy: lazyClassEngine('triEnergy', '../core/TriEnergySystem'),
    aiScene: lazyClassEngine('aiScene', '../core/AISceneGenerator'),
    painDiagnosis: lazyClassEngine('painDiagnosis', '../core/PainPointDiagnosisEngineV3'),
    painMatching: lazyClassEngine('painMatching', '../core/PainPointMatchingEngine'),
    quickLock: lazyClassEngine('quickLock', '../core/QuickLockMode'),
    valueQuote: lazyClassEngine('valueQuote', '../core/ValueBasedQuotationEngine'),
    visuals: lazyClassEngine('visuals', '../core/CorePrincipleVisuals'),
    conditionalField: lazyClassEngine('conditionalField', '../core/ConditionalFieldEngine'),
    aiValidation: lazySingletonEngine('aiValidation', '../engines/AIValidationEngine'),
    versionControl: lazyClassEngine('versionControl', '../core/VersionControlEngine'),
    templateEngine: lazyClassEngine('templateEngine', '../engines/TemplateEngine'),
    aiValidationEngineNew: lazyClassEngine('aiValidationEngineNew', '../engines/AIValidationEngine'),
    econetPricing: lazyClassEngine('econetPricing', '../engines/EconetPricingEngine'),
    feedbackCollector: lazyClassEngine('feedbackCollector', '../core/FeedbackCollector'),
    monitoring: safeRuntime.monitoring,
    deployment: lazyClassEngine('deployment', '../core/DeploymentManager'),
    qualityAssurance: lazySingletonEngine('qualityAssurance', '../core/RiskBasedQualityAssurance'),
    workflowOrchestrator: lazyClassEngineWithArgs('workflowOrchestrator', '../core/WorkflowOrchestrator', () => [engines]),
    selfCheckOrchestrator: lazyClassEngineWithArgs('selfCheckOrchestrator', '../core/SelfCheckOrchestrator', () => [engines]),
    agentCoordinator: lazySingletonEngine('agentCoordinator', '../core/AgentCoordinator'),
    database: lazySingletonEngine('database', '../core/DatabasePersistenceEngine'),
    evolution: safeRuntime.evolution,
    technicalDelivery: lazyClassEngine('technicalDelivery', '../core/TechnicalDeliveryGenerator'),
    packagePurchaseFlow: lazyClassEngine('packagePurchaseFlow', '../core/PackagePurchaseFlow'),
    workflowEngine: lazyClassEngine('workflowEngine', '../core/WorkflowEngine'),
    dxfParserService: lazySingletonEngine('dxfParserService', '../services/DXFParserService'),
    llmServiceV2: lazyClassEngine('llmServiceV2', '../core/LLMServiceV2'),
    hourlyLoad: lazyClassEngine('hourlyLoad', '../core/HourlyLoadEngine'),
    hydraulicModeling: lazyClassEngine('hydraulicModeling', '../core/HydraulicModelingEngine'),
    i18nEngine: lazyClassEngine('i18nEngine', '../core/I18nEngine'),
    unitConverter: lazyClassEngine('unitConverter', '../core/UnitConverter'),
    currencyEngine: lazyClassEngine('currencyEngine', '../core/CurrencyEngine'),
    webhookEngine: lazyClassEngine('webhookEngine', '../core/WebhookEngine'),
    pluginSdk: lazyClassEngine('pluginSdk', '../core/PluginSDK'),
    promotion: lazyClassEngine('promotion', '../core/PromotionEngine'),
    marketing: lazyClassEngine('marketing', '../core/MarketingEngine'),
    dataBackup: safeRuntime.dataBackup,
    templateLibrary: lazyClassEngine('templateLibrary', '../core/TemplateLibrary'),
    cadRecognizer: lazyClassEngine('cadRecognizer', '../core/CADEntityRecognizer'),
    yjsCollaboration: safeRuntime.yjsCollaboration,
    cadImporter: lazyClassEngine('cadImporter', '../engines/CADImporterEngine'),
    legacyCadImporter: lazySingletonEngine('legacyCadImporter', '../core/CADImporter'),
    imageRecognition: lazySingletonEngine('imageRecognition', '../core/ImageRecognition'),
    floorPlanRecognition: lazyClassEngine('floorPlanRecognition', '../engines/FloorPlanRecognitionEngine'),
    mqttBroker: safeRuntime.mqttBroker,
    ragKnowledgeBase: safeRuntime.ragKnowledgeBase,
    collaborationSync: null,
    drawingWebSocketServer: null,
    templateLibraryEngine: lazyClassEngine('templateLibraryEngine', '../core/TemplateLibrary'),
    dataBackupRestore: safeRuntime.dataBackupRestore,
    aiAccuracyValidator: lazySingletonEngine('aiAccuracyValidator', '../engines/AIValidationEngine'),
    aiConsultant: lazyClassEngine('aiConsultant', '../core/AIConsultantEngine'),
    waterSystem: lazyNamedClassEngine('waterSystem', '../core/WaterSystemEngine', 'WaterSystemEngine'),
    heatingSystem: lazyNamedClassEngine('heatingSystem', '../core/HeatingSystemEngine', 'HeatingSystemEngine'),
    airConditioning: lazyNamedClassEngine('airConditioning', '../core/AirConditioningEngine', 'AirConditioningEngine'),
    fiveConstant: lazyNamedClassEngine('fiveConstant', '../core/FiveConstantEngine', 'FiveConstantEngine'),
    freshAirPro: lazyNamedClassEngine('freshAirPro', '../core/FreshAirProEngine', 'FreshAirProEngine'),
    hvac3DVisualization: lazyNamedClassEngine('hvac3DVisualization', '../core/HVAC3DVisualizationEngine', 'HVAC3DVisualizationEngine'),
    bimExport: lazyNamedClassEngine('bimExport', '../core/BIMExportEngine', 'BIMExportEngine'),
    pptExport: lazyClassEngine('pptExport', '../engines/PPTExportEngine'),
    rysnovaBimBIM: lazyClassEngine('rysnovaBimBIM', '../core/RysnovaBIMCore'),
    revitIntegration: lazyClassEngine('revitIntegration', '../core/RevitIntegrationEngine'),
    revitSync: lazyClassEngine('revitSync', '../core/RevitSyncService'),
    multiDiscipline: lazyClassEngine('multiDiscipline', '../core/MultiDisciplineEngine'),
    standardsLibrary: lazyClassEngine('standardsLibrary', '../core/ProfessionalStandardsLibrary'),
    closedLoop: lazyClassEngine('closedLoop', '../core/ClosedLoopEngine'),
    enterpriseLoop: safeRuntime.enterpriseLoop,
    location: lazyClassEngine('location', '../core/LocationService'),
    devicePositioning: lazyClassEngine('devicePositioning', '../core/DevicePositioningEngine'),
    doasCompliance: lazyClassEngine('doasCompliance', '../core/DOASComplianceEngine'),
    systemCoordination: lazyClassEngine('systemCoordination', '../core/SystemCoordinationEngine'),
    smartRouting: lazyClassEngine('smartRouting', '../core/SmartRoutingEngine'),
    reheatModule: lazyClassEngine('reheatModule', '../core/ReheatModuleEngine'),
    performanceMonitor: lazyClassEngine('performanceMonitor', '../core/PerformanceMonitorEngine'),
    cache: lazyClassEngine('cache', '../core/CacheEngine'),
    agencyAgent: lazyClassEngine('agencyAgent', '../core/AgencyAgentEngine'),
    houseTypeLibrary: lazyClassEngine('houseTypeLibrary', '../core/HouseTypeLibrary'),
    econetSystem: lazyClassEngine('econetSystem', '../engines/EconetEngine'),
    drawingSync: lazySingletonEngine('drawingSync', '../engines/DrawingSyncEngine'),
    solutionTemplate: lazySingletonEngine('solutionTemplate', '../engines/SolutionTemplateEngine'),
    dataBackupEngine: lazySingletonEngine('dataBackupEngine', '../engines/DataBackupEngine'),
    runtimeServiceFactories: {
      collaborationSync: runtimeClassFactory('../engines/CollaborationSyncEngine'),
      drawingWebSocketServer: runtimeClassFactory('../../websocket-server'),
      customerJourneyStore: runtimeClassFactory('../core/CustomerJourneyStore'),
      customerJourneyStoreMongo: runtimeClassFactory('../core/CustomerJourneyStoreMongo'),
      journeySimulator: runtimeModuleFactory('../services/JourneySimulator'),
      hourlyLoadEngine: runtimeClassFactory('../core/HourlyLoadEngine'),
      hydraulicModelingEngine: runtimeClassFactory('../core/HydraulicModelingEngine')
    },
    runtimeProfile: 'safe'
  };

  return attachLazyRuntime(engines);
}

function createFullProductionEngines() {
  const engines = createBaseProductionEngines();
  engines.monitoring = lazyClassEngine('monitoring', '../core/MonitoringSystem', { runtimeProfile: 'full' });
  engines.evolution = lazySingletonEngine('evolution', '../core/EvolutionMechanism', { runtimeProfile: 'full' });
  engines.dataBackup = lazyClassEngine('dataBackup', '../core/DataBackupScheduler', { runtimeProfile: 'full' });
  engines.yjsCollaboration = lazyClassEngine('yjsCollaboration', '../engines/YjsCollaborationEngine', { runtimeProfile: 'full' });
  engines.mqttBroker = lazyClassEngine('mqttBroker', '../engines/MqttBrokerEngine', { runtimeProfile: 'full' });
  engines.ragKnowledgeBase = lazyClassEngine('ragKnowledgeBase', '../engines/RAGKnowledgeBaseEngine', { runtimeProfile: 'full' });
  engines.dataBackupRestore = lazyClassEngine('dataBackupRestore', '../core/DataBackupScheduler', { runtimeProfile: 'full' });
  engines.enterpriseLoop = lazyClassEngine('enterpriseLoop', '../core/EnterpriseClosedLoopEngine', { runtimeProfile: 'full' });
  engines.runtimeProfile = 'full';
  return engines;
}

function createProductionEngines(options = {}) {
  const runtimeProfile = options.runtimeProfile || options.profile || 'safe';
  if (runtimeProfile === 'full') return createFullProductionEngines();
  return createBaseProductionEngines();
}

module.exports = {
  createProductionEngines,
  createFullProductionEngines
};
