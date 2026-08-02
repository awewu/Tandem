import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DesignService } from './design.service';

@Controller('design')
@UseGuards(AuthGuard)
export class DesignController {
  constructor(private readonly svc: DesignService) {}

  @Get('projects')
  listProjects(@Req() r: any, @Query('status') status?: string, @Query('search') search?: string) {
    return this.svc.listProjects(r.user, { status, search });
  }

  @Post('projects')
  createProject(@Req() r: any, @Body() body: { name: string; customerId?: string; opportunityId?: string; meta?: Record<string, unknown> }) {
    return this.svc.createProject(r.user, body);
  }

  @Get('projects/:projectId')
  getProject(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.getProject(r.user, projectId);
  }

  @Patch('projects/:projectId')
  updateProject(@Req() r: any, @Param('projectId') projectId: string, @Body() patch: Record<string, unknown>) {
    return this.svc.updateProject(r.user, projectId, patch);
  }

  @Delete('projects/:projectId')
  deleteProject(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.deleteProject(r.user, projectId);
  }

  @Post('calc/:projectId')
  runCalc(@Req() r: any, @Param('projectId') projectId: string, @Body() input: Record<string, unknown>) {
    return this.svc.runCalc(r.user, projectId, input);
  }

  @Get('floor-plans/:projectId/latest')
  getLatestPlan(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.getLatestPlan(r.user, projectId);
  }

  @Post('floor-plans/:projectId')
  saveFloorPlan(@Req() r: any, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    return this.svc.saveFloorPlan(r.user, projectId, body);
  }

  @Get('releases')
  listReleases(@Req() r: any, @Query('projectId') projectId?: string) {
    return this.svc.listReleases(r.user, projectId);
  }

  @Post('releases')
  createRelease(@Req() r: any, @Body() body: { projectId: string; calcSnapshot: Record<string, unknown>; gatePass?: boolean; gateBlocked?: boolean; disclaimerAccepted?: boolean }) {
    return this.svc.createRelease(r.user, body);
  }

  @Post('releases/:releaseId/:action')
  signRelease(@Req() r: any, @Param('releaseId') releaseId: string, @Param('action') action: 'review' | 'release' | 'override', @Body() body?: { reason?: string }) {
    return this.svc.signRelease(r.user, releaseId, action, body);
  }

  @Get('sync/:designId')
  getSyncStatus(@Req() r: any, @Param('designId') designId: string) {
    return this.svc.getSyncStatus(r.user, designId);
  }

  @Post('sync/:designId/propose-change')
  proposeChange(@Req() r: any, @Param('designId') designId: string, @Body() body: { designVersion: string; changeProposal: Record<string, unknown> }) {
    return this.svc.proposeChange(r.user, designId, body);
  }

  @Post('sync/:syncId/confirm')
  confirmSync(@Req() r: any, @Param('syncId') syncId: string) {
    return this.svc.confirmSync(r.user, syncId);
  }
}
