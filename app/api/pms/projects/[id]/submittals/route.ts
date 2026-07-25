/**
 * PMS API · 项目提交物 (图纸/技术方案/资质 版本管理)
 *
 * GET  /api/pms/projects/[id]/submittals         列表
 * POST /api/pms/projects/[id]/submittals         action 分发
 *   action=create   { title, docType?, fileUrl?, tenderId?, submittedTo? }
 *   action=revise   { submittalId, fileUrl?, title? }        新版本
 *   action=review   { submittalId, status, reviewedBy?, reviewNotes?, submittedTo? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, canAccessRecord, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getProject } from '@/lib/pms/project-service';
import {
  createSubmittal,
  reviseSubmittal,
  reviewSubmittal,
  listSubmittals,
} from '@/lib/pms/tender-service';
import type { SubmittalDocType, SubmittalStatus } from '@/lib/types/pms';

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
    const submittals = await listSubmittals(auth.tenantId, id);
    return NextResponse.json({ submittals });
  } catch (error: any) {
    console.error('Submittals GET error:', error);
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
      if (!body.title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });
      const submittal = await createSubmittal({
        tenantId: auth.tenantId,
        projectId: id,
        tenderId: body.tenderId,
        docType: (body.docType as SubmittalDocType) || undefined,
        title: body.title,
        fileUrl: body.fileUrl,
        submittedTo: body.submittedTo,
        createdBy: auth.userId,
      });
      return NextResponse.json({ submittal }, { status: 201 });
    }
    if (action === 'revise') {
      if (!body.submittalId) return NextResponse.json({ error: 'Missing submittalId' }, { status: 400 });
      const submittal = await reviseSubmittal({
        tenantId: auth.tenantId,
        id: body.submittalId,
        fileUrl: body.fileUrl,
        title: body.title,
        createdBy: auth.userId,
      });
      return NextResponse.json({ submittal }, { status: 201 });
    }
    if (action === 'review') {
      if (!body.submittalId || !body.status) return NextResponse.json({ error: 'Missing submittalId or status' }, { status: 400 });
      const submittal = await reviewSubmittal({
        tenantId: auth.tenantId,
        id: body.submittalId,
        status: body.status as SubmittalStatus,
        reviewedBy: body.reviewedBy ?? auth.userId,
        reviewNotes: body.reviewNotes,
        submittedTo: body.submittedTo,
      });
      return NextResponse.json({ submittal });
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Submittals POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
