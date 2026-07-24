/**
 * PMS API · 跟进记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createFollowUp,
  listFollowUps,
  getOpportunityFollowUps,
} from '@/lib/pms/follow-up-service';
import { getOpportunity } from '@/lib/pms/opportunity-service';

/**
 * GET /api/pms/follow-ups - 列表查询
 */
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
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    
    const opportunityId = searchParams.get('opportunityId');
    
    // 如果指定了 opportunityId，先校验父商机归属，再返回跟进历史
    if (opportunityId) {
      const parent = await getOpportunity(opportunityId, auth.tenantId, visibleOrgIds);
      if (!parent) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      const followUps = await getOpportunityFollowUps(
        opportunityId,
        auth.tenantId,
        searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
      );
      return NextResponse.json({ followUps });
    }
    
    // 无 opportunityId 的通用列表: follow_ups 无 orgId 列无法隔离 → 外部经销商必须指定商机
    if (!auth.isInternal) {
      return NextResponse.json(
        { error: 'opportunityId is required for external users' },
        { status: 400 }
      );
    }
    
    const followUps = await listFollowUps({
      tenantId: auth.tenantId,
      userId: searchParams.get('userId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    
    return NextResponse.json({ followUps });
  } catch (error: any) {
    console.error('List follow-ups error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list follow-ups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pms/follow-ups - 创建跟进记录
 */
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
    
    // 验证必填字段
    if (!body.opportunityId || !body.stage || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: opportunityId, stage, content' },
        { status: 400 }
      );
    }
    
    // 归属校验: 仅能给可见 org 的商机加跟进
    const visibleOrgIds = auth.isInternal ? undefined : auth.visibleOrgIds;
    const parent = await getOpportunity(body.opportunityId, auth.tenantId, visibleOrgIds);
    if (!parent) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    
    const followUp = await createFollowUp({
      tenantId: auth.tenantId,
      opportunityId: body.opportunityId,
      userId: auth.userId,
      stage: body.stage,
      content: body.content,
      nextFollowUpAt: body.nextFollowUpAt,
    });
    
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error: any) {
    console.error('Create follow-up error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create follow-up' },
      { status: 500 }
    );
  }
}
