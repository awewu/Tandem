import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { MdmService, RegisterMasterDto } from './mdm.service';
import { EventBusService } from './event-bus.service';
import { SourceTier } from './master-data.entity';
import { Roles } from '../common/roles.decorator';

/**
 * M15 · 跨板块数据总线 / MDM API（/api/v2/mdm）
 * H2：全局 AuthGuard 已强制认证（此前 register/resolve/deadLetters 裸奔）；
 * 全局主数据单写收口，限集团管理员/系统运维角色。
 */
@Controller('mdm')
@Roles('platform_admin', 'hq_admin')
export class MdmController {
  constructor(
    private readonly mdm: MdmService,
    private readonly bus: EventBusService,
  ) {}

  /** 注册/更新全局产品主数据（单写收口） */
  @Post('products')
  register(@Body() body: RegisterMasterDto) {
    return this.mdm.registerGlobalProduct(body);
  }

  /** 跨板块只读解析 global_product_id */
  @Get('products/:globalProductId')
  resolve(@Param('globalProductId') id: string) {
    return this.mdm.resolveGlobalProductId(id);
  }

  @Get('products')
  listByTier(@Query('tier') tier: SourceTier) {
    return this.mdm.listByTier(tier);
  }

  /**
   * 事件总线：投递 pending（生产由 Temporal/定时器驱动，此处供运维/测试触发）。
   * 鉴权后按调用者 JWT 租户在 RLS 上下文投递该租户事件（mdm_outbox_events 为 FORCE RLS）。
   */
  @UseGuards(AuthGuard)
  @Post('event-bus/dispatch')
  dispatch(@Request() req: any) {
    return this.bus.dispatchPending(100, req.user?.tenantId);
  }

  /** 死信队列 */
  @Get('event-bus/dead-letters')
  deadLetters() {
    return this.bus.deadLetters();
  }
}
