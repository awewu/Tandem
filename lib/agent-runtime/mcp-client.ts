/**
 * §CA-6 V2 · MCP Client · 真实连接 @modelcontextprotocol/sdk
 *
 * 这一层是 mcp-bridge.ts 的"实连引擎":
 *   - mcp-bridge.ts 维护 server 注册表 + 入口 API (向后兼容 V1 stub)
 *   - mcp-client.ts 按 transport 拉起 SDK Client, 缓存连接, 真调 callTool
 *
 * 设计:
 *   - lazy: 第一次 invoke 时才连接
 *   - cache: 同一 server 复用 Client (减少握手 cost)
 *   - degradation: SDK 加载/握手失败 → 返回错误, 不抛 (best-effort)
 *   - cleanup: process exit 前断开所有连接
 *
 * 支持 transport:
 *   - stdio : 子进程 (本地 MCP server, 如官方 reference servers)
 *   - http  : streamableHttp (远程 MCP server, 主流推荐)
 *   - sse   : 兼容老版本 server
 *   - websocket : 真 ws (不常用, 仅兼容)
 */

import { logger } from '@/lib/infra/logger';
import type { McpServerConfig } from './mcp-bridge';

// 用 unknown 占位避免顶层 import 时 SDK 不存在编译就挂
// 真实类型在 connectClient 内部用 dynamic import 拿
type AnyMcpClient = {
  callTool: (req: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
  listTools: () => Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }>;
  close: () => Promise<void>;
};

interface CachedConnection {
  client: AnyMcpClient;
  connectedAt: number;
  lastUsedAt: number;
}

const _g = globalThis as typeof globalThis & {
  __tandem_mcp_conn_cache__?: Map<string, CachedConnection>;
};
if (!_g.__tandem_mcp_conn_cache__) {
  _g.__tandem_mcp_conn_cache__ = new Map();
  // 进程退出时清理 (避免 stdio 子进程僵尸)
  if (typeof process !== 'undefined' && process.on) {
    process.on('exit', () => {
      const c = _g.__tandem_mcp_conn_cache__;
      if (!c) return;
      c.forEach((conn) => {
        try {
          void conn.client.close();
        } catch {
          /* swallow */
        }
      });
    });
  }
}
const cache = _g.__tandem_mcp_conn_cache__;

/** 拉一个连接 (优先用缓存) */
async function connectClient(server: McpServerConfig): Promise<AnyMcpClient> {
  const cached = cache.get(server.name);
  if (cached) {
    cached.lastUsedAt = Date.now();
    return cached.client;
  }

  // dynamic import — 防止 build 时 SDK 不存在阻塞 typecheck
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ClientCtor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let TransportCtor: any;
  let transportArgs: unknown[] = [];

  try {
    const clientMod = await import('@modelcontextprotocol/sdk/client/index.js');
    ClientCtor = (clientMod as { Client: unknown }).Client;

    switch (server.transport) {
      case 'stdio': {
        const stdioMod = await import('@modelcontextprotocol/sdk/client/stdio.js');
        TransportCtor = (stdioMod as { StdioClientTransport: unknown }).StdioClientTransport;
        transportArgs = [{ command: server.endpoint, args: server.args ?? [] }];
        break;
      }
      case 'http': {
        const httpMod = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
        TransportCtor = (httpMod as { StreamableHTTPClientTransport: unknown }).StreamableHTTPClientTransport;
        transportArgs = [
          new URL(server.endpoint),
          server.authHeader
            ? {
                requestInit: { headers: { Authorization: server.authHeader } },
              }
            : undefined,
        ].filter((x) => x !== undefined);
        break;
      }
      case 'sse': {
        const sseMod = await import('@modelcontextprotocol/sdk/client/sse.js');
        TransportCtor = (sseMod as { SSEClientTransport: unknown }).SSEClientTransport;
        transportArgs = [
          new URL(server.endpoint),
          server.authHeader
            ? { requestInit: { headers: { Authorization: server.authHeader } } }
            : undefined,
        ].filter((x) => x !== undefined);
        break;
      }
      case 'websocket': {
        const wsMod = await import('@modelcontextprotocol/sdk/client/websocket.js');
        TransportCtor = (wsMod as { WebSocketClientTransport: unknown }).WebSocketClientTransport;
        transportArgs = [new URL(server.endpoint)];
        break;
      }
      default:
        throw new Error(`Unsupported transport: ${server.transport}`);
    }
  } catch (err) {
    throw new Error(
      `[mcp-client] SDK / transport 加载失败 (${server.transport}): ${(err as Error).message}`,
    );
  }

  // 构造 Client + 连接
  // eslint-disable-next-line new-cap, @typescript-eslint/no-explicit-any
  const transport = new (TransportCtor as any)(...transportArgs);
  // eslint-disable-next-line new-cap, @typescript-eslint/no-explicit-any
  const client: AnyMcpClient = new (ClientCtor as any)(
    { name: 'tandem-mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    // @ts-expect-error connect 是 SDK 方法
    await client.connect(transport);
  } catch (err) {
    throw new Error(`[mcp-client] connect 失败 (${server.name}): ${(err as Error).message}`);
  }

  const now = Date.now();
  cache.set(server.name, { client, connectedAt: now, lastUsedAt: now });
  logger.info({ server: server.name, transport: server.transport }, '[mcp-client] connected (V2 live)');
  return client;
}

/** 真实调用 MCP 工具 (V2) */
export async function liveCallMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const client = await connectClient(server);
    const result = await client.callTool({ name: toolName, arguments: args });
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** 主动断开某 server (admin 后台关停时调) */
export async function disconnectMcpServer(name: string): Promise<void> {
  const cached = cache.get(name);
  if (!cached) return;
  try {
    await cached.client.close();
  } catch {
    /* swallow */
  }
  cache.delete(name);
  logger.info({ server: name }, '[mcp-client] disconnected');
}

/** 探针: 当前已连接的 server 名 (admin 看板用) */
export function getConnectedMcpServers(): Array<{
  name: string;
  connectedAt: number;
  lastUsedAt: number;
}> {
  const out: Array<{ name: string; connectedAt: number; lastUsedAt: number }> = [];
  cache.forEach((c, name) => {
    out.push({ name, connectedAt: c.connectedAt, lastUsedAt: c.lastUsedAt });
  });
  return out;
}
