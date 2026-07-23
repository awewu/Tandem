import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity, DeliveryRecordEntity } from './delivery.entity';
import {
  DeliveryProjectEntity, DeliveryMilestoneEntity, DeliveryPaymentEntity, DeliveryEvidenceEntity,
} from './construction.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { FileArtifactModule } from '../file-artifact/file-artifact.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ConstructionController } from './construction.controller';
import { ConstructionService } from './construction.service';
import { EsignService } from './esign.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([
      ContractEntity, DeliveryRecordEntity,
      DeliveryProjectEntity, DeliveryMilestoneEntity, DeliveryPaymentEntity, DeliveryEvidenceEntity,
    ])]),
    AuthModule,
    MdmModule,
    FileArtifactModule,
  ],
  controllers: [DeliveryController, ContractController, ConstructionController],
  providers: [
    DeliveryService,
    ContractService,
    ConstructionService,
    EsignService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
          bootSmokeRepositoryProvider(ContractEntity), bootSmokeRepositoryProvider(DeliveryRecordEntity),
          bootSmokeRepositoryProvider(DeliveryProjectEntity), bootSmokeRepositoryProvider(DeliveryMilestoneEntity),
          bootSmokeRepositoryProvider(DeliveryPaymentEntity), bootSmokeRepositoryProvider(DeliveryEvidenceEntity),
        ]
      : []),
  ],
  exports: [ContractService, ConstructionService],
})
export class DeliveryModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class DeliveryBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('delivery');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('delivery')
export class DeliveryBoundaryController {
  constructor(private readonly s: DeliveryBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
