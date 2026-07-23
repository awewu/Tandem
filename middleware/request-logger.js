/**
 * 请求日志和追踪中间件
 * 提供X-Request-ID、性能监控、访问日志
 */

const { v4: uuidv4 } = require('uuid');

// 日志存储 (可选: 发送到ELK/CloudWatch)
const requestLogs = [];
const MAX_LOGS = 1000; // 内存中保留最近1000条

/**
 * 请求追踪中间件
 * 为每个请求生成唯一ID并记录日志
 */
function requestTracer(req, res, next) {
  // 生成或继承请求ID
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);

  // 记录开始时间
  req.startTime = Date.now();

  // 记录请求基本信息
  const logEntry = {
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl || req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    userRole: req.user?.role
  };

  // 响应完成后记录
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    logEntry.statusCode = res.statusCode;
    logEntry.duration = duration;
    logEntry.contentLength = res.getHeader('content-length');

    // 存储日志
    requestLogs.push(logEntry);
    if (requestLogs.length > MAX_LOGS) {
      requestLogs.shift();
    }

    // 控制台输出 (开发环境)
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : // 红色
                       res.statusCode >= 300 ? '\x1b[33m' : // 黄色
                       '\x1b[32m'; // 绿色
    const resetColor = '\x1b[0m';

    console.log(
      `[${logEntry.timestamp}] ${statusColor}${res.statusCode}${resetColor} ` +
      `${req.method} ${req.originalUrl} ` +
      `${duration}ms ` +
      `[${req.requestId}] ` +
      `${req.user?.name || 'anonymous'}`
    );

    // 慢请求警告 (>1秒)
    if (duration > 1000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
}

/**
 * 性能监控中间件
 * 记录详细性能指标
 */
function performanceMonitor(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1000000; // 纳秒转毫秒

    // 添加性能指标到请求对象
    req.performance = {
      durationMs,
      timestamp: new Date().toISOString()
    };

    // 性能阈值告警
    if (durationMs > 5000) {
      console.error(`🚨 Critical slow request: ${req.method} ${req.originalUrl} took ${durationMs.toFixed(2)}ms`);
    }
  });

  next();
}

/**
 * 访问日志中间件
 * 类似Apache/Nginx访问日志格式
 */
function accessLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // 标准访问日志格式
    const log = `${req.ip} - "${req.method} ${req.originalUrl} HTTP/${req.httpVersion}" ` +
                `${res.statusCode} ${res.getHeader('content-length') || '-'} ` +
                `"${req.headers['referer'] || '-'}" "${req.headers['user-agent'] || '-'}" ` +
                `${duration}ms`;

    // 写入访问日志文件 (可选)
    // fs.appendFileSync('logs/access.log', log + '\n');
  });

  next();
}

/**
 * 获取请求日志 (用于调试)
 */
function getRequestLogs(options = {}) {
  let logs = [...requestLogs];

  // 过滤
  if (options.method) {
    logs = logs.filter(l => l.method === options.method);
  }
  if (options.statusCode) {
    logs = logs.filter(l => l.statusCode === options.statusCode);
  }
  if (options.userId) {
    logs = logs.filter(l => l.userId === options.userId);
  }
  if (options.since) {
    const since = new Date(options.since);
    logs = logs.filter(l => new Date(l.timestamp) >= since);
  }

  // 排序
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // 限制
  if (options.limit) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

/**
 * 获取性能统计
 */
function getPerformanceStats() {
  const logs = requestLogs;

  if (logs.length === 0) {
    return { message: 'No data available' };
  }

  const durations = logs.map(l => l.duration);
  const total = durations.reduce((a, b) => a + b, 0);

  // 排序计算百分位
  durations.sort((a, b) => a - b);

  return {
    totalRequests: logs.length,
    avgDuration: Math.round(total / logs.length),
    minDuration: durations[0],
    maxDuration: durations[durations.length - 1],
    p50: durations[Math.floor(durations.length * 0.5)],
    p95: durations[Math.floor(durations.length * 0.95)],
    p99: durations[Math.floor(durations.length * 0.99)],
    errorRate: logs.filter(l => l.statusCode >= 400).length / logs.length,
    timeRange: {
      start: logs[0].timestamp,
      end: logs[logs.length - 1].timestamp
    }
  };
}

/**
 * 清理旧日志
 */
function cleanupOldLogs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;

  for (let i = requestLogs.length - 1; i >= 0; i--) {
    if (new Date(requestLogs[i].timestamp).getTime() < cutoff) {
      requestLogs.splice(i, 1);
    }
  }
}

// 每小时清理一次旧日志
setInterval(() => cleanupOldLogs(), 60 * 60 * 1000);

module.exports = {
  requestTracer,
  performanceMonitor,
  accessLogger,
  getRequestLogs,
  getPerformanceStats,
  cleanupOldLogs
};
