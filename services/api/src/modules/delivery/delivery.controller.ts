import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
@UseGuards(AuthGuard)
export class DeliveryController {
  constructor(private readonly svc: DeliveryService) {}

  @Get('projects')
  listProjects(@Req() r: any, @Query('status') status?: string) {
    return this.svc.listProjects(r.user, { status });
  }

  @Post('projects')
  createProject(@Req() r: any, @Body() body: { contractId: string; customerId: string; quotationId?: string; totalAmount?: number }) {
    return this.svc.createProject(r.user, body);
  }

  @Get('projects/:projectId')
  getProject(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.getProject(r.user, projectId);
  }

  @Get('projects/:projectId/milestones')
  getMilestones(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.getMilestones(r.user, projectId);
  }

  @Post('projects/:projectId/milestones/:milestoneKey/advance')
  advanceMilestone(@Req() r: any, @Param('projectId') projectId: string, @Param('milestoneKey') milestoneKey: string) {
    return this.svc.advanceMilestone(r.user, projectId, milestoneKey);
  }

  @Get('projects/:projectId/payments')
  getPayments(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.getPayments(r.user, projectId);
  }

  @Post('projects/:projectId/payments/:paymentId/record')
  recordPayment(@Req() r: any, @Param('projectId') projectId: string, @Param('paymentId') paymentId: string) {
    return this.svc.recordPayment(r.user, projectId, paymentId);
  }

  @Get('projects/:projectId/evidence')
  listEvidence(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.listEvidence(r.user, projectId);
  }

  @Post('projects/:projectId/evidence')
  uploadEvidence(@Req() r: any, @Param('projectId') projectId: string, @Body() body: { milestoneKey: string; fileKey?: string; fileUrl?: string; meta?: Record<string, unknown> }) {
    return this.svc.uploadEvidence(r.user, projectId, body);
  }
}

@Controller('aftersales')
@UseGuards(AuthGuard)
export class AftersalesController {
  constructor(private readonly svc: DeliveryService) {}

  @Get('tickets')
  listTickets(@Req() r: any, @Query('status') status?: string, @Query('category') category?: string) {
    return this.svc.listTickets(r.user, { status, category });
  }

  @Post('tickets')
  createTicket(@Req() r: any, @Body() body: { title: string; category?: string; priority?: string; customerId?: string; customerName?: string; phone?: string; description?: string; bimProjectId?: string }) {
    return this.svc.createTicket(r.user, body);
  }

  @Patch('tickets/:ticketId')
  updateTicket(@Req() r: any, @Param('ticketId') ticketId: string, @Body() patch: Record<string, unknown>) {
    return this.svc.updateTicket(r.user, ticketId, patch);
  }

  @Get('warranties')
  listWarranties(@Req() r: any, @Query('status') status?: string) {
    return this.svc.listWarranties(r.user, { status });
  }

  @Post('warranties')
  createWarranty(@Req() r: any, @Body() body: { warrantyNo: string; customerId?: string; customerName?: string; productName?: string; systemFamily?: string; startDate: string; endDate: string; bimProjectId?: string; terms?: Record<string, unknown> }) {
    return this.svc.createWarranty(r.user, body);
  }
}

@Controller('lifecycle')
@UseGuards(AuthGuard)
export class LifecycleController {
  constructor(private readonly svc: DeliveryService) {}

  @Get('links/:customerId')
  getLifecycleLink(@Req() r: any, @Param('customerId') customerId: string) {
    return this.svc.getLifecycleLink(r.user, customerId);
  }

  @Post('links')
  upsertLifecycleLink(@Req() r: any, @Body() body: { customerId: string; opportunityId?: string; quotationId?: string; contractId?: string; designProjectId?: string; stage?: string }) {
    return this.svc.upsertLifecycleLink(r.user, body);
  }
}
