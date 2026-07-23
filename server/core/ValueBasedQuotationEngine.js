/**
 * 价值型报价引擎 (M6) - ValueBasedQuotationEngine
 * 每项费用对应痛点解决方案
 */

class ValueBasedQuotationEngine {
  constructor() {
    this.promotionRules = [
      { type: 'discount', name: '全屋总包优惠', threshold: 50000, discount: 5000, description: '满5万减5000' },
      { type: 'percentage', name: '老客户推荐', discount: 0.95, description: '额外95折' },
      { type: 'package', name: '六系统套餐', systems: 6, discount: 10000, description: '全套优惠1万' }
    ];

    this.marginSettings = {
      minMargin: 0.15, // 最低毛利15%
      targetMargin: 0.25, // 目标毛利25%
      maxDiscount: 0.10 // 最大折扣10%
    };
  }

  /**
   * 生成价值型报价
   */
  generateValueQuote(solution, painDiagnosis, roomProfile) {
    const baseSystems = solution.systems || [];

    // 1. 详细工程量计算
    const engineeringQuantity = this.calculateEngineeringQuantity(roomProfile, solution);

    // 2. 生成系统报价项（每项对应痛点）
    const systemItems = baseSystems.map(system => ({
      category: system.category || system.name,
      name: system.name,
      products: system.products || [],
      basePrice: this.calculateSystemPrice(system, roomProfile),
      solvedPains: this.mapSystemToPains(system, painDiagnosis),
      valueExplanation: this.generateValueExplanation(system, painDiagnosis),
      costBreakdown: this.generateCostBreakdown(system),
      unitPriceAnalysis: this.analyzeUnitPrice({ totalPrice: this.calculateSystemPrice(system, roomProfile) })
    }));

    // 3. 计算材料费用（关联痛点）
    const materialItems = this.calculateMaterialItems(solution, roomProfile, painDiagnosis).map(item => ({
      ...item,
      unitPriceAnalysis: this.analyzeUnitPrice(item)
    }));

    // 4. 计算人工费用
    const laborItems = this.calculateLaborItems(roomProfile, solution).map(item => ({
      ...item,
      unitPriceAnalysis: this.analyzeUnitPrice(item)
    }));

    // 5. 汇总所有项目
    const allItems = [...systemItems, ...materialItems, ...laborItems];

    // 6. 计算小计
    const subtotal = allItems.reduce((sum, item) => sum + (item.totalPrice || item.basePrice), 0);

    // 7. 应用促销
    const promotions = this.applyPromotions(subtotal, baseSystems.length, solution);

    // 8. 计算总价
    const finalTotal = subtotal - promotions.totalDiscount;

    // 9. 生成报价单
    return {
      timestamp: new Date().toISOString(),
      quoteNumber: `RHEEM-${Date.now().toString(36).toUpperCase()}`,
      validity: '7天',
      roomProfile,
      engineeringQuantity,
      painSummary: {
        totalPains: painDiagnosis.allTags?.length || 0,
        solvedPains: this.countSolvedPains(allItems),
        coverage: this.calculatePainCoverage(painDiagnosis, allItems)
      },
      items: allItems,
      subtotal,
      promotions,
      finalTotal,
      financing: this.generateFinancingOptions(finalTotal),
      valueHighlights: this.generateValueHighlights(allItems, painDiagnosis),
      ownerBenefits: this.generateOwnerBenefits(painDiagnosis),
      exportFormats: ['PDF', 'Excel', '图片']
    };
  }

  /**
   * 计算系统价格
   */
  calculateSystemPrice(system, roomProfile) {
    const basePrices = {
      '中央热水系统': { base: 12000, perSqm: 30 },
      '五恒恒温系统': { base: 30000, perSqm: 150 },
      '新风除湿系统': { base: 8000, perSqm: 40 },
      '全屋净水系统': { base: 10000, perSqm: 50 },
      '中央空调系统': { base: 20000, perSqm: 100 },
      '瑞美全屋总包方案': { base: 50000, perSqm: 300 }
    };

    const priceConfig = basePrices[system.name] || { base: 10000, perSqm: 50 };
    const area = roomProfile.area || 100;

    return Math.round(priceConfig.base + priceConfig.perSqm * area);
  }

