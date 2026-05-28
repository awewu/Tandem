/**
 * §CA-6 · Model Context Protocol (MCP) Bridge · V1 stub
 *
 * 器官 #13 · 执行肢体 (MCP 接入部分)
 *
 * 设计:
 *   - MCP 是 Anthropic 提出的"AI 与外部数据源/工具的标准化协议"
 *   - 让 CompanyBrain / Persona 能调外部 MCP server 暴露的工具
 *     (如 Linear MCP / GitHub MCP / 飞书 MCP / 客户自部署的内部 MCP)
 *
 * V1 (本文件): 类型 + 注册表 stub. 不实际打通网络协议.
 *   - 业务调用方按本文件 API 走, V2 完整实现时无需改业务代码
 *   - 现状: registerMcpServer 只入内存; invokeMcp 永远返回 not-implemented
 *
 * V2 计划 (3-6 月内):
 *   - 接入 @modelcontextprotocol/sdk
 *   - stdio / SSE / WebSocket 三种传输
 *   - MCP server 列表 admin 可视化 (类似 Launchpad 但面向 AI)
 *   - 4 道闸 (Skill Gateway) 拦截器, 每个 MCP 工具调用都经 Baseline / OKR / Data / Action 检查
 *
 * 用法 (V1):
 *   registerMcpServer({ name: 'linear', endpoint: 'http://...', tools: [...] });
 *   const result = await invokeMcp('linear.list_issues', { team: 'eng' });
 */

import { logger } from '@/lib/infra/logger';
import type { ToolSchema } from '@/lib/taf/provider/types';

export type McpTransport = 'stdio' | 'sse' | 'websocket' | 'http';

export interface McpServerConfig {
  /** 唯一 server 名 (如 'linear', 'github', 'feishu') */
  name: string;
  description: string;
  /** 通信方式 */
  transport: McpTransport;
  /** stdio 时是命令 + 参数; sse/ws/http 时是 URL */
  endpoint: string;
  /** 启动参数 (stdio 用) */
  args?: string[];
  /** 鉴权头 (sse/ws/http 用) */
  authHeader?: string;
  /** 该 server 暴露的工具 schema (启动时连接 MCP 拉取; V1 手动配) */
  tools: ToolSchema[];
  /** 4 道闸应用范围 */
  gateway?: {
    requireBaselineGuard: boolean;
    requireOkrDriftCheck: boolean;
    /** 数据访问范围 (例: 'okr.read,memory.read') */
    dataScope: string[];
    /** 行为白名单 */
    actionScope: string[];
  };
  /** 是否启用 (admin 后台可关停) */
  enabled: boolean;
  /**
   * 模式 (V2):
   *   - 'stub' (默认, 向后兼容): invoke 永远返回 not-implemented, 不连真实 server
   *   - 'live'                 : invoke 走 @modelcontextprotocol/sdk 真连
   * 注: 单测/CI 应保留 'stub'; 生产环境配置 'live'.
   */
  mode?: 'stub' | 'live';
  /** 注册时间 */
  registeredAt: string;
}

/** Skill Gateway 4 道闸的判决 (V2 真正接入时由 ProcessGateway 写入) */
export interface McpGatewayChecks {
  baseline: 'pass' | 'soft_warn' | 'hard_block' | 'skipped';
  okrDrift: 'aligned' | 'drift' | 'no_okr' | 'skipped';
  dataScope: 'pass' | 'denied' | 'skipped';
  actionScope: 'pass' | 'denied' | 'skipped';
}

export interface McpInvokeResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** server 来源 */
  serverName?: string;
  /** 是否经过 Skill Gateway 4 道闸 (V2) */
  gatewayChecks?: McpGatewayChecks;
}

// ---------------------------------------------------------------------------
// In-memory registry (V2: 持久化到 KvStore + admin UI)
// ---------------------------------------------------------------------------

