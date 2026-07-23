/**
 * 缓存引擎
 * Cache Engine
 * 
 * 功能：
 * 1. 多级缓存策略 (内存+Redis)
 * 2. 智能缓存失效
 * 3. 缓存预热
 * 4. 缓存统计和监控
 * 5. API响应缓存
 */

class CacheEngine {
  constructor(redisClient = null) {
    this.version = '1.0.0';
    this.name = 'CacheEngine';
    
    // 内存缓存
    this.memoryCache = new Map();
    
    // Redis客户端 (可选)
    this.redis = redisClient;
    
    // 缓存配置
    this.config = {
      memory: {
        maxSize: 1000,        // 最大条目数
        defaultTTL: 300,      // 默认5分钟
        checkPeriod: 60       // 清理周期60秒
      },
      redis: {
        defaultTTL: 3600,     // 默认1小时
        prefix: 'rhautt:nexus:' // 键前缀
      }
    };
    
    // 缓存统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    
    // 启动清理定时器
    this.startCleanupTimer();
  }
  
  /**
   * 获取缓存
   */
  async get(key, options = {}) {
    const { useRedis = true, namespace = 'default', tenantId = 'public' } = options;
    const fullKey = this.buildKey(key, namespace, tenantId);
    
    // 先查内存
    const memoryData = this.memoryCache.get(fullKey);
    if (memoryData && !this.isExpired(memoryData)) {
      this.stats.hits++;
      return memoryData.value;
    }
    
    // 再查Redis
    if (useRedis && this.redis) {
      try {
        const redisData = await this.redis.get(fullKey);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          // 回填内存
          this.setMemory(fullKey, parsed, this.config.memory.defaultTTL);
          this.stats.hits++;
          return parsed;
        }
      } catch (error) {
        console.error('[CacheEngine] Redis get error:', error.message);
      }
    }
    
    this.stats.misses++;
    return null;
  }
  
  /**
   * 设置缓存
   */
  async set(key, value, options = {}) {
    const { 
      ttl = this.config.memory.defaultTTL, 
      useRedis = true,
      namespace = 'default',
      tenantId = 'public'
    } = options;
    
    const fullKey = this.buildKey(key, namespace, tenantId);
    
    // 检查内存容量
    if (this.memoryCache.size >= this.config.memory.maxSize) {
      this.evictLRU();
    }
    
    // 设置内存缓存
    this.setMemory(fullKey, value, ttl);
    this.stats.sets++;
    
    // 设置Redis缓存
    if (useRedis && this.redis) {
      try {
        const redisTTL = Math.max(ttl, this.config.redis.defaultTTL);
        if (typeof this.redis.setEx === 'function') {
          await this.redis.setEx(fullKey, redisTTL, JSON.stringify(value));
        } else {
          await this.redis.setex(
            fullKey,
            redisTTL,
            JSON.stringify(value)
          );
        }
      } catch (error) {
        console.error('[CacheEngine] Redis set error:', error.message);
      }
    }
    
    return true;
  }
  
  /**
   * 删除缓存
   */
  async delete(key, options = {}) {
    const { useRedis = true, namespace = 'default', tenantId = 'public' } = options;
    const fullKey = this.buildKey(key, namespace, tenantId);
    
    // 删除内存
    this.memoryCache.delete(fullKey);
    
    // 删除Redis
    if (useRedis && this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch (error) {
        console.error('[CacheEngine] Redis delete error:', error.message);
      }
    }
    
    this.stats.deletes++;
    return true;
  }
  
  /**
   * 设置内存缓存
   */
  setMemory(key, value, ttl) {
    const expires = Date.now() + (ttl * 1000);
    this.memoryCache.set(key, {
      value,
      expires,
      accessTime: Date.now()
    });
  }
  
  /**
   * 检查是否过期
   */
  isExpired(data) {
    return Date.now() > data.expires;
  }
  
  /**
   * LRU淘汰
   */
  evictLRU() {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const [key, data] of this.memoryCache.entries()) {
      if (data.accessTime < oldestTime) {
        oldest = key;
        oldestTime = data.accessTime;
      }
    }
    
    if (oldest) {
      this.memoryCache.delete(oldest);
      this.stats.evictions++;
    }
  }
  
  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.memoryCache.entries()) {
      if (now > data.expires) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[CacheEngine] Cleaned ${cleaned} expired items`);
    }
    
    return cleaned;
  }
  
  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    const timer = setInterval(() => {
      this.cleanup();
    }, this.config.memory.checkPeriod * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }
  
  /**
   * 构建完整键名
   */
  buildKey(key, namespace, tenantId = 'public') {
    const safeTenantId = String(tenantId || 'public').replace(/[^a-zA-Z0-9_.:-]/g, '_');
    const safeNamespace = String(namespace || 'default').replace(/[^a-zA-Z0-9_.:-]/g, '_');
    return `${this.config.redis.prefix}tenant:${safeTenantId}:${safeNamespace}:${key}`;
  }
  
  /**
   * 缓存包装器 - 用于自动缓存API响应
   */
  wrap(fn, keyGenerator, options = {}) {
    return async (...args) => {
      const key = keyGenerator(...args);
      
      // 尝试从缓存获取
      const cached = await this.get(key, options);
      if (cached !== null) {
        return cached;
      }
      
      // 执行原函数
      const result = await fn(...args);
      
      // 缓存结果
      await this.set(key, result, options);
      
      return result;
    };
  }
  
  /**
   * 批量获取
   */
  async mget(keys, options = {}) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await this.get(key, options);
    }
    
    return results;
  }
  
  /**
   * 批量设置
   */
  async mset(keyValuePairs, options = {}) {
    for (const [key, value] of Object.entries(keyValuePairs)) {
      await this.set(key, value, options);
    }
    
    return true;
  }
  
  /**
   * 清空缓存
   */
  async clear(namespace = null, options = {}) {
    const tenantId = options.tenantId || 'public';
    // 清空内存
    if (namespace) {
      const prefix = this.buildKey('', namespace, tenantId);
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
    } else {
      this.memoryCache.clear();
    }
    
    // 清空Redis
    if (this.redis) {
      try {
        if (namespace) {
          const pattern = this.buildKey('*', namespace, tenantId);
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          const keys = await this.redis.keys(`${this.config.redis.prefix}*`);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      } catch (error) {
        console.error('[CacheEngine] Redis clear error:', error.message);
      }
    }
    
    return true;
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memorySize: this.memoryCache.size,
      maxMemorySize: this.config.memory.maxSize,
      redisConnected: !!this.redis
    };
  }
  
  /**
   * 健康检查
   */
  async healthCheck() {
    const status = {
      status: 'ok',
      version: this.version,
      name: this.name,
      memory: {
        size: this.memoryCache.size,
        maxSize: this.config.memory.maxSize,
        usage: `${(this.memoryCache.size / this.config.memory.maxSize * 100).toFixed(1)}%`
      },
      stats: this.getStats()
    };
    
    // 检查Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        status.redis = 'connected';
      } catch (error) {
        status.redis = 'disconnected';
        status.status = 'degraded';
      }
    } else {
      status.redis = 'not_configured';
    }
    
    status.timestamp = new Date().toISOString();
    return status;
  }
}

module.exports = CacheEngine;
