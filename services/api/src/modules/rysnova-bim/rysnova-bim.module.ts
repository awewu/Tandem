import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { getApiModuleBoundary } from '../module-boundary';
import { Public } from '../common/public.decorator';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

import { BimController, BimPublicController } from './bim.controller';
import { V2BimController, V2BimPublicController } from './v2-bim.controller';
import { BimService } from './bim.service';
import { RysnovaController } from './rysnova-bim.controller';
import { RysnovaService } from './rysnova-bim.service';
import { BimProjectEntity } from './bim.entity';
import { RysnovaArtifactEntity } from './rysnova-bim.entity';
import { QuotationEntity } from '../quote/quote.entity';
import { DesignSyncEntity } from './design-sync.entity';
import { DesignSyncService } from './design-sync.service';
import { DesignSyncController } from './design-sync.controller';
import { DesignChangedHandler } from './design-changed.handler';
import { CloudCapabilityService } from './cloud-capability.service';
import { CloudCapabilityController } from './cloud-capability.controller';
import { BcfTopicEntity } from './bcf.entity';
import { BcfService } from './bcf.service';
import { BcfController } from './bcf.controller';
import { ViewerDesignDraftEntity } from './viewer-draft.entity';
import { ViewerDraftService } from './viewer-draft.service';
import { ViewerDraftController } from './viewer-draft.controller';
import { ViewerModelSourceEntity } from './viewer-model-source.entity';
import { ViewerModelSourceService } from './viewer-model-source.service';
import { ViewerModelSourceController } from './viewer-model-source.controller';
import { ViewerDesignSummaryEntity } from './viewer-summary.entity';
import { ViewerSummaryService } from './viewer-summary.service';
import { ViewerSummaryController } from './viewer-summary.controller';
import { ViewerComponentCatalogService } from './viewer-component-catalog.service';
import { ViewerComponentCatalogController } from './viewer-component-catalog.controller';
import { QuoteModule } from '../quote/quote.module';

// Boundary contract (test evidence)
@Injectable()
export class RysnovaBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('rysnova-bim');
    return {
      tenantScope: spec.requiresTenantScope,
      auditLog: spec.requiresAuditLog,
      openApiContract: spec.requiresOpenApiContract,
    };
  }
}
@Public()
@Controller('rysnova-bim')
export class RysnovaBoundaryController {
  constructor(private readonly s: RysnovaBoundaryService) {}
  @Get('boundary') boundary() {
    return this.s.boundary();
  }
}

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE
      ? []
      : [
          TypeOrmModule.forFeature([
            BimProjectEntity,
            RysnovaArtifactEntity,
            QuotationEntity,
            DesignSyncEntity,
            BcfTopicEntity,
            ViewerDesignDraftEntity,
            ViewerModelSourceEntity,
            ViewerDesignSummaryEntity,
          ]),
        ]),
    AuthModule,
    QuoteModule,
  ],
  controllers: [
    RysnovaController,
    RysnovaBoundaryController,
    BimController,
    BimPublicController,
    V2BimController,
    V2BimPublicController,
    DesignSyncController,
    CloudCapabilityController,
    BcfController,
    ViewerDraftController,
    ViewerModelSourceController,
    ViewerSummaryController,
    ViewerComponentCatalogController,
  ],
  providers: [
    RysnovaService,
    BimService,
    RysnovaBoundaryService,
    DesignSyncService,
    DesignChangedHandler,
    CloudCapabilityService,
    BcfService,
    ViewerDraftService,
    ViewerModelSourceService,
    ViewerSummaryService,
    ViewerComponentCatalogService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
          bootSmokeRepositoryProvider(BimProjectEntity),
          bootSmokeRepositoryProvider(RysnovaArtifactEntity),
          bootSmokeRepositoryProvider(QuotationEntity),
          bootSmokeRepositoryProvider(DesignSyncEntity),
          bootSmokeRepositoryProvider(BcfTopicEntity),
          bootSmokeRepositoryProvider(ViewerDesignDraftEntity),
          bootSmokeRepositoryProvider(ViewerModelSourceEntity),
          bootSmokeRepositoryProvider(ViewerDesignSummaryEntity),
        ]
      : []),
  ],
  exports: [
    RysnovaService,
    BimService,
    DesignSyncService,
    ViewerDraftService,
    ViewerModelSourceService,
    ViewerSummaryService,
    ViewerComponentCatalogService,
  ],
})
export class RysnovaModule {}