  /**
   * 详细工程量计算
   */
  calculateEngineeringQuantity(roomProfile, solution) {
    const area = roomProfile.area || 100;
    const floors = roomProfile.floors || 1;
    const areaPerFloor = Math.round(area / floors);

    return {
      // 分层计算
      byFloor: Array.from({ length: floors }, (_, i) => ({
        floor: `${i + 1}F`,
        area: areaPerFloor,
        rooms: this.generateRoomsForFloor(areaPerFloor, i + 1)
      })),
      // 分段计算
      bySection: {
        '水系统': { length: Math.round(area * 1.2), diameter: 'DN25', note: '按面积估算管路长度' },
        '风系统': { area: Math.round(area * 0.8), thickness: '0.5mm', note: '按面积估算风管面积' },
        '电系统': { length: Math.round(area * 1.5), wire: 'BV-2.5mm²', note: '按面积估算线路长度' }
      },
      // 分部位计算
      byLocation: {
        '主机房': { area: Math.max(10, Math.round(area * 0.1)), equipment: solution.systems?.length || 1, note: '设备安装区域' },
        '管道井': { length: Math.round(area * 0.2), pipe: Math.round(area * 0.15), note: '管路通道' },
        '配电箱': { location: '入户处', count: 1, note: '电源接入点' }
      },
      totalArea: area,
      totalFloors: floors
    };
  }

  /**
   * 为楼层生成房间
   */
  generateRoomsForFloor(area, floorNum) {
    const roomTypes = ['客厅', '卧室', '厨房', '卫生间', '书房'];
    const roomCount = Math.min(roomTypes.length, Math.ceil(area / 30));
    const areaPerRoom = Math.round(area / roomCount);

    return roomTypes.slice(0, roomCount).map((type, i) => ({
      name: `${type}${floorNum > 1 ? floorNum : ''}`,
      area: areaPerRoom,
      type: type
    }));
  }

  /**
   * 映射系统解决的痛点
   */
  mapSystemToPains(system, painDiagnosis) {
    const painMapping = {
      '中央热水系统': ['tag_11', 'tag_12', 'tag_13', 'tag_14', 'tag_15'],
      '五恒恒温系统': ['tag_01', 'tag_02', 'tag_03', 'tag_04', 'tag_05'],
      '新风除湿系统': ['tag_21', 'tag_22', 'tag_23', 'tag_24', 'tag_25'],
      '全屋净水系统': ['tag_31', 'tag_32', 'tag_33', 'tag_34'],
      '中央空调系统': ['tag_01', 'tag_02', 'tag_04'],
      '瑞美全屋总包方案': ['tag_41', 'tag_42', 'tag_43', 'tag_44']
    };

    const systemPains = painMapping[system.name] || [];
    const solvedPains = painDiagnosis.allTags?.filter(tag => 
      systemPains.includes(tag.id)
    ) || [];

    return solvedPains.map(pain => ({
      id: pain.id,
      name: pain.name,
      category: pain.category
    }));
  }

  /**
   * 生成价值说明
   */
  generateValueExplanation(system, painDiagnosis) {
    const explanations = {
      '中央热水系统': '解决热水等待、水温波动、储水不足等痛点，实现全屋零冷水',
      '五恒恒温系统': '解决温差、直吹、干燥等痛点，实现恒温恒湿无风感',
      '新风除湿系统': '解决发霉、返潮、干燥等痛点，实现24小时干爽空气',
      '全屋净水系统': '解决水质异味、结垢、健康担忧等痛点，实现全程净化',
      '中央空调系统': '解决温度不均、空间占用等痛点，实现美观舒适制冷',
      '瑞美全屋总包方案': '解决多品牌对接、增项风险、售后复杂等痛点，实现一站式服务'
    };

    return explanations[system.name] || '提升居住舒适度';
  }

