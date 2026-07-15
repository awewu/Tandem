/**
 * 知识库 · 列表 / 创建
 *
 *   GET  /api/knowledge          列出本人全部知识节点 (folder + file)
 *   POST /api/knowledge          创建节点 { name, type, parentId?, content?, ownership? }
 *
 * 个人资产: 全部按 ownerId 隔离.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listNodes, createNode } from '@/lib/knowledge/service';
import type { KnowledgeOwnership } from '@/lib/types/knowledge';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const nodes = await listNodes(auth.userId);
  return NextResponse.json({ nodes });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/knowledge' });

interface CreateBody {
  name?: string;
  type?: 'folder' | 'file';
  parentId?: string | null;
  content?: string;
  ownership?: KnowledgeOwnership;
}

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    body = {};
  }

  const type = body.type === 'file' ? 'file' : 'folder';
  const node = await createNode({
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    name: typeof body.name === 'string' ? body.name : '',
    type,
    parentId: body.parentId ?? 'root',
    content: body.content,
    ownership: body.ownership,
  });
  return NextResponse.json({ node }, { status: 201 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/knowledge' });
