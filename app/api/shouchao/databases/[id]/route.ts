/**
 * 搭子手抄 · 单个数据库
 *   GET    /api/shouchao/databases/:id   读取库定义 (含属性/视图)
 *   PATCH  /api/shouchao/databases/:id   更新 (name/icon/properties/views)
 *   DELETE /api/shouchao/databases/:id   软删 (级联软删行)
 * 全部按 ownerId 隔离.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getDatabase, updateDatabase, deleteDatabase } from '@/lib/shouchao/db-service';
import type { ShouchaoProperty, ShouchaoView } from '@/lib/types/shouchao-db';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const database = await getDatabase(auth.userId, params.id);
  if (!database) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ database });
}

async function PATCHApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const database = await updateDatabase(auth.userId, params.id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    icon: typeof body.icon === 'string' ? body.icon : undefined,
    properties: Array.isArray(body.properties) ? (body.properties as ShouchaoProperty[]) : undefined,
    views: Array.isArray(body.views) ? (body.views as ShouchaoView[]) : undefined,
  });
  if (!database) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ database });
}

async function DELETEApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const ok = await deleteDatabase(auth.userId, params.id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/databases/[id]' });
export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/shouchao/databases/[id]' });
export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/shouchao/databases/[id]' });
