/**
 * 水路系统设计引擎 (Water System Design Engine)
 * 负责冷水/热水/软水系统的设计计算
 * 参考开源项目: python-hvac (fluid_flow子包), PipeCAD, LiquiNet
 * 学习最佳实践: 流体流动计算、管道设计、水力分析
 */

const { DEFAULT_CATALOG } = require('./default-device-catalog');

class WaterSystemEngine {
  constructor(deviceCatalog = {}) {
    this.version = '2.0.0';
    this.name = 'WaterSystemEngine';

    // 水力计算常数
    this.WATER_DENSITY = 1000; // kg/m³
    this.GRAVITY = 9.81; // m/s²

    // 管材粗糙度 (mm)
    this.ROUGHNESS = {
      'PVC': 0.0015,
      'PE': 0.0015,
      'PP-R': 0.0015,
      '铜管': 0.001,
      '钢管': 0.045
    };

    // 流速限制 (m/s)
    this.VELOCITY_LIMITS = {
      '生活给水': { min: 0.6, max: 2.0 },
      '热水供应': { min: 0.6, max: 1.5 },
      '消防给水': { min: 1.0, max: 2.5 }
    };

    // 设备模板目录：默认模板 + 外部注入（来自产品模块）
    this.catalog = this.mergeCatalog(DEFAULT_CATALOG, deviceCatalog);
  }

  /**
   * 深合并目录：外部注入覆盖默认模板，保留未覆盖的默认字段。
   * 数组直接替换，对象递归合并，标量直接覆盖。
   */
  mergeCatalog(base, override) {
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return override;
    if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
    const out = { ...base };
    for (const key of Object.keys(override)) {
      if (typeof override[key] === 'object' && override[key] !== null && !Array.isArray(override[key])) {
        out[key] = this.mergeCatalog(base[key] || {}, override[key]);
      } else {
        out[key] = override[key];
      }
    }
    return out;
  }

