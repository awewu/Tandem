/**
 * 瑞美极致系统 - Redis缓存层
 * 解决: 数据层缺少缓存层
 */

class CacheLayer {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // 启动清理任务
    this.startCleanupTask();
  }

  async initialize() {
    console.log('[CacheLayer] 缓存层初始化完成');
    return true;
  }

  /**
   * 设置缓存
   */
  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttlSeconds * 1000);
    this.stats.sets++;
    return true;
  }

  /**
   * 获取缓存
   */
  get(key) {
    const expireTime = this.ttl.get(key);
    
    // 检查是否过期
    if (expireTime && Date.now() > expireTime) {
      this.cache.delete(key);
      this.ttl.delete(key);
      this.stats.misses++;
      return null;
    }

    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    
    this.stats.misses++;
    return null;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
    this.stats.deletes++;
    return true;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.ttl.clear();
    return true;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * 估算内存使用
   */
  estimateMemoryUsage() {
    let bytes = 0;
    for (const [key, value] of this.cache) {
      bytes += key.length * 2;
      bytes += JSON.stringify(value).length * 2;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, expireTime] of this.ttl) {
      if (now > expireTime) {
        this.cache.delete(key);
        this.ttl.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 启动定时清理任务
   */
  startCleanupTask() {
    // 每5分钟清理一次过期缓存
    setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        console.log(`[CacheLayer] 清理 ${cleaned} 个过期缓存项`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 批量获取缓存
   */
  mget(keys) {
    return keys.map(key => this.get(key));
  }

  /**
   * 批量设置缓存
   */
  mset(entries, ttlSeconds = 300) {
    entries.forEach(([key, value]) => {
      this.set(key, value, ttlSeconds);
    });
    return true;
  }

  /**
   * 检查key是否存在
   */
  exists(key) {
    return this.get(key) !== null;
  }

  /**
   * 设置过期时间
   */
  expire(key, seconds) {
    if (this.cache.has(key)) {
      this.ttl.set(key, Date.now() + seconds * 1000);
      return true;
    }
    return false;
  }
}

module.exports = CacheLayer;
