import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { MetricsService } from './metrics.service';
import type { AttributionModel } from './attribution';

@Controller('metrics')
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Post('refresh')
  async refresh(@Req() r: any, @Body() b: { period?: string; model?: AttributionModel } = {}) {
    const rollup = await this.svc.refreshDailyRollup(r.user);
    const attribution = b.period ? await this.svc.refreshAttribution(r.user, b.period, b.model || 'position') : null;
    return { rollup, attribution };
  }

  @Get('daily')
  daily(@Req() r: any, @Query('from') from?: string, @Query('to') to?: string) { return this.svc.getDailyRollup(r.user, { from, to }); }

  @Get('attribution')
  attribution(@Req() r: any, @Query('period') period: string, @Query('model') model?: AttributionModel) {
    return this.svc.getChannelAttribution(r.user, period, model || 'position');
  }
}
