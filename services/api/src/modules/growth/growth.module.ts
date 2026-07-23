import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { GrowthController } from './growth.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AttributionService } from './attribution.service';
import { BrandBrainService } from './brand-brain.service';
import { GeoAnalyzerService } from './geo-analyzer.service';
import { OpinionClassifierService } from './opinion-classifier.service';
import { OpinionSourceService } from './opinion-source.service';
import { GROWTH_SERVICES } from './growth.service';
import { GROWTH_ENTITIES } from './growth.entities';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

/**
 * D5 · 增长中枢 / Nexus Growth 模块（板块三 · 对内底座能力域）。
 * apiNamespace=/api/v2/growth · 写走 outbox（growth.*）· AI 产出默认 draft 待核准。
 * 事实源：docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md。
 */
@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([...GROWTH_ENTITIES])]),
    AuthModule,
    MdmModule,
  ],
  controllers: [GrowthController],
  providers: [
    AiGatewayService,
    AttributionService,
    BrandBrainService,
    GeoAnalyzerService,
    OpinionClassifierService,
    OpinionSourceService,
    ...GROWTH_SERVICES,
    ...(TARGET_API_BOOT_SMOKE ? GROWTH_ENTITIES.map((e) => bootSmokeRepositoryProvider(e)) : []),
  ],
})
export class GrowthModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class GrowthBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('growth');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('growth')
export class GrowthBoundaryController {
  constructor(private readonly s: GrowthBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
