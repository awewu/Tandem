/**
 * PMS API · 线索开发 (Demand Gen, 内部)
 *
 * GET  ?status=&source=&assignedTo=   列表
 * POST { action:'create' | 'transition' | 'convert' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createLead,
  listLeads,
  transitionLead,
  convertLead,
  type LeadStatus,
} from '@/lib/pms/demand-gen-service';

const LEAD_STATUSES: LeadStatus[] = ['new', 'assigned', 'nurturing', 'converted', 'dropped'];

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: leads are internal' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const leads = await listLeads({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      source: searchParams.get('source') || undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Leads GET error:', error);
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

  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: leads are internal' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      if (!body.source || !body.customerName) {
        return NextResponse.json({ error: 'Missing required fields: source, customerName' }, { status: 400 });
      }
      const lead = await createLead({
        tenantId: auth.tenantId,
        source: body.source,
        customerName: body.customerName,
        contactPhone: body.contactPhone,
        region: body.region,
        assignedTo: body.assignedTo,
      });
      return NextResponse.json({ lead }, { status: 201 });
    }

    if (action === 'transition') {
      if (!body.id || !body.toStatus || !LEAD_STATUSES.includes(body.toStatus)) {
        return NextResponse.json({ error: 'Missing/invalid id or toStatus' }, { status: 400 });
      }
      const result = await transitionLead({
        tenantId: auth.tenantId,
        id: body.id,
        toStatus: body.toStatus,
        assignedTo: body.assignedTo,
      });
      return NextResponse.json({ result });
    }

    if (action === 'convert') {
      if (!body.id || !body.opportunityId) {
        return NextResponse.json({ error: 'Missing id or opportunityId' }, { status: 400 });
      }
      const result = await convertLead({ tenantId: auth.tenantId, id: body.id, opportunityId: body.opportunityId });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | transition | convert' }, { status: 400 });
  } catch (error: any) {
    console.error('Leads POST error:', error);
    if (/not found|illegal lead transition|not convertible/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
