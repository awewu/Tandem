/**
 * PMS API · 老板驾驶舱 (销售+财务视角 · 异常即时暴露, 只读)
 *
 * GET /api/pms/cockpit → { cockpit: { exceptions, counts, sales, finance, projectFunnel } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { assembleCockpit, resolvePmsCockpitScope } from '@/lib/pms/cockpit-service';

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
    // 视角按角色下沉 (resolvePmsCockpitScope · SSOT PMS_COMPANY_VIEW_ROLES):
    //   company: 管理层 + 职能高管(exec) + 财务(finance) → 全公司只读全景
    //   mine:    其他内部员工 → 只看"我负责"的项目 (ownerId 收窄, 不背公司财务)
    //   org:     经销商 (dealer_*) → 本经销商 org 范围
    const scope = resolvePmsCockpitScope(auth.roles, auth.isInternal);
    const cockpit = await assembleCockpit(
      scope === 'company'
        ? { tenantId: auth.tenantId, scope: 'company' }
        : scope === 'mine'
          ? { tenantId: auth.tenantId, ownerId: auth.userId, scope: 'mine' }
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
