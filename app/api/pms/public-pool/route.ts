/**
 * PMS API · 公海池 + 90 天管控
 *
 * GET  ?includeClaimed=1        列出公海条目 (默认仅未认领)
 * POST { action: 'scan' }       90 天扫描 (内部角色, 可 autoRelease)
 * POST { action: 'release' }    释放商机到公海 (内部 或 属主经销商)
 * POST { action: 'claim' }      认领公海商机
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getOpportunity } from '@/lib/pms/opportunity-service';
import {
  listPublicPool,
  scanExpiringOpportunities,
  claimFromPool,
  type ReleaseReason,
} from '@/lib/pms/public-pool-service';
import { executeAction } from '@/lib/ontology/execute-action';
import { ensurePmsActions } from '@/lib/ontology/actions/pms-actions';

const RELEASE_REASONS: ReleaseReason[] = ['ninety_day_timeout', 'manual_release', 'dealer_inactive'];

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
    const { searchParams } = new URL(req.url);
    // 仅内部角色可查看已认领历史
    const includeClaimed = auth.isInternal && searchParams.get('includeClaimed') === '1';

    const entries = await listPublicPool({
      tenantId: auth.tenantId,
      includeClaimed,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error('List public pool error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list public pool' },
      { status: 500 }
    );
  }
}

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
    const body = await req.json();
    const action = body.action as string;
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;

    // --- 90 天扫描 (仅内部) ---
    if (action === 'scan') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: scan requires internal role' }, { status: 403 });
      }
      const result = await scanExpiringOpportunities({
        tenantId: auth.tenantId,
        warningDays: typeof body.warningDays === 'number' ? body.warningDays : undefined,
        releaseDays: typeof body.releaseDays === 'number' ? body.releaseDays : undefined,
        autoRelease: body.autoRelease === true,
        actorId: auth.userId,
        protectionDays: typeof body.protectionDays === 'number' ? body.protectionDays : undefined,
      });
      return NextResponse.json({ result });
    }

    // --- 释放到公海 (内部 或 属主经销商) ---
    if (action === 'release') {
      if (!body.opportunityId) {
        return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 });
      }
      // 归属校验: 经销商只能释放自己可见的商机
      const opp = await getOpportunity(body.opportunityId, auth.tenantId, visibleOrgIds);
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      const reason: ReleaseReason = RELEASE_REASONS.includes(body.releasedReason)
        ? body.releasedReason
        : 'manual_release';
      // 接治理链: 归属/可见性校验 (上方 getOpportunity) 保留在路由; 写走 executeAction。
      // 人工内部/属主经销商 isProxy=false: 黄区立即执行 (行为不变) + 统一审计。
      ensurePmsActions();
      const exec = await executeAction('pms.public_pool.release', {
        tenantId: auth.tenantId,
        opportunityId: body.opportunityId,
        releasedBy: auth.userId,
        releasedReason: reason,
        protectionDays: typeof body.protectionDays === 'number' ? body.protectionDays : undefined,
      }, { actorUserId: auth.userId, tenantId: auth.tenantId, isProxy: false });
      if (!exec.ok) {
        const status = exec.blocked?.stage === 'gate' ? 403 : 400;
        return NextResponse.json({ error: exec.blocked?.reasons.join('; ') || 'release failed' }, { status });
      }
      return NextResponse.json({ result: exec.result }, { status: 201 });
    }

    // --- 认领 ---
    if (action === 'claim') {
      if (!body.poolEntryId) {
        return NextResponse.json({ error: 'Missing poolEntryId' }, { status: 400 });
      }
      // 认领方 org: 内部可代认领需指定 claimerOrgId; 经销商用自身 org
      const claimerOrgId = auth.isInternal ? body.claimerOrgId : auth.orgId;
      if (!claimerOrgId) {
        return NextResponse.json({ error: 'Missing claimerOrgId' }, { status: 400 });
      }
      const result = await claimFromPool({
        tenantId: auth.tenantId,
        poolEntryId: body.poolEntryId,
        claimerUserId: auth.userId,
        claimerOrgId,
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected scan | release | claim' }, { status: 400 });
  } catch (error: any) {
    console.error('Public pool action error:', error);
    // 业务态错误 (not claimable / not found) → 409
    if (/not claimable|not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process public pool action' },
      { status: 500 }
    );
  }
}
