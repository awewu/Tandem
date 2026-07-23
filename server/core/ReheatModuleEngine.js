/**
 * 再热模块控制引擎
 * Reheat Module Engine
 * 
 * 功能：
 * 1. 再热功率精确计算
 * 2. 多种再热方式控制（热水盘管/电加热/热泵）
 * 3. PID温度控制算法
 * 4. 与壁挂炉/热水器联动
 * 5. 能效优化策略
 * 
 * 核心应用：DOAS系统再热模块
 */

class ReheatModuleEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'ReheatModuleEngine';
    
    // 再热方式配置
    this.REHEAT_METHODS = {
      hot_water: {
        name: '热水盘管',
        priority: 1,
        maxTemp: 60,          // 最高供水温度 ℃
        minTemp: 35,          // 最低供水温度 ℃
        efficiency: 0.95,     // 热交换效率
        responseTime: 120,    // 响应时间 秒
        heatSource: '壁挂炉/热水器余热',
        advantage: '利用废热，节能环保',
        requires: ['hot_water_source', 'circulation_pump']
      },
      
      electric: {
        name: '电加热',
        priority: 2,
        maxPower: 3000,       // 最大功率 W
        efficiency: 0.98,     // 电热转换效率
        responseTime: 10,     // 响应时间 秒
        stages: [1000, 2000, 3000],  // 多档功率
        advantage: '响应快，控制精确',
        requires: ['power_supply_220v']
      },
      
      heat_pump: {
        name: '热泵再热',
        priority: 3,
        cop: 3.0,             // 性能系数
        maxPower: 2500,       // 最大功率 W
        efficiency: 3.0,      // 等效效率(COP)
        responseTime: 60,     // 响应时间 秒
        advantage: '最高能效，制冷冷凝热回收',
        requires: ['refrigerant_system', 'compressor']
      }
    };
    
    // PID控制参数
    this.PID_PARAMS = {
      Kp: 2.0,    // 比例系数
      Ki: 0.5,    // 积分系数
      Kd: 0.2,    // 微分系数
      sampleTime: 5,  // 采样时间 秒
      outputMin: 0,   // 输出最小值
      outputMax: 100  // 输出最大值 %
    };
    
    // 运行状态
    this.status = {
      active: false,
      method: null,
      inletTemp: null,
      targetTemp: null,
      outletTemp: null,
      power: 0,
      efficiency: 0
    };
  }
  
  /**
   * 再热功率计算
   */
  calculateReheatPower(params) {
    const {
      airflow,           // 风量 m³/h
      inletTemp,         // 入口温度 ℃ (深度除湿后)
      targetTemp,        // 目标温度 ℃ (22℃)
      inletHumidity      // 入口相对湿度 %
    } = params;
    
    // 空气参数
    const airDensity = 1.2;      // kg/m³
    const specificHeat = 1.005;    // kJ/kg·K
    
    // 质量流量 kg/s
    const massFlow = (airflow * airDensity) / 3600;
    
    // 温度升高需求
    const tempRise = targetTemp - inletTemp;
    
    // 热功率计算: Q = m·c·ΔT
    const power = massFlow * specificHeat * tempRise; // kW
    
    // 考虑湿度带来的潜热 (简化)
    const humidityFactor = inletHumidity > 90 ? 1.1 : 1.0;
    
    return {
      requiredPower: Math.round(power * 1000 * humidityFactor), // W
      tempRise,
      massFlow: Math.round(massFlow * 1000) / 1000,
      airflow,
      inletTemp,
      targetTemp
    };
  }
  
  /**
   * 选择最佳再热方式
   */
  selectReheatMethod(powerRequirement, availableSources) {
    const methods = [];
    
    // 评估每种方式
    for (const [key, config] of Object.entries(this.REHEAT_METHODS)) {
      let suitable = true;
      let capacity = 0;
      let priority = config.priority;
      
      // 检查可用性和容量
      switch (key) {
        case 'hot_water':
          if (availableSources.hotWater) {
            capacity = 3000; // 假设热水盘管最大3kW
          } else {
            suitable = false;
          }
          break;
          
        case 'electric':
          capacity = config.maxPower;
          break;
          
        case 'heat_pump':
          if (availableSources.heatPump) {
            capacity = config.maxPower * config.cop;
          } else {
            priority += 2; // 降低优先级
            capacity = config.maxPower * config.cop;
          }
          break;
      }
      
      // 评估适用性
      if (suitable) {
        methods.push({
          type: key,
          name: config.name,
          priority,
          capacity,
          canMeetDemand: capacity >= powerRequirement,
          efficiency: config.efficiency,
          responseTime: config.responseTime,
          advantage: config.advantage
        });
      }
    }
    
    // 排序：优先级高、能满足需求的优先
    methods.sort((a, b) => {
      if (a.canMeetDemand && !b.canMeetDemand) return -1;
      if (!a.canMeetDemand && b.canMeetDemand) return 1;
      return a.priority - b.priority;
    });
    
    return {
      recommended: methods[0] || null,
      alternatives: methods.slice(1),
      powerRequirement
    };
  }
  
  /**
   * PID控制器
   */
  pidControl(setpoint, input, lastError, integral) {
    const { Kp, Ki, Kd, sampleTime, outputMin, outputMax } = this.PID_PARAMS;
    
    // 计算误差
    const error = setpoint - input;
    
    // 积分项
    integral += error * sampleTime;
    integral = Math.max(outputMin, Math.min(outputMax, integral)); // 防止积分饱和
    
    // 微分项
    const derivative = (error - lastError) / sampleTime;
    
    // PID输出
    let output = Kp * error + Ki * integral + Kd * derivative;
    
    // 限制输出范围
    output = Math.max(outputMin, Math.min(outputMax, output));
    
    return {
      output: Math.round(output),
      error,
      integral,
      derivative
    };
  }
  
  /**
   * 热水盘管控制
   */
  controlHotWaterCoil(params) {
    const {
      supplyTemp,        // 供水温度
      returnTemp,        // 回水温度
      flowRate,          // 水流量 L/min
      targetAirTemp,     // 目标送风温度
      currentAirTemp     // 当前送风温度
    } = params;
    
    // 计算水温调节需求
    const tempDiff = supplyTemp - returnTemp;
    const heatTransfer = flowRate * 4.18 * tempDiff / 60; // kW
    
    // 调节水流量或混合阀
    let adjustment = 0;
    if (currentAirTemp < targetAirTemp - 0.5) {
      adjustment = +10; // 增加热量
    } else if (currentAirTemp > targetAirTemp + 0.5) {
      adjustment = -10; // 减少热量
    }
    
    return {
      method: 'hot_water',
      heatTransfer: Math.round(heatTransfer * 1000), // W
      tempDiff,
      adjustment,
      valvePosition: 50 + adjustment, // %
      pumpSpeed: 50 + adjustment / 2 // %
    };
  }
  
  /**
   * 电加热控制
   */
  controlElectricHeater(params) {
    const {
      targetTemp,
      currentTemp,
      stages = [1000, 2000, 3000]  // 三档功率 W
    } = params;
    
    // PID计算
    const pid = this.pidControl(targetTemp, currentTemp, 0, 0);
    const output = pid.output; // 0-100%
    
    // 根据输出选择档位
    let activeStage = 0;
    let power = 0;
    
    if (output < 33) {
      activeStage = 1;
      power = stages[0];
    } else if (output < 66) {
      activeStage = 2;
      power = stages[1];
    } else {
      activeStage = 3;
      power = stages[2];
    }
    
    // 计算能耗
    const hourlyConsumption = (power / 1000) * (output / 100); // kWh
    
    return {
      method: 'electric',
      activeStage,
      power,
      pidOutput: output,
      dutyCycle: output, // %
      hourlyConsumption: hourlyConsumption.toFixed(2),
      status: power > 0 ? 'heating' : 'standby'
    };
  }
  
  /**
   * 热泵再热控制
   */
  controlHeatPump(params) {
    const {
      targetTemp,
      currentTemp,
      refrigerantTemp,   // 制冷剂温度
      ambientTemp        // 环境温度
    } = params;
    
    // COP随环境温度变化
    const cop = this.calculateCOP(ambientTemp);
    
    // 计算需求
    const tempDiff = targetTemp - currentTemp;
    const requiredPower = tempDiff * 100; // 简化计算 W
    
    // 压缩机频率调节
    const compressorSpeed = Math.min(100, Math.max(20, tempDiff * 10));
    
    // 实际制热量
    const actualHeatOutput = (requiredPower / 1000) * cop; // kW
    
    // 电耗 (考虑COP)
    const electricConsumption = requiredPower / cop; // W
    
    return {
      method: 'heat_pump',
      cop: cop.toFixed(2),
      compressorSpeed: Math.round(compressorSpeed),
      heatOutput: actualHeatOutput.toFixed(2),
      electricConsumption: Math.round(electricConsumption),
      efficiency: 'high',
      savings: `${((1 - 1/cop) * 100).toFixed(0)}%` // 相比电加热节省
    };
  }
  
  /**
   * 计算COP（性能系数）
   */
  calculateCOP(ambientTemp) {
    // 简化模型：COP随环境温度升高而增加
    const baseCOP = 2.5;
    const tempBonus = (ambientTemp - 20) * 0.03;
    return Math.max(2.0, Math.min(4.0, baseCOP + tempBonus));
  }
  
  /**
   * 与Rheem壁挂炉/热水器联动
   */
  coordinateWithRheemWaterHeater(waterHeaterData) {
    const {
      type,              // 'boiler' | 'water_heater'
      currentTemp,
      setTemp,
      capacity,
      status             // 'heating' | 'standby' | 'idle'
    } = waterHeaterData;
    
    // 判断是否可利用余热
    const canUseWasteHeat = currentTemp > setTemp + 5 || status === 'idle';
    
    // 计算可用余热量
    let availableHeat = 0;
    if (canUseWasteHeat) {
      // 假设可回收10-20%的余热
      availableHeat = capacity * 0.15;
    }
    
    return {
      canUseWasteHeat,
      availableHeat: Math.round(availableHeat), // W
      coordination: {
        enableReheat: canUseWasteHeat,
        priority: 'use_waste_heat_first',
        backup: 'electric_heater'
      },
      rheemAdvantage: 'Rheem系统智能联动，优先利用余热'
    };
  }
  
  /**
   * 综合控制策略
   */
  optimizeControl(params) {
    const {
      mode,              // 'doas' | 'comfort'
      season,            // 'summer' | 'winter'
      inletTemp,
      targetTemp,
      airflow,
      availableSources   // {hotWater, heatPump, electric}
    } = params;
    
    // 1. 计算功率需求
    const powerCalc = this.calculateReheatPower({
      airflow,
      inletTemp,
      targetTemp,
      inletHumidity: 95
    });
    
    // 2. 选择最佳再热方式
    const methodSelection = this.selectReheatMethod(
      powerCalc.requiredPower,
      availableSources
    );
    
    // 3. 执行控制
    let controlResult;
    const selectedMethod = methodSelection.recommended?.type || 'electric';
    
    switch (selectedMethod) {
      case 'hot_water':
        controlResult = this.controlHotWaterCoil({
          supplyTemp: 45,
          returnTemp: 35,
          flowRate: 10,
          targetAirTemp: targetTemp,
          currentAirTemp: inletTemp
        });
        break;
        
      case 'electric':
        controlResult = this.controlElectricHeater({
          targetTemp,
          currentTemp: inletTemp
        });
        break;
        
      case 'heat_pump':
        controlResult = this.controlHeatPump({
          targetTemp,
          currentTemp: inletTemp,
          refrigerantTemp: 35,
          ambientTemp: 25
        });
        break;
    }
    
    return {
      timestamp: new Date().toISOString(),
      mode,
      season,
      powerCalculation: powerCalc,
      methodSelection,
      control: controlResult,
      status: this.status,
      efficiency: {
        method: selectedMethod,
        powerUsage: controlResult?.power || controlResult?.heatTransfer || 0,
        effectiveness: 'high'
      }
    };
  }
  
  /**
   * 能耗分析
   */
  analyzeEnergyConsumption(hourlyData) {
    const analysis = {
      totalHours: hourlyData.length,
      totalConsumption: 0,
      averagePower: 0,
      peakPower: 0,
      costEstimate: 0
    };
    
    let totalPower = 0;
    let peak = 0;
    
    for (const hour of hourlyData) {
      const power = hour.power || 0;
      totalPower += power;
      peak = Math.max(peak, power);
      analysis.totalConsumption += (power / 1000); // kWh
    }
    
    analysis.averagePower = Math.round(totalPower / hourlyData.length);
    analysis.peakPower = peak;
    analysis.costEstimate = Math.round(analysis.totalConsumption * 0.6); // 假设0.6元/kWh
    
    return analysis;
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      methods: Object.keys(this.REHEAT_METHODS),
      pidParams: this.PID_PARAMS,
      capabilities: [
        '再热功率精确计算',
        '多种再热方式控制',
        'PID温度控制',
        '与Rheem壁挂炉联动',
        '能耗优化分析'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ReheatModuleEngine;
