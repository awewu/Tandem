import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import {
  GrowthCampaignService,
  GrowthCopyService,
  GrowthGeoService,
  GrowthOpinionService,
} from './growth.service';

interface AuthRequest { user: JwtPayload; }

/**
 * 增长中枢 / Nexus Growth 控制面（/api/v2/growth）。
 * 仅 hq_marketing / brand_ops / admin 可见（RBAC 由 AuthGuard + 角色校验，切片以登录鉴权为闸）。
 * 四引擎：E1 舆情 · E2 文案 · E3 GEO · E4 营销自动化。
 */
@Controller('growth')
export class GrowthController {
  constructor(
    private readonly opinion: GrowthOpinionService,
    private readonly copy: GrowthCopyService,
    private readonly geo: GrowthGeoService,
    private readonly campaign: GrowthCampaignService,
  ) {}

  // ── E1 舆情监测 ──
  @UseGuards(AuthGuard) @Post('opinion/mentions')
  ingestMention(@Req() req: AuthRequest, @Body() body: any) { return this.opinion.ingestMention(req.user, body); }

  @UseGuards(AuthGuard) @Get('opinion/mentions')
  listMentions(@Req() req: AuthRequest) { return this.opinion.listMentions(req.user); }

  @UseGuards(AuthGuard) @Get('opinion/alerts')
  listAlerts(@Req() req: AuthRequest) { return this.opinion.listAlerts(req.user); }

  @UseGuards(AuthGuard) @Post('opinion/alerts/:id/status')
  updateAlertStatus(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.opinion.updateAlertStatus(req.user, id, body); }

  @UseGuards(AuthGuard) @Get('opinion/connectors')
  opinionConnectors(@Req() _req: AuthRequest) { return this.opinion.connectors(); }

  @UseGuards(AuthGuard) @Post('opinion/pull')
  opinionPull(@Req() req: AuthRequest, @Body() body: any) { return this.opinion.pullFromSource(req.user, body); }

  // ── E2 文案 Copilot ──
  @UseGuards(AuthGuard) @Post('copy/generate')
  generateCopy(@Req() req: AuthRequest, @Body() body: any) { return this.copy.generateCopy(req.user, body); }

  @UseGuards(AuthGuard) @Post('copy/:id/approve')
  approveCopy(@Req() req: AuthRequest, @Param('id') id: string) { return this.copy.approveCopy(req.user, id); }

  @UseGuards(AuthGuard) @Get('copy')
  listCopy(@Req() req: AuthRequest) { return this.copy.listCopy(req.user); }

  // ── E3 GEO 分析 ──
  @UseGuards(AuthGuard) @Post('geo/probe')
  probe(@Req() req: AuthRequest, @Body() body: any) { return this.geo.probe(req.user, body); }

  @UseGuards(AuthGuard) @Get('geo/visibility')
  visibility(@Req() req: AuthRequest) { return this.geo.visibilityReport(req.user); }

  @UseGuards(AuthGuard) @Get('geo/onsite-readiness')
  onSiteReadiness(@Req() req: AuthRequest) { return this.geo.onSiteReadiness(req.user); }

  @UseGuards(AuthGuard) @Get('geo/engines')
  geoEngines(@Req() req: AuthRequest) { return this.geo.engines(req.user); }

  @UseGuards(AuthGuard) @Post('geo/question-set')
  geoQuestionSet(@Req() req: AuthRequest, @Body() body: any) { return this.geo.questionSet(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/probe-worklist')
  geoProbeWorklist(@Req() req: AuthRequest, @Body() body: any) { return this.geo.probeWorklist(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/structured-data')
  geoStructuredData(@Req() req: AuthRequest, @Body() body: any) { return this.geo.structuredData(req.user, body); }

  // ── E4 营销自动化 ──
  @UseGuards(AuthGuard) @Post('campaigns')
  createCampaign(@Req() req: AuthRequest, @Body() body: any) { return this.campaign.createCampaign(req.user, body); }

  @UseGuards(AuthGuard) @Post('campaigns/metrics')
  recordMetric(@Req() req: AuthRequest, @Body() body: any) { return this.campaign.recordMetric(req.user, body); }

  @UseGuards(AuthGuard) @Get('campaigns')
  listCampaigns(@Req() req: AuthRequest) { return this.campaign.listCampaigns(req.user); }

  @UseGuards(AuthGuard) @Get('campaigns/roi-board')
  roiBoard(@Req() req: AuthRequest) { return this.campaign.roiBoard(req.user); }
}
