/**
 * PMS API · 项目招投标
 *
 * GET  /api/pms/projects/[id]/tenders            列表
 * POST /api/pms/projects/[id]/tenders            action 分发
 *   action=create      { tenderName, ... }
 *   action=transition  { tenderId, toStatus, winnerName?, ourRank?, result? }
 *   action=archive     { tenderId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, canAccessRecord, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getProject } from '@/lib/pms/project-service';
import {
  createTender,
  listTenders,
  transitionTender,
  archiveTender,
} from '@/lib/pms/tender-service';
import type { TenderType, TenderStatus } from '@/lib/types/pms';

async function authOrError(req: NextRequest): Promise<PmsAuthResult | NextResponse> {
  try {
    return await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e as unknown as NextResponse;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

async function guardProject(auth: PmsAuthResult, tenantId: string, projectId: string): Promise<NextResponse | null> {
  const project = await getProject(tenantId, projectId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (!canAccessRecord(auth, project)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await authOrError(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const guard = await guardProject(auth, auth.tenantId, id);
    if (guard) return guard;
    const tenders = await listTenders(auth.tenantId, id);
    return NextResponse.json({ tenders });
  } catch (error: any) {
    console.error('Tenders GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await authOrError(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const guard = await guardProject(auth, auth.tenantId, id);
    if (guard) return guard;

    const body = await req.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      if (!body.tenderName) return NextResponse.json({ error: 'Missing tenderName' }, { status: 400 });
      const tender = await createTender({
        tenantId: auth.tenantId,
        projectId: id,
        tenderName: body.tenderName,
        tenderNo: body.tenderNo,
        tenderType: (body.tenderType as TenderType) || undefined,
        bidAmount: typeof body.bidAmount === 'number' ? body.bidAmount : undefined,
        budgetAmount: typeof body.budgetAmount === 'number' ? body.budgetAmount : undefined,
        publishedAt: body.publishedAt,
        submitDeadline: body.submitDeadline,
        notes: body.notes,
        createdBy: auth.userId,
      });
      return NextResponse.json({ tender }, { status: 201 });
    }
    if (action === 'transition') {
      if (!body.tenderId || !body.toStatus) return NextResponse.json({ error: 'Missing tenderId or toStatus' }, { status: 400 });
      const tender = await transitionTender({
        tenantId: auth.tenantId,
        id: body.tenderId,
        toStatus: body.toStatus as TenderStatus,
        winnerName: body.winnerName,
        ourRank: typeof body.ourRank === 'number' ? body.ourRank : undefined,
        result: body.result,
      });
      return NextResponse.json({ tender });
    }
    if (action === 'archive') {
      if (!body.tenderId) return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });
      await archiveTender(auth.tenantId, body.tenderId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Tenders POST error:', error);
    if (/invalid tender status transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
