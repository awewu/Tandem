/**
 * 6大系统计算结果缓存引擎
 * 支持Redis/Memory双模式，150人团队高并发优化
 */

const NodeCache = require('node-cache');
const crypto = require('crypto');

const ALLOWED_SYSTEMS = new Set([
  'oneclick',
  'hotwater',
  'water',
  'freshair',
  'cooling',
  'doas',
  'heating',
  'control'
]);

class CalculationCache {
  constructor(options = {}) {
    this.ttl = options.ttl || 3600; // 默认1小时
    this.checkPeriod = options.checkPeriod || 600;
    
    // 本地内存缓存
    this.localCache = new NodeCache({
      stdTTL: this.ttl,
      checkperiod: this.checkPeriod,
      useClones: false
    });
    
    // Redis缓存 (可选)
    /** @type {any} */
    this.redis = null;
    this.redisEnabled = false;
    
    // 缓存统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    
    this.init();
  }
  
  async init() {
    const redisConfigured = Boolean(
      process.env.REDIS_URL ||
      process.env.REDIS_HOST ||
      process.env.REDIS_ENABLED === 'true'
    );
    if (!redisConfigured) {
      console.log('[Cache] Redis未配置，使用内存缓存');
      return;
    }

    // 尝试连接Redis
    try {
      const { createClient } = require('redis');
      this.redis = createClient(process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            socket: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT || 6379),
              connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000),
              reconnectStrategy: false
            },
            password: process.env.REDIS_PASSWORD || undefined
          });
      
      this.redis.on('connect', () => {
        console.log('[Cache] Redis连接成功');
        this.redisEnabled = true;
      });
      
      this.redis.on('error', (err) => {
        console.log('[Cache] Redis连接失败，使用内存缓存:', err.message);
        this.redisEnabled = false;
      });

      await this.redis.connect();
      this.redisEnabled = true;
    } catch (err) {
      console.log('[Cache] Redis不可用，使用内存缓存:', err.message);
      this.redis = null;
      this.redisEnabled = false;
    }
  }
  
  /**
   * 生成缓存Key
   */
  generateKey(system, params) {
    if (!ALLOWED_SYSTEMS.has(system)) {
      throw new Error(`Unsupported calculation cache system: ${system}`);
    }
    // 规范化参数
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(normalized).digest('hex');
    const tenantId = String(params?.tenantId || 'public').replace(/[^a-zA-Z0-9_.:-]/g, '_');
    return `rhautt:nexus:tenant:${tenantId}:calc:${system}:${hash}`;
  }
  
  /**
   * 获取缓存
   */
  async get(system, params) {
    const key = this.generateKey(system, params);
    
    // 先查本地缓存
    let value = this.localCache.get(key);
    if (value) {
      this.stats.hits++;
      return { hit: true, data: value, source: 'local' };
    }
    
    // 再查Redis
    if (this.redisEnabled) {
      try {
        const redisValue = await this.redis.get(key);
        if (redisValue) {
          value = JSON.parse(redisValue);
          // 回填本地缓存
          this.localCache.set(key, value);
          this.stats.hits++;
          return { hit: true, data: value, source: 'redis' };
        }
      } catch (err) {
        console.error('[Cache] Redis读取失败:', err.message);
      }
    }
    
    this.stats.misses++;
    return { hit: false };
  }
  
  /**
   * 设置缓存
   */
  async set(system, params, data, customTTL = null) {
    const key = this.generateKey(system, params);
    const ttl = customTTL || this.ttl;
    
    // 本地缓存
    this.localCache.set(key, data, ttl);
    
    // Redis缓存
    if (this.redisEnabled) {
      try {
        if (typeof this.redis.setEx === 'function') {
          await this.redis.setEx(key, ttl, JSON.stringify(data));
        } else {
          await this.redis.setex(key, ttl, JSON.stringify(data));
        }
      } catch (err) {
        console.error('[Cache] Redis写入失败:', err.message);
      }
    }
    
    this.stats.sets++;
    return true;
  }
  
  /**
   * 删除缓存
   */
  async del(system, params) {
    const key = this.generateKey(system, params);
    
    this.localCache.del(key);
    
    if (this.redisEnabled) {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.error('[Cache] Redis删除失败:', err.message);
      }
    }
    
    return true;
  }
  
  /**
   * 批量清除系统缓存
   */
  async clearSystem(system) {
    const keys = this.localCache.keys().filter(k => k.includes(`:calc:${system}:`));
    this.localCache.del(keys);
    
    if (this.redisEnabled) {
      try {
        const redisKeys = await this.redis.keys(`rhautt:nexus:tenant:*:calc:${system}:*`);
        if (redisKeys.length > 0) {
          await this.redis.del(redisKeys);
        }
      } catch (err) {
        console.error('[Cache] Redis批量删除失败:', err.message);
      }
    }
    
    console.log(`[Cache] 已清除 ${system} 系统缓存`);
    return true;
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100 || 0;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      keys: this.localCache.keys().length,
      redisEnabled: this.redisEnabled
    };
  }
  
  /**
   * 预热缓存 - 常见户型
   */
  async warmup() {
    const commonConfigs = [
      { area: 80, bedrooms: 2, people: 3, buildingType: '普通住宅', city: '北京' },
      { area: 100, bedrooms: 3, people: 4, buildingType: '普通住宅', city: '上海' },
      { area: 120, bedrooms: 3, people: 4, buildingType: '普通住宅', city: '广州' },
      { area: 150, bedrooms: 4, people: 5, buildingType: '普通住宅', city: '深圳' },
      { area: 200, bedrooms: 4, people: 6, buildingType: '别墅', city: '北京' },
      { area: 300, bedrooms: 5, people: 6, buildingType: '别墅', city: '上海' }
    ];
    
    console.log('[Cache] 开始缓存预热...');
    
    const OneClickCalculationEngine = require('./OneClickCalculationEngine');
    const engine = new OneClickCalculationEngine();
    
    for (const config of commonConfigs) {
      try {
        const result = await engine.calculateAll(config);
        if (result.success) {
          await this.set('oneclick', config, result.data, 7200); // 2小时
          console.log(`[Cache] 预热完成: ${config.area}㎡ ${config.city}`);
        }
      } catch (err) {
        console.error(`[Cache] 预热失败: ${config.area}㎡`, err.message);
      }
    }
    
    console.log('[Cache] 缓存预热完成');
  }
  
  /**
   * 优雅关闭
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.localCache.close();
    console.log('[Cache] 缓存引擎已关闭');
  }
}

module.exports = CalculationCache;
