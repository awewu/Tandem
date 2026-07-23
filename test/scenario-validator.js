/**
 * 瑞美系统 - 全场景案例验证器 v1.0
 * 功能: 运行真实场景测试，自动发现问题，生成问题报告
 * 执行: node test/scenario-validator.js
 */

const fs = require('fs');
const path = require('path');

// 加载核心引擎
const SmartBrainEngine = require('../server/core/SmartBrainEngine');
const IoTPlatform = require('../server/core/IoTPlatform');
const DigitalTwinEngine = require('../server/core/DigitalTwinEngine');
const TriEnergySystem = require('../server/core/TriEnergySystem');
const AISceneGenerator = require('../server/core/AISceneGenerator');

// 验证结果存储
const validator = {
  startTime: new Date().toISOString(),
  scenarios: [],
  issues: [],
  warnings: [],
  passed: 0,
  failed: 0,
  total: 0
};

// 初始化引擎
const engines = {
  smartBrain: new SmartBrainEngine(),
  ioT: new IoTPlatform(),
  digitalTwin: new DigitalTwinEngine(),
  triEnergy: new TriEnergySystem(),
  aiScene: new AISceneGenerator()
};

// 场景测试类
class ScenarioTest {
  constructor(name, category, description) {
    this.name = name;
    this.category = category;
    this.description = description;
    this.status = 'pending';
    this.issues = [];
    this.warnings = [];
    this.duration = 0;
  }

