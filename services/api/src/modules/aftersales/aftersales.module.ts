import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { getApiModuleBoundary } from '../module-boundary';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { ServiceTicketEntity, WarrantyEntity } from './aftersales.entity';
import { AftersalesController } from './aftersales.controller';
import { AftersalesService } from './aftersales.service';

// ── Boundary contract (test evidence) ─────────────────────────────────────
@Injectable()
export class AftersalesBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('aftersales');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}

@Controller('aftersales')
export class AftersalesBoundaryController {
  constructor(private readonly s: AftersalesBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([ServiceTicketEntity, WarrantyEntity])]),
    AuthModule,
  ],
  controllers: [AftersalesController, AftersalesBoundaryController],
  providers: [
    AftersalesService,
    AftersalesBoundaryService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(ServiceTicketEntity), bootSmokeRepositoryProvider(WarrantyEntity)]
      : []),
  ],
  exports: [AftersalesService],
})
export class AftersalesModule {}
