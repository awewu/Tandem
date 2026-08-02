const { attachLazyRuntime, createLazyEngine } = require('./lazyEngine');

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

function createSafeRuntimeStubs() {
  return {
    monitoring: new NoopRuntimeService('monitoring')
  };
}

function lazyClassEngine(name, modulePath, options = {}) {
  return createLazyEngine(name, () => {
    const EngineClass = require(modulePath);
    return new EngineClass();
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
    reportGenerator: lazyClassEngine('reportGenerator', '../core/ReportGenerator'),
    threeTier: lazyClassEngine('threeTier', '../core/ThreeTierEngine'),
    exportEngine: lazyClassEngine('exportEngine', '../core/ExportEngine'),
    analyticsEngine: lazyClassEngine('analyticsEngine', '../core/AnalyticsEngine'),
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
    database: lazySingletonEngine('database', '../core/DatabasePersistenceEngine'),
    technicalDelivery: lazyClassEngine('technicalDelivery', '../core/TechnicalDeliveryGenerator'),
    packagePurchaseFlow: lazyClassEngine('packagePurchaseFlow', '../core/PackagePurchaseFlow'),
    workflowEngine: lazyClassEngine('workflowEngine', '../core/WorkflowEngine'),
    dxfParserService: lazySingletonEngine('dxfParserService', '../services/DXFParserService'),
    promotion: lazyClassEngine('promotion', '../core/PromotionEngine'),
    marketing: lazyClassEngine('marketing', '../core/MarketingEngine'),
    templateLibrary: lazyClassEngine('templateLibrary', '../core/TemplateLibrary'),
    templateLibraryEngine: lazyClassEngine('templateLibraryEngine', '../core/TemplateLibrary'),
    aiAccuracyValidator: lazySingletonEngine('aiAccuracyValidator', '../engines/AIValidationEngine'),
    aiConsultant: lazyClassEngine('aiConsultant', '../core/AIConsultantEngine'),
    waterSystem: lazyNamedClassEngine('waterSystem', '../core/WaterSystemEngine', 'WaterSystemEngine'),
    heatingSystem: lazyNamedClassEngine('heatingSystem', '../core/HeatingSystemEngine', 'HeatingSystemEngine'),
    airConditioning: lazyNamedClassEngine('airConditioning', '../core/AirConditioningEngine', 'AirConditioningEngine'),
    fiveConstant: lazyNamedClassEngine('fiveConstant', '../core/FiveConstantEngine', 'FiveConstantEngine'),
    freshAirPro: lazyNamedClassEngine('freshAirPro', '../core/FreshAirProEngine', 'FreshAirProEngine'),
    pptExport: lazyClassEngine('pptExport', '../engines/PPTExportEngine'),
    standardsLibrary: lazyClassEngine('standardsLibrary', '../core/ProfessionalStandardsLibrary'),
    location: lazyClassEngine('location', '../core/LocationService'),
    doasCompliance: lazyClassEngine('doasCompliance', '../core/DOASComplianceEngine'),
    systemCoordination: lazyClassEngine('systemCoordination', '../core/SystemCoordinationEngine'),
    reheatModule: lazyClassEngine('reheatModule', '../core/ReheatModuleEngine'),
    houseTypeLibrary: lazyClassEngine('houseTypeLibrary', '../core/HouseTypeLibrary'),
    econetSystem: lazyClassEngine('econetSystem', '../engines/EconetEngine'),
    solutionTemplate: lazySingletonEngine('solutionTemplate', '../engines/SolutionTemplateEngine'),
    runtimeProfile: 'safe'
  };

  return attachLazyRuntime(engines);
}

function createFullProductionEngines() {
  const engines = createBaseProductionEngines();
  engines.monitoring = lazyClassEngine('monitoring', '../core/MonitoringSystem', { runtimeProfile: 'full' });
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
