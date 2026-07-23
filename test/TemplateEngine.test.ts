/**
 * TemplateEngine 单元测试
 * 测试覆盖率目标: 80%+
 */

import TemplateEngine from '../server/engines/TemplateEngine';

describe('TemplateEngine', () => {
  let engine: any;

  beforeEach(async () => {
    // 创建新实例进行测试
    engine = new (TemplateEngine as any).constructor();
  });

  afterEach(async () => {
    // 清理
    if (engine.templates) {
      engine.templates.clear();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', async () => {
      const result = await engine.initialize();
      expect(result).toBe(true);
      expect(engine.initialized).toBe(true);
    });

    test('应该加载模板库', async () => {
      await engine.initialize();
      expect(engine.templates.size).toBeGreaterThan(0);
    });
  });

  describe('模板管理', () => {
    test('应该包含预设模板', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
    });

    test('模板应该包含必要字段', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      expect(firstTemplate).toHaveProperty('id');
      expect(firstTemplate).toHaveProperty('name');
      expect(firstTemplate).toHaveProperty('description');
      expect(firstTemplate).toHaveProperty('category');
      expect(firstTemplate).toHaveProperty('products');
    });

    test('应该按类别筛选模板', async () => {
      await engine.initialize();
      const waterTemplates = engine.getTemplatesByCategory('water');
      
      expect(Array.isArray(waterTemplates)).toBe(true);
      waterTemplates.forEach((template: any) => {
        expect(template.category).toBe('water');
      });
    });

    test('应该按ID获取模板', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      const template = engine.getTemplateById(firstTemplate.id);
      expect(template).toBeDefined();
      expect(template.id).toBe(firstTemplate.id);
    });

    test('获取不存在的模板应该返回null', async () => {
      await engine.initialize();
      const template = engine.getTemplateById('nonexistent-id');
      
      expect(template).toBeNull();
    });
  });

  describe('模板应用', () => {
    test('应该成功应用模板', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      const result = engine.applyTemplate(firstTemplate.id, {
        area: 120,
        floors: 2,
        bathrooms: 2
      });
      
      expect(result.success).toBe(true);
      expect(result.solution).toBeDefined();
    });

    test('应用不存在的模板应该失败', async () => {
      await engine.initialize();
      
      const result = engine.applyTemplate('nonexistent-id', {
        area: 120,
        floors: 2,
        bathrooms: 2
      });
      
      expect(result.success).toBe(false);
    });

    test('应用模板应该生成解决方案', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      const result = engine.applyTemplate(firstTemplate.id, {
        area: 120,
        floors: 2,
        bathrooms: 2
      });
      
      expect(result.solution).toHaveProperty('products');
      expect(result.solution).toHaveProperty('totalPrice');
      expect(result.solution).toHaveProperty('estimatedInstallTime');
    });
  });

  describe('模板验证', () => {
    test('应该验证模板数据', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      
      templates.forEach((template: any) => {
        const isValid = engine.validateTemplate(template);
        expect(isValid).toBe(true);
      });
    });

    test('缺少必要字段的模板应该无效', async () => {
      const invalidTemplate = {
        name: 'Test Template'
        // 缺少id, description, category, products
      };
      
      const isValid = engine.validateTemplate(invalidTemplate);
      expect(isValid).toBe(false);
    });

    test('空产品列表的模板应该无效', async () => {
      const invalidTemplate = {
        id: 'test-001',
        name: 'Test Template',
        description: 'Test',
        category: 'water',
        products: [] // 空产品列表
      };
      
      const isValid = engine.validateTemplate(invalidTemplate);
      expect(isValid).toBe(false);
    });
  });

  describe('模板创建', () => {
    test('应该成功创建新模板', async () => {
      await engine.initialize();
      
      const newTemplate = {
        id: 'custom-001',
        name: '自定义模板',
        description: '用户自定义模板',
        category: 'water',
        products: [
          { id: 'prod-001', name: '热水器', quantity: 1, price: 5000 }
        ]
      };
      
      const result = engine.createTemplate(newTemplate);
      expect(result.success).toBe(true);
    });

    test('创建重复ID的模板应该失败', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      const duplicateTemplate = {
        id: firstTemplate.id,
        name: '重复模板',
        description: '重复ID',
        category: 'water',
        products: [
          { id: 'prod-001', name: '热水器', quantity: 1, price: 5000 }
        ]
      };
      
      const result = engine.createTemplate(duplicateTemplate);
      expect(result.success).toBe(false);
    });

    test('创建无效模板应该失败', async () => {
      await engine.initialize();
      
      const invalidTemplate = {
        name: '无效模板'
        // 缺少必要字段
      };
      
      const result = engine.createTemplate(invalidTemplate);
      expect(result.success).toBe(false);
    });
  });

  describe('模板更新', () => {
    test('应该成功更新模板', async () => {
      await engine.initialize();
      const templates = engine.getAllTemplates();
      const firstTemplate = templates[0];
      
      const updatedData = {
        name: '更新后的模板名称',
        description: '更新后的描述'
      };
      
      const result = engine.updateTemplate(firstTemplate.id, updatedData);
      expect(result.success).toBe(true);
    });

    test('更新不存在的模板应该失败', async () => {
      await engine.initialize();
      
      const result = engine.updateTemplate('nonexistent-id', {
        name: '更新'
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('模板删除', () => {
    test('应该成功删除模板', async () => {
      await engine.initialize();
      
      const newTemplate = {
        id: 'to-delete-001',
        name: '待删除模板',
        description: '将被删除',
        category: 'water',
        products: [
          { id: 'prod-001', name: '热水器', quantity: 1, price: 5000 }
        ]
      };
      
      engine.createTemplate(newTemplate);
      const result = engine.deleteTemplate('to-delete-001');
      expect(result.success).toBe(true);
    });

    test('删除不存在的模板应该失败', async () => {
      await engine.initialize();
      
      const result = engine.deleteTemplate('nonexistent-id');
      expect(result.success).toBe(false);
    });
  });

  describe('模板搜索', () => {
    test('应该按名称搜索模板', async () => {
      await engine.initialize();
      
      const results = engine.searchTemplates('热水器');
      expect(Array.isArray(results)).toBe(true);
    });

    test('应该按类别搜索模板', async () => {
      await engine.initialize();
      
      const results = engine.searchTemplates('', 'water');
      expect(Array.isArray(results)).toBe(true);
      results.forEach((template: any) => {
        expect(template.category).toBe('water');
      });
    });

    test('空搜索应该返回所有模板', async () => {
      await engine.initialize();
      
      const allTemplates = engine.getAllTemplates();
      const searchResults = engine.searchTemplates('');
      
      expect(searchResults.length).toBe(allTemplates.length);
    });
  });

  describe('系统状态', () => {
    test('应该返回系统状态', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('templateCount');
      expect(status).toHaveProperty('categoryCount');
      expect(status).toHaveProperty('timestamp');
    });

    test('系统状态应该反映初始化状态', async () => {
      await engine.initialize();
      const status = engine.getSystemStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.templateCount).toBeGreaterThan(0);
    });
  });
});
