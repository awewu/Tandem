/**
 * §CA-9 · Skill Proposal Admin API
 *
 * GET   /api/admin/skill-proposals                   列出已生成的提议 (分页/状态筛选)
 * POST  /api/admin/skill-proposals                   触发 pattern detection + 自动生成提议
 * PATCH /api/admin/skill-proposals                   签批 (approve/reject) 已有提议
 *
 * 权限: admin / steward / champion
 * 签批: 仅 admin / champion (跟 Memory promotion 同级)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { detectPatterns } from '@/lib/skills/pattern-detector';
import { generateSkillProposal, reviewSkillProposal } from '@/lib/skills/skill-proposal';
import { getStore } from '@/lib/storage/repository';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // draft / approved / rejected / 全部
  let limit = Number(url.searchParams.get('limit') ?? 50);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;

  const store = getStore();
  // Tenant isolation: 收敛到统一 withTenantScope (宪章 §23).
  let all = await withTenantScope(store.skillProposals, auth.tenantId).list();
  if (status) {
    all = all.filter((p) => p.status === status);
  }
  all = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

  return NextResponse.json({ proposals: all, total: all.length });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleErr = requireRole(auth, ['admin', 'steward', 'champion']);
  if (roleErr) return roleErr;

  let body: {
    minFrequency?: number;
    windowDays?: number;
    useLlm?: boolean;
    maxPatterns?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* 允许空 body */
  }

  // 1. 检测模式
  const patterns = await detectPatterns({
    minFrequency: body.minFrequency ?? 3,
    windowDays: body.windowDays ?? 90,
    maxPatterns: body.maxPatterns ?? 5,
    tenantId: auth.tenantId,
  });

  if (patterns.length === 0) {
    return NextResponse.json({
      ok: true,
      patternsDetected: 0,
      proposalsGenerated: 0,
      message: '未检测到 ≥ minFrequency 张 DC 的重复模式',
    });
  }

  // 2. 为每个 pattern 生成 SkillProposal (并行, 但 LLM 调用顺序以省 RPS)
  const proposals = [];
  for (const pattern of patterns) {
    const p = await generateSkillProposal({
      pattern,
      tenantId: auth.tenantId,
      proposedBy: auth.userId,
      useLlm: body.useLlm ?? false, // 默认启发式 (省成本)
    });
    if (p) proposals.push(p);
  }

  return NextResponse.json({
    ok: true,
    patternsDetected: patterns.length,
    proposalsGenerated: proposals.length,
    proposals: proposals.map((p) => ({ id: p.id, proposedId: p.pattern.proposedId, status: p.status })),
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 签批权限收紧: 仅 admin / champion
  const roleErr = requireRole(auth, ['admin', 'champion']);
  if (roleErr) return roleErr;

  let body: { proposalId?: string; approve?: boolean; reason?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  if (!body.proposalId || typeof body.approve !== 'boolean') {
    return NextResponse.json(
      { error: 'proposalId (string) and approve (boolean) are required' },
      { status: 400 },
    );
  }

  const updated = await reviewSkillProposal(
    body.proposalId,
    body.approve,
    auth.userId,
    body.reason,
  );
  if (!updated) {
    return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, proposal: updated });
}
