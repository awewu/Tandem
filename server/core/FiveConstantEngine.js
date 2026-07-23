/**
 * 五恒系统专业设计引擎 (Five Constant System Engine)
 * 恒温、恒湿、恒氧、恒洁、恒静
 * 辐射供冷供暖 + 新风 + 除湿 + 智能控制
 * 行业领先：毛细管辐射 + 置换新风 + 智能算法
 */

class FiveConstantEngine {
  constructor() {
    this.version = '2.0.0';
    this.name = 'FiveConstantEngine';
    
    // 五恒设计标准
    this.STANDARDS = {
      temperature: { target: 24, tolerance: 1 },      // 恒温: 24±1℃
      humidity: { target: 50, tolerance: 10 },       // 恒湿: 50±10%RH
      co2: { max: 1000 },                            // 恒氧: CO2<1000ppm
      pm25: { max: 35 },                             // 恒洁: PM2.5<35μg/m³
      noise: { max: 35 }                             // 恒静: <35dB
    };
    
    // 辐射系统参数
    this.RADIATION_PARAMS = {
      capillary: {
        tubeDiameter: 4.3,        // 毛细管内径 mm
        tubeSpacing: 20,          // 管间距 mm
        coverage: 0.7,            // 铺设率 70%
        coolingCapacity: 80,      // 制冷量 W/m²
        heatingCapacity: 100      // 制热量 W/m²
      },
      floor: {
        tubeDiameter: 16,       // 地暖管径 mm
        tubeSpacing: 150,         // 管间距 mm
        coverage: 0.6,            // 铺设率 60%
        heatingCapacity: 120      // 制热量 W/m²
      }
    };
  }

