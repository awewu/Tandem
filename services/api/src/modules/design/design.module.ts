import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DesignProjectEntity,
  FloorPlanEntity,
  DesignReleaseEntity,
  DesignRysnovaBimSyncEntity,
  AiDesignAuditEntity,
} from './design.entity';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { AuthModule } from '../auth/auth.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

const entities = [
  DesignProjectEntity,
  FloorPlanEntity,
  DesignReleaseEntity,
  DesignRysnovaBimSyncEntity,
  AiDesignAuditEntity,
];

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature(entities)]),
    AuthModule,
  ],
  controllers: [DesignController],
  providers: [
    DesignService,
    ...(TARGET_API_BOOT_SMOKE ? entities.map((e) => bootSmokeRepositoryProvider(e)) : []),
  ],
  exports: [DesignService],
})
export class DesignModule {}
