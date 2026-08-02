/**
 * POST /api/mcp-server · Tandem 对外暴露的 MCP Server (Streamable HTTP · JSON 模式)
 *
 * 让外部 agent (飞书 aily / Claude / 其它 MCP 客户端) 把 Tandem 当工具源调用其只读绿区技能。
 *
 * 鉴权: Authorization: Bearer <MCP_SERVER_TOKEN>
 * 开关: MCP_SERVER_ENABLED=1 才启用 (缺省关闭, 返回 404 不泄漏存在性)。
 * 主体: MCP_SERVER_PRINCIPAL_USER (默认 owner) + MCP_SERVER_TENANT (默认 default)。
 *
 * 安全: 只暴露 listReadOnlyMcpTools() (green + proxyAllowed); execute 以 isProxy=true
 * 走 registry 五道守门 + 租户作用域隔离。写动作永不经此。
 */

import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { handleMcpBatch, type JsonRpcRequest } from '@/lib/mcp-server/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function enabled(): boolean {
  return process.env.MCP_SERVER_ENABLED === '1';
}

function tokenOk(req: Request): boolean {
  const expected = process.env.MCP_SERVER_TOKEN;
  if (!expected) return false; // 未配 token = 不允许 (即便 enabled)
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] === expected : false;
}

function principal(): { userId: string; tenantId: string } {
  return {
    userId: process.env.MCP_SERVER_PRINCIPAL_USER || 'admin@tandem.local',
    tenantId: process.env.MCP_SERVER_TENANT || 'default',
  };
}

export async function POST(req: Request): Promise<Response> {
  if (!enabled()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (!tokenOk(req)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'unauthorized' } },
      { status: 401 },
    );
  }

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } },
      { status: 400 },
    );
  }

  await boot();

  const responses = await handleMcpBatch(body, principal());

  // 全为通知 → 无响应体, 202 Accepted (MCP 规范)
  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 });
  }
  // 单请求回单对象, 批量回数组 (JSON-RPC 惯例)
  const payload = Array.isArray(body) ? responses : responses[0];
  return NextResponse.json(payload);
}
