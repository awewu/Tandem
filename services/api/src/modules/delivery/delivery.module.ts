import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryProjectEntity,
  DeliveryMilestoneEntity,
  DeliveryPaymentEntity,
  DeliveryEvidenceEntity,
  ServiceTicketEntity,
  WarrantyEntity,
  LifecycleLinkEntity,
} from './delivery.entity';
import { DeliveryController, AftersalesController, LifecycleController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { AuthModule } from '../auth/auth.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

const entities = [
  DeliveryProjectEntity,
  DeliveryMilestoneEntity,
  DeliveryPaymentEntity,
  DeliveryEvidenceEntity,
  ServiceTicketEntity,
  WarrantyEntity,
  LifecycleLinkEntity,
];

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature(entities)]),
    AuthModule,
  ],
  controllers: [DeliveryController, AftersalesController, LifecycleController],
  providers: [
    DeliveryService,
    ...(TARGET_API_BOOT_SMOKE ? entities.map((e) => bootSmokeRepositoryProvider(e)) : []),
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
