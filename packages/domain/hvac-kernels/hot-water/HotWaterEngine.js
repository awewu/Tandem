/**
 * 热水系统计算引擎 - HotWaterEngine
 * 住宅/商业热水负荷计算、设备选型、管路设计
 */

class HotWaterEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'HotWaterEngine';
    this.waterTemp = {
      cold: 10,      // 冷水温度 °C
      hot: 60,       // 热水温度 °C
      use: 40        // 使用温度 °C
    };
  }

  /**
   * 计算住宅热水负荷
   * @param {Object} params - 计算参数
   * @param {number} params.rooms - 房间数
   * @param {number} params.persons - 人数
   * @param {number} params.bathrooms - 卫生间数
   * @param {boolean} params.hasBathtub - 是否有浴缸
   * @param {string} params.buildingType - 住宅类型: apartment/villa/commercial
   */
  calculateResidential(params) {
    const { rooms, persons, bathrooms, hasBathtub, buildingType = 'apartment' } = params;
    
    console.log('[HotWaterEngine] 计算住宅热水负荷...');
    
    // 用水量标准 (L/人·天)
    const waterUsagePerPerson = buildingType === 'villa' ? 80 : 
                                buildingType === 'apartment' ? 60 : 50;
    
    // 日用水量
    const dailyUsage = persons * waterUsagePerPerson;
    
    // 峰值用水量 (1小时内最大用水量，取日用水量的40%)
    const peakHourlyUsage = dailyUsage * 0.4;
    
    // 热水负荷计算
    // Q = c * m * ΔT / t
    // c = 4.18 kJ/kg·K, ΔT = 60-10 = 50K
    const heatCapacity = 4.18; // kJ/kg·K
    const deltaT = this.waterTemp.hot - this.waterTemp.cold; // 50°C
    
    // 设计小时耗热量 (kW)
    const hourlyHeatLoad = (peakHourlyUsage * heatCapacity * deltaT) / 3600;
    
    // 热水器容量计算 (考虑20分钟持续供水)
    const storageVolume = peakHourlyUsage * (20/60);
    
    // 设备选型
    const heaterSelection = this.selectHeater(hourlyHeatLoad, storageVolume, buildingType);
    
    // 循环流量计算 (避免冷水段)
    const circulationFlow = this.calculateCirculationFlow(dailyUsage, bathrooms);
    
    // 管径计算
    const pipeSizing = this.calculatePipeSizing(peakHourlyUsage, hourlyHeatLoad, bathrooms);
    
    return {
      load: {
        dailyUsage: Math.round(dailyUsage),           // 日用水量 L
        peakHourlyUsage: Math.round(peakHourlyUsage), // 峰值用水量 L/h
        heatLoad: hourlyHeatLoad.toFixed(2),          // 设计小时耗热量 kW
        storageVolume: Math.round(storageVolume)      // 储水容积 L
      },
      heater: heaterSelection,
      circulation: circulationFlow,
      pipes: pipeSizing,
      recommendations: this.generateRecommendations(params, hourlyHeatLoad)
    };
  }

  /**
   * 计算商业热水负荷
   * @param {Object} params - 商业建筑参数
   * @param {string} params.buildingType - 建筑类型: hotel/hospital/gym/restaurant
   * @param {number} params.beds - 床位数/客房数
   * @param {number} params.seats - 座位数
   * @param {number} params.area - 建筑面积 m²
   */
  calculateCommercial(params) {
    const { buildingType, beds = 0, seats = 0, area = 0 } = params;
    
    console.log(`[HotWaterEngine] 计算${buildingType}商业热水负荷...`);
    
    // 用水定额标准 (L/单位·天)
    const usageStandards = {
      hotel: { perBed: 120, name: '客房' },
      hospital: { perBed: 150, name: '床位' },
      gym: { perSeat: 50, name: '淋浴位' },
      restaurant: { perSeat: 15, name: '餐位' },
      office: { perArea: 5, name: 'm²' } // L/m²·天
    };
    
    const standard = usageStandards[buildingType] || usageStandards.office;
    
    let dailyUsage = 0;
    if (beds > 0) dailyUsage = beds * standard.perBed;
    else if (seats > 0) dailyUsage = seats * standard.perSeat;
    else if (area > 0) dailyUsage = area * (standard.perArea || 5);
    
    // 商业建筑峰值系数更高
    const peakFactor = buildingType === 'hotel' ? 0.6 : 
                      buildingType === 'hospital' ? 0.5 : 0.7;
    
    const peakHourlyUsage = dailyUsage * peakFactor;
    
    // 小时耗热量
    const heatCapacity = 4.18;
    const deltaT = this.waterTemp.hot - this.waterTemp.cold;
    const hourlyHeatLoad = (peakHourlyUsage * heatCapacity * deltaT) / 3600;
    
    // 储水容积 (商业建筑考虑连续使用)
    const storageVolume = peakHourlyUsage * 0.5; // 30分钟储水
    
    // 设备选型 (商业需要冗余)
    const heaterSelection = this.selectCommercialHeater(hourlyHeatLoad, storageVolume, buildingType);
    
    // 管路计算
    const pipeSizing = this.calculateCommercialPipes(peakHourlyUsage, buildingType, beds || seats);
    
    return {
      load: {
        dailyUsage: Math.round(dailyUsage),
        peakHourlyUsage: Math.round(peakHourlyUsage),
        heatLoad: hourlyHeatLoad.toFixed(2),
        storageVolume: Math.round(storageVolume),
        buildingType,
        calculationBasis: `${beds} ${standard.name}`
      },
      heater: heaterSelection,
      pipes: pipeSizing,
      recommendations: this.generateCommercialRecommendations(buildingType, hourlyHeatLoad)
    };
  }

  /**
   * 热水器选型
   */
  selectHeater(heatLoad, storageVolume, buildingType) {
    // 燃气热水器选型
    const gasHeaters = [
      { model: 'JSQ20-10', capacity: 10, power: 20, flowRate: 10, type: '即热式' },
      { model: 'JSQ24-12', capacity: 12, power: 24, flowRate: 12, type: '即热式' },
      { model: 'JSQ32-16', capacity: 16, power: 32, flowRate: 16, type: '即热式' },
      { model: 'L1PB20-20', capacity: 80, power: 20, flowRate: 10, type: '壁挂炉' },
      { model: 'L1PB24-24', capacity: 120, power: 24, flowRate: 12, type: '壁挂炉' },
      { model: 'L1PB32-32', capacity: 150, power: 32, flowRate: 16, type: '壁挂炉' }
    ];
    
    // 电热水器选型
    const elecHeaters = [
      { model: 'E40-V1', capacity: 40, power: 2, flowRate: null, type: '储水式' },
      { model: 'E60-V1', capacity: 60, power: 3, flowRate: null, type: '储水式' },
      { model: 'E80-V1', capacity: 80, power: 3, flowRate: null, type: '储水式' },
      { model: 'E100-V1', capacity: 100, power: 3, flowRate: null, type: '储水式' }
    ];
    
    // 空气能选型
    const heatPumpHeaters = [
      { model: 'RSJ-20/100R', capacity: 100, power: 0.8, cop: 4.0, flowRate: null, type: '空气能' },
      { model: 'RSJ-35/200R', capacity: 200, power: 1.2, cop: 4.2, flowRate: null, type: '空气能' },
      { model: 'RSJ-72/300R', capacity: 300, power: 2.0, cop: 4.5, flowRate: null, type: '空气能' }
    ];
    
    // 选择逻辑
    let selection = {};
    let alternatives = [];
    
    // 别墅或大户型推荐
    if (buildingType === 'villa' || heatLoad > 25) {
      selection = heatPumpHeaters.find(h => h.power >= heatLoad * 0.3) || heatPumpHeaters[2];
      alternatives = gasHeaters.filter(g => g.power >= heatLoad).slice(0, 2);
    }
    // 普通住宅
    else if (heatLoad > 15) {
      selection = gasHeaters.find(g => g.power >= heatLoad) || gasHeaters[3];
      alternatives = elecHeaters.filter(e => e.capacity >= storageVolume).slice(0, 2);
    }
    // 小户型
    else {
      if (storageVolume <= 60) {
        selection = elecHeaters.find(e => e.capacity >= storageVolume) || elecHeaters[1];
      } else {
        selection = gasHeaters.find(g => g.flowRate >= 12) || gasHeaters[1];
      }
      alternatives = gasHeaters.filter(g => g.power >= heatLoad).slice(0, 2);
    }
    
    return {
      recommended: selection,
      alternatives: alternatives,
      selectionReason: this.getHeaterReason(selection, heatLoad, storageVolume, buildingType)
    };
  }

  /**
   * 商业热水器选型
   */
  selectCommercialHeater(heatLoad, storageVolume, buildingType) {
    // 商业专用热水设备
    const commercialHeaters = [
      { model: 'CLDR0.05-85/60', capacity: 500, power: 50, type: '商用容积式', fuel: '电' },
      { model: 'CLDR0.1-85/60', capacity: 1000, power: 100, type: '商用容积式', fuel: '电' },
      { model: 'CWNS0.35-95/70', capacity: 2000, power: 350, type: '商用燃气锅炉', fuel: '天然气' },
      { model: 'CWNS0.7-95/70', capacity: 4000, power: 700, type: '商用燃气锅炉', fuel: '天然气' },
      { model: 'RSJ-380/S-820', capacity: 3000, power: 380, cop: 4.5, type: '商用空气能', fuel: '电' }
    ];
    
    // 冗余系数 (商业需要备份)
    const redundancyFactor = 1.2;
    const requiredPower = heatLoad * redundancyFactor;
    
    const selection = commercialHeaters.find(h => h.power >= requiredPower) || commercialHeaters[commercialHeaters.length - 1];
    
    // 推荐双机备份
    const backupUnits = buildingType === 'hospital' ? 2 : 1;
    
    return {
      recommended: selection,
      backupUnits: backupUnits,
      totalCapacity: selection.capacity * backupUnits,
      totalPower: selection.power * backupUnits,
      fuelType: selection.fuel,
      annualCostEstimate: this.estimateAnnualCost(selection, heatLoad, buildingType)
    };
  }

  /**
   * 计算热水循环流量
   */
  calculateCirculationFlow(dailyUsage, bathrooms) {
    // 循环流量按设计秒流量的5-10%
    // 或按管网热损失计算 (通常 0.5-1.0 L/s)
    
    const baseFlow = 0.3; // L/s 基础流量
    const bathroomFactor = bathrooms * 0.1;
    
    const circulationFlow = Math.max(baseFlow, bathroomFactor);
    const circulationPumpHead = 5; // m 循环泵扬程
    
    return {
      flowRate: circulationFlow.toFixed(2), // L/s
      hourlyFlow: (circulationFlow * 3.6).toFixed(1), // m³/h
      pumpHead: circulationPumpHead,
      recommendedPump: this.selectCirculationPump(circulationFlow, circulationPumpHead)
    };
  }

  /**
   * 住宅管径计算
   */
  calculatePipeSizing(peakHourlyUsage, heatLoad, bathrooms) {
    // 设计秒流量计算 (L/s)
    const q = peakHourlyUsage / 3600;
    
    // 经济流速 0.8-1.2 m/s
    const velocity = 1.0;
    
    // 管径计算 D = √(4Q/πv)
    const requiredArea = q / velocity / 1000; // m²
    const requiredDiameter = Math.sqrt(requiredArea * 4 / Math.PI) * 1000; // mm
    
    // 标准化管径选择
    const standardSizes = [15, 20, 25, 32, 40, 50];
    const selectedDiameter = standardSizes.find(d => d >= requiredDiameter) || 50;
    
    // 分支管径
    const branchDiameter = standardSizes.find(d => d >= selectedDiameter * 0.6) || 20;
    
    return {
      mainPipe: {
        diameter: selectedDiameter,
        flowRate: q.toFixed(2),
        velocity: velocity.toFixed(2),
        material: 'PPR',
        insulation: '橡塑保温 20mm'
      },
      branchPipe: {
        diameter: branchDiameter,
        material: 'PPR',
        insulation: '橡塑保温 15mm'
      },
      circulationPipe: {
        diameter: 20,
        material: 'PPR',
        note: '回水管'
      }
    };
  }

  /**
   * 商业管路计算
   */
  calculateCommercialPipes(peakHourlyUsage, buildingType, units) {
    const q = peakHourlyUsage / 3600;
    const velocity = 1.2; // 商业稍高速
    
    const requiredArea = q / velocity / 1000;
    const requiredDiameter = Math.sqrt(requiredArea * 4 / Math.PI) * 1000;
    
    const standardSizes = [25, 32, 40, 50, 65, 80, 100];
    const selectedDiameter = standardSizes.find(d => d >= requiredDiameter) || 100;
    
    return {
      mainPipe: {
        diameter: selectedDiameter,
        flowRate: q.toFixed(2),
        velocity: velocity.toFixed(2),
        material: '镀锌钢管/衬塑钢管',
        pressure: '1.0MPa',
        insulation: '岩棉/橡塑 30mm'
      },
      distribution: {
        diameter: Math.min(selectedDiameter, 50),
        material: 'PPR/钢管',
        note: '分区供水管'
      },
      circulation: {
        diameter: 25,
        material: 'PPR',
        note: '机械循环回水管'
      }
    };
  }

  /**
   * 选型理由
   */
  getHeaterReason(heater, heatLoad, storageVolume, buildingType) {
    const reasons = [];
    
    if (heater.type === '空气能') {
      reasons.push(`COP=${heater.cop}，比电热水器节能75%`);
      reasons.push('适合大水量需求');
    } else if (heater.type === '壁挂炉') {
      reasons.push('供暖+热水两用，一机两用');
      reasons.push('即开即热，无需等待');
    } else if (heater.type === '即热式') {
      reasons.push('体积小巧，节省空间');
      reasons.push('无限热水供应');
    } else {
      reasons.push(`储水容积${heater.capacity}L，满足${storageVolume.toFixed(0)}L需求`);
      reasons.push('安装简单，维护方便');
    }
    
    if (buildingType === 'villa') {
      reasons.push('别墅大户型首选方案');
    }
    
    return reasons;
  }

  /**
   * 选择循环泵
   */
  selectCirculationPump(flowRate, head) {
    const pumps = [
      { model: 'RS15/6', power: 0.08, flow: 1.5, head: 6 },
      { model: 'RS25/6', power: 0.12, flow: 2.5, head: 6 },
      { model: 'RS25/8', power: 0.25, flow: 2.5, head: 8 }
    ];
    
    const flowM3h = flowRate * 3.6;
    const selection = pumps.find(p => p.flow >= flowM3h && p.head >= head) || pumps[1];
    
    return selection;
  }

  /**
   * 估算年运行成本
   */
  estimateAnnualCost(heater, heatLoad, buildingType) {
    const operatingHours = buildingType === 'hotel' ? 365 * 16 : 365 * 8; // 小时/年
    const annualEnergy = heatLoad * operatingHours; // kWh
    
    const fuelPrices = {
      electricity: 0.6, // 元/kWh
      gas: 3.5 // 元/m³, 按热值换算约0.1元/kWh
    };
    
    let cost = 0;
    if (heater.fuel === '电') {
      cost = annualEnergy * fuelPrices.electricity;
      if (heater.cop) cost = cost / heater.cop; // 空气能COP修正
    } else if (heater.fuel === '天然气') {
      cost = annualEnergy * 0.1; // 简化计算
    }
    
    return {
      annualKWh: Math.round(annualEnergy),
      annualCost: Math.round(cost),
      currency: 'CNY'
    };
  }

  /**
   * 生成住宅建议
   */
  generateRecommendations(params, heatLoad) {
    const recommendations = [];
    
    if (heatLoad > 25) {
      recommendations.push('建议采用空气能热水器+电辅热方案，节能环保');
      recommendations.push('推荐安装热水循环系统，即开即热');
    } else if (heatLoad > 15) {
      recommendations.push('建议采用燃气壁挂炉，供暖热水两用');
      recommendations.push('如已有供暖系统，可选用即热式燃气热水器');
    } else {
      recommendations.push('小户型推荐使用储水式电热水器，安装简便');
    }
    
    if (params.hasBathtub) {
      recommendations.push('有浴缸需确保热水器连续供水量≥150L，或选用大容量储水式');
    }
    
    if (params.bathrooms >= 2) {
      recommendations.push('多卫生间建议安装热水循环系统，避免冷水等待');
    }
    
    recommendations.push('热水管建议采用PPR管，耐温95°C，寿命50年');
    recommendations.push('管外包橡塑保温，厚度≥15mm，减少热损失');
    
    return recommendations;
  }

  /**
   * 生成商业建议
   */
  generateCommercialRecommendations(buildingType, heatLoad) {
    const recommendations = [];
    
    recommendations.push(`${buildingType}建筑需24小时热水供应，建议采用容积式热水设备`);
    recommendations.push('必须设置双机备份，确保故障时仍有热水供应');
    recommendations.push('推荐采用机械循环系统，保证即开即热');
    
    if (buildingType === 'hotel') {
      recommendations.push('酒店客房建议单独循环支路，便于分时段控制');
      recommendations.push('大堂、餐厅等公共区域可设置独立热水系统');
    }
    
    if (buildingType === 'hospital') {
      recommendations.push('医院必须保证全天候恒温供水，建议设置3台设备（2用1备）');
      recommendations.push('热水系统需与消毒系统联动，确保用水安全');
    }
    
    recommendations.push('商业系统建议安装热量表，便于能耗管理');
    recommendations.push('定期清洗水垢，保持系统效率');
    
    return recommendations;
  }

  /**
   * 快速估算接口
   */
  quickEstimate(buildingType, area, persons) {
    if (buildingType === 'residential') {
      return this.calculateResidential({
        rooms: Math.ceil(area / 30),
        persons: persons || Math.ceil(area / 30 * 2),
        bathrooms: Math.ceil(area / 60),
        hasBathtub: area > 100,
        buildingType: area > 150 ? 'villa' : 'apartment'
      });
    } else {
      return this.calculateCommercial({
        buildingType,
        beds: buildingType === 'hotel' ? persons : 0,
        seats: buildingType === 'restaurant' ? persons : 0,
        area
      });
    }
  }
}

module.exports = HotWaterEngine;
