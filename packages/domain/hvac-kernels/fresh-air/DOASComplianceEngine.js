/**
 * DOAS合规性检查引擎
 * DOAS Compliance Engine
 * 
 * 功能：
 * 1. DOAS标准符合性自动验证
 * 2. DOAS vs 高效新风模式区分
 * 3. 与辐射系统协调性检查
 * 4. ASHRAE 62.1/90.1标准检查
 * 5. 生成DOAS合规性报告
 * 
 * 标准依据：
 * - ASHRAE 62.1-2019 Ventilation for Acceptable Indoor Air Quality
 * - ASHRAE 90.1-2019 Energy Standard for Buildings
 * - DOAS Design Guide (Dedicated Outdoor Air Systems)
 */

class DOASComplianceEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'DOASComplianceEngine';
    
    // ASHRAE标准参数
    this.ASHRAE_STANDARDS = {
      // ASHRAE 62.1 通风率
      ventilation: {
        residential: {
          rp: 2.5,      // L/s·person - 每人所需新风量
          ra: 0.3       // L/s·m² - 每平米所需新风量
        },
        office: {
          rp: 2.5,
          ra: 0.3
        },
        classroom: {
          rp: 5.0,
          ra: 0.6
        }
      },
      
      // ASHRAE 90.1 能效要求
      energy: {
        heatRecovery: {
          sre: 75,      // Sensible Recovery Efficiency %
          lre: 60       // Latent Recovery Efficiency %
        },
        fanPower: {
          maxWattsPerCFM: 0.8  // W/CFM
        }
      }
    };
    
    // DOAS核心标准
    this.DOAS_STANDARDS = {
      // 送风状态点 - 不承担室内显热负荷
      supplyAir: {
        summer: {
          temperature: 22,      // ℃ - 接近室内温度
          relativeHumidity: 50, // %
          dewPoint: 10,         // ℃ - 深度除湿
          explanation: '送风温度接近室温，不承担室内显热负荷'
        },
        winter: {
          temperature: 26,      // ℃ - 略高于室温
          relativeHumidity: 40, // %
          dewPoint: 7           // ℃
        }
      },
      
      // 与辐射系统配合
      coordination: {
        tempDiffMin: 3,         // ℃ - 送风温度应高于辐射表面温度3℃以上
        controlMode: 'integrated', // 统一协调控制
        radiantSurfaceTemp: {
          cooling: 18,          // ℃ - 辐射供冷表面温度
          heating: 35           // ℃ - 辐射供热表面温度
        }
      },
      
      // 负荷分配
      loadSharing: {
        doas: '仅承担新风负荷（潜热+部分显热）',
        radiant: '承担室内显热负荷',
        principle: '温湿度独立控制理念'
      },
      
      // 热回收要求
      heatRecovery: {
        type: 'enthalpy_wheel', // 推荐转轮式全热交换
        sre: '>=75%',          // 显热回收效率
        lre: '>=60%',          // 潜热回收效率
        brands: ['Munters', '环都拓普', '蒙特']
      },
      
      // 再热模块（DOAS关键组件）
      reheat: {
        required: true,
        targetTemp: 22,         // ℃ - 夏季送风温度
        methods: [
          { type: 'hot_water', priority: 1, description: '热水盘管（利用壁挂炉余热）' },
          { type: 'electric', priority: 2, description: '电加热（备用）' },
          { type: 'heat_pump', priority: 3, description: '热泵再热（最高能效）' }
        ]
      }
    };
    
    // 高效新风模式（当前系统）
    this.EFFICIENT_FRESH_AIR = {
      supplyAir: {
        summer: {
          temperature: '16-18',  // ℃ - 低温送风
          relativeHumidity: 60,  // %
          explanation: '低温送风，承担部分室内显热负荷'
        }
      },
      heatRecovery: {
        efficiency: '60-85%',    // 视设备类型而定
        types: ['sensible', 'enthalpy', 'rotary']
      },
      loadSharing: {
        mode: '混合承担',
        description: '新风系统与空调系统共同承担室内负荷'
      },
      advantages: [
        '初投资较低',
        '系统简单',
        '适用于普通住宅'
      ],
      limitations: [
        '不能完美配合辐射系统',
        '节能率15-20%（低于DOAS的30%+）',
        '吹风感较明显'
      ]
    };
  }
  
  /**
   * DOAS合规性检查主入口
   */
  checkDOASCompliance(design) {
    const {
      supplyAir,        // 送风参数 { temperature, relativeHumidity, dewPoint }
      heatRecovery,     // 热回收 { type, sre, lre }
      radiantSystem,    // 辐射系统 { type, surfaceTemp }
      controlStrategy,  // 控制策略 { mode, coordination }
      equipment         // 设备清单
    } = design;
    
    const checks = {
      supplyAirCheck: this.checkSupplyAir(supplyAir),
      heatRecoveryCheck: this.checkHeatRecovery(heatRecovery),
      coordinationCheck: this.checkRadiantCoordination(supplyAir, radiantSystem),
      controlCheck: this.checkControlStrategy(controlStrategy),
      equipmentCheck: this.checkEquipment(equipment)
    };
    
    // 汇总结果
    const allPassed = Object.values(checks).every(c => c.passed);
    const issues = Object.values(checks).flatMap(c => c.issues || []);
    const score = this.calculateComplianceScore(checks);
    
    return {
      isCompliant: allPassed,
      score,
      level: this.getComplianceLevel(score),
      checks,
      issues,
      recommendations: this.generateRecommendations(issues),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 检查送风参数
   */
  checkSupplyAir(supplyAir) {
    const issues = [];
    let passed = true;
    
    if (!supplyAir) {
      return {
        passed: false,
        issues: [{ severity: 'high', message: '缺少送风参数' }]
      };
    }
    
    // 检查夏季送风温度
    if (supplyAir.summer?.temperature !== undefined) {
      const temp = supplyAir.summer.temperature;
      if (temp < 20) {
        issues.push({
          severity: 'high',
          type: 'temperature_too_low',
          message: `夏季送风温度${temp}℃过低，DOAS要求22℃`,
          current: temp,
          required: 22,
          impact: '送风承担室内显热负荷，违背DOAS核心理念'
        });
        passed = false;
      } else if (temp >= 20 && temp < 21) {
        issues.push({
          severity: 'medium',
          type: 'temperature_low',
          message: `夏季送风温度${temp}℃略低，建议提升至22℃`,
          recommendation: '增加再热模块'
        });
      }
    }
    
    // 检查露点温度（防结露）
    if (supplyAir.summer?.dewPoint !== undefined) {
      const dewPoint = supplyAir.summer.dewPoint;
      if (dewPoint > 12) {
        issues.push({
          severity: 'high',
          type: 'dew_point_high',
          message: `露点温度${dewPoint}℃过高，结露风险`,
          current: dewPoint,
          required: '<=10℃',
          impact: '与辐射系统配合时可能结露'
        });
        passed = false;
      }
    }
    
    return {
      passed,
      issues,
      details: {
        summerTemp: supplyAir.summer?.temperature,
        targetTemp: this.DOAS_STANDARDS.supplyAir.summer.temperature
      }
    };
  }
  
  /**
   * 检查热回收效率
   */
  checkHeatRecovery(heatRecovery) {
    const issues = [];
    let passed = true;
    
    if (!heatRecovery) {
      return {
        passed: false,
        issues: [{ severity: 'high', message: '缺少热回收信息' }]
      };
    }
    
    // 检查显热回收效率 SRE
    if (heatRecovery.sre !== undefined) {
      if (heatRecovery.sre < 75) {
        issues.push({
          severity: 'medium',
          type: 'sre_low',
          message: `显热回收效率${heatRecovery.sre}%低于ASHRAE 90.1要求75%`,
          current: heatRecovery.sre,
          required: '>=75%',
          recommendation: '更换为转轮式全热交换器'
        });
        passed = false;
      }
    }
    
    // 检查潜热回收效率 LRE
    if (heatRecovery.lre !== undefined) {
      if (heatRecovery.lre < 60) {
        issues.push({
          severity: 'medium',
          type: 'lre_low',
          message: `潜热回收效率${heatRecovery.lre}%低于ASHRAE 90.1要求60%`,
          current: heatRecovery.lre,
          required: '>=60%',
          recommendation: '选用高效转轮式热回收'
        });
        passed = false;
      }
    }
    
    // 检查热回收类型
    if (heatRecovery.type) {
      const recommendedTypes = ['enthalpy_wheel', 'rotary', 'enthalpy'];
      if (!recommendedTypes.includes(heatRecovery.type)) {
        issues.push({
          severity: 'low',
          type: 'hr_type_not_optimal',
          message: `当前热回收类型${heatRecovery.type}不是DOAS最佳选择`,
          recommendation: '推荐转轮式全热交换器(enthalpy_wheel)'
        });
      }
    }
    
    return {
      passed,
      issues,
      details: {
        sre: heatRecovery.sre,
        lre: heatRecovery.lre,
        requiredSRE: 75,
        requiredLRE: 60
      }
    };
  }
  
  /**
   * 检查与辐射系统协调
   */
  checkRadiantCoordination(supplyAir, radiantSystem) {
    const issues = [];
    let passed = true;
    
    if (!radiantSystem || !supplyAir) {
      return {
        passed: true,  // 无辐射系统时不检查
        issues: [],
        note: '未检测到辐射系统，跳过协调检查'
      };
    }
    
    // 检查送风温度与辐射表面温度差
    if (supplyAir.summer?.temperature && radiantSystem.cooling?.surfaceTemp) {
      const supplyTemp = supplyAir.summer.temperature;
      const radiantTemp = radiantSystem.cooling.surfaceTemp;
      const tempDiff = supplyTemp - radiantTemp;
      
      if (tempDiff < 3) {
        issues.push({
          severity: 'high',
          type: 'condensation_risk',
          message: `送风温度(${supplyTemp}℃)与辐射表面温度(${radiantTemp}℃)差仅${tempDiff}℃，结露风险高`,
          current: tempDiff,
          required: '>=3℃',
          impact: '辐射表面可能结露，损坏装修',
          recommendation: '提高送风温度或降低辐射供水温度'
        });
        passed = false;
      }
    }
    
    // 检查控制模式
    if (radiantSystem.controlMode && radiantSystem.controlMode !== 'integrated') {
      issues.push({
        severity: 'medium',
        type: 'control_not_integrated',
        message: 'DOAS与辐射系统未实现统一协调控制',
        current: radiantSystem.controlMode,
        required: 'integrated',
        recommendation: '采用统一控制系统，协调送风温度和辐射表面温度'
      });
    }
    
    return {
      passed,
      issues,
      details: {
        tempDiff: supplyAir.summer?.temperature - radiantSystem.cooling?.surfaceTemp,
        requiredDiff: 3
      }
    };
  }
  
  /**
   * 检查控制策略
   */
  checkControlStrategy(controlStrategy) {
    const issues = [];
    let passed = true;
    
    if (!controlStrategy) {
      return {
        passed: false,
        issues: [{ severity: 'high', message: '缺少控制策略信息' }]
      };
    }
    
    // 检查是否有再热控制
    if (!controlStrategy.reheat) {
      issues.push({
        severity: 'high',
        type: 'no_reheat_control',
        message: '缺少再热模块控制，无法实现22℃送风',
        impact: '这是DOAS的核心组件',
        recommendation: '增加热水盘管/电加热再热模块，并配置PID控制'
      });
      passed = false;
    }
    
    // 检查负荷分配策略
    if (controlStrategy.loadSharing !== 'separated') {
      issues.push({
        severity: 'medium',
        type: 'load_sharing_not_separated',
        message: '负荷分配未实现DOAS要求的分离',
        current: controlStrategy.loadSharing,
        required: 'separated',
        explanation: 'DOAS应只承担新风负荷，不承担室内显热负荷'
      });
    }
    
    return {
      passed,
      issues,
      details: {
        controlMode: controlStrategy.mode,
        hasReheat: !!controlStrategy.reheat
      }
    };
  }
  
  /**
   * 检查设备配置
   */
  checkEquipment(equipment) {
    const issues = [];
    let passed = true;
    
    if (!equipment || !Array.isArray(equipment)) {
      return {
        passed: false,
        issues: [{ severity: 'high', message: '缺少设备清单' }]
      };
    }
    
    // 检查是否有再热模块
    const hasReheat = equipment.some(e => 
      e.type === 'reheat' || e.type === 'reheater' || 
      e.name?.includes('再热') || e.name?.includes('reheat')
    );
    
    if (!hasReheat) {
      issues.push({
        severity: 'high',
        type: 'missing_reheat',
        message: '设备清单缺少再热模块',
        impact: 'DOAS必需组件，用于将除湿后的低温空气加热至22℃',
        recommendation: '增加热水盘管再热器或电加热器'
      });
      passed = false;
    }
    
    // 检查是否有深度除湿能力
    const hasDeepDehumidification = equipment.some(e =>
      e.dehumidification === 'deep' || 
      e.dewPointOutlet <= 10 ||
      e.name?.includes('深度除湿')
    );
    
    if (!hasDeepDehumidification) {
      issues.push({
        severity: 'medium',
        type: 'no_deep_dehumidification',
        message: '设备可能不具备深度除湿能力',
        required: '露点温度<=10℃',
        recommendation: '选用7℃冷冻水或直接膨胀式深度除湿'
      });
    }
    
    return {
      passed,
      issues,
      details: {
        hasReheat,
        hasDeepDehumidification,
        totalEquipment: equipment.length
      }
    };
  }
  
  /**
   * 计算合规评分
   */
  calculateComplianceScore(checks) {
    const weights = {
      supplyAirCheck: 30,
      heatRecoveryCheck: 25,
      coordinationCheck: 20,
      controlCheck: 15,
      equipmentCheck: 10
    };
    
    let score = 0;
    let totalWeight = 0;
    
    for (const [key, check] of Object.entries(checks)) {
      if (check && check.passed !== undefined) {
        const weight = weights[key] || 10;
        score += check.passed ? weight : 0;
        totalWeight += weight;
      }
    }
    
    return Math.round((score / totalWeight) * 100);
  }
  
  /**
   * 获取合规等级
   */
  getComplianceLevel(score) {
    if (score >= 90) return { level: 'A', description: '完全符合DOAS标准', class: 'excellent' };
    if (score >= 80) return { level: 'B', description: '基本符合，有轻微差距', class: 'good' };
    if (score >= 60) return { level: 'C', description: '部分符合，需要改进', class: 'acceptable' };
    if (score >= 40) return { level: 'D', description: '差距较大，需重大改造', class: 'needs_improvement' };
    return { level: 'F', description: '不符合DOAS标准', class: 'non_compliant' };
  }
  
  /**
   * 生成改进建议
   */
  generateRecommendations(issues) {
    const highPriority = issues.filter(i => i.severity === 'high');
    const mediumPriority = issues.filter(i => i.severity === 'medium');
    const lowPriority = issues.filter(i => i.severity === 'low');
    
    const recommendations = [];
    
    // 高优先级建议
    if (highPriority.length > 0) {
      recommendations.push({
        priority: 'high',
        category: '核心改造',
        actions: highPriority.map(i => i.recommendation || i.message),
        estimatedCost: '较高',
        timeline: '1-2个月'
      });
    }
    
    // 中优先级建议
    if (mediumPriority.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: '优化提升',
        actions: mediumPriority.map(i => i.recommendation || i.message),
        estimatedCost: '中等',
        timeline: '2-4周'
      });
    }
    
    // 低优先级建议
    if (lowPriority.length > 0) {
      recommendations.push({
        priority: 'low',
        category: '可选改进',
        actions: lowPriority.map(i => i.recommendation || i.message),
        estimatedCost: '较低',
        timeline: '1-2周'
      });
    }
    
    return recommendations;
  }
  
  /**
   * 对比DOAS vs 高效新风
   */
  compareModes() {
    return {
      doas: {
        name: 'DOAS专用室外空气系统',
        description: '新风独立处理到室内状态点，不承担室内显热负荷',
        supplyAirTemp: { summer: '22℃', winter: '26℃' },
        heatRecovery: { sre: '>=75%', lre: '>=60%' },
        energySaving: '30%+',
        comfortLevel: '极高（无吹风感）',
        investment: '较高（需要再热模块）',
        bestFor: '高端住宅、与辐射系统配合',
        standards: ['ASHRAE 62.1', 'ASHRAE 90.1']
      },
      efficient: {
        name: '高效新风系统',
        description: '优化的传统新风系统，承担部分室内负荷',
        supplyAirTemp: { summer: '16-18℃', winter: '21℃' },
        heatRecovery: { efficiency: '60-85%' },
        energySaving: '15-20%',
        comfortLevel: '良好（有轻微吹风感）',
        investment: '中等',
        bestFor: '中高端住宅、预算有限',
        standards: ['GB 50736', '行业规范']
      }
    };
  }
  
  /**
   * 生成详细报告
   */
  generateReport(design, compliance) {
    return {
      timestamp: new Date().toISOString(),
      engineVersion: this.version,
      
      summary: {
        isCompliant: compliance.isCompliant,
        score: compliance.score,
        level: compliance.level,
        issueCount: compliance.issues.length
      },
      
      designInput: design,
      
      complianceDetails: compliance.checks,
      
      issues: compliance.issues,
      
      recommendations: compliance.recommendations,
      
      modeComparison: this.compareModes(),
      
      nextSteps: this.generateNextSteps(compliance),
      
      standards: {
        referenced: ['ASHRAE 62.1-2019', 'ASHRAE 90.1-2019', 'DOAS Design Guide'],
        certification: '可申请ASHRAE 90.1认证'
      }
    };
  }
  
  /**
   * 生成下一步行动
   */
  generateNextSteps(compliance) {
    const steps = [];
    
    if (compliance.score >= 90) {
      steps.push({
        phase: 'immediate',
        action: '申请ASHRAE 90.1认证',
        description: '系统已完全符合DOAS标准，可申请国际认证'
      });
    } else if (compliance.score >= 60) {
      steps.push({
        phase: 'short_term',
        action: '执行核心改造',
        description: `解决${compliance.issues.filter(i => i.severity === 'high').length}个高优先级问题`
      });
      steps.push({
        phase: 'medium_term',
        action: '优化提升',
        description: '解决中低优先级问题，提升系统性能'
      });
    } else {
      steps.push({
        phase: 'major_redesign',
        action: '重新设计系统',
        description: '当前系统与DOAS差距较大，建议重新规划'
      });
    }
    
    return steps;
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      standards: {
        ashrae: this.ASHRAE_STANDARDS,
        doas: this.DOAS_STANDARDS
      },
      capabilities: [
        'DOAS合规性检查',
        '与辐射系统协调性检查',
        'ASHRAE标准验证',
        'DOAS vs 高效新风对比',
        '改进建议生成',
        '详细报告输出'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

// 导出
module.exports = DOASComplianceEngine;
