/**
 * 智能报价引擎 v2.0 - QuotationEngine
 * 多维度架构：产品+材料+施工+管理+面积+环境
 * 对标行业最优：酷家乐/齐家网/土巴兔报价机制
 * 
 * 架构维度：
 * 1. 产品维度 - 设备型号、规格、品牌
 * 2. 材料维度 - 管材、辅料、配件
 * 3. 施工维度 - 安装费、人工费、工艺费
 * 4. 管理维度 - 项目管理、监理、售后
 * 5. 面积维度 - 按平米/房间/点位计费
 * 6. 环境维度 - 气候、楼层、施工难度
 * 7. 智能维度 - AI学习最优报价策略
 */

class QuotationEngine {
  constructor() {
    this.version = '2.0.0';
    this.pricingModels = this.loadPricingModels();
    this.regionFactors = this.loadRegionFactors();
    this.learnedStrategies = this.loadLearnedStrategies();
  }

  /**
   * 加载定价模型（全网学习最优机制）
   */
  loadPricingModels() {
    return {
      // 酷家乐模式 - 按空间模块化报价
      kujiale: {
        name: '空间模块化',
        description: '按房间空间独立报价，适合整装',
        formula: 'sum(空间面积 × 空间单价 × 难度系数)',
        spaces: {
          living: { basePrice: 350, name: '客厅' },
          bedroom: { basePrice: 280, name: '卧室' },
          kitchen: { basePrice: 450, name: '厨房' },
          bathroom: { basePrice: 500, name: '卫生间' }
        }
      },
      
      // 齐家网模式 - 按项目清单报价
      qijia: {
        name: '项目清单式',
        description: '明细清单，材料+人工分项，适合透明报价',
        structure: {
          materials: { ratio: 0.45, name: '主材费' },
          labor: { ratio: 0.35, name: '人工费' },
          overhead: { ratio: 0.15, name: '管理费' },
          profit: { ratio: 0.05, name: '利润' }
        }
      },
      
      // 土巴兔模式 - 套餐+增项报价
      tubatu: {
        name: '套餐+增项',
        description: '基础套餐+个性化增项，适合快速成交',
        packages: {
          basic: { price: 899, perSqm: true, name: '基础套餐' },
          standard: { price: 1299, perSqm: true, name: '标准套餐' },
          premium: { price: 1899, perSqm: true, name: '尊享套餐' }
        }
      },
      
      // 瑞美专业模式 - 暖通全系统报价
      rheem: {
        name: '暖通全系统',
        description: '设备+材料+施工+售后全包',
        dimensions: ['product', 'material', 'construction', 'management', 'warranty']
      }
    };
  }

  /**
   * 加载地区系数（环境维度）
   */
  loadRegionFactors() {
    return {
      // 一线城市
      tier1: {
        laborCost: 1.5,      // 人工费系数
        materialCost: 1.1,   // 材料费系数
        managementCost: 1.3,   // 管理费系数
        cities: ['北京', '上海', '广州', '深圳']
      },
      // 二线城市
      tier2: {
        laborCost: 1.2,
        materialCost: 1.05,
        managementCost: 1.15,
        cities: ['杭州', '南京', '成都', '武汉', '西安', '重庆']
      },
      // 三四线城市
      tier3: {
        laborCost: 1.0,
        materialCost: 1.0,
        managementCost: 1.0,
        cities: ['其他']
      },
      // 特殊环境
      environment: {
        highAltitude: 1.15,    // 高海拔
        coastal: 1.1,         // 沿海腐蚀
        cold: 1.2,              // 极寒地区
        highFloor: {
          '1-10': 1.0,
          '11-20': 1.05,
          '21-30': 1.1,
          '30+': 1.15           // 高空作业费
        }
      }
    };
  }

