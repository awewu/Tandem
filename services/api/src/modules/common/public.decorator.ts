import { SetMetadata } from '@nestjs/common';

/**
 * H2 修复 · 全局 AuthGuard 的显式放行标记。
 * 全局 APP_GUARD 默认拒绝所有请求（deny-by-default）；用 @Public() 标注
 * 真正的匿名/公开端点（登录、健康检查、C 端问诊公开面、boundary 测试证据等）。
 * 可标注在方法或整个控制器上。
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
