/**
 * TemplateLibrary - 方案模板库系统
 * 实现10个标准模板、智能推荐、版本管理
 * 
 * Vibe Coding生成 - 2026-04-06 Session 3
 * 自然语言需求: 建立完整的方案模板库
 */

class TemplateLibrary {
  constructor(options = {}) {
    this.templates = new Map();
    this.categories = new Map();
    this.versionHistory = new Map();
    this.usageStats = new Map();
    
    // 初始化预设模板
    this.initializePresetTemplates();
  }

  initializePresetTemplates() {
    const presetTemplates = [
      // 别墅系列
      {
        id: 'tpl-villa-001',
        name: '豪华别墅五恒系统',
        category: 'villa',
        tags: ['别墅', '五恒', '豪华'],
        description: '适用于300-500㎡豪华别墅，全屋五恒系统覆盖',
        roomProfile: {
          area: 400,
          floors: 3,
          orientation: 'south',
          hasBasement: true,
          hasGarden: true
        },
        deviceSelection: {
          systems: ['恒温', '恒湿', '恒氧', '恒洁', '恒静'],
          devices: [
            { type: '地暖', brand: '瑞美', model: 'RMD-300', quantity: 1 },
            { type: '新风', brand: '瑞美', model: 'RMF-500', quantity: 2 },
            { type: '净水', brand: '瑞美', model: 'RMW-1000', quantity: 1 },
            { type: '除湿', brand: '瑞美', model: 'RMDH-200', quantity: 2 }
          ]
        },
        quotation: {
          basePrice: 180000,
          discount: 0.88,
          finalPrice: 158400,
          items: [
            { name: '地暖系统', price: 60000, painPoint: '冬季寒冷' },
            { name: '新风系统', price: 45000, painPoint: '空气质量差' },
            { name: '净水系统', price: 35000, painPoint: '水质问题' },
            { name: '除湿系统', price: 40000, painPoint: '潮湿霉变' }
          ]
        },
        createdAt: '2026-01-01',
        version: '1.0',
        usageCount: 45,
        rating: 4.8
      },
      
      // 公寓系列
      {
        id: 'tpl-apartment-001',
        name: '精致公寓舒适系统',
        category: 'apartment',
        tags: ['公寓', '中小户型', '经济'],
        description: '适用于80-120㎡城市公寓，性价比优选方案',
        roomProfile: {
          area: 100,
          floors: 15,
          orientation: 'south',
          familyType: 'young_couple'
        },
        deviceSelection: {
          systems: ['采暖', '新风', '净水'],
          devices: [
            { type: '空调', brand: '瑞美', model: 'RMA-120', quantity: 3 },
            { type: '新风', brand: '瑞美', model: 'RMF-200', quantity: 1 },
            { type: '净水', brand: '瑞美', model: 'RMW-500', quantity: 1 }
          ]
        },
        quotation: {
          basePrice: 45000,
          discount: 0.92,
          finalPrice: 41400,
          items: [
            { name: '空调系统', price: 20000, painPoint: '夏季炎热' },
            { name: '新风系统', price: 15000, painPoint: '通风不良' },
            { name: '净水系统', price: 10000, painPoint: '水质担忧' }
          ]
        },
        createdAt: '2026-01-01',
        version: '1.0',
        usageCount: 128,
        rating: 4.6
      },
      
      // 母婴系列
      {
        id: 'tpl-maternity-001',
        name: '母婴家庭健康系统',
        category: 'family',
        tags: ['母婴', '健康', '静音'],
        description: '专为新生儿家庭设计，静音健康环境',
        roomProfile: {
          area: 130,
          floors: 8,
          orientation: 'east',
          familyType: 'newborn'
        },
        deviceSelection: {
          systems: ['恒温', '恒湿', '净化', '静音'],
          devices: [
            { type: '地暖', brand: '瑞美', model: 'RMD-150-Quiet', quantity: 1 },
            { type: '加湿器', brand: '瑞美', model: 'RMH-100', quantity: 2 },
            { type: '空气净化器', brand: '瑞美', model: 'RMAP-300', quantity: 3 },
            { type: '净水', brand: '瑞美', model: 'RMW-800', quantity: 1 }
          ]
        },
        quotation: {
          basePrice: 68000,
          discount: 0.90,
          finalPrice: 61200,
          items: [
            { name: '静音地暖', price: 25000, painPoint: '婴儿怕冷' },
            { name: '加湿系统', price: 12000, painPoint: '干燥不适' },
            { name: '空气净化', price: 18000, painPoint: '空气质量' },
            { name: '净水系统', price: 13000, painPoint: '用水安全' }
          ]
        },
        createdAt: '2026-01-15',
        version: '1.0',
        usageCount: 67,
        rating: 4.9
      },
      
      // 老人系列
      {
        id: 'tpl-elderly-001',
        name: '适老化舒适系统',
        category: 'family',
        tags: ['老人', '适老', '安全'],
        description: '针对老年人居住特点，温暖安全易操作',
        roomProfile: {
          area: 90,
          floors: 3,
          orientation: 'south',
          familyType: 'elderly'
        },
        deviceSelection: {
          systems: ['采暖', '新风', '净水', '智能控制'],
          devices: [
            { type: '地暖', brand: '瑞美', model: 'RMD-100-Safe', quantity: 1 },
            { type: '新风', brand: '瑞美', model: 'RMF-150', quantity: 1 },
            { type: '净水', brand: '瑞美', model: 'RMW-300', quantity: 1 },
            { type: '智能控制器', brand: '瑞美', model: 'RMC-Elder', quantity: 1 }
          ]
        },
        quotation: {
          basePrice: 38000,
          discount: 0.93,
          finalPrice: 35340,
          items: [
            { name: '安全地暖', price: 15000, painPoint: '怕冷畏寒' },
            { name: '新风系统', price: 12000, painPoint: '通风需求' },
            { name: '净水系统', price: 8000, painPoint: '健康用水' },
            { name: '智能控制', price: 3000, painPoint: '操作简便' }
          ]
        },
        createdAt: '2026-01-20',
        version: '1.0',
        usageCount: 34,
        rating: 4.7
      },
      
      // 商用系列
      {
        id: 'tpl-commercial-001',
        name: '小型办公舒适系统',
        category: 'commercial',
        tags: ['商用', '办公', '高效'],
        description: '适用于200㎡以内小型办公空间',
        roomProfile: {
          area: 200,
          floors: 5,
          orientation: 'south',
          usageType: 'office'
        },
        deviceSelection: {
          systems: ['空调', '新风', '净水'],
          devices: [
            { type: '中央空调', brand: '瑞美', model: 'RMC-200', quantity: 1 },
            { type: '新风', brand: '瑞美', model: 'RMF-400', quantity: 2 },
            { type: '商用净水', brand: '瑞美', model: 'RMW-2000', quantity: 1 }
          ]
        },
        quotation: {
          basePrice: 85000,
          discount: 0.85,
          finalPrice: 72250,
          items: [
            { name: '中央空调', price: 45000, painPoint: '温度不均' },
            { name: '新风系统', price: 25000, painPoint: '空气污浊' },
            { name: '商用净水', price: 15000, painPoint: '饮水安全' }
          ]
        },
        createdAt: '2026-02-01',
        version: '1.0',
        usageCount: 23,
        rating: 4.5
      },
      
      // 更多模板... (共10个)
      {
        id: 'tpl-north-001',
        name: '北向户型专用方案',
        category: 'special',
        tags: ['北向', '采光', '保暖'],
        description: '解决北向户型采光不足、冬季阴冷问题',
        roomProfile: { area: 110, floors: 12, orientation: 'north' },
        deviceSelection: {
          systems: ['地暖', '补光', '新风'],
          devices: [
            { type: '地暖', brand: '瑞美', model: 'RMD-120', quantity: 1 },
            { type: '补光灯', brand: '瑞美', model: 'RML-100', quantity: 4 },
            { type: '新风', brand: '瑞美', model: 'RMF-180', quantity: 1 }
          ]
        },
        quotation: { basePrice: 42000, discount: 0.91, finalPrice: 38220 },
        createdAt: '2026-02-10',
        version: '1.0',
        usageCount: 56,
        rating: 4.6
      },
      
      {
        id: 'tpl-west-001',
        name: '西晒户型降温方案',
        category: 'special',
        tags: ['西晒', '降温', '遮阳'],
        description: '针对西晒户型夏季过热问题',
        roomProfile: { area: 95, floors: 6, orientation: 'west' },
        deviceSelection: {
          systems: ['空调', '遮阳', '新风'],
          devices: [
            { type: '变频空调', brand: '瑞美', model: 'RMA-180-Inverter', quantity: 2 },
            { type: '电动遮阳', brand: '瑞美', model: 'RMS-200', quantity: 3 },
            { type: '新风', brand: '瑞美', model: 'RMF-150', quantity: 1 }
          ]
        },
        quotation: { basePrice: 35000, discount: 0.93, finalPrice: 32550 },
        createdAt: '2026-02-15',
        version: '1.0',
        usageCount: 42,
        rating: 4.4
      },
      
      {
        id: 'tpl-basement-001',
        name: '地下室防潮方案',
        category: 'special',
        tags: ['地下室', '防潮', '除湿'],
        description: '解决地下室潮湿、霉变问题',
        roomProfile: { area: 80, floors: 1, hasBasement: true, basementArea: 80 },
        deviceSelection: {
          systems: ['除湿', '新风', '地暖'],
          devices: [
            { type: '除湿机', brand: '瑞美', model: 'RMDH-150', quantity: 2 },
            { type: '新风', brand: '瑞美', model: 'RMF-100', quantity: 1 },
            { type: '地暖', brand: '瑞美', model: 'RMD-80', quantity: 1 }
          ]
        },
        quotation: { basePrice: 28000, discount: 0.94, finalPrice: 26320 },
        createdAt: '2026-02-20',
        version: '1.0',
        usageCount: 38,
        rating: 4.7
      },
      
      {
        id: 'tpl-coastal-001',
        name: '沿海地区防腐蚀方案',
        category: 'special',
        tags: ['沿海', '防腐蚀', '高湿'],
        description: '针对沿海地区高湿、盐雾环境',
        roomProfile: { area: 140, floors: 8, location: 'coastal' },
        deviceSelection: {
          systems: ['除湿', '净化', '防腐'],
          devices: [
            { type: '防腐空调', brand: '瑞美', model: 'RMA-150-C', quantity: 2 },
            { type: '除湿机', brand: '瑞美', model: 'RMDH-180-C', quantity: 2 },
            { type: '防腐新风', brand: '瑞美', model: 'RMF-200-C', quantity: 1 }
          ]
        },
        quotation: { basePrice: 52000, discount: 0.89, finalPrice: 46280 },
        createdAt: '2026-03-01',
        version: '1.0',
        usageCount: 19,
        rating: 4.8
      },
      
      {
        id: 'tpl-economy-001',
        name: '经济型基础方案',
        category: 'apartment',
        tags: ['经济', '基础', '入门'],
        description: '预算有限的入门舒适系统方案',
        roomProfile: { area: 70, floors: 10, orientation: 'south' },
        deviceSelection: {
          systems: ['采暖', '净水'],
          devices: [
            { type: '空调', brand: '瑞美', model: 'RMA-80', quantity: 2 },
            { type: '净水', brand: '瑞美', model: 'RMW-300', quantity: 1 }
          ]
        },
        quotation: { basePrice: 18000, discount: 0.95, finalPrice: 17100 },
        createdAt: '2026-03-05',
        version: '1.0',
        usageCount: 89,
        rating: 4.3
      }
    ];
    
    // 加载到模板库
    for (const template of presetTemplates) {
      this.templates.set(template.id, template);
      
      // 分类统计
      if (!this.categories.has(template.category)) {
        this.categories.set(template.category, []);
      }
      this.categories.get(template.category).push(template.id);
    }
    
    console.log(`[TemplateLibrary] 已加载 ${presetTemplates.length} 个预设模板`);
    console.log(`  - 分类: ${Array.from(this.categories.keys()).join(', ')}`);
  }

