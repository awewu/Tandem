/**
 * 性能监控引擎
 * Performance Monitor Engine
 * 
 * 功能：
 * 1. API响应时间监控
 * 2. 引擎执行性能追踪
 * 3. 内存和CPU使用监控
 * 4. 性能瓶颈分析
 * 5. 自动优化建议
 */

class PerformanceMonitorEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'PerformanceMonitorEngine';
    
    // 性能指标存储
    this.metrics = {
      api: {},
      engines: {},
      system: {}
    };
    
    // 性能阈值
    this.thresholds = {
      api: {
        warning: 500,    // ms
        critical: 2000   // ms
      },
      engine: {
        warning: 1000,   // ms
        critical: 5000   // ms
      },
      memory: {
        warning: 512,    // MB
        critical: 1024    // MB
      }
    };
    
    // 历史数据
    this.history = [];
    this.maxHistorySize = 1000;
  }
  
  /**
   * 监控API性能
   */
  monitorAPI(endpoint, duration, statusCode, error = null) {
    const timestamp = new Date().toISOString();
    
    if (!this.metrics.api[endpoint]) {
      this.metrics.api[endpoint] = {
        calls: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0,
        lastCall: null
      };
    }
    
    const metric = this.metrics.api[endpoint];
    metric.calls++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.calls;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    if (error || statusCode >= 400) {
      metric.errors++;
    }
    
    metric.lastCall = timestamp;
    
    // 记录历史
    this.addToHistory({
      type: 'api',
      endpoint,
      duration,
      statusCode,
      timestamp,
      error: error ? error.message : null
    });
    
    // 检查性能阈值
    if (duration > this.thresholds.api.critical) {
      console.warn(`[PerformanceMonitor] API ${endpoint} 响应时间严重超标: ${duration}ms`);
    } else if (duration > this.thresholds.api.warning) {
      console.warn(`[PerformanceMonitor] API ${endpoint} 响应时间警告: ${duration}ms`);
    }
    
    return {
      endpoint,
      duration,
      status: duration > this.thresholds.api.critical ? 'critical' : 
              duration > this.thresholds.api.warning ? 'warning' : 'ok'
    };
  }
  
  /**
   * 监控引擎性能
   */
  monitorEngine(engineName, operation, duration, inputSize = null) {
    const timestamp = new Date().toISOString();
    
    if (!this.metrics.engines[engineName]) {
      this.metrics.engines[engineName] = {
        operations: {},
        totalCalls: 0,
        avgDuration: 0
      };
    }
    
    const engine = this.metrics.engines[engineName];
    
    if (!engine.operations[operation]) {
      engine.operations[operation] = {
        calls: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      };
    }
    
    const op = engine.operations[operation];
    op.calls++;
    op.totalDuration += duration;
    op.avgDuration = op.totalDuration / op.calls;
    op.minDuration = Math.min(op.minDuration, duration);
    op.maxDuration = Math.max(op.maxDuration, duration);
    
    engine.totalCalls++;
    
    // 重新计算引擎平均
    let totalDuration = 0;
    let totalCalls = 0;
    for (const opName in engine.operations) {
      totalDuration += engine.operations[opName].totalDuration;
      totalCalls += engine.operations[opName].calls;
    }
    engine.avgDuration = totalDuration / totalCalls;
    
    // 记录历史
    this.addToHistory({
      type: 'engine',
      engineName,
      operation,
      duration,
      inputSize,
      timestamp
    });
    
    // 检查阈值
    if (duration > this.thresholds.engine.critical) {
      console.warn(`[PerformanceMonitor] 引擎 ${engineName}.${operation} 执行时间严重超标: ${duration}ms`);
    }
    
    return {
      engine: engineName,
      operation,
      duration,
      status: duration > this.thresholds.engine.critical ? 'critical' : 
              duration > this.thresholds.engine.warning ? 'warning' : 'ok'
    };
  }
  
  /**
   * 监控系统资源
   */
  monitorSystemResources() {
    const usage = process.memoryUsage();
    const timestamp = new Date().toISOString();
    
    const memoryMB = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
    
    this.metrics.system = {
      memory: memoryMB,
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp
    };
    
    // 检查内存阈值
    if (memoryMB.heapUsed > this.thresholds.memory.critical) {
      console.warn(`[PerformanceMonitor] 内存使用严重超标: ${memoryMB.heapUsed}MB`);
    } else if (memoryMB.heapUsed > this.thresholds.memory.warning) {
      console.warn(`[PerformanceMonitor] 内存使用警告: ${memoryMB.heapUsed}MB`);
    }
    
    return this.metrics.system;
  }
  
  /**
   * 添加历史记录
   */
  addToHistory(record) {
    this.history.push(record);
    
    // 限制历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
  
  /**
   * 获取性能报告
   */
  getPerformanceReport(timeRange = '1h') {
    const now = new Date();
    let cutoff;
    
    switch (timeRange) {
      case '1h':
        cutoff = new Date(now - 60 * 60 * 1000);
        break;
      case '24h':
        cutoff = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(now - 60 * 60 * 1000);
    }
    
    // 过滤历史数据
    const filteredHistory = this.history.filter(h => new Date(h.timestamp) >= cutoff);
    
    // 分析性能瓶颈
    const bottlenecks = this.identifyBottlenecks(filteredHistory);
    
    // 生成优化建议
    const recommendations = this.generateRecommendations(bottlenecks);
    
    return {
      timestamp: now.toISOString(),
      timeRange,
      summary: {
        totalApiCalls: Object.values(this.metrics.api).reduce((sum, m) => sum + m.calls, 0),
        totalEngineCalls: Object.values(this.metrics.engines).reduce((sum, e) => sum + e.totalCalls, 0),
        avgApiResponseTime: this.calculateAverageApiTime(),
        avgEngineExecutionTime: this.calculateAverageEngineTime(),
        errorRate: this.calculateErrorRate()
      },
      apiMetrics: this.metrics.api,
      engineMetrics: this.metrics.engines,
      systemMetrics: this.metrics.system,
      bottlenecks,
      recommendations
    };
  }
  
  /**
   * 识别性能瓶颈
   */
  identifyBottlenecks(history) {
    const bottlenecks = {
      slowAPIs: [],
      slowEngines: [],
      errorProne: [],
      memoryIssues: []
    };
    
    // 分析API
    for (const [endpoint, metric] of Object.entries(this.metrics.api)) {
      if (metric.avgDuration > this.thresholds.api.warning) {
        bottlenecks.slowAPIs.push({
          type: 'api',
          name: endpoint,
          avgDuration: Math.round(metric.avgDuration),
          calls: metric.calls,
          severity: metric.avgDuration > this.thresholds.api.critical ? 'critical' : 'warning'
        });
      }
      
      if (metric.errors > 0 && metric.errors / metric.calls > 0.1) {
        bottlenecks.errorProne.push({
          type: 'api',
          name: endpoint,
          errorRate: (metric.errors / metric.calls * 100).toFixed(1) + '%',
          totalErrors: metric.errors
        });
      }
    }
    
    // 分析引擎
    for (const [engineName, engine] of Object.entries(this.metrics.engines)) {
      for (const [operation, op] of Object.entries(engine.operations)) {
        if (op.avgDuration > this.thresholds.engine.warning) {
          bottlenecks.slowEngines.push({
            type: 'engine',
            name: `${engineName}.${operation}`,
            avgDuration: Math.round(op.avgDuration),
            calls: op.calls,
            severity: op.avgDuration > this.thresholds.engine.critical ? 'critical' : 'warning'
          });
        }
      }
    }
    
    // 按严重程度排序
    bottlenecks.slowAPIs.sort((a, b) => b.avgDuration - a.avgDuration);
    bottlenecks.slowEngines.sort((a, b) => b.avgDuration - a.avgDuration);
    
    return bottlenecks;
  }
  
  /**
   * 生成优化建议
   */
  generateRecommendations(bottlenecks) {
    const recommendations = [];
    
    // API优化建议
    for (const api of bottlenecks.slowAPIs) {
      recommendations.push({
        priority: api.severity === 'critical' ? 'P0' : 'P1',
        category: 'API性能',
        target: api.name,
        issue: `平均响应时间 ${api.avgDuration}ms 超出阈值`,
        suggestions: [
          '添加Redis缓存',
          '优化数据库查询',
          '启用连接池',
          '考虑异步处理'
        ]
      });
    }
    
    // 引擎优化建议
    for (const engine of bottlenecks.slowEngines) {
      recommendations.push({
        priority: engine.severity === 'critical' ? 'P0' : 'P1',
        category: '引擎性能',
        target: engine.name,
        issue: `平均执行时间 ${engine.avgDuration}ms 超出阈值`,
        suggestions: [
          '优化算法复杂度',
          '添加计算缓存',
          '使用Web Worker',
          '分解复杂计算'
        ]
      });
    }
    
    // 错误率优化
    for (const item of bottlenecks.errorProne) {
      recommendations.push({
        priority: 'P0',
        category: '稳定性',
        target: item.name,
        issue: `错误率 ${item.errorRate}`,
        suggestions: [
          '添加错误重试机制',
          '改进输入验证',
          '增加异常处理',
          '完善日志记录'
        ]
      });
    }
    
    // 通用建议
    recommendations.push({
      priority: 'P2',
      category: '系统优化',
      target: '整体系统',
      issue: '性能监控持续优化',
      suggestions: [
        '启用Gzip压缩',
        '配置CDN加速',
        '启用HTTP/2',
        '优化静态资源'
      ]
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * 计算平均API响应时间
   */
  calculateAverageApiTime() {
    let totalDuration = 0;
    let totalCalls = 0;
    
    for (const metric of Object.values(this.metrics.api)) {
      totalDuration += metric.totalDuration;
      totalCalls += metric.calls;
    }
    
    return totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  }
  
  /**
   * 计算平均引擎执行时间
   */
  calculateAverageEngineTime() {
    let totalDuration = 0;
    let totalCalls = 0;
    
    for (const engine of Object.values(this.metrics.engines)) {
      for (const op of Object.values(engine.operations)) {
        totalDuration += op.totalDuration;
        totalCalls += op.calls;
      }
    }
    
    return totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  }
  
  /**
   * 计算错误率
   */
  calculateErrorRate() {
    let totalErrors = 0;
    let totalCalls = 0;
    
    for (const metric of Object.values(this.metrics.api)) {
      totalErrors += metric.errors;
      totalCalls += metric.calls;
    }
    
    return totalCalls > 0 ? (totalErrors / totalCalls * 100).toFixed(2) + '%' : '0%';
  }
  
  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics = {
      api: {},
      engines: {},
      system: {}
    };
    this.history = [];
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      metrics: {
        apiEndpoints: Object.keys(this.metrics.api).length,
        engines: Object.keys(this.metrics.engines).length,
        historySize: this.history.length
      },
      systemHealth: this.metrics.system,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = PerformanceMonitorEngine;