  /**
   * 生成成本明细
   */
  generateCostBreakdown(system) {
    const totalPrice = system.price || 10000;
    return {
      equipment: Math.round(totalPrice * 0.65), // 设备65%
      materials: Math.round(totalPrice * 0.20), // 材料20%
      labor: Math.round(totalPrice * 0.15),   // 人工15%
      note: '价格包含设备、材料、安装调试费用'
    };
  }

  /**
   * 综合单价分析
   */
  analyzeUnitPrice(item) {
    const totalPrice = item.totalPrice || item.basePrice || 10000;
    return {
      laborCost: {
        amount: Math.round(totalPrice * 0.20),
        percentage: 20,
        description: '人工费：专业安装师傅施工'
      },
      materialCost: {
        amount: Math.round(totalPrice * 0.50),
        percentage: 50,
        description: '材料费：设备、管材、配件等'
      },
      machineryCost: {
        amount: Math.round(totalPrice * 0.10),
        percentage: 10,
        description: '机械使用费：施工机械、工具等'
      },
      managementCost: {
        amount: Math.round(totalPrice * 0.10),
        percentage: 10,
        description: '管理费：项目管理、质量控制'
      },
      profit: {
        amount: Math.round(totalPrice * 0.08),
        percentage: 8,
        description: '利润：合理利润'
      },
      riskFactor: {
        amount: Math.round(totalPrice * 0.02),
        percentage: 2,
        description: '风险因素：价格波动、施工风险'
      }
    };
  }

  /**
   * 计算材料项目
   */
  calculateMaterialItems(solution, roomProfile, painDiagnosis) {
    const area = roomProfile.area || 100;
    const items = [];

    // 主机设备
    const mainEquipment = this.generateMainEquipmentList(solution, painDiagnosis);
    items.push(...mainEquipment);

    // 保温材料
    const insulation = this.generateInsulationList(area, painDiagnosis);
    items.push(...insulation);

    // 水管
    const pipes = this.generatePipeList(area, solution);
    items.push(...pipes);

    // 风管
    const ducts = this.generateDuctList(area, solution);
    items.push(...ducts);

    // 支吊架
    const supports = this.generateSupportList(area);
    items.push(...supports);

    // 铜管
    const copper = this.generateCopperList(area, solution);
    items.push(...copper);

    // 水管件
    const fittings = this.generateFittingList(area);
    items.push(...fittings);

    // 水设备
    const waterEquipment = this.generateWaterEquipmentList(solution);
    items.push(...waterEquipment);

    // 风部件
    const airComponents = this.generateAirComponentList(area, solution);
    items.push(...airComponents);

    // 电系统
    const electrical = this.generateElectricalList(area);
    items.push(...electrical);

    // 其他
    const others = this.generateOtherList(area, solution);
    items.push(...others);

    return items;
  }

  /**
   * 生成主机设备清单
   */
  generateMainEquipmentList(solution, painDiagnosis) {
    const items = [];
    const systems = solution.systems || [];

    systems.forEach(system => {
      const equipmentMap = {
        '中央热水系统': { name: '瑞美中央热水器', brand: 'Rheem', model: 'RHS-200L', unitPrice: 12000, specs: '容量200L，功率3kW' },
        '五恒恒温系统': { name: '瑞美五恒主机', brand: 'Rheem', model: '5H-300', unitPrice: 25000, specs: '制冷量15kW，制热量18kW' },
        '新风除湿系统': { name: '瑞美新风机', brand: 'Rheem', model: 'XF-500', unitPrice: 8000, specs: '风量500m³/h，除湿量30L/天' },
        '全屋净水系统': { name: '瑞美净水器', brand: 'Rheem', model: 'WP-1000', unitPrice: 10000, specs: '流量1000L/h，五级过滤' },
        '中央空调系统': { name: '鲁德中央空调', brand: 'Ruud', model: 'AC-180', unitPrice: 20000, specs: '制冷量18kW，变频' }
      };

      const equipment = equipmentMap[system.name];
      if (equipment) {
        items.push({
          category: '主机设备',
          name: equipment.name,
          brand: equipment.brand,
          model: equipment.model,
          quantity: 1,
          unit: '台',
          unitPrice: equipment.unitPrice,
          totalPrice: equipment.unitPrice,
          solvedPains: this.mapSystemToPains(system, painDiagnosis),
          valueExplanation: this.generateValueExplanation(system, painDiagnosis),
          specifications: equipment.specs
        });
      }
    });

    return items;
  }

