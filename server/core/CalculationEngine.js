/**
 * 瑞美五大系统设计计算引擎 v2.0
 * 涵盖: 热水 | 净水 | 新风 | 制冷 | DOAS
 * 标准: GB 50736, GB 50015, ASHRAE 62.1/90.1
 */

class CalculationEngine {
  constructor() {
    this.version = '2.0.0';
    this.standards = {
      chinese: ['GB 50736', 'GB 50015', 'GB 50176', 'GB 21455'],
      international: ['ASHRAE 62.1', 'ASHRAE 90.1', 'ASHRAE 183', 'ISO 13790']
    };
  }

  // ==================== 1. 热水系统计算 (CALC-HS) ====================
  
  /**
   * 热水用水量计算
   * @param {Object} params - 计算参数
   * @returns {Object} 用水量计算结果
   */
  calculateHotWaterDemand(params) {
    const { buildingType, people, area, bedrooms, bathrooms } = params;
    
    // 用水定额表 (GB 50015-2019)
    const waterQuota = {
      '普通住宅': { daily: 60, unit: '人', kh: 3.0, time: 24 },
      '别墅': { daily: 100, unit: '人', kh: 2.5, time: 24 },
      '宾馆': { daily: 140, unit: '床', kh: 3.0, time: 24 },
      '办公楼': { daily: 8, unit: '人', kh: 1.5, time: 8 }
    };
    
    const quota = waterQuota[buildingType] || waterQuota['普通住宅'];
    
    // 计算人数
    let personCount = people;
    if (!personCount && bedrooms) {
      personCount = bedrooms * 2; // 每卧室2人估算
    }
    
    // 日用水量 (L/d)
    const dailyWater = personCount * quota.daily;
    
    // 时用水量 (L/h)
    const hourlyWater = dailyWater * quota.kh / quota.time;
    
    // 设计秒流量 (L/s)
    const ng = bathrooms * 0.5 + bedrooms * 0.3; // 当量数
    const secondFlow = 0.2 * 2.5 * Math.sqrt(ng);
    
    // 热水量 (60℃)
    const coldTemp = 10; // 冷水温度
    const hotTemp = 60;  // 热水温度
    const useTemp = 40;  // 使用温度
    const hotWaterRatio = (useTemp - coldTemp) / (hotTemp - coldTemp);
    const hotWaterDaily = dailyWater * hotWaterRatio;
    
    return {
      buildingType,
      personCount,
      dailyWater: Math.round(dailyWater),
      hourlyWater: Math.round(hourlyWater),
      secondFlow: secondFlow.toFixed(2),
      hotWaterDaily: Math.round(hotWaterDaily),
      hotWaterHourly: Math.round(hotWaterDaily * quota.kh / quota.time),
      quota,
      standard: 'GB 50015-2019'
    };
  }

  /**
   * 热水热负荷计算
   * @param {Object} params - 计算参数
   * @returns {Object} 热负荷计算结果
   */
  calculateHotWaterHeatLoad(params) {
    const { hourlyWater, hotTemp, coldTemp, useTemp } = params;
    
    const C = 4.187; // 水比热 kJ/(kg·℃)
    const rho = 0.983; // 热水密度 kg/L
    
    // 设计小时耗热量 (kW)
    const Qh = hourlyWater * C * (hotTemp - coldTemp) * rho / 3600;
    
    // 设计小时供热量 (考虑储热)
    const storageTime = 30; // 储热30分钟
    const Vr = hourlyWater * storageTime / 60; // 储热水箱容积
    const Qs = C * (hotTemp - coldTemp) * rho * Vr / (storageTime * 60);
    const Qg = Math.max(0, Qh - Qs / 1000);
    
    return {
      designHeatLoad: Qh.toFixed(2), // kW
      storageVolume: Math.round(Vr), // L
      storageHeat: (Qs / 1000).toFixed(2), // kW
      supplyHeat: Qg.toFixed(2), // kW
      temperature: { hot: hotTemp, cold: coldTemp, use: useTemp }
    };
  }

