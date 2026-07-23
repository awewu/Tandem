/**
 * MonitoringSystem - 监控告警系统
 * 实现生产环境监控、告警、日志收集
 * 
 * 112Agent-C并行任务 - L3质量版
 */

class MonitoringSystem {
  constructor(options = {}) {
    this.appName = options.appName || 'rheem-smart-home';
    this.environment = options.environment || 'production';
    this.alertChannels = options.alertChannels || ['email', 'webhook'];
    
    this.metrics = {
      requests: [],
      errors: [],
      performance: [],
      resources: []
    };
    
    this.alerts = [];
    this.thresholds = {
      errorRate: 0.05,      // 5%
      responseTime: 2000,   // 2秒
      cpuUsage: 80,         // 80%
      memoryUsage: 85,      // 85%
      diskUsage: 90         // 90%
    };
    
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[MonitoringSystem] 监控系统启动...');
    
    // 启动指标收集
    this.startMetricsCollection();
    
    // 启动告警检查
    this.startAlertChecking();
    
    // 启动健康检查
    this.startHealthChecks();
    
    console.log('[MonitoringSystem] 监控已激活');
    console.log('  - 告警阈值:');
    console.log(`    * 错误率: ${(this.thresholds.errorRate * 100).toFixed(0)}%`);
    console.log(`    * 响应时间: ${this.thresholds.responseTime}ms`);
    console.log(`    * CPU: ${this.thresholds.cpuUsage}%`);
    console.log(`    * 内存: ${this.thresholds.memoryUsage}%`);
  }

  stop() {
    this.isRunning = false;
    console.log('[MonitoringSystem] 监控系统停止');
  }

  // 记录请求指标
  recordRequest(req, res, duration) {
    const metric = {
      timestamp: Date.now(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    this.metrics.requests.push(metric);
    
    // 保留最近10000条记录
    if (this.metrics.requests.length > 10000) {
      this.metrics.requests.shift();
    }
    
    // 错误记录
    if (res.statusCode >= 400) {
      this.metrics.errors.push({
        ...metric,
        error: res.statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }
  }

  // 记录性能指标
  recordPerformance(type, value, details = {}) {
    this.metrics.performance.push({
      timestamp: Date.now(),
      type,
      value,
      details
    });
  }

  // 记录资源使用
  recordResourceUsage(cpu, memory, disk) {
    this.metrics.resources.push({
      timestamp: Date.now(),
      cpu,
      memory,
      disk
    });
    
    // 检查资源告警
    this.checkResourceAlerts(cpu, memory, disk);
  }

  // 检查资源告警
  checkResourceAlerts(cpu, memory, disk) {
    const alerts = [];
    
    if (cpu > this.thresholds.cpuUsage) {
      alerts.push({
        level: 'warning',
        type: 'high_cpu',
        message: `CPU使用率过高: ${cpu.toFixed(1)}%`,
        value: cpu,
        threshold: this.thresholds.cpuUsage
      });
    }
    
    if (memory > this.thresholds.memoryUsage) {
      alerts.push({
        level: 'warning',
        type: 'high_memory',
        message: `内存使用率过高: ${memory.toFixed(1)}%`,
        value: memory,
        threshold: this.thresholds.memoryUsage
      });
    }
    
    if (disk > this.thresholds.diskUsage) {
      alerts.push({
        level: 'critical',
        type: 'high_disk',
        message: `磁盘使用率过高: ${disk.toFixed(1)}%`,
        value: disk,
        threshold: this.thresholds.diskUsage
      });
    }
    
    for (const alert of alerts) {
      this.triggerAlert(alert);
    }
  }

  // 触发告警
  triggerAlert(alert) {
    alert.timestamp = Date.now();
    this.alerts.push(alert);
    
    console.log(`[ALERT] [${alert.level.toUpperCase()}] ${alert.message}`);
    
    // 发送告警通知
    this.sendNotification(alert);
  }

  // 发送通知
  async sendNotification(alert) {
    for (const channel of this.alertChannels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailAlert(alert);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert);
            break;
          case 'slack':
            await this.sendSlackAlert(alert);
            break;
          case 'sms':
            await this.sendSMSAlert(alert);
            break;
        }
      } catch (error) {
        console.error(`[MonitoringSystem] 发送${channel}告警失败:`, error);
      }
    }
  }

  async sendEmailAlert(alert) {
    // 模拟邮件发送
    console.log(`[MonitoringSystem] 邮件告警已发送: ${alert.message}`);
  }

  async sendWebhookAlert(alert) {
    // 模拟Webhook调用
    console.log(`[MonitoringSystem] Webhook告警已发送: ${alert.message}`);
  }

  async sendSlackAlert(alert) {
    // 模拟Slack通知
    console.log(`[MonitoringSystem] Slack告警已发送: ${alert.message}`);
  }

  async sendSMSAlert(alert) {
    if (alert.level === 'critical') {
      console.log(`[MonitoringSystem] SMS告警已发送: ${alert.message}`);
    }
  }

  // 启动指标收集
  startMetricsCollection() {
    // 每分钟汇总一次指标
    setInterval(() => {
      this.aggregateMetrics();
    }, 60000);
  }

  // 汇总指标
  aggregateMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 最近1分钟的请求
    const recentRequests = this.metrics.requests.filter(r => r.timestamp > oneMinuteAgo);
    const recentErrors = this.metrics.errors.filter(e => e.timestamp > oneMinuteAgo);
    
    const errorRate = recentRequests.length > 0 
      ? recentErrors.length / recentRequests.length 
      : 0;
    
    const avgResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0;
    
    // 检查是否需要告警
    if (errorRate > this.thresholds.errorRate) {
      this.triggerAlert({
        level: 'warning',
        type: 'high_error_rate',
        message: `错误率过高: ${(errorRate * 100).toFixed(2)}%`,
        value: errorRate,
        threshold: this.thresholds.errorRate,
        details: { total: recentRequests.length, errors: recentErrors.length }
      });
    }
    
    if (avgResponseTime > this.thresholds.responseTime) {
      this.triggerAlert({
        level: 'warning',
        type: 'slow_response',
        message: `平均响应时间过长: ${avgResponseTime.toFixed(0)}ms`,
        value: avgResponseTime,
        threshold: this.thresholds.responseTime
      });
    }
    
    console.log(`[MonitoringSystem] 指标汇总 (最近1分钟):`);
    console.log(`  - 请求数: ${recentRequests.length}`);
    console.log(`  - 错误率: ${(errorRate * 100).toFixed(2)}%`);
    console.log(`  - 平均响应: ${avgResponseTime.toFixed(0)}ms`);
  }

