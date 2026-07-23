/**
 * QuotationEngine - Unified v3.0
 * 
 * 合并版本: V1基础材料清单 + V2多维度架构 + V3价值型报价
 * 
 * 核心功能:
 * 1. 基础材料清单报价 (V1)
 * 2. 多维度智能报价: 产品+材料+施工+管理+面积+环境 (V2)
 * 3. 价值型报价: 每项对应痛点解决方案 (V3)
 * 4. 对标行业最优: 酷家乐/齐家网/土巴兔
 * 
 * @version 3.0.0-unified
 */

const LoadCalculationEngine = require('./LoadCalculationEngine');

class QuotationEngine {
  constructor(config = {}) {
    this.version = '3.0.0-unified';
    this.loadCalc = new LoadCalculationEngine();
    
    // ═══════════════════════════════════════════════════════════════
    // V1: 材料数据库 (基础)
    // ═══════════════════════════════════════════════════════════════
    this.materials = {
      airConditioning: {
        copperPipe: { name: '铜管', unit: '米', price: 65, spec: 'Φ6.35-Φ19.05' },
        insulation: { name: '橡塑保温', unit: '米', price: 18, spec: 'B1级阻燃' },
        condensatePipe: { name: '冷凝水管', unit: '米', price: 12, spec: 'PVC-U Φ25' },
        cable: { name: '电源线', unit: '米', price: 8, spec: 'BV3*2.5' },
        signalCable: { name: '信号线', unit: '米', price: 5, spec: 'RVVP2*1.0' },
        bracket: { name: '支架吊架', unit: '套', price: 120, spec: '热镀锌' },
        duct: { name: '风管', unit: '平米', price: 85, spec: '镀锌钢板' },
        airOutlet: { name: '风口', unit: '个', price: 150, spec: 'ABS双层百叶' },
        filter: { name: '过滤网', unit: '个', price: 80, spec: '初效+中效' },
        refrigerant: { name: '制冷剂', unit: 'kg', price: 120, spec: 'R410A' },
        welding: { name: '焊接材料', unit: '套', price: 200, spec: '银焊条+助焊剂' }
      },
      freshAir: {
        freshAirPipe: { name: '新风管道', unit: '米', price: 45, spec: 'PE波纹管Φ75' },
        exhaustPipe: { name: '排风管道', unit: '米', price: 35, spec: 'PVC管Φ100' },
        ductConnector: { name: '风管接头', unit: '个', price: 25, spec: 'ABS' },
        wallSleeve: { name: '穿墙套管', unit: '个', price: 80, spec: '不锈钢' },
        flexibleDuct: { name: '软连接管', unit: '米', price: 55, spec: '铝箔软管' },
        airDiffuser: { name: '散流器', unit: '个', price: 120, spec: '铝合金' },
        silencer: { name: '消声器', unit: '个', price: 280, spec: '阻抗复合式' }
      },
      waterPurification: {
        waterPipe: { name: '给水管', unit: '米', price: 25, spec: 'PPR S3.2' },
        drainPipe: { name: '排水管', unit: '米', price: 15, spec: 'PVC-U Φ50' },
        valve: { name: '阀门', unit: '个', price: 45, spec: '铜球阀' },
        faucet: { name: '水龙头', unit: '个', price: 180, spec: '304不锈钢' },
        drainValve: { name: '排污阀', unit: '个', price: 35, spec: '塑料' },
        pressureTank: { name: '压力桶', unit: '个', price: 350, spec: '3.2G' }
      },
      heating: {
        manifold: { name: '分水器', unit: '路', price: 280, spec: '黄铜镀镍' },
        floorPipe: { name: '地暖管', unit: '米', price: 12, spec: 'PE-RT Φ16' },
        insulationBoard: { name: '保温板', unit: '平米', price: 35, spec: 'XPS挤塑板' },
        reflectiveFilm: { name: '反射膜', unit: '平米', price: 8, spec: '铝箔镜面' },
        boundaryStrip: { name: '边界保温条', unit: '米', price: 5, spec: 'EVA' },
        radiator: { name: '暖气片', unit: '组', price: 650, spec: '钢制板式' },
        radiatorValve: { name: '暖气阀', unit: '个', price: 85, spec: '铜制' },
        radiatorHanger: { name: '暖气片挂钩', unit: '套', price: 45, spec: '钢制' }
      },
      hotWater: {
        hotWaterPipe: { name: '热水管', unit: '米', price: 35, spec: 'PPR S2.5' },
        insulation: { name: '橡塑保温', unit: '米', price: 22, spec: '15mm厚' },
        mixingValve: { name: '混水阀', unit: '个', price: 280, spec: '恒温阀芯' },
        recirculationPipe: { name: '回水管', unit: '米', price: 35, spec: 'PPR S3.2' }
      },
      smartHome: {
        controlPanel: { name: '控制面板', unit: '个', price: 1200, spec: '7寸触摸屏' },
        tempSensor: { name: '温湿度传感器', unit: '个', price: 180, spec: '无线ZigBee' },
        actuator: { name: '执行器', unit: '个', price: 350, spec: '电动二通阀' },
        gateway: { name: '智能网关', unit: '个', price: 680, spec: '多协议' },
        wire: { name: '控制线', unit: '米', price: 6, spec: 'RVSP 2×0.75' }
      }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // V2: 多维度定价模型 (行业对标)
    // ═══════════════════════════════════════════════════════════════
    this.pricingModels = {
      // 酷家乐模式 - 按空间模块化报价
      kujiale: {
        name: '空间模块化',
        description: '按房间空间独立报价，适合整装',
        spaces: {
          living: { basePrice: 350, name: '客厅', systems: ['airConditioning', 'freshAir', 'smartHome'] },
          bedroom: { basePrice: 280, name: '卧室', systems: ['airConditioning', 'freshAir'] },
          kitchen: { basePrice: 450, name: '厨房', systems: ['waterPurification', 'hotWater'] },
          bathroom: { basePrice: 500, name: '卫生间', systems: ['hotWater', 'waterPurification'] },
          study: { basePrice: 300, name: '书房', systems: ['airConditioning', 'freshAir'] },
          dining: { basePrice: 320, name: '餐厅', systems: ['airConditioning'] }
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
      
      // 土巴兔模式 - 按平米+点位综合报价
      tubatu: {
        name: '综合点位式',
        description: '按平米+点位综合，适合整装',
        basePrice: 280,
        pointPrice: 350
      }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // V2: 地区系数
    // ═══════════════════════════════════════════════════════════════
    this.regionFactors = {
      '北京': { labor: 1.15, material: 1.05, management: 1.10 },
      '上海': { labor: 1.20, material: 1.10, management: 1.15 },
      '广州': { labor: 1.05, material: 1.00, management: 1.05 },
      '深圳': { labor: 1.15, material: 1.05, management: 1.10 },
      '杭州': { labor: 1.10, material: 1.00, management: 1.08 },
      '成都': { labor: 0.95, material: 0.95, management: 0.95 },
      '武汉': { labor: 0.90, material: 0.90, management: 0.92 },
      '西安': { labor: 0.85, material: 0.90, management: 0.88 },
      '重庆': { labor: 0.90, material: 0.92, management: 0.90 }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // V3: 价值型报价配置
    // ═══════════════════════════════════════════════════════════════
    this.valueConfig = {
      marginSettings: {
        minMargin: 0.15,
        targetMargin: 0.25,
        maxDiscount: 0.10
      },
      
      promotionRules: [
        { type: 'discount', name: '全屋总包优惠', threshold: 50000, discount: 5000, description: '满5万减5000' },
        { type: 'percentage', name: '老客户推荐', discount: 0.95, description: '额外95折' },
        { type: 'package', name: '六系统套餐', systems: 6, discount: 10000, description: '全套优惠1万' },
        { type: 'seasonal', name: '淡季促销', months: [1, 2, 7, 8], discount: 0.92, description: '淡季92折' }
      ],
      
      painValueMapping: {
        '制冷效果差': { solution: '变频多联机', value: '精准控温±0.5°C', price: 8000 },
        '噪音大': { solution: '静音型内机', value: '低至22dB静音', price: 1200 },
        '能耗高': { solution: '一级能效系统', value: '节能30%', price: 3500 },
        '空气干燥': { solution: '加湿新风系统', value: '恒湿40-60%', price: 4500 },
        '水质差': { solution: '全屋净水系统', value: '直饮级过滤', price: 6800 },
        '热水慢': { solution: '零冷水系统', value: '即开即热', price: 2800 }
      }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // 产品设备价格库
    // ═══════════════════════════════════════════════════════════════
    this.productPricing = {
      airConditioning: {
        '室内机-1匹': { price: 3200, cooling: 2500, heating: 3000 },
        '室内机-1.5匹': { price: 3800, cooling: 3500, heating: 4200 },
        '室内机-2匹': { price: 5200, cooling: 5000, heating: 5800 },
        '室内机-3匹': { price: 7800, cooling: 7200, heating: 8200 },
        '室外机-8匹': { price: 28000, connections: 8 },
        '室外机-10匹': { price: 35000, connections: 10 },
        '室外机-12匹': { price: 42000, connections: 12 }
      },
      freshAir: {
        '单向流150': { price: 2800, airflow: 150 },
        '单向流250': { price: 3800, airflow: 250 },
        '双向流350': { price: 6800, airflow: 350, heatRecovery: true },
        '双向流500': { price: 8800, airflow: 500, heatRecovery: true }
      },
      heating: {
        '地暖-水暖': { price: 180, unit: '元/㎡' },
        '暖气片-钢制片': { price: 650, unit: '元/组' },
        '暖气片-铜铝复合': { price: 950, unit: '元/组' }
      },
      waterPurification: {
        '前置过滤器': { price: 1200, flow: 3000 },
        '中央净水机': { price: 6800, capacity: 2000 },
        '中央软水机': { price: 8800, capacity: 2000 },
        '末端直饮机': { price: 4500, ro: true }
      },
      hotWater: {
        '燃气热水器-13L': { price: 4800, capacity: 13 },
        '燃气热水器-16L': { price: 6200, capacity: 16 },
        '燃气热水器-20L': { price: 8800, capacity: 20 },
        '空气能热水器-200L': { price: 12800, capacity: 200 },
        '空气能热水器-300L': { price: 16800, capacity: 300 }
      },
      smartHome: {
        '基础套餐': { price: 5800, controls: ['空调', '新风', '热水'] },
        '标准套餐': { price: 12800, controls: ['空调', '新风', '热水', '地暖', '净水'] },
        '豪华套餐': { price: 25800, controls: ['全系统', '语音', 'APP', 'AI学习'] }
      }
    };
    
    // 施工费用标准
    this.laborRates = {
      install: {
        '室内机安装': 450,
        '室外机安装': 850,
        '管道连接(每路)': 350,
        '风口安装(每个)': 120,
        '地暖铺设(每㎡)': 45,
        '暖气片安装(每组)': 380,
        '净水设备安装': 680,
        '热水器安装': 450,
        '智能设备安装': 280
      },
      test: {
        '系统调试': 800,
        '水质检测': 280,
        '效果验收': 450
      }
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════
   * V1 API: 基础材料清单报价
   * ═══════════════════════════════════════════════════════════════
   */
  
  // 生成材料清单
  generateMaterialList(solution) {
    const materials = [];
    
    if (solution.systems) {
      solution.systems.forEach(system => {
        const systemMaterials = this.getSystemMaterials(system.type, system.specs);
        materials.push(...systemMaterials);
      });
    }
    
    return {
      items: materials,
      totalCost: materials.reduce((sum, item) => sum + item.totalPrice, 0),
      itemCount: materials.length
    };
  }
  
  getSystemMaterials(systemType, specs = {}) {
    const materials = [];
    const db = this.materials[systemType];
    
    if (!db) return materials;
    
    Object.entries(db).forEach(([key, item]) => {
      const quantity = this.calculateMaterialQuantity(systemType, key, specs);
      materials.push({
        name: item.name,
        spec: item.spec,
        unit: item.unit,
        quantity,
        unitPrice: item.price,
        totalPrice: item.price * quantity
      });
    });
    
    return materials;
  }
  
  calculateMaterialQuantity(systemType, materialKey, specs) {
    const defaults = {
      airConditioning: { copperPipe: 12, insulation: 12, cable: 15 },
      freshAir: { freshAirPipe: 20, exhaustPipe: 15 },
      heating: { floorPipe: 6, insulationBoard: 1.2 },
      waterPurification: { waterPipe: 15, drainPipe: 8 },
      hotWater: { hotWaterPipe: 20, insulation: 20 }
    };
    
    return defaults[systemType]?.[materialKey] || 10;
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════
   * V2 API: 多维度智能报价
   * ═══════════════════════════════════════════════════════════════
   */
  
  // 酷家乐模式: 按空间模块化报价
  generateKujialeQuote(roomProfiles, city, options = {}) {
    const factor = this.getRegionFactor(city);
    const spaceQuotes = [];
    
    roomProfiles.forEach(room => {
      const model = this.pricingModels.kujiale.spaces[room.type];
      if (!model) return;
      
      const basePrice = model.basePrice * room.area * factor.labor;
      const difficultyFactor = this.calculateDifficultyFactor(room);
      const finalPrice = basePrice * difficultyFactor;
      
      spaceQuotes.push({
        roomType: room.type,
        roomName: model.name,
        area: room.area,
        basePrice: Math.round(basePrice),
        difficultyFactor,
        finalPrice: Math.round(finalPrice),
        systems: model.systems
      });
    });
    
    const total = spaceQuotes.reduce((sum, q) => sum + q.finalPrice, 0);
    
    return {
      model: 'kujiale',
      total,
      spaces: spaceQuotes,
      breakdown: {
        base: Math.round(total * 0.6),
        upgrade: Math.round(total * 0.2),
        service: Math.round(total * 0.2)
      }
    };
  }
  
  // 齐家网模式: 按项目清单报价
  generateQijiaQuote(solution, roomProfiles, city, options = {}) {
    const factor = this.getRegionFactor(city);
    const structure = this.pricingModels.qijia.structure;
    
    // 1. 材料费
    const materialList = this.generateMaterialList(solution);
    const materialsCost = materialList.totalCost * factor.material;
    
    // 2. 人工费
    const laborCost = this.calculateLaborCost(solution, roomProfiles) * factor.labor;
    
    // 3. 管理费 & 利润
    const subtotal = materialsCost + laborCost;
    const overhead = subtotal * structure.overhead.ratio;
    const profit = subtotal * structure.profit.ratio;
    
    const total = subtotal + overhead + profit;
    
    return {
      model: 'qijia',
      total: Math.round(total),
      structure: {
        materials: { amount: Math.round(materialsCost), ratio: structure.materials.ratio },
        labor: { amount: Math.round(laborCost), ratio: structure.labor.ratio },
        overhead: { amount: Math.round(overhead), ratio: structure.overhead.ratio },
        profit: { amount: Math.round(profit), ratio: structure.profit.ratio }
      },
      materialList: materialList.items,
      laborItems: this.getLaborItems(solution)
    };
  }
  
  // 土巴兔模式: 按平米+点位
  generateTubatuQuote(totalArea, systemPoints, city, options = {}) {
    const factor = this.getRegionFactor(city);
    const model = this.pricingModels.tubatu;
    
    const areaCost = totalArea * model.basePrice * factor.labor;
    const pointsCost = systemPoints * model.pointPrice * factor.labor;
    
    const subtotal = areaCost + pointsCost;
    const overhead = subtotal * 0.15;
    const profit = subtotal * 0.08;
    
    return {
      model: 'tubatu',
      total: Math.round(subtotal + overhead + profit),
      breakdown: {
        areaCost: Math.round(areaCost),
        pointsCost: Math.round(pointsCost),
        overhead: Math.round(overhead),
        profit: Math.round(profit)
      },
      summary: `${totalArea}㎡ × ¥${model.basePrice} + ${systemPoints}点位 × ¥${model.pointPrice}`
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════
   * V3 API: 价值型报价 (每项对应痛点)
   * ═══════════════════════════════════════════════════════════════
   */
  
  generateValueQuote(solution, painDiagnosis, roomProfile, city, options = {}) {
    const baseSystems = solution.systems || [];
    
    // 1. 系统报价项 (每项对应痛点)
    const systemItems = baseSystems.map(system => ({
      category: system.category || system.name,
      name: system.name,
      products: system.products || [],
      basePrice: this.calculateSystemPrice(system, roomProfile),
      solvedPains: this.mapSystemToPains(system, painDiagnosis),
      valueExplanation: this.generateValueExplanation(system, painDiagnosis),
      costBreakdown: this.generateCostBreakdown(system),
      unitPriceAnalysis: this.analyzeUnitPrice({
        totalPrice: this.calculateSystemPrice(system, roomProfile),
        area: roomProfile.area
      })
    }));
    
    // 2. 材料费用 (关联痛点)
    const materialItems = this.calculateMaterialItems(solution, roomProfile, painDiagnosis).map(item => ({
      ...item,
      unitPriceAnalysis: this.analyzeUnitPrice(item)
    }));
    
    // 3. 人工费用
    const laborItems = this.calculateLaborItems(roomProfile, solution).map(item => ({
      ...item,
      unitPriceAnalysis: this.analyzeUnitPrice(item)
    }));
    
    // 4. 汇总
    const subtotal = {
      systems: systemItems.reduce((sum, item) => sum + item.basePrice, 0),
      materials: materialItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
      labor: laborItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    };
    
    const baseTotal = subtotal.systems + subtotal.materials + subtotal.labor;
    
    // 5. 促销规则应用
    const promotion = this.applyPromotionRules(baseTotal, systemItems.length);
    
    // 6. 利润控制
    const margin = this.calculateMargin(baseTotal, promotion.discount);
    
    const finalTotal = baseTotal - promotion.discount + margin.profitAmount;
    
    return {
      model: 'value',
      total: Math.round(finalTotal),
      breakdown: subtotal,
      items: {
        systems: systemItems,
        materials: materialItems,
        labor: laborItems
      },
      valueSummary: {
        totalPainsSolved: systemItems.reduce((sum, item) => sum + item.solvedPains.length, 0),
        keyValues: this.extractKeyValues(systemItems),
        painSolutions: this.getPainSolutionsSummary(painDiagnosis)
      },
      promotion,
      margin,
      competitiveness: this.analyzeCompetitiveness(finalTotal, city)
    };
  }
  
  mapSystemToPains(system, painDiagnosis) {
    const pains = painDiagnosis?.primary || [];
    return pains.filter(pain => 
      this.valueConfig.painValueMapping[pain]?.solution.includes(system.name)
    );
  }
  
  generateValueExplanation(system, painDiagnosis) {
    const solvedPains = this.mapSystemToPains(system, painDiagnosis);
    
    return solvedPains.map(pain => {
      const mapping = this.valueConfig.painValueMapping[pain];
      return {
        pain,
        solution: mapping?.solution || system.name,
        value: mapping?.value || '改善舒适度',
        worth: mapping?.price || system.basePrice
      };
    });
  }
  
  generateCostBreakdown(system) {
    const product = this.productPricing[system.category]?.[system.name];
    if (!product) return null;
    
    return {
      equipment: product.price,
      materials: product.price * 0.25,
      labor: product.price * 0.20,
      management: product.price * 0.08,
      profit: product.price * 0.12
    };
  }
  
  applyPromotionRules(total, systemCount) {
    const applicable = this.valueConfig.promotionRules.filter(rule => {
      if (rule.threshold && total >= rule.threshold) return true;
      if (rule.systems && systemCount >= rule.systems) return true;
      if (rule.months && rule.months.includes(new Date().getMonth() + 1)) return true;
      return false;
    });
    
    let maxDiscount = 0;
    let bestRule = null;
    
    applicable.forEach(rule => {
      let discount = 0;
      if (rule.type === 'discount') discount = rule.discount;
      else if (rule.type === 'percentage') discount = total * (1 - rule.discount);
      
      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestRule = rule;
      }
    });
    
    return {
      applicable: applicable.length,
      applied: bestRule,
      discount: Math.round(maxDiscount),
      final: total - maxDiscount
    };
  }
  
  calculateMargin(baseTotal, discount) {
    const afterDiscount = baseTotal - discount;
    const targetProfit = afterDiscount * this.valueConfig.marginSettings.targetMargin;
    const minProfit = afterDiscount * this.valueConfig.marginSettings.minMargin;
    
    return {
      targetMargin: this.valueConfig.marginSettings.targetMargin,
      profitAmount: Math.round(targetProfit),
      minAcceptable: Math.round(minProfit),
      priceWithTargetMargin: Math.round(afterDiscount + targetProfit)
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════
   * 辅助方法
   * ═══════════════════════════════════════════════════════════════
   */
  
  getRegionFactor(city) {
    return this.regionFactors[city] || { labor: 1.0, material: 1.0, management: 1.0 };
  }
  
  calculateDifficultyFactor(room) {
    let factor = 1.0;
    if (room.floor > 10) factor += 0.05;
    if (room.specialStructure) factor += 0.10;
    if (room.complexity === 'high') factor += 0.15;
    return factor;
  }
  
  calculateSystemPrice(system, roomProfile) {
    const product = this.productPricing[system.category]?.[system.name];
    if (!product) return 0;
    
    // 根据房间面积计算数量
    let quantity = 1;
    if (product.unit === '元/㎡') {
      quantity = roomProfile.area || 100;
    } else if (system.category === 'airConditioning') {
      quantity = Math.ceil((roomProfile.area || 100) / 15); // 每15㎡一台内机
    }
    
    return product.price * quantity;
  }
  
  calculateLaborCost(solution, roomProfiles) {
    let cost = 0;
    
    if (solution.systems) {
      solution.systems.forEach(system => {
        const installCost = system.products?.reduce((sum, p) => {
          const rate = this.laborRates.install[p.type] || 400;
          return sum + rate;
        }, 0) || 0;
        cost += installCost;
      });
    }
    
    return cost;
  }
  
  getLaborItems(solution) {
    const items = [];
    
    solution.systems?.forEach(system => {
      system.products?.forEach(product => {
        const rate = this.laborRates.install[product.type];
        if (rate) {
          items.push({
            type: product.type,
            description: `${system.name}安装`,
            unitPrice: rate,
            quantity: product.quantity || 1
          });
        }
      });
    });
    
    return items;
  }
  
  calculateMaterialItems(solution, roomProfile, painDiagnosis) {
    return this.generateMaterialList(solution).items || [];
  }
  
  calculateLaborItems(roomProfile, solution) {
    const items = [];
    const totalArea = roomProfile.area || 100;
    
    // 地暖铺设
    items.push({
      name: '地暖铺设',
      unit: '㎡',
      quantity: totalArea,
      unitPrice: this.laborRates.install['地暖铺设(每㎡)'] || 45,
      totalPrice: totalArea * (this.laborRates.install['地暖铺设(每㎡)'] || 45)
    });
    
    return items;
  }
  
  analyzeUnitPrice(item) {
    const total = item.totalPrice || item.price || 0;
    const area = item.area || 100;
    
    return {
      total,
      unitPrice: Math.round(total / area),
      marketRange: '¥' + Math.round(total / area * 0.8) + '-' + Math.round(total / area * 1.2),
      competitiveness: total / area < 300 ? 'high' : total / area > 500 ? 'low' : 'medium'
    };
  }
  
  extractKeyValues(systemItems) {
    const values = [];
    systemItems.forEach(item => {
      item.valueExplanation?.forEach(ve => {
        if (!values.find(v => v.value === ve.value)) {
          values.push({ value: ve.value, worth: ve.worth });
        }
      });
    });
    return values.slice(0, 5); // 取前5个核心价值
  }
  
  getPainSolutionsSummary(painDiagnosis) {
    const pains = painDiagnosis?.primary || [];
    return pains.map(pain => {
      const mapping = this.valueConfig.painValueMapping[pain];
      return {
        pain,
        solution: mapping?.solution || '定制解决方案',
        price: mapping?.price || 5000
      };
    });
  }
  
  analyzeCompetitiveness(total, city) {
    const marketAvg = this.getMarketAverage(city, total);
    
    return {
      vsMarket: ((total - marketAvg) / marketAvg * 100).toFixed(1) + '%',
      position: total < marketAvg ? 'competitive' : total > marketAvg * 1.2 ? 'premium' : 'standard',
      marketAverage: marketAvg
    };
  }
  
  getMarketAverage(city, reference) {
    const factors = this.getRegionFactor(city);
    return Math.round(reference * (0.9 + factors.labor * 0.1));
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════
   * 统一入口
   * ═══════════════════════════════════════════════════════════════
   */
  
  // 智能选择最佳报价模式
  generateQuote(data, options = {}) {
    const { roomProfiles, solution, painDiagnosis, city, mode = 'auto' } = data;
    
    switch (mode) {
      case 'value':
        return this.generateValueQuote(solution, painDiagnosis, roomProfiles[0], city, options);
      case 'kujiale':
        return this.generateKujialeQuote(roomProfiles, city, options);
      case 'qijia':
        return this.generateQijiaQuote(solution, roomProfiles, city, options);
      case 'tubatu':
        const totalArea = roomProfiles.reduce((sum, r) => sum + (r.area || 0), 0);
        const points = solution.systems?.length || 6;
        return this.generateTubatuQuote(totalArea, points, city, options);
      case 'auto':
      default:
        // 根据项目特点自动选择
        if (painDiagnosis?.primary?.length > 0) {
          return this.generateValueQuote(solution, painDiagnosis, roomProfiles[0], city, options);
        } else if (roomProfiles.length > 4) {
          return this.generateKujialeQuote(roomProfiles, city, options);
        } else {
          return this.generateQijiaQuote(solution, roomProfiles, city, options);
        }
    }
  }
  
  // 批量报价
  batchGenerateQuotes(projects, options = {}) {
    return projects.map((project, index) => ({
      projectId: index,
      ...this.generateQuote(project, options)
    }));
  }
  
  // 版本信息
  getVersion() {
    return {
      version: this.version,
      pricingModels: Object.keys(this.pricingModels),
      supportedCities: Object.keys(this.regionFactors).length,
      materialCategories: Object.keys(this.materials).length
    };
  }
}

module.exports = QuotationEngine;