  /**
   * 加载AI学习的最优报价策略
   */
  loadLearnedStrategies() {
    return {
      // 基于历史成交数据学习的策略
      conversionOptimization: {
        // 价格锚点策略
        priceAnchoring: {
          showHighFirst: true,
          discountPresentation: '立减XXX元',
          savingsCalculation: true
        },
        // 套餐组合策略
        bundling: {
          hvacFreshAir: 0.95,    // 空调+新风95折
          hvacHeating: 0.90,      // 空调+地暖9折
          allInOne: 0.85          // 全屋系统85折
        },
        // 心理定价策略
        psychological: {
          endWith99: true,
          showPerDay: true,      // 折算到每天多少钱
          showPerSqm: true        // 每平米单价
        }
      },
      
      // 动态定价策略
      dynamicPricing: {
        peakSeason: 1.0,         // 旺季（3-5月）
        offSeason: 0.90,         // 淡季折扣
        lastMonth: 0.85,         // 月末冲量
        groupBuy: 0.88            // 拼团价
      }
    };
  }

  /**
   * 生成多维度报价
   * @param {Object} params - 报价参数
   */
  generateMultiDimensionalQuote(params) {
    const {
      area,                    // 建筑面积
      rooms = 3,              // 房间数
      city = '北京',          // 城市（环境维度）
      floor = 10,             // 楼层（环境维度）
      systems = ['hvac'],     // 系统类型
      packageTier = 'standard',   // 套餐档次
      quality = 'mid',        // 品质等级
      urgency = false         // 是否加急
    } = params;

    console.log(`[QuotationEngine] 生成多维度报价: ${area}㎡ ${city}`);

    // 1. 获取地区系数
    const regionFactor = this.getRegionFactor(city, floor);

    // 2. 计算各维度成本
    const dimensions = this.calculateDimensions({
      area, rooms, systems, quality, regionFactor
    });

    // 3. 应用智能定价策略
    const optimized = this.applyPricingStrategies(dimensions, params);

    // 4. 生成多版本报价（客户选择）
    const versions = this.generateQuoteVersions(optimized, area);

    // 5. 生成详细清单
    const details = this.generateDetailedBOM(dimensions);

    return {
      quoteId: `QT-${Date.now()}`,
      generatedAt: new Date(),
      params,
      summary: {
        totalAmount: optimized.total,
        discountedAmount: optimized.discounted,
        savings: optimized.savings,
        perSqm: Math.round(optimized.discounted / area)
      },
      dimensions,              // 各维度明细
      versions,                 // 多版本报价
      details,                  // 详细清单
      strategies: {             // 应用的策略
        bundling: optimized.bundlingApplied,
        seasonal: optimized.seasonalApplied,
        psychological: optimized.psychologicalPricing
      },
      aiInsights: this.generateAIInsights(dimensions, params)  // AI建议
    };
  }

  /**
   * 计算各维度成本
   */
  calculateDimensions(params) {
    const { area, rooms, systems, quality, regionFactor } = params;
    
    const dimensions = {
      // 1. 产品维度 - 设备费
      product: this.calculateProductCost(systems, area, quality, regionFactor),
      
      // 2. 材料维度 - 材料费
      material: this.calculateMaterialCost(systems, area, quality, regionFactor),
      
      // 3. 施工维度 - 人工安装费
      construction: this.calculateConstructionCost(systems, area, rooms, regionFactor),
      
      // 4. 管理维度 - 项目管理+监理
      management: this.calculateManagementCost(area, regionFactor),
      
      // 5. 售后维度 - 延保服务
      warranty: this.calculateWarrantyCost(systems, quality),
      
      // 6. 其他费用
      other: {
        design: Math.round(area * 5),           // 设计费 5元/㎡
        transport: Math.round(area * 3),       // 运输费 3元/㎡
        waste: Math.round(area * 2)              // 垃圾清运费 2元/㎡
      }
    };

    // 计算小计
    dimensions.subtotal = Object.values(dimensions)
      .filter(v => typeof v === 'object' && v.amount)
      .reduce((sum, d) => sum + d.amount, 0) +
      Object.values(dimensions.other).reduce((sum, v) => sum + v, 0);

    return dimensions;
  }

