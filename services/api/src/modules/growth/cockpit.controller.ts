import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { CockpitService } from './cockpit.service';

interface AuthRequest { user: JwtPayload; }

/**
 * 增长中枢 · 北极星驾驶舱控制面（/api/v2/growth/cockpit）。
 * 北极星=活跃盈利经销商数（驱动量=网络GMV）；品牌健康度=A引擎领先指标。
 * 仅登录鉴权为闸（RBAC 由 AuthGuard + 角色校验）；读走脱敏聚合口径。
 */
@Controller('growth')
export class CockpitController {
  constructor(private readonly cockpit: CockpitService) {}

  @UseGuards(AuthGuard) @Get('cockpit/north-star')
  northStar(@Req() req: AuthRequest, @Query('period') period?: string) {
    return this.cockpit.getNorthStar(req.user, period);
  }

  // 模块9-CMO · 营销管理驾驶舱（九屏聚合，按 bu 切片）
  @UseGuards(AuthGuard) @Get('cockpit/cmo')
  cmoDashboard(@Req() req: AuthRequest, @Query('period') period?: string, @Query('buType') buType?: string, @Query('buId') buId?: string) {
    return this.cockpit.getCmoDashboard(req.user, { period, buType, buId });
  }

  @UseGuards(AuthGuard) @Get('cockpit/dealer-success')
  dealerSuccess(@Req() req: AuthRequest, @Query('period') period?: string) {
    return this.cockpit.listDealerSuccess(req.user, period);
  }

  @UseGuards(AuthGuard) @Get('cockpit/brand-health')
  brandHealth(@Req() req: AuthRequest, @Query('period') period?: string) {
    return this.cockpit.getBrandHealth(req.user, period);
  }

  @UseGuards(AuthGuard) @Get('cockpit/aarrr-funnel')
  aarrrFunnel(@Req() req: AuthRequest, @Query('period') period?: string) {
    return this.cockpit.getAarrrFunnel(req.user, period);
  }

  @UseGuards(AuthGuard) @Get('cockpit/geo-loop')
  geoLoop(@Req() req: AuthRequest) {
    return this.cockpit.getGeoLoopStatus(req.user);
  }

  @UseGuards(AuthGuard) @Get('cockpit/lead-routing')
  leadRouting(@Req() req: AuthRequest) {
    return this.cockpit.getLeadRoutingStatus(req.user);
  }

  @UseGuards(AuthGuard) @Get('cockpit/trends')
  trends(@Req() req: AuthRequest, @Query('metric') metric: string, @Query('days') days?: string) {
    return this.cockpit.getTrends(req.user, metric, days ? Number(days) : 30);
  }

  // 运维/测试：落当前租户日快照（生产由 Temporal/cron 定时驱动）。
  @UseGuards(AuthGuard) @Post('cockpit/snapshot')
  snapshot(@Req() req: AuthRequest, @Body() body: { date?: string }) {
    return this.cockpit.snapshotDaily(req.user.tenantId!, body?.date);
  }

  // 成交驱动重算（Phase 1：由本端点驱动；Phase 1 后半接 EventBus 订阅 crm.deal.signed）。
  @UseGuards(AuthGuard) @Post('cockpit/recompute')
  recompute(@Req() req: AuthRequest, @Body() body: { dealerId: string; amount: number; period?: string }) {
    return this.cockpit.recomputeOnDeal(req.user, body.dealerId, Number(body.amount), body.period);
  }
}
