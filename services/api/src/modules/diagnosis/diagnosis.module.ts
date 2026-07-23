import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagnosisSessionEntity } from './diagnosis.entity';
import { DealerCollectionConfigEntity, DepositOrderEntity } from './deposit.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { CrmModule } from '../crm/crm.module';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';
import { DiagnosisAiService } from './diagnosis-ai.service';
import { DepositService } from './deposit.service';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([DiagnosisSessionEntity, DealerCollectionConfigEntity, DepositOrderEntity])]),
    AuthModule,
    MdmModule,
    ProductCatalogModule,
    ComplianceModule,
    CrmModule
  ],
  controllers: [DiagnosisController],
  providers: [
    DiagnosisService,
    DiagnosisAiService,
    DepositService,
    PublicRateLimitGuard,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(DiagnosisSessionEntity),
      bootSmokeRepositoryProvider(DealerCollectionConfigEntity),
      bootSmokeRepositoryProvider(DepositOrderEntity),
    ] : [])
  ],
})
export class DiagnosisModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class DiagnosisBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('diagnosis');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('diagnosis')
export class DiagnosisBoundaryController {
  constructor(private readonly s: DiagnosisBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
