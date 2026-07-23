/**
 * 工作流程编排器 - 形成完全闭环的业务流程
 * 
 * 完整流程：
 * 户型信息 → 痛点诊断 → AI方案匹配 → 负荷计算 → 设备选型 → 报价生成
 */

class WorkflowOrchestrator {
  constructor(engines) {
    this.engines = engines;
    this.workflowSteps = [
      'painDiagnosis',
      'solutionMatching', 
      'loadCalculation',
      'deviceSelection',
      'quotationGeneration'
    ];
  }

  /**
   * 执行完整工作流程
   */
  async executeCompleteWorkflow(roomProfile, selectedPainPoints = []) {
    const workflowResult = {
      timestamp: new Date().toISOString(),
      roomProfile,
      steps: [],
      finalSolution: null,
      errors: []
    };

    try {
      // 步骤1: 痛点诊断
      const diagnosisResult = await this.executeStep('painDiagnosis', {
        roomProfile,
        selectedTags: selectedPainPoints
      });
      workflowResult.steps.push({ step: 'painDiagnosis', result: diagnosisResult });
      
      // 步骤2: AI方案匹配
      const matchingResult = await this.executeStep('solutionMatching', {
        diagnosis: diagnosisResult,
        roomProfile
      });
      workflowResult.steps.push({ step: 'solutionMatching', result: matchingResult });
      
      // 步骤3: 负荷计算
      const loadResult = await this.executeStep('loadCalculation', {
        roomProfile,
        solution: matchingResult
      });
      workflowResult.steps.push({ step: 'loadCalculation', result: loadResult });
      
      // 步骤4: 设备选型
      const deviceResult = await this.executeStep('deviceSelection', {
        load: loadResult,
        roomProfile,
        solution: matchingResult
      });
      workflowResult.steps.push({ step: 'deviceSelection', result: deviceResult });
      
      // 步骤5: 报价生成
      const quotationResult = await this.executeStep('quotationGeneration', {
        solution: matchingResult,
        devices: deviceResult,
        roomProfile,
        painPoints: diagnosisResult.allTags || selectedPainPoints
      });
      workflowResult.steps.push({ step: 'quotationGeneration', result: quotationResult });
      
      // 汇总最终方案
      workflowResult.finalSolution = {
        painDiagnosis: diagnosisResult,
        solution: matchingResult,
        loadCalculation: loadResult,
        deviceSelection: deviceResult,
        quotation: quotationResult,
        summary: this.generateSummary(diagnosisResult, matchingResult, deviceResult, quotationResult)
      };
      
      workflowResult.success = true;
      
    } catch (error) {
      workflowResult.success = false;
      workflowResult.errors.push(error.message);
    }

    return workflowResult;
  }

  /**
   * 执行单个步骤
   */
  async executeStep(stepName, input) {
    try {
      switch(stepName) {
        case 'painDiagnosis':
          return this.engines.painDiagnosis.diagnose(input.roomProfile, input.selectedTags);
        
        case 'solutionMatching':
          return this.engines.painMatching.match(input.diagnosis, input.roomProfile);
        
        case 'loadCalculation':
          // 负荷计算引擎需要特定参数
          return this.engines.loadCalculation.calculate(input.roomProfile);
        
        case 'deviceSelection':
          // 设备选型引擎需要负荷结果
          return this.engines.deviceSelection.select(input.load, input.roomProfile);
        
        case 'quotationGeneration':
          // 报价生成引擎
          return this.engines.quotation.generate(input.solution, input.devices, input.painPoints);
        
        default:
          throw new Error(`Unknown step: ${stepName}`);
      }
    } catch (error) {
      console.error(`Step ${stepName} failed:`, error);
      throw error;
    }
  }

  /**
   * 生成方案汇总
   */
  generateSummary(diagnosis, solution, devices, quotation) {
    return {
      totalPainPoints: diagnosis.allTags?.length || 0,
      recommendedSystems: solution.systems?.length || 0,
      totalCoolingLoad: devices.totalCoolingLoad || 0,
      totalHeatingLoad: devices.totalHeatingLoad || 0,
      deviceCount: devices.devices?.length || 0,
      totalPrice: quotation.totalPrice || 0,
      estimatedMargin: quotation.margin || 0,
      keyFeatures: solution.features || [],
      priorityRecommendations: solution.priorityRecommendations || []
    };
  }

  /**
   * 快速工作流程（跳过某些步骤）
   */
  async executeQuickWorkflow(roomProfile, selectedPainPoints = []) {
    const quickResult = {
      timestamp: new Date().toISOString(),
      roomProfile,
      selectedPainPoints,
      quickSolution: null
    };

    try {
      // 只执行痛点诊断和方案匹配
      const diagnosis = this.engines.painDiagnosis.diagnose(roomProfile, selectedPainPoints);
      const solution = this.engines.painMatching.match(diagnosis, roomProfile);
      
      quickResult.quickSolution = {
        diagnosis,
        solution,
        summary: {
          totalPainPoints: diagnosis.allTags?.length || 0,
          recommendedSystems: solution.systems?.length || 0,
          keyFeatures: solution.features || []
        }
      };
      
      quickResult.success = true;
    } catch (error) {
      quickResult.success = false;
      quickResult.error = error.message;
    }

    return quickResult;
  }

  /**
   * 获取工作流程状态
   */
  getWorkflowStatus() {
    return {
      availableSteps: this.workflowSteps,
      engineStatus: this.checkEngineStatus(),
      lastExecution: null
    };
  }

  /**
   * 检查引擎状态
   */
  checkEngineStatus() {
    return {
      painDiagnosis: !!this.engines.painDiagnosis,
      painMatching: !!this.engines.painMatching,
      loadCalculation: !!this.engines.loadCalculation,
      deviceSelection: !!this.engines.deviceSelection,
      quotation: !!this.engines.quotation
    };
  }
}

module.exports = WorkflowOrchestrator;
