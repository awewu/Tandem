/**
 * 限流中间件
 * Token Bucket算法实现
 */

const { RateLimitError } = require('./error-handler');

// 内存存储限流数据 (生产环境应使用Redis)
const rateLimitStore = new Map();

// 限流配置
const RATE_LIMIT_CONFIG = {
  // 标准用户: 100请求/15分钟
  standard: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 100,
    burstSize: 10 // 突发流量缓冲
  },
  // 管理员: 200请求/15分钟
  admin: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 200,
    burstSize: 20
  },
  // 销售/设计师: 150请求/15分钟
  staff: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 150,
    burstSize: 15
  },
  // 未认证用户: 30请求/15分钟
  anonymous: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
    burstSize: 5
  }
};

/**
 * 获取限流配置
 */
function getLimitConfig(req) {
  // 根据用户角色返回不同配置
  const user = req.user;
  if (!user) return RATE_LIMIT_CONFIG.anonymous;

  switch (user.role) {
    case 'hq_admin':
    case 'store_admin':
      return RATE_LIMIT_CONFIG.admin;
    case 'sales':
    case 'designer':
    case 'technical':
      return RATE_LIMIT_CONFIG.staff;
    default:
      return RATE_LIMIT_CONFIG.standard;
  }
}

/**
 * 生成限流键
 */
function getRateLimitKey(req) {
  const userId = req.user?.id;
  const ip = req.ip || req.connection.remoteAddress;
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Token Bucket限流检查
 */
function checkRateLimit(key, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // 获取或初始化存储
  let userData = rateLimitStore.get(key);
  if (!userData) {
    userData = {
      tokens: config.maxRequests,
      lastRefill: now,
      requests: []
    };
    rateLimitStore.set(key, userData);
  }

  // 计算token补充
  const timePassed = now - userData.lastRefill;
  const refillRate = config.maxRequests / (config.windowMs / 1000); // tokens per second
  const tokensToAdd = Math.floor(timePassed / 1000 * refillRate);

  if (tokensToAdd > 0) {
    userData.tokens = Math.min(config.maxRequests, userData.tokens + tokensToAdd);
    userData.lastRefill = now;
  }

  // 清理过期请求记录
  userData.requests = userData.requests.filter(time => time > windowStart);

  // 检查是否有限流令牌
  if (userData.tokens > 0) {
    // 消耗一个令牌
    userData.tokens--;
    userData.requests.push(now);

    // 计算重置时间
    const resetTime = Math.ceil((config.windowMs - (now - userData.requests[0])) / 1000);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: userData.tokens,
      resetTime: Math.max(0, resetTime)
    };
  }

  // 无可用令牌，触发限流
  const oldestRequest = userData.requests[0];
  const retryAfter = Math.ceil((config.windowMs - (now - oldestRequest)) / 1000);

  return {
    allowed: false,
    limit: config.maxRequests,
    remaining: 0,
    resetTime: retryAfter,
    retryAfter
  };
}

/**
 * 限流中间件
 */
function rateLimitMiddleware(options = {}) {
  return (req, res, next) => {
    const config = options.config || getLimitConfig(req);
    const key = options.keyGenerator ? options.keyGenerator(req) : getRateLimitKey(req);

    const result = checkRateLimit(key, config);

    // 设置限流响应头
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', result.resetTime);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return next(new RateLimitError(result.retryAfter));
    }

    next();
  };
}

/**
 * API限流中间件 (默认配置)
 */
const apiLimiter = rateLimitMiddleware();

/**
 * 严格限流中间件 (用于敏感操作)
 */
const strictLimiter = rateLimitMiddleware({
  config: {
    windowMs: 5 * 60 * 1000, // 5分钟
    maxRequests: 10,
    burstSize: 2
  }
});

/**
 * 登录限流中间件
 */
const loginLimiter = rateLimitMiddleware({
  config: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 5, // 5次登录尝试
    burstSize: 1
  },
  keyGenerator: (req) => `login:${req.ip}`
});

/**
 * 清理过期数据 (定期执行)
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1小时

  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}

// 每10分钟清理一次
setInterval(cleanupRateLimitStore, 10 * 60 * 1000);

module.exports = {
  rateLimitMiddleware,
  apiLimiter,
  strictLimiter,
  loginLimiter,
  checkRateLimit,
  cleanupRateLimitStore
};
