/**
 * RysnovaCodeEngine - 暖通专业规范检查引擎
 * 
 * 数字化规范库:
 * - GB 50736-2012 民用建筑供暖通风与空气调节设计规范
 * - GB 50019-2015 工业建筑供暖通风与空气调节设计规范
 * - ASHRAE 55/62.1/90.1 国际标准
 * - CJJ 34 城市热力网设计规范
 * - 地方节能标准
 * 
 * @author Rysnova Team
 * @version 1.0.0
 */

class RysnovaCodeEngine {
  constructor() {
    this.name = 'RysnovaCodeEngine';
    this.version = '1.0.0';
    
    // 规范库
    this.codes = {
      gb50736: this.loadGB50736(),
      gb50019: this.loadGB50019(),
      ashrae55: this.loadASHRAE55(),
      ashrae621: this.loadASHRAE621(),
      ashrae901: this.loadASHRAE901(),
      cjj34: this.loadCJJ34(),
      local: this.loadLocalCodes()
    };
    
    // 检查规则
    this.rules = this.initializeRules();
  }

  /**
   * 主入口: 完整规范合规检查
   */
  async performCodeComplianceCheck(design) {
    console.log('[RysnovaCode] 开始规范合规检查');
    
    const results = {
      timestamp: new Date().toISOString(),
      version: this.version,
      project: design.projectName,
      checks: []
    };
    
    // 执行各专项规范检查
    const checks = [
      this.checkLoadCalculation(design),      // 负荷计算规范
      this.checkSystemSelection(design),       // 系统选择规范
      this.checkEquipmentSelection(design),    // 设备选型规范
      this.checkDuctDesign(design),            // 风管设计规范
      this.checkPipeDesign(design),            // 水管设计规范
      this.checkVentilation(design),          // 通风规范
      this.checkControl(design),              // 自控规范
      this.checkEnergyEfficiency(design),      // 节能规范
      this.checkSafety(design)                // 安全规范
    ];
    
    results.checks = await Promise.all(checks);
    
    // 汇总
    results.summary = this.summarizeResults(results.checks);
    results.compliance = this.calculateCompliance(results.checks);
    results.report = this.generateComplianceReport(results);
    
    return results;
  }

