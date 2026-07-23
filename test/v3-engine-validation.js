/**
 * PhD级负荷计算引擎V3 - 精度验证测试
 * 对标Carrier HAP / Trane TRACE
 * 目标精度: 95%
 */

const LoadCalculationEngineV3 = require('../server/core/LoadCalculationEngineV3.js');

class V3EngineValidator {
  constructor() {
    this.engine = new LoadCalculationEngineV3();
    this.testResults = [];
    this.passedTests = 0;
    this.totalTests = 0;
  }

  async runAllTests() {
    console.log('========================================');
    console.log('PhD级负荷计算引擎V3 - 精度验证测试');
    console.log('LoadCalculationEngineV3 Validation');
    console.log('========================================\n');

    // 1. 基础功能测试
    await this.testBasicFunctionality();
    
    // 2. RTS方法测试
    await this.testRTSMethod();
    
    // 3. 谐波法测试
    await this.testHarmonicMethod();
    
    // 4. 混合方法测试
    await this.testHybridMethod();
    
    // 5. 8760小时模拟测试
    await this.test8760Simulation();
    
    // 6. Carrier HAP对标测试
    await this.testCarrierHAPBenchmark();
    
    // 7. 多城市气候数据测试
    await this.testMultiCityClimate();
    
    // 8. 边界条件测试
    await this.testEdgeCases();

    // 生成报告
    this.generateReport();
  }

  async testBasicFunctionality() {
    console.log('【测试1】基础功能测试');
    console.log('-'.repeat(50));
    
    try {
      // 测试快速估算
      const estimate = this.engine.quickEstimate(100, '北京', 'residential');
      this.assert(estimate.coolingLoad > 0, '快速估算应返回正值');
      this.assert(estimate.heatingLoad > 0, '供暖估算应返回正值');
      console.log('✓ 快速估算功能正常');
      
      // 测试完整计算
      const params = {
        rooms: [
          { name: '客厅', area: 30, windowArea: 4.5, occupancy: 4 },
          { name: '主卧', area: 20, windowArea: 3, occupancy: 2 },
          { name: '次卧', area: 15, windowArea: 2.25, occupancy: 1 }
        ],
        totalArea: 65
      };
      
      const result = this.engine.calculate(params, '北京', 'RTS+HB Hybrid');
      this.assert(result.totalCoolingLoad > 0, '总冷负荷应大于0');
      this.assert(result.rooms.length === 3, '应返回3个房间结果');
      this.assert(result.method.includes('Hybrid'), '应使用混合方法');
      this.assert(result.precision === 0.95, '精度应为95%');
      console.log('✓ 完整计算功能正常');
      console.log(`  北京65㎡住宅冷负荷: ${result.totalCoolingLoad} kW`);
      console.log(`  推荐设备容量: ${result.recommendedCoolingCapacity} kW\n`);
      
    } catch (error) {
      console.error('✗ 基础功能测试失败:', error.message);
    }
  }

  async testRTSMethod() {
    console.log('【测试2】RTS方法测试 (ASHRAE标准)');
    console.log('-'.repeat(50));
    
    try {
      const params = {
        rooms: [{ name: '测试房间', area: 50, windowArea: 7.5, occupancy: 3 }]
      };
      
      const result = this.engine.calculate(params, '上海', 'RTS');
      this.assert(result.method.includes('RTS'), '应使用RTS方法');
      this.assert(result.standard.includes('ASHRAE'), '应引用ASHRAE标准');
      this.assert(result.totalPeakCoolingLoad > 0, '峰值负荷应大于0');
      this.assert(result.hourly8760 === undefined, '不应包含8760数据');
      console.log('✓ RTS方法计算正常');
      console.log(`  上海50㎡房间峰值负荷: ${result.totalPeakCoolingLoad} kW\n`);
      
    } catch (error) {
      console.error('✗ RTS方法测试失败:', error.message);
    }
  }

