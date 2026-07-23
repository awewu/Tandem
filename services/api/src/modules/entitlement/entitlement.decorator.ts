import { SetMetadata } from '@nestjs/common';
import type { SellableModuleId } from './subscription.entity';

/**
 * 模块订阅约束。标注在控制器或方法上，声明访问该端点所需的可售模块。
 * EntitlementGuard 校验当前租户是否对全部所需模块持有有效订阅。
 * 未标注 @RequireModule 的端点不做订阅校验（底座能力恒可用）。
 */
export const REQUIRE_MODULE_KEY = 'require_module';
export const RequireModule = (...modules: SellableModuleId[]) =>
  SetMetadata(REQUIRE_MODULE_KEY, modules);
