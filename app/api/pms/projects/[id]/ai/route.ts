/**
 * PMS API · 项目 AI 原生能力 (Phase 3, 只读分析)
 *
 * POST /api/pms/projects/[id]/ai
 *   action=spec_risk        → spec-in 被替换风险预测
 *   action=decision_chain   → 决策链智能诊断
 *   action=tender_analysis  { text } → 招投标文档解析
 *
 * 纪律: 纯只读分析, 不落库; LLM 不可用时 fail-soft 到规则基线.
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, canAccessRecord, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getProject } from '@/lib/pms/project-service';
import { listStakeholders, decisionChainHealth } from '@/lib/pms/project-stakeholder-service';
import { listSpecPositions, specCoverage } from '@/lib/pms/spec-position-service';
import { predictSpecInRisk, analyzeDecisionChain, analyzeTenderDocument } from '@/lib/pms/ai-service';

async function authOrError(req: NextRequest): Promise<PmsAuthResult | NextResponse> {
  try {
    return await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e as unknown as NextResponse;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await authOrError(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const project = await getProject(auth.tenantId, id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!canAccessRecord(auth, project)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || '';

    switch (action) {
      case 'spec_risk': {
        const specs = await listSpecPositions(auth.tenantId, id);
        const stakeholders = await listStakeholders(auth.tenantId, id);
        const assessment = await predictSpecInRisk({
          project,
          specs,
          coverage: specCoverage(specs),
          chain: decisionChainHealth(stakeholders),
        }, { tenantId: auth.tenantId, actorUserId: auth.userId });
        return NextResponse.json({ assessment });
      }
      case 'decision_chain': {
        const stakeholders = await listStakeholders(auth.tenantId, id);
        const insight = await analyzeDecisionChain({
          project,
          stakeholders,
          chain: decisionChainHealth(stakeholders),
        }, { tenantId: auth.tenantId, actorUserId: auth.userId });
        return NextResponse.json({ insight });
      }
      case 'tender_analysis': {
        const text = typeof body.text === 'string' ? body.text : '';
        if (!text.trim()) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
        const analysis = await analyzeTenderDocument(text, { tenantId: auth.tenantId, actorUserId: auth.userId });
        return NextResponse.json({ analysis });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Project AI POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
