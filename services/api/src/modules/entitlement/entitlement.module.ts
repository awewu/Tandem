import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitlementController } from './entitlement.controller';
import { EntitlementService } from './entitlement.service';
import { EntitlementGuard } from './entitlement.guard';
import { SubscriptionEntity } from './subscription.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

/**
 * Entitlement 订阅授权模块（商业化 SaaS 底座）。
 * 能力：租户模块订阅账本、当前租户有效模块查询、平台开通/停用、EntitlementGuard 端点授权。
 * EntitlementGuard 由 AppModule 注册为全局守卫（AuthGuard → RolesGuard → EntitlementGuard）。
 */
@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([SubscriptionEntity])]),
  ],
  controllers: [EntitlementController],
  providers: [
    EntitlementService,
    EntitlementGuard,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(SubscriptionEntity)] : []),
  ],
  exports: [EntitlementService, EntitlementGuard],
})
export class EntitlementModule {}
