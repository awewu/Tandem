import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { QuoteController } from './quote.controller';
import { QuotationEntity } from './quote.entity';
import { QuoteService } from './quote.service';
import { PriceGuardrailService } from './price-guardrail.service';
import { CustomerEntity, OpportunityEntity } from '../crm/crm.entity';
import { AuditLogEntity } from '../governance/governance.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([
      QuotationEntity, CustomerEntity, OpportunityEntity, AuditLogEntity,
    ])]),
    AuthModule,
    MdmModule
  ],
  controllers: [QuoteController],
  providers: [
    QuoteService,
    PriceGuardrailService,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(QuotationEntity),
      bootSmokeRepositoryProvider(CustomerEntity),
      bootSmokeRepositoryProvider(OpportunityEntity),
      bootSmokeRepositoryProvider(AuditLogEntity),
    ] : [])
  ],
  exports: [QuoteService, PriceGuardrailService],
})
export class QuoteModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class QuoteBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('quote');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('quote')
export class QuoteBoundaryController {
  constructor(private readonly s: QuoteBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
