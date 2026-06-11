/**
 * /api/admin/organizations  ·  上下游组织管理 (Owner/Admin)
 *
 * GET   列出全部下游组织 (挂在 anchor 下)
 * POST  新建下游组织 (经销商/供应商/门店/个体)
 *       Body: { name: string, type?: 'downstream'|'individual', category?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  createDownstreamOrg,
  listDownstreamOrgs,
  OrgError,
} from '@/lib/auth/organizations';
import type { OrganizationCategory } from '@/lib/types/organization';

const VALID_CATEGORIES: OrganizationCategory[] = ['dealer', 'supplier', 'store', 'contractor', 'partner'];

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;

  const items = await listDownstreamOrgs(auth.tenantId);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name 必填' }, { status: 400 });
  }
  const type = body.type === 'individual' ? 'individual' : 'downstream';
  const category =
    typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category as OrganizationCategory)
      ? (body.category as OrganizationCategory)
      : undefined;

  try {
    const org = await createDownstreamOrg({
      name,
      type,
      category,
      createdBy: auth.userId,
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ ok: true, organization: org }, { status: 201 });
  } catch (err) {
    if (err instanceof OrgError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