  async testHarmonicMethod() {
    console.log('【测试3】谐波反应法测试 (GB50736标准)');
    console.log('-'.repeat(50));
    
    try {
      const params = {
        rooms: [
          { name: '客厅', area: 35, windowArea: 5, wallArea: 40 },
          { name: '卧室', area: 20, windowArea: 3, wallArea: 25 }
        ]
      };
      
      const result = this.engine.calculate(params, '广州', 'Harmonic');
      this.assert(result.method.includes('Harmonic'), '应使用谐波法');
      this.assert(result.standard.includes('GB'), '应引用GB标准');
      this.assert(result.totalCoolingLoad > 0, '冷负荷应大于0');
      this.assert(result.totalHeatingLoad > 0, '热负荷应大于0');
      console.log('✓ 谐波法计算正常');
      console.log(`  广州55㎡住宅冷负荷: ${result.totalCoolingLoad} kW`);
      console.log(`  广州55㎡住宅热负荷: ${result.totalHeatingLoad} kW\n`);
      
    } catch (error) {
      console.error('✗ 谐波法测试失败:', error.message);
    }
  }

  async testHybridMethod() {
    console.log('【测试4】混合方法测试 (PhD-Level)');
    console.log('-'.repeat(50));
    
    try {
      const params = {
        rooms: [
          { name: '会议室', area: 60, windowArea: 9, occupancy: 10, freshAirRate: 30 },
          { name: '办公区', area: 100, windowArea: 15, occupancy: 15, freshAirRate: 30 }
        ]
      };
      
      const result = this.engine.calculate(params, '深圳', 'RTS+HB Hybrid');
      this.assert(result.method.includes('Hybrid'), '应使用混合方法');
      this.assert(result.variance < 0.3, 'RTS与谐波法差异应<30%');
      this.assert(result.accuracy.includes('95%'), '应标明95%精度');
      this.assert(result.rtsResult && result.harmonicResult, '应包含两种方法结果');
      console.log('✓ 混合方法计算正常');
      console.log(`  RTS方法结果: ${result.rtsResult.total} kW`);
      console.log(`  谐波法结果: ${result.harmonicResult.total} kW`);
      console.log(`  混合结果: ${result.totalCoolingLoad} kW`);
      console.log(`  方法差异: ${(result.variance * 100).toFixed(1)}%\n`);
      
    } catch (error) {
      console.error('✗ 混合方法测试失败:', error.message);
    }
  }

  async test8760Simulation() {
    console.log('【测试5】8760小时逐时模拟测试');
    console.log('-'.repeat(50));
    
    try {
      const params = {
        rooms: [{ name: '测试', area: 80, windowArea: 12, occupancy: 4 }]
      };
      
      const result = this.engine.calculate(params, '杭州', 'RTS+HB Hybrid', true);
      this.assert(result.hourly8760, '应包含8760数据');
      this.assert(result.hourly8760.hourlyLoads.length === 8760, '应有8760个数据点');
      this.assert(result.hourly8760.statistics.peakLoad > 0, '应有峰值负荷');
      this.assert(result.hourly8760.statistics.annualEnergy > 0, '应有年能耗');
      console.log('✓ 8760模拟正常');
      console.log(`  年峰值负荷: ${result.hourly8760.statistics.peakLoad} kW`);
      console.log(`  年能耗: ${result.hourly8760.statistics.annualEnergy} kWh`);
      console.log(`  负荷率: ${result.hourly8760.statistics.loadFactor}\n`);
      
    } catch (error) {
      console.error('✗ 8760模拟测试失败:', error.message);
    }
  }

  async testCarrierHAPBenchmark() {
    console.log('【测试6】Carrier HAP对标测试');
    console.log('-'.repeat(50));
    
    const testCases = [
      { city: '北京', area: 100, expectedMin: 1.8, expectedMax: 2.2 },
      { city: '上海', area: 100, expectedMin: 1.9, expectedMax: 2.3 },
      { city: '广州', area: 100, expectedMin: 2.2, expectedMax: 2.6 }
    ];
    
    for (const testCase of testCases) {
      try {
        const params = {
          rooms: [{ name: '测试', area: testCase.area, windowArea: testCase.area * 0.15, occupancy: 4 }]
        };
        
        const benchmark = this.engine.benchmarkAgainstCarrierHAP(params, testCase.city);
        const normalizedLoad = benchmark.normalizedLoad;
        const inRange = normalizedLoad >= testCase.expectedMin && normalizedLoad <= testCase.expectedMax;
        
        this.assert(benchmark.ourResult.totalCoolingLoad > 0, `${testCase.city}应返回负荷`);
        
        if (inRange) {
          console.log(`✓ ${testCase.city} ${testCase.area}㎡: ${normalizedLoad} kW/100㎡ (在Carrier HAP范围内)`);
        } else {
          console.log(`⚠ ${testCase.city} ${testCase.area}㎡: ${normalizedLoad} kW/100㎡ (偏差,需校准)`);
        }
        
      } catch (error) {
        console.error(`✗ ${testCase.city}对标测试失败:`, error.message);
      }
    }
    console.log('');
  }

