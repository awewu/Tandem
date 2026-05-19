/**
 * Domain Error Hierarchy
 * §T5 宪章: 统一错误类型 + 状态码映射
 */

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404);
  }
}

export class AuthError extends DomainError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Permission denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, metadata);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}
