import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentAssetEntity } from './content.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([ContentAssetEntity])]),
    AuthModule,
  ],
  controllers: [ContentController],
  providers: [
    ContentService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(ContentAssetEntity)] : []),
  ],
  exports: [ContentService],
})
export class ContentModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class ContentBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('content');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('content')
export class ContentBoundaryController {
  constructor(private readonly s: ContentBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
