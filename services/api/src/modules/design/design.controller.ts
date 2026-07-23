import { Body, Controller, Get, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DesignService, DesignCalcInput } from './design.service';

@UseGuards(AuthGuard)
@Controller('design')
export class DesignController {
  constructor(private readonly svc: DesignService) {}

  @Post('load-calc')
  loadCalc(@Body() body: { area: number; city?: string; buildingType?: string }) {
    return this.svc.quickEstimate(body.area, body.city ?? '上海', body.buildingType ?? 'residential');
  }

  // W1 精算归位：七系统 + 五恒维度 + 必算校验闸（软闸）
  @Post('calc')
  calc(@Request() req: any, @Body() body: DesignCalcInput) {
    return this.svc.runCalc(body, req.user);
  }

  // ── 签章状态机：draft → reviewed → released（软闸 + 签字越过） ───────────
  @Post('releases')
  createRelease(@Request() req: any, @Body() body: DesignCalcInput & { projectId?: string; customerId?: string }) {
    return this.svc.createRelease(req.user, body);
  }

  @Get('releases/:id')
  getRelease(@Request() req: any, @Param('id') id: string) {
    return this.svc.getRelease(req.user, id);
  }

  // 计算书（W-BIM-1 · 1.5b）：结构化报告，前端/PDF 渲染单一来源
  @Get('releases/:id/report')
  getReleaseReport(@Request() req: any, @Param('id') id: string) {
    return this.svc.getReleaseReport(req.user, id);
  }

  @Post('releases/:id/review')
  reviewRelease(@Request() req: any, @Param('id') id: string) {
    return this.svc.reviewRelease(req.user, id);
  }

  @Post('releases/:id/override')
  signOverride(@Request() req: any, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.svc.signOverride(req.user, id, body?.reason);
  }

  @Post('releases/:id/release')
  release(@Request() req: any, @Param('id') id: string, @Body() body: { disclaimerAccepted?: boolean }) {
    return this.svc.releaseDesign(req.user, id, { disclaimerAccepted: body?.disclaimerAccepted });
  }

  @Post('floor-plans')
  save(@Request() req: any, @Body() body: Record<string, unknown>) {
    return this.svc.saveFloorPlan(req.user, body);
  }

  @Get('projects')
  list(@Request() req: any) {
    return this.svc.listProjects(req.user);
  }

  @Post('projects/from-opportunity')
  createFromOpportunity(@Request() req: any, @Body() body: {
    opportunityId: string; customerId: string; name?: string;
    area?: number; city?: string; systems?: string[]; painPoints?: string[];
  }) {
    return this.svc.createProjectFromOpportunity(req.user, body);
  }

  @Get('projects/:projectId/floor-plan')
  getPlan(@Request() req: any, @Param('projectId') projectId: string) {
    return this.svc.getLatestPlan(req.user, projectId);
  }

  /** 3.5 · BOM 价格带：根据项目户型中的系统列表返回产品目录真实牌价分布 */
  @Get('projects/:projectId/bom-price')
  getBomPrice(@Request() req: any, @Param('projectId') projectId: string) {
    return this.svc.getBomPriceBands(req.user, projectId);
  }

  /** 3.5 · BOM/工程图 PDF 导出：返回 application/pdf 二进制 */
  @Get('projects/:projectId/export-pdf')
  async exportPdf(@Request() req: any, @Param('projectId') projectId: string, @Res() res: any) {
    const buf = await this.svc.exportBomPdf(req.user, projectId);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="BOM_${projectId.slice(0, 8)}.pdf"`);
    res.send(buf);
  }

  // ── 工作区状态（BIM 编辑器自动保存与恢复）────────────────────────────────
  @Post('projects/:projectId/workspace-state')
  saveWorkspaceState(@Request() req: any, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    return this.svc.saveWorkspaceState(req.user, projectId, body);
  }

  @Get('projects/:projectId/workspace-state')
  getWorkspaceState(@Request() req: any, @Param('projectId') projectId: string) {
    return this.svc.getWorkspaceState(req.user, projectId);
  }

  @Post('projects/:projectId/progress')
  saveProgress(@Request() req: any, @Param('projectId') projectId: string, @Body() body: { step?: string; percent?: number; note?: string }) {
    return this.svc.saveProgress(req.user, projectId, body);
  }

  @Get('projects/:projectId/progress')
  getProgress(@Request() req: any, @Param('projectId') projectId: string) {
    return this.svc.getProgress(req.user, projectId);
  }

  @Post('projects/:projectId/autosave')
  autosave(@Request() req: any, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    return this.svc.autosave(req.user, projectId, body);
  }

  // ── 候选端点（Stub · 计算服务未接入）────────────────────────────────────
  @Post('quick/estimate')
  quickEstimateV2(@Body() body: { area?: number; city?: string; buildingType?: string }) {
    return this.svc.quickEstimateV2(body.area ?? 0, body.city ?? '上海', body.buildingType ?? 'residential');
  }

  @Post('load/calculation')
  loadCalculation(@Body() body: { area?: number; city?: string; buildingType?: string }) {
    return this.svc.loadCalculation(body);
  }

  @Post('equipment/recommendation')
  equipmentRecommendation(@Request() req: any, @Body() body: { area?: number; systems?: string[]; city?: string }) {
    return this.svc.equipmentRecommendation(req.user, body);
  }

  @Post('materials/generate')
  generateMaterials(@Request() req: any, @Body() body: Record<string, unknown>) {
    return this.svc.generateMaterials(req.user, body);
  }

  @Post('layout/generate')
  generateLayout(@Body() body: Record<string, unknown>) {
    return this.svc.generateLayout(body);
  }

  @Post('layout/collision')
  collisionCheck(@Body() body: Record<string, unknown>) {
    return this.svc.collisionCheck(body);
  }

  @Post('layout/optimize-pipes')
  optimizePipes(@Body() body: Record<string, unknown>) {
    return this.svc.optimizePipes(body);
  }

  @Post('layout/optimize-ducts')
  optimizeDucts(@Body() body: Record<string, unknown>) {
    return this.svc.optimizeDucts(body);
  }

  @Post('layout/radiant-coil')
  generateRadiantCoil(@Body() body: Record<string, unknown>) {
    return this.svc.generateRadiantCoil(body);
  }

  @Post('layout/auto-route')
  autoRoute(@Body() body: Record<string, unknown>) {
    return this.svc.autoRoute(body);
  }

  @Post('cfd/simulate')
  simulateCfd(@Body() body: Record<string, unknown>) {
    return this.svc.simulateCfd(body);
  }

  @Post('cad/upload')
  uploadCad(@Body() body: Record<string, unknown>) {
    return this.svc.uploadCad(body);
  }

  @Post('cad/parse')
  parseCad(@Body() body: Record<string, unknown>) {
    return this.svc.parseCad(body);
  }

  @Post('3d/render')
  render3d(@Body() body: Record<string, unknown>) {
    return this.svc.render3d(body);
  }

  @Get('3d/render/:renderId/status')
  render3dStatus(@Param('renderId') renderId: string) {
    return this.svc.render3dStatus(renderId);
  }

  @Post('export')
  exportDesign(@Body() body: Record<string, unknown>) {
    return this.svc.exportDesign(body);
  }

  @Post('diagram/system')
  generateSystemDiagram(@Body() body: Record<string, unknown>) {
    return this.svc.generateSystemDiagram(body);
  }

  @Get('templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  @Post('templates/:templateId/use')
  useTemplate(@Request() req: any, @Param('templateId') templateId: string, @Body() body: Record<string, unknown>) {
    return this.svc.useTemplate(req.user, templateId, body);
  }
}
