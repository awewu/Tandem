import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AftersalesService } from './aftersales.service';

@Controller('aftersales')
@UseGuards(AuthGuard)
export class AftersalesController {
  constructor(private readonly svc: AftersalesService) {}

  // ── 工单 ──────────────────────────────────────────────────────────────────
  @Get('tickets')
  listTickets(@Req() r: any, @Query() q: any) { return this.svc.listTickets(r.user, q); }

  @Post('tickets')
  createTicket(@Req() r: any, @Body() b: any) { return this.svc.createTicket(r.user, b); }

  @Put('tickets/:id/assign')
  assign(@Req() r: any, @Param('id') id: string, @Body('assignedTo') assignedTo: string) {
    return this.svc.assignTicket(r.user, id, assignedTo);
  }

  @Put('tickets/:id/status')
  updateStatus(@Req() r: any, @Param('id') id: string, @Body('status') status: string) {
    return this.svc.updateStatus(r.user, id, status);
  }

  @Post('tickets/:id/close')
  close(@Req() r: any, @Param('id') id: string, @Body('resolution') resolution: string) {
    return this.svc.closeTicket(r.user, id, resolution);
  }

  // ── 保修台账 ──────────────────────────────────────────────────────────────
  @Get('warranties')
  listWarranties(@Req() r: any, @Query() q: any) { return this.svc.listWarranties(r.user, q); }

  @Post('warranties')
  createWarranty(@Req() r: any, @Body() b: any) { return this.svc.createWarranty(r.user, b); }
}
