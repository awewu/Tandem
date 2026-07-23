import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/roles.decorator';
import { AiDesignService, DesignProposalInput } from './ai-design.service';
import { AiDesignAuditService } from './ai-design-audit.service';

@UseGuards(AuthGuard)
@Controller('ai-design')
export class AiDesignController {
  constructor(
    private readonly svc: AiDesignService,
    private readonly audit: AiDesignAuditService,
  ) {}

  private async log(req: any, action: 'propose' | 'verify' | 'review' | 'select-quote', input: any, output: any) {
    try {
      await this.audit.log({
        tenantId: req.user?.tenantId ?? 'unknown',
        projectId: input?.projectId ?? input?.proposal?.projectId ?? 'unknown',
        userId: req.user?.userId ?? null,
        userRole: req.user?.role ?? null,
        actionType: action,
        input: input ?? {},
        output: output ?? {},
        trustState: output?.trustState ?? output?.data?.trustState ?? null,
      });
    } catch (e) {
      // 审计失败不应阻断主流程
      console.error('[ai-design audit]', e);
    }
  }

  /** 4.3 · 销售/设计师/工程师可生成方案草案（信任状态由输入完整度决定） */
  @Roles('sales', 'designer', 'engineer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('propose')
  async propose(@Request() req: any, @Body() body: DesignProposalInput) {
    const result = await this.svc.propose(body);
    await this.log(req, 'propose', body, result);
    return result;
  }

  /** 4.1 · 仅工程师/设计师/管理员可提升信任状态到 verified */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('verify')
  async verify(@Request() req: any, @Body() body: { proposal: any }) {
    const result = await this.svc.verify(body.proposal);
    await this.log(req, 'verify', body, result);
    return result;
  }

  /** 4.4 · LLM 挑错提示（不自出合规结论） */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('review')
  async review(@Request() req: any, @Body() body: { projectId: string; calcResult: any; gateResult: any; question?: string }) {
    const result = await this.svc.reviewCalcGate(body);
    await this.log(req, 'review', body, result);
    return result;
  }

  /** 4.5 · 产品推荐 + 报价快照 */
  @Roles('sales', 'designer', 'engineer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('select-quote')
  async selectQuote(@Request() req: any, @Body() body: { projectId: string; proposal: any; lockMinutes?: number }) {
    const result = await this.svc.selectQuote({ projectId: body.projectId, proposal: body.proposal, lockMinutes: body.lockMinutes });
    await this.log(req, 'select-quote', body, result);
    return result;
  }

  /** 4.6 · 审计链查询 */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Get('projects/:projectId/audits')
  listAudits(@Request() req: any, @Param('projectId') projectId: string) {
    return this.audit.listForProject(req.user?.tenantId ?? 'unknown', projectId);
  }
}