  /**
   * 生成保温材料清单
   */
  generateInsulationList(area, painDiagnosis) {
    const items = [];
    const hasTempPain = painDiagnosis.allTags?.some(t => t.category === '温度体感痛点');

    if (hasTempPain) {
      items.push({
        category: '保温材料',
        name: '橡塑保温棉',
        brand: '阿乐斯',
        model: 'B1级',
        quantity: Math.round(area * 0.5),
        unit: '立方米',
        unitPrice: 1200,
        totalPrice: Math.round(area * 0.5 * 1200),
        solvedPains: [{ name: '温度保持', category: '节能舒适' }],
        valueExplanation: '优质保温，减少能量损失，降低运行费用30%',
        specifications: '厚度20mm，导热系数≤0.034W/(m·K)'
      });
    }

    return items;
  }

  /**
   * 生成水管清单
   */
  generatePipeList(area, solution) {
    const items = [];
    const hasWaterSystem = solution.systems?.some(s => s.name.includes('热水') || s.name.includes('净水'));

    if (hasWaterSystem) {
      items.push({
        category: '水管',
        name: '镀锌钢管',
        brand: '友发',
        model: 'DN25',
        quantity: Math.round(area * 1.2),
        unit: '米',
        unitPrice: 45,
        totalPrice: Math.round(area * 1.2 * 45),
        solvedPains: [{ name: '管路设计', category: '施工保障' }],
        valueExplanation: '优质管材+专业施工，确保系统稳定运行20年',
        specifications: '壁厚3.2mm，镀锌层≥120g/m²'
      });
    }

    return items;
  }

  /**
   * 生成风管清单
   */
  generateDuctList(area, solution) {
    const items = [];
    const hasAirSystem = solution.systems?.some(s => s.name.includes('新风') || s.name.includes('空调'));

    if (hasAirSystem) {
      items.push({
        category: '风管',
        name: '镀锌钢风管',
        brand: '联塑',
        model: '0.5mm',
        quantity: Math.round(area * 0.8),
        unit: '平方米',
        unitPrice: 80,
        totalPrice: Math.round(area * 0.8 * 80),
        solvedPains: [{ name: '风路设计', category: '施工保障' }],
        valueExplanation: '优质风管，低阻力，低噪音',
        specifications: '厚度0.5mm，镀锌层≥120g/m²'
      });
    }

    return items;
  }

  /**
   * 生成支吊架清单
   */
  generateSupportList(area) {
    return [{
      category: '支吊架',
      name: '角钢支架',
      brand: '友发',
      model: 'L40×4',
      quantity: Math.round(area * 0.3),
      unit: '套',
      unitPrice: 150,
      totalPrice: Math.round(area * 0.3 * 150),
      solvedPains: [{ name: '安装稳固', category: '施工保障' }],
      valueExplanation: '标准支架，除锈刷漆，防腐耐用',
      specifications: '角钢40×4mm，热镀锌'
    }];
  }

  /**
   * 生成铜管清单
   */
  generateCopperList(area, solution) {
    const items = [];
    const hasACSystem = solution.systems?.some(s => s.name.includes('空调'));

    if (hasACSystem) {
      items.push({
        category: '铜管',
        name: '紫铜管',
        brand: '海亮',
        model: 'Φ9.52',
        quantity: Math.round(area * 0.8),
        unit: '米',
        unitPrice: 65,
        totalPrice: Math.round(area * 0.8 * 65),
        solvedPains: [{ name: '制冷传输', category: '系统性能' }],
        valueExplanation: '优质铜管，高导热，耐腐蚀',
        specifications: '外径9.52mm，壁厚0.8mm，TP2材质'
      });
    }

    return items;
  }

