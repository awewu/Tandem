import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MdmController } from './mdm.controller';
import { MdmService } from './mdm.service';
import { EventBusService } from './event-bus.service';
import { GlobalProductEntity } from './master-data.entity';
import { OutboxEventEntity } from './outbox-event.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

/**
 * M15 · 跨板块数据总线 / MDM 模块（底座）。
 * 能力：global_product_id 主数据(masterData) 单写收口 + outbox 事件总线(eventBus/event_bus)。
 * @Global：EventBusService/MdmService 为跨板块底座能力，全局可注入（消费方无需显式 import，
 * 兼容 boot-smoke 下被 guard 剥离的 import）。
 */
@Global()
@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([GlobalProductEntity, OutboxEventEntity])]),
    AuthModule,
  ],
  controllers: [MdmController],
  providers: [
    MdmService,
    EventBusService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(GlobalProductEntity), bootSmokeRepositoryProvider(OutboxEventEntity)]
      : []),
  ],
  exports: [MdmService, EventBusService],
})
export class MdmModule {}
