/**
 * /organization · 旧入口
 *
 * 2026-05-30 重定向到 /governance/three-departments
 * 详见 docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md
 *
 * 三省六部已从「组织架构」语义解耦, 独立为「项目与决策治理协同模板」.
 * 真员工 HR 管理请走 /admin/organization.
 */

import { redirect } from 'next/navigation';

export default function OrganizationRedirect() {
  redirect('/governance/three-departments');
}
