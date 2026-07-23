import { TypeOrmModule } from '@nestjs/typeorm';
import { FileArtifactEntity } from './file-artifact.entity';
import { ObjectStorageEvidenceEntity } from './object-storage-evidence.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FileArtifactController } from './file-artifact.controller';
import { FileArtifactService } from './file-artifact.service';
import { ObjectStorageEvidenceService } from './object-storage-evidence.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([FileArtifactEntity, ObjectStorageEvidenceEntity])]),
    AuthModule
  ],
  controllers: [FileArtifactController],
  providers: [
    FileArtifactService,
    ObjectStorageEvidenceService,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(FileArtifactEntity),
      bootSmokeRepositoryProvider(ObjectStorageEvidenceEntity),
    ] : [])
  ],
  exports: [FileArtifactService, ObjectStorageEvidenceService],
})
export class FileArtifactModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class FileArtifactBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('file-artifact');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('file-artifact')
export class FileArtifactBoundaryController {
  constructor(private readonly s: FileArtifactBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
