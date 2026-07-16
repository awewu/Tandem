import { describe, expect, it } from 'vitest';
import { defaultPermissionsForRoles } from '@/lib/auth/role-definitions';

describe('数据库角色默认权限', () => {
  it('内网内容编辑只获得内网管理权限', () => {
    expect(defaultPermissionsForRoles(['intranet_editor'])).toEqual(['intranet.manage']);
  });

  it('多角色权限合并并去重', () => {
    const permissions = defaultPermissionsForRoles(['intranet_editor', 'admin']);
    expect(permissions).toContain('roles.manage');
    expect(permissions).toContain('intranet.manage');
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});
