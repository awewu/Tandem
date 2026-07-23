/**
 * 搭子手抄 · 数据库集合
 *   GET  /api/shouchao/databases   列出当前用户数据库
 *   POST /api/shouchao/databases   新建数据库 (带默认属性 + 表格视图)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listDatabases, createDatabase } from '@/lib/shouchao/db-service';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const databases = await listDatabases(auth.userId);
  return NextResponse.json({ databases });
}

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: { name?: string; icon?: string; parentId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const database = await createDatabase({
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    name: typeof body.name === 'string' ? body.name : undefined,
    icon: typeof body.icon === 'string' ? body.icon : undefined,
    parentId: typeof body.parentId === 'string' ? body.parentId : undefined,
  });
  return NextResponse.json({ database }, { status: 201 });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/databases' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/databases' });
