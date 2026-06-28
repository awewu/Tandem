/**
 * MCP Server 持久化记录 (B-002)
 *
 * admin 在管理页配置的外部 MCP server 连接信息, 存 DB (KvStore 'mcp_servers' 分区).
 * 启动 + 保存后由 lib/settings/mcp-servers.ts 同步进 mcp-bridge 的内存注册表.
 *
 * 注: tools (该 server 暴露的工具 schema) 不在此手填 —— live server 在连接时
 *     自动 listTools 发现; 此记录只存"连接 + 治理"配置.
 */

import type { McpTransport } from '@/lib/agent-runtime/mcp-bridge';

export interface McpServerRecord {
  /** 主键 (= `mcpsrv_${tenantId}_${name}`) */
  id: string;
  tenantId: string;
  /** 唯一 server 名 (注册表 key, 工具前缀) */
  name: string;
  description: string;
  transport: McpTransport;
  /** stdio 时是命令; http/sse/ws 时是 URL */
  endpoint: string;
  /** stdio 启动参数 */
  args?: string[];
  /** 鉴权头 (http/sse/ws) */
  authHeader?: string;
  /** 'stub' = 不实连 (默认, 安全); 'live' = 经 @modelcontextprotocol/sdk 真连 */
  mode: 'stub' | 'live';
  enabled: boolean;
  /** Skill Gateway 4 道闸配置 */
  requireBaselineGuard: boolean;
  requireOkrDriftCheck: boolean;
  /** 逗号分隔的数据访问范围前缀 (空 = 不限制) */
  dataScope: string;
  /** 逗号分隔的行为白名单前缀 (空 = 不限制) */
  actionScope: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type McpServerPatch = Partial<Omit<McpServerRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
