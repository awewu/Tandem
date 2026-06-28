/**
 * MCP Server Service (B-002)
 *
 * admin 在管理页配置的外部 MCP server 连接信息存 DB (KvStore 'mcp_servers').
 * 启动 + 每次保存后, syncMcpServersToRegistry() 把 DB 记录同步进 mcp-bridge 的
 * 内存注册表 (registerMcpServer), 这样 runToolLoop(includeMcpTools) 才能下发它们.
 *
 * live server 在同步时尝试 listTools 自动发现工具; 失败 (server 不可达) 则工具为空,
 * 不阻断同步 (best-effort, 与 ai-settings 同样的"失败回退"纪律).
 */

import { getStore } from '../storage/repository';
import {
  registerMcpServer,
  unregisterMcpServer,
  listMcpServers as listRegistryServers,
  type McpServerConfig,
} from '../agent-runtime/mcp-bridge';
import { logger } from '../infra/logger';
import type { McpServerRecord, McpServerPatch } from '../types/mcp-server';

const DEFAULT_TENANT = 'default';

function splitScope(s: string | undefined): string[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 列出某租户的所有 MCP server 记录 */
export async function listMcpServerRecords(tenantId = DEFAULT_TENANT): Promise<McpServerRecord[]> {
  try {
    const all = await getStore().mcpServers.list();
    return all.filter((r) => r.tenantId === tenantId);
  } catch {
    return [];
  }
}

/** 按 name upsert (name 是租户内唯一键) */
export async function upsertMcpServerRecord(
  patch: McpServerPatch & { name: string },
  updatedBy: string,
  tenantId = DEFAULT_TENANT,
): Promise<McpServerRecord> {
  const store = getStore();
  const all = await store.mcpServers.list();
  const existing = all.find((r) => r.tenantId === tenantId && r.name === patch.name);
  const now = new Date().toISOString();

  if (existing) {
    return store.mcpServers.update(existing.id, {
      ...patch,
      updatedBy,
      updatedAt: now,
    } as never) as Promise<McpServerRecord>;
  }

  return store.mcpServers.create({
    id: `mcpsrv_${tenantId}_${patch.name}`,
    tenantId,
    name: patch.name,
    description: patch.description ?? '',
    transport: patch.transport ?? 'http',
    endpoint: patch.endpoint ?? '',
    args: patch.args,
    authHeader: patch.authHeader,
    mode: patch.mode ?? 'stub',
    enabled: patch.enabled ?? false,
    requireBaselineGuard: patch.requireBaselineGuard ?? true,
    requireOkrDriftCheck: patch.requireOkrDriftCheck ?? false,
    dataScope: patch.dataScope ?? '',
    actionScope: patch.actionScope ?? '',
    updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}

/** 删除一条记录 (并从内存注册表注销) */
export async function deleteMcpServerRecord(
  name: string,
  tenantId = DEFAULT_TENANT,
): Promise<boolean> {
  const store = getStore();
  const all = await store.mcpServers.list();
  const existing = all.find((r) => r.tenantId === tenantId && r.name === name);
  if (!existing) return false;
  await store.mcpServers.delete(existing.id);
  unregisterMcpServer(name);
  return true;
}

/** 把一条 DB 记录翻译成 mcp-bridge 的注册配置 (含工具发现) */
async function toRegistryConfig(rec: McpServerRecord): Promise<Omit<McpServerConfig, 'registeredAt'>> {
  const base: Omit<McpServerConfig, 'registeredAt' | 'tools'> = {
    name: rec.name,
    description: rec.description,
    transport: rec.transport,
    endpoint: rec.endpoint,
    args: rec.args,
    authHeader: rec.authHeader,
    mode: rec.mode,
    enabled: rec.enabled,
    gateway: {
      requireBaselineGuard: rec.requireBaselineGuard,
      requireOkrDriftCheck: rec.requireOkrDriftCheck,
      dataScope: splitScope(rec.dataScope),
      actionScope: splitScope(rec.actionScope),
    },
  };

  // live + enabled → 尝试发现工具 (失败回退空, 不阻断)
  let tools: McpServerConfig['tools'] = [];
  if (rec.enabled && rec.mode === 'live') {
    try {
      const { liveListMcpTools } = await import('../agent-runtime/mcp-client');
      const discovered = await liveListMcpTools({ ...base, tools: [], registeredAt: '' });
      tools = discovered.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    } catch (err) {
      logger.warn({ server: rec.name, err: (err as Error).message }, '[mcp-servers] 工具发现失败');
    }
  }

  return { ...base, tools };
}

/**
 * 把 DB 中所有 MCP server 记录同步进内存注册表.
 * 启动 (boot) + admin 保存后调用. 幂等: 先注销不在 DB 的, 再 register 全量.
 * 永不抛错 (失败回退, 与 ai-settings 同纪律).
 */
export async function syncMcpServersToRegistry(tenantId = DEFAULT_TENANT): Promise<void> {
  try {
    const records = await listMcpServerRecords(tenantId);
    const dbNames = new Set(records.map((r) => r.name));

    // 注销已从 DB 删除的 (内存里还在的)
    for (const reg of listRegistryServers()) {
      if (!dbNames.has(reg.name)) unregisterMcpServer(reg.name);
    }

    // 全量 register (覆盖)
    for (const rec of records) {
      const cfg = await toRegistryConfig(rec);
      registerMcpServer(cfg);
    }

    logger.info(
      { count: records.length, enabled: records.filter((r) => r.enabled).length },
      '[mcp-servers] synced to registry',
    );
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[mcp-servers] sync failed');
  }
}