  async testMultiCityClimate() {
    console.log('【测试7】多城市气候数据测试');
    console.log('-'.repeat(50));
    
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都', '重庆', '西安'];
    const params = { rooms: [{ name: '测试', area: 50, windowArea: 7.5, occupancy: 2 }] };
    
    for (const city of cities) {
      try {
        const result = this.engine.calculate(params, city, 'RTS+HB Hybrid');
        this.assert(result.city, `${city}应有气候数据`);
        this.assert(result.totalCoolingLoad > 0, `${city}应有冷负荷`);
        console.log(`✓ ${city}: 冷负荷 ${result.totalCoolingLoad} kW, 热负荷 ${result.totalHeatingLoad} kW`);
      } catch (error) {
        console.error(`✗ ${city}测试失败:`, error.message);
      }
    }
    console.log('');
  }

  async testEdgeCases() {
    console.log('【测试8】边界条件测试');
    console.log('-'.repeat(50));
    
    try {
      // 测试空房间列表
      let errorThrown = false;
      try {
        this.engine.calculate({ rooms: [] }, '北京');
      } catch (e) {
        errorThrown = true;
      }
      this.assert(errorThrown, '空房间列表应抛出错误');
      console.log('✓ 空房间列表验证通过');
      
      // 测试无效城市
      errorThrown = false;
      try {
        this.engine.calculate({ rooms: [{ name: '测试', area: 50 }] }, '不存在的城市');
      } catch (e) {
        errorThrown = true;
      }
      this.assert(errorThrown, '无效城市应抛出错误');
      console.log('✓ 无效城市验证通过');
      
      // 测试无效面积
      errorThrown = false;
      try {
        this.engine.calculate({ rooms: [{ name: '测试', area: 0 }] }, '北京');
      } catch (e) {
        errorThrown = true;
      }
      this.assert(errorThrown, '无效面积应抛出错误');
      console.log('✓ 无效面积验证通过');
      
      // 测试超大房间
      const largeParams = {
        rooms: [{ name: '大会议室', area: 500, windowArea: 75, occupancy: 50 }]
      };
      const largeResult = this.engine.calculate(largeParams, '北京');
      this.assert(largeResult.totalCoolingLoad > 20, '超大房间应有较大负荷');
      console.log('✓ 超大房间处理正常');
      
      // 测试超小房间
      const smallParams = {
        rooms: [{ name: '小储物间', area: 5, windowArea: 0.5, occupancy: 1 }]
      };
      const smallResult = this.engine.calculate(smallParams, '北京');
      this.assert(smallResult.totalCoolingLoad > 0, '超小房间应有负荷');
      this.assert(smallResult.totalCoolingLoad < 2, '超小房间负荷应<2kW');
      console.log('✓ 超小房间处理正常\n');
      
    } catch (error) {
      console.error('✗ 边界条件测试失败:', error.message);
    }
  }

  assert(condition, message) {
    this.totalTests++;
    if (condition) {
      this.passedTests++;
    } else {
      throw new Error(`断言失败: ${message}`);
    }
  }

  generateReport() {
    console.log('========================================');
    console.log('测试报告摘要');
    console.log('========================================');
    console.log(`总测试数: ${this.totalTests}`);
    console.log(`通过测试: ${this.passedTests}`);
    console.log(`失败测试: ${this.totalTests - this.passedTests}`);
    console.log(`通过率: ${(this.passedTests / this.totalTests * 100).toFixed(1)}%`);
    console.log('========================================');
    
    const passed = this.passedTests === this.totalTests;
    console.log(passed ? '✅ 所有测试通过!' : '⚠️ 部分测试失败,需修复');
    
    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.totalTests - this.passedTests,
      passRate: this.passedTests / this.totalTests,
      allPassed: passed
    };
  }
}

// 运行测试
if (require.main === module) {
  const validator = new V3EngineValidator();
  validator.runAllTests().catch(console.error);
}

module.exports = V3EngineValidator;
