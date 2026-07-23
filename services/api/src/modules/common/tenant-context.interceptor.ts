import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithTenantScope } from './tenant-context';

/**
 * Establishes the AsyncLocalStorage tenant scope for the duration of each
 * request, sourced from the JWT payload that AuthGuard placed on req.user.
 *
 * No-op for unauthenticated/public routes (no req.user.tenantId) so it is safe
 * to register globally. Because the handler's promise chain is initiated inside
 * runWithTenantScope, the scope propagates across awaits in services/repos.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user?.tenantId) {
      return next.handle();
    }
    return new Observable((subscriber) => {
      runWithTenantScope(
        { tenantId: user.tenantId, actorId: user.userId, role: user.role },
        () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }
}