  /**
   * 热水设备选型
   * @param {Object} params - 计算参数
   * @returns {Object} 设备选型结果
   */
  selectHotWaterEquipment(params) {
    const { heatLoad, buildingType, area } = params;
    const Q = parseFloat(heatLoad);
    
    // 考虑余量
    const QwithMargin = Q * 1.15;
    
    // 设备选型
    const equipment = {
      gasBoiler: {
        type: '燃气壁挂炉',
        power: Math.ceil(QwithMargin),
        efficiency: 0.9,
        description: `${Math.ceil(QwithMargin)}kW两用炉(供暖+热水)`,
        suitable: buildingType === '普通住宅' || buildingType === '别墅',
        standard: 'GB 20665'
      },
      heatPump: {
        type: '空气能热泵',
        power: Math.ceil(QwithMargin / 3.5), // COP=3.5
        cop: 3.5,
        description: `${Math.ceil(QwithMargin/3.5)}kW热泵热水器`,
        suitable: area > 100,
        standard: 'GB/T 23137'
      },
      solar: {
        type: '太阳能+辅助',
        collectorArea: Math.ceil(QwithMargin * 2), // 粗略估算
        auxiliaryPower: Math.ceil(QwithMargin * 0.3),
        description: `${Math.ceil(QwithMargin*2)}㎡集热器+${Math.ceil(QwithMargin*0.3)}kW辅助`,
        suitable: buildingType === '别墅',
        standard: 'GB 50364'
      }
    };
    
    // 推荐方案
    let recommendation = equipment.gasBoiler;
    if (buildingType === '别墅' && area > 200) {
      recommendation = {
        type: '组合方案',
        primary: equipment.solar,
        backup: equipment.gasBoiler,
        description: '太阳能+燃气壁挂炉组合'
      };
    } else if (area > 150) {
      recommendation = equipment.heatPump;
    }
    
    return {
      heatLoad: Q.toFixed(2),
      withMargin: QwithMargin.toFixed(2),
      equipment,
      recommendation,
      tankVolume: Math.ceil(Q * 30) // 估算水箱容积
    };
  }

  // ==================== 2. 净水系统计算 (CALC-WT) ====================

  /**
   * 净水系统流量计算
   * @param {Object} params - 计算参数
   * @returns {Object} 流量计算结果
   */
  calculateWaterTreatmentFlow(params) {
    const { buildingType, people, bathrooms, kitchens } = params;
    
    // 用水定额
    const quotas = {
      '小户型': { daily: 150, unit: '人' },
      '中户型': { daily: 200, unit: '人' },
      '大户型': { daily: 250, unit: '人' },
      '别墅': { daily: 300, unit: '人' }
    };
    
    const quota = quotas[buildingType] || quotas['中户型'];
    
    // 日用水量
    const dailyWater = people * quota.daily;
    
    // 时变化系数 Kh=1.5
    const hourlyWater = dailyWater * 1.5 / 24;
    
    // 秒流量计算
    const ng = bathrooms * 0.5 + kitchens * 0.7;
    const secondFlow = 0.2 * 2.0 * Math.sqrt(ng);
    
    // 净水设备流量 (同时使用系数0.7)
    const treatmentFlow = secondFlow * 0.7;
    
    return {
      dailyWater: Math.round(dailyWater),
      hourlyWater: Math.round(hourlyWater),
      secondFlow: secondFlow.toFixed(2),
      treatmentFlow: treatmentFlow.toFixed(2),
      unit: 'L/s',
      standard: 'GB 50015'
    };
  }

  /**
   * 净水系统配置推荐
   * @param {Object} params - 计算参数
   * @returns {Object} 系统配置
   */
  recommendWaterTreatmentSystem(params) {
    const { area, bathrooms, budget } = params;
    
    const systems = {
      basic: {
        name: '基础3级过滤',
        stages: ['PP棉(5μm)', '活性炭(CTO)', 'RO膜(75G)'],
        flow: '0.2 L/s',
        suitable: area < 80,
        price: '3000-5000'
      },
      standard: {
        name: '标准4级过滤',
        stages: ['PP棉(1μm)', '前置活性炭', 'RO膜(400G)', '后置活性炭'],
        flow: '0.3 L/s',
        suitable: area >= 80 && area < 150,
        price: '5000-8000'
      },
      advanced: {
        name: '全屋5级过滤',
        stages: ['中央净水', '中央软水', 'RO纯水(600G)', '超滤', '管线机'],
        flow: '0.5 L/s',
        suitable: area >= 150,
        price: '15000-25000'
      }
    };
    
    let recommendation = systems.standard;
    if (area < 80) recommendation = systems.basic;
    if (area >= 150) recommendation = systems.advanced;
    if (budget === 'high') recommendation = systems.advanced;
    
    return {
      area,
      bathrooms,
      systems,
      recommendation,
      maintenance: {
        ppFilter: '3-6个月',
        carbonFilter: '6-12个月',
        roMembrane: '2-3年'
      }
    };
  }

