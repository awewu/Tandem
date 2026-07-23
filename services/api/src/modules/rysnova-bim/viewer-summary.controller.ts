import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ViewerSummaryInput, ViewerSummaryService } from './viewer-summary.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/viewer-summaries')
export class ViewerSummaryController {
  constructor(private readonly svc: ViewerSummaryService) {}

  @Post()
  create(@Req() r: any, @Body() b: ViewerSummaryInput) {
    return this.svc.save(r.user, b);
  }

  @Get('latest')
  latest(@Req() r: any, @Query('draftId') draftId: string) {
    return this.svc.latest(r.user, draftId);
  }

  @Get(':id')
  get(@Req() r: any, @Param('id') id: string) {
    return this.svc.get(r.user, id);
  }

  @Put(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() b: ViewerSummaryInput) {
    return this.svc.save(r.user, { ...b, id });
  }
}