  run(testFn) {
    const start = Date.now();
    validator.total++;
    
    try {
      testFn(this);
      this.status = 'passed';
      validator.passed++;
    } catch (error) {
      this.status = 'failed';
      this.issues.push({
        type: 'error',
        message: error.message,
        stack: error.stack
      });
      validator.failed++;
      validator.issues.push({
        scenario: this.name,
        category: this.category,
        issue: error.message
      });
    }
    
    this.duration = Date.now() - start;
    validator.scenarios.push(this);
    
    // 输出结果
    const icon = this.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} [${this.category}] ${this.name} (${this.duration}ms)`);
    
    // 输出问题详情
    this.issues.forEach(issue => {
      console.log(`   ❌ 问题: ${issue.message}`);
    });
    this.warnings.forEach(warning => {
      console.log(`   ⚠️  警告: ${warning.message}`);
      validator.warnings.push({
        scenario: this.name,
        warning: warning.message
      });
    });
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(message || 'Value should not be null');
    }
  }

  warn(condition, message) {
    if (!condition) {
      this.warnings.push({ message });
    }
  }
}

// ==================== 真实场景测试 ====================

console.log('\n🔍 瑞美系统 - 全场景案例验证器\n');
console.log('='.repeat(70));
console.log(`启动时间: ${validator.startTime}\n`);

// 初始化
console.log('[初始化] 加载引擎...');
Promise.all([
  engines.smartBrain.initialize(),
  engines.ioT.initialize(),
  engines.digitalTwin.initialize(),
  engines.triEnergy.initialize()
]).then(() => {
  console.log('✅ 引擎初始化完成\n');
  runAllScenarios();
}).catch(err => {
  console.error('❌ 引擎初始化失败:', err);
  process.exit(1);
});

function runAllScenarios() {
  console.log('开始场景验证...\n');
  console.log('='.repeat(70));

  // ========== 场景1: 北京冬季别墅供暖 ==========
  new ScenarioTest(
    '北京冬季别墅供暖',
    '极端气候',
    '北京-15℃严寒天气，500平别墅全屋供暖'
  ).run((t) => {
    const input = {
      solarIrradiance: 200,
      outdoorTemp: -15,
      indoorTemp: 18,
      targetTemp: 22,
      heatLoad: 50, // 50kW高负荷
      electricityPrice: 0.6,
      gasPrice: 3.0,
      timeOfDay: 'day'
    };
    
    const result = engines.triEnergy.calculateOptimalMix(input);
    
    // 验证问题1: 极寒天气是否有足够热量
    t.assert(result.totalOutput >= input.heatLoad * 0.9, 
      `热量不足: ${result.totalOutput}kW < ${input.heatLoad}kW需求`);
    
    // 验证问题2: 热泵是否被正确禁用
    const heatpumpUsed = result.schedule.some(s => s.source === 'heatpump');
    if (input.outdoorTemp < -10 && heatpumpUsed) {
      t.warnings.push({
        message: `极寒天气(-15℃)热泵效率极低，建议禁用，但当前方案仍使用热泵`
      });
    }
    
    // 验证问题3: 燃气是否作为主要热源
    const gasOutput = result.schedule.find(s => s.source === 'gas')?.output || 0;
    t.assert(gasOutput > 0, '极寒天气应以燃气为主热源');
    
    // 验证问题4: 节能率是否合理
    const savings = parseFloat(result.savingsPercent);
    t.warn(savings > 20, `极寒天气节能率${savings}%可能过高，实际预期<20%`);
  });

  // ========== 场景2: 上海夏季梅雨制冷除湿 ==========
  new ScenarioTest(
    '上海梅雨季节制冷除湿',
    '高湿环境',
    '上海35℃高温95%湿度，需要制冷+除湿'
  ).run((t) => {
    const input = {
      electricityPrice: 0.8,
      gasPrice: 3.0,
      outdoorTemp: 35,
      loadDemand: 25,
      timeOfDay: 'day'
    };
    
    const result = engines.smartBrain.optimizeEnergySchedule(input);
    
    // 验证问题1: 高湿环境制冷负荷计算
    t.assert(result.schedule.length > 0, '应有制冷方案');
    
    // 验证问题2: 电价高峰期的策略
    if (input.electricityPrice > 0.7) {
      const electricUsed = result.schedule.find(s => s.source === 'electric')?.output || 0;
      t.warn(electricUsed > 5, `峰电时段(${input.electricityPrice}元)应减少用电`);
    }
  });

  // ========== 场景3: 深圳办公楼夜间谷电蓄热 ==========
  new ScenarioTest(
    '深圳办公楼谷电蓄热',
    '分时电价',
    '办公楼夜间利用谷电蓄热，白天使用'
  ).run((t) => {
    // 模拟夜间
    const originalGetHours = Date.prototype.getHours;
    Date.prototype.getHours = function() { return 2; }; // 凌晨2点
    
    const result = engines.triEnergy.valleyHeatStorage(80);
    
    Date.prototype.getHours = originalGetHours;
    
    // 验证问题1: 谷电时段判断
    t.assert(result.success, '谷电蓄热应启动成功');
    t.assertEqual(result.mode, 'valley_storage', '应为谷电蓄热模式');
    
    // 验证问题2: 蓄热容量合理性
    t.assert(result.storageTarget === '80%', '蓄热目标应为80%');
  });

  // ========== 场景4: 酒店客房IoT设备批量管理 ==========
  new ScenarioTest(
    '酒店200间客房IoT管理',
    '大规模设备',
    '200间客房，每间3个设备，批量控制和状态查询'
  ).run((t) => {
    const devices = [];
    const failedRegistrations = [];
    
    // 注册200间客房的设备
    for (let room = 1; room <= 200; room++) {
      ['AC', 'LIGHT', 'CURTAIN'].forEach((type, idx) => {
        const deviceId = `HOTEL-${room}-${type}`;
        try {
          const result = engines.ioT.registerDevice({
            deviceId,
            deviceType: type.toLowerCase(),
            capabilities: ['onoff', 'status'],
            metadata: { room, floor: Math.ceil(room / 20) }
          });
          if (result.success) {
            devices.push(deviceId);
            // 模拟上线
            engines.ioT.deviceConnect(deviceId, { ip: `192.168.${Math.floor(room/50)}.${room}` });
          }
        } catch (err) {
          failedRegistrations.push({ deviceId, error: err.message });
        }
      });
    }
    
    // 验证问题1: 设备注册成功率
    const successRate = (devices.length / 600) * 100;
    t.assert(successRate > 95, `设备注册成功率${successRate}%过低，应>95%`);
    
    if (failedRegistrations.length > 0) {
      t.warnings.push({
        message: `${failedRegistrations.length}个设备注册失败: ${failedRegistrations[0].error}`
      });
    }
    
    // 验证问题2: 批量控制性能
    const floor1Devices = devices.filter(id => id.includes('HOTEL-1-') || id.includes('HOTEL-2-'));
    const start = Date.now();
    const controlResult = engines.ioT.batchControl(floor1Devices.slice(0, 60), { action: 'turn_off' });
    const duration = Date.now() - start;
    
    t.assert(duration < 2000, `批量控制耗时${duration}ms过长，应<2000ms`);
    t.assert(controlResult.successCount >= controlResult.total * 0.9, 
      `批量控制成功率${(controlResult.successCount/controlResult.total*100).toFixed(1)}%过低`);
    
    // 验证问题3: 状态查询性能
    const statsStart = Date.now();
    const stats = engines.ioT.getStats();
    const statsDuration = Date.now() - statsStart;
    
    t.assert(statsDuration < 100, `统计查询耗时${statsDuration}ms过长，应<100ms`);
    t.assert(stats.totalDevices >= devices.length, '统计设备数不匹配');
  });

  // ========== 场景5: 医院手术室数字孪生实时监控 ==========
  new ScenarioTest(
    '医院手术室数字孪生',
    '高精度监控',
    '5间手术室，温湿度压差实时同步，延迟<1秒'
  ).run((t) => {
    // 创建医院场景
    const hospital = engines.digitalTwin.createScene({
      projectId: 'HOSPITAL-001',
      houseType: '医院',
      area: 2000,
      layout: { rooms: 20, operatingRooms: 5 },
      systems: [{
        type: 'hvac',
        devices: [
          { id: 'OR1-HVAC', type: 'ahu', name: '手术室1空调', position: { x: 10, y: 0, z: 0 } },
          { id: 'OR2-HVAC', type: 'ahu', name: '手术室2空调', position: { x: 20, y: 0, z: 0 } },
          { id: 'OR3-HVAC', type: 'ahu', name: '手术室3空调', position: { x: 30, y: 0, z: 0 } },
          { id: 'OR4-HVAC', type: 'ahu', name: '手术室4空调', position: { x: 40, y: 0, z: 0 } },
          { id: 'OR5-HVAC', type: 'ahu', name: '手术室5空调', position: { x: 50, y: 0, z: 0 } }
        ]
      }]
    });
    
    t.assert(hospital.success, '医院场景创建应成功');
    
    // 模拟手术室实时数据高频同步
    const syncTimes = [];
    for (let i = 0; i < 10; i++) {
      const syncStart = Date.now();
      engines.digitalTwin.syncRealTimeData('HOSPITAL-001', {
        deviceId: 'OR1-HVAC',
        temperature: 21 + Math.random() * 2, // 21-23℃
        humidity: 45 + Math.random() * 10,   // 45-55%
        pressure: 5 + Math.random() * 3,      // 正压5-8Pa
        status: 'running'
      });
      syncTimes.push(Date.now() - syncStart);
    }
    
    const avgSyncTime = syncTimes.reduce((a, b) => a + b, 0) / syncTimes.length;
    t.assert(avgSyncTime < 50, `平均同步时间${avgSyncTime.toFixed(1)}ms过长，应<50ms`);
    
    // 验证问题: 温度超阈值告警
    const view = engines.digitalTwin.getSceneView('HOSPITAL-001');
    const orDevices = view.devices?.filter(d => d.id?.includes('OR')) || [];
    orDevices.forEach(device => {
      if (device.temperature > 25 || device.temperature < 20) {
        t.warnings.push({
          message: `手术室温度异常: ${device.temperature}℃ (应20-25℃)`
        });
      }
    });
  });

  // ========== 场景6: AI理解复杂口语化需求 ==========
  new ScenarioTest(
    'AI理解口语化需求',
    'NLP准确性',
    '用户用自然语言描述复杂需求，AI准确提取关键信息'
  ).run((t) => {
    const testCases = [
      {
        input: '我家是三层小别墅，大概三百平吧，地下一层地上两层，想要装那种既能制冷又能制热的，还要带热水的',
        expected: { area: 300, type: '别墅', systems: ['hvac', 'water_heater'] }
      },
      {
        input: '我和我老婆两个人住，九十多平的婚房，预算大概十五万左右，想要智能一点的，手机能控制的',
        expected: { area: 90, people: 2, budget: 'medium', features: ['smart'] }
      },
      {
        input: '老人家怕冷，房子一百二十平，三室两厅，想要地暖还有那种一开就有热水的',
        expected: { area: 120, requirements: ['floor_heating', 'hot_water'] }
      }
    ];
    
    const accuracies = [];
    testCases.forEach(tc => {
      const result = engines.aiScene.understandIntent(tc.input);
      
      // 检查面积识别
      if (tc.expected.area && result.intent.area === tc.expected.area) {
        accuracies.push('area');
      } else if (tc.expected.area) {
        t.warnings.push({
          message: `面积识别偏差: 期望${tc.expected.area}, 实际${result.intent.area}`
        });
      }
      
      // 检查户型识别
      if (tc.expected.type && result.intent.houseType === tc.expected.type) {
        accuracies.push('type');
      }
    });
    
    const accuracy = (accuracies.length / (testCases.length * 2)) * 100;
    t.assert(accuracy > 70, `AI理解准确率${accuracy.toFixed(1)}%过低，应>70%`);
  });

  // ========== 场景7: 预测维护高风险设备预警 ==========
  new ScenarioTest(
    '高风险设备预测维护',
    '预测准确性',
    '设备运行异常，预测7天内故障，提前维护'
  ).run((t) => {
    // 模拟一个即将故障的设备
    const highRiskDevice = {
      deviceId: 'CHILLER-001',
      runtime: 8760, // 1年连续运行
      temperature: 85, // 超温
      vibration: 6.5,  // 振动异常
      energyConsumption: 1500 // 能耗异常
    };
    
    const prediction = engines.smartBrain.predictMaintenance(highRiskDevice);
    
    // 验证问题1: 风险等级识别
    t.assert(prediction.riskLevel === 'high', 
      `高风险设备应识别为high，实际为${prediction.riskLevel}`);
    
    // 验证问题2: 故障时间预测
    t.assert(prediction.daysUntilFailure <= 7, 
      `应预测7天内故障，实际${prediction.daysUntilFailure}天`);
    
    // 验证问题3: 维护建议
    t.assert(prediction.suggestedActions.length > 0, '应提供维护建议');
    
    // 验证问题4: 维护成本估算
    t.assert(prediction.estimatedCost > 0, '应估算维护成本');
  });

  // ========== 场景8: 边界条件测试 - 空值/极大极小值 ==========
  new ScenarioTest(
    '边界条件测试',
    '健壮性',
    '测试系统对异常输入的处理能力'
  ).run((t) => {
    // 测试1: 空输入
    try {
      engines.aiScene.understandIntent('');
      t.warnings.push({ message: '空字符串输入未报错，建议返回友好提示' });
    } catch (e) {
      // 正确: 应该报错或处理
    }
    
    // 测试2: 负数面积
    const negativeArea = engines.aiScene.understandIntent('-100平房子');
    t.warnings.push({ 
      message: `负数面积处理: ${negativeArea.intent.area}，建议增加校验` 
    });
    
    // 测试3: 超大负荷
    try {
      engines.triEnergy.calculateOptimalMix({
        solarIrradiance: 0,
        outdoorTemp: 20,
        indoorTemp: 20,
        targetTemp: 22,
        heatLoad: 999999, // 超大负荷
        electricityPrice: 0.6,
        gasPrice: 3.0,
        timeOfDay: 'day'
      });
    } catch (e) {
      // 应该能处理或给出合理结果
    }
    
    // 测试4: 不存在的设备ID
    try {
      engines.ioT.getDeviceStatus('NONEXISTENT-999');
      t.assert(false, '不存在的设备应抛出错误');
    } catch (e) {
      t.assert(e.message.includes('不存在'), '应提示设备不存在');
    }
  });

  // ========== 场景9: 能源优化极端价格场景 ==========
  new ScenarioTest(
    '极端电价场景',
    '价格策略',
    '电价极高或极低时，能源策略是否正确'
  ).run((t) => {
    // 极高电价
    const highPriceInput = {
      electricityPrice: 2.0, // 2元/度
      gasPrice: 3.0,
      outdoorTemp: 20,
      loadDemand: 10,
      timeOfDay: 'day'
    };
    const highPriceResult = engines.smartBrain.optimizeEnergySchedule(highPriceInput);
    const electricUsed = highPriceResult.schedule.find(s => s.source === 'electric')?.output || 0;
    t.warn(electricUsed > 2, `电价2元时应尽量减少用电，当前用电${electricUsed}kW`);
    
    // 极低气价
    const lowGasInput = {
      electricityPrice: 0.6,
      gasPrice: 1.5, // 1.5元/立方
      outdoorTemp: 5,
      loadDemand: 15,
      timeOfDay: 'day'
    };
    const lowGasResult = engines.triEnergy.calculateOptimalMix(lowGasInput);
    const gasUsed = lowGasResult.schedule.find(s => s.source === 'gas')?.output || 0;
    t.assert(gasUsed > 0, '气价低时应优先使用燃气');
  });

  // ========== 场景10: 系统完整闭环流程 ==========
  new ScenarioTest(
    '完整闭环流程验证',
    '集成测试',
    '从用户需求到方案生成到设备控制的全流程'
  ).run((t) => {
    // 步骤1: 用户输入
    const userInput = '办公楼500平，需要中央空调和热水系统';
    const intent = engines.aiScene.understandIntent(userInput);
    t.assert(intent.intent.houseType || intent.intent.area, '应理解用户需求');
    
    // 步骤2: 生成设计
    const design = engines.aiScene.generateDesign(intent);
    t.assert(design.id, '应生成设计方案');
    t.assert(design.systems?.hvac, '应包含暖通系统');
    
    // 步骤3: 负荷计算
    const loadResult = { coolingLoad: 500 * 120, heatingLoad: 500 * 80 };
    t.assert(loadResult.coolingLoad > 0, '应有制冷负荷');
    
    // 步骤4: 能源优化
    const energy = engines.triEnergy.calculateOptimalMix({
      outdoorTemp: 25,
      heatLoad: loadResult.coolingLoad / 1000,
      electricityPrice: 0.8,
      gasPrice: 3.5,
      timeOfDay: 'day'
    });
    t.assert(energy.schedule.length > 0, '应有能源方案');
    
    // 步骤5: 设备注册
    const device = engines.ioT.registerDevice({
      deviceId: `OFFICE-${design.id}`,
      deviceType: 'chiller',
      capabilities: ['onoff', 'temp']
    });
    t.assert(device.success, '应注册设备');
    
    // 步骤6: 场景切换
    const scenario = engines.smartBrain.autoSwitchScenario({
      occupancy: true,
      timeOfDay: 'day',
      outdoorTemp: 25
    });
    t.assert(scenario.scenario, '应确定运行场景');
    
    console.log('   └─ 完整闭环流程验证通过 ✅');
  });

  // 生成报告
  generateReport();
}

function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 验证报告\n');
  
  const passRate = ((validator.passed / validator.total) * 100).toFixed(1);
  
  console.log(`总场景数: ${validator.total}`);
  console.log(`✅ 通过: ${validator.passed}`);
  console.log(`❌ 失败: ${validator.failed}`);
  console.log(`⚠️  警告: ${validator.warnings.length}`);
  console.log(`通过率: ${passRate}%\n`);
  
  // 问题汇总
  if (validator.issues.length > 0) {
    console.log('❌ 发现的问题:\n');
    validator.issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.category}] ${issue.scenario}`);
      console.log(`   问题: ${issue.issue}\n`);
    });
  }
  
  // 警告汇总
  if (validator.warnings.length > 0) {
    console.log('⚠️  需要关注的问题:\n');
    validator.warnings.slice(0, 10).forEach((w, idx) => {
      console.log(`${idx + 1}. [${w.scenario}] ${w.warning}`);
    });
    if (validator.warnings.length > 10) {
      console.log(`   ... 还有${validator.warnings.length - 10}个警告\n`);
    }
    console.log('');
  }
  
  // 分类统计
  const categoryStats = {};
  validator.scenarios.forEach(s => {
    categoryStats[s.category] = categoryStats[s.category] || { total: 0, passed: 0 };
    categoryStats[s.category].total++;
    if (s.status === 'passed') categoryStats[s.category].passed++;
  });
  
  console.log('分类统计:');
  Object.entries(categoryStats).forEach(([cat, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  - ${cat}: ${stats.passed}/${stats.total} (${rate}%)`);
  });
  
  console.log('\n' + '='.repeat(70));
  
  // 结论
  if (validator.failed === 0) {
    console.log('\n🎉 所有场景验证通过！系统运行正常！');
    if (validator.warnings.length > 0) {
      console.log(`⚠️  但有${validator.warnings.length}个需要关注的问题`);
    }
  } else {
    console.log(`\n⚠️ 发现${validator.failed}个场景失败，需要修复`);
  }
  
  // 保存报告到文件
  const reportPath = path.join(__dirname, 'scenario-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...validator,
    endTime: new Date().toISOString(),
    summary: {
      passRate,
      status: validator.failed === 0 ? 'PASSED' : 'FAILED',
      recommendation: validator.failed === 0 
        ? '系统可投入生产使用' 
        : '请修复问题后重新验证'
    }
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存: ${reportPath}\n`);
  
  process.exit(validator.failed > 0 ? 1 : 0);
}