  /**
   * 负荷计算规范检查 (GB 50736 第3-5章)
   */
  async checkLoadCalculation(design) {
    const issues = [];
    const load = design.calculations?.load;
    
    if (!load) {
      return { category: '负荷计算', status: 'error', issues: ['缺少负荷计算数据'] };
    }
    
    // 3.0.1 室内设计参数
    const indoorParams = design.indoorParams;
    const codeParams = this.codes.gb50736.indoorDesignParams[design.buildingType];
    
    if (indoorParams.coolingTemp < codeParams.cooling.min || 
        indoorParams.coolingTemp > codeParams.cooling.max) {
      issues.push({
        code: '3.0.1',
        severity: 'error',
        description: `夏季室内温度${indoorParams.coolingTemp}°C超出规范范围[${codeParams.cooling.min},${codeParams.cooling.max}]`,
        recommendation: `调整至${codeParams.cooling.standard}°C`
      });
    }
    
    // 4.1.2 新风量标准
    const requiredFreshAir = this.codes.gb50736.freshAirRequirements[design.roomType];
    const actualFreshAir = load.ventilation.volume / design.occupancy;
    
    if (actualFreshAir < requiredFreshAir * 0.9) {
      issues.push({
        code: '4.1.2',
        severity: 'error',
        description: `人均新风量${actualFreshAir.toFixed(1)}m³/h低于规范${requiredFreshAir}m³/h`,
        recommendation: '增加新风量或优化气流组织'
      });
    }
    
    // 5.2.2 负荷计算深度
    if (!load.detail?.hourly || load.detail.hourly.length < 24) {
      issues.push({
        code: '5.2.2',
        severity: 'warning',
        description: '未提供逐时负荷计算',
        recommendation: '补充全年8760小时负荷模拟'
      });
    }
    
    return {
      category: '负荷计算',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues)
    };
  }

  /**
   * 系统选择规范检查 (GB 50736 第8章)
   */
  async checkSystemSelection(design) {
    const issues = [];
    const system = design.hvacSystem;
    
    // 8.1.1 系统形式选择原则
    const buildingType = design.buildingType;
    const area = design.area;
    const height = design.height;
    
    // 高大空间判定
    if (height > 10 && system.type === 'fanCoil') {
      issues.push({
        code: '8.1.1',
        severity: 'warning',
        description: '高大空间采用风机盘管系统，温度梯度可能超标',
        recommendation: '考虑喷口送风或分层空调'
      });
    }
    
    // 8.2.1 全空气系统适用性
    if (area > 20000 && system.type !== 'ahu') {
      issues.push({
        code: '8.2.1',
        severity: 'suggestion',
        description: '大型建筑可考虑全空气系统便于集中管理',
        recommendation: '技术经济比较后决定'
      });
    }
    
    // 8.3.1 VRF系统限制
    if (system.type === 'vrf') {
      const totalCapacity = system.units.reduce((sum, u) => sum + u.capacity, 0);
      if (totalCapacity > 80000) { // 80kW
        issues.push({
          code: '8.3.1',
          severity: 'warning',
          description: 'VRF系统总容量超过80kW，推荐采用多套系统',
          recommendation: '分区设置独立VRF系统'
        });
      }
    }
    
    return {
      category: '系统选择',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues)
    };
  }

  /**
   * 风管设计规范检查 (GB 50736 第6章)
   */
  async checkDuctDesign(design) {
    const issues = [];
    const ducts = design.ducts || [];
    
    for (const duct of ducts) {
      // 6.6.1 风速限制
      const velocity = duct.velocity;
      const ductType = duct.type; // 'main', 'branch', 'terminal'
      
      const velocityLimits = {
        main: { min: 4, max: 8, noise: 6 },
        branch: { min: 2, max: 5, noise: 3.5 },
        terminal: { min: 1, max: 3, noise: 2 }
      };
      
      const limit = velocityLimits[ductType];
      if (velocity > limit.max) {
        issues.push({
          code: '6.6.1',
          severity: 'error',
          description: `${duct.id} ${ductType}风管风速${velocity.toFixed(2)}m/s超过限值${limit.max}m/s`,
          recommendation: '增大管径或调整支路平衡'
        });
      }
      
      // 6.6.3 宽高比限制
      const aspectRatio = Math.max(duct.width, duct.height) / Math.min(duct.width, duct.height);
      if (aspectRatio > 10) {
        issues.push({
          code: '6.6.3',
          severity: 'warning',
          description: `${duct.id} 风管宽高比${aspectRatio.toFixed(1)}超过10`,
          recommendation: '优化风管截面接近正方形'
        });
      }
    }
    
    return {
      category: '风管设计',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues)
    };
  }

  /**
   * 水管设计规范检查 (GB 50736 第9章)
   */
  async checkPipeDesign(design) {
    const issues = [];
    const pipes = design.pipes || [];
    
    for (const pipe of pipes) {
      // 9.1.3 水流速限制
      const velocity = pipe.velocity;
      const diameter = pipe.diameter;
      
      // 根据管径确定最大流速
      const maxVelocity = diameter < 50 ? 1.0 : 
                         diameter < 100 ? 1.2 : 
                         diameter < 200 ? 1.5 : 2.0;
      
      if (velocity > maxVelocity) {
        issues.push({
          code: '9.1.3',
          severity: 'warning',
          description: `${pipe.id} DN${diameter}水管流速${velocity.toFixed(2)}m/s超过推荐值${maxVelocity}m/s`,
          recommendation: '增大管径或调整流量',
          noiseRisk: velocity > 1.5 ? '可能有明显噪声' : null
        });
      }
      
      // 9.1.4 坡度要求
      if (pipe.type === 'condensate') {
        const requiredSlope = 0.01; // 1%
        if (pipe.slope < requiredSlope * 0.8) {
          issues.push({
            code: '9.1.4',
            severity: 'error',
            description: `${pipe.id} 冷凝水管坡度${(pipe.slope*100).toFixed(2)}%低于规范1%`,
            recommendation: '调整管道走向保证排水顺畅'
          });
        }
      }
    }
    
    return {
      category: '水管设计',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues)
    };
  }

  /**
   * 节能规范检查 (GB 50189 / ASHRAE 90.1)
   */
  async checkEnergyEfficiency(design) {
    const issues = [];
    const energy = design.calculations?.energy;
    
    if (!energy) {
      return { category: '节能', status: 'warning', issues: ['缺少能耗计算'] };
    }
    
    // GB 50189 能耗限值
    const climateZone = design.climateZone;
    const buildingType = design.buildingType;
    const limitValues = this.codes.gb50189.energyLimits[climateZone][buildingType];
    
    const actualIntensity = energy.annual.total / design.area;
    
    if (actualIntensity > limitValues.total) {
      issues.push({
        code: 'GB50189-4.1.1',
        severity: 'error',
        description: `建筑能耗指标${actualIntensity.toFixed(2)}kWh/m²·a超过限值${limitValues.total}kWh/m²·a`,
        recommendation: '优化围护结构或提高设备效率',
        measures: [
          '提高外墙保温性能',
          '采用高效冷热源设备',
          '优化新风热回收'
        ]
      });
    }
    
    // ASHRAE 90.1 设备效率
    if (design.systems?.chiller) {
      const cop = design.systems.chiller.cop;
      const requiredCOP = this.codes.ashrae901.chillerCOP[design.systems.chiller.type];
      if (cop < requiredCOP) {
        issues.push({
          code: 'ASHRAE90.1-6.4',
          severity: 'warning',
          description: `冷机COP${cop}低于ASHRAE要求${requiredCOP}`,
          recommendation: '选用更高效率冷机型号'
        });
      }
    }
    
    return {
      category: '节能',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues),
      energyScore: this.calculateEnergyScore(energy, limitValues)
    };
  }

  /**
   * 安全规范检查
   */
  async checkSafety(design) {
    const issues = [];
    
    // 制冷剂安全
    if (design.systems?.refrigerant) {
      const totalRefrigerant = design.systems.refrigerant.totalCharge;
      const machineRoomVolume = design.machineRoom?.volume || 0;
      
      // GB 50019 制冷机房间要求
      if (totalRefrigerant > 50 && machineRoomVolume < totalRefrigerant * 0.3) {
        issues.push({
          code: 'GB50019-9.2.1',
          severity: 'error',
          description: '制冷机房容积不足，通风换气量不够',
          recommendation: '增大机房或设置事故通风'
        });
      }
    }
    
    // 防火阀设置
    const fireDampers = design.ducts?.filter(d => d.hasFireDamper).length || 0;
    const requiredDampers = this.countRequiredFireDampers(design);
    
    if (fireDampers < requiredDampers) {
      issues.push({
        code: 'GB50016',
        severity: 'error',
        description: `防火阀数量${fireDampers}不足，需要${requiredDampers}`,
        recommendation: '穿越防火分区处必须设置防火阀'
      });
    }
    
    return {
      category: '安全',
      status: issues.filter(i => i.severity === 'error').length === 0 ? 'pass' : 'fail',
      issues,
      compliance: this.calculateCategoryCompliance(issues)
    };
  }

  /**
   * 生成规范合规报告
   */
  generateComplianceReport(results) {
    return {
      executive: {
        overallStatus: results.compliance.overallStatus,
        compliance: `${results.compliance.percentage}%`,
        criticalIssues: results.compliance.criticalCount,
        grade: this.calculateComplianceGrade(results.compliance.percentage)
      },
      summary: results.summary,
      details: results.checks,
      recommendations: this.prioritizeRecommendations(results.checks),
      appendix: {
        referencedCodes: Object.keys(this.codes),
        checkedItems: this.rules.length,
        calculationDate: results.timestamp
      }
    };
  }

  // ============== 辅助方法 ==============
  
  loadGB50736() {
    return {
      name: 'GB 50736-2012',
      title: '民用建筑供暖通风与空气调节设计规范',
      indoorDesignParams: {
        residential: { cooling: { min: 24, max: 28, standard: 26 }, heating: { min: 18, max: 22, standard: 20 } },
        office: { cooling: { min: 24, max: 28, standard: 26 }, heating: { min: 20, max: 22, standard: 20 } },
        // ...
      },
      freshAirRequirements: {
        residential: 30,
        office: 40,
        classroom: 30,
        hospital: 45,
        // ...
      }
    };
  }
  
  calculateComplianceGrade(percentage) {
    if (percentage >= 95) return 'A+ (卓越)';
    if (percentage >= 90) return 'A (优秀)';
    if (percentage >= 80) return 'B (良好)';
    if (percentage >= 70) return 'C (合格)';
    return 'D (需整改)';
  }
}

module.exports = RysnovaCodeEngine;
