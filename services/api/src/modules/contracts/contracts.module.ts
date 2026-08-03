import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from './contracts.entity';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { AuthModule } from '../auth/auth.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

const entities = [ContractEntity];

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature(entities)]),
    AuthModule,
  ],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ...(TARGET_API_BOOT_SMOKE ? entities.map((e) => bootSmokeRepositoryProvider(e)) : []),
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
