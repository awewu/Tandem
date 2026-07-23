import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../auth/auth.entity';

/**
 * H2 修复 · 全局 RBAC 守卫（在 AuthGuard 之后运行）。
 * - @Public() 端点：直接放行（AuthGuard 已放行，此处不介入）。
 * - 未标注 @Roles 的端点：仅要求已认证（no-op），保持向后兼容。
 * - 标注 @Roles(...) 的端点：校验 JWT payload.role 是否在允许集合内。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const role: string | undefined = req.user?.role;
    if (!role || !required.includes(role as UserRole)) {
      throw new ForbiddenException('当前角色无权访问该资源');
    }
    return true;
  }
}
