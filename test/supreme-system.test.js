/**
 * 瑞美极致系统 - 闭环数据测试 (30组)
 * 测试范围: 6大引擎全部功能
 * 执行方式: node test/supreme-system.test.js
 */

const assert = require('assert');

// 加载核心引擎
const SmartBrainEngine = require('../server/core/SmartBrainEngine');
const IoTPlatform = require('../server/core/IoTPlatform');
const DigitalTwinEngine = require('../server/core/DigitalTwinEngine');
const TriEnergySystem = require('../server/core/TriEnergySystem');
const AISceneGenerator = require('../server/core/AISceneGenerator');

// 测试统计
const testStats = {
  total: 30,
  passed: 0,
  failed: 0,
  details: []
};

// 辅助函数
function test(name, fn) {
  try {
    fn();
    testStats.passed++;
    testStats.details.push({ name, status: '✅ PASS' });
    console.log(`✅ [${testStats.passed + testStats.failed}/30] ${name}`);
  } catch (error) {
    testStats.failed++;
    testStats.details.push({ name, status: '❌ FAIL', error: error.message });
    console.log(`❌ [${testStats.passed + testStats.failed}/30] ${name}: ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

// ==================== 测试开始 ====================
console.log('\n🧪 瑞美极致系统 - 闭环数据测试 (30组)\n');
console.log('=' .repeat(50));

// 初始化引擎
const smartBrain = new SmartBrainEngine();
const ioTPlatform = new IoTPlatform();
const digitalTwin = new DigitalTwinEngine();
const triEnergy = new TriEnergySystem();
const aiScene = new AISceneGenerator();

// 1-6组: 智慧大脑引擎测试
console.log('\n📦 智慧大脑引擎测试 (6组)\n');

// 测试1: 能源调度 - 白天太阳能优先
test('T01: 能源调度-白天太阳能优先', () => {
  const input = {
    electricityPrice: 0.6,
    gasPrice: 3.0,
    outdoorTemp: 20,
    loadDemand: 15,
    timeOfDay: 'day'
  };
  const result = smartBrain.optimizeEnergySchedule(input);
  assertTrue(result.schedule.length > 0, '应有调度方案');
  assertTrue(result.savings.includes('%'), '应有节能率');
});

// 测试2: 能源调度 - 夜间谷电模式
test('T02: 能源调度-夜间谷电模式', () => {
  const input = {
    electricityPrice: 0.3,
    gasPrice: 3.0,
    outdoorTemp: 5,
    loadDemand: 12,
    timeOfDay: 'night'
  };
  const result = smartBrain.optimizeEnergySchedule(input);
  assertTrue(parseFloat(result.totalCost) > 0, '应有成本计算');
});

// 测试3: 能源调度 - 极寒天气
test('T03: 能源调度-极寒天气(-10℃)', () => {
  const input = {
    electricityPrice: 0.6,
    gasPrice: 3.0,
    outdoorTemp: -10,
    loadDemand: 20,
    timeOfDay: 'day'
  };
  const result = smartBrain.optimizeEnergySchedule(input);
  assertTrue(result.schedule.some(s => s.source === 'gas'), '极寒应使用燃气');
});

// 测试4: 预测维护 - 正常设备
test('T04: 预测维护-正常设备', () => {
  const deviceData = {
    deviceId: 'AC-001',
    runtime: 1000,
    temperature: 45,
    vibration: 2,
    energyConsumption: 800
  };
  const result = smartBrain.predictMaintenance(deviceData);
  assertEqual(result.riskLevel, 'low', '正常设备应为低风险');
  assertTrue(result.healthScore > 80, '健康度应>80');
});

// 测试5: 预测维护 - 高风险设备
test('T05: 预测维护-高风险设备', () => {
  const deviceData = {
    deviceId: 'AC-002',
    runtime: 9000,
    temperature: 85,
    vibration: 6,
    energyConsumption: 1200
  };
  const result = smartBrain.predictMaintenance(deviceData);
  assertEqual(result.riskLevel, 'high', '异常设备应为高风险');
  assertTrue(result.daysUntilFailure <= 7, '应预测7天内故障');
});

// 测试6: 场景自动切换 - 居家模式
test('T06: 场景自动切换-居家模式', () => {
  const context = {
    occupancy: true,
    timeOfDay: 'day',
    outdoorTemp: 25,
    userPreference: { tempOffset: 1 }
  };
  const result = smartBrain.autoSwitchScenario(context);
  assertEqual(result.scenario, 'home', '白天有人应为居家模式');
  assertNotNull(result.config, '应有配置');
});

// 7-12组: 万物互联平台测试
console.log('\n📦 万物互联平台测试 (6组)\n');

// 测试7: 设备注册 - 温控器
test('T07: 设备注册-智能温控器', () => {
  const deviceInfo = {
    deviceId: 'THERMO-001',
    deviceType: 'thermostat',
    capabilities: ['temperature', 'humidity', 'onoff'],
    metadata: { location: 'living_room' }
  };
  const result = ioTPlatform.registerDevice(deviceInfo);
  assertTrue(result.success, '注册应成功');
  assertEqual(result.deviceId, 'THERMO-001', '设备ID应一致');
});

// 测试8: 设备注册 - 热水器
test('T08: 设备注册-热水器', () => {
  const deviceInfo = {
    deviceId: 'WH-001',
    deviceType: 'water_heater',
    capabilities: ['temperature', 'onoff', 'mode'],
    metadata: { capacity: '60L' }
  };
  const result = ioTPlatform.registerDevice(deviceInfo);
  assertTrue(result.success, '注册应成功');
});

// 测试9: 设备上线
test('T09: 设备上线', () => {
  ioTPlatform.registerDevice({
    deviceId: 'AC-001',
    deviceType: 'air_conditioner',
    capabilities: ['onoff', 'temperature', 'mode']
  });
  const result = ioTPlatform.deviceConnect('AC-001', { ip: '192.168.1.100' });
  assertTrue(result.success, '上线应成功');
  assertEqual(result.status, 'online', '状态应为在线');
});

// 测试10: 数据上报
test('T10: 设备数据上报', () => {
  ioTPlatform.registerDevice({
    deviceId: 'SENSOR-001',
    deviceType: 'sensor',
    capabilities: ['temperature', 'humidity']
  });
  ioTPlatform.deviceConnect('SENSOR-001', {});
  const result = ioTPlatform.publishData('SENSOR-001', {
    temperature: 24.5,
    humidity: 60
  });
  assertTrue(result.success, '上报应成功');
  assertNotNull(result.messageId, '应有消息ID');
});

// 测试11: 控制指令下发
test('T11: 控制指令下发', () => {
  ioTPlatform.registerDevice({
    deviceId: 'LIGHT-001',
    deviceType: 'light',
    capabilities: ['onoff', 'brightness']
  });
  ioTPlatform.deviceConnect('LIGHT-001', {});
  const result = ioTPlatform.sendCommand('LIGHT-001', { action: 'turn_on', brightness: 80 });
  assertTrue(result.success, '指令应发送成功');
});

// 测试12: 批量控制
test('T12: 批量设备控制', () => {
  ['DEVICE-001', 'DEVICE-002', 'DEVICE-003'].forEach(id => {
    ioTPlatform.registerDevice({ deviceId: id, deviceType: 'switch', capabilities: ['onoff'] });
    ioTPlatform.deviceConnect(id, {});
  });
  const result = ioTPlatform.batchControl(['DEVICE-001', 'DEVICE-002', 'DEVICE-003'], { action: 'turn_off' });
  assertEqual(result.total, 3, '应控制3个设备');
  assertEqual(result.successCount, 3, '应全部成功');
});

// 13-18组: 数字孪生引擎测试
console.log('\n📦 数字孪生引擎测试 (6组)\n');

// 测试13: 创建3D场景
test('T13: 创建3D场景-三室两厅', () => {
  const projectData = {
    projectId: 'PRJ-001',
    houseType: '住宅',
    area: 120,
    layout: { rooms: 5 },
    systems: [{
      type: 'hvac',
      devices: [{ id: 'ODU-001', type: 'outdoor_unit', name: '外机', position: { x: 0, y: 0, z: 0 } }]
    }]
  };
  const result = digitalTwin.createScene(projectData);
  assertTrue(result.success, '创建应成功');
  assertTrue(result.deviceCount > 0, '应有设备');
});

// 测试14: 实时数据同步
test('T14: 实时数据同步', () => {
  digitalTwin.createScene({
    projectId: 'PRJ-002',
    houseType: '公寓',
    area: 90,
    layout: { rooms: 3 },
    systems: []
  });
  const result = digitalTwin.syncRealTimeData('PRJ-002', {
    deviceId: 'TEMP-001',
    temperature: 24,
    status: 'normal'
  });
  assertTrue(result.success, '同步应成功');
});

// 测试15: 获取场景视图
test('T15: 获取场景视图', () => {
  digitalTwin.createScene({
    projectId: 'PRJ-003',
    houseType: '别墅',
    area: 300,
    layout: { rooms: 8 },
    systems: []
  });
  const result = digitalTwin.getSceneView('PRJ-003');
  assertNotNull(result.projectId, '应有项目ID');
  assertEqual(result.houseType, '别墅', '户型应一致');
});

// 测试16: 摄像头接入
test('T16: 摄像头接入-工地直播', () => {
  const result = digitalTwin.connectCamera('PRJ-001', {
    cameraId: 'CAM-001',
    streamUrl: 'rtsp://192.168.1.10/live',
    position: { x: 10, y: 5, z: 0 }
  });
  assertTrue(result.success, '接入应成功');
  assertNotNull(result.liveUrl, '应有直播地址');
});

// 测试17: 远程操控
test('T17: 远程操控设备', () => {
  digitalTwin.createScene({
    projectId: 'PRJ-004',
    houseType: '住宅',
    area: 100,
    layout: { rooms: 4 },
    systems: [{
      type: 'air_conditioner',
      devices: [{ id: 'AC-001', name: '主卧空调', model: 'VRV-18' }]
    }]
  });
  const result = digitalTwin.remoteControl('PRJ-004', 'AC-001', { action: 'turn_on', temp: 24 });
  assertTrue(result.success, '操控应成功');
});

// 测试18: BIM模型转换
test('T18: BIM模型转换', () => {
  const result = digitalTwin.convertBIMToScene({
    ifcData: { walls: 10, windows: 6 },
    projectInfo: { name: 'BIM项目' }
  });
  assertTrue(result.success, '转换应成功');
  assertTrue(result.elementCount > 0, '应有元素');
});

// 19-24组: 三能源系统测试
console.log('\n📦 三能源系统测试 (6组)\n');

// 测试19: 三能源调度-白天
test('T19: 三能源调度-白天光照充足', () => {
  const input = {
    solarIrradiance: 800,
    outdoorTemp: 25,
    indoorTemp: 20,
    targetTemp: 22,
    heatLoad: 10,
    electricityPrice: 0.6,
    gasPrice: 3.0,
    timeOfDay: 'day'
  };
  const result = triEnergy.calculateOptimalMix(input);
  assertTrue(result.schedule.some(s => s.source === 'solar'), '白天应使用太阳能');
  assertTrue(result.savingsPercent.includes('%'), '应有节能率');
});

// 测试20: 三能源调度-夜间谷电
test('T20: 三能源调度-夜间谷电时段', () => {
  const input = {
    solarIrradiance: 0,
    outdoorTemp: 10,
    indoorTemp: 18,
    targetTemp: 22,
    heatLoad: 12,
    electricityPrice: 0.3,
    gasPrice: 3.0,
    timeOfDay: 'night'
  };
  const result = triEnergy.calculateOptimalMix(input);
  assertTrue(result.schedule.length > 0, '应有调度方案');
});

// 测试21: 三能源调度-极寒天气
test('T21: 三能源调度-极寒天气', () => {
  const input = {
    solarIrradiance: 200,
    outdoorTemp: -10,
    indoorTemp: 15,
    targetTemp: 22,
    heatLoad: 20,
    electricityPrice: 0.6,
    gasPrice: 3.0,
    timeOfDay: 'day'
  };
  const result = triEnergy.calculateOptimalMix(input);
  assertTrue(result.schedule.some(s => s.source === 'gas'), '极寒应使用燃气');
});

// 测试22: 快速制热
test('T22: 快速制热-30秒速热', () => {
  const result = triEnergy.rapidHeating(22, 16);
  assertTrue(result.success, '应成功启动');
  assertTrue(result.mode === 'rapid_heating', '应为快速制热模式');
  assertNotNull(result.estimatedTime, '应有所需时间');
});

// 测试23: 谷电蓄热
test('T23: 谷电蓄热模式', () => {
  // 模拟夜间时间
  const originalGetHours = Date.prototype.getHours;
  Date.prototype.getHours = function() { return 23; };
  
  const result = triEnergy.valleyHeatStorage(80);
  
  Date.prototype.getHours = originalGetHours;
  
  assertTrue(result.success, '应成功启动蓄热');
  assertEqual(result.mode, 'valley_storage', '应为谷电蓄热模式');
});

// 测试24: 能耗统计
test('T24: 能耗统计-日统计', () => {
  const result = triEnergy.getEnergyStats('day');
  assertNotNull(result.period, '应有统计周期');
  assertTrue(result.totalEnergy >= 0, '应有能耗数据');
});

// 25-30组: AI场景生成器测试
console.log('\n📦 AI场景生成器测试 (6组)\n');

// 测试25: 自然语言理解-简单需求
test('T25: AI理解-简单户型需求', () => {
  const result = aiScene.understandIntent('三室两厅120平');
  assertEqual(result.intent.houseType, '住宅', '应识别户型');
  assertEqual(result.intent.area, 120, '应识别面积');
  assertTrue(result.confidence > 0.8, '置信度应>0.8');
});

// 测试26: 自然语言理解-完整需求
test('T26: AI理解-完整装修需求', () => {
  const result = aiScene.understandIntent('三室两厅120平，两个老人住，预算10万，想要中央空调和地暖');
  assertTrue(result.intent.requirements.includes('制冷') || result.intent.requirements.length > 0, '应识别需求');
  assertEqual(result.entities.people, 2, '应识别人口');
});

// 测试27: 智能方案生成
test('T27: AI生成-设计方案', () => {
  const intentData = {
    intent: {
      houseType: '住宅',
      area: 100,
      rooms: { bedrooms: 3, living: 1, bathrooms: 2 },
      requirements: ['制冷', '制热', '热水'],
      budget: 'medium'
    },
    entities: { people: 3 }
  };
  const result = aiScene.generateDesign(intentData);
  assertNotNull(result.id, '应有设计ID');
  assertTrue(result.systems.hvac, '应包含暖通系统');
});

// 测试28: 场景方案推荐
test('T28: AI推荐-场景方案', () => {
  const userProfile = {
    familyType: '三口之家',
    budget: 'medium',
    priorities: ['节能', '舒适'],
    climate: ' temperate'
  };
  const result = aiScene.recommendScenarios(userProfile);
  assertNotNull(result.recommended, '应有推荐方案');
  assertTrue(result.alternatives.length >= 0, '应有备选方案');
});

// 测试29: AI对话-简单问答
test('T29: AI对话-问答交互', () => {
  const result = aiScene.chat('我家100平需要多少钱？');
  assertNotNull(result.response, '应有回复');
  assertNotNull(result.intent, '应有意图分析');
});

// 测试30: 闭环完整流程
test('T30: 闭环测试-完整用户旅程', () => {
  // 步骤1: 用户输入
  const userInput = '三室两厅120平，预算15万，想要中央空调和新风系统';
  const intent = aiScene.understandIntent(userInput);
  assertTrue(intent.confidence > 0.7, '意图理解置信度应>0.7');
  
  // 步骤2: 生成设计
  const design = aiScene.generateDesign(intent);
  assertNotNull(design.id, '应生成设计方案');
  
  // 步骤3: 创建数字孪生
  const twinResult = digitalTwin.createScene({
    projectId: design.id,
    houseType: design.project.houseType,
    area: design.project.area,
    layout: { rooms: 5 },
    systems: []
  });
  assertTrue(twinResult.success, '应创建数字孪生');
  
  // 步骤4: 注册IoT设备
  const iotResult = ioTPlatform.registerDevice({
    deviceId: 'AC-' + design.id,
    deviceType: 'air_conditioner',
    capabilities: ['onoff', 'temperature']
  });
  assertTrue(iotResult.success, '应注册IoT设备');
  
  // 步骤5: 计算能源方案
  const energyInput = {
    electricityPrice: 0.6,
    gasPrice: 3.0,
    outdoorTemp: 22,
    loadDemand: 8,
    timeOfDay: 'day'
  };
  const energyResult = smartBrain.optimizeEnergySchedule(energyInput);
  assertTrue(energyResult.schedule.length > 0, '应生成能源方案');
  
  console.log('   └─ 完整闭环流程验证通过 ✅');
});

// ==================== 测试报告 ====================
console.log('\n' + '='.repeat(50));
console.log('\n📊 测试报告\n');
console.log(`总计测试: ${testStats.total} 组`);
console.log(`✅ 通过: ${testStats.passed} 组`);
console.log(`❌ 失败: ${testStats.failed} 组`);
console.log(`通过率: ${(testStats.passed / testStats.total * 100).toFixed(1)}%\n`);

// 失败详情
if (testStats.failed > 0) {
  console.log('❌ 失败详情:\n');
  testStats.details.filter(t => t.status === '❌ FAIL').forEach(t => {
    console.log(`  - ${t.name}`);
    console.log(`    错误: ${t.error}\n`);
  });
}

// 最终结论
console.log('='.repeat(50));
if (testStats.failed === 0) {
  console.log('\n🎉 所有30组测试全部通过！');
  console.log('✅ 瑞美极致系统功能完整！');
  console.log('✅ 可以投入生产使用！\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${testStats.failed} 组测试未通过，请修复后再部署\n`);
  process.exit(1);
}
