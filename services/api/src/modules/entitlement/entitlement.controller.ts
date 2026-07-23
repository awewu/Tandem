import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { EntitlementService } from './entitlement.service';
import type { SellableModuleId, SubscriptionPlan } from './subscription.entity';

interface GrantBody {
  tenantId: string;
  moduleId: SellableModuleId;
  plan?: SubscriptionPlan;
  seats?: number | null;
  endsAt?: string | null;
}

interface RevokeBody {
  tenantId: string;
  moduleId: SellableModuleId;
}

@Controller('entitlement')
export class EntitlementController {
  constructor(private readonly entitlement: EntitlementService) {}

  /** 当前租户已订阅（有效）的模块清单 —— 前端据此渲染能力开关。 */
  @Get('me')
  async me(@Req() req: any) {
    const tenantId: string = req.user?.tenantId;
    const modules = await this.entitlement.activeModuleIds(tenantId);
    return { tenantId, modules: [...modules] };
  }

  /** 当前租户全部订阅明细。 */
  @Get('subscriptions')
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  async subscriptions(@Req() req: any) {
    return this.entitlement.listForTenant(req.user?.tenantId);
  }

  /** 平台开通/更新某租户的模块订阅。 */
  @Post('grant')
  @Roles('platform_admin')
  async grant(@Req() req: any, @Body() body: GrantBody) {
    return this.entitlement.grant(body.tenantId, req.user?.userId ?? null, {
      moduleId: body.moduleId,
      plan: body.plan,
      seats: body.seats,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  /** 平台停用某租户的模块订阅。 */
  @Post('revoke')
  @Roles('platform_admin')
  async revoke(@Req() req: any, @Body() body: RevokeBody) {
    return this.entitlement.revoke(body.tenantId, req.user?.userId ?? null, body.moduleId);
  }
}