  /**
   * 主入口: 生成水路系统设计方案
   * @param {Object} params - 设计参数
   * @param {Object} deviceCatalog - 可选：外部注入设备模板（来自产品模块），覆盖默认模板
   * @returns {Object} 设计方案
   */
  generateDesign(params, deviceCatalog = {}) {
    const effectiveCatalog = Object.keys(deviceCatalog).length
      ? this.mergeCatalog(this.catalog, deviceCatalog)
      : this.catalog;
    // 安全默认值：防止前端不传其他字段时 NaN 崩溃
    const safe = Object.assign({
      houseType: '三居',
      area: 100,
      residents: 3,
      bathrooms: 2,
      hasCentralHotWater: true,
      waterQuality: '中',
      city: '上海'
    }, params || {});
    const {
      houseType, area, residents, bathrooms,
      hasCentralHotWater, waterQuality, city
    } = safe;
    params = safe;

    console.log(`[WaterSystemEngine] 开始设计: ${houseType} ${area}m²`);

    // 1. 计算用水量需求
    const waterDemand = this.calculateWaterDemand(area, residents, bathrooms);

    // 2. 设计冷水系统
    const coldWaterSystem = this.designColdWaterSystem(waterDemand, houseType, effectiveCatalog);

    // 3. 设计热水系统
    const hotWaterSystem = this.designHotWaterSystem(waterDemand, houseType, hasCentralHotWater, effectiveCatalog);

    // 4. 设计软水系统 (如果需要)
    const softWaterSystem = this.designSoftWaterSystem(waterQuality, area, effectiveCatalog);

    // 5. 设计净水系统
    const pureWaterSystem = this.designPureWaterSystem(waterQuality, effectiveCatalog);

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      input: params,
      waterDemand,
      systems: {
        coldWater: coldWaterSystem,
        hotWater: hotWaterSystem,
        softWater: softWaterSystem,
        pureWater: pureWaterSystem
      },
      summary: this.generateSummary(coldWaterSystem, hotWaterSystem, softWaterSystem, pureWaterSystem)
    };
  }

  /**
   * 计算用水量需求
   * 参考《建筑给水排水设计标准》GB 50015
   */
  calculateWaterDemand(area, residents, bathrooms) {
    // 用水定额 (L/人·d)
    const waterQuota = 150; // 普通住宅
    
    // 日用水量
    const dailyConsumption = residents * waterQuota;
    
    // 最大时用水量 (小时变化系数 Kh = 2.5)
    const kh = 2.5;
    const hourlyConsumption = (dailyConsumption / 24) * kh;
    
    // 设计秒流量 (同时出水概率法)
    const fixtureUnits = bathrooms * 0.5 + residents * 0.2; // 当量数
    const designFlow = this.calculateDesignFlow(fixtureUnits);
    
    return {
      dailyConsumption,      // L/d
      hourlyConsumption,     // L/h
      designFlow,           // L/s
      designFlowM3h: designFlow * 3.6, // m³/h
      fixtureUnits,
      residents,
      peakHourFactor: kh
    };
  }

  /**
   * 计算设计秒流量 (当量法)
   * q = 0.2 × α × √Ng
   * α: 系数 (住宅取1.02)
   * Ng: 当量总数
   */
  calculateDesignFlow(fixtureUnits, alpha = 1.02) {
    if (fixtureUnits <= 0) return 0;
    const q = 0.2 * alpha * Math.sqrt(fixtureUnits); // L/s
    return Math.max(q, 0.1); // 最小0.1 L/s
  }

  /**
   * 设计冷水系统
   */
  designColdWaterSystem(waterDemand, houseType, catalog = this.catalog) {
    const { designFlow, designFlowM3h } = waterDemand;

    // 选择入户管径 (基于设计流量)
    const mainPipe = this.selectPipeDiameter(designFlowM3h, '入户总管', catalog);

    // 分支管路设计
    const branchPipes = this.designBranchPipes(houseType);

    // 水压校核
    const pressureCheck = this.checkWaterPressure(designFlow, mainPipe);

    return {
      type: '冷水系统',
      mainPipe,
      branchPipes,
      pressureCheck,
      totalLength: this.estimatePipeLength(houseType),
      fittings: this.selectFittings(houseType),
      recommendedDevices: this.selectColdWaterDevices(waterDemand, catalog)
    };
  }

  /**
   * 选择管径
   * 基于流速限制和经济流速
   */
  selectPipeDiameter(flow, pipeType, catalog = this.catalog) {
    const pipe = catalog.pipe || {};
    // 经济流速范围 (m/s)
    const economicVelocity = pipe.economicVelocity || { min: 0.6, max: 1.2 };

    // 标准管径系列 (mm)
    const standardDiameters = pipe.standardDiameters || [15, 20, 25, 32, 40, 50, 63, 75, 90, 110];

    // 计算所需管径: A = Q / v
    // A = π * d² / 4 => d = √(4Q / πv)
    // flow 单位: m³/h, 转换为 m³/s
    const Q = flow / 3600;

    // 取中间流速
    const v = (economicVelocity.min + economicVelocity.max) / 2;

    // 计算理论直径 (m)
    const dTheory = Math.sqrt((4 * Q) / (Math.PI * v));
    const dTheoryMm = dTheory * 1000;

    // 选择标准管径 (向上取整)
    const selectedDiameter = standardDiameters.find(d => d >= dTheoryMm) || 110;

    // 校核实际流速
    const actualArea = Math.PI * Math.pow(selectedDiameter / 1000 / 2, 2);
    const actualVelocity = Q / actualArea;

    return {
      type: pipeType,
      diameter: selectedDiameter,
      material: pipe.defaultMaterial || 'PP-R',
      theoreticalDiameter: Math.round(dTheoryMm),
      actualVelocity: Math.round(actualVelocity * 100) / 100,
      flowRate: flow,
      pressureDrop: this.calculatePressureDrop(Q, selectedDiameter, 10) // 假设10m管长
    };
  }

  /**
   * 计算沿程水头损失 (达西-魏斯巴赫公式)
   * hf = λ × (L/d) × (v²/2g)
   */
  calculatePressureDrop(flow, diameter, length) {
    const Q = flow; // m³/s
    const d = diameter / 1000; // m
    const L = length; // m
    const A = Math.PI * d * d / 4;
    const v = Q / A; // m/s
    
    // 雷诺数
    const Re = (v * d * this.WATER_DENSITY) / 0.001; // 水的动力粘度约0.001 Pa·s
    
    // 摩擦系数 (Blasius公式, 湍流)
    const lambda = 0.3164 / Math.pow(Re, 0.25);
    
    // 沿程损失
    const hf = lambda * (L / d) * (v * v / (2 * this.GRAVITY));
    
    return Math.round(hf * 100) / 100; // m
  }

  /**
   * 设计分支管路
   */
  designBranchPipes(houseType) {
    const configs = {
      '一居': [
        { name: '卫生间1', diameter: 25, fixtures: ['洗脸盆', '淋浴', '洗衣机'] },
        { name: '厨房', diameter: 20, fixtures: ['洗菜盆', '净水器'] }
      ],
      '二居': [
        { name: '卫生间1', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '卫生间2', diameter: 25, fixtures: ['洗脸盆', '淋浴'] },
        { name: '厨房', diameter: 25, fixtures: ['洗菜盆', '净水器', '洗碗机'] }
      ],
      '三居': [
        { name: '卫生间1(主)', diameter: 32, fixtures: ['洗脸盆', '淋浴', '浴缸', '马桶'] },
        { name: '卫生间2', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '卫生间3', diameter: 25, fixtures: ['洗脸盆', '淋浴'] },
        { name: '厨房', diameter: 25, fixtures: ['洗菜盆', '净水器', '洗碗机'] },
        { name: '阳台', diameter: 20, fixtures: ['洗衣机'] }
      ],
      '四居': [
        { name: '卫生间1(主)', diameter: 32, fixtures: ['洗脸盆', '淋浴', '浴缸', '马桶'] },
        { name: '卫生间2', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '卫生间3', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '卫生间4', diameter: 25, fixtures: ['洗脸盆', '淋浴'] },
        { name: '厨房', diameter: 32, fixtures: ['洗菜盆', '净水器', '洗碗机', '垃圾处理器'] },
        { name: '阳台1', diameter: 20, fixtures: ['洗衣机'] },
        { name: '阳台2', diameter: 20, fixtures: ['洗衣机', '拖布池'] }
      ],
      '别墅': [
        { name: '主卫', diameter: 40, fixtures: ['双洗脸盆', '淋浴', '浴缸×2', '马桶'] },
        { name: '客卫1', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '客卫2', diameter: 25, fixtures: ['洗脸盆', '淋浴', '马桶'] },
        { name: '客卫3', diameter: 25, fixtures: ['洗脸盆', '淋浴'] },
        { name: '厨房', diameter: 40, fixtures: ['洗菜盆×2', '净水器', '洗碗机', '垃圾处理器'] },
        { name: '洗衣房', diameter: 25, fixtures: ['洗衣机×2', '拖布池', '水槽'] },
        { name: '花园', diameter: 32, fixtures: ['户外水槽', '灌溉接口'] }
      ]
    };
    
    return configs[houseType] || configs['三居'];
  }

  /**
   * 水压校核
   */
  checkWaterPressure(designFlow, mainPipe) {
    // 假设市政水压0.2-0.3MPa (20-30m)
    const municipalPressure = 25; // m
    
    // 计算最不利点压力
    const pipeLoss = mainPipe.pressureDrop;
    const fixtureLoss = 3; // 器具损失估算
    const residualPressure = municipalPressure - pipeLoss - fixtureLoss;
    
    return {
      municipalPressure,
      pipeLoss,
      fixtureLoss,
      residualPressure: Math.round(residualPressure * 10) / 10,
      status: residualPressure > 10 ? '满足' : '需增压',
      needsPump: residualPressure <= 10,
      pumpHead: residualPressure <= 10 ? Math.ceil(15 - residualPressure) : 0
    };
  }

  /**
   * 设计热水系统
   */
  designHotWaterSystem(waterDemand, houseType, hasCentralHotWater, catalog = this.catalog) {
    const { dailyConsumption, residents } = waterDemand;
    
    // 热水定额 (60°C) L/人·d
    const hotWaterQuota = 60;
    const hotWaterDemand = residents * hotWaterQuota;
    
    // 热水负荷计算 (kW)
    // Q = m × c × Δt / (3600 × η)
    const c = 4.187; // kJ/(kg·K) 水的比热
    const deltaT = 40; // 温差 (60-20)
    const eta = 0.9; // 效率
    const heatLoad = (hotWaterDemand * c * deltaT) / (3600 * eta * 24); // 平均小时负荷
    const peakHeatLoad = heatLoad * 3; // 峰值负荷系数
    
    // 推荐热水器
    const heater = this.selectWaterHeater(peakHeatLoad, hasCentralHotWater, houseType, catalog);

    return {
      type: '热水系统',
      hotWaterDemand, // L/d
      heatLoad: Math.round(heatLoad * 100) / 100, // kW
      peakHeatLoad: Math.round(peakHeatLoad * 100) / 100, // kW
      circulation: hasCentralHotWater,
      recommendedHeater: heater,
      hotWaterPipes: this.designHotWaterPipes(houseType, hasCentralHotWater, catalog),
      energyEstimate: this.estimateHotWaterEnergy(hotWaterDemand)
    };
  }

  /**
   * 选择热水器
   */
  selectWaterHeater(peakLoad, hasCentralHotWater, houseType, catalog = this.catalog) {
    const hotWater = catalog.hotWater || {};
    if (hasCentralHotWater) {
      const tpl = hotWater.central || {
        type: '燃气壁挂炉(系统炉)',
        features: ['带热水循环', '智能恒温', '分区控制'],
        estimatedPrice: '15000-25000元',
      };
      return {
        ...tpl,
        capacity: `${Math.ceil(peakLoad)} kW`,
      };
    }

    const capacityMap = (hotWater.instant && hotWater.instant.capacityMap) || {
      '一居': '13L/min',
      '二居': '16L/min',
      '三居': '16-20L/min',
      '四居': '20-24L/min',
      '别墅': '24L/min以上',
    };
    const tpl = hotWater.instant || {
      type: '燃气热水器',
      features: ['零冷水', '恒温', '防冻'],
      estimatedPrice: '3000-8000元',
    };

    return {
      ...tpl,
      capacity: capacityMap[houseType] || '16L/min',
    };
  }

  /**
   * 设计热水管路
   */
  designHotWaterPipes(houseType, hasCentralHotWater, catalog = this.catalog) {
    if (!hasCentralHotWater) {
      return { type: '点对点', circulation: false, pipes: [] };
    }

    const circ = catalog.circulation || {};

    // 循环系统设计
    const circulationPipes = [
      { name: '热水供水干管', diameter: 25, insulation: true },
      { name: '热水回水干管', diameter: 20, insulation: true }
    ];

    return {
      type: '中央循环',
      circulation: true,
      circulationType: '干管循环', // or '立管循环', '支管循环'
      pipes: circulationPipes,
      pump: circ.pump || { head: '3-5m', power: '60-120W' },
      insulation: circ.insulation || { material: '橡塑', thickness: '20mm' }
    };
  }

  /**
   * 估算热水能耗
   */
  estimateHotWaterEnergy(hotWaterDemand) {
    const daysPerYear = 365;
    const energyPerLiter = 0.046; // kWh/L (从15°C加热到60°C)
    const annualEnergy = hotWaterDemand * daysPerYear * energyPerLiter;
    const gasConsumption = annualEnergy / 10.8; // 天然气热值约10.8 kWh/m³
    
    return {
      annualEnergy: Math.round(annualEnergy), // kWh
      gasConsumption: Math.round(gasConsumption), // m³
      annualCost: Math.round(gasConsumption * 3.0) // 按3元/m³计算
    };
  }

  /**
   * 设计软水系统
   */
  designSoftWaterSystem(waterQuality, area, catalog = this.catalog) {
    if (waterQuality === '软') {
      return { needed: false, reason: '水质较软，无需软化' };
    }

    // 计算软水需求
    const softWaterDemand = Math.ceil(area * 0.1); // m³/d 估算

    // 选择软水机规格（容量/再生周期/价格带）
    const softenerTypes = {
      '硬': { capacity: '2-3吨', regeneration: '3天', price: '8000-15000元' },
      '中': { capacity: '1-2吨', regeneration: '5天', price: '5000-10000元' }
    };

    const spec = softenerTypes[waterQuality] || softenerTypes['中'];
    const softenerCatalog = catalog.softener || {};

    const buildOption = (key, price) => {
      const tpl = softenerCatalog[key];
      if (!tpl) return null;
      return {
        ...tpl,
        capacity: spec.capacity,
        regenerationCycle: spec.regeneration,
        estimatedPrice: price || spec.price,
      };
    };

    const options = [
      buildOption('premium', waterQuality === '硬' ? '12000-18000元' : '8000-12000元'),
      buildOption('standard', spec.price),
      buildOption('alternative', spec.price),
    ].filter(Boolean);

    return {
      needed: true,
      reason: waterQuality === '硬' ? '水质偏硬，建议软化' : '中等硬度，可软化提升体验',
      softWaterDemand: `${softWaterDemand} m³/d`,
      options,
      installation: {
        location: '入户总管（建议安装在入户水表后）',
        space: '需要预留1m×0.6m×1.2m空间',
        power: '220V电源插座',
        drain: '需要排水口（再生废水排放）'
      },
      benefits: [
        '洗涤更省洗涤剂，衣物更柔软',
        '热水器、壁挂炉无水垢，延长寿命30%',
        '花洒、龙头无水垢堵塞',
        '皮肤洗浴后不紧绷',
        '餐具无水垢水渍'
      ],
      maintenance: {
        saltRefill: '每2-3个月补充软水盐（根据用水量）',
        service: '每年专业维护1次',
        cost: '年均维护成本约500-800元'
      }
    };
  }

  /**
   * 设计净水系统
   */
  designPureWaterSystem(waterQuality, catalog = this.catalog) {
    const stages = [];
    const pure = catalog.pureWater || {};
    const kitchen = catalog.kitchen || {};

    // 前置过滤器 (必备)
    if (pure.preFilter) {
      stages.push({ ...pure.preFilter });
    }

    // 中央净水 (推荐)
    if (waterQuality !== '软' && pure.centralFilter) {
      stages.push({ ...pure.centralFilter });
    }

    // 末端直饮 - 二选一：RO净水器 或 净热一体机
    const endWaterOptions = [];
    if (pure.roSystem) {
      endWaterOptions.push({ ...pure.roSystem });
    }
    if (pure.allInOne) {
      endWaterOptions.push({ ...pure.allInOne });
    }

    if (endWaterOptions.length) {
      stages.push({
        stage: 3,
        name: '末端直饮系统',
        type: 'end_water_system',
        options: endWaterOptions,
        recommendation: '推荐选择净热一体机，一站式解决净水+热水需求'
      });
    }

    // 厨房用水点补充 (可选)
    const kitchenComponents = [];
    if (kitchen.softenerConnection) kitchenComponents.push({ ...kitchen.softenerConnection });
    if (kitchen.smallHeater) kitchenComponents.push({ ...kitchen.smallHeater });
    if (kitchenComponents.length) {
      stages.push({
        stage: 4,
        name: '厨房用水优化',
        type: 'kitchen_water',
        optional: true,
        components: kitchenComponents
      });
    }

    return {
      type: '全屋净水系统',
      stages,
      totalEstimate: '5000-15000元',
      maintenance: '滤芯更换周期: 3-12个月'
    };
  }

  /**
   * 估算管路长度
   */
  estimatePipeLength(houseType) {
    const lengths = {
      '一居': 30,
      '二居': 50,
      '三居': 80,
      '四居': 120,
      '别墅': 200
    };
    return lengths[houseType] || 80;
  }

  /**
   * 选择管件
   */
  selectFittings(houseType) {
    const counts = {
      '一居': { valves: 6, elbows: 20, tees: 8, couplings: 10 },
      '二居': { valves: 10, elbows: 30, tees: 15, couplings: 15 },
      '三居': { valves: 16, elbows: 50, tees: 25, couplings: 25 },
      '四居': { valves: 24, elbows: 70, tees: 35, couplings: 35 },
      '别墅': { valves: 40, elbows: 120, tees: 60, couplings: 50 }
    };
    return counts[houseType] || counts['三居'];
  }

  /**
   * 选择冷水设备
   */
  selectColdWaterDevices(waterDemand, catalog = this.catalog) {
    const { designFlow } = waterDemand;
    const cold = catalog.coldWater || {};

    const devices = [];

    // 入户总阀
    if (cold.mainValve) {
      devices.push({ ...cold.mainValve });
    }

    // 减压阀 (如需要)
    if (designFlow > 2 && cold.pressureReducingValve) {
      devices.push({ ...cold.pressureReducingValve });
    }

    // 水表
    if (cold.waterMeter) {
      devices.push({ ...cold.waterMeter });
    }

    return devices;
  }

  /**
   * 生成设计摘要
   */
  generateSummary(coldWater, hotWater, softWater, pureWater) {
    let summary = {
      totalSystems: 4,
      mainComponents: [],
      estimatedCost: {
        pipes: 0,
        fittings: 0,
        devices: 0,
        total: 0
      }
    };
    
    // 汇总主要组件
    if (coldWater.mainPipe) {
      summary.mainComponents.push(`入户管: DN${coldWater.mainPipe.diameter}`);
    }
    
    if (hotWater.recommendedHeater) {
      summary.mainComponents.push(`热水器: ${hotWater.recommendedHeater.type}`);
    }
    
    if (softWater.needed) {
      // designSoftWaterSystem 返回 {options:[...]}，向下兼容旧 recommendedSoftener 字段
      const cap =
        (softWater.recommendedSoftener && softWater.recommendedSoftener.capacity) ||
        (softWater.options && softWater.options[0] && softWater.options[0].capacity) ||
        '中等容量';
      summary.mainComponents.push(`软水机: ${cap}`);
    }
    
    if (pureWater.stages) {
      summary.mainComponents.push(`净水: ${pureWater.stages.filter(s => !s.optional).length}级`);
    }
    
    return summary;
  }

  /**
   * 计算局部阻力 (弯头、三通、阀门等)
   * hj = Σζ × (v²/2g)
   * @param {Array} fittings - 管件列表 [{type, count}, ...]
   * @param {number} velocity - 流速 m/s
   * @returns {number} 局部阻力损失 m
   */
  calculateLocalResistance(fittings, velocity) {
    // 局部阻力系数表
    const zetaValues = {
      '90弯头': 0.5,
      '45弯头': 0.3,
      '三通直通': 0.3,
      '三通分流': 1.0,
      '闸阀全开': 0.2,
      '截止阀全开': 3.0,
      '球阀': 0.1,
      '止回阀': 2.0,
      '变径': 0.3,
      '入口': 1.0,
      '出口': 1.0
    };
    
    let totalZeta = 0;
    const details = [];
    
    fittings.forEach(fitting => {
      const zeta = zetaValues[fitting.type] || 0.5;
      const subTotal = zeta * fitting.count;
      totalZeta += subTotal;
      details.push({
        type: fitting.type,
        count: fitting.count,
        zeta: zeta,
        subTotal: Math.round(subTotal * 100) / 100
      });
    });
    
    // 计算局部阻力: hj = Σζ × (v²/2g)
    const localResistance = totalZeta * (velocity * velocity) / (2 * this.GRAVITY);
    
    return {
      totalZeta: Math.round(totalZeta * 100) / 100,
      velocity: Math.round(velocity * 100) / 100,
      localResistance: Math.round(localResistance * 100) / 100,
      details
    };
  }

  /**
   * 完整水力计算
   * 计算管路系统的总压力损失和所需水泵扬程
   */
  performHydraulicCalculation(pipeSystem) {
    const { pipes, fittings, elevation } = pipeSystem;
    
    let totalFrictionLoss = 0;
    let totalLocalResistance = 0;
    const pipeDetails = [];
    
    // 计算每段管路的沿程损失
    pipes.forEach(pipe => {
      const Q = pipe.flow / 3600; // m³/s
      const d = pipe.diameter / 1000; // m
      const L = pipe.length; // m
      
      const area = Math.PI * d * d / 4;
      const velocity = Q / area;
      
      // 计算雷诺数
      const Re = (velocity * d * this.WATER_DENSITY) / 0.001;
      
      // 使用更精确的Colebrook-White公式或Swamee-Jain近似
      // 这里使用Blasius简化
      let lambda;
      if (Re < 2300) {
        lambda = 64 / Re; // 层流
      } else {
        lambda = 0.3164 / Math.pow(Re, 0.25); // 湍流
      }
      
      const frictionLoss = lambda * (L / d) * (velocity * velocity / (2 * this.GRAVITY));
      
      totalFrictionLoss += frictionLoss;
      
      pipeDetails.push({
        section: pipe.name,
        diameter: pipe.diameter,
        length: L,
        flow: pipe.flow,
        velocity: Math.round(velocity * 100) / 100,
        frictionLoss: Math.round(frictionLoss * 100) / 100
      });
    });
    
    // 计算局部阻力 (使用最后一段管的流速)
    const lastPipe = pipes[pipes.length - 1];
    const lastVelocity = (lastPipe.flow / 3600) / (Math.PI * Math.pow(lastPipe.diameter / 1000, 2) / 4);
    const localResist = this.calculateLocalResistance(fittings, lastVelocity);
    totalLocalResistance = localResist.localResistance;
    
    // 高程差
    const elevationLoss = elevation || 0;
    
    // 总压力损失
    const totalPressureLoss = totalFrictionLoss + totalLocalResistance + elevationLoss;
    
    // 末端剩余压力需求 (一般10m)
    const requiredEndPressure = 10;
    
    // 计算所需水泵扬程
    const municipalPressure = 25; // 假设市政压力25m
    const requiredPumpHead = Math.max(0, requiredEndPressure + totalPressureLoss - municipalPressure);
    
    return {
      pipeDetails,
      localResistance: localResist,
      elevationLoss,
      frictionLoss: Math.round(totalFrictionLoss * 100) / 100,
      localLoss: Math.round(totalLocalResistance * 100) / 100,
      totalLoss: Math.round(totalPressureLoss * 100) / 100,
      municipalPressure,
      requiredEndPressure,
      requiredPumpHead: Math.round(requiredPumpHead * 10) / 10,
      needsPump: requiredPumpHead > 0,
      recommendedPump: requiredPumpHead > 0 ? {
        head: Math.ceil(requiredPumpHead),
        flow: Math.ceil(pipes[0].flow),
        type: '变频增压泵',
        power: `${Math.ceil(requiredPumpHead * pipes[0].flow / 3600 / 0.6 / 10)}kW`
      } : null
    };
  }

  /**
   * 水力平衡分析
   * 检查各支路压力是否平衡
   */
  analyzeHydraulicBalance(branchPipes) {
    const branches = branchPipes.map(branch => {
      const calc = this.performHydraulicCalculation({
        pipes: [{
          name: branch.name,
          diameter: branch.diameter,
          length: branch.length || 10,
          flow: branch.flow || 0.5
        }],
        fittings: branch.fittings || [{ type: '三通分流', count: 1 }],
        elevation: branch.elevation || 0
      });
      
      return {
        name: branch.name,
        pressureLoss: calc.totalLoss,
        flow: branch.flow || 0.5
      };
    });
    
    // 找出最不利环路
    const worstBranch = branches.reduce((max, b) => b.pressureLoss > max.pressureLoss ? b : max, branches[0]);
    
    // 计算不平衡率
    const imbalances = branches.map(b => ({
      name: b.name,
      pressureLoss: b.pressureLoss,
      imbalance: Math.round((b.pressureLoss - worstBranch.pressureLoss) / worstBranch.pressureLoss * 100) / 100,
      needsBalancing: Math.abs(b.pressureLoss - worstBranch.pressureLoss) / worstBranch.pressureLoss > 0.15
    }));
    
    return {
      branches: imbalances,
      worstBranch: worstBranch.name,
      isBalanced: imbalances.every(b => !b.needsBalancing),
      recommendations: imbalances.filter(b => b.needsBalancing).map(b => 
        `${b.name}需要加装平衡阀或调整管径`
      )
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
      timestamp: new Date().toISOString(),
      features: [
        '用水量计算',
        '管径选择',
        '压力损失计算 (达西-魏斯巴赫)',
        '局部阻力计算',
        '完整水力计算',
        '水力平衡分析',
        '水泵选型'
      ]
    };
  }
}

// 导出
module.exports = { WaterSystemEngine };
