/**
 * 【方案模板复用引擎 - BE-Engine-Agent-2修复】
 * 实现方案模板库和复用功能
 */

const fs = require('fs');
const path = require('path');

class SolutionTemplateEngine {
  constructor() {
    this.templateDir = './data/templates';
    this.templates = new Map();
    this.categories = new Map();
    this.initialized = false;
  }

  // 初始化模板引擎
  async initialize() {
    console.log('📋 初始化方案模板引擎...');
    
    // 创建模板目录
    if (!fs.existsSync(this.templateDir)) {
      fs.mkdirSync(this.templateDir, { recursive: true });
    }

    // 加载内置模板
    await this.loadBuiltInTemplates();
    
    // 加载用户模板
    await this.loadUserTemplates();
    
    this.initialized = true;
    console.log(`✅ 方案模板引擎初始化完成，共${this.templates.size}个模板`);
    return true;
  }

  // 加载内置模板
  async loadBuiltInTemplates() {
    const builtInTemplates = [
      {
        id: 'tpl_villa_001',
        name: '别墅全屋方案',
        category: 'villa',
        tags: ['别墅', '全屋', '高端'],
        description: '适用于200-500㎡别墅的完整舒适家居方案',
        devices: [
          { type: 'ac', count: 5, area: '客厅/主卧/次卧/书房/娱乐室' },
          { type: 'heating', count: 3, area: '主卧/次卧/儿童房' },
          { type: 'water_heater', count: 2, area: '主卫/次卫' },
          { type: 'ventilation', count: 2, area: '地下室/储藏室' }
        ],
        layout: {
          type: 'villa',
          floors: 3,
          totalArea: 350
        },
        price: {
          base: 158000,
          premium: 185000
        },
        createdBy: 'system',
        isBuiltIn: true
      },
      {
        id: 'tpl_apartment_001',
        name: '公寓标准方案',
        category: 'apartment',
        tags: ['公寓', '标准', '性价比'],
        description: '适用于80-120㎡公寓的舒适家居方案',
        devices: [
          { type: 'ac', count: 3, area: '客厅/主卧/次卧' },
          { type: 'water_heater', count: 1, area: '卫生间' },
          { type: 'ventilation', count: 1, area: '厨房' }
        ],
        layout: {
          type: 'apartment',
          floors: 1,
          totalArea: 100
        },
        price: {
          base: 68000,
          premium: 85000
        },
        createdBy: 'system',
        isBuiltIn: true
      },
      {
        id: 'tpl_office_001',
        name: '办公空间方案',
        category: 'commercial',
        tags: ['办公', '商用', '多联机'],
        description: '适用于100-300㎡办公空间的中央空调方案',
        devices: [
          { type: 'ac_vrf', count: 1, area: '整体办公区' },
          { type: 'ventilation', count: 2, area: '会议室/休息区' }
        ],
        layout: {
          type: 'office',
          floors: 1,
          totalArea: 200
        },
        price: {
          base: 120000,
          premium: 145000
        },
        createdBy: 'system',
        isBuiltIn: true
      }
    ];

    for (const template of builtInTemplates) {
      this.templates.set(template.id, template);
      
      // 按分类存储
      if (!this.categories.has(template.category)) {
        this.categories.set(template.category, []);
      }
      this.categories.get(template.category).push(template.id);
    }
  }

