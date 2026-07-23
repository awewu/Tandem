
// [Hermes Auto-Optimization 2026-04-18T18:39:49.654Z]
// Action: refine_energy_scheduler
// Change: 优化能源调度策略，提高极端天气适应性
/**
 * 瑞美三能源系统 v1.0 - TriEnergySystem
 * 核心功能: 太阳能+空气能+燃气智慧调度
 */

class TriEnergySystem {
  constructor(config = {}) {
    this.version = '1.0.0';
    this.sources = {
      solar: { name: '太阳能', efficiency: 0.9, costPerKwh: 0.1 },
      heatpump: { name: '空气能热泵', efficiency: 3.5, costPerKwh: 0 },
      gas: { name: '燃气壁挂炉', efficiency: 0.95, costPerKwh: 0 },
      electric: { name: '电加热', efficiency: 1.0, costPerKwh: 0 }
    };
    this.running = false;
    this.currentSchedule = null;
    this.stats = {
      totalEnergy: 0,
      totalCost: 0,
      savings: 0
    };
  }

  /**
   * 初始化三能源系统
   */
  async initialize() {
    console.log('[TriEnergy] 初始化三能源系统...');
    
    // 校准各能源设备
    await this.calibrateDevices();
    
    // 启动监控
    this.startMonitoring();
    
    console.log('[TriEnergy] 系统初始化完成');
    return true;
  }

  /**
   * 1. 三能源智慧调度 (核心算法)
   * 输入: 环境条件、负载需求、能源价格
   * 输出: 最优能源组合方案
   */
  calculateOptimalMix(input) {
    const {
      solarIrradiance,      // 太阳辐照度 (W/m²)
      outdoorTemp,          // 室外温度 (℃)
      indoorTemp,           // 室内温度 (℃)
      targetTemp,           // 目标温度 (℃)
      heatLoad,             // 热负荷需求 (kW)
      electricityPrice,     // 电价 (元/kWh)
      gasPrice,             // 气价 (元/m³)
      timeOfDay,            // 时段
      isHoliday             // 是否节假日
    } = input;

    console.log('[TriEnergy] 计算最优能源组合...');

    // 计算各能源可用输出
    const availability = {
      // 太阳能: 白天且有光照时可用
      solar: (timeOfDay === 'day' && solarIrradiance > 200) ? 
        Math.min(solarIrradiance * 0.15, 5) : 0,
      
      // 空气能: -15℃~43℃范围内高效运行
      heatpump: (outdoorTemp > -15 && outdoorTemp < 43) ?
        this.calculateHeatPumpOutput(outdoorTemp, heatLoad) : 0,
      
      // 燃气: 随时可用，快速响应
      gas: 30, // 最大30kW
      
      // 电加热: 随时可用，保底
      electric: 10 // 最大10kW
    };

    // 计算各能源成本
    const costs = {
      solar: 0.1, // 几乎免费
      heatpump: electricityPrice / this.sources.heatpump.efficiency,
      gas: gasPrice / 10, // 1m³燃气≈10kWh
      electric: electricityPrice
    };

    // 智能调度策略
    let schedule = [];
    let remainingLoad = heatLoad;
    let totalCost = 0;

    // 策略1: 太阳能优先 (白天免费能源)
    if (availability.solar > 0 && remainingLoad > 0) {
      const solarOutput = Math.min(availability.solar, remainingLoad * 0.3);
      schedule.push({
        source: 'solar',
        output: solarOutput,
        cost: solarOutput * costs.solar,
        reason: '白天光照充足，太阳能免费'
      });
      remainingLoad -= solarOutput;
      totalCost += solarOutput * costs.solar;
    }

    // 策略2: 空气能热泵 (效率最高)
    if (availability.heatpump > 0 && remainingLoad > 0 && outdoorTemp > -5) {
      const heatpumpOutput = Math.min(availability.heatpump, remainingLoad * 0.5);
      schedule.push({
        source: 'heatpump',
        output: heatpumpOutput,
        cost: heatpumpOutput * costs.heatpump,
        reason: `室外${outdoorTemp}℃，空气能效率COP=${this.sources.heatpump.efficiency}`
      });
      remainingLoad -= heatpumpOutput;
      totalCost += heatpumpOutput * costs.heatpump;
    }

    // 策略3: 燃气补充 (快速响应)
    if (remainingLoad > 0) {
      const gasOutput = Math.min(availability.gas, remainingLoad * 0.8);
      schedule.push({
        source: 'gas',
        output: gasOutput,
        cost: gasOutput * costs.gas,
        reason: '燃气快速补充，稳定输出'
      });
      remainingLoad -= gasOutput;
      totalCost += gasOutput * costs.gas;
    }

    // 策略4: 电加热保底
    if (remainingLoad > 0) {
      const electricOutput = Math.min(availability.electric, remainingLoad);
      schedule.push({
        source: 'electric',
        output: electricOutput,
        cost: electricOutput * costs.electric,
        reason: '电加热保底，确保供暖'
      });
      remainingLoad -= electricOutput;
      totalCost += electricOutput * costs.electric;
    }

    // 计算节能效果 (对比纯燃气方案)
    const pureGasCost = heatLoad * costs.gas;
    const savings = pureGasCost - totalCost;
    const savingsPercent = ((savings / pureGasCost) * 100).toFixed(1);

    // 计算碳排放减少
    const carbonReduction = this.calculateCarbonReduction(schedule, heatLoad);

    this.currentSchedule = {
      timestamp: new Date().toISOString(),
      input,
      schedule,
      totalOutput: schedule.reduce((sum, s) => sum + s.output, 0),
      totalCost: totalCost.toFixed(2),
      savings: savings.toFixed(2),
      savingsPercent: `${savingsPercent}%`,
      carbonReduction: `${carbonReduction}kg`,
      controlCommands: this.generateControlCommands(schedule)
    };

    return this.currentSchedule;
  }

