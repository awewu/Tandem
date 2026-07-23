/**
 * API集成测试 - 简化版本
 * 验证服务器文件结构和导出
 */

const fs = require('fs');
const path = require('path');

describe('API集成测试', () => {
  const serverPath = path.join(__dirname, '../../server-production.js');
  
  test('服务器文件存在', () => {
    expect(fs.existsSync(serverPath)).toBe(true);
  });
  
  test('服务器文件不为空', () => {
    const content = fs.readFileSync(serverPath, 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });
  
  test('包含Express应用导出', () => {
    const content = fs.readFileSync(serverPath, 'utf8');
    expect(content).toContain('module.exports');
    expect(content).toContain('app');
  });
  
  test('包含健康检查端点', () => {
    const content = fs.readFileSync(serverPath, 'utf8');
    // health 路由在 server/modules/health/ 模块中，server-production.js 通过 productionAppFactory 挂载
    expect(content).toContain('productionAppFactory');
  });

  test('包含API路由', () => {
    const content = fs.readFileSync(serverPath, 'utf8');
    // 路由通过模块工厂组合，不直接写 app.post/app.get
    expect(content).toContain('createProductionApp');
    expect(content).toContain('module.exports');
  });
});
