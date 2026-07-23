/**
 * 瑞美舒适家居系统 - 心跳监控机制 (Heartbeat Monitoring)
 * 用于监控所有Agent和服务的状态
 * 
 * 功能：
 * 1. 服务健康检查 - 定期ping各服务节点
 * 2. Agent状态监控 - 检测Agent是否存活
 * 3. 自动故障恢复 - 检测到故障时自动重启
 * 4. 告警通知 - 异常情况及时通知
 */

class HeartbeatMonitor {
  constructor(config = {}) {
    this.config = {
      interval: config.interval || 5000,        // 心跳检测间隔(毫秒)
      timeout: config.timeout || 10000,        // 超时时间
      retryAttempts: config.retryAttempts || 3, // 重试次数
      autoRecover: config.autoRecover !== false, // 自动恢复
      ...config
    };
    
    this.services = new Map();    // 注册的服务
    this.agents = new Map();      // 注册的Agent
    this.heartbeatHistory = [];   // 心跳历史记录
    this.isRunning = false;
    this.intervalId = null;
    
    // 告警回调
    this.alertCallbacks = [];
  }

  /**
   * 注册服务
   */
  registerService(id, service) {
    this.services.set(id, {
      id,
      name: service.name || id,
      endpoint: service.endpoint,
      type: service.type || 'http',
      status: 'unknown',
      lastHeartbeat: null,
      failureCount: 0,
      config: service
    });
    console.log(`[Heartbeat] 服务已注册: ${id}`);
  }

  /**
   * 注册Agent
   */
  registerAgent(id, agent) {
    this.agents.set(id, {
      id,
      name: agent.name || id,
      role: agent.role,
      pid: agent.pid,  // 进程ID
      status: 'unknown',
      lastHeartbeat: null,
      failureCount: 0,
      tasksCompleted: 0,
      tasksFailed: 0
    });
    console.log(`[Heartbeat] Agent已注册: ${id} (${agent.role})`);
  }