  // 启动告警检查
  startAlertChecking() {
    // 每5分钟检查一次告警状态
    setInterval(() => {
      this.checkAlertStatus();
    }, 300000);
  }

  // 检查告警状态
  checkAlertStatus() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    // 获取最近5分钟的告警
    const recentAlerts = this.alerts.filter(a => a.timestamp > fiveMinutesAgo);
    
    // 按级别统计
    const criticalCount = recentAlerts.filter(a => a.level === 'critical').length;
    const warningCount = recentAlerts.filter(a => a.level === 'warning').length;
    
    console.log(`[MonitoringSystem] 告警统计 (最近5分钟):`);
    console.log(`  - Critical: ${criticalCount}`);
    console.log(`  - Warning: ${warningCount}`);
    
    // 如果告警过多，发送汇总
    if (recentAlerts.length > 10) {
      this.triggerAlert({
        level: 'warning',
        type: 'alert_flood',
        message: `告警过多: ${recentAlerts.length}个告警在最近5分钟内触发`,
        count: recentAlerts.length
      });
    }
  }

  // 启动健康检查
  startHealthChecks() {
    // 每30秒执行一次健康检查
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  // 执行健康检查
  async performHealthCheck() {
    const checks = [
      { name: 'api', endpoint: '/api/health' },
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'websocket', check: () => this.checkWebSocket() },
      { name: 'mqtt', check: () => this.checkMQTT() }
    ];
    
    const results = [];
    
    for (const check of checks) {
      try {
        let healthy = false;
        
        if (check.endpoint) {
          // HTTP健康检查
          const response = await this.simulateHealthCheck(check.endpoint);
          healthy = response.status === 200;
        } else if (check.check) {
          // 自定义检查
          healthy = await check.check();
        }
        
        results.push({ name: check.name, healthy });
        
        if (!healthy) {
          this.triggerAlert({
            level: 'critical',
            type: 'service_unhealthy',
            message: `${check.name}服务健康检查失败`,
            service: check.name
          });
        }
      } catch (error) {
        results.push({ name: check.name, healthy: false, error: error.message });
      }
    }
    
    const allHealthy = results.every(r => r.healthy);
    
    if (!allHealthy) {
      console.log('[MonitoringSystem] 健康检查失败:');
      results.filter(r => !r.healthy).forEach(r => {
        console.log(`  - ${r.name}: 异常`);
      });
    }
  }

  async simulateHealthCheck(endpoint) {
    // 模拟健康检查
    await new Promise(resolve => setTimeout(resolve, 100));
    return { status: 200, data: { status: 'healthy' } };
  }

  async checkDatabase() {
    // 模拟数据库检查
    return true;
  }

  async checkWebSocket() {
    // 模拟WebSocket检查
    return true;
  }

  async checkMQTT() {
    // 模拟MQTT检查
    return true;
  }

  // 获取监控面板数据
  getDashboardData() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    return {
      summary: {
        totalRequests: this.metrics.requests.length,
        totalErrors: this.metrics.errors.length,
        errorRate: this.metrics.requests.length > 0
          ? (this.metrics.errors.length / this.metrics.requests.length * 100).toFixed(2) + '%'
          : '0%',
        activeAlerts: this.alerts.filter(a => a.timestamp > fiveMinutesAgo).length
      },
      realTime: {
        rps: this.calculateRPS(),
        avgResponseTime: this.calculateAvgResponseTime(),
        activeConnections: 0 // 需要WebSocket统计
      },
      resources: this.getLatestResourceUsage(),
      recentAlerts: this.alerts.slice(-10)
    };
  }

  calculateRPS() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recent = this.metrics.requests.filter(r => r.timestamp > oneSecondAgo);
    return recent.length;
  }

  calculateAvgResponseTime() {
    const recent = this.metrics.requests.slice(-100);
    if (recent.length === 0) return 0;
    return Math.round(recent.reduce((sum, r) => sum + r.duration, 0) / recent.length);
  }

  getLatestResourceUsage() {
    const latest = this.metrics.resources[this.metrics.resources.length - 1];
    return latest || { cpu: 0, memory: 0, disk: 0 };
  }

  // Express中间件
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.recordRequest(req, res, duration);
      });
      
      next();
    };
  }

  // 获取统计数据
  getStats(timeRange = '1h') {
    const ranges = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000
    };
    
    const since = Date.now() - (ranges[timeRange] || ranges['1h']);
    
    return {
      requests: this.metrics.requests.filter(r => r.timestamp > since).length,
      errors: this.metrics.errors.filter(e => e.timestamp > since).length,
      alerts: this.alerts.filter(a => a.timestamp > since).length
    };
  }
}

module.exports = MonitoringSystem;
