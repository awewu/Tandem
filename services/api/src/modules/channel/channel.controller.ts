import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ChannelService } from './channel.service';

@Controller('channel')
@UseGuards(AuthGuard)
export class ChannelController {
  constructor(private readonly svc: ChannelService) {}

  @Post('partners')
  recruit(@Req() r: any, @Body() b: any) { return this.svc.recruitPartner(r.user, b); }

  @Get('partners')
  listPartners(@Req() r: any, @Query() q: any) { return this.svc.listPartners(r.user, q); }

  @Patch('partners/:id')
  updatePartner(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.updatePartner(r.user, id, b); }

  @Post('rebates')
  submitRebate(@Req() r: any, @Body() b: any) { return this.svc.submitRebate(r.user, b); }

  @Get('rebates')
  listRebates(@Req() r: any) { return this.svc.listRebates(r.user); }

  @Post('rebates/:id/decision')
  decideRebate(@Req() r: any, @Param('id') id: string, @Body('decision') decision: 'approved' | 'rejected' | 'paid') { return this.svc.decideRebate(r.user, id, decision); }

  @Post('performance')
  recordPerformance(@Req() r: any, @Body() b: any) { return this.svc.recordPerformance(r.user, b); }

  @Get('health')
  health(@Req() r: any) { return this.svc.channelHealth(r.user); }
}
