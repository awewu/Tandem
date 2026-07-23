/**
 * 瑞美极致系统 - 全量自检工具
 * 功能: 检查所有文件、语法、依赖、配置问题
 * 执行: node test/system-audit.js
 */

const fs = require('fs');
const path = require('path');

const audit = {
  startTime: new Date().toISOString(),
  checks: [],
  issues: [],
  warnings: [],
  passed: 0,
  failed: 0
};

function check(name, fn) {
  try {
    fn();
    audit.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    audit.failed++;
    audit.issues.push({ check: name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

console.log('\n🔍 瑞美极致系统 - 全量自检\n');
console.log('='.repeat(70));

// ==================== 检查1: 核心引擎文件存在性 ====================
console.log('\n📦 检查1: 核心引擎文件存在性\n');

const coreFiles = [
  'server/core/SmartBrainEngine.js',
  'server/core/IoTPlatform.js',
  'server/core/DigitalTwinEngine.js',
  'server/core/TriEnergySystem.js',
  'server/core/AISceneGenerator.js',
  'server/core/ExportEngine.js',
  'server/core/AnalyticsEngine.js'
];

coreFiles.forEach(file => {
  check(`文件存在: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`文件不存在: ${fullPath}`);
    }
  });
});

// ==================== 检查2: 核心引擎语法检查 ====================
console.log('\n📦 检查2: 核心引擎语法检查\n');

coreFiles.forEach(file => {
  check(`语法检查: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // 检查基本语法
    if (!content.includes('class ') && !content.includes('function ') && !content.includes('module.exports')) {
      throw new Error('缺少类定义或模块导出');
    }
    
    // 检查是否有未闭合的括号
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      throw new Error(`花括号不匹配: ${openBraces}开 ${closeBraces}闭`);
    }
    
    // 检查模块导出
    if (!content.includes('module.exports')) {
      throw new Error('缺少module.exports导出');
    }
  });
});

// ==================== 检查3: 路由文件存在性 ====================
console.log('\n📦 检查3: 路由文件存在性\n');

const routeFiles = [
  'server/routes/supreme-api.js',
  'server/routes/exports.js',
  'server/index.js'
];

routeFiles.forEach(file => {
  check(`路由存在: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`路由文件不存在: ${file}`);
    }
  });
});

// ==================== 检查4: API路由注册检查 ====================
console.log('\n📦 检查4: API路由注册检查\n');

check('supreme-api路由导出', () => {
  const routePath = path.join(__dirname, '..', 'server/routes/supreme-api.js');
  const content = fs.readFileSync(routePath, 'utf8');
  
  if (!content.includes('module.exports = router')) {
    throw new Error('路由文件未导出router');
  }
  
  // 检查关键API端点
  const requiredEndpoints = [
    '/energy/optimize',
    '/maintenance/predict',
    '/iot/devices',
    '/twin/scenes',
    '/ai/understand'
  ];
  
  requiredEndpoints.forEach(endpoint => {
    if (!content.includes(endpoint)) {
      throw new Error(`缺少API端点: ${endpoint}`);
    }
  });
});

check('server.js路由注册', () => {
  const serverPath = path.join(__dirname, '..', 'server/index.js');
  const content = fs.readFileSync(serverPath, 'utf8');
  
  if (!content.includes('supremeRoutes')) {
    throw new Error('server/index.js未导入supremeRoutes');
  }
  
  if (!content.includes("app.use('/api/supreme'")) {
    throw new Error('server/index.js未注册/api/supreme路由');
  }
});

// ==================== 检查5: 商用模块检查 ====================
console.log('\n📦 检查5: 商用模块检查\n');

check('商用服务器文件存在', () => {
  const commercialPath = path.join(__dirname, '..', 'commercial-hvac-design/server.js');
  if (!fs.existsSync(commercialPath)) {
    throw new Error('commercial-hvac-design/server.js不存在');
  }
});

check('商用package.json配置', () => {
  const pkgPath = path.join(__dirname, '..', 'commercial-hvac-design/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  if (!pkg.scripts || !pkg.scripts.start) {
    throw new Error('package.json缺少start脚本');
  }
});

// ==================== 检查6: 测试文件检查 ====================
console.log('\n📦 检查6: 测试文件检查\n');

const testFiles = [
  'test/supreme-system.test.js',
  'test/supreme-comprehensive.test.js',
  'test/scenario-validator.js'
];

testFiles.forEach(file => {
  check(`测试文件: ${file}`, () => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`测试文件不存在: ${file}`);
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // 检查是否有require语句
    if (!content.includes('require(')) {
      throw new Error('测试文件缺少require语句');
    }
    
    // 检查路径是否正确 (test文件应该用 ../server/ 路径)
    if (file.includes('test/') && content.includes("require('./server/")) {
      throw new Error('测试文件require路径错误，应使用../server/');
    }
  });
});

// ==================== 检查7: 引擎类定义检查 ====================
console.log('\n📦 检查7: 引擎类定义检查\n');

check('SmartBrainEngine类定义', () => {
  const filePath = path.join(__dirname, '..', 'server/core/SmartBrainEngine.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('class SmartBrainEngine')) {
    throw new Error('未找到SmartBrainEngine类定义');
  }
  
  const requiredMethods = [
    'optimizeEnergySchedule',
    'predictMaintenance',
    'autoSwitchScenario'
  ];
  
  requiredMethods.forEach(method => {
    if (!content.includes(method)) {
      throw new Error(`缺少方法: ${method}`);
    }
  });
});

check('IoTPlatform类定义', () => {
  const filePath = path.join(__dirname, '..', 'server/core/IoTPlatform.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('class IoTPlatform')) {
    throw new Error('未找到IoTPlatform类定义');
  }
  
  if (!content.includes('registerDevice') || !content.includes('sendCommand')) {
    throw new Error('缺少关键方法');
  }
});

check('DigitalTwinEngine类定义', () => {
  const filePath = path.join(__dirname, '..', 'server/core/DigitalTwinEngine.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('class DigitalTwinEngine')) {
    throw new Error('未找到DigitalTwinEngine类定义');
  }
});

check('TriEnergySystem类定义', () => {
  const filePath = path.join(__dirname, '..', 'server/core/TriEnergySystem.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('class TriEnergySystem')) {
    throw new Error('未找到TriEnergySystem类定义');
  }
  
  if (!content.includes('calculateOptimalMix')) {
    throw new Error('缺少calculateOptimalMix方法');
  }
});

check('AISceneGenerator类定义', () => {
  const filePath = path.join(__dirname, '..', 'server/core/AISceneGenerator.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('class AISceneGenerator')) {
    throw new Error('未找到AISceneGenerator类定义');
  }
  
  if (!content.includes('understandIntent') || !content.includes('generateDesign')) {
    throw new Error('缺少关键方法');
  }
});

// ==================== 检查8: 依赖和导入检查 ====================
console.log('\n📦 检查8: 依赖和导入检查\n');

check('server/index.js依赖检查', () => {
  const serverPath = path.join(__dirname, '..', 'server/index.js');
  const content = fs.readFileSync(serverPath, 'utf8');
  
  // 检查核心依赖
  const requiredDeps = ['express', 'cors', 'helmet'];
  requiredDeps.forEach(dep => {
    if (!content.includes(`require('${dep}')`)) {
      throw new Error(`缺少依赖导入: ${dep}`);
    }
  });
});

check('路由文件依赖检查', () => {
  const routePath = path.join(__dirname, '..', 'server/routes/supreme-api.js');
  const content = fs.readFileSync(routePath, 'utf8');
  
  // 检查引擎导入
  const requiredEngines = [
    'SmartBrainEngine',
    'IoTPlatform',
    'DigitalTwinEngine',
    'TriEnergySystem',
    'AISceneGenerator'
  ];
  
  requiredEngines.forEach(engine => {
    if (!content.includes(engine)) {
      throw new Error(`缺少引擎导入: ${engine}`);
    }
  });
});

// ==================== 检查9: 构造函数和初始化检查 ====================
console.log('\n📦 检查9: 构造函数和初始化检查\n');

['SmartBrainEngine', 'IoTPlatform', 'DigitalTwinEngine', 'TriEnergySystem', 'AISceneGenerator'].forEach(className => {
  check(`${className}构造函数`, () => {
    const filePath = path.join(__dirname, '..', `server/core/${className}.js`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查constructor
    if (!content.includes('constructor(')) {
      throw new Error(`缺少constructor定义`);
    }
    
    // 检查initialize方法 (除了AISceneGenerator)
    if (className !== 'AISceneGenerator' && !content.includes('initialize()')) {
      throw new Error(`缺少initialize()方法`);
    }
  });
});

// ==================== 检查10: 运行时语法验证 ====================
console.log('\n📦 检查10: 运行时语法验证\n');

check('SmartBrainEngine可加载', () => {
  try {
    delete require.cache[require.resolve('../server/core/SmartBrainEngine')];
    const Engine = require('../server/core/SmartBrainEngine');
    const instance = new Engine();
    if (typeof instance.optimizeEnergySchedule !== 'function') {
      throw new Error('optimizeEnergySchedule方法不可用');
    }
  } catch (e) {
    throw new Error(`加载失败: ${e.message}`);
  }
});

check('IoTPlatform可加载', () => {
  try {
    delete require.cache[require.resolve('../server/core/IoTPlatform')];
    const Engine = require('../server/core/IoTPlatform');
    const instance = new Engine();
    if (typeof instance.registerDevice !== 'function') {
      throw new Error('registerDevice方法不可用');
    }
  } catch (e) {
    throw new Error(`加载失败: ${e.message}`);
  }
});

check('TriEnergySystem可加载', () => {
  try {
    delete require.cache[require.resolve('../server/core/TriEnergySystem')];
    const Engine = require('../server/core/TriEnergySystem');
    const instance = new Engine();
    if (typeof instance.calculateOptimalMix !== 'function') {
      throw new Error('calculateOptimalMix方法不可用');
    }
  } catch (e) {
    throw new Error(`加载失败: ${e.message}`);
  }
});

// ==================== 生成审计报告 ====================
console.log('\n' + '='.repeat(70));
console.log('\n📊 全量自检报告\n');
console.log(`总检查项: ${audit.passed + audit.failed}`);
console.log(`✅ 通过: ${audit.passed}`);
console.log(`❌ 失败: ${audit.failed}`);
console.log(`通过率: ${((audit.passed / (audit.passed + audit.failed)) * 100).toFixed(1)}%\n`);

// 问题详情
if (audit.issues.length > 0) {
  console.log('❌ 发现的问题:\n');
  audit.issues.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issue.check}`);
    console.log(`   错误: ${issue.error}\n`);
  });
}

// 修复建议
if (audit.failed > 0) {
  console.log('🔧 修复建议:\n');
  
  const suggestions = {
    '文件不存在': '请检查文件路径是否正确，重新创建缺失文件',
    '语法检查': '请检查文件语法错误，特别是括号匹配',
    '缺少module.exports': '请在文件末尾添加 module.exports = ClassName;',
    '路由注册': '请在server/index.js中导入并注册supremeRoutes',
    '缺少方法': '请检查类定义，确保所有必需方法已实现',
    '加载失败': '请检查require路径和语法错误'
  };
  
  Object.entries(suggestions).forEach(([key, value]) => {
    if (audit.issues.some(i => i.error.includes(key))) {
      console.log(`- ${value}`);
    }
  });
  console.log('');
}

// 保存报告
const reportPath = path.join(__dirname, 'system-audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  ...audit,
  endTime: new Date().toISOString(),
  summary: {
    status: audit.failed === 0 ? 'PASSED' : 'FAILED',
    recommendation: audit.failed === 0 
      ? '系统检查通过，可以运行测试' 
      : `请先修复${audit.failed}个问题，再运行测试`
  }
}, null, 2));

console.log('='.repeat(70));
console.log(`\n📄 详细报告: ${reportPath}\n`);

process.exit(audit.failed > 0 ? 1 : 0);
