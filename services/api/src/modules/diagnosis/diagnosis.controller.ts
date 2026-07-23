import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { DiagnosisService } from './diagnosis.service';
import { DiagnosisAiService, QuickAnalyzeInput } from './diagnosis-ai.service';
import { DepositService } from './deposit.service';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';

interface AuthRequest { user: JwtPayload; }

@Controller('diagnosis')
export class DiagnosisController {
  constructor(
    private readonly svc: DiagnosisService,
    private readonly ai: DiagnosisAiService,
    private readonly deposit: DepositService,
  ) {}

  /**
   * 公开问诊完成（匿名 C 端）。PIPL 同意闸在 service 侧强制（无同意 403）。
   * 收割自 Legacy /api/v2/diagnosis/public/complete；@Public + 频率限制防滥用。
   */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('public/complete')
  publicComplete(@Req() req: any, @Body() body: unknown) {
    const ip = (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req?.ip;
    return this.svc.completePublicDiagnosis(body, { ip, userAgent: req?.headers?.['user-agent'] });
  }

  /**
   * 公开快速 AI 分析（匿名，无状态，不落 PII）。收割自 Legacy /api/v2/diagnosis/public/ai-analyze，
   * 响应契约兼容：{ success, data: { systems, systemLabels, combination, reasoning, priority } }。
   * 无模型 Key 时规则兜底（不再像 Legacy 返 503），前端口径不变。
   */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('public/ai-analyze')
  async publicAiAnalyze(@Body() body: QuickAnalyzeInput) {
    const data = await this.ai.aiAnalyze(body || {});
    return { success: true, data };
  }

  /** 公开痛点提纲（匿名，纯数据）：渐进式问诊用——高频痛点 + 按维度折叠的次级痛点。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Get('painpoints')
  painPointCatalog() {
    return this.svc.getPainPointCatalog();
  }

  /** 公开痛点探测（匿名，纯数据）：按户型自动勾选 + 推断隐性痛点（像医生看诊提示）。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('painpoints/detect')
  detectPainPoints(@Body() body: unknown) {
    return this.svc.detectPainPoints(body);
  }

  /**
   * 公开对话式问诊（匿名，无状态，不落 PII）：进化版对话脑。
   * 有 LLM Key 走真模型结构化抽取，无 Key 自动降级纯规则。返回痛点映射/隐性痛点/下一问/共识画像/GEO 选题。
   */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('consult')
  consult(@Body() body: unknown) {
    return this.svc.consult(body);
  }

  /**
   * 公开初步选型报价（匿名，诚实版）：痛点/系统 → 产品目录真实牌价 → 三档区间。
   * 无目录价的系统标「需现场核算」，全部标注「以现场勘测为准」；不含编造数字。
   */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('quote')
  quote(@Body() body: unknown) {
    return this.svc.indicativeQuote(body);
  }

  /** 公开原理示意图（匿名，纯数据）：系统如何协同的示意图（含内联 SVG），标注非工程图纸。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('principle-diagram')
  principleDiagram(@Body() body: unknown) {
    return this.svc.principleDiagram(body);
  }

  /** 公开案例/效果（匿名，只读真实策展内容）：按系统/城市/户型返回真实案例，无内容则空。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('cases')
  cases(@Body() body: unknown) {
    return this.svc.cases(body);
  }

  /**
   * 公开可退定金意向（匿名，凭 reportId+shareToken）：路由到「线索所属经销商」各自收款路径。
   * 无在线渠道 → 线下向经销商支付兜底；平台不收款，只下单+跟踪+发事件（赋能经销商）。
   */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('deposit/intent')
  depositIntent(@Body() body: unknown) {
    return this.deposit.createIntentByReport(body);
  }

  /** 经销商：维护自己的收款路径（线下/收款码/自有链接/自有商户）。 */
  @UseGuards(AuthGuard)
  @Post('deposit/config')
  setDepositConfig(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.deposit.setDealerConfig(req.user, body);
  }

  /** 经销商：读取自己的收款路径配置。 */
  @UseGuards(AuthGuard)
  @Get('deposit/config')
  getDepositConfig(@Req() req: AuthRequest) {
    return this.deposit.getDealerConfig(req.user);
  }

  /** 经销商：确认已收款（状态机 mark_paid → 发 deposit.paid）。 */
  @UseGuards(AuthGuard)
  @Post('deposit/:depositId/confirm')
  confirmDeposit(@Req() req: AuthRequest, @Param('depositId') depositId: string) {
    return this.deposit.confirmPaid(req.user, depositId);
  }

  /** 经销商：退定金（状态机 refund → 发 deposit.refunded）。 */
  @UseGuards(AuthGuard)
  @Post('deposit/:depositId/refund')
  refundDeposit(@Req() req: AuthRequest, @Param('depositId') depositId: string) {
    return this.deposit.refund(req.user, depositId);
  }

  /** 公开定位推荐（匿名，脱敏，fail-soft）。收割自 Legacy /public/recommend。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('public/recommend')
  publicRecommend(@Body() body: unknown) {
    return this.svc.recommendPublic(body);
  }

  /** 公开报告读取（凭 shareToken）。收割自 Legacy /public/reports/:id。 */
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Get('public/reports/:reportId')
  publicReport(@Param('reportId') reportId: string, @Query('shareToken') shareToken: string) {
    return this.svc.findPublicReport(reportId, shareToken);
  }

  @UseGuards(AuthGuard)
  @Post('complete')
  complete(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.svc.completeDiagnosis(req.user, body);
  }

  @UseGuards(AuthGuard)
  @Get('reports')
  list(@Req() req: AuthRequest) {
    return this.svc.listSessions(req.user);
  }

  @UseGuards(AuthGuard)
  @Get('reports/:reportId')
  detail(@Req() req: AuthRequest, @Param('reportId') reportId: string) {
    return this.svc.getReport(req.user, reportId);
  }

  @Public()
  @Get('reports/:reportId/share-view')
  shareView(@Param('reportId') reportId: string, @Query('shareToken') shareToken: string) {
    return this.svc.getShareView(reportId, shareToken);
  }

  @UseGuards(AuthGuard)
  @Post('reports/:reportId/revoke')
  revoke(@Req() req: AuthRequest, @Param('reportId') reportId: string) {
    return this.svc.revokeReport(req.user, reportId);
  }
}
