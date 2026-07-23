/**
 * 方案模板库系统 - 支持模板复用和快速创建
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateLibrary {
  constructor() {
    this.templates = new Map();
    this.categories = ['住宅', '别墅', '公寓', '商用', '母婴'];
    this.templateDir = path.join(__dirname, '../../data/templates');
    this.init();
  }

  async init() {
    await this.loadDefaultTemplates();
    console.log('[Template] 方案模板库已初始化');
  }

  // 加载默认模板
  async loadDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'tpl_001',
        name: '标准三室两厅方案',
        category: '住宅',
        description: '适用于100-130㎡三室两厅户型，包含中央空调+地暖+新风+净水完整配置',
        tags: ['三室两厅', '标准配置', '舒适型'],
        roomProfile: {
          houseType: 'apartment',
          area: 120,
          floors: 1,
          rooms: 3,
          livingRooms: 1,
          bathrooms: 2
        },
        deviceSelection: {
          airConditioning: { model: 'RHEEM-120', indoorUnits: 4 },
          floorHeating: { model: 'FH-100-STD', coverage: 100 },
          wallBoiler: { model: 'RWB-28-PLUS' },
          freshAir: { model: 'W4-250' },
          waterSystem: { model: 'W3-800' }
        },
        totalPrice: 85000,
        createdAt: '2024-01-15',
        usageCount: 156,
        rating: 4.8
      },
      {
        id: 'tpl_002',
        name: '别墅五恒系统方案',
        category: '别墅',
        description: '适用于250-350㎡别墅，五恒系统完整解决方案',
        tags: ['别墅', '五恒系统', '高端配置'],
        roomProfile: {
          houseType: 'villa',
          area: 300,
          floors: 3,
          rooms: 5,
          livingRooms: 2,
          bathrooms: 4,
          basement: true
        },
        deviceSelection: {
          fiveConstant: { model: 'RHPD-300-ODIN', capillary: 'CPS-200-PRO' },
          freshAir: { model: 'W4-500' },
          wallBoiler: { model: 'RWB-35-PLUS' },
          waterSystem: { model: 'W3-1200' }
        },
        totalPrice: 280000,
        createdAt: '2024-01-20',
        usageCount: 89,
        rating: 4.9
      },
      {
        id: 'tpl_003',
        name: '母婴专属方案',
        category: '母婴',
        description: '专为母婴家庭设计，恒温恒湿，空气净化，静音运行',
        tags: ['母婴', '静音', '空气净化'],
        roomProfile: {
          houseType: 'apartment',
          area: 90,
          floors: 1,
          rooms: 2,
          livingRooms: 1,
          bathrooms: 1,
          special: '母婴'
        },
        deviceSelection: {
          airConditioning: { model: 'RHEEM-080', indoorUnits: 3, silent: true },
          floorHeating: { model: 'FH-100-STD', coverage: 80 },
          freshAir: { model: 'W4-150', pm25: 99.95 },
          waterSystem: { model: 'W3-800', uv: true }
        },
        totalPrice: 68000,
        createdAt: '2024-02-01',
        usageCount: 234,
        rating: 4.9
      },
      {
        id: 'tpl_004',
        name: '公寓小户型方案',
        category: '公寓',
        description: '适用于60-80㎡公寓，经济实用型配置',
        tags: ['小户型', '经济型', '快速安装'],
        roomProfile: {
          houseType: 'apartment',
          area: 70,
          floors: 1,
          rooms: 2,
          livingRooms: 1,
          bathrooms: 1
        },
        deviceSelection: {
          airConditioning: { model: 'RHEEM-080', indoorUnits: 2 },
          hotWater: { model: 'HOT-150L' },
          freshAir: { model: 'W4-150' }
        },
        totalPrice: 45000,
        createdAt: '2024-02-10',
        usageCount: 312,
        rating: 4.7
      },
      {
        id: 'tpl_005',
        name: '商用办公方案',
        category: '商用',
        description: '适用于200-500㎡办公空间，多联机中央空调系统',
        tags: ['商用', '办公', '多联机'],
        roomProfile: {
          houseType: 'commercial',
          area: 300,
          floors: 1,
          rooms: 8,
          openArea: true
        },
        deviceSelection: {
          airConditioning: { model: 'RHEEM-200', indoorUnits: 8 },
          freshAir: { model: 'W4-500' },
          waterSystem: { model: 'W3-1200' }
        },
        totalPrice: 120000,
        createdAt: '2024-02-15',
        usageCount: 67,
        rating: 4.6
      }
    ];

    // 加载到内存
    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // 获取所有模板
  getAllTemplates(filters = {}) {
    let templates = Array.from(this.templates.values());

    // 应用筛选
    if (filters.category) {
      templates = templates.filter(t => t.category === filters.category);
    }
    if (filters.tags) {
      const tagList = filters.tags.split(',');
      templates = templates.filter(t => 
        tagList.some(tag => t.tags.includes(tag))
      );
    }
    if (filters.minPrice) {
      templates = templates.filter(t => t.totalPrice >= filters.minPrice);
    }
    if (filters.maxPrice) {
      templates = templates.filter(t => t.totalPrice <= filters.maxPrice);
    }
    if (filters.area) {
      templates = templates.filter(t => 
        Math.abs(t.roomProfile.area - filters.area) <= 20
      );
    }

    // 排序
    const sortBy = filters.sortBy || 'usageCount';
    const sortOrder = filters.sortOrder || 'desc';
    templates.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return {
      total: templates.length,
      templates: templates
    };
  }

  // 获取单个模板
  getTemplate(id) {
    return this.templates.get(id);
  }

  // 创建新模板
  createTemplate(templateData) {
    const id = `tpl_${Date.now()}`;
    const template = {
      id,
      ...templateData,
      usageCount: 0,
      rating: 0,
      createdAt: new Date().toISOString()
    };
    
    this.templates.set(id, template);
    console.log(`[Template] 创建新模板: ${id}`);
    return template;
  }

  // 更新模板
  updateTemplate(id, updates) {
    const template = this.templates.get(id);
    if (!template) return null;

    const updated = { ...template, ...updates, updatedAt: new Date().toISOString() };
    this.templates.set(id, updated);
    return updated;
  }

  // 删除模板
  deleteTemplate(id) {
    return this.templates.delete(id);
  }

  // 使用模板创建方案
  useTemplate(templateId, projectData) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // 创建新方案
    const project = {
      id: `proj_${Date.now()}`,
      name: projectData.name || `${template.name}-副本`,
      templateId,
      roomProfile: { ...template.roomProfile, ...projectData.roomProfile },
      deviceSelection: { ...template.deviceSelection, ...projectData.deviceSelection },
      totalPrice: this.calculatePrice(template, projectData),
      createdAt: new Date().toISOString(),
      status: 'draft'
    };

    // 增加模板使用次数
    template.usageCount++;
    
    console.log(`[Template] 使用模板 ${templateId} 创建方案 ${project.id}`);
    return project;
  }

  // 计算价格（考虑调整）
  calculatePrice(template, projectData) {
    let basePrice = template.totalPrice;
    
    // 面积调整
    if (projectData.roomProfile?.area) {
      const areaRatio = projectData.roomProfile.area / template.roomProfile.area;
      basePrice = basePrice * (0.8 + 0.2 * areaRatio); // 面积影响20%价格
    }

    // 楼层调整
    if (projectData.roomProfile?.floors > template.roomProfile.floors) {
      basePrice += (projectData.roomProfile.floors - template.roomProfile.floors) * 5000;
    }

    return Math.round(basePrice);
  }

  // 获取推荐模板
  getRecommendedTemplates(roomProfile) {
    const templates = Array.from(this.templates.values());
    
    // 计算匹配度
    const scored = templates.map(template => {
      let score = 0;
      
      // 户型匹配
      if (template.roomProfile.houseType === roomProfile.houseType) {
        score += 30;
      }
      
      // 面积匹配
      const areaDiff = Math.abs(template.roomProfile.area - roomProfile.area);
      score += Math.max(0, 25 - areaDiff / 2);
      
      // 房间数匹配
      const roomDiff = Math.abs(template.roomProfile.rooms - roomProfile.rooms);
      score += Math.max(0, 20 - roomDiff * 5);
      
      // 评分加成
      score += template.rating * 2;
      
      // 使用次数加成（热门模板）
      score += Math.min(10, template.usageCount / 50);

      return { ...template, matchScore: Math.round(score) };
    });

    // 按匹配度排序
    scored.sort((a, b) => b.matchScore - a.matchScore);
    
    return scored.slice(0, 5); // 返回前5个推荐
  }

  // 获取统计信息
  getStats() {
    const templates = Array.from(this.templates.values());
    return {
      totalTemplates: templates.length,
      totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
      averageRating: (templates.reduce((sum, t) => sum + t.rating, 0) / templates.length).toFixed(2),
      categoryDistribution: this.categories.map(cat => ({
        category: cat,
        count: templates.filter(t => t.category === cat).length
      }))
    };
  }

  // 导出模板
  async exportTemplate(id) {
    const template = this.templates.get(id);
    if (!template) return null;
    
    return {
      exportVersion: '1.0',
      exportDate: new Date().toISOString(),
      template
    };
  }

  // 导入模板
  async importTemplate(templateData) {
    if (!templateData.template) {
      throw new Error('Invalid template data');
    }

    const imported = {
      ...templateData.template,
      id: `tpl_${Date.now()}`,
      usageCount: 0,
      rating: 0,
      importedAt: new Date().toISOString()
    };

    this.templates.set(imported.id, imported);
    return imported;
  }
}

module.exports = TemplateLibrary;
