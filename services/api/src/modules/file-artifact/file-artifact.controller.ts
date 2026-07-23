import {
  Body, Controller, Delete, Get, Param, Post, Query,
  Request, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FileArtifactService } from './file-artifact.service';
import { ObjectStorageEvidenceService } from './object-storage-evidence.service';
import { JwtPayload } from '../auth/auth.service';

@UseGuards(AuthGuard)
@Controller('file-artifact')
export class FileArtifactController {
  constructor(
    private readonly svc: FileArtifactService,
    private readonly evidence: ObjectStorageEvidenceService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Request() req: { user: JwtPayload },
    @UploadedFile() file: Express.Multer.File,
    @Query('entityType') entityType: string,
    @Query('entityId')   entityId: string,
  ) {
    return this.svc.save(req.user, {
      entityType: entityType || 'general',
      entityId:   entityId   || 'unlinked',
      originalName: file.originalname,
      mimeType:     file.mimetype,
      buffer:       file.buffer,
    });
  }

  // Fastify 安全的 base64 上传（FileInterceptor 在 Fastify 下返回 415）。
  @Post('upload-base64')
  uploadBase64(
    @Request() req: { user: JwtPayload },
    @Body() body: { entityType?: string; entityId?: string; filename: string; mimeType?: string; dataBase64: string },
  ) {
    return this.svc.saveBase64(req.user, {
      entityType: body.entityType || 'general',
      entityId:   body.entityId   || 'unlinked',
      filename:   body.filename,
      mimeType:   body.mimeType,
      dataBase64: body.dataBase64,
    });
  }

  @Get()
  list(
    @Request() req: { user: JwtPayload },
    @Query('entityType') entityType: string,
    @Query('entityId')   entityId: string,
  ) {
    return this.svc.list(req.user, entityType, entityId);
  }

  // Fastify 安全的按 id 读取（base64 JSON，避开 stream/@Res）。
  @Get(':id/base64')
  getBase64(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.svc.getBase64ById(req.user, id);
  }

  /** W-BIM-2 · 2.3：对象存储外部往返验证 */
  @Post(':id/verify-round-trip')
  async verifyRoundTrip(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    const artifact = await this.svc.getBase64ById(req.user, id);
    if (!artifact.success || !artifact.data) return artifact;
    const row = artifact.data;
    return this.evidence.verifyRoundTrip(
      {
        tenantId: req.user.tenantId,
        dealerId: req.user.dealerId ?? null,
        actorId: req.user.userId ?? null,
        entityType: row.entityType || 'general',
        entityId: row.entityId || 'unlinked',
        fileKey: row.fileKey,
      },
      { tenantId: req.user.tenantId, actorId: req.user.userId ?? undefined },
    );
  }

  /** W-BIM-2 · 2.3：查询某产物的对象存储证据链 */
  @Get(':id/evidence')
  async evidenceList(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    const artifact = await this.svc.getBase64ById(req.user, id);
    if (!artifact.success || !artifact.data) return artifact;
    const row = artifact.data;
    return this.evidence.listForEntity(
      req.user.tenantId,
      row.entityType || 'general',
      row.entityId || 'unlinked',
      { tenantId: req.user.tenantId, actorId: req.user.userId ?? undefined },
    );
  }

  @Get(':key/download')
  download(@Param('key') key: string, @Res() res: Response) {
    const stream = this.svc.getStream(decodeURIComponent(key));
    if (!stream) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    stream.pipe(res);
  }

  @Delete(':id')
  remove(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.svc.remove(req.user, id);
  }
}
