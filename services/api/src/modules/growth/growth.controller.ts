import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import {
  GrowthCampaignService,
  GrowthCopyService,
  GrowthGeoService,
  GrowthMarketingMaterialService,
  GrowthOpinionService,
} from './growth.service';
import { AgenticGeoService } from './agentic-geo.service';
import { GeoFocusService } from './geo-focus.service';

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
    private readonly materials: GrowthMarketingMaterialService,
    private readonly agentic: AgenticGeoService,
    private readonly geoFocus: GeoFocusService,
  ) {}

  // ── AgenticGEO 自主闭环（受治理·飞轮第一环）──
  @UseGuards(AuthGuard) @Post('geo/agentic/plan')
  agenticPlan(@Req() req: AuthRequest, @Body() body: any) { return this.agentic.planLoop(req.user, body || {}); }

  @UseGuards(AuthGuard) @Post('geo/agentic/approve')
  agenticApprove(@Req() req: AuthRequest, @Body() body: any) { return this.agentic.approve(req.user, body?.actionId, body?.input); }

  @UseGuards(AuthGuard) @Get('geo/agentic/status')
  agenticStatus(@Req() _req: AuthRequest) { return this.agentic.status(); }

  // ── GEO 进化（借鉴分众智投）：选点·千面·认知资产·引爆·重分配 ──
  @UseGuards(AuthGuard) @Post('geo/agentic/ignite')
  agenticIgnite(@Req() req: AuthRequest, @Body() body: { category: string; segment?: string; limit?: number }) { return this.agentic.planIgnition(req.user, body?.category, body || {}); }

  @UseGuards(AuthGuard) @Post('geo/focus/targets')
  upsertTarget(@Req() req: AuthRequest, @Body() body: any) { return this.geoFocus.upsertTarget(req.user, body); }

  @UseGuards(AuthGuard) @Get('geo/focus/targets')
  listTargets(@Req() req: AuthRequest, @Query('category') category?: string) { return this.geoFocus.listTargets(req.user, category); }

  @UseGuards(AuthGuard) @Get('geo/focus/select')
  selectTargets(@Req() req: AuthRequest, @Query('category') category: string, @Query('segment') segment?: string, @Query('limit') limit?: string) { return this.geoFocus.selectTargets(req.user, category, { segment, limit: limit ? Number(limit) : undefined }); }

  @UseGuards(AuthGuard) @Post('geo/focus/cognition')
  recordCognition(@Req() req: AuthRequest, @Body() body: any) { return this.geoFocus.recordCognition(req.user, body); }

  @UseGuards(AuthGuard) @Get('geo/focus/cognition')
  cognitionFunnel(@Req() req: AuthRequest, @Query('category') category?: string) { return this.geoFocus.cognitionFunnel(req.user, category); }

  @UseGuards(AuthGuard) @Post('geo/focus/reallocate')
  reallocate(@Req() req: AuthRequest, @Body() body: { adjustments: Array<{ id: string; deltaPriority: number }> }) { return this.geoFocus.reallocate(req.user, body?.adjustments); }

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

  @UseGuards(AuthGuard) @Post('copy/:id/reject')
  rejectCopy(@Req() req: AuthRequest, @Param('id') id: string) { return this.copy.rejectCopy(req.user, id); }

  @UseGuards(AuthGuard) @Patch('copy/:id')
  updateCopy(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.copy.updateCopy(req.user, id, body); }

  @UseGuards(AuthGuard) @Delete('copy/:id')
  removeCopy(@Req() req: AuthRequest, @Param('id') id: string) { return this.copy.removeCopy(req.user, id); }

  @UseGuards(AuthGuard) @Get('copy')
  listCopy(@Req() req: AuthRequest) { return this.copy.listCopy(req.user); }

  // ── E3 GEO 分析 ──
  @UseGuards(AuthGuard) @Post('geo/probe')
  probe(@Req() req: AuthRequest, @Body() body: any) { return this.geo.probe(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/probe-jobs/run')
  runProbeJob(@Req() req: AuthRequest, @Body() body: any) { return this.geo.runProbeJob(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/probe-jobs/stream')
  async streamProbeJob(@Req() req: AuthRequest, @Body() body: any, @Res() reply: any) {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    const emit = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      await this.geo.streamProbeJob(req.user, body, emit);
    } finally {
      reply.raw.end();
    }
  }

  @UseGuards(AuthGuard) @Get('geo/probe-jobs')
  listProbeJobs(@Req() req: AuthRequest) { return this.geo.listProbeJobs(req.user); }

  @UseGuards(AuthGuard) @Get('geo/probe-jobs/:id')
  getProbeJob(@Req() req: AuthRequest, @Param('id') id: string) { return this.geo.getProbeJob(req.user, id); }

  @UseGuards(AuthGuard) @Post('geo/probe-batches/run')
  runProbeBatch(@Req() req: AuthRequest, @Body() body: any) { return this.geo.runProbeBatch(req.user, body); }

  @UseGuards(AuthGuard) @Get('geo/probe-batches')
  listProbeBatches(@Req() req: AuthRequest, @Query() query: any) { return this.geo.listProbeBatches(req.user, query); }

  @UseGuards(AuthGuard) @Get('geo/probe-batches/:id')
  getProbeBatch(@Req() req: AuthRequest, @Param('id') id: string) { return this.geo.getProbeBatch(req.user, id); }

  // GEO 第 7 层 · 闭环实验（探测→缺口→内容→复投→验证 lift）
  @UseGuards(AuthGuard) @Get('geo/experiments')
  listGeoExperiments(@Req() req: AuthRequest, @Query() query: any) { return this.geo.listGeoExperiments(req.user, query); }
  @UseGuards(AuthGuard) @Post('geo/experiments')
  startGeoExperiment(@Req() req: AuthRequest, @Body() body: any) { return this.geo.startGeoExperiment(req.user, body); }
  @UseGuards(AuthGuard) @Get('geo/experiments/:id')
  getGeoExperiment(@Req() req: AuthRequest, @Param('id') id: string) { return this.geo.getGeoExperiment(req.user, id); }
  @UseGuards(AuthGuard) @Post('geo/experiments/:id/link-content')
  linkGeoExperimentContent(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.geo.linkGeoExperimentContent(req.user, id, body); }
  @UseGuards(AuthGuard) @Post('geo/experiments/:id/verify')
  verifyGeoExperiment(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.geo.verifyGeoExperiment(req.user, id, body); }
  // 自进化：查看由实验 lift 反哺学到的策略权重
  @UseGuards(AuthGuard) @Get('geo/strategy-weights')
  getStrategyWeights(@Req() req: AuthRequest, @Query() query: any) { return this.geo.getStrategyWeights(req.user, query); }

  /** AI 视角 SWOT（由探测数据派生，可测而非自评）。 */
  @UseGuards(AuthGuard) @Get('geo/swot')
  getAiSwot(@Req() req: AuthRequest, @Query() query: any) { return this.geo.getAiSwot(req.user, query); }

  // 受治理动作引擎（Foundry Ontology 动词的轻量本地实现）：人与 AI Agent 走同一套治理闸
  @UseGuards(AuthGuard) @Get('geo/actions')
  listGeoActions() { return this.geo.listGeoActions(); }
  @UseGuards(AuthGuard) @Post('geo/actions/:actionId')
  invokeGeoAction(@Req() req: AuthRequest, @Param('actionId') actionId: string, @Body() body: any) {
    return this.geo.invokeGeoAction(req.user, actionId, body?.input ?? body, { isProxy: body?.isProxy, approved: body?.approved });
  }

  @UseGuards(AuthGuard) @Get('geo/visibility')
  visibility(@Req() req: AuthRequest) { return this.geo.visibilityReport(req.user); }

  @UseGuards(AuthGuard) @Get('geo/onsite-readiness')
  onSiteReadiness(@Req() req: AuthRequest) { return this.geo.onSiteReadiness(req.user); }

  @UseGuards(AuthGuard) @Get('geo/engines')
  geoEngines(@Req() req: AuthRequest) { return this.geo.engines(req.user); }

  @UseGuards(AuthGuard) @Post('geo/question-set')
  geoQuestionSet(@Req() req: AuthRequest, @Body() body: any) { return this.geo.questionSet(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/questions')
  createGeoQuestion(@Req() req: AuthRequest, @Body() body: any) { return this.geo.createGeoQuestion(req.user, body); }

  @UseGuards(AuthGuard) @Patch('geo/questions/:id')
  updateGeoQuestion(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.geo.updateGeoQuestion(req.user, id, body); }

  @UseGuards(AuthGuard) @Post('geo/questions/:id/disable')
  disableGeoQuestion(@Req() req: AuthRequest, @Param('id') id: string) { return this.geo.disableGeoQuestion(req.user, id); }

  @UseGuards(AuthGuard) @Delete('geo/questions/:id')
  removeGeoQuestion(@Req() req: AuthRequest, @Param('id') id: string) { return this.geo.removeGeoQuestion(req.user, id); }

  @UseGuards(AuthGuard) @Post('geo/question-set/save-generated')
  saveGeneratedGeoQuestions(@Req() req: AuthRequest, @Body() body: any) { return this.geo.saveGeneratedGeoQuestions(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/probe-worklist')
  geoProbeWorklist(@Req() req: AuthRequest, @Body() body: any) { return this.geo.probeWorklist(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/structured-data')
  geoStructuredData(@Req() req: AuthRequest, @Body() body: any) { return this.geo.structuredData(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/optimization-content')
  geoOptimizationContent(@Req() req: AuthRequest, @Body() body: any) { return this.geo.generateOptimizationContent(req.user, body); }

  @UseGuards(AuthGuard) @Post('geo/optimization-content/stream')
  async streamGeoOptimizationContent(@Req() req: AuthRequest, @Body() body: any, @Res() reply: any) {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    const emit = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      await this.geo.streamOptimizationContent(req.user, body, emit);
    } finally {
      reply.raw.end();
    }
  }

  // ── E4 营销自动化 ──
  @UseGuards(AuthGuard) @Post('campaigns')
  createCampaign(@Req() req: AuthRequest, @Body() body: any) { return this.campaign.createCampaign(req.user, body); }

  @UseGuards(AuthGuard) @Post('campaigns/metrics')
  recordMetric(@Req() req: AuthRequest, @Body() body: any) { return this.campaign.recordMetric(req.user, body); }

  @UseGuards(AuthGuard) @Get('campaigns')
  listCampaigns(@Req() req: AuthRequest) { return this.campaign.listCampaigns(req.user); }

  @UseGuards(AuthGuard) @Get('campaigns/roi-board')
  roiBoard(@Req() req: AuthRequest) { return this.campaign.roiBoard(req.user); }

  // ── E5 营销物料库 ──
  @UseGuards(AuthGuard) @Post('materials')
  createMaterial(@Req() req: AuthRequest, @Body() body: any) { return this.materials.createMaterial(req.user, body); }

  // 多模态生成：AI 生成营销图（经 Tandem 图像网关，落物料库）
  @UseGuards(AuthGuard) @Post('materials/generate-image')
  generateMaterialImage(@Req() req: AuthRequest, @Body() body: any) { return this.materials.generateMaterialImage(req.user, body); }

  @UseGuards(AuthGuard) @Get('materials')
  listMaterials(@Req() req: AuthRequest, @Query() query: any) { return this.materials.listMaterials(req.user, query); }

  @UseGuards(AuthGuard) @Get('materials/:id')
  getMaterial(@Req() req: AuthRequest, @Param('id') id: string) { return this.materials.getMaterial(req.user, id); }

  @UseGuards(AuthGuard) @Patch('materials/:id')
  updateMaterial(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.materials.updateMaterial(req.user, id, body); }

  @UseGuards(AuthGuard) @Post('materials/:id/approve')
  approveMaterial(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) { return this.materials.approveMaterial(req.user, id, body); }

  @UseGuards(AuthGuard) @Post('materials/:id/publish')
  publishMaterial(@Req() req: AuthRequest, @Param('id') id: string) { return this.materials.publishMaterial(req.user, id); }

  @UseGuards(AuthGuard) @Post('materials/:id/download')
  recordMaterialDownload(@Req() req: AuthRequest, @Param('id') id: string) { return this.materials.recordDownload(req.user, id); }

  @UseGuards(AuthGuard) @Post('materials/:id/archive')
  archiveMaterial(@Req() req: AuthRequest, @Param('id') id: string) { return this.materials.archiveMaterial(req.user, id); }

  @UseGuards(AuthGuard) @Delete('materials/:id')
  removeMaterial(@Req() req: AuthRequest, @Param('id') id: string) { return this.materials.removeMaterial(req.user, id); }
}
