/**
 * GET /api/mcp-server/agent-card · A2A (Agent-to-Agent) 发现文档
 *
 * 通过 next.config.js rewrite 也暴露在 A2A 标准路径 /.well-known/agent-card.json。
 *
 * A2A 协议基石是 "Agent Card"——一份能力自述, 让其它 agent 发现本 agent 能做什么、如何调用。
 * 这里把 Tandem 暴露的只读绿区技能映射成 A2A skills, 并指向 MCP Server 端点作为实际调用面。
 *
 * 诚实披露: 完整 A2A message/send 任务端点 (含 streaming) 属后续增量; 当前先提供 spec 形状的
 * 发现卡 + MCP 调用面, 作为互操作 v1, 不做假闭环。缺省关闭 (MCP_SERVER_ENABLED=1 才吐卡)。
 */

import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { listReadOnlyMcpTools } from '@/lib/mcp-server/read-only-tools';
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO } from '@/lib/mcp-server/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl(req: Request): string {
  const env = process.env.MCP_SERVER_PUBLIC_URL;
  if (env) return env.replace(/\/$/, '');
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.MCP_SERVER_ENABLED !== '1') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  await boot();

  const origin = baseUrl(req);
  const tools = listReadOnlyMcpTools();

  const card = {
    protocolVersion: '0.3.0',
    name: 'Tandem 牛马搭子',
    description:
      '瑞合瑞德集团企业管理 AI (OKR/拿捏/搭子/学院/PMS)。对外暴露只读感知技能, 供外部 agent 编排调用。',
    url: `${origin}/api/mcp-server`,
    version: MCP_SERVER_INFO.version,
    provider: { organization: 'Rhautt', url: origin },
    capabilities: { streaming: false, pushNotifications: false },
    // 实际调用走 MCP Streamable HTTP (JSON 模式), 见 url 端点。
    preferredTransport: 'mcp',
    mcp: { endpoint: `${origin}/api/mcp-server`, protocolVersion: MCP_PROTOCOL_VERSION },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: tools.map((t) => ({
      id: t.name,
      name: t.name,
      description: t.description,
      tags: ['read-only', 'perception'],
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    })),
  };

  return NextResponse.json(card, {
    headers: { 'cache-control': 'public, max-age=60' },
  });
}
