/**
 * PMS API · 报价单操作留痕 (只读)
 *
 * GET → 该报价的审计流水 (创建/签发/改价/作废)。链式哈希防篡改, 治理可追溯。
 * 授权: 复用 getQuote 的 org 可见性 (看得到报价即看得到其留痕)。
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getQuote, type QuoteAuthCtx } from '@/lib/pms/quote-service';
import { getAuditLog } from '@/lib/audit/log';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const qauth: QuoteAuthCtx = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      visibleOrgIds: auth.visibleOrgIds,
      isInternal: auth.isInternal,
    };
    const quote = await getQuote(id, qauth);
    if (!quote) return NextResponse.json({ error: '报价不存在或无权限' }, { status: 404 });

    const entries = await getAuditLog().list({ targetId: id, tenantId: auth.tenantId, limit: 100 });
    // 仅暴露报价相关动作, 按时间升序 (旧→新)
    const trail = entries
      .filter((e) => e.action.startsWith('pms.quote.'))
      .map((e) => ({ action: e.action, actorId: e.actorId, timestamp: e.timestamp, metadata: e.metadata }))
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return NextResponse.json({ trail });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed' }, { status: 500 });
  }
}
