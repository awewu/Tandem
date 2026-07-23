/**
 * 组织云盘 · Actor 解析
 *
 * requireAuth 只给 { userId, tenantId, roles }, 不含 departmentId
 * (departmentId 落 auth_user_extras)。ACL 鉴权需要 departmentId 才能解析
 * dept:<id> principal, 故这里从 AuthStore 补齐, 组装成 DriveAclUser。
 *
 * fail-soft: 取不到用户/部门时, 退化为仅 user:/role:/all 命中 (不报错)。
 */
import { getStore } from '@/lib/storage/repository';
import type { DriveAclUser } from './acl';

export interface AuthLike {
  userId: string;
  roles?: string[];
}

/** 从鉴权上下文 + 用户档案组装 ACL 主体。 */
export async function resolveDriveActor(auth: AuthLike): Promise<DriveAclUser> {
  let departmentId: string | null | undefined;
  try {
    const user = await getStore().auth.users.findById(auth.userId);
    departmentId = user?.departmentId ?? null;
  } catch {
    departmentId = null;
  }
  return {
    id: auth.userId,
    departmentId: departmentId ?? null,
    roles: auth.roles ?? [],
  };
}