  // 基于户型自动推荐模板
  recommendTemplates(roomProfile, options = {}) {
    const recommendations = [];
    const limit = options.limit || 5;
    
    for (const [id, template] of this.templates) {
      let score = 0;
      let reasons = [];
      
      // 面积匹配 (±20%)
      const areaDiff = Math.abs(template.roomProfile.area - roomProfile.area) / roomProfile.area;
      if (areaDiff < 0.2) {
        score += 30;
        reasons.push('面积匹配');
      } else if (areaDiff < 0.4) {
        score += 15;
      }
      
      // 朝向匹配
      if (template.roomProfile.orientation === roomProfile.orientation) {
        score += 20;
        reasons.push('朝向匹配');
      }
      
      // 楼层匹配
      const floorDiff = Math.abs(template.roomProfile.floors - roomProfile.floors);
      if (floorDiff < 5) {
        score += 15;
        reasons.push('楼层相近');
      }
      
      // 特殊特征匹配
      if (roomProfile.hasBasement && template.roomProfile.hasBasement) {
        score += 20;
        reasons.push('都有地下室');
      }
      
      if (roomProfile.familyType && template.roomProfile.familyType === roomProfile.familyType) {
        score += 25;
        reasons.push('家庭类型匹配');
      }
      
      // 使用率加权
      score += Math.min(template.usageCount / 10, 10);
      
      // 评分加权
      score += template.rating * 2;
      
      if (score > 30) { // 只返回相关度较高的
        recommendations.push({
          template,
          score: Math.round(score),
          matchReasons: reasons,
          priceRange: this.calculatePriceRange(template, roomProfile)
        });
      }
    }
    
    // 按分数排序
    recommendations.sort((a, b) => b.score - a.score);
    
    return recommendations.slice(0, limit);
  }

