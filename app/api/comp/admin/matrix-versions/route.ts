import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { db } from '@/lib/infra/drizzle-client';
import { compMatrixVersion } from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';
import { audit } from '@/lib/audit/log';

/**
 * GET /api/comp/admin/matrix-versions — 列出矩阵版本
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select()
      .from(compMatrixVersion)
      .where(eq(compMatrixVersion.tenantId, auth.tenantId));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/matrix-versions' });

/**
 * POST /api/comp/admin/matrix-versions — 创建/发布版本
 *   { version, changelog?, status?: 'draft'|'published'|'archived' }
 *
 * 发布时: 旧 published 版本自动归档 (同租户仅一个 published)。
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (!body.version) {
    return NextResponse.json({ error: 'version required' }, { status: 400 });
  }

  const status = String(body.status ?? 'draft') as 'draft' | 'published' | 'archived';
  const id = `mv_${auth.tenantId}_${body.version}`;

  try {
    if (status === 'published') {
      const existing = await db
        .select()
        .from(compMatrixVersion)
        .where(eq(compMatrixVersion.tenantId, auth.tenantId));
      for (const r of existing) {
        if (r.status === 'published' && r.id !== id) {
          await db
            .update(compMatrixVersion)
            .set({ status: 'archived' })
            .where(eq(compMatrixVersion.id, r.id));
        }
      }
    }

    await db
      .insert(compMatrixVersion)
      .values({
        id,
        tenantId: auth.tenantId,
        version: String(body.version),
        changelog: body.changelog ?? null,
        publishedBy: status === 'published' ? auth.userId : null,
        status,
      })
      .onConflictDoUpdate({
        target: compMatrixVersion.id,
        set: {
          changelog: body.changelog ?? null,
          publishedBy: status === 'published' ? auth.userId : null,
          status,
        },
      });

    const auditAction = status === 'published' ? 'comp.matrix_version_published' : status === 'archived' ? 'comp.matrix_version_archived' : 'comp.matrix_version_draft';
    await audit(auditAction, auth.userId, {
      targetId: id,
      targetType: 'comp_matrix_version',
      tenantId: auth.tenantId,
      metadata: { version: body.version },
    });

    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/matrix-versions' });