  // ==================== 3. 新风系统计算 (CALC-FA) ====================

  /**
   * 新风量计算
   * @param {Object} params - 计算参数
   * @returns {Object} 新风量计算结果
   */
  calculateFreshAirVolume(params) {
    const { rooms, buildingType, totalArea } = params;
    
    // 新风量标准 (GB 50736)
    const freshAirStandard = {
      '卧室': 30,
      '客厅': 30,
      '书房': 30,
      '餐厅': 20,
      '厨房': 20,
      '卫生间': 10
    };
    
    let totalFreshAir = 0;
    const roomDetails = [];
    
    rooms.forEach(room => {
      const standard = freshAirStandard[room.type] || 30;
      const volume = room.people ? room.people * standard : room.area * 1;
      totalFreshAir += volume;
      roomDetails.push({
        name: room.name,
        type: room.type,
        area: room.area,
        people: room.people || 0,
        freshAir: volume
      });
    });
    
    // 换气次数法验证 (住宅0.5-1.0次/h)
    const height = 2.8; // 层高
    const volumeByACH = totalArea * height * 0.7; // 0.7次/h
    
    // 取大值
    const finalFreshAir = Math.max(totalFreshAir, volumeByACH);
    
    return {
      totalFreshAir: Math.round(finalFreshAir),
      byPeople: Math.round(totalFreshAir),
      byACH: Math.round(volumeByACH),
      roomDetails,
      standard: 'GB 50736-2012',
      unit: 'm³/h'
    };
  }

  /**
   * 热回收效率计算
   * @param {Object} params - 计算参数
   * @returns {Object} 热回收计算结果
   */
  calculateHeatRecovery(params) {
    const { 
      outdoorTemp, outdoorHumidity,
      indoorTemp, indoorHumidity,
      flowRate, recoveryType 
    } = params;
    
    // 标准热回收效率
    const efficiency = {
      '转轮式全热': { sre: 0.80, lre: 0.65, type: 'DOAS推荐' },
      '板翅式全热': { sre: 0.65, lre: 0.55, type: '标准' },
      '显热交换': { sre: 0.60, lre: 0, type: '经济型' }
    };
    
    const selected = efficiency[recoveryType] || efficiency['板翅式全热'];
    
    // 计算送风温度
    const supplyTemp = outdoorTemp + selected.sre * (indoorTemp - outdoorTemp);
    
    // 计算含湿量 (简化公式)
    const outdoorDew = this.calculateDewPoint(outdoorTemp, outdoorHumidity);
    const indoorDew = this.calculateDewPoint(indoorTemp, indoorHumidity);
    const supplyDew = outdoorDew + selected.lre * (indoorDew - outdoorDew);
    
    // 热回收量计算
    const airDensity = 1.2; // kg/m³
    const Cp = 1.01; // kJ/(kg·℃)
    const heatRecovered = flowRate * airDensity * Cp * (indoorTemp - outdoorTemp) * selected.sre / 3600;
    
    return {
      recoveryType,
      efficiency: {
        sre: (selected.sre * 100).toFixed(0) + '%',
        lre: (selected.lre * 100).toFixed(0) + '%'
      },
      supplyAir: {
        temperature: supplyTemp.toFixed(1),
        dewPoint: supplyDew.toFixed(1)
      },
      heatRecovered: heatRecovered.toFixed(2), // kW
      doasCompliant: selected.sre >= 0.75 && selected.lre >= 0.60,
      standard: 'ASHRAE 90.1'
    };
  }

  /**
   * 风管阻力计算
   * @param {Object} params - 计算参数
   * @returns {Object} 阻力计算结果
   */
  calculateDuctResistance(params) {
    const { ductLength, ductDiameter, flowRate, fittings } = params;
    
    const velocity = flowRate / (3600 * Math.PI * Math.pow(ductDiameter/2, 2)); // m/s
    const Re = velocity * ductDiameter / 1.5e-5; // 雷诺数
    const lambda = 0.316 / Math.pow(Re, 0.25); // 沿程阻力系数
    
    // 沿程阻力 (Pa)
    const frictionLoss = lambda * ductLength / ductDiameter * 1.2 * Math.pow(velocity, 2) / 2;
    
    // 局部阻力 (Pa) - 估算
    const localLoss = fittings * 0.5 * 1.2 * Math.pow(velocity, 2) / 2;
    
    const totalLoss = frictionLoss + localLoss;
    
    return {
      velocity: velocity.toFixed(2),
      frictionLoss: frictionLoss.toFixed(2),
      localLoss: localLoss.toFixed(2),
      totalLoss: totalLoss.toFixed(2),
      fanPressure: (totalLoss * 1.1).toFixed(2), // 考虑10%余量
      unit: 'Pa'
    };
  }

