/**
 * PMS API · 经销商档案 + 资质 (DMS)
 *
 * GET  ?orgId=                     经销商档案 (经销商仅本 org)
 * GET  ?qualifications=1&dealerOrgId=  资质列表
 * POST { action:'upsert_profile' }  维护档案 (经销商本 org / 内部)
 * POST { action:'add_qualification' } 提交资质 (经销商本 org / 内部)
 * POST { action:'approve_qualification' | 'reject_qualification' } 审批 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  upsertDealerProfile,
  getDealerProfile,
  listDealerProfiles,
  addQualification,
  listQualifications,
  decideQualification,
} from '@/lib/pms/dealer-org-service';

function dealerCanTouch(auth: PmsAuthResult, orgId: string): boolean {
  return auth.isInternal || auth.visibleOrgIds.includes(orgId);
}

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

    if (searchParams.get('qualifications') === '1') {
      const dealerOrgId = searchParams.get('dealerOrgId') || undefined;
      if (!auth.isInternal && (!dealerOrgId || !auth.visibleOrgIds.includes(dealerOrgId))) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
      const qualifications = await listQualifications({
        tenantId: auth.tenantId,
        dealerOrgId,
        type: searchParams.get('type') || undefined,
        status: searchParams.get('status') || undefined,
      });
      return NextResponse.json({ qualifications });
    }

    const orgId = searchParams.get('orgId') || undefined;
    if (orgId) {
      if (!dealerCanTouch(auth, orgId)) {
        return NextResponse.json({ error: 'forbidden: orgId out of scope' }, { status: 403 });
      }
      const profile = await getDealerProfile(orgId, auth.tenantId);
      return NextResponse.json({ profile });
    }

    if (!auth.isInternal) {
      return NextResponse.json({ error: 'orgId is required for external users' }, { status: 400 });
    }
    const profiles = await listDealerProfiles({
      tenantId: auth.tenantId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ profiles });
  } catch (error: any) {
    console.error('Dealer-orgs GET error:', error);
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
    const action = body.action as string;

    if (action === 'upsert_profile') {
      const orgId = auth.isInternal ? body.orgId : auth.orgId;
      if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
      if (!dealerCanTouch(auth, orgId)) {
        return NextResponse.json({ error: 'forbidden: orgId out of scope' }, { status: 403 });
      }
      const profile = await upsertDealerProfile({
        tenantId: auth.tenantId,
        orgId,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
        businessLicense: body.businessLicense,
        registeredCapital: typeof body.registeredCapital === 'number' ? body.registeredCapital : undefined,
        establishedDate: body.establishedDate,
        coverageRegions: Array.isArray(body.coverageRegions) ? body.coverageRegions : undefined,
      });
      return NextResponse.json({ profile }, { status: 201 });
    }

    if (action === 'add_qualification') {
      const dealerOrgId = auth.isInternal ? body.dealerOrgId : auth.orgId;
      if (!dealerOrgId || !body.type) {
        return NextResponse.json({ error: 'Missing dealerOrgId or type' }, { status: 400 });
      }
      if (!dealerCanTouch(auth, dealerOrgId)) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
      const qualification = await addQualification({
        tenantId: auth.tenantId,
        dealerOrgId,
        type: body.type,
        certificateNumber: body.certificateNumber,
        issuedBy: body.issuedBy,
        issuedDate: body.issuedDate,
        expiryDate: body.expiryDate,
      });
      return NextResponse.json({ qualification }, { status: 201 });
    }

    if (action === 'approve_qualification' || action === 'reject_qualification') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: qualification review requires internal role' }, { status: 403 });
      }
      if (!body.qualificationId) {
        return NextResponse.json({ error: 'Missing qualificationId' }, { status: 400 });
      }
      const result = await decideQualification({
        tenantId: auth.tenantId,
        qualificationId: body.qualificationId,
        approverId: auth.userId,
        decision: action === 'approve_qualification' ? 'approved' : 'rejected',
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Dealer-orgs POST error:', error);
    if (/not found|not decidable/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
