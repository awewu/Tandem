/**
 * 搭子手抄 · 数据库行集合
 *   GET  /api/shouchao/databases/:id/rows   列出行
 *   POST /api/shouchao/databases/:id/rows   新建行 (可带初始 cells)
 * 按 ownerId 隔离; 库不存在/无权时 404.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listRows, createRow, getDatabase } from '@/lib/shouchao/db-service';
import type { ShouchaoCellValue } from '@/lib/types/shouchao-db';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const db = await getDatabase(auth.userId, params.id);
  if (!db) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rows = await listRows(auth.userId, params.id);
  return NextResponse.json({ rows });
}

async function POSTApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: { cells?: Record<string, ShouchaoCellValue> };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const row = await createRow({
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    databaseId: params.id,
    cells: body.cells && typeof body.cells === 'object' ? body.cells : {},
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ row }, { status: 201 });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/databases/[id]/rows' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/databases/[id]/rows' });
