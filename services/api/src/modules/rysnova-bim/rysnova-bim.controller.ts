import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RysnovaService } from './rysnova-bim.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim')
export class RysnovaController {
  constructor(private readonly svc: RysnovaService) {}

  private envelope(data: unknown) {
    return { success: true, data };
  }

  @Post('artifacts')
  @HttpCode(201)
  async createArtifact(@Req() req: any, @Body() body: unknown) {
    return this.envelope(await this.svc.createArtifact(req.user, body));
  }

  @Get('artifacts')
  async listArtifacts(@Req() req: any, @Query() query: unknown) {
    return this.envelope(await this.svc.listArtifacts(req.user, query));
  }

  @Post('artifacts/:artifactId/approval')
  @HttpCode(200)
  async approveArtifact(@Req() req: any, @Param('artifactId') artifactId: string, @Body() body: unknown) {
    return this.envelope(await this.svc.approveArtifact(req.user, artifactId, body));
  }

  @Get('artifacts/:artifactId/integrity')
  async verifyIntegrity(@Req() req: any, @Param('artifactId') artifactId: string) {
    return this.envelope(await this.svc.verifyArtifactIntegrity(req.user, artifactId));
  }

  @Get('artifacts/:artifactId/download')
  async prepareDownload(@Req() req: any, @Param('artifactId') artifactId: string) {
    return this.envelope(await this.svc.prepareArtifactDownload(req.user, artifactId));
  }

  @Get('artifacts/:artifactId/download/content')
  async downloadContent(@Req() req: any, @Param('artifactId') artifactId: string, @Res() res: any) {
    const result = await this.svc.downloadArtifactContent(req.user, artifactId);
    res.header('Content-Type', result.contentType || 'application/octet-stream');
    res.header('Content-Length', String(result.sizeBytes));
    res.header('ETag', `"${String(result.contentHash).replace(/^sha256:/, '')}"`);
    res.header('X-Content-SHA256', result.contentHash);
    res.header('X-Rysnova-Artifact-Id', result.artifactId);
    res.header('X-Rysnova-Artifact-Type', result.type);
    res.header('Cache-Control', 'private, max-age=0, must-revalidate');
    return res.send(result.bytes);
  }

  @Get('projects/:projectId/customer-package')
  async customerPackage(@Req() req: any, @Param('projectId') projectId: string) {
    return this.envelope(await this.svc.buildCustomerPackage(req.user, projectId));
  }

  @Post('projects/:projectId/visual-artifacts')
  @HttpCode(201)
  async generateVisualArtifacts(@Req() req: any, @Param('projectId') projectId: string, @Body() body: unknown) {
    return this.envelope(await this.svc.generateVisualArtifacts(req.user, projectId, body));
  }

  @Post('projects/:projectId/deliverable-artifacts')
  @HttpCode(201)
  async generateDeliverableArtifacts(@Req() req: any, @Param('projectId') projectId: string, @Body() body: unknown) {
    return this.envelope(await this.svc.generateDeliverableArtifacts(req.user, projectId, body));
  }

  @Post('projects/:projectId/signoff-package')
  @HttpCode(201)
  async generateSignoffPackage(@Req() req: any, @Param('projectId') projectId: string, @Body() body: unknown) {
    return this.envelope(await this.svc.generateSignoffPackage(req.user, projectId, body));
  }

  @Post('projects/:projectId/customer-signoff')
  @HttpCode(201)
  async confirmCustomerSignoff(@Req() req: any, @Param('projectId') projectId: string, @Body() body: unknown) {
    return this.envelope(await this.svc.confirmCustomerSignoff(req.user, projectId, body));
  }

  @Get('projects/:projectId/deepening-package')
  async buildDeepeningPackage(@Req() req: any, @Param('projectId') projectId: string) {
    return this.envelope(await this.svc.buildDeepeningPackage(req.user, projectId));
  }
}
