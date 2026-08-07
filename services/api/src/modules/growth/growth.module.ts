import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { FileArtifactModule } from '../file-artifact/file-artifact.module';
import { InsightModule } from '../insight/insight.module';
import { ChannelModule } from '../channel/channel.module';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';
import { GtmplanModule } from '../gtmplan/gtmplan.module';
import { ContentModule } from '../content/content.module';
import { GrowthController } from './growth.controller';
import { CockpitController } from './cockpit.controller';
import { CockpitService } from './cockpit.service';
import { AiGatewayService } from './ai-gateway.service';
import { AttributionService } from './attribution.service';
import { BrandBrainService } from './brand-brain.service';
import { GeoAnalyzerService } from './geo-analyzer.service';
import { AgenticGeoService } from './agentic-geo.service';
import { GeoFocusService } from './geo-focus.service';
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
    FileArtifactModule,
    InsightModule,
    ChannelModule,
    ProductCatalogModule,
    GtmplanModule,
    ContentModule,
  ],
  controllers: [GrowthController, CockpitController],
  providers: [
    CockpitService,
    AiGatewayService,
    AttributionService,
    BrandBrainService,
    GeoAnalyzerService,
    AgenticGeoService,
    GeoFocusService,
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
