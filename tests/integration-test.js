/**
 * 快速集成测试脚本 - 第4小时极限冲刺
 * 验证核心API和引擎功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_TIMEOUT = 5000;

// 测试配置
const testConfig = {
  houseType: '三居',
  area: 120,
  residents: 4,
  bathrooms: 2,
  city: '上海',
  rooms: [
    { name: '客厅', area: 30, type: 'livingRoom' },
    { name: '主卧', area: 20, type: 'bedroom' },
    { name: '次卧1', area: 15, type: 'bedroom' },
    { name: '次卧2', area: 12, type: 'bedroom' },
    { name: '厨房', area: 10, type: 'kitchen' },
    { name: '卫生间1', area: 6, type: 'bathroom' },
    { name: '卫生间2', area: 5, type: 'bathroom' }
  ]
};

class QuickIntegrationTest {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runAllTests() {
    console.log('🚀 启动快速集成测试...\n');
    const startTime = Date.now();

    // 1. 健康检查
    await this.testHealthCheck();

    // 2. 水路系统设计
    await this.testWaterSystem();

    // 3. 采暖系统设计
    await this.testHeatingSystem();

    // 4. 五恒系统设计
    await this.testFiveConstant();

    // 5. 新风专业设计
    await this.testFreshAirPro();

    // 6. DOAS设计
    await this.testDOAS();

    // 7. 空调系统设计
    await this.testAirConditioning();

    // 8. 综合暖通设计
    await this.testHVACComplete();

    const duration = Date.now() - startTime;
    this.printSummary(duration);
  }

  async testAPI(name, endpoint, payload, validator) {
    try {
      const response = await axios.post(`${BASE_URL}${endpoint}`, payload, {
        timeout: API_TIMEOUT
      });

      if (response.data.success) {
        const isValid = validator ? validator(response.data.data) : true;
        if (isValid) {
          this.passed++;
          this.results.push({ name, status: '✅ PASS', time: response.headers['x-response-time'] || 'N/A' });
          console.log(`✅ ${name} - 通过`);
          return true;
        } else {
          throw new Error('数据验证失败');
        }
      } else {
        throw new Error(response.data.error || 'API返回失败');
      }
    } catch (error) {
      this.failed++;
      this.results.push({ name, status: '❌ FAIL', error: error.message });
      console.log(`❌ ${name} - 失败: ${error.message}`);
      return false;
    }
  }

  async testHealthCheck() {
    try {
      const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 3000 });
      if (response.data.status === 'healthy') {
        this.passed++;
        console.log('✅ 服务健康检查 - 通过');
      } else {
        throw new Error('服务状态异常');
      }
    } catch (error) {
      this.failed++;
      console.log(`❌ 服务健康检查 - 失败: ${error.message}`);
    }
  }

  async testWaterSystem() {
    await this.testAPI(
      '水路系统设计',
      '/api/design/water-system',
      testConfig,
      (data) => data.systems && data.systems.coldWater && data.systems.hotWater
    );
  }

  async testHeatingSystem() {
    await this.testAPI(
      '采暖系统设计',
      '/api/design/heating-system',
      { ...testConfig, heatingType: '地暖', hasUnderfloor: true },
      (data) => data.systems && (data.systems.underfloor || data.systems.radiator)
    );
  }

  async testFiveConstant() {
    await this.testAPI(
      '五恒系统设计',
      '/api/design/five-constant',
      {
        ...testConfig,
        orientation: 'south',
        insulation: 'good',
        occupancy: 4,
        waterQuality: '中'
      },
      (data) => data.fiveConstants && data.systems && data.systems.radiation
    );
  }

  async testFreshAirPro() {
    await this.testAPI(
      '新风专业设计',
      '/api/design/fresh-air-pro',
      {
        area: 120,
        height: 2.8,
        occupancy: 4,
        rooms: testConfig.rooms,
        climateZone: '夏热冬冷',
        level: 'premium'
      },
      (data) => data.performance && data.design && data.design.ventilation
    );
  }

  async testDOAS() {
    await this.testAPI(
      'DOAS专用室外空气系统',
      '/api/design/doas',
      {
        area: 120,
        height: 2.8,
        occupancy: 4,
        rooms: testConfig.rooms,
        climateZone: '夏热冬冷',
        indoorCoolingSystem: '辐射供冷',
        indoorHeatingSystem: '辐射供暖',
        targetTemperature: 24,
        targetHumidity: 50
      },
      (data) => data.type === 'DOAS专用室外空气系统' && data.differentiation && data.parameters
    );
  }

  async testAirConditioning() {
    await this.testAPI(
      '空调系统设计',
      '/api/design/air-conditioning',
      {
        ...testConfig,
        acType: 'VRF',
        hasFreshAir: true
      },
      (data) => data.acSystem && data.loads
    );
  }

  async testHVACComplete() {
    await this.testAPI(
      '综合暖通设计',
      '/api/design/hvac-complete',
      {
        ...testConfig,
        water: { residents: 4, bathrooms: 2 },
        heating: { hasUnderfloor: true },
        ac: { acType: 'VRF' }
      },
      (data) => data.waterSystem && data.heatingSystem && data.airConditioning
    );
  }

  printSummary(duration) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 集成测试报告');
    console.log('='.repeat(50));
    console.log(`总测试数: ${this.passed + this.failed}`);
    console.log(`✅ 通过: ${this.passed}`);
    console.log(`❌ 失败: ${this.failed}`);
    console.log(`⏱️ 耗时: ${duration}ms`);
    console.log(`📈 通过率: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    if (this.failed === 0) {
      console.log('🎉 所有测试通过！系统ready for production');
    } else {
      console.log('⚠️ 有测试失败，需要修复');
    }

    // 保存测试报告
    const fs = require('fs');
    const report = {
      timestamp: new Date().toISOString(),
      duration,
      passed: this.passed,
      failed: this.failed,
      passRate: ((this.passed / (this.passed + this.failed)) * 100).toFixed(1),
      results: this.results
    };
    fs.writeFileSync('./test-report.json', JSON.stringify(report, null, 2));
  }
}

// 运行测试
if (require.main === module) {
  const tester = new QuickIntegrationTest();
  tester.runAllTests().catch(console.error);
}

module.exports = { QuickIntegrationTest };