  /**
   * 主入口: 五恒系统完整设计
   */
  generateDesign(params) {
    // 安全默认值：防止前端不传字段时 NaN 崩溃
    const safe = Object.assign({
      area: 100,
      floors: 1,
      rooms: [],
      orientation: '南北',
      insulation: '中',
      climateZone: '夏热冬冷',
      occupancy: 3,
      hasBasement: false,
      specialRequirements: []
    }, params || {});
    params = safe;
    const {
      area, floors, rooms, orientation, insulation, climateZone,
      occupancy, hasBasement, specialRequirements
    } = safe;

    console.log(`[FiveConstantEngine] 五恒系统设计: ${area}m²`);

    // 1. 负荷精确计算
    const loads = this.calculateLoads(params);
    
    // 2. 辐射系统设计 (恒温核心)
    const radiationSystem = this.designRadiationSystem(loads, area, rooms);
    
    // 3. 置换新风系统设计 (恒氧+恒洁)
    const freshAirSystem = this.designDisplacementFreshAir(area, occupancy, rooms);
    
    // 4. 湿度控制系统 (恒湿)
    const humidityControl = this.designHumidityControl(area, loads, climateZone);
    
    // 5. 智能控制系统 (五恒大脑)
    const controlSystem = this.designSmartControl(radiationSystem, freshAirSystem, humidityControl);
    
    // 6. 隔音降噪设计 (恒静)
    const acousticDesign = this.designAcousticSystem(rooms);

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      input: params,
      
      // 五恒核心指标
      fiveConstants: {
        temperature: {
          name: '恒温',
          target: `${this.STANDARDS.temperature.target}±${this.STANDARDS.temperature.tolerance}℃`,
          system: radiationSystem,
          comfort: '无吹风感，无温度死角'
        },
        humidity: {
          name: '恒湿',
          target: `${this.STANDARDS.humidity.target}±${this.STANDARDS.humidity.tolerance}%RH`,
          system: humidityControl
        },
        oxygen: {
          name: '恒氧',
          target: `CO₂<${this.STANDARDS.co2.max}ppm`,
          system: freshAirSystem,
          airChanges: '1.5-2次/小时置换新风'
        },
        clean: {
          name: '恒洁',
          target: `PM2.5<${this.STANDARDS.pm25.max}μg/m³`,
          filtration: 'H13级HEPA+活性炭+负离子'
        },
        quiet: {
          name: '恒静',
          target: `<${this.STANDARDS.noise.max}dB`,
          design: acousticDesign
        }
      },
      
      // 专业系统配置
      systems: {
        radiation: radiationSystem,       // 辐射供冷供暖
        freshAir: freshAirSystem,           // 置换新风
        humidity: humidityControl,          // 湿度控制
        control: controlSystem,             // 智能控制
        acoustic: acousticDesign            // 声学设计
      },
      
      // 负荷计算结果
      loads,
      
      // 设备选型
      equipment: this.selectEquipment(radiationSystem, freshAirSystem, humidityControl),
      
      // 管路设计
      piping: this.designPiping(radiationSystem, freshAirSystem, area, rooms),
      
      // 成本估算
      cost: this.estimateCost(radiationSystem, freshAirSystem, humidityControl, area),
      
      // 能耗分析
      energy: this.analyzeEnergy(radiationSystem, freshAirSystem, area),
      
      // 施工要点
      construction: this.generateConstructionNotes(radiationSystem, freshAirSystem),
      
      summary: this.generateSummary(params, loads, radiationSystem)
    };
  }

  /**
   * 负荷精确计算 (五恒专用)
   * 比普通负荷计算更精细，考虑辐射供冷特点
   */
  calculateLoads(params) {
    const { area, orientation, insulation, climateZone, rooms } = params;
    
    // 围护结构负荷 (精确到每个房间)
    const roomLoads = rooms.map(room => {
      // 面积负荷
      const areaLoad = room.area * this.getLoadFactor(climateZone, room.type);
      
      // 朝向修正
      const orientationFactor = this.getOrientationFactor(room.orientation);
      
      // 保温修正
      const insulationFactor = insulation === 'good' ? 0.8 : insulation === 'normal' ? 1.0 : 1.2;
      
      // 辐射供冷修正系数 (0.7-0.8，辐射供冷效率更高)
      const radiationFactor = 0.75;
      
      const coolingLoad = Math.round(areaLoad * orientationFactor * insulationFactor * radiationFactor);
      const heatingLoad = Math.round(coolingLoad * 0.6); // 采暖负荷约为制冷60%
      
      return {
        name: room.name,
        area: room.area,
        coolingLoad,
        heatingLoad,
        capillaryLength: this.calculateCapillaryLength(room.area),
        floorArea: room.area * 0.6  // 可铺设地板面积
      };
    });
    
    const totalCooling = roomLoads.reduce((sum, r) => sum + r.coolingLoad, 0);
    const totalHeating = roomLoads.reduce((sum, r) => sum + r.heatingLoad, 0);
    
    return {
      roomLoads,
      totalCooling,
      totalHeating,
      avgLoad: Math.round(totalCooling / area),
      designCooling: Math.round(totalCooling * 1.1),  // 10%余量
      designHeating: Math.round(totalHeating * 1.1)
    };
  }

  /**
   * 辐射系统设计 (核心)
   * 毛细管辐射 + 地暖混合系统
   */
  designRadiationSystem(loads, area, rooms) {
    const { totalCooling, totalHeating, roomLoads } = loads;
    
    // 1. 毛细管辐射系统 (顶棚/墙面)
    const capillarySystem = {
      type: '毛细管辐射',
      location: ['顶棚', '部分墙面'],
      tube: {
        diameter: this.RADIATION_PARAMS.capillary.tubeDiameter,
        material: 'PE-RT',
        spacing: this.RADIATION_PARAMS.capillary.tubeSpacing
      },
      coverage: this.RADIATION_PARAMS.capillary.coverage,
      coolingCapacity: this.RADIATION_PARAMS.capillary.coolingCapacity,
      heatingCapacity: this.RADIATION_PARAMS.capillary.heatingCapacity,
      
      // 房间配置
      rooms: roomLoads.map(room => ({
        name: room.name,
        area: room.area,
        capillaryArea: room.area * 0.7,  // 顶棚70%铺设
        tubeLength: room.capillaryLength,
        circuits: Math.ceil(room.capillaryLength / 80),  // 每回路<80m
        coolingLoad: room.coolingLoad,
        heatingLoad: room.heatingLoad
      })),
      
      totalTubeLength: roomLoads.reduce((sum, r) => sum + r.capillaryLength, 0),
      totalCircuits: roomLoads.reduce((sum, r) => sum + Math.ceil(r.capillaryLength / 80), 0),
      
      // 供回水参数
      supplyTemp: { cooling: 16, heating: 32 },  // 高温供冷/低温供暖
      returnTemp: { cooling: 19, heating: 28 },
      deltaT: 3,  // 供回水温差
      
      features: [
        '无吹风感，极致舒适',
        '顶棚供冷，地暖供热，分区控制',
        '高温冷水(16℃)，避免结露',
        '与新风系统协同，防结露保护'
      ]
    };
    
    // 2. 地暖辅助 (仅采暖季使用)
    const floorHeating = {
      type: '地暖辅助',
      location: '地面',
      tube: {
        diameter: this.RADIATION_PARAMS.floor.tubeDiameter,
        material: 'PE-RT',
        spacing: this.RADIATION_PARAMS.floor.tubeSpacing
      },
      coverage: this.RADIATION_PARAMS.floor.coverage,
      heatingCapacity: this.RADIATION_PARAMS.floor.heatingCapacity,
      
      rooms: roomLoads.map(room => ({
        name: room.name,
        floorArea: room.floorArea,
        tubeLength: Math.ceil(room.floorArea / 0.15),  // 间距150mm
        heatingLoad: room.heatingLoad * 0.4  // 承担40%采暖负荷
      })),
      
      supplyTemp: 35,
      returnTemp: 28,
      
      features: ['采暖季辅助供暖', '脚暖头凉，舒适健康']
    };
    
    // 3. 热源/冷源设备
    const sourceEquipment = this.selectSourceEquipment(totalCooling, totalHeating);
    
    return {
      capillary: capillarySystem,
      floorHeating,
      sourceEquipment,
      
      // 防结露控制 (关键)
      antiCondensation: {
        method: '露点温度监测+供水温度调节',
        sensors: '每个房间温湿度传感器',
        control: '供水温度 = 露点温度 + 2℃ 安全余量',
        responseTime: '<30秒'
      },
      
      // 分区控制
      zoning: this.designRadiationZoning(rooms)
    };
  }

  /**
   * 置换新风系统设计 (恒氧+恒洁)
   * 下送上回，空气品质优于传统新风
   */
  designDisplacementFreshAir(area, occupancy, rooms) {
    const peopleCount = occupancy || Math.ceil(area / 10);
    
    // 新风量计算 (高于国标，追求品质)
    const freshAirPerPerson = 40;  // m³/h·人 (国标30，五恒取40)
    const totalFreshAir = peopleCount * freshAirPerPerson;
    const airChanges = totalFreshAir / (area * 2.8);
    
    // 置换通风设计
    const displacementDesign = {
      type: '置换式新风',
      principle: '下送上回，热羽流上升带走污染物',
      
      // 送风方式
      supply: {
        type: '地面/踢脚线送风',
        velocity: '<0.3m/s',  // 低风速，无吹风感
        temp: { summer: 18, winter: 20 },  // 略高于露点
        outlets: rooms.map(room => ({
          room: room.name,
          airVolume: Math.ceil(room.area * 2.8 * airChanges),
          outletsCount: Math.ceil(room.area / 20),  // 每20㎡一个送风口
          location: '踢脚线/地面'
        }))
      },
      
      // 回风方式
      return: {
        type: '顶部回风',
        location: '走廊/卫生间/厨房顶部',
        velocity: '<1.5m/s'
      },
      
      // 净化系统
      filtration: {
        stages: [
          { level: 'G4', target: '大颗粒灰尘', efficiency: '90%' },
          { level: 'F7', target: 'PM10', efficiency: '85%' },
          { level: 'H13', target: 'PM2.5', efficiency: '99.97%' },
          { level: '活性炭', target: '甲醛/VOC', efficiency: '90%' },
          { level: '负离子', target: '细菌/异味', efficiency: '95%' }
        ],
        pm25Target: '<10μg/m³'  // 远低于国标35
      },
      
      // 热回收
      heatRecovery: {
        type: '全热交换',
        efficiency: '>75%',
        enthalpyRecovery: true,  // 回收潜热
        bypassMode: true  // 过渡季节旁通
      },
      
      // 加湿/除湿
      humidityControl: {
        humidification: { type: '蒸汽加湿', capacity: '5kg/h' },
        dehumidification: { type: '冷凝除湿', capacity: '30L/天' }
      },
      
      // 设备选型
      units: this.selectFreshAirUnits(totalFreshAir, rooms.length)
    };
    
    return {
      type: '置换新风系统',
      totalVolume: `${totalFreshAir} m³/h`,
      airChanges: `${airChanges.toFixed(1)} 次/h`,
      peopleCount,
      designBasis: `${peopleCount}人 × ${freshAirPerPerson}m³/h`,
      
      displacement: displacementDesign,
      
      // 空气品质指标
      airQuality: {
        co2: '<800ppm (优于国标1000)',
        pm25: '<10μg/m³ (优于国标35)',
        pm10: '<20μg/m³ (优于国标75)',
        formaldehyde: '<0.05mg/m³ (优于国标0.1)',
        tvoc: '<0.3mg/m³ (优于国标0.6)',
        bacteria: '<500CFU/m³',
        negativeIons: '>1000个/cm³'
      },
      
      features: [
        '置换通风，空气品质优于混合通风',
        'H13级HEPA，PM2.5<10μg/m³',
        '全热回收75%+，节能运行',
        '智能旁通，过渡季节自然通风'
      ]
    };
  }

  /**
   * 湿度控制系统 (恒湿)
   */
  designHumidityControl(area, loads, climateZone) {
    const isHumidClimate = ['南方', '沿海'].includes(climateZone);
    const isDryClimate = ['北方', '西北'].includes(climateZone);
    
    return {
      target: '45-55%RH',
      sensors: '每个房间独立湿度监测',
      
      // 加湿 (冬季/干燥地区)
      humidification: isDryClimate ? {
        type: '电极式蒸汽加湿',
        capacity: `${Math.ceil(area * 0.03)} kg/h`,
        method: '新风机组集中加湿',
        features: ['洁净蒸汽', '自动调节', '防细菌滋生']
      } : null,
      
      // 除湿 (夏季/潮湿地区)
      dehumidification: isHumidClimate ? {
        type: '双源除湿',
        methods: [
          { type: '新风冷凝除湿', capacity: '30L/天', for: '潜热负荷' },
          { type: '辐射系统高温供冷', capacity: '防结露', for: '显热负荷' }
        ],
        target: '露点温度控制',
        features: ['不降温除湿', '舒适节能']
      } : null,
      
      // 智能控制策略
      controlStrategy: {
        summer: '辐射供冷+新风除湿，露点控制',
        winter: '辐射供暖+新风加湿，湿度设定45%',
        transition: '自然通风+湿度监测'
      }
    };
  }

  /**
   * 智能控制系统 (五恒大脑)
   */
  designSmartControl(radiation, freshAir, humidity) {
    return {
      type: 'AI五恒控制器',
      brand: '瑞美/霍尼韦尔/西门子',
      
      // 传感器网络
      sensors: {
        temperature: '每房间1个 (顶棚/墙面)',
        humidity: '每房间1个',
        co2: '客厅/卧室各1个',
        pm25: '新风机组内置',
        pressure: '送风/回风压差',
        flow: '各支路流量计'
      },
      
      // 控制策略
      controlStrategies: [
        {
          name: '恒温控制',
          method: '顶棚辐射供冷/供暖 + 供水温度调节',
          precision: '±0.5℃',
          response: '缓慢调节，避免温度波动'
        },
        {
          name: '恒湿控制',
          method: '新风加湿/除湿 + 辐射防结露',
          precision: '±5%RH',
          priority: '防结露 > 舒适度'
        },
        {
          name: '恒氧控制',
          method: 'CO2浓度联动新风量',
          mode: '变风量运行',
          energySaving: '30%'
        },
        {
          name: '防结露保护',
          method: '露点计算+供水温度限制',
          safety: '最高优先级'
        }
      ],
      
      // AI优化
      aiFeatures: [
        '学习用户习惯，预调节温度',
        '预测天气，提前调节负荷',
        '能耗优化，自动选择最节能模式',
        '故障预警，远程诊断'
      ],
      
      // 用户界面
      userInterface: {
        mobile: 'APP远程控制',
        wall: '触摸屏面板',
        voice: '语音控制 (小爱/天猫)'
      }
    };
  }

  /**
   * 声学设计 (恒静)
   */
  designAcousticSystem(rooms) {
    return {
      target: '<35dB(A)',
      
      // 设备降噪
      equipment: {
        source: '主机置于室外/设备间',
        isolation: '减震垫+软连接',
        enclosure: '隔音罩 (降噪10dB)'
      },
      
      // 管路降噪
      piping: {
        velocity: '<0.8m/s',  // 低流速，低噪音
        supports: '弹性吊架，避免固体传声',
        insulation: '吸音保温一体化'
      },
      
      // 风口降噪
      outlets: {
        type: '微孔散流器',
        velocity: '<0.3m/s',
        noise: '<25dB'
      },
      
      // 分区噪音目标
      roomTargets: rooms.map(room => ({
        name: room.name,
        target: room.type === '卧室' ? 30 : 35,
        measures: room.type === '卧室' ? ['主机远离', '管路优化'] : ['标准设计']
      }))
    };
  }

  // ========== 辅助方法 ==========
  
  calculateCapillaryLength(area) {
    return Math.ceil(area * 0.7 * 1000 / 20 * 1.1);  // 铺设率70%，间距20mm，10%余量
  }
  
  getLoadFactor(climateZone, roomType) {
    const baseFactors = {
      '严寒': 120, '寒冷': 100, '夏热冬冷': 130, '夏热冬暖': 140, '温和': 110
    };
    const typeFactors = { 'livingRoom': 1.0, 'bedroom': 0.9, 'kitchen': 1.2, 'bathroom': 0.8 };
    return (baseFactors[climateZone] || 120) * (typeFactors[roomType] || 1.0);
  }
  
  getOrientationFactor(orientation) {
    const factors = { 'south': 1.0, 'east': 1.1, 'west': 1.2, 'north': 0.9 };
    return factors[orientation] || 1.0;
  }
  
  selectSourceEquipment(cooling, heating) {
    // 五恒专用高温供冷热泵
    const capacity = Math.max(cooling, heating) / 1000;  // kW
    
    return {
      type: '高温供冷热泵',
      brand: '瑞美/特灵/约克',
      model: `五恒专用${Math.ceil(capacity)}kW`,
      coolingCapacity: cooling,
      heatingCapacity: heating,
      supplyTemp: { cooling: '12-16℃', heating: '28-35℃' },
      cop: { cooling: 4.5, heating: 3.8 },
      features: [
        '高温供冷(16℃)，匹配辐射系统',
        '变频调节，部分负荷高效',
        '防冻保护，冬季安全运行'
      ]
    };
  }
  
  designRadiationZoning(rooms) {
    // 分区控制策略
    const zones = [];
    const commonRooms = rooms.filter(r => ['livingRoom', 'diningRoom'].includes(r.type));
    const privateRooms = rooms.filter(r => ['bedroom', 'study'].includes(r.type));
    const serviceRooms = rooms.filter(r => ['kitchen', 'bathroom'].includes(r.type));
    
    if (commonRooms.length) zones.push({ name: '公共区域', rooms: commonRooms, priority: '高' });
    if (privateRooms.length) zones.push({ name: '卧室区域', rooms: privateRooms, priority: '高' });
    if (serviceRooms.length) zones.push({ name: '厨卫区域', rooms: serviceRooms, priority: '低' });
    
    return zones;
  }
  
  selectFreshAirUnits(totalVolume, roomCount) {
    const units = [];
    let remaining = totalVolume;
    
    // 大型集中式或分区设置
    if (roomCount <= 3) {
      units.push({
        type: '集中式全热交换器',
        capacity: `${Math.ceil(remaining / 50) * 50} m³/h`,
        count: 1,
        location: '设备间/阳台'
      });
    } else {
      // 分区设置
      const zones = Math.ceil(roomCount / 2);
      const perZone = Math.ceil(remaining / zones / 50) * 50;
      for (let i = 0; i < zones; i++) {
        units.push({
          type: '分体式全热交换器',
          capacity: `${perZone} m³/h`,
          zone: `区域${i + 1}`,
          location: '吊顶/设备间'
        });
      }
    }
    
    return units;
  }
  
  designPiping(radiation, freshAir, area, rooms) {
    return {
      radiation: {
        mainPipe: 'DN25-32 PPR保温',
        branchPipe: 'DN16-20 PPR',
        totalLength: `${Math.ceil(area * 5)}米`,
        insulation: 'B1级橡塑保温，厚度20mm'
      },
      freshAir: {
        supplyDuct: 'EPP/酚醛复合风管',
        returnDuct: 'PVC/金属风管',
        totalLength: `${Math.ceil(area * 3)}米`,
        insulation: '风管自带保温'
      }
    };
  }
  
  selectEquipment(radiation, freshAir, humidity) {
    return {
      source: radiation.sourceEquipment,
      freshAir: freshAir.units,
      circulation: {
        type: '变频循环泵',
        flow: `${Math.ceil(radiation.capillary.totalCircuits * 80 * 2 / 1000)} m³/h`,
        head: '6m',
        count: 2  // 一用一备
      },
      buffer: {
        type: '缓冲水箱',
        volume: `${Math.ceil(radiation.sourceEquipment.heatingCapacity / 1000 * 50)}L`,
        function: '蓄能+排气+补水'
      }
    };
  }
  
  estimateCost(radiation, freshAir, humidity, area) {
    // 五恒系统成本估算 (行业参考)
    const capillaryCost = area * 400;  // 400元/㎡
    const freshAirCost = area * 200;   // 200元/㎡
    const sourceCost = 30000 + radiation.sourceEquipment.heatingCapacity * 10;
    const controlCost = 15000;
    const installationCost = (capillaryCost + freshAirCost) * 0.3;
    
    const total = capillaryCost + freshAirCost + sourceCost + controlCost + installationCost;
    
    return {
      breakdown: {
        radiation: { desc: '毛细管辐射系统', amount: capillaryCost, unit: 400 },
        freshAir: { desc: '置换新风系统', amount: freshAirCost, unit: 200 },
        source: { desc: '冷热源设备', amount: sourceCost },
        control: { desc: '智能控制系统', amount: controlCost },
        installation: { desc: '安装调试', amount: installationCost }
      },
      total,
      perSqm: Math.round(total / area),
      range: { min: Math.round(total * 0.9), max: Math.round(total * 1.1) }
    };
  }
  
  analyzeEnergy(radiation, freshAir, area) {
    // 能耗分析
    const annualCooling = area * 25;  // kWh/㎡·年
    const annualHeating = area * 30;  // kWh/㎡·年
    const annualFreshAir = area * 8;  // 新风能耗
    
    return {
      annualConsumption: {
        cooling: annualCooling,
        heating: annualHeating,
        freshAir: annualFreshAir,
        total: annualCooling + annualHeating + annualFreshAir
      },
      comparison: {
        vsTraditional: '-30%',
        vsVRF: '-25%',
        vsSplit: '-40%'
      },
      cop: {
        cooling: 4.5,
        heating: 3.8
      },
      features: [
        '辐射供冷高温水，提升主机效率',
        '全热回收新风，降低新风负荷',
        '智能控制，按需供给'
      ]
    };
  }
  
  generateConstructionNotes(radiation, freshAir) {
    return [
      '1. 顶棚毛细管铺设前，必须完成打压试验',
      '2. 抹灰层需添加防开裂纤维，厚度≥15mm',
      '3. 送风口安装高度≤300mm，确保置换效果',
      '4. 露点温度监测系统必须调试完成',
      '5. 系统联合试运行≥72小时，无结露方可交付',
      '6. 用户培训：不能随意开窗，保持系统密闭',
      '7. 定期维护：滤网清洗、水质检测、设备保养'
    ];
  }
  
  generateSummary(params, loads, radiation) {
    return {
      comfortLevel: '顶级舒适',
      applicable: '高端住宅、别墅、品质公寓',
      features: '无风感、无噪音、恒温恒湿、空气质量优异',
      investment: '较高，但长期舒适健康回报',
      recommendation: '追求极致舒适的首选方案'
    };
  }
}

module.exports = { FiveConstantEngine };
