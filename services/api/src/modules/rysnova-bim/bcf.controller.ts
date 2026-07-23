import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BcfService } from './bcf.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/bcf')
export class BcfController {
  constructor(private readonly svc: BcfService) {}

  @Get('topics')
  list(@Req() r: any, @Query() q: any) { return this.svc.listTopics(r.user, q); }

  @Post('topics')
  create(@Req() r: any, @Body() b: any) { return this.svc.createTopic(r.user, b); }

  @Get('topics/:id')
  get(@Req() r: any, @Param('id') id: string) { return this.svc.getTopic(r.user, id); }

  @Post('topics/:id/comments')
  comment(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.addComment(r.user, id, b); }

  @Put('topics/:id/status')
  status(@Req() r: any, @Param('id') id: string, @Body('status') status: string) { return this.svc.updateStatus(r.user, id, status); }

  @Put('topics/:id/assign')
  assign(@Req() r: any, @Param('id') id: string, @Body('assignedTo') assignedTo: string) { return this.svc.assign(r.user, id, assignedTo); }
}
