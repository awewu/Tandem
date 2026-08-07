import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GtmplanService } from './gtmplan.service';

@Controller('gtmplan')
@UseGuards(AuthGuard)
export class GtmplanController {
  constructor(private readonly svc: GtmplanService) {}

  @Post('campaigns')
  createCampaign(@Req() r: any, @Body() b: any) { return this.svc.createCampaign(r.user, b); }

  @Patch('campaigns/:id')
  updateCampaign(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.updateCampaign(r.user, id, b); }

  @Get('campaigns')
  listCampaigns(@Req() r: any) { return this.svc.listCampaigns(r.user); }

  @Get('mroi')
  mroi(@Req() r: any) { return this.svc.mroiSummary(r.user); }

  @Post('okrs')
  upsertOkr(@Req() r: any, @Body() b: any) { return this.svc.upsertOkr(r.user, b); }

  @Get('okrs')
  listOkrs(@Req() r: any, @Query('level') level?: string) { return this.svc.listOkrs(r.user, level); }

  @Get('okr-summary')
  okrSummary(@Req() r: any) { return this.svc.okrSummary(r.user); }
}
