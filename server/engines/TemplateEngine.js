/**
 * 【方案模板引擎 - TemplateEngine】
 * 功能: 模板创建、保存、加载、分类、复用
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TemplateEngine {
  constructor() {
    this.templates = new Map(); // templateId -> template
    this.categories = new Map(); // categoryId -> category
    this.initialized = false;
    this.storagePath = path.join(__dirname, '../../data/templates');
  }

  async initialize() {
    console.log('🔄 初始化方案模板引擎...');
    
    try {
      // 创建存储目录
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // 加载现有模板
      await this.loadTemplates();
      
      // 初始化默认分类
      this.initializeCategories();
      
      this.initialized = true;
      console.log('✅ 方案模板引擎初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 模板引擎初始化失败:', error);
      return false;
    }
  }

  initializeCategories() {
    const defaultCategories = [
      { id: 'residential', name: '住宅方案', icon: '🏠', description: '家庭住宅舒适家居方案' },
      { id: 'commercial', name: '商业方案', icon: '🏢', description: '商业办公舒适家居方案' },
      { id: 'villa', name: '别墅方案', icon: '🏰', description: '高端别墅定制方案' },
      { id: 'apartment', name: '公寓方案', icon: '🏙️', description: '城市公寓标准方案' },
      { id: 'water_system', name: '水系统', icon: '💧', description: '热水/净水/软水方案' },
      { id: 'air_system', name: '风系统', icon: '💨', description: '空调/新风/净化方案' }
    ];

    defaultCategories.forEach(cat => {
      this.categories.set(cat.id, cat);
    });
  }

  async loadTemplates() {
    try {
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storagePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const template = JSON.parse(content);
          this.templates.set(template.id, template);
        }
      }
      console.log(`📂 加载了 ${this.templates.size} 个模板`);
    } catch (error) {
      console.log('📂 模板目录为空或不存在，将创建新模板');
    }
  }

  /**
   * 创建模板
   */
  async createTemplate(templateData) {
    const template = {
      id: uuidv4(),
      name: templateData.name,
      description: templateData.description || '',
      category: templateData.category || 'residential',
      tags: templateData.tags || [],
      thumbnail: templateData.thumbnail || '',
      
      // 方案内容
      solution: {
        painPoints: templateData.solution?.painPoints || [],
        devices: templateData.solution?.devices || [],
        layout: templateData.solution?.layout || {},
        quotation: templateData.solution?.quotation || {},
        loadCalculation: templateData.solution?.loadCalculation || {}
      },
      
      // 元数据
      metadata: {
        createdBy: templateData.createdBy || 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0',
        isPublic: templateData.isPublic !== false,
        usageCount: 0
      }
    };

    this.templates.set(template.id, template);
    await this.saveTemplate(template);

    console.log(`✅ 创建模板: ${template.name} (${template.id})`);
    return template;
  }

  /**
   * 更新模板
   */
  async updateTemplate(templateId, updates) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    // 更新字段
    Object.assign(template, updates, {
      metadata: {
        ...template.metadata,
        updatedAt: new Date().toISOString(),
        version: this.incrementVersion(template.metadata.version)
      }
    });

    await this.saveTemplate(template);
    console.log(`✅ 更新模板: ${template.name}`);
    return template;
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    this.templates.delete(templateId);
    
    // 删除文件
    const filePath = path.join(this.storagePath, `${templateId}.json`);
    await fs.unlink(filePath).catch(error => {
      console.warn(`[TemplateEngine] 删除文件失败: ${filePath}`, error.message);
      // 不阻塞流程，文件不存在时继续执行
    });

    console.log(`🗑️ 删除模板: ${template.name}`);
    return true;
  }

  /**
   * 加载模板到新方案
   */
  async loadTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    // 增加使用计数
    template.metadata.usageCount++;
    template.metadata.lastUsedAt = new Date().toISOString();
    await this.saveTemplate(template);

    console.log(`📥 加载模板: ${template.name} (使用次数: ${template.metadata.usageCount})`);
    
    // 返回模板的深拷贝
    return JSON.parse(JSON.stringify(template));
  }

  /**
   * 搜索模板
   */
  searchTemplates(query = {}) {
    let results = Array.from(this.templates.values());

    // 按分类筛选
    if (query.category) {
      results = results.filter(t => t.category === query.category);
    }

    // 按标签筛选
    if (query.tags && query.tags.length > 0) {
      results = results.filter(t => 
        query.tags.some(tag => t.tags.includes(tag))
      );
    }

    // 按关键词搜索
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword)
      );
    }

    // 按创建者筛选
    if (query.createdBy) {
      results = results.filter(t => t.metadata.createdBy === query.createdBy);
    }

    // 只返回公开模板
    if (query.publicOnly !== false) {
      results = results.filter(t => t.metadata.isPublic);
    }

    // 排序
    if (query.sortBy === 'usage') {
      results.sort((a, b) => b.metadata.usageCount - a.metadata.usageCount);
    } else if (query.sortBy === 'date') {
      results.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));
    }

    return results;
  }

  /**
   * 获取分类列表
   */
  getCategories() {
    return Array.from(this.categories.values());
  }

  /**
   * 获取热门模板
   */
  getPopularTemplates(limit = 10) {
    const templates = Array.from(this.templates.values())
      .filter(t => t.metadata.isPublic)
      .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
      .slice(0, limit);

    return templates;
  }

  /**
   * 获取最近模板
   */
  getRecentTemplates(limit = 10) {
    const templates = Array.from(this.templates.values())
      .filter(t => t.metadata.isPublic)
      .sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt))
      .slice(0, limit);

    return templates;
  }

  /**
   * 复制模板
   */
  async duplicateTemplate(templateId, newName) {
    const original = this.templates.get(templateId);
    if (!original) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    const duplicated = JSON.parse(JSON.stringify(original));
    duplicated.id = uuidv4();
    duplicated.name = newName || `${original.name} (副本)`;
    duplicated.metadata = {
      ...duplicated.metadata,
      createdBy: 'user', // 标记为用户创建
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      parentTemplateId: templateId
    };

    this.templates.set(duplicated.id, duplicated);
    await this.saveTemplate(duplicated);

    console.log(`📋 复制模板: ${original.name} -> ${duplicated.name}`);
    return duplicated;
  }

  /**
   * 导出模板
   */
  async exportTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    return JSON.stringify(template, null, 2);
  }

  /**
   * 导入模板
   */
  async importTemplate(templateJson) {
    try {
      const template = JSON.parse(templateJson);
      
      // 验证模板结构
      if (!template.name || !template.solution) {
        throw new Error('无效的模板格式');
      }

      // 生成新ID避免冲突
      template.id = uuidv4();
      template.metadata = {
        ...template.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      };

      this.templates.set(template.id, template);
      await this.saveTemplate(template);

      console.log(`📥 导入模板: ${template.name}`);
      return template;
    } catch (error) {
      throw new Error(`导入失败: ${error.message}`);
    }
  }

  /**
   * 保存模板到文件
   */
  async saveTemplate(template) {
    const filePath = path.join(this.storagePath, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8');
  }

  /**
   * 版本号递增
   */
  incrementVersion(version) {
    const parts = version.split('.');
    parts[2] = parseInt(parts[2]) + 1;
    return parts.join('.');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalTemplates: this.templates.size,
      publicTemplates: Array.from(this.templates.values()).filter(t => t.metadata.isPublic).length,
      categories: this.categories.size,
      totalUsage: Array.from(this.templates.values()).reduce((sum, t) => sum + t.metadata.usageCount, 0)
    };
  }

  /**
   * 创建预设模板
   */
  async createPresetTemplates() {
    const presets = [
      {
        name: '标准三室两厅舒适家居',
        description: '适用于120-150平米三室两厅户型的标准舒适家居方案',
        category: 'residential',
        tags: ['三室两厅', '标准', '热门'],
        solution: {
          painPoints: ['tag_01', 'tag_02', 'tag_11'],
          devices: [
            { id: 'dev_001', type: 'water_heater', model: 'Rheem EHD-50L', position: { x: 100, y: 200 } },
            { id: 'dev_002', type: 'air_conditioner', model: 'Ruud Achiever 3.5kW', position: { x: 300, y: 150 } }
          ],
          layout: { area: 130, rooms: 3, bathrooms: 2 },
          quotation: { total: 45800, discount: 0.9 }
        }
      },
      {
        name: '别墅全屋水系统',
        description: '适用于200平米以上别墅的全屋水系统解决方案',
        category: 'villa',
        tags: ['别墅', '全屋水系统', '高端'],
        solution: {
          painPoints: ['tag_01', 'tag_22', 'tag_33'],
          devices: [
            { id: 'dev_001', type: 'water_heater', model: 'Rheem EHD-80L', position: { x: 150, y: 300 } },
            { id: 'dev_002', type: 'water_softener', model: 'Rheem WS-30', position: { x: 200, y: 350 } }
          ],
          layout: { area: 250, rooms: 5, bathrooms: 3 },
          quotation: { total: 89000, discount: 0.85 }
        }
      }
    ];

    for (const preset of presets) {
      await this.createTemplate(preset);
    }

    console.log(`✅ 创建了 ${presets.length} 个预设模板`);
  }
}

// 导出单例
module.exports = TemplateEngine;