const _g = globalThis as typeof globalThis & {
  __tandem_mcp_servers__?: Map<string, McpServerConfig>;
};
if (!_g.__tandem_mcp_servers__) {
  _g.__tandem_mcp_servers__ = new Map();
}
const servers = _g.__tandem_mcp_servers__;

/**
 * 注册一个 MCP server (V1: 仅入内存, 进程重启丢失)
 * V2: admin 后台 CRUD + 持久化
 */
export function registerMcpServer(config: Omit<McpServerConfig, 'registeredAt'>): McpServerConfig {
  const full: McpServerConfig = {
    ...config,
    registeredAt: new Date().toISOString(),
  };
  servers.set(config.name, full);
  logger.info(
    { name: config.name, transport: config.transport, toolCount: config.tools.length },
    '[mcp-bridge] server registered (V1 stub)',
  );
  return full;
}

export function unregisterMcpServer(name: string): boolean {
  return servers.delete(name);
}

export function listMcpServers(): McpServerConfig[] {
  return Array.from(servers.values());
}

export function getMcpServer(name: string): McpServerConfig | undefined {
  return servers.get(name);
}

/**
 * 调用 MCP 工具.
 *
 * 工具 ID 格式: `${serverName}.${toolName}` (例: 'linear.list_issues')
 *
 * V1 行为: 永远返回 not-implemented (因为没接 SDK).
 * V2 行为: 按 transport 走 stdio/sse/ws, 经 4 道闸过滤, 调用结果回填.
 */