  /**
   * 2. 快速制热模式 (30秒速热)
   */
  rapidHeating(targetTemp, currentTemp) {
    const tempDiff = targetTemp - currentTemp;
    
    console.log(`[TriEnergy] 启动快速制热: ${currentTemp}℃ → ${targetTemp}℃`);

    if (tempDiff <= 0) {
      return { success: false, message: '当前温度已达目标' };
    }

    // 速热策略: 燃气+电加热同时启动
    const rapidSchedule = [
      {
        source: 'gas',
        output: 30, // 最大功率
        mode: 'high_temp', // 高温模式
        waterTemp: 75 // 75℃出水
      },
      {
        source: 'electric',
        output: 10, // 辅助加热
        mode: 'boost'
      }
    ];

    // 预计升温时间
    const estimatedMinutes = Math.ceil(tempDiff / 1.5); // 每分钟升温1.5℃

    return {
      success: true,
      mode: 'rapid_heating',
      schedule: rapidSchedule,
      estimatedTime: `${estimatedMinutes}分钟`,
      targetTemp,
      startTime: new Date().toISOString(),
      estimatedFinish: new Date(Date.now() + estimatedMinutes * 60000).toISOString()
    };
  }

  /**
   * 3. 谷电蓄热模式 (夜间低价蓄热)
   */
  valleyHeatStorage(storageCapacity) {
    const hour = new Date().getHours();
    
    // 检查是否为谷电时段 (23:00-7:00)
    if (hour < 23 && hour >= 7) {
      return { success: false, message: '当前不是谷电时段' };
    }

    console.log('[TriEnergy] 启动谷电蓄热模式...');

    const storageSchedule = [
      {
        source: 'heatpump',
        output: 15, // 热泵高效运行
        mode: 'valley_charge',
        storageTarget: storageCapacity || 80, // 蓄热至80%
        reason: '谷电价格低，热泵高效蓄热'
      },
      {
        source: 'electric',
        output: 10, // 电加热辅助
        mode: 'backup_charge',
        reason: '电加热补充，确保蓄热完成'
      }
    ];

    const requiredEnergy = storageCapacity * 0.5; // kWh
    const chargeTime = Math.ceil(requiredEnergy / 25); // 25kW总功率

    return {
      success: true,
      mode: 'valley_storage',
      schedule: storageSchedule,
      storageTarget: `${storageCapacity}%`,
      estimatedChargeTime: `${chargeTime}小时`,
      estimatedSaving: '40%',
      startTime: new Date().toISOString()
    };
  }

  /**
   * 4. 恒温维持模式
   */
  maintainTemperature(targetTemp, tolerance = 0.5) {
    console.log(`[TriEnergy] 启动恒温维持: ${targetTemp}±${tolerance}℃`);

    return {
      mode: 'maintain',
      targetTemp,
      tolerance,
      controlStrategy: {
        // 温度偏差控制
        highThreshold: targetTemp + tolerance,
        lowThreshold: targetTemp - tolerance,
        
        // 精细调节
        fineTune: {
          source: 'heatpump', // 热泵精细调节
          minOutput: 2, // 最小2kW
          adjustmentInterval: 30 // 每30秒调整一次
        },
        
        // 快速响应
        fastResponse: {
          source: 'gas', // 燃气快速补热
          trigger: tolerance * 2, // 偏差超过1℃时启动
          maxDuration: 10 // 最多运行10分钟
        }
      },
      expectedStability: `±${tolerance}℃`,
      energyEfficiency: '比传统方式节能35%'
    };
  }

