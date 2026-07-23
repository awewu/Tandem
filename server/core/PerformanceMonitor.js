/**
 * 6大系统性能监控引擎
 * 150人团队高并发性能追踪
 */

const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.sampleRate = options.sampleRate || 1.0; // 采样率
    this.maxMetrics = options.maxMetrics || 10000;
    
    // 指标存储
    this.metrics = {
      calculations: [],
      apis: [],
      errors: []
    };
    
    // 实时统计
    this.realtime = {
      totalRequests: 0,
      activeRequests: 0,
      avgResponseTime: 0,
      errorRate: 0
    };
    
    // 系统计数器
    this.systemCounters = {
      hotwater: { count: 0, totalTime: 0, errors: 0 },
      water: { count: 0, totalTime: 0, errors: 0 },
      freshair: { count: 0, totalTime: 0, errors: 0 },
      cooling: { count: 0, totalTime: 0, errors: 0 },
      doas: { count: 0, totalTime: 0, errors: 0 },
      heating: { count: 0, totalTime: 0, errors: 0 },
      control: { count: 0, totalTime: 0, errors: 0 }
    };
    
    this.startCleanupTimer();
  }
  
  /**
   * 记录计算性能
   */
  recordCalculation(system, startTime, success, error = null) {
    if (!this.enabled || Math.random() > this.sampleRate) return;
    
    const duration = Date.now() - startTime;
    const metric = {
      system,
      duration,
      success,
      error: error ? error.message : null,
      timestamp: new Date()
    };
    
    // 更新计数器
    const counter = this.systemCounters[system];
    if (counter) {
      counter.count++;
      counter.totalTime += duration;
      if (!success) counter.errors++;
    }
    
    // 存储指标
    this.metrics.calculations.push(metric);
    if (this.metrics.calculations.length > this.maxMetrics) {
      this.metrics.calculations.shift();
    }
    
    // 触发事件
    this.emit('calculation', metric);
    
    // 慢查询告警
    if (duration > 5000) {
      this.emit('slow', metric);
      console.warn(`[Performance] 慢计算告警: ${system} 耗时 ${duration}ms`);
    }
  }
  
  /**
   * 记录API请求
   */
  recordAPI(method, path, startTime, statusCode, error = null) {
    if (!this.enabled) return;
    
    const duration = Date.now() - startTime;
    const metric = {
      method,
      path,
      duration,
      statusCode,
      success: statusCode < 400,
      error: error ? error.message : null,
      timestamp: new Date()
    };
    
    this.metrics.apis.push(metric);
    if (this.metrics.apis.length > this.maxMetrics) {
      this.metrics.apis.shift();
    }
    
    // 更新实时统计
    this.realtime.totalRequests++;
    this.updateRealtimeStats(duration, statusCode >= 400);
    
    this.emit('api', metric);
  }
  
  /**
   * 记录错误
   */
  recordError(error, context = {}) {
    const metric = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    };
    
    this.metrics.errors.push(metric);
    if (this.metrics.errors.length > this.maxMetrics) {
      this.metrics.errors.shift();
    }
    
    this.emit('error', metric);
  }
  
  /**
   * 开始计算
   */
  startCalculation() {
    this.realtime.activeRequests++;
    return Date.now();
  }
  
  /**
   * 结束计算
   */
  endCalculation(system, startTime, success, error = null) {
    this.realtime.activeRequests--;
    this.recordCalculation(system, startTime, success, error);
  }
  
  /**
   * 更新实时统计
   */
  updateRealtimeStats(duration, isError) {
    // 移动平均
    const alpha = 0.1;
    this.realtime.avgResponseTime = 
      this.realtime.avgResponseTime * (1 - alpha) + duration * alpha;
    
    // 错误率
    if (this.realtime.totalRequests > 0) {
      const errorCount = this.metrics.errors.length;
      this.realtime.errorRate = (errorCount / this.realtime.totalRequests * 100).toFixed(2);
    }
  }
  
  /**
   * 获取系统统计
   */
  getSystemStats(system) {
    const counter = this.systemCounters[system];
    if (!counter || counter.count === 0) {
      return { count: 0, avgTime: 0, errorRate: 0 };
    }
    
    return {
      count: counter.count,
      avgTime: Math.round(counter.totalTime / counter.count),
      errorRate: (counter.errors / counter.count * 100).toFixed(2) + '%'
    };
  }
  
  /**
   * 获取所有统计
   */
  getAllStats() {
    const stats = {};
    Object.keys(this.systemCounters).forEach(system => {
      stats[system] = this.getSystemStats(system);
    });
    return stats;
  }
  
  /**
   * 获取性能报告
   */
  getReport(timeRange = 3600000) { // 默认1小时
    const cutoff = Date.now() - timeRange;
    
    const recentCalcs = this.metrics.calculations.filter(m => m.timestamp > cutoff);
    const recentApis = this.metrics.apis.filter(m => m.timestamp > cutoff);
    const recentErrors = this.metrics.errors.filter(m => m.timestamp > cutoff);
    
    const calcBySystem = {};
    recentCalcs.forEach(m => {
      if (!calcBySystem[m.system]) {
        calcBySystem[m.system] = { count: 0, totalTime: 0, errors: 0 };
      }
      calcBySystem[m.system].count++;
      calcBySystem[m.system].totalTime += m.duration;
      if (!m.success) calcBySystem[m.system].errors++;
    });
    
    // 计算百分位
    const durations = recentCalcs.map(m => m.duration).sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
    
    return {
      timeRange: `${timeRange / 1000}s`,
      calculations: {
        total: recentCalcs.length,
        success: recentCalcs.filter(m => m.success).length,
        failed: recentCalcs.filter(m => !m.success).length,
        bySystem: calcBySystem,
        percentiles: { p50, p95, p99 }
      },
      apis: {
        total: recentApis.length,
        avgResponseTime: recentApis.length > 0 
          ? Math.round(recentApis.reduce((a, m) => a + m.duration, 0) / recentApis.length)
          : 0
      },
      errors: {
        total: recentErrors.length,
        recent: recentErrors.slice(-5).map(e => ({
          message: e.message,
          time: e.timestamp
        }))
      },
      realtime: this.realtime,
      timestamp: new Date()
    };
  }
  
  /**
   * 性能中间件 (Express)
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        this.recordAPI(req.method, req.path, startTime, res.statusCode);
      });
      
      next();
    };
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    const report = this.getReport(60000); // 最近1分钟
    
    return {
      status: report.errors.total < 10 && report.apis.avgResponseTime < 5000 
        ? 'healthy' 
        : 'degraded',
      metrics: {
        activeRequests: this.realtime.activeRequests,
        avgResponseTime: report.apis.avgResponseTime,
        errorRate: this.realtime.errorRate
      }
    };
  }
  
  /**
   * 定时清理
   */
  startCleanupTimer() {
    setInterval(() => {
      // 保留最近24小时的数据
      const cutoff = Date.now() - 86400000;
      this.metrics.calculations = this.metrics.calculations.filter(
        m => m.timestamp > cutoff
      );
      this.metrics.apis = this.metrics.apis.filter(
        m => m.timestamp > cutoff
      );
      this.metrics.errors = this.metrics.errors.filter(
        m => m.timestamp > cutoff
      );
    }, 3600000); // 每小时清理
  }
  
  /**
   * 导出数据
   */
  exportData(format = 'json') {
    const data = {
      systemCounters: this.systemCounters,
      realtime: this.realtime,
      report: this.getReport()
    };
    
    if (format === 'csv') {
      // 转换为CSV
      let csv = 'system,count,avg_time,error_rate\n';
      Object.entries(this.systemCounters).forEach(([system, counter]) => {
        const avgTime = counter.count > 0 ? Math.round(counter.totalTime / counter.count) : 0;
        const errorRate = counter.count > 0 ? (counter.errors / counter.count * 100).toFixed(2) : 0;
        csv += `${system},${counter.count},${avgTime},${errorRate}\n`;
      });
      return csv;
    }
    
    return JSON.stringify(data, null, 2);
  }
}

module.exports = PerformanceMonitor;
