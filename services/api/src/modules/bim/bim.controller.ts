import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BimService } from './bim.service';

@Controller('bim')
@UseGuards(AuthGuard)
export class BimController {
  constructor(private readonly svc: BimService) {}

  @Get('projects')
  listProjects(@Req() r: any, @Query('status') status?: string, @Query('search') search?: string) {
    return this.svc.listProjects(r.user, { status, search });
  }

  @Post('projects')
  createProject(@Req() r: any, @Body() body: { customerId: string; quotationId?: string; quotationNo?: string; customerName?: string; city?: string; systemFamilies?: string }) {
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

  @Post('projects/:projectId/accept')
  acceptProject(@Req() r: any, @Param('projectId') projectId: string, @Body() body?: { checklist?: unknown[] }) {
    return this.svc.acceptProject(r.user, projectId, body?.checklist);
  }

  @Delete('projects/:projectId')
  deleteProject(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.deleteProject(r.user, projectId);
  }

  @Get('artifacts')
  listArtifacts(@Req() r: any, @Query('projectId') projectId?: string, @Query('projectKey') projectKey?: string, @Query('status') status?: string) {
    return this.svc.listArtifacts(r.user, { projectId, projectKey, status });
  }

  @Get('artifacts/:artifactId')
  getArtifact(@Req() r: any, @Param('artifactId') artifactId: string) {
    return this.svc.getArtifact(r.user, artifactId);
  }

  @Post('artifacts')
  createArtifact(@Req() r: any, @Body() body: { projectId?: string; projectKey?: string; name: string; artifactType?: string; fileKey?: string; bimData?: Record<string, unknown>; artifactDoc?: Record<string, unknown> }) {
    return this.svc.createArtifact(r.user, body);
  }

  @Patch('artifacts/:artifactId')
  updateArtifact(@Req() r: any, @Param('artifactId') artifactId: string, @Body() patch: Record<string, unknown>) {
    return this.svc.updateArtifact(r.user, artifactId, patch);
  }

  @Delete('artifacts/:artifactId')
  deleteArtifact(@Req() r: any, @Param('artifactId') artifactId: string) {
    return this.svc.deleteArtifact(r.user, artifactId);
  }

  @Get('bcf-topics')
  listBcfTopics(@Req() r: any, @Query('bimProjectId') bimProjectId?: string, @Query('status') status?: string) {
    return this.svc.listBcfTopics(r.user, { bimProjectId, status });
  }

  @Post('bcf-topics')
  createBcfTopic(@Req() r: any, @Body() body: { title: string; description?: string; topicType?: string; priority?: string; bimProjectId?: string; designProjectId?: string; relatedIfcGuids?: unknown[] }) {
    return this.svc.createBcfTopic(r.user, body);
  }

  @Post('bcf-topics/:topicId/comments')
  addBcfComment(@Req() r: any, @Param('topicId') topicId: string, @Body() body: { content: string }) {
    return this.svc.addBcfComment(r.user, topicId, body);
  }

  @Patch('bcf-topics/:topicId/status')
  updateBcfTopicStatus(@Req() r: any, @Param('topicId') topicId: string, @Body() body: { status: 'open' | 'resolved' | 'closed' }) {
    return this.svc.updateBcfTopicStatus(r.user, topicId, body.status);
  }
}