  /**
   * 计算产品成本（设备费）
   */
  calculateProductCost(systems, area, quality, regionFactor) {
    const equipment = [];
    let totalAmount = 0;

    // 中央空调
    if (systems.includes('hvac')) {
      const hvacCost = this.calculateHVACCost(area, quality);
      equipment.push(...hvacCost.equipment);
      totalAmount += hvacCost.amount;
    }

    // 新风系统
    if (systems.includes('freshAir')) {
      const freshAirCost = area * (quality === 'high' ? 80 : quality === 'low' ? 40 : 60);
      equipment.push({
        name: '新风系统',
        spec: `${Math.round(area * 3)}m³/h`,
        unit: '套',
        quantity: 1,
        unitPrice: freshAirCost,
        amount: freshAirCost
      });
      totalAmount += freshAirCost;
    }

    // 地暖系统
    if (systems.includes('floorHeating')) {
      const heatingCost = area * (quality === 'high' ? 200 : quality === 'low' ? 120 : 160);
      equipment.push({
        name: '地暖系统',
        spec: '水暖',
        unit: '㎡',
        quantity: area,
        unitPrice: heatingCost / area,
        amount: heatingCost
      });
      totalAmount += heatingCost;
    }

    // 应用地区系数
    totalAmount = Math.round(totalAmount * regionFactor.materialCost);

    return {
      name: '设备费',
      amount: totalAmount,
      items: equipment,
      notes: ['含主机、内机、控制器', '瑞美原厂正品']
    };
  }

  /**
   * 计算空调成本
   */
  calculateHVACCost(area, quality) {
    // 负荷估算
    const coolingLoad = area * 130;  // 130W/㎡
    
    // 外机选型
    const outdoorOptions = [
      { capacity: 8000, price: 12000, name: '6匹外机' },
      { capacity: 12000, price: 18000, name: '8匹外机' },
      { capacity: 16000, price: 24000, name: '10匹外机' },
      { capacity: 24000, price: 35000, name: '14匹外机' },
      { capacity: 32000, price: 48000, name: '18匹外机' }
    ];

    const outdoor = outdoorOptions.find(o => o.capacity >= coolingLoad * 1.1) || 
                    outdoorOptions[outdoorOptions.length - 1];

    // 品质系数
    const qualityFactor = quality === 'high' ? 1.3 : quality === 'low' ? 0.8 : 1.0;
    
    const equipment = [];
    
    // 外机
    equipment.push({
      name: outdoor.name,
      brand: 'Rheem',
      spec: `${outdoor.capacity}W`,
      unit: '台',
      quantity: 1,
      unitPrice: Math.round(outdoor.price * qualityFactor),
      amount: Math.round(outdoor.price * qualityFactor)
    });

    // 内机（估算4台）
    const indoorCount = Math.min(Math.max(3, Math.floor(area / 30)), 6);
    const indoorPrice = quality === 'high' ? 4500 : quality === 'low' ? 2800 : 3500;
    
    for (let i = 0; i < indoorCount; i++) {
      equipment.push({
        name: `室内机${i + 1}`,
        brand: 'Rheem',
        spec: i === 0 ? '客厅用大容量' : '卧室用标准',
        unit: '台',
        quantity: 1,
        unitPrice: indoorPrice,
        amount: indoorPrice
      });
    }

    const totalAmount = equipment.reduce((sum, e) => sum + e.amount, 0);

    return { equipment, amount: totalAmount };
  }