  // ==================== 4. 制冷系统计算 (CALC-AC) ====================

  /**
   * 冷负荷计算 (简化RTS法)
   * @param {Object} params - 计算参数
   * @returns {Object} 冷负荷计算结果
   */
  calculateCoolingLoad(params) {
    const { rooms, outdoorTemp, indoorTemp, orientation } = params;
    
    let totalLoad = 0;
    const roomLoads = [];
    
    rooms.forEach(room => {
      // 围护结构传热
      const wallArea = room.wallArea || room.area * 0.3;
      const windowArea = room.windowArea || room.area * 0.15;
      const roofArea = room.roofArea || 0;
      
      const K_wall = 0.5; // W/(m²·℃)
      const K_window = 2.5; // W/(m²·℃)
      const K_roof = 0.4; // W/(m²·℃)
      
      const deltaT = outdoorTemp - indoorTemp;
      const Q_wall = wallArea * K_wall * deltaT;
      const Q_window = windowArea * K_window * deltaT * 1.2; // 太阳辐射修正
      const Q_roof = roofArea * K_roof * deltaT * 1.3; // 屋顶修正
      
      // 人员散热
      const peopleCount = room.people || Math.ceil(room.area / 10);
      const Q_people = peopleCount * 120; // W/人
      
      // 设备散热
      const Q_equipment = room.equipment || room.area * 10; // W/m²
      
      // 新风负荷
      const freshAir = room.freshAir || peopleCount * 30;
      const Q_fresh = freshAir * 1.2 * (outdoorTemp - indoorTemp) / 3600 * 1.01;
      
      const roomLoad = Q_wall + Q_window + Q_roof + Q_people + Q_equipment + Q_fresh;
      
      roomLoads.push({
        name: room.name,
        structure: { wall: Q_wall.toFixed(0), window: Q_window.toFixed(0), roof: Q_roof.toFixed(0) },
        internal: { people: Q_people.toFixed(0), equipment: Q_equipment.toFixed(0) },
        freshAir: Q_fresh.toFixed(0),
        total: roomLoad.toFixed(0)
      });
      
      totalLoad += roomLoad;
    });
    
    // 考虑同时使用系数
    const diversity = 0.85;
    const designLoad = totalLoad * diversity;
    
    return {
      totalLoad: Math.round(totalLoad),
      designLoad: Math.round(designLoad),
      diversity,
      roomLoads,
      unit: 'W',
      standard: 'GB 50736'
    };
  }

  /**
   * 制冷设备选型
   * @param {Object} params - 计算参数
   * @returns {Object} 设备选型结果
   */
  selectCoolingEquipment(params) {
    const { coolingLoad, roomCount, buildingType } = params;
    const load = coolingLoad / 1000; // kW
    
    const equipment = {
      multiSplit: {
        type: '多联机系统',
        capacity: Math.ceil(load * 1.1),
        outdoorUnits: 1,
        indoorUnits: roomCount,
        iplv: 7.5,
        description: `${Math.ceil(load*1.1)}kW多联机，${roomCount}台室内机`,
        suitable: buildingType === '住宅' || buildingType === '别墅',
        standard: 'GB 21455'
      },
      vrf: {
        type: 'VRV系统',
        capacity: Math.ceil(load * 1.15),
        outdoorUnits: Math.ceil(roomCount / 8),
        indoorUnits: roomCount,
        iplv: 8.0,
        description: `模块化VRV，总容量${Math.ceil(load*1.15)}kW`,
        suitable: buildingType === '别墅' || roomCount > 8,
        standard: 'JB/T 11967'
      },
      heatPump: {
        type: '空气源热泵',
        capacity: Math.ceil(load * 1.1),
        cop: 3.2,
        description: `${Math.ceil(load*1.1)}kW两联供系统`,
        suitable: true,
        standard: 'GB/T 25127'
      }
    };
    
    // 推荐方案
    let recommendation = equipment.multiSplit;
    if (roomCount > 10) recommendation = equipment.vrf;
    if (buildingType === '别墅' && load > 20) recommendation = equipment.heatPump;
    
    return {
      coolingLoad: load.toFixed(2),
      withMargin: (load * 1.1).toFixed(2),
      equipment,
      recommendation,
      unit: 'kW'
    };
  }