export async function invokeMcp(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { actorUserId: string; tenantId?: string; isProxy?: boolean } = { actorUserId: 'unknown' },
): Promise<McpInvokeResult> {
  const dotIdx = toolId.indexOf('.');
  if (dotIdx <= 0) {
    return { ok: false, error: `invalid MCP tool id "${toolId}", expected "<server>.<tool>"` };
  }
  const serverName = toolId.slice(0, dotIdx);
  const toolName = toolId.slice(dotIdx + 1);

  const server = servers.get(serverName);
  if (!server) {
    return {
      ok: false,
      error: `MCP server "${serverName}" not registered. Use registerMcpServer() first.`,
    };
  }
  if (!server.enabled) {
    return {
      ok: false,
      error: `MCP server "${serverName}" is disabled by admin`,
      serverName,
    };
  }

  // V2 Skill Gateway · 4 道闸 (Baseline / OKR Drift / Data / Action)
  const gatewayChecks: McpGatewayChecks = {
    baseline: 'skipped',
    okrDrift: 'skipped',
    dataScope: 'skipped',
    actionScope: 'skipped',
  };

  if (server.gateway) {
    // 闸 1: Baseline-Guard (跟 lib/memory/baseline-guard 同样的语义)
    if (server.gateway.requireBaselineGuard) {
      try {
        const { checkBaseline } = await import('@/lib/memory/baseline-guard');
        const verdict = await checkBaseline({
          intent: `MCP工具调用 ${toolId} 参数 ${JSON.stringify(args).slice(0, 200)}`,
          actorUserId: ctx.actorUserId,
          agentKind: ctx.isProxy ? 'autonomous' : 'skill',
          toolName: toolId,
        });
        if (verdict.verdict === 'HARD_BLOCK') {
          gatewayChecks.baseline = 'hard_block';
          return {
            ok: false,
            error: `[Skill Gateway] Baseline HARD_BLOCK: ${verdict.reasons.join('; ')}`,
            serverName,
            gatewayChecks,
          };
        }
        gatewayChecks.baseline = verdict.verdict === 'SOFT_WARN' ? 'soft_warn' : 'pass';
      } catch (err) {
        logger.warn({ err: (err as Error).message }, '[mcp-bridge] baseline gate failed (fail-open)');
      }
    }
    // 闸 2: OKR Drift (best-effort, 不阻断)
    if (server.gateway.requireOkrDriftCheck) {
      try {
        const { checkOkrDrift } = await import('@/lib/governance/okr-drift');
        const drift = await checkOkrDrift({
          intent: `MCP工具 ${toolId} ${JSON.stringify(args).slice(0, 200)}`,
          actorUserId: ctx.actorUserId,
          source: 'proxy_action',
          refId: toolId,
        });
        gatewayChecks.okrDrift =
          drift.verdict === 'ALIGNED' ? 'aligned'
          : drift.verdict === 'DRIFT_SUSPECTED' ? 'drift'
          : 'no_okr';
      } catch (err) {
        logger.warn({ err: (err as Error).message }, '[mcp-bridge] okr-drift gate failed (fail-open)');
      }
    }
    // 闸 3: 数据访问范围 (precondition white-list on tool name prefix)
    if (server.gateway.dataScope.length > 0) {
      const allowed = server.gateway.dataScope.some((scope) => toolName.startsWith(scope));
      gatewayChecks.dataScope = allowed ? 'pass' : 'denied';
      if (!allowed) {
        return {
          ok: false,
          error: `[Skill Gateway] dataScope 拒绝: 工具 "${toolName}" 不在白名单 ${server.gateway.dataScope.join(',')}`,
          serverName,
          gatewayChecks,
        };
      }
    }
    // 闸 4: 行为白名单
    if (server.gateway.actionScope.length > 0) {
      const allowed = server.gateway.actionScope.some((scope) => toolName.startsWith(scope));
      gatewayChecks.actionScope = allowed ? 'pass' : 'denied';
      if (!allowed) {
        return {
          ok: false,
          error: `[Skill Gateway] actionScope 拒绝: 工具 "${toolName}" 不在白名单 ${server.gateway.actionScope.join(',')}`,
          serverName,
          gatewayChecks,
        };
      }
    }
  }

  // V2 实连分支
  if ((server.mode ?? 'stub') === 'live') {
    try {
      const { liveCallMcpTool } = await import('./mcp-client');
      const res = await liveCallMcpTool(server, toolName, args);
      logger.info(
        { tool: toolId, transport: server.transport, ok: res.ok, actor: ctx.actorUserId },
        '[mcp-bridge] invoke live',
      );
      return res.ok
        ? { ok: true, data: res.data, serverName, gatewayChecks }
        : { ok: false, error: res.error, serverName, gatewayChecks };
    } catch (err) {
      return {
        ok: false,
        error: `[mcp-bridge] live invoke 内部异常: ${(err as Error).message}`,
        serverName,
        gatewayChecks,
      };
    }
  }

  // V1 stub: 向后兼容 (单测 / 未配 mode 的存量 server)
  logger.info(
    {
      tool: toolId,
      transport: server.transport,
      actor: ctx.actorUserId,
      args: Object.keys(args),
    },
    '[mcp-bridge] invoke called (V1 stub, returns not-implemented)',
  );

  return {
    ok: false,
    error:
      `MCP invoke 是 V1 stub, 尚未连接到 server "${serverName}" (${server.transport}://${server.endpoint}). ` +
      `工具 "${toolName}" 的 schema 已注册, 设置 mode='live' 启用 @modelcontextprotocol/sdk 真连.`,
    serverName,
    gatewayChecks,
  };
}

/**
 * 把所有已注册 MCP server 的 tools 拉成一个 ToolSchema[] 数组,
 * 用于 runToolLoop 的 toolset 参数.
 *
 * 工具名前缀加 server name, 避免冲突 (实际 LLM 看到的是 "linear_list_issues" 这种).
 */
export function getAllMcpTools(): ToolSchema[] {
  const out: ToolSchema[] = [];
  const allServers = Array.from(servers.values());
  for (const server of allServers) {
    if (!server.enabled) continue;
    for (const tool of server.tools) {
      out.push({
        type: 'function',
        function: {
          ...tool.function,
          // 防命名冲突: 加 server prefix (替换原来的 name 中的 .)
          name: `${server.name}__${tool.function.name.replace(/\./g, '_')}`,
          description: `[${server.name}] ${tool.function.description ?? ''}`,
        },
      });
    }
  }
  return out;
}
