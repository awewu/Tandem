/**
 * PMS API · 驾驶舱异常 AI 下一步动作建议 (按需, 只读)
 *
 * POST /api/pms/cockpit/advise
 *   body: { type, title, detail, severity, category, amount? }
 *   → { advice: { source: 'ai'|'rule', action, rationale? } }
 *
 * 定位: 前端对某条驾驶舱预警按需拉取 AI 行动建议 (懒加载, 不阻塞驾驶舱主渲染).
 *   grounded + fail-soft — LLM 不可用时降级到规则基线, 绝不失败.
 * 授权: 任意可访问 PMS 的登录用户 (对其已能看到的异常求建议, 纯只读不写业务真值).
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { adviseCockpitException, type CockpitExceptionInput } from '@/lib/pms/ai-service';

const SEVERITIES = ['critical', 'warning', 'info'] as const;
const CATEGORIES = ['sales', 'finance'] as const;

export async function POST(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type = typeof body?.type === 'string' ? body.type : '';
    const title = typeof body?.title === 'string' ? body.title : '';
    const detail = typeof body?.detail === 'string' ? body.detail : '';
    if (!type || !title) {
      return NextResponse.json({ error: 'missing required fields: type, title' }, { status: 400 });
    }
    const severity = SEVERITIES.includes(body?.severity) ? body.severity : 'warning';
    const category = CATEGORIES.includes(body?.category) ? body.category : 'sales';
    const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? body.amount : undefined;
    const scope = typeof body?.scope === 'string' ? body.scope : 'company';

    const exception: CockpitExceptionInput = { type, title, detail, severity, category, amount };
    const advice = await adviseCockpitException(
      { exception, scope },
      { tenantId: auth.tenantId, actorUserId: auth.userId },
    );
    return NextResponse.json({ advice });
  } catch (error: any) {
    console.error('Cockpit advise error:', error);
    return NextResponse.json({ error: error.message || 'Failed to advise' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed; use POST' }, { status: 405 });
}
