import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ContractsService } from './contracts.service';

@Controller('contracts')
@UseGuards(AuthGuard)
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  @Post('from-quotation')
  createFromQuotation(@Req() r: any, @Body() body: {
    quotationId?: string;
    customerId?: string;
    dealerId?: string;
    storeId?: string;
    contractNo?: string;
    totalAmount?: number;
    terms?: Record<string, unknown>;
  }) {
    return this.svc.createFromQuotation(r.user, body);
  }

  @Get()
  list(@Req() r: any, @Query('customerId') customerId?: string, @Query('status') status?: string, @Query('dealerId') dealerId?: string) {
    return this.svc.list(r.user, { customerId, status, dealerId });
  }

  @Get(':contractId')
  getByContractId(@Req() r: any, @Param('contractId') contractId: string) {
    return this.svc.getByContractId(r.user, contractId);
  }

  @Post(':contractId/signature')
  markSigned(@Req() r: any, @Param('contractId') contractId: string, @Body() body: { method?: string; signedAt?: string; evidenceUrl?: string }) {
    return this.svc.markSigned(r.user, contractId, body);
  }

  @Post(':contractId/approval')
  decideApproval(@Req() r: any, @Param('contractId') contractId: string, @Body() body: { decision: 'approved' | 'rejected'; reason?: string }) {
    return this.svc.decideApproval(r.user, contractId, body);
  }

  @Post(':contractId/payments')
  recordPayment(@Req() r: any, @Param('contractId') contractId: string, @Body() body: { amount: number; method?: string; receiptNo?: string; note?: string }) {
    return this.svc.recordPayment(r.user, contractId, body);
  }

  @Post(':contractId/delivery-start')
  startDelivery(@Req() r: any, @Param('contractId') contractId: string, @Body() body: { projectAddress?: string; systems?: string[] }) {
    return this.svc.startDelivery(r.user, contractId, body);
  }
}
