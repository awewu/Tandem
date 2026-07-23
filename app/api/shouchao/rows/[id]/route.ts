/**
 * 搭子手抄 · 单行
 *   PATCH  /api/shouchao/rows/:id   更新单元格 (cells 合并)
 *   DELETE /api/shouchao/rows/:id   软删行
 * 按 ownerId 隔离.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { updateRow, deleteRow } from '@/lib/shouchao/db-service';
import type { ShouchaoCellValue } from '@/lib/types/shouchao-db';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function PATCHApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: { cells?: Record<string, ShouchaoCellValue> };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const cells = body.cells && typeof body.cells === 'object' ? body.cells : {};
  const row = await updateRow(auth.userId, params.id, cells);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ row });
}

async function DELETEApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const ok = await deleteRow(auth.userId, params.id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/shouchao/rows/[id]' });
export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/shouchao/rows/[id]' });