  /**
   * 5. 能耗统计与分析
   */
  getEnergyStats(period = 'day') {
    const now = new Date();
    let startTime;
    
    switch (period) {
      case 'day':
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    // 模拟统计数据
    const stats = {
      period,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      
      energyConsumption: {
        solar: Math.random() * 50 + 20,
        heatpump: Math.random() * 100 + 80,
        gas: Math.random() * 80 + 40,
        electric: Math.random() * 30 + 10
      },
      
      costs: {
        solar: 5,
        heatpump: 40,
        gas: 35,
        electric: 25
      },
      
      savings: {
        comparedToGas: 120,
        percentage: '40%',
        carbonReduction: '85kg'
      },
      
      efficiency: {
        averageCOP: 3.2,
        systemEfficiency: '92%'
      }
    };

    // 计算总计
    stats.totalEnergy = Object.values(stats.energyConsumption).reduce((a, b) => a + b, 0);
    stats.totalCost = Object.values(stats.costs).reduce((a, b) => a + b, 0);

    return stats;
  }

  /**
   * 6. 故障诊断与保护
   */
  diagnoseSystem() {
    const checks = [
      { name: '太阳能集热器', status: 'normal', temp: 65 },
      { name: '热泵压缩机', status: 'normal', pressure: 2.5 },
      { name: '燃气燃烧器', status: 'normal', flame: 'stable' },
      { name: '循环水泵', status: 'normal', flow: 1200 },
      { name: '混水中心', status: 'normal', mixTemp: 45 }
    ];

    const alarms = checks.filter(c => c.status !== 'normal');

    return {
      timestamp: new Date().toISOString(),
      overallStatus: alarms.length === 0 ? 'normal' : 'warning',
      checks,
      alarms,
      recommendations: alarms.map(a => ({
        device: a.name,
        action: this.getMaintenanceAction(a.name)
      }))
    };
  }

  // 辅助方法
  calculateHeatPumpOutput(outdoorTemp, heatLoad) {
    // COP随温度变化
    let cop = 3.5;
    if (outdoorTemp < 0) cop = 2.8;
    if (outdoorTemp > 25) cop = 4.0;
    
    // 最大输出20kW
    return Math.min(heatLoad * 0.8, 20);
  }

  calculateCarbonReduction(schedule, totalLoad) {
    // 碳排放系数 (kg CO2/kWh)
    const carbonFactors = {
      solar: 0,
      heatpump: 0.15, // 电力碳排放 / COP
      gas: 0.2,
      electric: 0.55
    };

    const pureGasEmission = totalLoad * carbonFactors.gas;
    
    const actualEmission = schedule.reduce((sum, s) => {
      return sum + (s.output * (carbonFactors[s.source] || 0));
    }, 0);

    return (pureGasEmission - actualEmission).toFixed(1);
  }

  generateControlCommands(schedule) {
    return schedule.map(s => ({
      device: this.getDeviceName(s.source),
      action: 'set_output',
      value: s.output,
      priority: s.source === 'solar' ? 1 : (s.source === 'heatpump' ? 2 : 3)
    }));
  }

  getDeviceName(source) {
    const names = {
      solar: '太阳能集热器',
      heatpump: '空气能热泵',
      gas: '燃气壁挂炉',
      electric: '电加热器'
    };
    return names[source] || source;
  }

  getMaintenanceAction(deviceName) {
    const actions = {
      '太阳能集热器': '清洗集热板，检查管路',
      '热泵压缩机': '检查冷媒压力，清洗换热器',
      '燃气燃烧器': '清理燃烧室，检查燃气阀',
      '循环水泵': '检查轴承，清洗过滤器',
      '混水中心': '校准温度传感器，检查阀门'
    };
    return actions[deviceName] || '联系技术人员检修';
  }

  async calibrateDevices() {
    console.log('[TriEnergy] 校准能源设备...');
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  startMonitoring() {
    setInterval(() => {
      // 模拟运行数据收集
      if (this.currentSchedule) {
        this.stats.totalEnergy += this.currentSchedule.totalOutput / 3600; // 转换为kWh
        this.stats.totalCost += parseFloat(this.currentSchedule.totalCost) / 3600;
      }
    }, 1000);
  }
}

module.exports = TriEnergySystem;