  // 加载用户模板
  async loadUserTemplates() {
    try {
      const files = fs.readdirSync(this.templateDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const template = JSON.parse(fs.readFileSync(path.join(this.templateDir, file), 'utf8'));
          this.templates.set(template.id, template);
          
          if (!this.categories.has(template.category)) {
            this.categories.set(template.category, []);
          }
          if (!this.categories.get(template.category).includes(template.id)) {
            this.categories.get(template.category).push(template.id);
          }
        }
      }
    } catch (error) {
      console.log('暂无用户模板');
    }
  }

  // 创建新模板
  async createTemplate(templateData) {
    const template = {
      id: `tpl_${Date.now()}`,
      name: templateData.name,
      category: templateData.category || 'custom',
      tags: templateData.tags || [],
      description: templateData.description,
      devices: templateData.devices || [],
      layout: templateData.layout || {},
      price: templateData.price || {},
      createdBy: templateData.createdBy,
      createdAt: new Date().toISOString(),
      isBuiltIn: false,
      usageCount: 0
    };

    // 保存到文件
    const filePath = path.join(this.templateDir, `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2));

    // 加载到内存
    this.templates.set(template.id, template);
    
    if (!this.categories.has(template.category)) {
      this.categories.set(template.category, []);
    }
    this.categories.get(template.category).push(template.id);

    console.log(`✅ 创建模板: ${template.name} (${template.id})`);
    return template;
  }

  // 从现有方案创建模板
  async createTemplateFromSolution(solutionId, solutionData, userId) {
    const template = {
      id: `tpl_${Date.now()}`,
      name: `${solutionData.customerName || '客户'}方案模板`,
      category: this.categorizeSolution(solutionData),
      tags: this.generateTags(solutionData),
      description: `基于方案${solutionId}创建的模板`,
      devices: solutionData.devices || [],
      layout: solutionData.layout || {},
      price: solutionData.price || {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
      sourceSolutionId: solutionId,
      isBuiltIn: false,
      usageCount: 0
    };

    await this.createTemplate(template);
    return template;
  }

  // 分类解决方案
  categorizeSolution(solutionData) {
    const layout = solutionData.layout || {};
    if (layout.type === 'villa') return 'villa';
    if (layout.type === 'apartment') return 'apartment';
    if (layout.type === 'office') return 'commercial';
    return 'custom';
  }

  // 生成标签
  generateTags(solutionData) {
    const tags = [];
    const layout = solutionData.layout || {};
    
    if (layout.totalArea > 200) tags.push('大户型');
    else if (layout.totalArea < 80) tags.push('小户型');
    else tags.push('中户型');
    
    if (solutionData.devices) {
      const hasAC = solutionData.devices.some(d => d.type === 'ac' || d.type === 'ac_vrf');
      const hasHeating = solutionData.devices.some(d => d.type === 'heating');
      
      if (hasAC) tags.push('空调');
      if (hasHeating) tags.push('采暖');
    }
    
    return tags;
  }

  // 搜索模板
  async searchTemplates(query) {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');
    
    for (const template of this.templates.values()) {
      const searchable = [
        template.name,
        template.description,
        ...template.tags
      ].join(' ').toLowerCase();
      
      const matches = searchTerms.every(term => searchable.includes(term));
      if (matches) {
        results.push(template);
      }
    }
    
    // 按使用次数排序
    return results.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  // 获取分类模板
  async getTemplatesByCategory(category) {
    const templateIds = this.categories.get(category) || [];
    return templateIds.map(id => this.templates.get(id)).filter(Boolean);
  }

  // 应用模板创建新方案
  async applyTemplate(templateId, customerData) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    // 增加使用次数
    template.usageCount = (template.usageCount || 0) + 1;
    if (!template.isBuiltIn) {
      const filePath = path.join(this.templateDir, `${template.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
    }

    // 创建新方案
    const solution = {
      id: `sol_${Date.now()}`,
      name: `${customerData.name || '客户'} - ${template.name}`,
      customerId: customerData.id,
      customerName: customerData.name,
      templateId: template.id,
      devices: JSON.parse(JSON.stringify(template.devices)), // 深拷贝
      layout: JSON.parse(JSON.stringify(template.layout)),
      price: { ...template.price },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`✅ 应用模板创建方案: ${solution.name}`);
    return solution;
  }

  // 获取热门模板
  async getPopularTemplates(limit = 5) {
    return Array.from(this.templates.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  // 删除模板
  async deleteTemplate(templateId, userId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    if (template.isBuiltIn) {
      throw new Error('不能删除系统内置模板');
    }

    if (template.createdBy !== userId) {
      throw new Error('无权删除此模板');
    }

    // 删除文件
    const filePath = path.join(this.templateDir, `${templateId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 从内存移除
    this.templates.delete(templateId);
    
    // 从分类移除
    const category = this.categories.get(template.category);
    if (category) {
      const index = category.indexOf(templateId);
      if (index > -1) {
        category.splice(index, 1);
      }
    }

    console.log(`🗑️ 删除模板: ${templateId}`);
    return true;
  }

  // 获取统计信息
  getStats() {
    const builtInCount = Array.from(this.templates.values()).filter(t => t.isBuiltIn).length;
    const customCount = this.templates.size - builtInCount;
    
    return {
      totalTemplates: this.templates.size,
      builtInTemplates: builtInCount,
      customTemplates: customCount,
      categories: this.categories.size,
      categoryBreakdown: Array.from(this.categories.entries()).map(([cat, ids]) => ({
        category: cat,
        count: ids.length
      }))
    };
  }
}

// 导出单例
module.exports = SolutionTemplateEngine;
