export const PERMISSIONS = [
  'roles.manage',
  'organization.manage',
  'users.manage',
  'intranet.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  'roles.manage': { label: '角色与权限', description: '新增、修改、停用角色并配置权限' },
  'organization.manage': { label: '组织架构', description: '维护部门、岗位和汇报关系' },
  'users.manage': { label: '人员账号', description: '邀请、编辑、禁用用户并分配角色' },
  'intranet.manage': { label: '内网内容', description: '创建、发布、归档内网文章及上传附件' },
};

const PERMISSION_SET = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}
