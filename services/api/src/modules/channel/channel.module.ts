import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { ChannelPartnerEntity, ChannelRebateEntity, ChannelPerformanceEntity } from './channel.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([ChannelPartnerEntity, ChannelRebateEntity, ChannelPerformanceEntity])]),
    AuthModule,
  ],
  controllers: [ChannelController],
  providers: [
    ChannelService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(ChannelPartnerEntity), bootSmokeRepositoryProvider(ChannelRebateEntity), bootSmokeRepositoryProvider(ChannelPerformanceEntity)]
      : []),
  ],
  exports: [ChannelService],
})
export class ChannelModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class ChannelBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('channel');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('channel')
export class ChannelBoundaryController {
  constructor(private readonly s: ChannelBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
