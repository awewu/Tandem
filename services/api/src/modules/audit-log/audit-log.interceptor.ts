import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AuditLogService } from './audit-log.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECRET_KEYS = new Set(['password', 'newPassword', 'oldPassword', 'token', 'authorization', 'dataBase64']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (!this.shouldAudit(req)) return next.handle();

    const startedAt = Date.now();
    const actor = req.user || {};
    const descriptor = describeRequest(req);
    const base = {
      tenantId: actor.tenantId,
      actorUserId: actor.userId || actor.id || null,
      action: descriptor.action,
      resourceType: descriptor.resourceType,
      resourceId: descriptor.resourceId,
      beforeState: {
        method: req.method,
        path: req.originalUrl || req.url,
        query: sanitize(req.query),
        body: sanitize(req.body),
      },
      requestId: firstHeader(req, 'x-request-id') || firstHeader(req, 'x-correlation-id'),
      traceId: firstHeader(req, 'x-trace-id'),
      ip: req.ip || req.socket?.remoteAddress,
    };

    return next.handle().pipe(
      tap((response) => {
        void this.auditLog.record({
          ...base,
          afterState: {
            status: 'success',
            durationMs: Date.now() - startedAt,
            response: summarize(response),
          },
        });
      }),
      catchError((error) => {
        void this.auditLog.record({
          ...base,
          afterState: {
            status: 'failed',
            durationMs: Date.now() - startedAt,
            error: error?.message || 'Request failed',
            statusCode: error?.status || error?.statusCode || 500,
          },
        });
        return throwError(() => error);
      }),
    );
  }

  private shouldAudit(req: any) {
    if (!MUTATING_METHODS.has(String(req.method || '').toUpperCase())) return false;
    if (!req.user?.tenantId) return false;
    const path = String(req.originalUrl || req.url || '');
    if (path.includes('/audit-logs')) return false;
    if (path.includes('/auth/login') || path.includes('/auth/logout') || path.includes('/auth/refresh-token')) return false;
    return true;
  }
}

function firstHeader(req: any, name: string): string | null {
  const value = req.headers?.[name];
  if (Array.isArray(value)) return value[0] || null;
  return typeof value === 'string' ? value : null;
}

function describeRequest(req: any) {
  const method = String(req.method || '').toUpperCase();
  const path = stripApiPrefix(String(req.route?.path || req.path || req.url || ''));
  const fullPath = stripApiPrefix(String(req.originalUrl || req.url || path).split('?')[0]);
  const resourceId = String(req.params?.id || req.params?.articleId || req.params?.assignmentId || req.params?.relId || req.body?.id || '').trim() || null;
  const resourceType = resourceTypeForPath(fullPath);
  return {
    resourceType,
    resourceId,
    action: `${resourceType}.${actionFor(method, fullPath)}`,
  };
}

function stripApiPrefix(path: string) {
  return path.replace(/^\/api\/v2\//, '/').replace(/^\/api\//, '/').replace(/^\//, '');
}

function actionFor(method: string, path: string) {
  if (method === 'DELETE') return 'delete';
  if (method === 'PUT') return 'update';
  if (method === 'PATCH') return 'update';
  if (/publish|transition|restore|hide|archive|reset-password|roles|permissions|logo|upload|verify/i.test(path)) {
    if (/reset-password/i.test(path)) return 'reset_password';
    if (/permissions/i.test(path)) return 'assign_permissions';
    if (/roles/i.test(path)) return 'assign_roles';
    if (/upload|logo/i.test(path)) return 'upload';
    if (/publish|transition/i.test(path)) return 'publish';
    if (/hide|archive/i.test(path)) return 'archive';
    if (/restore/i.test(path)) return 'restore';
  }
  if (method === 'POST') return 'create';
  return method.toLowerCase();
}

function resourceTypeForPath(path: string) {
  if (path.includes('product-catalog')) return 'product.catalog';
  if (path.includes('brand-sites') && path.includes('news')) return 'marketing.content';
  if (path.includes('file-artifact') || path.includes('site-materials') || path.includes('logo')) return 'marketing.assets';
  if (path.includes('brand-sites') && path.includes('publish')) return 'brand.library';
  if (path.includes('brand-sites')) return 'brand.library';
  if (path.includes('auth/admin/users')) return 'admin.users';
  if (path.includes('auth/admin/roles')) return 'admin.roles';
  if (path.includes('brand-product-categories')) return 'product.catalog';
  if (path.includes('diagnosis')) return 'diagnosis.consultation';
  if (path.includes('crm') || path.includes('customers') || path.includes('opportunities')) return 'crm.consultation';
  return path.split('/').filter(Boolean).slice(0, 2).join('.') || 'system';
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return '[Truncated]';
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key) || /password|token|secret|base64/i.test(key)) {
        output[key] = '[Redacted]';
      } else {
        output[key] = sanitize(raw, depth + 1);
      }
    }
    return output;
  }
  const text = typeof value === 'string' ? value : value;
  if (typeof text === 'string' && text.length > 1000) return `${text.slice(0, 1000)}...[Truncated]`;
  return text;
}

function summarize(value: unknown): unknown {
  if (value == null) return value;
  const sanitized = sanitize(value);
  const text = JSON.stringify(sanitized);
  if (text.length <= 3000) return sanitized;
  return { summary: text.slice(0, 3000), truncated: true };
}
