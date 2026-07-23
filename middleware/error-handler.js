/**
 * 统一错误处理中间件
 * 遵循 RFC 7807 Problem Details 标准
 */

class APIError extends Error {
  constructor(type, status, title, detail, errors = []) {
    super(detail);
    this.type = `https://api.rheem.com/errors/${type}`;
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
  }
}

// 常见错误类型
class ValidationError extends APIError {
  constructor(detail, errors = []) {
    super('VALIDATION_ERROR', 400, 'Validation Error', detail, errors);
  }
}

class AuthenticationError extends APIError {
  constructor(detail = 'Authentication required') {
    super('AUTHENTICATION_ERROR', 401, 'Authentication Error', detail);
  }
}

class AuthorizationError extends APIError {
  constructor(detail = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', 403, 'Authorization Error', detail);
  }
}

class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', 404, 'Not Found', `${resource} not found`);
  }
}

class ConflictError extends APIError {
  constructor(detail = 'Resource conflict') {
    super('CONFLICT', 409, 'Conflict', detail);
  }
}

class RateLimitError extends APIError {
  constructor(retryAfter = 60) {
    super('RATE_LIMIT_EXCEEDED', 429, 'Too Many Requests', 'Rate limit exceeded');
    this.retryAfter = retryAfter;
  }
}

class InternalError extends APIError {
  constructor(detail = 'Internal server error') {
    super('INTERNAL_ERROR', 500, 'Internal Server Error', detail);
  }
}

// 错误处理中间件
function errorHandler(err, req, res, next) {
  // 如果是APIError的子类，返回标准格式
  if (err instanceof APIError) {
    const response = {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.originalUrl,
      requestId: req.requestId
    };

    // 添加字段级错误详情
    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    // 添加Retry-After头（限流错误）
    if (err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter);
    }

    return res.status(err.status).json(response);
  }

  // 处理其他类型的错误
  console.error(`[Error] ${err.message}`, err.stack);

  // 生产环境不暴露详细错误
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    type: 'https://api.rheem.com/errors/INTERNAL_ERROR',
    title: 'Internal Server Error',
    status: 500,
    detail: isDevelopment ? err.message : 'An unexpected error occurred',
    instance: req.originalUrl,
    requestId: req.requestId,
    ...(isDevelopment && { stack: err.stack })
  });
}

// 404处理中间件
function notFoundHandler(req, res, next) {
  const error = new NotFoundError('Endpoint');
  next(error);
}

// 异步错误包装器
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
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
};
