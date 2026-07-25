/**
 * PMS API · 工程项目 (项目型销售核心)
 *
 * GET  ?stage=&status=&region=&ownerId=   列表 (经销商仅 visibleOrgIds)
 * POST { ...projectFields }               新建项目 (内部 或 归属经销商)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { createProject, listProjects } from '@/lib/pms/project-service';
import type { ProjectStage, ProjectStatus, ProjectType } from '@/lib/types/pms';

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
    const projects = await listProjects({
      tenantId: auth.tenantId,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
      stage: (searchParams.get('stage') as ProjectStage) || undefined,
      status: (searchParams.get('status') as ProjectStatus) || undefined,
      region: searchParams.get('region') || undefined,
      ownerId: searchParams.get('ownerId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Projects GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
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
    if (!body.projectName) {
      return NextResponse.json({ error: 'Missing required field: projectName' }, { status: 400 });
    }

    // 归属组织: 内部可指定 orgId; 经销商强制本 org
    let orgId: string;
    if (auth.isInternal) {
      orgId = body.orgId || auth.orgId || 'default';
    } else {
      if (!auth.orgId) {
        return NextResponse.json({ error: 'forbidden: dealer has no orgId' }, { status: 403 });
      }
      orgId = auth.orgId;
    }

    const project = await createProject({
      tenantId: auth.tenantId,
      orgId,
      projectName: body.projectName,
      projectType: (body.projectType as ProjectType) || undefined,
      projectCode: body.projectCode || undefined,
      customerName: body.customerName || undefined,
      customerAccountId: body.customerAccountId || undefined,
      region: body.region || undefined,
      channel: body.channel || undefined,
      address: body.address || undefined,
      addressGeo: body.addressGeo || undefined,
      designInstitute: body.designInstitute || undefined,
      stage: (body.stage as ProjectStage) || undefined,
      estimatedValue: typeof body.estimatedValue === 'number' ? body.estimatedValue : undefined,
      ownerId: body.ownerId || undefined,
      expectedTenderDate: body.expectedTenderDate || undefined,
      expectedAwardDate: body.expectedAwardDate || undefined,
      detectedAt: body.detectedAt || undefined,
      createdBy: auth.userId,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error('Projects POST error:', error);
    if (/duplicate key|unique/i.test(error?.message || '')) {
      return NextResponse.json({ error: 'projectCode already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
