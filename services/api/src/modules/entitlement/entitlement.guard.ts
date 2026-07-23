import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { TARGET_API_BOOT_SMOKE } from '../boot-smoke';
import { REQUIRE_MODULE_KEY } from './entitlement.decorator';
import { EntitlementService } from './entitlement.service';
import type { SellableModuleId } from './subscription.entity';

/**
 * 商业化订阅守卫（全局，在 AuthGuard → RolesGuard 之后运行）。
 * - @Public() 端点：放行。
 * - 未标 @RequireModule 的端点：放行（底座能力恒可用，向后兼容）。
 * - 标 @RequireModule(...) 的端点：校验当前租户是否对全部所需模块持有有效订阅。
 * - boot-smoke：放行（无真实订阅数据，不阻断启动冒烟）。
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlement: EntitlementService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (TARGET_API_BOOT_SMOKE) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<SellableModuleId[]>(REQUIRE_MODULE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenantId: string | undefined = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('缺少租户范围，无法校验模块订阅');

    const ok = await this.entitlement.hasActiveModules(tenantId, required);
    if (!ok) {
      throw new ForbiddenException(`当前租户未订阅所需模块: ${required.join(', ')}`);
    }
    return true;
  }
}