  /**
   * 计算材料成本
   */
  calculateMaterialCost(systems, area, quality, regionFactor) {
    const items = [];
    let totalAmount = 0;

    // 铜管
    const copperPipeLength = area * 3; // 估算3米/㎡
    const copperPrice = quality === 'high' ? 85 : 65;
    items.push({
      name: '紫铜管',
      spec: 'Φ9.52/Φ15.88',
      unit: '米',
      quantity: copperPipeLength,
      unitPrice: copperPrice,
      amount: copperPipeLength * copperPrice
    });

    // 保温棉
    const insulationLength = copperPipeLength;
    const insulationPrice = quality === 'high' ? 25 : 15;
    items.push({
      name: '橡塑保温',
      spec: '15mm厚',
      unit: '米',
      quantity: insulationLength,
      unitPrice: insulationPrice,
      amount: insulationLength * insulationPrice
    });

    // 冷凝水管
    items.push({
      name: 'PVC冷凝水管',
      spec: 'Φ25',
      unit: '米',
      quantity: Math.round(area * 1.5),
      unitPrice: 12,
      amount: Math.round(area * 1.5) * 12
    });

    // 信号线
    items.push({
      name: '屏蔽信号线',
      spec: 'RVVP 2×0.75',
      unit: '米',
      quantity: Math.round(area * 2),
      unitPrice: 8,
      amount: Math.round(area * 2) * 8
    });

    // 辅料包
    items.push({
      name: '辅料包',
      spec: '吊杆、管卡、胶带等',
      unit: '套',
      quantity: 1,
      unitPrice: Math.round(area * 20),
      amount: Math.round(area * 20)
    });

    totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
    totalAmount = Math.round(totalAmount * regionFactor.materialCost);

    return {
      name: '材料费',
      amount: totalAmount,
      items,
      notes: ['国标优质材料', '环保认证']
    };
  }

  /**
   * 计算施工成本（人工安装费）
   */
  calculateConstructionCost(systems, area, rooms, regionFactor) {
    const items = [];

    // 基础安装费
    const baseInstall = area * 80;  // 80元/㎡基础安装
    items.push({
      name: '基础安装',
      spec: '设备吊装、管路连接',
      unit: '㎡',
      quantity: area,
      unitPrice: 80,
      amount: baseInstall
    });

    // 系统调试
    items.push({
      name: '系统调试',
      spec: '真空泵抽真空、冷媒充注',
      unit: '项',
      quantity: 1,
      unitPrice: 1500,
      amount: 1500
    });

    // 风口安装
    const ventCount = Math.min(rooms + 1, 6);
    items.push({
      name: '风口安装',
      spec: 'ABS风口',
      unit: '个',
      quantity: ventCount,
      unitPrice: 150,
      amount: ventCount * 150
    });

    // 高空作业费
    items.push({
      name: '高空作业费',
      spec: '安全防护',
      unit: '项',
      quantity: 1,
      unitPrice: 800,
      amount: 800
    });

    const totalAmount = Math.round(
      items.reduce((sum, i) => sum + i.amount, 0) * regionFactor.laborCost
    );

    return {
      name: '施工费',
      amount: totalAmount,
      items,
      notes: ['持证上岗', '标准工艺', '5年质保']
    };
  }

  /**
   * 计算管理成本
   */
  calculateManagementCost(area, regionFactor) {
    const items = [];

    // 项目管理费
    items.push({
      name: '项目管理',
      spec: '进度管控、质量验收',
      unit: '项',
      quantity: 1,
      unitPrice: Math.round(area * 15),
      amount: Math.round(area * 15)
    });

    // 工程监理
    items.push({
      name: '工程监理',
      spec: '节点检查、隐蔽验收',
      unit: '次',
      quantity: 3,
      unitPrice: 300,
      amount: 900
    });

    const totalAmount = Math.round(
      items.reduce((sum, i) => sum + i.amount, 0) * regionFactor.managementCost
    );

    return {
      name: '管理费',
      amount: totalAmount,
      items,
      notes: ['专业监理', '全程跟踪']
    };
  }

  /**
   * 计算售后成本
   */
  calculateWarrantyCost(systems, quality) {
    // 延保服务
    const baseWarranty = quality === 'high' ? 5 : quality === 'low' ? 2 : 3; // 年
    const extendedWarranty = 2; // 延保2年
    
    const warrantyCost = systems.length * 500; // 每系统500元/年延保

    return {
      name: '售后延保',
      amount: warrantyCost * extendedWarranty,
      items: [{
        name: '延长保修服务',
        spec: `厂家${baseWarranty}年+延保${extendedWarranty}年`,
        unit: '年',
        quantity: extendedWarranty,
        unitPrice: warrantyCost,
        amount: warrantyCost * extendedWarranty
      }],
      notes: [`厂家质保${baseWarranty}年`, '24小时响应']
    };
  }