  /**
   * 发送心跳
   */
  async sendHeartbeat(targetId, targetType = 'service') {
    const target = targetType === 'service' 
      ? this.services.get(targetId)
      : this.agents.get(targetId);

    if (!target) {
      console.error(`[Heartbeat] 目标不存在: ${targetId}`);
      return { success: false, error: 'Target not found' };
    }

    const startTime = Date.now();
    
    try {
      let result;
      
      if (targetType === 'service') {
        // HTTP服务心跳检测
        result = await this.pingHTTPService(target);
      } else {
        // Agent进程心跳检测
        result = await this.pingAgent(target);
      }

      const responseTime = Date.now() - startTime;
      
      // 更新状态
      if (result.success) {
        target.status = 'healthy';
        target.failureCount = 0;
        target.lastHeartbeat = new Date().toISOString();
        target.responseTime = responseTime;
      } else {
        target.failureCount++;
        if (target.failureCount >= this.config.retryAttempts) {
          target.status = 'unhealthy';
          this.triggerAlert('service_down', target);
          
          // 自动恢复
          if (this.config.autoRecover) {
            await this.attemptRecovery(targetId, targetType);
          }
        } else {
          target.status = 'degraded';
        }
      }

      // 记录历史
      this.heartbeatHistory.push({
        timestamp: new Date().toISOString(),
        targetId,
        targetType,
        status: target.status,
        responseTime,
        success: result.success
      });

      // 限制历史记录数量
      if (this.heartbeatHistory.length > 1000) {
        this.heartbeatHistory = this.heartbeatHistory.slice(-500);
      }

      return { success: result.success, responseTime, status: target.status };

    } catch (error) {
      target.failureCount++;
      target.status = 'error';
      target.lastError = error.message;
      
      console.error(`[Heartbeat] 心跳检测失败: ${targetId}`, error.message);
      
      if (target.failureCount >= this.config.retryAttempts) {
        this.triggerAlert('heartbeat_error', { targetId, error: error.message });
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Ping HTTP服务
   */
  async pingHTTPService(service) {
    // 模拟HTTP请求
    return new Promise((resolve) => {
      const http = require('http');
      
      const req = http.get(service.endpoint + '/api/health', (res) => {
        resolve({ 
          success: res.statusCode === 200,
          statusCode: res.statusCode 
        });
      });
      
      req.on('error', () => {
        resolve({ success: false });
      });
      
      req.setTimeout(this.config.timeout, () => {
        req.destroy();
        resolve({ success: false, timeout: true });
      });
    });
  }

  /**
   * Ping Agent进程
   */
  async pingAgent(agent) {
    // 检查进程是否存在
    return new Promise((resolve) => {
      if (!agent.pid) {
        resolve({ success: false, error: 'No PID' });
        return;
      }

      try {
        // 在Windows上使用tasklist检查进程
        const { exec } = require('child_process');
        exec(`tasklist /FI "PID eq ${agent.pid}"`, (error, stdout) => {
          if (error || !stdout.includes(agent.pid.toString())) {
            resolve({ success: false, error: 'Process not found' });
          } else {
            resolve({ success: true });
          }
        });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  /**
   * 尝试自动恢复
   */
  async attemptRecovery(targetId, targetType) {
    console.log(`[Heartbeat] 尝试恢复: ${targetId}`);
    
    const target = targetType === 'service' 
      ? this.services.get(targetId)
      : this.agents.get(targetId);

    if (!target) return;

    // 模拟恢复操作
    try {
      // 1. 尝试重启服务
      if (targetType === 'service' && target.config.restartCommand) {
        const { exec } = require('child_process');
        exec(target.config.restartCommand);
        console.log(`[Heartbeat] 已发送重启命令: ${targetId}`);
      }
      
      // 2. 等待恢复
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 3. 验证恢复
      const checkResult = await this.sendHeartbeat(targetId, targetType);
      
      if (checkResult.success) {
        console.log(`[Heartbeat] 恢复成功: ${targetId}`);
        this.triggerAlert('recovery_success', { targetId, targetType });
      } else {
        console.error(`[Heartbeat] 恢复失败: ${targetId}`);
        this.triggerAlert('recovery_failed', { targetId, targetType });
      }
    } catch (error) {
      console.error(`[Heartbeat] 恢复过程出错: ${targetId}`, error);
    }
  }

  /**
   * 启动心跳监控
   */
  start() {
    if (this.isRunning) {
      console.log('[Heartbeat] 监控已在运行');
      return;
    }

    this.isRunning = true;
    console.log(`[Heartbeat] 启动监控，间隔: ${this.config.interval}ms`);

    this.intervalId = setInterval(async () => {
      // 检查所有服务
      for (const [id] of this.services) {
        await this.sendHeartbeat(id, 'service');
      }
      
      // 检查所有Agent
      for (const [id] of this.agents) {
        await this.sendHeartbeat(id, 'agent');
      }
      
      // 打印状态摘要
      this.printStatusSummary();
    }, this.config.interval);
  }

  /**
   * 停止心跳监控
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Heartbeat] 监控已停止');
  }

  /**
   * 打印状态摘要
   */
  printStatusSummary() {
    const healthy = Array.from(this.services.values()).filter(s => s.status === 'healthy').length;
    const unhealthy = Array.from(this.services.values()).filter(s => s.status === 'unhealthy').length;
    const agentHealthy = Array.from(this.agents.values()).filter(a => a.status === 'healthy').length;
    
    console.log(`[Heartbeat] 状态: 服务 ${healthy}/${this.services.size} 健康, Agent ${agentHealthy}/${this.agents.size} 健康`);
  }

  /**
   * 获取状态报告
   */
  getStatusReport() {
    return {
      timestamp: new Date().toISOString(),
      isRunning: this.isRunning,
      services: Array.from(this.services.values()).map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        lastHeartbeat: s.lastHeartbeat,
        responseTime: s.responseTime,
        failureCount: s.failureCount
      })),
      agents: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        lastHeartbeat: a.lastHeartbeat,
        tasksCompleted: a.tasksCompleted,
        tasksFailed: a.tasksFailed
      })),
      summary: {
        totalServices: this.services.size,
        healthyServices: Array.from(this.services.values()).filter(s => s.status === 'healthy').length,
        totalAgents: this.agents.size,
        healthyAgents: Array.from(this.agents.values()).filter(a => a.status === 'healthy').length
      }
    };
  }

  /**
   * 注册告警回调
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * 触发告警
   */
  triggerAlert(type, data) {
    const alert = {
      timestamp: new Date().toISOString(),
      type,
      data,
      severity: type.includes('error') || type.includes('down') ? 'high' : 'medium'
    };

    console.log(`[Heartbeat Alert] ${type}:`, data);

    // 调用所有注册的回调
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (e) {
        console.error('[Heartbeat] 告警回调执行失败:', e);
      }
    });
  }

  /**
   * Agent完成任务时调用
   */
  agentTaskCompleted(agentId, success = true) {
    const agent = this.agents.get(agentId);
    if (agent) {
      if (success) {
        agent.tasksCompleted++;
      } else {
        agent.tasksFailed++;
      }
      agent.lastHeartbeat = new Date().toISOString();
      agent.status = 'healthy';
    }
  }
}

// 单例实例
let instance = null;

// 导出类和单例管理器
module.exports = HeartbeatMonitor;
module.exports.HeartbeatMonitor = HeartbeatMonitor;
module.exports.getInstance = (config) => {
  if (!instance) {
    instance = new HeartbeatMonitor(config);
  }
  return instance;
};
module.exports.resetInstance = () => {
  instance = null;
};

// 如果直接运行，启动示例
if (require.main === module) {
  const monitor = new HeartbeatMonitor({
    interval: 3000,
    autoRecover: true
  });

  // 注册服务
  monitor.registerService('api-server', {
    name: 'API服务器',
    endpoint: 'http://localhost:3333',
    restartCommand: 'npm start'
  });

  // 注册Agent
  monitor.registerAgent('agent-m2', {
    name: 'Agent-M2 痛点问诊',
    role: 'backend',
    pid: process.pid
  });

  monitor.registerAgent('agent-fe', {
    name: 'Agent-FE 前端开发',
    role: 'frontend',
    pid: process.pid
  });

  // 注册告警处理
  monitor.onAlert((alert) => {
    console.log('收到告警:', alert.type, alert.data);
  });

  // 启动监控
  monitor.start();

  // 5秒后打印状态
  setTimeout(() => {
    console.log('\n心跳监控状态报告:');
    console.log(JSON.stringify(monitor.getStatusReport(), null, 2));
  }, 5000);

  // 10秒后停止
  setTimeout(() => {
    monitor.stop();
    process.exit(0);
  }, 10000);
}
