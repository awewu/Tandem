import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { InsightService } from './insight.service';

@Controller('insight')
@UseGuards(AuthGuard)
export class InsightController {
  constructor(private readonly svc: InsightService) {}

  @Post('competitor')
  recordCompetitor(@Req() r: any, @Body() b: any) { return this.svc.recordCompetitor(r.user, b); }

  @Get('competitor')
  listByCategory(@Req() r: any, @Query('category') category: string, @Query('dimension') dimension?: string) { return this.svc.listByCategory(r.user, category, dimension); }

  @Get('sov')
  sov(@Req() r: any, @Query('category') category: string) { return this.svc.sovByCategory(r.user, category); }

  /** 竞争格局：集中度 HHI + 动量 + 头部差距 + 威胁评分（需 GEO 探测时序数据）。 */
  @Get('landscape')
  landscape(@Req() r: any, @Query('category') category: string, @Query('windowDays') windowDays?: string) {
    return this.svc.landscapeByCategory(r.user, category, { windowDays: windowDays ? Number(windowDays) : undefined });
  }

  @Post('signal')
  recordSignal(@Req() r: any, @Body() b: any) { return this.svc.recordSignal(r.user, b); }

  @Get('signal')
  listSignals(@Req() r: any, @Query() q: any) { return this.svc.listSignals(r.user, q); }
}