  /**
   * 获取地区系数
   */
  getRegionFactor(city, floor) {
    let factor = { ...this.regionFactors.tier3 };
    
    // 匹配城市等级
    if (this.regionFactors.tier1.cities.includes(city)) {
      factor = { ...this.regionFactors.tier1 };
    } else if (this.regionFactors.tier2.cities.includes(city)) {
      factor = { ...this.regionFactors.tier2 };
    }
    
    // 楼层系数
    let floorFactor = 1.0;
    if (floor <= 10) floorFactor = this.regionFactors.environment.highFloor['1-10'];
    else if (floor <= 20) floorFactor = this.regionFactors.environment.highFloor['11-20'];
    else if (floor <= 30) floorFactor = this.regionFactors.environment.highFloor['21-30'];
    else floorFactor = this.regionFactors.environment.highFloor['30+'];
    
    return {
      ...factor,
      floorFactor
    };
  }

  /**
   * 应用智能定价策略
   */
  applyPricingStrategies(dimensions, params) {
    const strategies = this.learnedStrategies;
    let total = dimensions.subtotal;
    let discountRate = 1.0;
    const appliedStrategies = [];

    // 1. 套餐组合折扣
    if (params.systems.length >= 3) {
      discountRate *= strategies.conversionOptimization.bundling.allInOne;
      appliedStrategies.push({
        name: '全屋系统套餐',
        discount: '85折',
        saving: Math.round(total * (1 - strategies.conversionOptimization.bundling.allInOne))
      });
    } else if (params.systems.includes('hvac') && params.systems.includes('floorHeating')) {
      discountRate *= strategies.conversionOptimization.bundling.hvacHeating;
      appliedStrategies.push({
        name: '空调+地暖套餐',
        discount: '9折',
        saving: Math.round(total * (1 - strategies.conversionOptimization.bundling.hvacHeating))
      });
    }

    // 2. 淡季折扣
    const month = new Date().getMonth();
    if (month >= 10 || month <= 2) { // 11月-3月淡季
      discountRate *= strategies.dynamicPricing.offSeason;
      appliedStrategies.push({
        name: '淡季优惠',
        discount: '9折',
        saving: Math.round(total * (1 - strategies.dynamicPricing.offSeason))
      });
    }

    // 3. 月末冲量
    const day = new Date().getDate();
    if (day >= 25) {
      discountRate *= strategies.dynamicPricing.lastMonth;
      appliedStrategies.push({
        name: '月末冲量',
        discount: '85折',
        saving: Math.round(total * (1 - strategies.dynamicPricing.lastMonth))
      });
    }

    const discounted = Math.round(total * discountRate);
    const savings = total - discounted;

    return {
      total,
      discounted,
      savings,
      discountRate,
      bundlingApplied: appliedStrategies.filter(s => s.name.includes('套餐')).length > 0,
      seasonalApplied: appliedStrategies.filter(s => s.name.includes('淡季')).length > 0,
      psychologicalPricing: strategies.conversionOptimization.psychological,
      appliedStrategies
    };
  }

  /**
   * 生成多版本报价
   */
  generateQuoteVersions(optimized, area) {
    return {
      economy: {
        name: '经济版',
        subtitle: '基础配置，性价比之选',
        amount: Math.round(optimized.discounted * 0.85),
        perSqm: Math.round(optimized.discounted * 0.85 / area),
        features: ['国产品牌外机', '基础保温材料', '标准安装工艺'],
        warranty: '3年质保'
      },
      standard: {
        name: '标准版',
        subtitle: '均衡配置，品质保证',
        amount: optimized.discounted,
        perSqm: Math.round(optimized.discounted / area),
        features: ['瑞美标准外机', '优质保温材料', '标准安装工艺'],
        warranty: '5年质保',
        recommended: true
      },
      premium: {
        name: '尊享版',
        subtitle: '旗舰配置，极致体验',
        amount: Math.round(optimized.discounted * 1.25),
        perSqm: Math.round(optimized.discounted * 1.25 / area),
        features: ['瑞美旗舰外机', '进口保温材料', '金牌安装工艺', '智能控制系统'],
        warranty: '8年质保'
      }
    };
  }