  // ==================== 5. DOAS专用计算 (CALC-DOAS) ====================

  /**
   * DOAS系统设计计算
   * @param {Object} params - 计算参数
   * @returns {Object} DOAS计算结果
   */
  calculateDOAS(params) {
    const {
      freshAirFlow,
      outdoorTemp, outdoorHumidity,
      indoorTemp, indoorHumidity,
      radiantSurfaceTemp,
      hasRadiantSystem
    } = params;
    
    // DOAS核心参数
    const targetSupplyTemp = 22; // DOAS要求
    const targetDewPoint = 10;   // 深度除湿
    
    // 空气物性
    const airProps = this.getAirProperties(outdoorTemp, outdoorHumidity);
    const indoorProps = this.getAirProperties(indoorTemp, indoorHumidity);
    
    // 热回收计算 (转轮式)
    const sre = 0.80; // 显热回收效率
    const lre = 0.65; // 潜热回收效率
    
    const tempAfterHR = outdoorTemp + sre * (indoorTemp - outdoorTemp);
    const humidityAfterHR = outdoorHumidity + lre * (indoorHumidity - outdoorHumidity);
    
    // 深度除湿 (冷却至10℃露点)
    const coolingLoad = freshAirFlow * 1.2 * (airProps.h - 30) / 3600; // 简化计算
    
    // 再热计算 (提升至22℃)
    const reheatLoad = freshAirFlow * 1.2 * 1.01 * (targetSupplyTemp - targetDewPoint) / 3600;
    
    // 与辐射系统协调检查
    const tempDifference = targetSupplyTemp - (radiantSurfaceTemp || 18);
    const coordinationOK = hasRadiantSystem ? tempDifference >= 3 : true;
    
    // 合规性检查
    const compliance = {
      supplyTemp: targetSupplyTemp >= 20 && targetSupplyTemp <= 24,
      sre: sre >= 0.75,
      lre: lre >= 0.60,
      dewPoint: targetDewPoint <= 12,
      coordination: coordinationOK
    };
    
    const allCompliant = Object.values(compliance).every(v => v);
    
    return {
      design: {
        supplyAirTemp: targetSupplyTemp,
        supplyAirHumidity: 50,
        dewPoint: targetDewPoint,
        freshAirFlow
      },
      heatRecovery: {
        type: '转轮式全热交换',
        sre: (sre * 100).toFixed(0) + '%',
        lre: (lre * 100).toFixed(0) + '%',
        tempAfterHR: tempAfterHR.toFixed(1),
        humidityAfterHR: humidityAfterHR.toFixed(0)
      },
      dehumidification: {
        coolingLoad: coolingLoad.toFixed(2),
        targetDewPoint
      },
      reheat: {
        load: reheatLoad.toFixed(2),
        source: '壁挂炉余热/冷凝热回收',
        tempRise: (targetSupplyTemp - targetDewPoint).toFixed(0)
      },
      coordination: {
        radiantSurfaceTemp: radiantSurfaceTemp || 'N/A',
        tempDifference: tempDifference.toFixed(1),
        safe: coordinationOK
      },
      compliance: {
        details: compliance,
        overall: allCompliant,
        standard: 'ASHRAE 62.1/90.1'
      },
      energy: {
        savingRate: '30%+',
        vsTraditional: '节能显著'
      }
    };
  }

  // ==================== 辅助工具函数 ====================

