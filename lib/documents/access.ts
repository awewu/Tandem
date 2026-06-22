/**
 * 文档权限判定 (单一真相源)
 *
 * 客户端不再靠 ownerId === user.id 猜测能否删除/管理 —— 一律由服务端按鉴权上下文
 * 计算 canWrite / canManage / canDelete 并随文档返回, 客户端只负责显隐.
 *
 * 规则:
 *   - admin: owner/admin 角色或 demo 回退 → 可写/可管理/可删除任意文档
 *   - owner: 文档所有者 → 可写/可管理/可删除
 *   - write 协作者: 可写 + 可管理 ACL, 但不可删除 (删除仅 owner/admin)
 */

import type { AuthContext } from '@/lib/auth/require-auth';
import type { Document } from '@/lib/types/feishu-catchup';

export function isDocAdmin(auth: AuthContext): boolean {
  return auth.demo || auth.roles.includes('owner') || auth.roles.includes('admin');
}

export interface DocAccess {
  canWrite: boolean;
  canManage: boolean;
  canDelete: boolean;
}

export function docAccess(
  auth: AuthContext,
  doc: Pick<Document, 'ownerId' | 'permissions'>,
): DocAccess {
  const admin = isDocAdmin(auth);
  const isOwner = doc.ownerId === auth.userId;
  const inWrite = (doc.permissions?.write ?? []).includes(auth.userId);
  const canWrite = admin || isOwner || inWrite;
  return {
    canWrite,
    canManage: canWrite,
    canDelete: admin || isOwner,
  };
}