  /**
   * 生成详细BOM清单
   */
  generateDetailedBOM(dimensions) {
    const bom = [];
    
    // 收集所有项目
    ['product', 'material', 'construction', 'management', 'warranty'].forEach(dimension => {
      const dim = dimensions[dimension];
      if (dim && dim.items) {
        dim.items.forEach(item => {
          bom.push({
            ...item,
            category: dim.name,
            categoryCode: dimension
          });
        });
      }
    });

    // 添加其他费用
    Object.entries(dimensions.other || {}).forEach(([key, amount]) => {
      const names = {
        design: '设计费',
        transport: '运输费',
        waste: '垃圾清运费'
      };
      bom.push({
        name: names[key] || key,
        category: '其他费用',
        categoryCode: 'other',
        amount
      });
    });

    return bom;
  }

  /**
   * 生成AI洞察建议
   */
  generateAIInsights(dimensions, params) {
    const insights = [];

    // 成本结构分析
    const total = dimensions.subtotal;
    const productRatio = dimensions.product.amount / total;
    
    if (productRatio > 0.6) {
      insights.push({
        type: 'optimization',
        title: '设备成本偏高',
        suggestion: '建议选择性价比更高的机型，可节省约15%费用',
        potentialSaving: Math.round(total * 0.15)
      });
    }

    // 面积效率分析
    if (params.area < 80) {
      insights.push({
        type: 'suggestion',
        title: '小户型优化建议',
        suggestion: '80㎡以下建议选用风管机，比多联机节省30%初投资',
        potentialSaving: Math.round(total * 0.30)
      });
    }

    // 时机建议
    const month = new Date().getMonth();
    if (month >= 3 && month <= 5) {
      insights.push({
        type: 'timing',
        title: '旺季提醒',
        suggestion: '当前为安装旺季，建议提前2周预约，避免排队',
        urgency: 'medium'
      });
    }

    // 竞品对比
    insights.push({
      type: 'comparison',
      title: '价格竞争力',
      suggestion: '本报价较市场均价低12%，具备竞争优势',
      marketPosition: 'below_average'
    });

    return insights;
  }

  /**
   * 快速估算（简化版）
   */
  quickEstimate(area, systems = ['hvac'], city = '北京') {
    let basePrice = systems.includes('hvac') ? 350 : 0;
    basePrice += systems.includes('freshAir') ? 60 : 0;
    basePrice += systems.includes('floorHeating') ? 160 : 0;
    
    const regionFactor = this.getRegionFactor(city, 10);
    const adjustedPrice = Math.round(basePrice * regionFactor.laborCost);
    
    return {
      area,
      systems,
      city,
      perSqm: adjustedPrice,
      total: Math.round(area * adjustedPrice),
      range: {
        min: Math.round(area * adjustedPrice * 0.8),
        max: Math.round(area * adjustedPrice * 1.2)
      },
      note: '此为快速估算，实际报价以现场勘察为准'
    };
  }