  /**
   * 计算露点温度 (简化Magnus公式)
   */
  calculateDewPoint(temp, humidity) {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100.0);
    return (b * alpha) / (a - alpha);
  }

  /**
   * 获取空气物性
   */
  getAirProperties(temp, humidity) {
    const rho = 1.2 * 273.15 / (273.15 + temp); // 密度
    const h = 1.01 * temp + 0.001 * humidity * (2501 + 1.85 * temp); // 焓值
    const td = this.calculateDewPoint(temp, humidity); // 露点
    
    return { rho, h, td };
  }

  /**
   * 完整项目计算
   * @param {Object} project - 项目参数
   * @returns {Object} 完整计算结果
   */
  calculateCompleteProject(project) {
    const {
      buildingType, area, people, rooms,
      hasRadiant, hasDOAS,
      climateZone
    } = project;
    
    // 气候参数
    const climate = this.getClimateParams(climateZone);
    
    // 1. 热水系统
    const hotWater = this.calculateHotWaterDemand({
      buildingType, people, area, bedrooms: rooms.filter(r => r.type === '卧室').length,
      bathrooms: rooms.filter(r => r.type === '卫生间').length
    });
    
    const hotWaterHeat = this.calculateHotWaterHeatLoad({
      hourlyWater: hotWater.hotWaterHourly,
      hotTemp: 60, coldTemp: climate.coldWaterTemp, useTemp: 40
    });
    
    const hotWaterEquipment = this.selectHotWaterEquipment({
      heatLoad: hotWaterHeat.designHeatLoad,
      buildingType, area
    });
    
    // 2. 净水系统
    const waterFlow = this.calculateWaterTreatmentFlow({
      buildingType: area < 80 ? '小户型' : area < 150 ? '中户型' : '大户型',
      people,
      bathrooms: rooms.filter(r => r.type === '卫生间').length,
      kitchens: rooms.filter(r => r.type === '厨房').length
    });
    
    const waterSystem = this.recommendWaterTreatmentSystem({
      area,
      bathrooms: rooms.filter(r => r.type === '卫生间').length,
      budget: area > 200 ? 'high' : 'standard'
    });
    
    // 3. 新风系统
    const freshAir = this.calculateFreshAirVolume({
      rooms: rooms.map(r => ({
        name: r.name,
        type: r.type,
        area: r.area,
        people: r.people || 0
      })),
      buildingType,
      totalArea: area
    });
    
    const heatRecovery = this.calculateHeatRecovery({
      outdoorTemp: climate.outdoorTempSummer,
      outdoorHumidity: 60,
      indoorTemp: 24,
      indoorHumidity: 50,
      flowRate: freshAir.totalFreshAir,
      recoveryType: hasDOAS ? '转轮式全热' : '板翅式全热'
    });
    
    // 4. 制冷系统
    const coolingLoad = this.calculateCoolingLoad({
      rooms: rooms.map(r => ({
        name: r.name,
        area: r.area,
        people: r.people || Math.ceil(r.area / 10),
        freshAir: r.people ? r.people * 30 : r.area * 3
      })),
      outdoorTemp: climate.outdoorTempSummer,
      indoorTemp: 24,
      orientation: project.orientation || '南北'
    });
    
    const coolingEquipment = this.selectCoolingEquipment({
      coolingLoad: coolingLoad.designLoad,
      roomCount: rooms.length,
      buildingType
    });
    
    // 5. DOAS系统 (如启用)
    let doasResult = null;
    if (hasDOAS) {
      doasResult = this.calculateDOAS({
        freshAirFlow: freshAir.totalFreshAir,
        outdoorTemp: climate.outdoorTempSummer,
        outdoorHumidity: 60,
        indoorTemp: 24,
        indoorHumidity: 50,
        radiantSurfaceTemp: hasRadiant ? 18 : null,
        hasRadiantSystem: hasRadiant
      });
    }
    
    return {
      project: {
        name: project.name,
        buildingType,
        area,
        people,
        rooms: rooms.length,
        climateZone
      },
      climate,
      systems: {
        hotWater: { demand: hotWater, heat: hotWaterHeat, equipment: hotWaterEquipment },
        waterTreatment: { flow: waterFlow, system: waterSystem },
        freshAir: { volume: freshAir, heatRecovery },
        cooling: { load: coolingLoad, equipment: coolingEquipment },
        doas: doasResult
      },
      summary: {
        totalInvestment: '待计算',
        annualEnergy: '待计算',
        compliance: hasDOAS ? doasResult.compliance.overall : true
      }
    };
  }

  /**
   * 获取气候区参数
   */
  getClimateParams(zone) {
    const climates = {
      '严寒地区': { outdoorTempWinter: -20, outdoorTempSummer: 30, coldWaterTemp: 5 },
      '寒冷地区': { outdoorTempWinter: -10, outdoorTempSummer: 32, coldWaterTemp: 8 },
      '夏热冬冷': { outdoorTempWinter: 0, outdoorTempSummer: 35, coldWaterTemp: 10 },
      '夏热冬暖': { outdoorTempWinter: 10, outdoorTempSummer: 35, coldWaterTemp: 15 },
      '温和地区': { outdoorTempWinter: 5, outdoorTempSummer: 28, coldWaterTemp: 12 }
    };
    
    return climates[zone] || climates['夏热冬冷'];
  }
}

module.exports = CalculationEngine;
