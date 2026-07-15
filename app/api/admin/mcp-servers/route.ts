/**
 * GET    /api/admin/mcp-servers        — 列出已配置的 MCP server (authHeader 脱敏)
 * PUT    /api/admin/mcp-servers        — upsert 一个 MCP server (owner/admin only)
 * DELETE /api/admin/mcp-servers?name=x — 删除一个 MCP server
 *
 * 写操作后立即 syncMcpServersToRegistry() → 无需重启即生效 (B-002).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  listMcpServerRecords,
  upsertMcpServerRecord,
  deleteMcpServerRecord,
  syncMcpServersToRegistry,
} from '@/lib/settings/mcp-servers';
import { maskKey } from '@/lib/settings/ai-settings';
import type { McpServerRecord } from '@/lib/types/mcp-server';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

function requireAdmin(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }
  return auth;
}

function mask(r: McpServerRecord): McpServerRecord {
  return { ...r, authHeader: r.authHeader ? maskKey(r.authHeader) : r.authHeader };
}

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const records = await listMcpServerRecords(auth.tenantId);
  return NextResponse.json({ servers: records.map(mask) });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/mcp-servers' });

async function PUTApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: string } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }
  if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name)) {
    return NextResponse.json({ error: 'name 必填且仅限字母/数字/_/-' }, { status: 400 });
  }

  // authHeader 留空 (或脱敏占位) 时不覆盖已存值
  const patch = { ...body } as Record<string, unknown>;
  if (typeof patch.authHeader === 'string' && patch.authHeader.includes('****')) {
    delete patch.authHeader;
  }

  const updated = await upsertMcpServerRecord(patch as { name: string }, auth.userId, auth.tenantId);
  await syncMcpServersToRegistry(auth.tenantId);
  return NextResponse.json({ server: mask(updated) });
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/admin/mcp-servers' });

async function DELETEApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const name = req.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ error: '缺少 name 参数' }, { status: 400 });
  const ok = await deleteMcpServerRecord(name, auth.tenantId);
  return NextResponse.json({ ok });
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/admin/mcp-servers' });