  calculatePriceRange(template, roomProfile) {
    const areaRatio = roomProfile.area / template.roomProfile.area;
    const basePrice = template.quotation.finalPrice;
    const adjustedPrice = Math.round(basePrice * areaRatio);
    
    return {
      estimatedPrice: adjustedPrice,
      priceRange: [Math.round(adjustedPrice * 0.9), Math.round(adjustedPrice * 1.1)],
      areaAdjustment: areaRatio.toFixed(2)
    };
  }

  // 搜索模板
  searchTemplates(query, filters = {}) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const [id, template] of this.templates) {
      let match = false;
      
      // 名称匹配
      if (template.name.toLowerCase().includes(searchTerm)) match = true;
      
      // 标签匹配
      if (template.tags.some(tag => tag.toLowerCase().includes(searchTerm))) match = true;
      
      // 描述匹配
      if (template.description.toLowerCase().includes(searchTerm)) match = true;
      
      // 过滤器
      if (filters.category && template.category !== filters.category) match = false;
      if (filters.minPrice && template.quotation.finalPrice < filters.minPrice) match = false;
      if (filters.maxPrice && template.quotation.finalPrice > filters.maxPrice) match = false;
      if (filters.minRating && template.rating < filters.minRating) match = false;
      
      if (match) {
        results.push(template);
      }
    }
    
    // 排序
    const sortBy = filters.sortBy || 'usageCount';
    results.sort((a, b) => b[sortBy] - a[sortBy]);
    
    return results;
  }

  // 获取分类列表
  getCategories() {
    const result = [];
    for (const [category, ids] of this.categories) {
      const templates = ids.map(id => this.templates.get(id));
      result.push({
        id: category,
        name: this.getCategoryName(category),
        count: ids.length,
        avgRating: templates.reduce((sum, t) => sum + t.rating, 0) / templates.length,
        totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0)
      });
    }
    return result;
  }

  getCategoryName(category) {
    const names = {
      villa: '别墅方案',
      apartment: '公寓方案',
      family: '家庭方案',
      commercial: '商用方案',
      special: '特殊户型'
    };
    return names[category] || category;
  }

  // 获取模板详情
  getTemplate(id) {
    return this.templates.get(id);
  }

  // 使用模板（记录统计）
  useTemplate(id, projectId) {
    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      
      // 记录使用历史
      if (!this.usageStats.has(id)) {
        this.usageStats.set(id, []);
      }
      this.usageStats.get(id).push({
        projectId,
        timestamp: new Date().toISOString()
      });
    }
    return template;
  }

  // 基于模板创建项目
  createProjectFromTemplate(templateId, customerInfo, customizations = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }
    
    // 应用定制
    const project = {
      id: `PRJ-${Date.now()}`,
      name: customizations.name || `${customerInfo.name}的${template.name}`,
      customer: customerInfo,
      templateId,
      roomProfile: { ...template.roomProfile, ...customizations.roomProfile },
      deviceSelection: customizations.deviceSelection || template.deviceSelection,
      quotation: this.calculateCustomizedQuotation(template.quotation, customizations),
      status: 'draft',
      createdAt: new Date().toISOString(),
      basedOn: {
        templateId,
        templateName: template.name,
        version: template.version
      }
    };
    
    // 记录模板使用
    this.useTemplate(templateId, project.id);
    
    return project;
  }

  calculateCustomizedQuotation(baseQuotation, customizations) {
    let finalPrice = baseQuotation.finalPrice;
    
    // 应用折扣
    if (customizations.discount) {
      finalPrice = Math.round(finalPrice * customizations.discount);
    }
    
    // 增减项目
    if (customizations.additionalItems) {
      for (const item of customizations.additionalItems) {
        finalPrice += item.price;
      }
    }
    
    return {
      ...baseQuotation,
      finalPrice,
      customizations: customizations.notes || ''
    };
  }

  // 添加新模板
  addTemplate(templateData) {
    const id = `tpl-${Date.now()}`;
    const template = {
      ...templateData,
      id,
      createdAt: new Date().toISOString(),
      version: '1.0',
      usageCount: 0,
      rating: 0
    };
    
    this.templates.set(id, template);
    
    // 更新分类
    if (!this.categories.has(template.category)) {
      this.categories.set(template.category, []);
    }
    this.categories.get(template.category).push(id);
    
    return id;
  }

  // 更新模板
  updateTemplate(id, updates) {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`模板不存在: ${id}`);
    }
    
    // 保存历史版本
    if (!this.versionHistory.has(id)) {
      this.versionHistory.set(id, []);
    }
    this.versionHistory.get(id).push({
      ...template,
      archivedAt: new Date().toISOString()
    });
    
    // 更新
    Object.assign(template, updates, {
      version: this.incrementVersion(template.version),
      updatedAt: new Date().toISOString()
    });
    
    return template;
  }

  incrementVersion(version) {
    const parts = version.split('.');
    parts[1] = parseInt(parts[1]) + 1;
    return parts.join('.');
  }

  // 获取模板版本历史
  getVersionHistory(templateId) {
    return this.versionHistory.get(templateId) || [];
  }

  // 获取统计信息
  getStats() {
    const templates = Array.from(this.templates.values());
    
    return {
      totalTemplates: templates.length,
      totalCategories: this.categories.size,
      totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
      avgRating: templates.reduce((sum, t) => sum + t.rating, 0) / templates.length,
      mostPopular: templates.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
      highestRated: templates.sort((a, b) => b.rating - a.rating).slice(0, 5),
      categoryDistribution: this.getCategories()
    };
  }
}

module.exports = TemplateLibrary;
