/**
 * V9 Engine Loader - 集中式引擎加载器
 * 替代 server-production.js 中分散的 require 语句
 * 支持懒加载、错误隔离、依赖注入
 */

class EngineLoader {
  constructor() {
    this._cache = new Map();
    this._errors = [];
    this._loaded = 0;
  }

  /**
   * 安全加载引擎，失败不影响其他引擎
   */
  _safeRequire(name, path) {
    try {
      const mod = require(path);
      this._cache.set(name, mod);
      this._loaded++;
      return mod;
    } catch (err) {
      this._errors.push({ name, path, error: err.message });
      console.warn(`⚠️ [EngineLoader] ${name} 加载失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 加载所有核心引擎
   */
  loadCoreEngines() {
    const core = '../../server/core';
    // P0 核心引擎
    this._safeRequire('LoadCalculationEngine', `${core}/LoadCalculationEngine`);
    this._safeRequire('DeviceSelectionEngine', `${core}/DeviceSelectionEngine`);
    this._safeRequire('QuotationEngine', `${core}/QuotationEngine`);
    this._safeRequire('QuotationEngineV2', `${core}/QuotationEngine-v2`);
    this._safeRequire('Layout3DEngine', `${core}/Layout3DEngine`);
    this._safeRequire('DrawingEngine', `${core}/DrawingEngine`);
    this._safeRequire('Renderer3DEngine', `${core}/Renderer3DEngine`);
    this._safeRequire('PainPointDiagnosisEngine', `${core}/PainPointDiagnosisEngineV3`);
    this._safeRequire('PainPointMatchingEngine', `${core}/PainPointMatchingEngine`);
    this._safeRequire('QuickLockMode', `${core}/QuickLockMode`);
    this._safeRequire('ValueBasedQuotationEngine', `${core}/ValueBasedQuotationEngine`);
    this._safeRequire('CorePrincipleVisuals', `${core}/CorePrincipleVisuals`);
    this._safeRequire('HeartbeatMonitor', `${core}/HeartbeatMonitor`);

    // 条件/验证/版本
    this._safeRequire('ConditionalFieldEngine', `${core}/ConditionalFieldEngine`);
    this._safeRequire('VersionControlEngine', `${core}/VersionControlEngine`);
    this._safeRequire('DataEncryption', `${core}/DataEncryption`);
    this._safeRequire('DataBackupScheduler', `${core}/DataBackupScheduler`);
    this._safeRequire('AIValidationSuite', `${core}/AIValidationSuite`);

    // 系统引擎
    this._safeRequire('WaterSystemEngine', `${core}/WaterSystemEngine`);
    this._safeRequire('HeatingSystemEngine', `${core}/HeatingSystemEngine`);
    this._safeRequire('AirConditioningEngine', `${core}/AirConditioningEngine`);
    this._safeRequire('FiveConstantEngine', `${core}/FiveConstantEngine`);
    this._safeRequire('FreshAirProEngine', `${core}/FreshAirProEngine`);

    // 3D/BIM
    this._safeRequire('HVAC3DVisualizationEngine', `${core}/HVAC3DVisualizationEngine`);
    this._safeRequire('BIMExportEngine', `${core}/BIMExportEngine`);
    this._safeRequire('LocationService', `${core}/LocationService`);
    this._safeRequire('DevicePositioningEngine', `${core}/DevicePositioningEngine`);
    this._safeRequire('DOASComplianceEngine', `${core}/DOASComplianceEngine`);
    this._safeRequire('SystemCoordinationEngine', `${core}/SystemCoordinationEngine`);
    this._safeRequire('ReheatModuleEngine', `${core}/ReheatModuleEngine`);
    this._safeRequire('PerformanceMonitorEngine', `${core}/PerformanceMonitorEngine`);
    this._safeRequire('CacheEngine', `${core}/CacheEngine`);
    this._safeRequire('TemplateLibrary', `${core}/TemplateLibrary`);
    this._safeRequire('CADEntityRecognizer', `${core}/CADEntityRecognizer`);
    this._safeRequire('MonitoringSystem', `${core}/MonitoringSystem`);
    this._safeRequire('FeedbackCollector', `${core}/FeedbackCollector`);
    this._safeRequire('DeploymentManager', `${core}/DeploymentManager`);
    this._safeRequire('RiskBasedQualityAssurance', `${core}/RiskBasedQualityAssurance`);
    this._safeRequire('WorkflowOrchestrator', `${core}/WorkflowOrchestrator`);
    this._safeRequire('SelfCheckOrchestrator', `${core}/SelfCheckOrchestrator`);
    this._safeRequire('AgentCoordinator', `${core}/AgentCoordinator`);
    this._safeRequire('DatabasePersistenceEngine', `${core}/DatabasePersistenceEngine`);
    this._safeRequire('EvolutionMechanism', `${core}/EvolutionMechanism`);
    this._safeRequire('PromotionEngine', `${core}/PromotionEngine`);
    this._safeRequire('HouseTypeLibrary', `${core}/HouseTypeLibrary`);

    // V9 新引擎
    this._safeRequire('HourlyLoadEngine', `${core}/HourlyLoadEngine`);
    this._safeRequire('HydraulicModelingEngine', `${core}/HydraulicModelingEngine`);
    this._safeRequire('LLMServiceV2', `${core}/LLMServiceV2`);
    this._safeRequire('I18nEngine', `${core}/I18nEngine`);
    this._safeRequire('UnitConverter', `${core}/UnitConverter`);
    this._safeRequire('CurrencyEngine', `${core}/CurrencyEngine`);
    this._safeRequire('WebhookEngine', `${core}/WebhookEngine`);
    this._safeRequire('PluginSDK', `${core}/PluginSDK`);

    return this;
  }

  /**
   * 加载通用引擎 (server/engines/)
   */
  loadGeneralEngines() {
    const eng = '../../server/engines';
    this._safeRequire('PPTExportEngine', `${eng}/PPTExportEngine`);
    this._safeRequire('YjsCollaborationEngine', `${eng}/YjsCollaborationEngine`);
    this._safeRequire('CADImporterEngine', `${eng}/CADImporterEngine`);
    this._safeRequire('FloorPlanRecognitionEngine', `${eng}/FloorPlanRecognitionEngine`);
    this._safeRequire('MqttBrokerEngine', `${eng}/MqttBrokerEngine`);
    this._safeRequire('RAGKnowledgeBaseEngine', `${eng}/RAGKnowledgeBaseEngine`);
    this._safeRequire('CollaborationSyncEngine', `${eng}/CollaborationSyncEngine`);
    this._safeRequire('TemplateLibraryEngine', `${eng}/TemplateLibrary`);
    this._safeRequire('DataBackupRestore', `${eng}/DataBackupRestore`);
    this._safeRequire('AIAccuracyValidator', `${eng}/AIAccuracyValidator`);
    this._safeRequire('TemplateEngine', `${eng}/TemplateEngine`);
    this._safeRequire('AIValidationEngine', `${eng}/AIValidationEngine`);
    this._safeRequire('EconetPricingEngine', `${eng}/EconetPricingEngine`);
    this._safeRequire('EconetEngine', `${eng}/EconetEngine`);
    return this;
  }

  get(name) { return this._cache.get(name); }
  has(name) { return this._cache.has(name); }
  
  getStats() {
    return {
      loaded: this._loaded,
      errors: this._errors.length,
      total: this._loaded + this._errors.length,
      errorDetails: this._errors
    };
  }

  printSummary() {
    const stats = this.getStats();
    console.log(`\n📦 [EngineLoader] ${stats.loaded}/${stats.total} 引擎加载成功`);
    if (stats.errors.length > 0) {
      console.log(`⚠️  ${stats.errors.length} 个引擎加载失败:`);
      stats.errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
    }
  }
}

module.exports = EngineLoader;