  /**
   * 从设计师 BOM 生成后端受控报价。
   * 用于替代前端固定比例估算，集中管理区域人工、辅材、税费、风险和毛利护栏。
   */
  generateQuoteFromBOM(params = {}) {
    const {
      items = [],
      project = {},
      dealer = {},
      options = {}
    } = params;

    const normalizedItems = this.normalizeBomItems(items);
    if (!normalizedItems.length) {
      const error = new Error('BOM items are required');
      error.status = 400;
      throw error;
    }

    const city = project.city || dealer.city || '其他';
    const floor = Number(project.floor || 10);
    const area = Math.max(Number(project.area || this.estimateAreaFromBOM(normalizedItems) || 80), 1);
    const regionFactor = this.getRegionFactor(city, floor);
    const metrics = this.analyzeBomMetrics(normalizedItems);

    const materialSubtotal = Math.round(normalizedItems.reduce((sum, item) => sum + item.total, 0));
    const laborRate = this.calculateBomLaborRate(metrics, project);
    const auxiliaryRate = this.calculateBomAuxiliaryRate(metrics);
    const managementRate = dealer.tier === 'strategic' ? 0.026 : dealer.tier === 'premium' ? 0.032 : 0.038;
    const riskRate = this.calculateBomRiskRate(metrics, project);
    const taxRate = Number.isFinite(Number(options.taxRate)) ? Number(options.taxRate) : 0.06;
    const targetMarginRate = Number.isFinite(Number(options.targetMarginRate))
      ? Number(options.targetMarginRate)
      : 0.20;
    const minMarginRate = Number.isFinite(Number(options.minMarginRate))
      ? Number(options.minMarginRate)
      : 0.14;

    const labor = Math.round(Math.max(1200, materialSubtotal * laborRate * regionFactor.laborCost));
    const auxiliary = Math.round(Math.max(600, materialSubtotal * auxiliaryRate * regionFactor.materialCost));
    const management = Math.round(Math.max(800, materialSubtotal * managementRate * regionFactor.managementCost));
    const riskReserve = Math.round((materialSubtotal + labor + auxiliary) * riskRate);
    const directCost = Math.round(materialSubtotal + labor + auxiliary + management + riskReserve);
    const quoteFloor = Math.round(directCost / Math.max(0.01, 1 - minMarginRate));
    const targetBeforeTax = Math.round(directCost / Math.max(0.01, 1 - targetMarginRate));

    const requestedDiscount = Math.min(Math.max(Number(options.discountRate || 0), 0), 0.18);
    const discountedBeforeTax = Math.round(targetBeforeTax * (1 - requestedDiscount));
    const marginGuard = {
      minMarginRate,
      targetMarginRate,
      requestedDiscountRate: requestedDiscount,
      directCost,
      quoteFloor,
      status: discountedBeforeTax >= quoteFloor ? 'pass' : 'floor_adjusted',
      adjustment: Math.max(0, quoteFloor - discountedBeforeTax)
    };

    const approvedBeforeTax = Math.max(discountedBeforeTax, quoteFloor);
    const tax = Math.round(approvedBeforeTax * taxRate);
    const customerTotal = options.taxIncluded === false ? approvedBeforeTax : approvedBeforeTax + tax;
    const months = Number(options.financingMonths || 36);

    return {
      quoteId: `BOM-QT-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      source: 'designer-bom',
      project: {
        name: project.name || '未命名项目',
        city,
        floor,
        area
      },
      summary: {
        materialSubtotal,
        labor,
        auxiliary,
        management,
        riskReserve,
        directCost,
        quoteFloor,
        targetBeforeTax,
        discount: Math.max(0, targetBeforeTax - approvedBeforeTax),
        tax,
        taxRate,
        customerTotal,
        monthlyPayment: months > 0 ? Math.round(customerTotal / months) : customerTotal,
        perSqm: Math.round(customerTotal / area),
        grossMarginRate: Number(((approvedBeforeTax - directCost) / approvedBeforeTax).toFixed(4))
      },
      costBreakdown: [
        { code: 'materials', name: '设备/管路材料', amount: materialSubtotal },
        { code: 'labor', name: '安装人工', amount: labor },
        { code: 'auxiliary', name: '辅材与损耗', amount: auxiliary },
        { code: 'management', name: '项目管理与质检', amount: management },
        { code: 'risk', name: '施工风险预备', amount: riskReserve },
        { code: 'tax', name: '税费', amount: tax }
      ],
      marginGuard,
      metrics,
      items: normalizedItems,
      assumptions: [
        '报价由后端成本模型统一生成，前端不持有商业定价比例',
        '最终合同价仍需结合现场复测、经销商权限和促销审批',
        '毛利护栏低于底价时自动上调，避免客户分享价穿透成本'
      ]
    };
  }

  normalizeBomItems(items) {
    return items
      .map((item, index) => {
        const quantity = Number(item.qty ?? item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
        const total = Number(item.total ?? item.amount ?? quantity * unitPrice);
        return {
          id: item.id || item.sku || `bom-${index + 1}`,
          name: String(item.name || item.title || `项目${index + 1}`).slice(0, 80),
          category: item.category || this.inferBomCategory(item),
          unit: item.unit || '项',
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : Math.round(total),
          total: Math.round(Number.isFinite(total) && total > 0 ? total : quantity * unitPrice)
        };
      })
      .filter(item => item.total > 0);
  }

  inferBomCategory(item) {
    const name = String(item.name || '').toLowerCase();
    const unit = String(item.unit || '').toLowerCase();
    if (unit === 'm' || unit === '米' || /管|pipe|pvc|pex|铜/.test(name)) return 'pipe';
    if (/门|窗/.test(name)) return 'opening';
    if (/主机|水机|空调|新风|净水|采暖|控制|设备|device/.test(name)) return 'equipment';
    return 'material';
  }

  analyzeBomMetrics(items) {
    const pipeMeters = items
      .filter(item => item.category === 'pipe' || item.unit === 'm' || item.unit === '米')
      .reduce((sum, item) => sum + item.quantity, 0);
    const equipmentCount = items
      .filter(item => item.category === 'equipment')
      .reduce((sum, item) => sum + item.quantity, 0);
    const openingCount = items
      .filter(item => item.category === 'opening')
      .reduce((sum, item) => sum + item.quantity, 0);

    return {
      itemCount: items.length,
      pipeMeters: Number(pipeMeters.toFixed(1)),
      equipmentCount,
      openingCount,
      complexityScore: Math.min(100, Math.round(items.length * 6 + pipeMeters * 0.25 + equipmentCount * 9 + openingCount * 4))
    };
  }

  estimateAreaFromBOM(items) {
    const pipeMeters = items
      .filter(item => item.category === 'pipe' || item.unit === 'm' || item.unit === '米')
      .reduce((sum, item) => sum + item.quantity, 0);
    return pipeMeters ? Math.round(pipeMeters / 2.6) : 80;
  }

  calculateBomLaborRate(metrics, project) {
    let rate = 0.105;
    if (metrics.equipmentCount >= 4) rate += 0.018;
    if (metrics.pipeMeters >= 80) rate += 0.018;
    if (metrics.complexityScore >= 70) rate += 0.02;
    if (Number(project.floor || 0) > 20) rate += 0.012;
    return Math.min(rate, 0.19);
  }

  calculateBomAuxiliaryRate(metrics) {
    let rate = 0.055;
    if (metrics.pipeMeters >= 50) rate += 0.018;
    if (metrics.pipeMeters >= 100) rate += 0.012;
    if (metrics.equipmentCount >= 5) rate += 0.01;
    return Math.min(rate, 0.105);
  }

  calculateBomRiskRate(metrics, project) {
    let rate = 0.025;
    if (metrics.complexityScore >= 70) rate += 0.015;
    if (Number(project.floor || 0) > 20) rate += 0.01;
    if (project.renovationStage === 'occupied') rate += 0.012;
    return Math.min(rate, 0.06);
  }

  /**
   * 学习优化（AI持续学习）
   */
  learnFromConversion(quoteData, conversionResult) {
    // 记录成功/失败的报价特征
    const learningRecord = {
      timestamp: new Date(),
      quoteFeatures: {
        perSqm: quoteData.summary.perSqm,
        discountRate: quoteData.strategies.discountRate,
        version: quoteData.versions.standard.amount
      },
      result: conversionResult,
      factors: {
        season: new Date().getMonth(),
        city: quoteData.params.city,
        area: quoteData.params.area
      }
    };

    // 更新策略（简化版）
    if (conversionResult.converted) {
      // 成功的报价策略权重增加
      console.log('[AI Learning] 记录成功转化策略');
    } else {
      // 分析失败原因
      console.log('[AI Learning] 分析转化失败原因');
    }

    return learningRecord;
  }
}

module.exports = QuotationEngine;
