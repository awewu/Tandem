import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CrmService } from './crm.service';

@Controller('crm')
@UseGuards(AuthGuard)
export class CrmController {
  constructor(private readonly svc: CrmService) {}

  @Post('leads')
  createLead(@Req() r: any, @Body() b: any) { return this.svc.createLead(r.user, b); }

  @Get('customers')
  listCustomers(@Req() r: any, @Query() q: any) { return this.svc.listCustomers(r.user, q); }

  @Get('pipeline')
  listPipeline(@Req() r: any) { return this.svc.listPipeline(r.user); }

  @Get('customers/:id')
  getCustomer360(@Req() r: any, @Param('id') id: string) { return this.svc.getCustomer360(r.user, id); }

  @Put('opportunities/:id/stage')
  updateStage(@Req() r: any, @Param('id') id: string, @Body('stage') stage: string) {
    return this.svc.updateOpportunityStage(r.user, id, stage);
  }

  @Put('opportunities/:id')
  updateOpportunity(@Req() r: any, @Param('id') id: string, @Body() b: any) {
    return this.svc.updateOpportunity(r.user, id, b);
  }

  @Post('interactions')
  addInteraction(@Req() r: any, @Body() b: any) { return this.svc.addInteraction(r.user, b); }

  // 签单：标记 signed + 触发 BIM 承接（原子操作）
  @Post('opportunities/:id/sign')
  sign(@Req() r: any, @Param('id') id: string, @Body('quotationId') qid: string) {
    return this.svc.sign(r.user, id, qid);
  }
}
