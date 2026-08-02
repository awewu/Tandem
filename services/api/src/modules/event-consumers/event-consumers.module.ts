import { Module } from '@nestjs/common';
import { MdmModule } from '../mdm/mdm.module';
import { NotificationModule } from '../notification/notification.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { EventConsumersService } from './event-consumers.service';
import { TARGET_API_BOOT_SMOKE } from '../boot-smoke';

/**
 * M15 · 跨板块事件消费方接线层。
 * 把领域反应订阅到 event_bus（EventBusService 单例），与发射方（CRM/Quote/Diagnosis）解耦。
 * boot-smoke 模式不挂载（无 DataSource / 无真实投递）。
 */
@Module({
  imports: TARGET_API_BOOT_SMOKE ? [] : [MdmModule, NotificationModule, DispatchModule],
  providers: TARGET_API_BOOT_SMOKE ? [] : [EventConsumersService],
})
export class EventConsumersModule {}
