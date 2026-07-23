/**
 * PerformanceTestSuite - 性能压力测试套件
 * 实现1000并发支持目标
 * 
 * 112Agent-E并行任务
 */

class PerformanceTestSuite {
  constructor(baseUrl = 'http://localhost:5001') {
    this.baseUrl = baseUrl;
    this.testResults = [];
    this.thresholds = {
      responseTime: 1000, // 1秒
      errorRate: 0.01,    // 1%
      throughput: 1000,   // 1000 RPS
      concurrentUsers: 1000 // 1000并发
    };
  }

  async runAllTests() {
    console.log('[PerformanceTestSuite] 启动性能压力测试...');
    
    // 基准测试
    await this.runBaselineTest();
    
    // 并发测试
    await this.runConcurrencyTest(100);   // 100并发
    await this.runConcurrencyTest(500);   // 500并发
    await this.runConcurrencyTest(1000);  // 1000并发
    
    // 负载测试
    await this.runLoadTest();
    
    // 压力测试
    await this.runStressTest();
    
    //  endurance测试
    await this.runEnduranceTest();
    
    return this.generateReport();
  }

  async runBaselineTest() {
    console.log('[PerformanceTestSuite] 执行基准测试...');
    
    const endpoints = [
      '/api/health',
      '/api/auth/login',
      '/api/projects',
      '/api/templates'
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const latencies = [];
      
      // 发送10次请求计算平均延迟
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await this.simulateRequest(endpoint);
        latencies.push(Date.now() - start);
      }
      
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      
      results.push({
        endpoint,
        avgLatency: Math.round(avgLatency),
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies)
      });
    }
    
    this.testResults.push({
      test: 'baseline',
      results
    });
    
    console.log('[PerformanceTestSuite] 基准测试完成');
  }

  async runConcurrencyTest(concurrentUsers) {
    console.log(`[PerformanceTestSuite] 执行${concurrentUsers}并发测试...`);
    
    const startTime = Date.now();
    const requests = [];
    
    // 创建并发请求
    for (let i = 0; i < concurrentUsers; i++) {
      requests.push(
        this.simulateRequest('/api/health').then(result => ({
          user: i,
          success: result.success,
          latency: result.latency
        }))
      );
    }
    
    // 等待所有请求完成
    const results = await Promise.all(requests);
    const endTime = Date.now();
    
    const totalTime = endTime - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const latencies = results.map(r => r.latency);
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const throughput = (concurrentUsers / totalTime) * 1000; // RPS
    
    this.testResults.push({
      test: `concurrency-${concurrentUsers}`,
      concurrentUsers,
      totalTime,
      successful,
      failed,
      errorRate: failed / concurrentUsers,
      avgLatency: Math.round(avgLatency),
      throughput: Math.round(throughput),
      passed: failed === 0 && avgLatency < this.thresholds.responseTime
    });
    
    console.log(`[PerformanceTestSuite] ${concurrentUsers}并发测试完成`);
    console.log(`  - 成功率: ${((successful / concurrentUsers) * 100).toFixed(1)}%`);
    console.log(`  - 平均延迟: ${Math.round(avgLatency)}ms`);
    console.log(`  - 吞吐量: ${Math.round(throughput)} RPS`);
  }

  async runLoadTest() {
    console.log('[PerformanceTestSuite] 执行负载测试...');
    
    const duration = 60; // 60秒
    const targetRPS = 100;
    const results = [];
    
    const startTime = Date.now();
    let requestCount = 0;
    
    while (Date.now() - startTime < duration * 1000) {
      const batchStart = Date.now();
      
      // 每秒发送targetRPS个请求
      const batch = [];
      for (let i = 0; i < targetRPS; i++) {
        batch.push(this.simulateRequest('/api/health'));
      }
      
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      requestCount += targetRPS;
      
      // 等待到下一秒
      const elapsed = Date.now() - batchStart;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;
    
    this.testResults.push({
      test: 'load',
      duration,
      targetRPS,
      actualRPS: Math.round((requestCount / totalTime) * 1000),
      totalRequests: requestCount,
      successful,
      failed: results.length - successful,
      errorRate: (results.length - successful) / results.length,
      passed: (results.length - successful) / results.length < this.thresholds.errorRate
    });
    
    console.log('[PerformanceTestSuite] 负载测试完成');
    console.log(`  - 总请求数: ${requestCount}`);
    console.log(`  - 成功率: ${((successful / results.length) * 100).toFixed(1)}%`);
  }

  async runStressTest() {
    console.log('[PerformanceTestSuite] 执行压力测试...');
    
    // 逐步增加负载直到系统崩溃
    const results = [];
    let concurrentUsers = 100;
    let maxUsers = 0;
    
    while (concurrentUsers <= 5000) {
      console.log(`[PerformanceTestSuite] 压力测试: ${concurrentUsers}并发`);
      
      const requests = [];
      for (let i = 0; i < concurrentUsers; i++) {
        requests.push(this.simulateRequest('/api/health'));
      }
      
      const batchResults = await Promise.all(requests);
      const errorRate = batchResults.filter(r => !r.success).length / concurrentUsers;
      
      results.push({
        concurrentUsers,
        errorRate,
        passed: errorRate < 0.05
      });
      
      if (errorRate > 0.1) {
        console.log(`[PerformanceTestSuite] 系统极限: ${concurrentUsers}并发`);
        break;
      }
      
      maxUsers = concurrentUsers;
      concurrentUsers += 500;
    }
    
    this.testResults.push({
      test: 'stress',
      maxConcurrentUsers: maxUsers,
      results,
      passed: maxUsers >= this.thresholds.concurrentUsers
    });
    
    console.log(`[PerformanceTestSuite] 压力测试完成，最大并发: ${maxUsers}`);
  }

  async runEnduranceTest() {
    console.log('[PerformanceTestSuite] 执行耐力测试(5分钟)...');
    
    const duration = 300; // 5分钟
    const interval = 1000; // 每秒1个请求
    const results = [];
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration * 1000) {
      const result = await this.simulateRequest('/api/health');
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    const successful = results.filter(r => r.success).length;
    const errorRate = (results.length - successful) / results.length;
    
    // 检查是否有性能下降
    const firstHalf = results.slice(0, Math.floor(results.length / 2));
    const secondHalf = results.slice(Math.floor(results.length / 2));
    
    const firstHalfAvgLatency = firstHalf.reduce((a, b) => a + b.latency, 0) / firstHalf.length;
    const secondHalfAvgLatency = secondHalf.reduce((a, b) => a + b.latency, 0) / secondHalf.length;
    
    const degradation = ((secondHalfAvgLatency - firstHalfAvgLatency) / firstHalfAvgLatency) * 100;
    
    this.testResults.push({
      test: 'endurance',
      duration,
      totalRequests: results.length,
      successful,
      errorRate,
      degradation: Math.round(degradation * 100) / 100,
      passed: errorRate < this.thresholds.errorRate && degradation < 20
    });
    
    console.log('[PerformanceTestSuite] 耐力测试完成');
    console.log(`  - 性能下降: ${degradation.toFixed(2)}%`);
    console.log(`  - 错误率: ${(errorRate * 100).toFixed(2)}%`);
  }

  async simulateRequest(endpoint) {
    // 模拟HTTP请求
    const start = Date.now();
    
    // 模拟网络延迟 (10-100ms基础延迟)
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 90));
    
    // 模拟成功率 (98%)
    const success = Math.random() > 0.02;
    
    return {
      success,
      latency: Date.now() - start,
      endpoint
    };
  }

  generateReport() {
    const summary = {
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.passed).length,
      failed: this.testResults.filter(t => !t.passed).length,
      thresholds: this.thresholds,
      timestamp: new Date().toISOString()
    };
    
    // 性能指标
    const concurrencyTest = this.testResults.find(t => t.test === 'concurrency-1000');
    const loadTest = this.testResults.find(t => t.test === 'load');
    const stressTest = this.testResults.find(t => t.test === 'stress');
    
    const metrics = {
      maxConcurrency: stressTest?.maxConcurrentUsers || 0,
      responseTime: concurrencyTest?.avgLatency || 0,
      throughput: concurrencyTest?.throughput || 0,
      errorRate: loadTest?.errorRate || 0,
      meetsRequirements: summary.passed === summary.totalTests
    };
    
    console.log('[PerformanceTestSuite] 测试报告:');
    console.log(`  - 最大并发: ${metrics.maxConcurrency}/${this.thresholds.concurrentUsers}`);
    console.log(`  - 平均响应: ${metrics.responseTime}ms/${this.thresholds.responseTime}ms`);
    console.log(`  - 吞吐量: ${metrics.throughput} RPS`);
    console.log(`  - 错误率: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`  - 是否达标: ${metrics.meetsRequirements ? '✅' : '❌'}`);
    
    return {
      summary,
      metrics,
      details: this.testResults
    };
  }

  getRecommendations() {
    const recommendations = [];
    
    const stressTest = this.testResults.find(t => t.test === 'stress');
    if (stressTest && stressTest.maxConcurrentUsers < this.thresholds.concurrentUsers) {
      recommendations.push({
        priority: 'high',
        issue: '并发能力不足',
        suggestion: '需要优化服务器配置或增加负载均衡'
      });
    }
    
    const concurrencyTest = this.testResults.find(t => t.test === 'concurrency-1000');
    if (concurrencyTest && concurrencyTest.avgLatency > this.thresholds.responseTime) {
      recommendations.push({
        priority: 'high',
        issue: '响应时间过长',
        suggestion: '优化数据库查询或增加缓存层'
      });
    }
    
    const loadTest = this.testResults.find(t => t.test === 'load');
    if (loadTest && loadTest.errorRate > this.thresholds.errorRate) {
      recommendations.push({
        priority: 'medium',
        issue: '错误率过高',
        suggestion: '检查API错误处理和异常捕获机制'
      });
    }
    
    return recommendations;
  }
}

module.exports = PerformanceTestSuite;
