/**
 * MCP Server · JSON-RPC 分发器 (Streamable HTTP 的 JSON 响应模式)
 *
 * 为什么手写而非用 SDK 的 StreamableHTTPServerTransport:
 *   SDK transport.handleRequest 依赖 Node 原生 req/res, 而 Next App Router 用的是
 *   Web Fetch Request/Response, 两者不兼容 (强接会脆)。MCP Streamable HTTP 规范允许
 *   服务器对单个 JSON-RPC 请求直接返回 application/json (而非 SSE), 故这里实现
 *   spec 对齐的 JSON 模式分发, 完全可控、可单测、与任何接受 JSON 响应的 MCP 客户端互通。
 *
 * 支持方法: initialize · notifications/initialized · ping · tools/list · tools/call
 */

import { skillRegistry } from '@/lib/taf/skills/registry';
import { runInTenantScope } from '@/lib/storage/tenant-scope';
import { listReadOnlyMcpTools, resolveReadOnlySkillId } from './read-only-tools';

/** MCP 协议版本 (与 SDK 1.29 对齐)。 */
export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SERVER_INFO = { name: 'tandem-mcp-server', version: '1.0.0' } as const;

/** 外部 agent 调用时的服务主体 (由路由层按 token 解析出)。 */
export interface McpServerPrincipal {
  userId: string;
  tenantId: string;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}
function fail(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * 分发单条 JSON-RPC 请求。
 * 返回 null = 该消息是通知 (notification, 无 id), 按规范不产生响应。
 */
export async function handleMcpJsonRpc(
  req: JsonRpcRequest,
  principal: McpServerPrincipal,
): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;

  // 通知类: 无需响应
  if (req.method === 'notifications/initialized' || req.method === 'initialized') {
    return null;
  }

  try {
    switch (req.method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
        });

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, { tools: listReadOnlyMcpTools() });

      case 'tools/call': {
        const params = req.params ?? {};
        const name = typeof params.name === 'string' ? params.name : '';
        const args =
          params.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {};

        const skillId = name ? resolveReadOnlySkillId(name) : null;
        if (!skillId) {
          return ok(id, {
            isError: true,
            content: [{ type: 'text', text: `未知或未暴露的工具: ${name || '(空)'}` }],
          });
        }

        // isProxy=true: 外部 agent 调用视作 AI 代行 → registry 守门再兜一层
        // (red-zone / proxy 不允许的技能即便被误列也会被拦)。租户作用域强制隔离。
        const result = await runInTenantScope(principal.tenantId, () =>
          skillRegistry.execute(skillId, args, {
            userId: principal.userId,
            tenantId: principal.tenantId,
            isProxy: true,
          }),
        );

        return ok(id, {
          isError: !result.ok,
          content: [
            {
              type: 'text',
              text: result.ok
                ? JSON.stringify(result.data ?? null)
                : result.error ?? 'skill 执行失败',
            },
          ],
        });
      }

      default:
        return fail(id, -32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    return fail(id, -32603, (err as Error).message ?? 'internal error');
  }
}

/**
 * 分发一批 (或单条) JSON-RPC 请求。
 * 过滤掉通知产生的 null; 若全为通知则返回空数组 (路由层回 202)。
 */
export async function handleMcpBatch(
  body: JsonRpcRequest | JsonRpcRequest[],
  principal: McpServerPrincipal,
): Promise<JsonRpcResponse[]> {
  const reqs = Array.isArray(body) ? body : [body];
  const out: JsonRpcResponse[] = [];
  for (const r of reqs) {
    const res = await handleMcpJsonRpc(r, principal);
    if (res !== null) out.push(res);
  }
  return out;
}
