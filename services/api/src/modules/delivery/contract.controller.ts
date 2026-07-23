import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../common/public.decorator';
import { ContractService } from './contract.service';
import { ConstructionService } from './construction.service';

@Controller(['contract', 'contracts'])
export class ContractController {
  constructor(
    private readonly svc: ContractService,
    private readonly construction: ConstructionService,
  ) {}

  @Post('from-quotation')
  @UseGuards(AuthGuard)
  fromQuotation(@Req() r: any, @Body() b: any) { return this.svc.createFromQuotation(r.user, b); }

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() r: any, @Body() b: any) { return this.svc.create(r.user, b); }

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }

  @Get(':id')
  @UseGuards(AuthGuard)
  get(@Req() r: any, @Param('id') id: string) { return this.svc.get(r.user, id); }

  /** 发起电子签章：草稿→签署中，调契约锁创建合同并向客户发送签署通知 */
  @Post(':id/send')
  @UseGuards(AuthGuard)
  send(@Req() r: any, @Param('id') id: string) { return this.svc.send(r.user, id); }

  /** 获取客户 H5 签署链接（30min 有效，可直接发给客户或嵌入 iframe） */
  @Get(':id/sign-url')
  @UseGuards(AuthGuard)
  getSignUrl(@Req() r: any, @Param('id') id: string) { return this.svc.getSignUrl(r.user, id); }

  /** 线下签署（不走电子签章时使用，直接标记 signed） */
  @Post(':id/sign')
  @UseGuards(AuthGuard)
  sign(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.sign(r.user, id, b?.signedAt); }

  /** Legacy v2 compatibility: customer signature now uses the Nest contract state machine. */
  @Post(':id/signature')
  @UseGuards(AuthGuard)
  signature(@Req() r: any, @Param('id') id: string, @Body() b: any) {
    return this.svc.sign(r.user, id, b?.signedAt);
  }

  /** Signed contract -> idempotent PostgreSQL delivery project. */
  @Post(':id/delivery-start')
  @UseGuards(AuthGuard)
  async deliveryStart(@Req() r: any, @Param('id') id: string, @Body() b: any) {
    const delivery = await this.construction.createProjectForContract(r.user, {
      contractId: id,
      paymentPlan: b?.paymentPlan,
    });
    return { contract: await this.svc.get(r.user, id), delivery };
  }

  /** 2.4：查询客户签收存证闭环（已签 PDF artifact + 签署时间） */
  @Get(':id/acceptance')
  @UseGuards(AuthGuard)
  acceptance(@Req() r: any, @Param('id') id: string) { return this.svc.getCustomerAcceptance(r.user, id); }

  @Post(':id/activate')
  @UseGuards(AuthGuard)
  activate(@Req() r: any, @Param('id') id: string) { return this.svc.activate(r.user, id); }

  @Post(':id/fulfill')
  @UseGuards(AuthGuard)
  fulfill(@Req() r: any, @Param('id') id: string) { return this.svc.fulfill(r.user, id); }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  cancel(@Req() r: any, @Param('id') id: string) { return this.svc.cancel(r.user, id); }

  /**
   * 契约锁 Webhook 回调（无需 JWT，由契约锁签名鉴权）
   * 需在 main.ts NestFactory.create 中开启 rawBody: true
   * @Public()：全局 APP_GUARD 为 deny-by-default，缺 @Public 会令回调恒 401；
   * 鉴权改由 x-qys-signature 签名在 service 层校验（handleWebhook）。
   */
  @Public()
  @Post('webhook/qiyuesuo')
  qiyuesuoWebhook(
    @Req() req: any,
    @Headers('x-qys-signature') signature: string,
  ) {
    const rawBody: string = req.rawBody ?? JSON.stringify(req.body);
    return this.svc.handleWebhook(rawBody, signature ?? '');
  }
}
