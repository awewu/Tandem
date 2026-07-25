/**
 * PMS API · 工程项目详情 (聚合: 项目 + 干系人 + 决策链健康 + 规格矩阵 + 战况)
 *
 * GET    /api/pms/projects/[id]          聚合详情
 * POST   /api/pms/projects/[id]          action 分发 (写操作)
 *   action=transition_stage   { toStage }
 *   action=update_project      { patch }
 *   action=add_stakeholder     { role,name,... }
 *   action=update_stakeholder  { stakeholderId, patch }
 *   action=remove_stakeholder  { stakeholderId }
 *   action=add_spec            { equipmentFamily,... }
 *   action=update_spec         { specId, patch }
 *   action=remove_spec         { specId }
 * DELETE /api/pms/projects/[id]          软删除项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, canAccessRecord, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  getProject,
  transitionProjectStage,
  updateProject,
  archiveProject,
  getProjectPipeline,
} from '@/lib/pms/project-service';
import { listOpportunities, linkOpportunityToProject, createOpportunity } from '@/lib/pms/opportunity-service';
import {
  addStakeholder,
  listStakeholders,
  updateStakeholder,
  removeStakeholder,
  decisionChainHealth,
} from '@/lib/pms/project-stakeholder-service';
import {
  createSpecPosition,
  listSpecPositions,
  updateSpecPosition,
  removeSpecPosition,
  specCoverage,
} from '@/lib/pms/spec-position-service';
import type { ProjectStage } from '@/lib/types/pms';

async function authOrError(req: NextRequest): Promise<PmsAuthResult | NextResponse> {
  try {
    return await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e as unknown as NextResponse;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const [stakeholders, specPositions, opportunities, pipeline] = await Promise.all([
      listStakeholders(auth.tenantId, id),
      listSpecPositions(auth.tenantId, id),
      listOpportunities({ tenantId: auth.tenantId, projectId: id, limit: 1000 }),
      getProjectPipeline(auth.tenantId, id),
    ]);
    return NextResponse.json({
      project,
      stakeholders,
      specPositions,
      opportunities,
      pipeline,
      decisionChain: decisionChainHealth(stakeholders),
      specCoverage: specCoverage(specPositions),
    });
  } catch (error: any) {
    console.error('Project GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
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

    const body = await req.json();
    const action = (body.action as string) || '';

    switch (action) {
      case 'transition_stage': {
        if (!body.toStage) return NextResponse.json({ error: 'Missing toStage' }, { status: 400 });
        const updated = await transitionProjectStage({ tenantId: auth.tenantId, id, toStage: body.toStage as ProjectStage });
        return NextResponse.json({ project: updated });
      }
      case 'update_project': {
        const updated = await updateProject({ tenantId: auth.tenantId, id, patch: body.patch || {} });
        return NextResponse.json({ project: updated });
      }
      case 'add_stakeholder': {
        if (!body.role || !body.name) return NextResponse.json({ error: 'Missing role or name' }, { status: 400 });
        const sh = await addStakeholder({
          tenantId: auth.tenantId,
          projectId: id,
          role: body.role,
          name: body.name,
          company: body.company,
          title: body.title,
          phone: body.phone,
          email: body.email,
          influence: body.influence,
          isChampion: body.isChampion,
          isEconomicBuyer: body.isEconomicBuyer,
          notes: body.notes,
          createdBy: auth.userId,
        });
        return NextResponse.json({ stakeholder: sh }, { status: 201 });
      }
      case 'update_stakeholder': {
        if (!body.stakeholderId) return NextResponse.json({ error: 'Missing stakeholderId' }, { status: 400 });
        const sh = await updateStakeholder({ tenantId: auth.tenantId, id: body.stakeholderId, patch: body.patch || {} });
        return NextResponse.json({ stakeholder: sh });
      }
      case 'remove_stakeholder': {
        if (!body.stakeholderId) return NextResponse.json({ error: 'Missing stakeholderId' }, { status: 400 });
        await removeStakeholder(auth.tenantId, body.stakeholderId);
        return NextResponse.json({ ok: true });
      }
      case 'add_spec': {
        if (!body.equipmentFamily) return NextResponse.json({ error: 'Missing equipmentFamily' }, { status: 400 });
        const spec = await createSpecPosition({
          tenantId: auth.tenantId,
          projectId: id,
          equipmentFamily: body.equipmentFamily,
          ourBrandStatus: body.ourBrandStatus,
          ourProductSeriesCode: body.ourProductSeriesCode,
          ourProductModel: body.ourProductModel,
          competitorBrand: body.competitorBrand,
          competitorModel: body.competitorModel,
          estimatedValue: typeof body.estimatedValue === 'number' ? body.estimatedValue : undefined,
          specStage: body.specStage,
          notes: body.notes,
          createdBy: auth.userId,
        });
        return NextResponse.json({ specPosition: spec }, { status: 201 });
      }
      case 'update_spec': {
        if (!body.specId) return NextResponse.json({ error: 'Missing specId' }, { status: 400 });
        const spec = await updateSpecPosition({ tenantId: auth.tenantId, id: body.specId, updatedBy: auth.userId, patch: body.patch || {} });
        return NextResponse.json({ specPosition: spec });
      }
      case 'remove_spec': {
        if (!body.specId) return NextResponse.json({ error: 'Missing specId' }, { status: 400 });
        await removeSpecPosition(auth.tenantId, body.specId);
        return NextResponse.json({ ok: true });
      }
      case 'link_opportunity': {
        if (!body.opportunityId) return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 });
        await linkOpportunityToProject(body.opportunityId, id, auth.tenantId);
        return NextResponse.json({ ok: true });
      }
      case 'unlink_opportunity': {
        if (!body.opportunityId) return NextResponse.json({ error: 'Missing opportunityId' }, { status: 400 });
        await linkOpportunityToProject(body.opportunityId, null, auth.tenantId);
        return NextResponse.json({ ok: true });
      }
      case 'list_unassigned_opportunities': {
        // 本租户下未归属任何工程项目的商机线索 (供 360 页关联)
        const list = await listOpportunities({
          tenantId: auth.tenantId,
          unassigned: true,
          visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
          limit: 100,
        });
        return NextResponse.json({ opportunities: list });
      }
      case 'create_opportunity': {
        // 在本项目下直接新建商机 (自动 projectId 绑定, 归属沿用项目 orgId)
        if (!body.customerName) return NextResponse.json({ error: 'Missing customerName' }, { status: 400 });
        const orgId = project.orgId;
        const result = await createOpportunity({
          tenantId: auth.tenantId,
          orgId,
          dealerOrgId: body.dealerOrgId || orgId,
          reporterId: auth.userId,
          projectId: id,
          customerName: body.customerName,
          projectName: body.projectName || project.projectName,
          stage: body.stage,
          estimatedAmount: typeof body.estimatedAmount === 'number' ? body.estimatedAmount : undefined,
          region: body.region || project.region,
        });
        if (!result.opportunity && result.duplicateCheck) {
          return NextResponse.json({ error: 'Duplicate opportunity detected', duplicateCheck: result.duplicateCheck }, { status: 409 });
        }
        return NextResponse.json({ opportunity: result.opportunity }, { status: 201 });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Project POST error:', error);
    if (/invalid project stage transition/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await archiveProject(auth.tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Project DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