  /**
   * 生成水管件清单
   */
  generateFittingList(area) {
    return [{
      category: '水管件',
      name: '阀门配件套装',
      brand: '伟星',
      model: 'DN25',
      quantity: Math.round(area * 0.2),
      unit: '套',
      unitPrice: 200,
      totalPrice: Math.round(area * 0.2 * 200),
      solvedPains: [{ name: '控制调节', category: '系统性能' }],
      valueExplanation: '优质阀门，密封性好，操作灵活',
      specifications: '含球阀、截止阀、止回阀各1个'
    }];
  }

  /**
   * 生成水设备清单
   */
  generateWaterEquipmentList(solution) {
    const items = [];
    const hasWaterSystem = solution.systems?.some(s => s.name.includes('热水'));

    if (hasWaterSystem) {
      items.push({
        category: '水设备',
        name: '循环水泵',
        brand: '格兰富',
        model: 'UPS25-80',
        quantity: 1,
        unit: '台',
        unitPrice: 2500,
        totalPrice: 2500,
        solvedPains: [{ name: '水循环', category: '系统性能' }],
        valueExplanation: '高效循环，低噪音，长寿命',
        specifications: '流量3m³/h，扬程8m，功率0.25kW'
      });
    }

    return items;
  }

  /**
   * 生成风部件清单
   */
  generateAirComponentList(area, solution) {
    const items = [];
    const hasAirSystem = solution.systems?.some(s => s.name.includes('新风') || s.name.includes('空调'));

    if (hasAirSystem) {
      items.push({
        category: '风部件',
        name: '风口套装',
        brand: '科龙',
        model: '方形风口',
        quantity: Math.round(area * 0.1),
        unit: '套',
        unitPrice: 180,
        totalPrice: Math.round(area * 0.1 * 180),
        solvedPains: [{ name: '气流分布', category: '舒适度' }],
        valueExplanation: '均匀送风，低噪音，美观大方',
        specifications: '含风口、风阀、软接各1个'
      });
    }

    return items;
  }

  /**
   * 生成电系统清单
   */
  generateElectricalList(area) {
    return [{
      category: '电系统',
      name: '配电箱',
      brand: '正泰',
      model: 'PZ30',
      quantity: 1,
      unit: '台',
      unitPrice: 1200,
      totalPrice: 1200,
      solvedPains: [{ name: '电源控制', category: '安全保障' }],
      valueExplanation: '专业配电，安全可靠',
      specifications: '12回路，含断路器'
    }];
  }

  /**
   * 生成其他清单
   */
  generateOtherList(area, solution) {
    const items = [];

    items.push({
      category: '其他',
      name: '系统调试费',
      brand: '瑞美',
      model: '服务',
      quantity: 1,
      unit: '项',
      unitPrice: 2000,
      totalPrice: 2000,
      solvedPains: [{ name: '系统调试', category: '服务保障' }],
      valueExplanation: '专业调试，确保系统正常运行',
      specifications: '含调试、验收、培训'
    });

    items.push({
      category: '其他',
      name: '设备运输费',
      brand: '第三方',
      model: '物流',
      quantity: 1,
      unit: '项',
      unitPrice: 1000,
      totalPrice: 1000,
      solvedPains: [{ name: '设备运输', category: '服务保障' }],
      valueExplanation: '专业运输，确保设备安全',
      specifications: '含装卸、搬运、保险'
    });

    return items;
  }

  /**
   * 计算人工项目
   */
  calculateLaborItems(roomProfile, solution) {
    const area = roomProfile.area || 100;
    const systemCount = solution.systems?.length || 1;

    return [{
      category: '专业服务',
      name: '设计安装服务',
      products: ['现场测量', '方案设计', '专业安装', '调试验收'],
      basePrice: Math.round(area * 50 + systemCount * 1000),
      solvedPains: [{ name: '专业服务', category: '质量保障' }],
      valueExplanation: '瑞美认证工程师，标准化施工，2年质保终身维护',
      costBreakdown: { 
        equipment: 0, 
        materials: 0, 
        labor: Math.round(area * 50 + systemCount * 1000),
        note: '含设计费+安装费' 
      }
    }];
  }

