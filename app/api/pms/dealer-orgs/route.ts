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
import { getStore } from '@/lib/storage/repository';
import {
  upsertDealerProfile,
  getDealerProfile,
  listDealerProfiles,
  addQualification,
  listQualifications,
  decideQualification,
} from '@/lib/pms/dealer-org-service';
import { mergeDealerProfilesWithOrganizations } from '@/lib/pms/dealer-options';
import {
  isYonyouCustomerConfigured,
  listYonyouCustomerCategories,
  listYonyouCustomerDealerProfiles,
  YonyouCustomerRequestError,
} from '@/lib/integrations/yonyou-customer';
import {
  YonyouTokenConfigError,
  YonyouTokenRequestError,
} from '@/lib/integrations/yonyou-token';

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

    if (searchParams.get('source') === 'ys') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: YS customer source requires internal role' }, { status: 403 });
      }
      if (!isYonyouCustomerConfigured()) {
        return NextResponse.json({
          error: 'YONSUITE_API_BASE, YONSUITE_APP_KEY and YONSUITE_APP_SECRET are required',
        }, { status: 503 });
      }
      const pageIndex = searchParams.get('pageIndex') ? parseInt(searchParams.get('pageIndex')!) : 1;
      const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50;
      const includeStopped = searchParams.get('includeStopped') === '1';
      const keyword = (searchParams.get('q') || '').trim();
      const customerClassCodes = (searchParams.get('customerClassCodes') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50);
      const classCodes = customerClassCodes.length
        ? customerClassCodes
        : [searchParams.get('customerClassCode') || undefined];
      const keywordLooksLikeCode = /^[A-Za-z0-9_.\/-]+$/.test(keyword);
      const searchVariants = keyword
        ? (keywordLooksLikeCode ? [{ code: keyword }, { name: keyword }] : [{ name: keyword }, { code: keyword }])
        : [{
          code: searchParams.get('code') || undefined,
          name: searchParams.get('name') || undefined,
        }];
      const listOptions = {
        pageIndex,
        pageSize,
        stopStatus: includeStopped ? undefined : false,
        pubts: searchParams.get('pubts') || undefined,
      };
      const results = await Promise.all(classCodes.flatMap((customerClassCode) => (
        searchVariants.map((variant) => listYonyouCustomerDealerProfiles({
          ...listOptions,
          ...variant,
          customerClassCode,
        }))
      )));
      const result = results[0];
      const shouldMergeProfiles = customerClassCodes.length > 1 || searchVariants.length > 1;
      const profiles = shouldMergeProfiles
        ? Array.from(new Map(results.flatMap((item) => item.profiles).map((profile) => [profile.id, profile])).values()).slice(0, pageSize)
        : result.profiles;
      const categories = await listYonyouCustomerCategories({
        pageIndex: 1,
        pageSize: 5000,
      });
      return NextResponse.json({
        source: 'ys',
        profiles,
        categories,
        page: {
          pageIndex,
          pageSize,
          pageCount: shouldMergeProfiles ? 1 : result.pageCount,
          recordCount: shouldMergeProfiles ? profiles.length : result.recordCount,
          pubts: result.pubts,
        },
      });
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
    const organizations = await getStore().organizations.list({ tenantId: auth.tenantId });
    const enrichedProfiles = mergeDealerProfilesWithOrganizations(profiles, organizations);
    return NextResponse.json({ profiles: enrichedProfiles });
  } catch (error: any) {
    console.error('Dealer-orgs GET error:', error);
    if (error instanceof YonyouTokenConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof YonyouTokenRequestError || error instanceof YonyouCustomerRequestError) {
      return NextResponse.json({
        error: error.message,
        code: error.details.code,
        yonyouMessage: error.details.yonyouMessage,
        status: error.details.status,
      }, { status: 502 });
    }
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
