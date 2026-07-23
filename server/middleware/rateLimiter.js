/**
 * 瑞美极致系统 - API限流熔断机制
 * 解决: API限流熔断机制缺失
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15分钟
    this.maxRequests = options.max || 100; // 最大请求数
    this.clients = new Map();
    this.circuitBreakers = new Map();
    
    // 清理过期的客户端记录
    this.startCleanupTask();
  }

  /**
   * 限流中间件
   */
  middleware() {
    return (req, res, next) => {
      const clientId = this.getClientId(req);
      
      // 检查熔断器状态
      if (this.isCircuitOpen(clientId)) {
        return res.status(503).json({
          error: '服务暂时不可用，请稍后再试',
          retryAfter: this.getCircuitRetryAfter(clientId)
        });
      }
      
      // 检查限流
      const limitResult = this.checkLimit(clientId);
      
      // 设置响应头
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', limitResult.remaining);
      res.setHeader('X-RateLimit-Reset', limitResult.resetTime);
      
      if (!limitResult.allowed) {
        // 触发熔断
        this.recordFailure(clientId);
        
        return res.status(429).json({
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil(this.windowMs / 1000)
        });
      }
      
      // 记录成功
      res.on('finish', () => {
        if (res.statusCode >= 500) {
          this.recordFailure(clientId);
        } else {
          this.recordSuccess(clientId);
        }
      });
      
      next();
    };
  }

  /**
   * 获取客户端标识
   */
  getClientId(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * 检查限流
   */
  checkLimit(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let client = this.clients.get(clientId);
    if (!client) {
      client = { requests: [], failures: 0, lastFailure: null };
      this.clients.set(clientId, client);
    }
    
    // 清理过期请求记录
    client.requests = client.requests.filter(time => time > windowStart);
    
    // 检查是否超过限制
    if (client.requests.length >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(client.requests[0] + this.windowMs).toISOString()
      };
    }
    
    // 记录本次请求
    client.requests.push(now);
    
    return {
      allowed: true,
      remaining: this.maxRequests - client.requests.length,
      resetTime: new Date(now + this.windowMs).toISOString()
    };
  }

  /**
   * 记录失败
   */
  recordFailure(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.failures++;
      client.lastFailure = Date.now();
      
      // 5分钟内失败10次，触发熔断
      if (client.failures >= 10) {
        this.openCircuit(clientId);
      }
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(clientId) {
    const client = clientId.clients?.get(clientId);
    if (client && client.failures > 0) {
      client.failures = Math.max(0, client.failures - 1);
    }
  }

  /**
   * 开启熔断
   */
  openCircuit(clientId) {
    const breaker = this.circuitBreakers.get(clientId) || {};
    breaker.state = 'OPEN';
    breaker.openedAt = Date.now();
    breaker.retryAfter = 60; // 60秒后重试
    this.circuitBreakers.set(clientId, breaker);
    
    console.log(`[RateLimiter] 熔断器开启: ${clientId}`);
  }

  /**
   * 检查熔断状态
   */
  isCircuitOpen(clientId) {
    const breaker = this.circuitBreakers.get(clientId);
    if (!breaker || breaker.state !== 'OPEN') {
      return false;
    }
    
    // 检查是否应该关闭熔断
    const elapsed = (Date.now() - breaker.openedAt) / 1000;
    if (elapsed > breaker.retryAfter) {
      breaker.state = 'HALF_OPEN';
      return false;
    }
    
    return true;
  }

  /**
   * 获取熔断重试时间
   */
  getCircuitRetryAfter(clientId) {
    const breaker = this.circuitBreakers.get(clientId);
    if (!breaker) return 0;
    
    const elapsed = (Date.now() - breaker.openedAt) / 1000;
    return Math.max(0, breaker.retryAfter - elapsed);
  }

  /**
   * 清理过期记录
   */
  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      for (const [clientId, client] of this.clients) {
        // 清理过期请求
        client.requests = client.requests.filter(time => time > windowStart);
        
        // 如果长时间没有请求，删除客户端记录
        if (client.requests.length === 0 && 
            (!client.lastFailure || now - client.lastFailure > this.windowMs)) {
          this.clients.delete(clientId);
        }
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 获取统计信息
   */
  getStats() {
    let totalRequests = 0;
    let totalClients = this.clients.size;
    let openCircuits = 0;
    
    for (const client of this.clients.values()) {
      totalRequests += client.requests.length;
    }
    
    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.state === 'OPEN') openCircuits++;
    }
    
    return {
      totalClients,
      totalRequests,
      openCircuits,
      limits: {
        windowMs: this.windowMs,
        maxRequests: this.maxRequests
      }
    };
  }

  /**
   * 手动重置熔断器
   */
  resetCircuit(clientId) {
    if (clientId) {
      const breaker = this.circuitBreakers.get(clientId);
      if (breaker) {
        breaker.state = 'CLOSED';
        breaker.failures = 0;
        return true;
      }
      return false;
    } else {
      // 重置所有熔断器
      for (const breaker of this.circuitBreakers.values()) {
        breaker.state = 'CLOSED';
        breaker.failures = 0;
      }
      return true;
    }
  }
}

// 导出限流器实例
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
