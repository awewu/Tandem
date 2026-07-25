/**
 * PMS API · 老板驾驶舱 (销售+财务视角 · 异常即时暴露, 只读)
 *
 * GET /api/pms/cockpit → { cockpit: { exceptions, counts, sales, finance, projectFunnel } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { assembleCockpit } from '@/lib/pms/cockpit-service';

export async function GET(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 视角按角色下沉:
    //   管理层 (owner/admin/manager/steward) → 全公司
    //   其他内部员工 (employee/champion) → 只看"我负责"的项目 (ownerId 收窄, 不背公司财务)
    //   经销商 (dealer_*) → 本经销商 org 范围
    const MGMT = ['owner', 'admin', 'manager', 'steward'];
    const isManagement = auth.roles.some((r) => MGMT.includes(r));
    const cockpit = await assembleCockpit(
      auth.isInternal
        ? isManagement
          ? { tenantId: auth.tenantId, scope: 'company' }
          : { tenantId: auth.tenantId, ownerId: auth.userId, scope: 'mine' }
        : { tenantId: auth.tenantId, visibleOrgIds: auth.visibleOrgIds, scope: 'org' },
    );
    return NextResponse.json({ cockpit });
  } catch (error: any) {
    console.error('Cockpit error:', error);
    return NextResponse.json({ error: error.message || 'Failed to assemble cockpit' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'method not allowed; cockpit is read-only' }, { status: 405 });
}
