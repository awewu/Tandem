import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../auth/auth.entity';

/**
 * H2 修复 · RBAC 角色约束。
 * 标注在方法或控制器上，限定允许访问的角色（取自 JWT payload.role）。
 * 未标注 @Roles 的受保护端点仅要求「已认证」，不做角色限制（向后兼容）。
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
