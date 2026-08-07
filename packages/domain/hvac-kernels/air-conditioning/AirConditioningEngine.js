/**
 * 空调系统设计引擎 (Air Conditioning Design Engine)
 * 负责VRF/分体/新风系统的设计计算
 * 参考开源项目: CHLOE, python-hvac
 */

class AirConditioningEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'AirConditioningEngine';
    
    // 设计参数
    this.DESIGN_PARAMS = {
      summerIndoorTemp: 26, // °C
      summerIndoorHumidity: 60, // %
      winterIndoorTemp: 20, // °C
      summerOutdoorTemp: 35, // °C (根据城市调整)
      winterOutdoorTemp: -5, // °C (根据城市调整)
      airChanges: 6 // 换气次数 (次/h)
    };
    
    // 负荷指标 (W/m²)
    this.LOAD_INDICATORS = {
      '住宅-普通': { cooling: 120, heating: 80 },
      '住宅-节能': { cooling: 100, heating: 60 },
      '商业-办公': { cooling: 150, heating: 100 },
      '商业-商场': { cooling: 200, heating: 120 }
    };
  }

  /**
   * 主入口: 生成空调系统设计方案
   */
  generateDesign(params) {
    // 安全默认值：防止前端不传字段时 NaN 崩溃
    const safe = Object.assign({
      houseType: '三居',
      area: 100,
      floorHeight: 2.8,
      rooms: [],
      orientation: '南北',
      glazingRatio: 0.25,
      insulation: '中',
      occupancy: 3,
      equipmentLoad: 8,
      acType: 'VRF',
      hasFreshAir: true,
      city: '上海'
    }, params || {});
    params = safe;
    const {
      houseType, area, floorHeight, rooms, orientation, glazingRatio,
      insulation, occupancy, equipmentLoad, acType, hasFreshAir, city
    } = safe;

    console.log(`[AirConditioningEngine] 开始设计: ${houseType} ${area}m²`);

    // 1. 计算冷热负荷 (参考CHLOE算法)
    const coolingLoad = this.calculateCoolingLoad(params);
    const heatingLoad = this.calculateHeatingLoad(params);
    
    // 2. 设计空调系统
    let acSystem;
    if (acType === 'VRF') {
      acSystem = this.designVRFSystem(coolingLoad, heatingLoad, rooms);
    } else if (acType === '分体') {
      acSystem = this.designSplitSystem(coolingLoad, rooms);
    } else {
      acSystem = this.designCentralAC(coolingLoad, heatingLoad, area);
    }
    
    // 3. 设计新风系统 (如果需要)
    const freshAirSystem = hasFreshAir ? 
      this.designFreshAirSystem(area, occupancy, rooms) : null;
    
    // 4. 气流组织分析
    const airflow = this.analyzeAirflow(rooms, acSystem);

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      input: params,
      loads: {
        cooling: coolingLoad,
        heating: heatingLoad
      },
      acSystem,
      freshAir: freshAirSystem,
      airflow,
      control: this.designControlSystem(acType, rooms),
      summary: this.generateSummary(coolingLoad, heatingLoad, acSystem)
    };
  }

  /**
   * 计算冷负荷 (简化算法,参考CHLOE)
   * Q = Q_envelope + Q_internal + Q_fresh_air
   */
  calculateCoolingLoad(params) {
    const { area, rooms, orientation, glazingRatio, occupancy, equipmentLoad, city } = params;
    
    // 获取城市气象参数
    const climate = this.getCityClimate(city);
    
    // 1. 围护结构负荷
    const envelopeLoad = this.calculateEnvelopeLoad(area, climate);
    
    // 2. 内部负荷 (人员+设备+照明)
    const internalLoad = this.calculateInternalLoad(area, occupancy, equipmentLoad);
    
    // 3. 新风负荷
    const freshAirLoad = this.calculateFreshAirLoad(area, occupancy, climate);
    
    // 总冷负荷
    const totalLoad = envelopeLoad + internalLoad + freshAirLoad;
    
    // 各房间负荷明细
    const roomLoads = rooms.map(room => {
      const roomLoad = this.calculateRoomLoad(room, climate, occupancy);
      return {
        name: room.name,
        area: room.area,
        load: roomLoad,
        loadPerArea: Math.round(roomLoad / room.area)
      };
    });
    
    return {
      totalLoad: Math.round(totalLoad),
      loadPerArea: Math.round(totalLoad / area),
      components: {
        envelope: Math.round(envelopeLoad),
        internal: Math.round(internalLoad),
        freshAir: Math.round(freshAirLoad)
      },
      roomLoads,
      climate,
      safetyFactor: 1.1,
      designLoad: Math.round(totalLoad * 1.1) // 含安全系数
    };
  }

  /**
   * 计算热负荷
   */
  calculateHeatingLoad(params) {
    const { area, rooms, city, insulation } = params;
    const climate = this.getCityClimate(city);
    
    // 简化的热负荷计算
    // Q = q × A × (t_n - t_w) / (t_n - t_w_design)
    const baseIndicator = this.LOAD_INDICATORS['住宅-普通'].heating;
    
    // 温度修正
    const tempDiffRatio = (20 - climate.winterTemp) / (20 - (-5)); // 标准以-5°C为基准
    
    // 保温修正
    const insulationFactor = { '好': 0.7, '中': 1.0, '差': 1.3 }[insulation] || 1.0;
    
    const totalLoad = area * baseIndicator * tempDiffRatio * insulationFactor;
    
    return {
      totalLoad: Math.round(totalLoad),
      loadPerArea: Math.round(totalLoad / area),
      climate,
      factors: {
        tempDiffRatio: Math.round(tempDiffRatio * 100) / 100,
        insulationFactor
      }
    };
  }

  /**
   * 获取城市气象参数
   */
  getCityClimate(city) {
    const climates = {
      '北京': { summerTemp: 33.2, winterTemp: -9, humidity: 74 },
      '上海': { summerTemp: 34, winterTemp: -2.2, humidity: 75 },
      '广州': { summerTemp: 35.6, winterTemp: 5, humidity: 75 },
      '深圳': { summerTemp: 35, winterTemp: 7, humidity: 75 },
      '南京': { summerTemp: 35, winterTemp: -4, humidity: 76 },
      '杭州': { summerTemp: 35.7, winterTemp: -3, humidity: 77 },
      '武汉': { summerTemp: 35.3, winterTemp: -3.5, humidity: 77 },
      '西安': { summerTemp: 35.2, winterTemp: -5, humidity: 72 },
      '成都': { summerTemp: 33.8, winterTemp: 1, humidity: 85 },
      '重庆': { summerTemp: 36.5, winterTemp: 2, humidity: 80 },
      '哈尔滨': { summerTemp: 30.8, winterTemp: -18, humidity: 74 },
      '沈阳': { summerTemp: 31.6, winterTemp: -15, humidity: 78 },
      '天津': { summerTemp: 33.4, winterTemp: -8, humidity: 74 }
    };
    
    return climates[city] || climates['北京'];
  }

  /**
   * 计算围护结构负荷
   */
  calculateEnvelopeLoad(area, climate) {
    // 简化: 外墙+屋顶+窗户的综合传热
    const tempDiff = climate.summerTemp - 26; // 室内外温差
    const heatTransferCoeff = 1.2; // 综合传热系数 W/(m²·K)
    
    return area * heatTransferCoeff * tempDiff * 1.5; // 1.5为太阳辐射修正
  }

  /**
   * 计算内部负荷
   */
  calculateInternalLoad(area, occupancy, equipmentLoad) {
    // 人员负荷 (W/人)
    const personLoad = 120; // 轻度活动
    const peopleCount = occupancy || Math.ceil(area / 10); // 估算人数
    const peopleHeat = peopleCount * personLoad;
    
    // 设备负荷
    const equipHeat = equipmentLoad || area * 10; // 默认10W/m²
    
    // 照明负荷
    const lightingLoad = area * 8; // 8W/m²
    
    return peopleHeat + equipHeat + lightingLoad;
  }

  /**
   * 计算新风负荷
   */
  calculateFreshAirLoad(area, occupancy, climate) {
    const peopleCount = occupancy || Math.ceil(area / 10);
    const freshAirPerPerson = 30; // m³/h·人
    const totalFreshAir = peopleCount * freshAirPerPerson;
    
    // 新风负荷 = 风量 × 密度 × 焓差 / 3600
    const airDensity = 1.2; // kg/m³
    const enthalpyDiff = 15; // kJ/kg (简化)
    
    return (totalFreshAir * airDensity * enthalpyDiff) / 3600;
  }

  /**
   * 计算单个房间负荷
   */
  calculateRoomLoad(room, climate, occupancy) {
    const baseLoad = room.area * 120; // 基础120W/m²
    
    // 朝向修正
    const orientationFactor = {
      '南': 1.0,
      '东南': 1.1,
      '西南': 1.15,
      '东': 1.1,
      '西': 1.2,
      '北': 0.9,
      '东北': 0.95,
      '西北': 1.05
    }[room.orientation] || 1.0;
    
    // 窗户面积修正。缺 windowArea 时按基准窗墙比 0.2 处理（修正系数=1.0）：
    // 原实现 `undefined / area` → NaN，会让房间负荷、室内机容量、总容量、连接率
    // 全部变成 NaN，且**不抛错**——方案看似完整实则不可用，直接损伤客户专业度。
    const windowRatio = Number.isFinite(room.windowArea) && room.area > 0
      ? room.windowArea / room.area
      : 0.2;
    const windowFactor = 1 + (windowRatio - 0.2) * 0.5; // 基准窗墙比0.2

    return baseLoad * orientationFactor * windowFactor;
  }

  /**
   * 设计VRF多联机系统
   */
  designVRFSystem(coolingLoad, heatingLoad, rooms) {
    const { roomLoads, designLoad } = coolingLoad;
    
    // 1. 配置室内机
    const indoorUnits = roomLoads.map(room => {
      const capacity = Math.ceil(room.load / 100) * 100; // 向上取整到100W
      const model = this.selectIndoorUnit(capacity, room.name);
      
      return {
        room: room.name,
        area: room.area,
        load: room.load,
        capacity,
        model,
        type: this.suggestIndoorType(room.name),
        quantity: 1
      };
    });
    
    // 2. 计算总容量需求
    const totalIndoorCapacity = indoorUnits.reduce((sum, u) => sum + u.capacity, 0);
    
    // 3. 选择室外机 (考虑同时使用率)
    const diversityFactor = this.calculateDiversityFactor(rooms.length);
    const outdoorCapacity = totalIndoorCapacity * diversityFactor;
    const outdoorUnit = this.selectOutdoorUnit(outdoorCapacity);
    
    // 4. 配管设计
    const piping = this.designVRFPiping(indoorUnits, outdoorUnit);
    
    return {
      type: 'VRF多联机系统',
      brand: '大金/日立/三菱电机/格力/美的',
      indoorUnits,
      outdoorUnit,
      piping,
      diversityFactor,
      totalIndoorCapacity,
      totalOutdoorCapacity: outdoorCapacity,
      connectRatio: Math.round((totalIndoorCapacity / outdoorCapacity) * 100) / 100,
      estimatedCost: this.estimateVRFCost(indoorUnits, outdoorUnit),
      features: ['独立控制', '部分负荷高效', '长配管', '分区计量']
    };
  }

  /**
   * 选择室内机型号
   */
  selectIndoorUnit(capacity, roomName) {
    // 标准容量档次
    const standardCapacities = [
      2200, 2800, 3600, 4500, 5600, 7100, 9000, 11200, 14000
    ]; // W
    
    const selected = standardCapacities.find(c => c >= capacity) || 
                     standardCapacities[standardCapacities.length - 1];
    
    const hp = (selected / 2500).toFixed(1); // 换算为匹数
    
    return {
      capacity: `${selected}W`,
      hp: `${hp}匹`,
      model: `FXS${selected/100}L`,
      // 防御：房间对象可能缺 name（不同上游用 name/type 两套 schema），
      // 缺失时不得整体崩溃——崩溃会让整份空调设计不可用。
      type: String(roomName || '').includes('客厅') ? '风管式' :
            String(roomName || '').includes('卧室') ? '壁挂式' : '风管式'
    };
  }

  /**
   * 建议室内机类型
   */
  suggestIndoorType(roomName) {
    // 防御：房间可能缺 name（见 selectIndoorUnit 注释），缺失时回落默认型式而非抛错。
    const name = String(roomName || '');
    if (name.includes('客厅')) return '风管式/嵌入式';
    if (name.includes('卧室')) return '壁挂式';
    if (name.includes('书房')) return '壁挂式/风管式';
    if (name.includes('餐厅')) return '风管式/嵌入式';
    return '风管式';
  }

  /**
   * 计算同时使用系数
   */
  calculateDiversityFactor(roomCount) {
    // 房间越多,同时使用系数越低
    if (roomCount <= 2) return 1.0;
    if (roomCount <= 4) return 0.9;
    if (roomCount <= 6) return 0.85;
    if (roomCount <= 8) return 0.8;
    return 0.75;
  }

  /**
   * 选择室外机
   */
  selectOutdoorUnit(capacity) {
    const standardCapacities = [
      8000, 10000, 12000, 14000, 16000, 18000, 20000, 
      22400, 25000, 28000, 33500, 40000, 45000, 50000
    ]; // W
    
    const selected = standardCapacities.find(c => c >= capacity) || 
                     standardCapacities[standardCapacities.length - 1];
    
    const hp = (selected / 2500).toFixed(0);
    
    return {
      capacity: `${selected}W`,
      hp: `${hp}匹`,
      model: `RXYQ${selected/1000}P`,
      power: '380V/3N~/50Hz',
      maxConnections: Math.min(Math.floor(selected / 2800), 16),
      maxPipingLength: '150m',
      maxHeightDiff: '50m'
    };
  }

  /**
   * 设计VRF配管
   */
  designVRFPiping(indoorUnits, outdoorUnit) {
    const totalLength = indoorUnits.length * 15; // 估算
    
    return {
      mainPipe: 'φ9.52/φ15.88 (液管/气管)',
      branches: indoorUnits.map(u => ({
        room: u.room,
        pipe: 'φ6.35/φ12.7',
        estimatedLength: '15m'
      })),
      totalEstimatedLength: `${totalLength}m`,
      maxLength: outdoorUnit.maxPipingLength,
      maxHeightDiff: outdoorUnit.maxHeightDiff,
      insulation: '橡塑保温15mm',
      refregirant: 'R410A'
    };
  }

  /**
   * 估算VRF成本
   */
  estimateVRFCost(indoorUnits, outdoorUnit) {
    const indoorCost = indoorUnits.reduce((sum, u) => {
      return sum + parseInt(u.model.hp) * 3000; // 约3000元/匹
    }, 0);
    
    const outdoorHp = parseInt(outdoorUnit.hp);
    const outdoorCost = outdoorHp * 2500; // 约2500元/匹
    
    const installationCost = (indoorUnits.length + 1) * 1500; // 安装费
    
    const total = indoorCost + outdoorCost + installationCost;
    
    return {
      indoorUnits: `${indoorCost}元`,
      outdoorUnit: `${outdoorCost}元`,
      installation: `${installationCost}元`,
      total: `${total}元`,
      perSqm: `${Math.round(total / indoorUnits.reduce((s, u) => s + u.area, 0))}元/m²`
    };
  }

  /**
   * 设计分体空调系统
   */
  designSplitSystem(coolingLoad, rooms) {
    const { roomLoads } = coolingLoad;
    
    const units = roomLoads.map(room => {
      const hp = Math.ceil(room.load / 2500);
      const capacity = hp * 2500;
      
      return {
        room: room.name,
        load: room.load,
        hp: `${hp}匹`,
        capacity: `${capacity}W`,
        type: room.name.includes('客厅') ? '柜机' : '挂机',
        brands: ['格力', '美的', '海尔', '大金', '松下'],
        features: ['变频', '一级能效', '智能控制'],
        estimatedPrice: `${hp * 3000}元`
      };
    });
    
    return {
      type: '分体空调系统',
      units,
      totalUnits: units.length,
      totalHp: units.reduce((sum, u) => sum + parseInt(u.hp), 0),
      totalCapacity: units.reduce((sum, u) => sum + parseInt(u.capacity), 0),
      totalCost: units.reduce((sum, u) => sum + parseInt(u.estimatedPrice), 0),
      features: ['独立控制', '安装灵活', '维护简单'],
      limitations: ['外墙机位受限', '多外机影响美观']
    };
  }

  /**
   * 设计中央空调系统
   */
  designCentralAC(coolingLoad, heatingLoad, area) {
    const { designLoad } = coolingLoad;
    
    return {
      type: '水系统中央空调',
      capacity: `${designLoad}W`,
      chiller: {
        type: '风冷热泵',
        capacity: `${Math.ceil(designLoad/1000)}kW`,
        brands: ['约克', '特灵', '开利', '麦克维尔']
      },
      terminalUnits: {
        type: '风机盘管',
        quantity: Math.ceil(area / 20),
        brands: ['威柯', '新晃', '同方']
      },
      estimatedCost: `${Math.ceil(area * 400)}元`,
      features: ['舒适度最高', '可同时供地暖', '适合大宅'],
      limitations: ['初投资高', '需设备间', '维护复杂']
    };
  }

  /**
   * 设计新风系统
   */
  designFreshAirSystem(area, occupancy, rooms) {
    const peopleCount = occupancy || Math.ceil(area / 10);
    
    // 新风量计算
    const freshAirPerPerson = 30; // m³/h
    const totalFreshAir = peopleCount * freshAirPerPerson;
    const airChanges = totalFreshAir / (area * 2.8); // 层高2.8m
    
    // 推荐设备
    const units = this.selectFreshAirUnits(totalFreshAir, rooms);
    
    return {
      type: '新风系统',
      freshAirVolume: `${totalFreshAir} m³/h`,
      airChanges: `${airChanges.toFixed(1)} 次/h`,
      designBasis: `${peopleCount}人 × 30m³/h`,
      units,
      purification: ['初效', '中效', '高效(HEPA)'],
      heatRecovery: '全热交换(效率70%+)',
      estimatedCost: units.reduce((sum, u) => sum + u.cost, 0),
      features: ['恒氧', '净化', '节能', '静音']
    };
  }

  /**
   * 选择新风设备
   */
  selectFreshAirUnits(totalVolume, rooms) {
    const standardCapacities = [150, 250, 350, 500, 800, 1000, 1500];
    
    // 分区设置
    if (rooms.length <= 3) {
      // 集中式
      const selected = standardCapacities.find(c => c >= totalVolume) || 
                       standardCapacities[standardCapacities.length - 1];
      
      return [{
        type: '集中式新风',
        capacity: `${selected} m³/h`,
        coverage: '全屋',
        brands: ['松下', '大金', '霍尼韦尔', '国产'],
        cost: 8000 + selected * 10,
        installation: '吊顶式'
      }];
    } else {
      // 分区式
      const zones = [
        { name: '客厅+餐厅', area: '公共区域', volume: Math.ceil(totalVolume * 0.4) },
        { name: '主卧', area: '主卧套间', volume: Math.ceil(totalVolume * 0.25) },
        { name: '次卧区', area: '其他卧室', volume: Math.ceil(totalVolume * 0.35) }
      ];
      
      return zones.map(zone => {
        const cap = standardCapacities.find(c => c >= zone.volume) || 250;
        return {
          type: '分区新风',
          capacity: `${cap} m³/h`,
          coverage: zone.name,
          brands: ['松下', '远大', '国产'],
          cost: 5000 + cap * 8,
          installation: '壁挂/吊顶'
        };
      });
    }
  }

  /**
   * 气流组织分析
   */
  analyzeAirflow(rooms, acSystem) {
    return {
      method: '上送下回/侧送',
      coverage: rooms.map(r => ({
        room: r.name,
        airflow: '均匀分布',
        velocity: '≤0.25m/s',
        tempUniformity: '±1°C'
      })),
      notes: '避免冷风直吹人体'
    };
  }

  /**
   * 设计控制系统
   */
  designControlSystem(acType, rooms) {
    if (acType === 'VRF') {
      return {
        type: '智能分区控制',
        components: [
          '线控器(每个房间)',
          '集中控制器(可选)',
          'APP远程控制',
          '能耗监测'
        ],
        features: ['独立温控', '定时控制', '场景模式', '故障诊断']
      };
    }
    
    return {
      type: '独立控制',
      components: ['遥控器', '线控器'],
      features: ['温度调节', '风速调节', '模式切换']
    };
  }

  /**
   * 生成设计摘要
   */
  generateSummary(coolingLoad, heatingLoad, acSystem) {
    return {
      totalCoolingLoad: `${coolingLoad.designLoad} W`,
      totalHeatingLoad: `${heatingLoad.totalLoad} W`,
      systemType: acSystem.type,
      estimatedInvestment: acSystem.estimatedCost?.total || '待计算',
      estimatedAnnualCost: '需根据运行时间计算'
    };
  }

  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

// 导出
module.exports = { AirConditioningEngine };
