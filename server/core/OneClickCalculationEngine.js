/**
 * 瑞美6大系统一键计算引擎 v1.0
 * 150人项目组核心引擎 - 立即执行版
 * 涵盖: 热水/净水/新风/制冷/DOAS/供暖/控制
 */

const fs = require('fs');
const path = require('path');

class OneClickCalculationEngine {
  constructor() {
    this.version = '1.0.0';
    this.buildDate = '2026-04-18';
    this.systems = ['hotwater', 'water', 'freshair', 'cooling', 'doas', 'heating', 'control'];
    
    // 气候区参数库
    this.climateData = this.loadClimateData();
    
    // 产品数据库
    this.productDB = this.loadProductDatabase();
  }

  /**
   * 一键计算核心入口
   * @param {Object} input - 用户输入参数
   * @returns {Object} 完整计算结果
   */
  async calculateAll(input) {
    const startTime = Date.now();
    
    console.log(`[OneClick] 开始计算项目: ${input.projectName || '未命名项目'}`);
    
    try {
      // 1. 参数标准化
      const params = this.normalizeInput(input);
      
      // 2. 并行计算6大系统
      const results = await Promise.all([
        this.calculateHotWater(params),
        this.calculateWater(params),
        this.calculateFreshAir(params),
        this.calculateCooling(params),
        params.enableDOAS ? this.calculateDOAS(params) : null,
        this.calculateHeating(params),
        this.calculateControl(params)
      ]);
      
      // 3. 结果整合
      const output = {
        project: {
          name: params.projectName,
          buildingType: params.buildingType,
          area: params.area,
          city: params.city,
          climateZone: params.climateZone,
          rooms: params.rooms.length
        },
        systems: {
          hotwater: results[0],
          water: results[1],
          freshair: results[2],
          cooling: results[3],
          doas: results[4],
          heating: results[5],
          control: results[6]
        },
        summary: this.generateSummary(results),
        metadata: {
          version: this.version,
          calculationTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log(`[OneClick] 计算完成，用时 ${output.metadata.calculationTime}ms`);
      
      return {
        success: true,
        data: output
      };
      
    } catch (error) {
      console.error('[OneClick] 计算失败:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 热水系统计算 (CALC-HS)
   */
  async calculateHotWater(params) {
    const { people, buildingType, bedrooms, bathrooms } = params;
    
    // 用水定额 (GB 50015)
    const quotaMap = {
      '普通住宅': 60,
      '别墅': 100,
      '公寓': 50
    };
    
    const quota = quotaMap[buildingType] || 60;
    const dailyWater = people * quota;
    const hourlyWater = dailyWater * 3.0 / 24; // Kh=3.0
    const hotWaterHourly = hourlyWater * 0.5; // 热水比例
    
    // 热负荷计算
    const C = 4.187; // kJ/(kg·℃)
    const rho = 0.983;
    const heatLoad = hourlyWater * C * 50 * rho / 3600; // kW
    
    // 设备选型
    const equipment = this.selectHotWaterEquipment(heatLoad, buildingType, params.area);
    
    return {
      system: '热水',
      code: 'CALC-HS',
      demand: {
        dailyWater: Math.round(dailyWater),
        hourlyWater: Math.round(hourlyWater),
        hotWaterHourly: Math.round(hotWaterHourly),
        unit: 'L'
      },
      heat: {
        load: heatLoad.toFixed(2),
        unit: 'kW'
      },
      equipment,
      cost: {
        equipment: equipment.price,
        installation: Math.round(equipment.price * 0.2),
        total: Math.round(equipment.price * 1.2)
      },
      standard: 'GB 50015-2019'
    };
  }

  /**
   * 净水系统计算 (CALC-WT)
   */
  async calculateWater(params) {
    const { area, people, bathrooms, kitchens } = params;
    
    // 流量计算
    const dailyWater = people * 200; // 200L/人·日
    const hourlyWater = dailyWater * 1.5 / 24;
    
    // 系统选型
    let systemType, stages, price;
    if (area < 80) {
      systemType = '基础3级';
      stages = ['PP棉5μm', '活性炭', 'RO膜75G'];
      price = 4000;
    } else if (area < 150) {
      systemType = '标准4级';
      stages = ['PP棉1μm', '前置活性炭', 'RO膜400G', '后置活性炭'];
      price = 7000;
    } else {
      systemType = '全屋5级';
      stages = ['中央净水', '中央软水', 'RO纯水600G', '超滤', '管线机'];
      price = 20000;
    }
    
    return {
      system: '净水',
      code: 'CALC-WT',
      flow: {
        dailyWater: Math.round(dailyWater),
        hourlyWater: Math.round(hourlyWater),
        unit: 'L'
      },
      treatment: {
        type: systemType,
        stages,
        flowRate: area < 80 ? '0.2 L/s' : area < 150 ? '0.3 L/s' : '0.5 L/s'
      },
      cost: {
        equipment: price,
        installation: Math.round(price * 0.15),
        total: Math.round(price * 1.15)
      },
      standard: 'GB 50015-2019'
    };
  }

  /**
   * 新风系统计算 (CALC-FA)
   */
  async calculateFreshAir(params) {
    const { rooms, area, climateZone } = params;
    
    // 新风量计算 (GB 50736)
    let totalFreshAir = 0;
    const roomResults = [];
    
    rooms.forEach(room => {
      const standard = room.type === '卧室' || room.type === '客厅' ? 30 : 
                      room.type === '书房' ? 30 : 20;
      const freshAir = (room.people || 0) * standard;
      totalFreshAir += freshAir;
      
      roomResults.push({
        name: room.name,
        type: room.type,
        freshAir,
        standard: `${standard} m³/h·人`
      });
    });
    
    // 换气次数验证
    const ach = totalFreshAir / (area * 2.8);
    
    // 热回收效率
    const recovery = {
      type: '转轮式全热交换',
      sre: '80%',
      lre: '65%',
      description: '符合GB 50736要求'
    };
    
    // 设备选型
    const capacity = Math.ceil(totalFreshAir / 50) * 50; // 向上取整
    
    return {
      system: '新风',
      code: 'CALC-FA',
      freshAir: {
        total: Math.round(totalFreshAir),
        byACH: (ach).toFixed(1),
        unit: 'm³/h'
      },
      rooms: roomResults,
      heatRecovery: recovery,
      equipment: {
        capacity,
        model: `Fresh-${capacity}`,
        price: Math.round(capacity * 50)
      },
      cost: {
        equipment: Math.round(capacity * 50),
        installation: Math.round(capacity * 15),
        total: Math.round(capacity * 65)
      },
      standard: 'GB 50736-2012'
    };
  }

  /**
   * 制冷系统计算 (CALC-AC)
   */
  async calculateCooling(params) {
    const { rooms, area, climateZone, city } = params;
    
    // 获取气候参数
    const climate = this.climateData[city] || { summerTemp: 35, winterTemp: -5 };
    
    // 简化冷负荷计算 (W/㎡)
    const loadFactor = climate.summerTemp > 33 ? 120 : 100;
    const totalLoad = area * loadFactor;
    
    // 房间负荷分配
    const roomLoads = rooms.map(room => ({
      name: room.name,
      area: room.area,
      load: Math.round(room.area * loadFactor),
      equipment: `${Math.ceil(room.area * loadFactor / 2500)}匹`
    }));
    
    // 设计负荷 (同时使用系数0.85)
    const designLoad = totalLoad * 0.85;
    
    // 设备选型
    const totalHP = Math.ceil(designLoad / 2500);
    const outdoorUnit = Math.ceil(totalHP / 6) * 6; // 6匹模块
    
    return {
      system: '制冷',
      code: 'CALC-AC',
      load: {
        total: Math.round(totalLoad),
        design: Math.round(designLoad),
        unit: 'W',
        diversity: 0.85
      },
      rooms: roomLoads,
      equipment: {
        outdoorUnit: `${outdoorUnit}kW`,
        indoorUnits: rooms.length,
        iplv: 7.5,
        model: `VRV-${outdoorUnit}`,
        price: Math.round(outdoorUnit * 1500 + rooms.length * 2000)
      },
      cost: {
        equipment: Math.round(outdoorUnit * 1500 + rooms.length * 2000),
        installation: Math.round(area * 80),
        total: Math.round(outdoorUnit * 1500 + rooms.length * 2000 + area * 80)
      },
      standard: 'GB 50736-2012'
    };
  }

  /**
   * DOAS系统计算 (CALC-DOAS)
   */
  async calculateDOAS(params) {
    const { area, rooms, climateZone, hasRadiant } = params;
    
    // 新风量 (同新风系统)
    let freshAirFlow = 0;
    rooms.forEach(room => {
      freshAirFlow += (room.people || 0) * 30;
    });
    
    // DOAS核心参数
    const design = {
      supplyTemp: 22,
      dewPoint: 10,
      humidity: 50
    };
    
    // 热回收
    const heatRecovery = {
      type: '转轮式全热',
      sre: 0.80,
      lre: 0.65,
      description: 'ASHRAE 90.1合规'
    };
    
    // 负荷计算
    const G = freshAirFlow / 3600; // m³/s
    const airDensity = 1.2;
    const Cp = 1.01;
    const deltaT = 22 - 10; // 再热温差
    const reheatLoad = G * airDensity * Cp * deltaT; // kW
    
    // 与辐射系统协调
    const radiantTemp = hasRadiant ? 18 : null;
    const coordination = {
      radiantSurfaceTemp: radiantTemp,
      tempDifference: radiantTemp ? (22 - radiantTemp).toFixed(1) : null,
      safe: radiantTemp ? (22 - radiantTemp) >= 3 : true
    };
    
    // 合规性
    const compliance = {
      supplyTemp: design.supplyTemp >= 20 && design.supplyTemp <= 24,
      sre: heatRecovery.sre >= 0.75,
      lre: heatRecovery.lre >= 0.60,
      dewPoint: design.dewPoint <= 12,
      coordination: coordination.safe,
      overall: heatRecovery.sre >= 0.75 && heatRecovery.lre >= 0.60 && coordination.safe
    };
    
    return {
      system: 'DOAS',
      code: 'CALC-DOAS',
      freshAir: {
        flow: Math.round(freshAirFlow),
        unit: 'm³/h'
      },
      design,
      heatRecovery: {
        ...heatRecovery,
        sre: '80%',
        lre: '65%'
      },
      reheat: {
        load: reheatLoad.toFixed(2),
        source: '壁挂炉余热/冷凝热回收',
        unit: 'kW'
      },
      coordination,
      compliance,
      equipment: {
        model: `DOAS-${Math.ceil(freshAirFlow / 50) * 50}`,
        price: Math.round(freshAirFlow * 80)
      },
      cost: {
        equipment: Math.round(freshAirFlow * 80),
        installation: Math.round(freshAirFlow * 20),
        total: Math.round(freshAirFlow * 100)
      },
      energy: {
        savingRate: '30%+',
        vsTraditional: '显著节能'
      },
      standard: 'ASHRAE 62.1/90.1'
    };
  }

  /**
   * 供暖系统计算 (CALC-HT)
   */
  async calculateHeating(params) {
    const { area, climateZone, city, rooms } = params;
    
    // 气候参数
    const climate = this.climateData[city] || { winterTemp: -5, heatingFactor: 60 };
    
    // 热负荷计算 (稳态法)
    const heatLoad = area * climate.heatingFactor; // W
    
    // 地暖管间距计算
    const pipeSpacing = 150; // mm (标准间距)
    const pipeLength = (area * 1000 * 1000) / (pipeSpacing * 1000); // m
    
    // 分集水器选型
    const circuits = Math.ceil(area / 15); // 每15㎡一个回路
    
    return {
      system: '供暖',
      code: 'CALC-HT',
      load: {
        total: Math.round(heatLoad),
        unit: 'W',
        factor: climate.heatingFactor
      },
      floorHeating: {
        pipeSpacing: `${pipeSpacing}mm`,
        pipeLength: Math.round(pipeLength),
        unit: 'm',
        circuits,
        collector: `${circuits}路分集水器`
      },
      equipment: {
        heatSource: '燃气壁挂炉(两用)',
        capacity: `${Math.ceil(heatLoad / 1000)}kW`,
        price: 12000
      },
      cost: {
        equipment: 12000,
        pipeMaterial: Math.round(pipeLength * 15),
        installation: Math.round(area * 120),
        total: Math.round(12000 + pipeLength * 15 + area * 120)
      },
      standard: 'GB 50736-2012'
    };
  }

  /**
   * 控制系统计算 (CALC-CTRL)
   */
  async calculateControl(params) {
    const { area, rooms, systems } = params;
    
    // 控制点位计算
    const points = {
      temperature: rooms.length, // 每个房间温度控制
      humidity: systems.enableDOAS ? 1 : 0,
      co2: systems.freshair ? 1 : 0,
      pm25: 1,
      total: 0
    };
    points.total = points.temperature + points.humidity + points.co2 + points.pm25;
    
    // 控制策略
    const strategies = [
      '温度分区控制',
      '定时启停控制',
      '远程APP控制'
    ];
    
    if (systems.enableDOAS) {
      strategies.push('DOAS与辐射系统协调控制');
    }
    
    if (systems.heating && systems.cooling) {
      strategies.push('冷暖切换控制');
    }
    
    return {
      system: '控制',
      code: 'CALC-CTRL',
      points,
      strategies,
      equipment: {
        type: '智能控制面板+网关',
        panels: rooms.length,
        price: Math.round(rooms.length * 800 + 2000)
      },
      cost: {
        equipment: Math.round(rooms.length * 800 + 2000),
        installation: Math.round(rooms.length * 200),
        total: Math.round(rooms.length * 1000 + 2000)
      },
      features: [
        '一键场景切换',
        '能耗监测',
        '故障报警',
        '远程控制'
      ]
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 参数标准化与验证
   */
  normalizeInput(input) {
    // 输入验证
    const errors = [];
    
    if (input.area !== undefined) {
      const area = parseInt(input.area);
      if (isNaN(area) || area < 10 || area > 10000) {
        errors.push('建筑面积必须在10-10000㎡之间');
      }
    }
    
    if (input.people !== undefined) {
      const people = parseInt(input.people);
      if (isNaN(people) || people < 1 || people > 100) {
        errors.push('居住人数必须在1-100人之间');
      }
    }
    
    if (input.bedrooms !== undefined) {
      const bedrooms = parseInt(input.bedrooms);
      if (isNaN(bedrooms) || bedrooms < 1 || bedrooms > 20) {
        errors.push('卧室数量必须在1-20之间');
      }
    }
    
    // 如果验证失败，抛出错误
    if (errors.length > 0) {
      throw new Error(`参数验证失败: ${errors.join(', ')}`);
    }
    
    return {
      projectName: input.projectName || '未命名项目',
      buildingType: input.buildingType || '普通住宅',
      area: Math.min(Math.max(parseInt(input.area) || 120, 10), 10000),
      city: input.city || '北京',
      climateZone: input.climateZone || '夏热冬冷',
      people: Math.min(Math.max(parseInt(input.people) || 4, 1), 100),
      bedrooms: Math.min(Math.max(parseInt(input.bedrooms) || 3, 1), 20),
      bathrooms: Math.min(Math.max(parseInt(input.bathrooms) || 2, 1), 20),
      kitchens: Math.min(Math.max(parseInt(input.kitchens) || 1, 1), 10),
      rooms: input.rooms || this.generateDefaultRooms(input.area, input.bedrooms),
      enableDOAS: input.enableDOAS || false,
      hasRadiant: input.hasRadiant || false,
      budget: input.budget || 'standard',
      systems: input.systems || { hotwater: true, water: true, freshair: true, cooling: true }
    };
  }

  /**
   * 生成默认房间
   */
  generateDefaultRooms(area, bedrooms) {
    const rooms = [];
    const livingArea = area * 0.3;
    const diningArea = area * 0.15;
    const bedroomArea = (area - livingArea - diningArea - 20) / bedrooms;
    
    // 客厅
    rooms.push({ name: '客厅', type: '客厅', area: livingArea, people: 4 });
    // 餐厅
    rooms.push({ name: '餐厅', type: '餐厅', area: diningArea, people: 4 });
    // 厨房
    rooms.push({ name: '厨房', type: '厨房', area: 8, people: 1 });
    // 卧室
    for (let i = 1; i <= bedrooms; i++) {
      rooms.push({ 
        name: `卧室${i}`, 
        type: '卧室', 
        area: bedroomArea, 
        people: i === 1 ? 2 : 1 
      });
    }
    
    return rooms;
  }

  /**
   * 热水设备选型
   */
  selectHotWaterEquipment(heatLoad, buildingType, area) {
    const load = parseFloat(heatLoad);
    const withMargin = load * 1.2;
    
    // 两用炉选型
    const power = Math.max(24, Math.ceil(withMargin)); // 最小24kW
    
    let type, description, price;
    
    if (buildingType === '别墅' && area > 200) {
      type = '系统炉+水箱';
      description = `${power}kW系统炉+200L水箱`;
      price = 18000;
    } else {
      type = '两用炉';
      description = `${power}kW两用炉(供暖+热水)`;
      price = 12000;
    }
    
    return {
      type,
      power: `${power}kW`,
      description,
      price,
      features: ['供暖', '热水', '智能控制']
    };
  }

  /**
   * 生成费用汇总
   */
  generateSummary(results) {
    let totalEquipment = 0;
    let totalInstallation = 0;
    
    results.forEach(result => {
      if (result && result.cost) {
        totalEquipment += result.cost.equipment || 0;
        totalInstallation += result.cost.installation || 0;
      }
    });
    
    return {
      cost: {
        equipment: totalEquipment,
        installation: totalInstallation,
        total: totalEquipment + totalInstallation
      },
      systems: results.filter(r => r !== null).length,
      completion: '100%'
    };
  }

  /**
   * 加载气候数据
   */
  loadClimateData() {
    return {
      // ========== 一线城市 (4个) ==========
      '北京': { summerTemp: 35, winterTemp: -5, heatingFactor: 60, coldWaterTemp: 10, climateZone: '寒冷', region: '华北' },
      '上海': { summerTemp: 36, winterTemp: 2, heatingFactor: 50, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '广州': { summerTemp: 35, winterTemp: 8, heatingFactor: 40, coldWaterTemp: 15, climateZone: '夏热冬暖', region: '华南' },
      '深圳': { summerTemp: 35, winterTemp: 10, heatingFactor: 35, coldWaterTemp: 16, climateZone: '夏热冬暖', region: '华南' },

      // ========== 新一线城市 (15个) ==========
      '成都': { summerTemp: 33, winterTemp: 3, heatingFactor: 50, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '西南' },
      '杭州': { summerTemp: 36, winterTemp: 1, heatingFactor: 52, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '重庆': { summerTemp: 38, winterTemp: 5, heatingFactor: 45, coldWaterTemp: 13, climateZone: '夏热冬冷', region: '西南' },
      '武汉': { summerTemp: 36, winterTemp: -1, heatingFactor: 55, coldWaterTemp: 11, climateZone: '夏热冬冷', region: '华中' },
      '西安': { summerTemp: 37, winterTemp: -3, heatingFactor: 58, coldWaterTemp: 10, climateZone: '寒冷', region: '西北' },
      '苏州': { summerTemp: 35, winterTemp: 0, heatingFactor: 52, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '南京': { summerTemp: 35, winterTemp: -2, heatingFactor: 55, coldWaterTemp: 11, climateZone: '夏热冬冷', region: '华东' },
      '长沙': { summerTemp: 36, winterTemp: 2, heatingFactor: 48, coldWaterTemp: 13, climateZone: '夏热冬冷', region: '华中' },
      '天津': { summerTemp: 35, winterTemp: -4, heatingFactor: 60, coldWaterTemp: 10, climateZone: '寒冷', region: '华北' },
      '郑州': { summerTemp: 36, winterTemp: -2, heatingFactor: 58, coldWaterTemp: 10, climateZone: '寒冷', region: '华中' },
      '东莞': { summerTemp: 35, winterTemp: 10, heatingFactor: 38, coldWaterTemp: 15, climateZone: '夏热冬暖', region: '华南' },
      '青岛': { summerTemp: 32, winterTemp: -3, heatingFactor: 55, coldWaterTemp: 11, climateZone: '寒冷', region: '华东' },
      '昆明': { summerTemp: 28, winterTemp: 5, heatingFactor: 40, coldWaterTemp: 14, climateZone: '温和', region: '西南' },
      '宁波': { summerTemp: 35, winterTemp: 1, heatingFactor: 50, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '合肥': { summerTemp: 35, winterTemp: -1, heatingFactor: 52, coldWaterTemp: 11, climateZone: '夏热冬冷', region: '华东' },

      // ========== 二线城市 (15个) ==========
      '无锡': { summerTemp: 35, winterTemp: 0, heatingFactor: 52, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '佛山': { summerTemp: 35, winterTemp: 10, heatingFactor: 38, coldWaterTemp: 15, climateZone: '夏热冬暖', region: '华南' },
      '沈阳': { summerTemp: 32, winterTemp: -15, heatingFactor: 70, coldWaterTemp: 8, climateZone: '严寒', region: '东北' },
      '大连': { summerTemp: 30, winterTemp: -8, heatingFactor: 62, coldWaterTemp: 9, climateZone: '寒冷', region: '东北' },
      '厦门': { summerTemp: 33, winterTemp: 8, heatingFactor: 38, coldWaterTemp: 15, climateZone: '夏热冬暖', region: '华东' },
      '济南': { summerTemp: 36, winterTemp: -4, heatingFactor: 58, coldWaterTemp: 10, climateZone: '寒冷', region: '华东' },
      '福州': { summerTemp: 35, winterTemp: 8, heatingFactor: 40, coldWaterTemp: 15, climateZone: '夏热冬暖', region: '华东' },
      '温州': { summerTemp: 34, winterTemp: 4, heatingFactor: 45, coldWaterTemp: 14, climateZone: '夏热冬冷', region: '华东' },
      '哈尔滨': { summerTemp: 30, winterTemp: -20, heatingFactor: 75, coldWaterTemp: 6, climateZone: '严寒', region: '东北' },
      '长春': { summerTemp: 31, winterTemp: -18, heatingFactor: 72, coldWaterTemp: 7, climateZone: '严寒', region: '东北' },
      '石家庄': { summerTemp: 37, winterTemp: -5, heatingFactor: 60, coldWaterTemp: 10, climateZone: '寒冷', region: '华北' },
      '南宁': { summerTemp: 35, winterTemp: 12, heatingFactor: 35, coldWaterTemp: 16, climateZone: '夏热冬暖', region: '华南' },
      '贵阳': { summerTemp: 32, winterTemp: 2, heatingFactor: 45, coldWaterTemp: 13, climateZone: '夏热冬冷', region: '西南' },
      '南昌': { summerTemp: 36, winterTemp: 2, heatingFactor: 50, coldWaterTemp: 12, climateZone: '夏热冬冷', region: '华东' },
      '兰州': { summerTemp: 35, winterTemp: -8, heatingFactor: 65, coldWaterTemp: 9, climateZone: '寒冷', region: '西北' }
    };
  }

  /**
   * 加载产品数据库
   */
  loadProductDatabase() {
    // 简化版本，实际应从数据库加载
    return {
      hotwater: [
        { model: 'Pro24', power: 24, price: 12000 },
        { model: 'Pro28', power: 28, price: 14000 },
        { model: 'Pro32', power: 32, price: 16000 }
      ],
      freshair: [
        { model: 'Fresh-250', flow: 250, price: 8000 },
        { model: 'Fresh-350', flow: 350, price: 10000 },
        { model: 'Fresh-500', flow: 500, price: 13000 }
      ],
      cooling: [
        { model: 'VRV-6', capacity: 6, price: 15000 },
        { model: 'VRV-10', capacity: 10, price: 22000 },
        { model: 'VRV-14', capacity: 14, price: 30000 }
      ]
    };
  }
}

module.exports = OneClickCalculationEngine;
