import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ConsentEntity } from './consent.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

/**
 * M14 中国合规模块（等保 2.0 / PIPL / 数据安全法）。
 * 能力：PIPL 同意管理(consent)、撤回、数据保留(dataRetention)、PII 加密(encryptPII)。
 */
@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([ConsentEntity])]),
  ],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(ConsentEntity)] : []),
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
