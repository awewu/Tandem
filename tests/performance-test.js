/**
 * 性能测试脚本 - API压力测试
 * 测试并发性能和响应时间
 */

const http = require('http');

const CONFIG = {
  host: 'localhost',
  port: 3000,
  concurrency: 10,
  requestsPerEndpoint: 50,
  endpoints: [
    { path: '/api/health', method: 'GET' },
    { path: '/api/design/water-system', method: 'POST', body: { houseType: '三居', area: 120, residents: 4 } },
    { path: '/api/design/heating-system', method: 'POST', body: { houseType: '三居', area: 120, city: '上海', hasUnderfloor: true } },
    { path: '/api/design/doas', method: 'POST', body: { area: 120, climateZone: '夏热冬冷' } }
  ]
};

class PerformanceTester {
  constructor() {
    this.results = [];
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const data = endpoint.body ? JSON.stringify(endpoint.body) : null;
      
      const options = {
        host: CONFIG.host,
        port: CONFIG.port,
        path: endpoint.path,
        method: endpoint.method,
        headers: endpoint.body ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        } : {}
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          const duration = Date.now() - startTime;
          resolve({
            status: res.statusCode,
            duration,
            success: res.statusCode === 200
          });
        });
      });

      req.on('error', (err) => {
        reject({ error: err.message, duration: Date.now() - startTime });
      });

      req.on('timeout', () => {
        req.destroy();
        reject({ error: 'Timeout', duration: Date.now() - startTime });
      });

      if (data) req.write(data);
      req.end();
    });
  }

  async testEndpoint(endpoint) {
    console.log(`\n🔄 测试 ${endpoint.path} - ${CONFIG.requestsPerEndpoint}请求 x ${CONFIG.concurrency}并发`);
    
    const results = [];
    for (let i = 0; i < CONFIG.requestsPerEndpoint; i++) {
      const batch = Array(CONFIG.concurrency).fill().map(() => this.makeRequest(endpoint));
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
      process.stdout.write(`  进度: ${i + 1}/${CONFIG.requestsPerEndpoint}\r`);
    }
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const durations = successful.map(r => r.value.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    
    const result = {
      endpoint: endpoint.path,
      total: results.length,
      success: successful.length,
      failed: results.length - successful.length,
      avgDuration: Math.round(avgDuration),
      minDuration,
      maxDuration,
      rps: Math.round(1000 / avgDuration * CONFIG.concurrency)
    };
    
    this.results.push(result);
    
    console.log(`  ✅ 成功: ${result.success}/${result.total} | ⏱️ 平均: ${result.avgDuration}ms | 🚀 RPS: ${result.rps}`);
    return result;
  }

  async runAll() {
    console.log('🚀 启动API性能压力测试');
    console.log(`📊 配置: ${CONFIG.concurrency}并发 x ${CONFIG.requestsPerEndpoint}轮 = ${CONFIG.concurrency * CONFIG.requestsPerEndpoint}请求/端点`);
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    for (const endpoint of CONFIG.endpoints) {
      await this.testEndpoint(endpoint);
    }
    
    const totalTime = Date.now() - startTime;
    this.printSummary(totalTime);
  }

  printSummary(totalTime) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 性能测试汇总报告');
    console.log('='.repeat(60));
    
    const totalRequests = this.results.reduce((sum, r) => sum + r.total, 0);
    const totalSuccess = this.results.reduce((sum, r) => sum + r.success, 0);
    const avgDuration = Math.round(this.results.reduce((sum, r) => sum + r.avgDuration, 0) / this.results.length);
    const totalRPS = this.results.reduce((sum, r) => sum + r.rps, 0);
    
    console.log(`总请求数: ${totalRequests}`);
    console.log(`成功率: ${(totalSuccess/totalRequests*100).toFixed(1)}%`);
    console.log(`平均响应: ${avgDuration}ms`);
    console.log(`总RPS: ${totalRPS}`);
    console.log(`总耗时: ${(totalTime/1000).toFixed(1)}s`);
    
    console.log('\n各端点详情:');
    this.results.forEach(r => {
      const status = r.avgDuration < 200 ? '✅ 优秀' : r.avgDuration < 500 ? '⚠️ 一般' : '❌ 需优化';
      console.log(`  ${r.endpoint}: ${r.avgDuration}ms ${status}`);
    });
    
    console.log('\n' + '='.repeat(60));
    
    // 性能评级
    const allGood = this.results.every(r => r.avgDuration < 200 && r.success/r.total > 0.95);
    if (allGood) {
      console.log('🏆 性能评级: 优秀 (所有API响应<200ms,成功率>95%)');
    } else {
      console.log('⚠️ 性能评级: 部分API需要优化');
    }
  }
}

const tester = new PerformanceTester();
tester.runAll().catch(console.error);
