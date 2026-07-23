import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { QuoteService } from './quote.service';
import { Public } from '../common/public.decorator';

@Controller('quotation')
export class QuoteController {
  constructor(private readonly svc: QuoteService) {}

  // 公开计算端点：纯函数，无数据库/租户数据，C 端问诊与快速估算可直接调用
  @Public() @Post('generate')       @HttpCode(200) generate (@Body() b: any) { return this.svc.generate(b); }
  @Public() @Post('load-calc')      @HttpCode(200) loadCalc (@Body() b: any) { return this.svc.loadCalc(b); }
  @Public() @Post('econet-premium') @HttpCode(200) econet   (@Body() b: any) { return this.svc.econetPremium(b); }

  // 报价导出（公开端点，生成文件不涉及租户隔离数据）
  @Public() @Post('export') @HttpCode(200) exportQuote (@Body() b: any) { return this.svc.exportQuote(b); }

  // M11 · 价格护栏校验（公开计算端点：毛利下限/折扣上限/单行毛利）
  @Public() @Post('guardrail-check') @HttpCode(200) guardrail (@Body() b: any) { return this.svc.checkGuardrails(b); }
  @Post()  @UseGuards(AuthGuard) persist (@Req() r: any, @Body() b: any) { return this.svc.persist(r.user, b); }
  @Get()   @UseGuards(AuthGuard) list    (@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }

  // M11 · 锁定报价价格快照（PRD 4.9）
  @Post(':id/lock') @UseGuards(AuthGuard) @HttpCode(200) lock (@Req() r: any, @Param('id') id: string) { return this.svc.lockQuotation(r.user, id); }
}
