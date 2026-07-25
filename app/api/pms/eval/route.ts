/**
 * PMS API · AI 分析质量 (评估台读数, 只读)
 *
 * GET /api/pms/eval → { regression }  按 kind=pms_analysis 汇总逐 grader 通过率.
 *   让"报表预警/AI 分析准不准"从主观变可度量.
 *
 * 授权: 仅内部管理角色 (信息管理岗/管理层).
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { runRegression } from '@/lib/eval/service';

const STEWARD_ROLES = ['owner', 'admin', 'manager', 'steward'];

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!auth.isInternal || !auth.roles.some((r) => STEWARD_ROLES.includes(r))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const includeLlm = searchParams.get('llm') === '1';
    const regression = await runRegression({
      tenantId: auth.tenantId,
      kind: 'pms_analysis',
      limit: 100,
      includeLlm,
    });
    return NextResponse.json({ regression });
  } catch (error: any) {
    console.error('PMS eval error:', error);
    return NextResponse.json({ error: error.message || 'Failed to run regression' }, { status: 500 });
  }
}