  /**
   * 应用促销
   */
  applyPromotions(subtotal, systemCount, solution) {
    const appliedPromotions = [];
    let totalDiscount = 0;

    for (const rule of this.promotionRules) {
      let shouldApply = false;
      let discountAmount = 0;

      switch (rule.type) {
        case 'discount':
          if (subtotal >= rule.threshold) {
            shouldApply = true;
            discountAmount = rule.discount;
          }
          break;
        case 'percentage':
          shouldApply = true;
          discountAmount = Math.round(subtotal * (1 - rule.discount));
          break;
        case 'package':
          if (systemCount >= rule.systems) {
            shouldApply = true;
            discountAmount = rule.discount;
          }
          break;
      }

      if (shouldApply) {
        // 检查毛利保护
        const discountedTotal = subtotal - totalDiscount - discountAmount;
        const margin = (discountedTotal - this.estimateCost(subtotal)) / discountedTotal;
        
        if (margin >= this.marginSettings.minMargin) {
          appliedPromotions.push({
            name: rule.name,
            description: rule.description,
            discount: discountAmount
          });
          totalDiscount += discountAmount;
        }
      }
    }

    return {
      appliedPromotions,
      totalDiscount,
      note: '促销已自动应用，确保经销商合理毛利'
    };
  }

  /**
   * 估算成本
   */
  estimateCost(subtotal) {
    return subtotal * 0.6; // 估算成本率为60%
  }

  /**
   * 统计解决的痛点数量
   */
  countSolvedPains(items) {
    const uniquePains = new Set();
    items.forEach(item => {
      item.solvedPains?.forEach(pain => uniquePains.add(pain.name));
    });
    return uniquePains.size;
  }

  /**
   * 计算痛点覆盖率
   */
  calculatePainCoverage(painDiagnosis, items) {
    const totalPains = painDiagnosis.allTags?.length || 0;
    const solvedPains = this.countSolvedPains(items);
    return totalPains > 0 ? Math.round(solvedPains / totalPains * 100) : 0;
  }

  /**
   * 生成分期选项
   */
  generateFinancingOptions(total) {
    return [
      { months: 12, monthly: Math.round(total / 12), note: '12期免息' },
      { months: 24, monthly: Math.round(total / 24 * 1.05), note: '24期低息' }
    ];
  }

  /**
   * 生成价值亮点
   */
  generateValueHighlights(items, painDiagnosis) {
    const highlights = [];
    
    // 痛点解决亮点
    const solvedCount = this.countSolvedPains(items);
    const totalPains = painDiagnosis.allTags?.length || 0;
    if (totalPains > 0) {
      highlights.push(`✓ 解决${solvedCount}/${totalPains}个居住痛点，覆盖率${Math.round(solvedCount/totalPains*100)}%`);
    }

    // 系统联动亮点
    const systemCount = items.filter(i => i.category !== '基础材料' && i.category !== '专业服务').length;
    if (systemCount > 1) {
      highlights.push(`✓ ${systemCount}大系统智能联动，统一控制更便捷`);
    }

    // 品质保障亮点
    highlights.push('✓ 瑞美/恒热全系产品，2年质保终身维护');
    highlights.push('✓ 标准化施工，隐蔽工程20年保障');

    return highlights;
  }

  /**
   * 生成业主收益
   */
  generateOwnerBenefits(painDiagnosis) {
    return {
      comfortImprovement: '居住舒适度提升80%',
      energySaving: '每年节省能耗费用约2000元',
      timeSaving: '售后维护一次搞定，省时省心',
      valueAdded: '房屋增值约5-8%',
      healthBenefit: '空气质量达到WHO标准'
    };
  }

  /**
   * 导出PDF格式报价单
   */
  exportPDF(quote) {
    return {
      format: 'PDF',
      filename: `瑞美报价单-${quote.quoteNumber}.pdf`,
      pages: [
        { type: 'cover', content: '瑞美舒适家居系统方案报价' },
        { type: 'summary', content: quote.painSummary },
        { type: 'details', content: quote.items },
        { type: 'total', content: { price: quote.finalTotal, promotions: quote.promotions } },
        { type: 'value', content: quote.valueHighlights }
      ]
    };
  }
}

module.exports = ValueBasedQuotationEngine;
