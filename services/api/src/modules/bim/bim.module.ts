import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BimProjectEntity, RysnovaBimArtifactEntity, BcfTopicEntity } from './bim.entity';
import { BimController } from './bim.controller';
import { BimService } from './bim.service';
import { AuthModule } from '../auth/auth.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

const entities = [BimProjectEntity, RysnovaBimArtifactEntity, BcfTopicEntity];

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature(entities)]),
    AuthModule,
  ],
  controllers: [BimController],
  providers: [
    BimService,
    ...(TARGET_API_BOOT_SMOKE ? entities.map((e) => bootSmokeRepositoryProvider(e)) : []),
  ],
  exports: [BimService],
})
export class BimModule {}
