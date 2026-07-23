/**
 * 中间件统一导出
 */

const {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  errorHandler,
  notFoundHandler,
  asyncHandler
} = require('./error-handler');

const {
  rateLimitMiddleware,
  apiLimiter,
  strictLimiter,
  loginLimiter
} = require('./rate-limiter');

const {
  requestTracer,
  performanceMonitor,
  accessLogger,
  getRequestLogs,
  getPerformanceStats
} = require('./request-logger');

module.exports = {
  // 错误处理
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  errorHandler,
  notFoundHandler,
  asyncHandler,

  // 限流
  rateLimitMiddleware,
  apiLimiter,
  strictLimiter,
  loginLimiter,

  // 日志追踪
  requestTracer,
  performanceMonitor,
  accessLogger,
  getRequestLogs,
  getPerformanceStats
};
