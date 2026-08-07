import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ActivationService } from './activation.service';

@Controller('activation')
@UseGuards(AuthGuard)
export class ActivationController {
  constructor(private readonly svc: ActivationService) {}

  @Post('activities') create(@Req() r: any, @Body() b: any) { return this.svc.create(r.user, b); }
  @Get('activities') list(@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }
  @Post('activities/:id/status') setStatus(@Req() r: any, @Param('id') id: string, @Body('status') status: string) { return this.svc.setStatus(r.user, id, status); }
  @Post('participate') participate(@Req() r: any, @Body() b: any) { return this.svc.participate(r.user, b); }
}
