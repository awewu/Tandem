import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ContentService } from './content.service';

@Controller('content')
@UseGuards(AuthGuard)
export class ContentController {
  constructor(private readonly svc: ContentService) {}

  @Post() create(@Req() r: any, @Body() b: any) { return this.svc.create(r.user, b); }
  @Get() list(@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }
  @Patch(':id') update(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.update(r.user, id, b); }
  @Post(':id/submit') submit(@Req() r: any, @Param('id') id: string) { return this.svc.submitReview(r.user, id); }
  @Post(':id/decision') decide(@Req() r: any, @Param('id') id: string, @Body() b: { decision: 'approved' | 'rejected' }) { return this.svc.decide(r.user, id, b?.decision); }
  @Post(':id/publish') publish(@Req() r: any, @Param('id') id: string) { return this.svc.publish(r.user, id); }
}
