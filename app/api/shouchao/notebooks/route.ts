/**
 * 搭子手抄 · 知识库集合 (对标 Get笔记 知识库)
 *
 *   GET  /api/shouchao/notebooks    列出本人全部知识库 (含笔记数)
 *   POST /api/shouchao/notebooks    新建知识库 { name, icon? }
 *
 * 全部按 ownerId 隔离 (个人资产).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listNotebooks, createNotebook } from '@/lib/shouchao/service';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const notebooks = await listNotebooks(auth.userId);
  return NextResponse.json({ notebooks });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/notebooks' });

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: { name?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name 必填' }, { status: 400 });
  }

  const notebook = await createNotebook(
    auth.userId,
    auth.tenantId,
    name,
    typeof body.icon === 'string' ? body.icon : undefined,
  );
  return NextResponse.json({ notebook }, { status: 201 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/notebooks' });
