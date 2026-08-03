import {
  Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectsCandidateService } from './projects-candidate.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsCandidateController {
  constructor(private readonly svc: ProjectsCandidateService) {}

  @Get('stats')
  stats(@Req() r: any) {
    return this.svc.stats(r.user);
  }

  @Post('batch')
  batch(@Body() body: { operation?: string; projectIds?: string[] }) {
    return { operation: body?.operation, projectIds: body?.projectIds || [], status: 'accepted' };
  }

  @Get('shared/:shareToken')
  shared(@Param('shareToken') shareToken: string) {
    return { shareToken };
  }

  @Get()
  list(@Req() r: any, @Query() query: { status?: string; search?: string }) {
    return this.svc.list(r.user, query);
  }

  @Post()
  create(@Req() r: any, @Body() body: Record<string, unknown>) {
    return this.svc.create(r.user, body);
  }

  @Get(':projectId/versions')
  versions(@Param('projectId') projectId: string) {
    return [{ versionId: 'v1', projectId }];
  }

  @Post(':projectId/versions/:versionId/restore')
  restore(@Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return { projectId, versionId, restored: true };
  }

  @Post(':projectId/copy')
  copy(@Param('projectId') projectId: string) {
    return { sourceProjectId: projectId, id: `PRJ-COPY-${Date.now()}` };
  }

  @Post(':projectId/share')
  share(@Param('projectId') projectId: string) {
    return { projectId, shareToken: `share-${Date.now()}` };
  }

  @Post(':projectId/export')
  exportProject(@Param('projectId') projectId: string, @Body() body: { format?: string }) {
    return { projectId, format: body?.format || 'pdf', status: 'queued' };
  }

  @Get(':projectId')
  async get(@Req() r: any, @Param('projectId') projectId: string) {
    const p = await this.svc.get(r.user, projectId);
    if (!p) throw new NotFoundException('not found');
    return p;
  }

  @Put(':projectId')
  update(@Req() r: any, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    return this.svc.update(r.user, projectId, body);
  }

  @Delete(':projectId')
  delete(@Req() r: any, @Param('projectId') projectId: string) {
    return this.svc.delete(r.user, projectId);
  }
}
