/**
 * MCP Server · 只读技能暴露 (纯函数, 可单测)
 *
 * ─────────────────────────────────────────────────────────
 * 目标 (互操作性缺口收口, 2026-08):
 *   Tandem 原本只做 MCP 消费方 (mcp-client / mcp-bridge)。这里把 skillRegistry 里
 *   "只读绿区" 技能反向暴露成 MCP Server 工具, 让飞书 aily / Claude / 其它 agent
 *   能把 Tandem 当作一个 MCP 工具源来编排调用。
 *
 * 安全边界 (为什么只暴露 green + proxyAllowed):
 *   - zone==='green'      : 纯感知/只读, 不写业务真值。
 *   - proxyAllowed===true : 允许 AI 代行 (外部 agent 调用 = 代行, isProxy=true)。
 *   红/黄区写动作永不经此暴露; 且 dispatch 侧 execute(isProxy=true) 再兜一层
 *   (registry 守门会拦掉任何 red-zone / proxy 不允许的技能)。
 *
 * 命名映射 (可逆):
 *   skill id 形如 'okr.health_digest' (含 '.')。部分 MCP 客户端工具名只允许
 *   [a-zA-Z0-9_-]。技能 id 只用 '.' 作分隔 + '_' 作词内连接, 从不含 '-',
 *   故用 '.' ↔ '-' 双向映射 (无损可逆)。见 mcp-server.test.ts 的不变量断言。
 */

import { skillRegistry, type Skill } from '@/lib/taf/skills/registry';

/** 判定一个技能是否可安全暴露给外部 agent (只读绿区 + 允许代行)。 */
export function isReadOnlySkill(s: Skill): boolean {
  return s.zone === 'green' && s.proxyAllowed === true;
}

/** skill id → MCP 工具名 (可逆: '.' → '-')。 */
export function toMcpToolName(id: string): string {
  return id.replace(/\./g, '-');
}

/** MCP 工具名 → skill id (可逆: '-' → '.')。 */
export function fromMcpToolName(name: string): string {
  return name.replace(/-/g, '.');
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** 列出当前 registry 中所有可暴露的只读技能, 转成 MCP tool 定义。 */
export function listReadOnlyMcpTools(): McpToolDef[] {
  return skillRegistry
    .list()
    .filter(isReadOnlySkill)
    .map((s) => ({
      name: toMcpToolName(s.id),
      description: s.description,
      inputSchema:
        (s.schema?.function?.parameters as Record<string, unknown> | undefined) ?? {
          type: 'object',
          properties: {},
        },
    }));
}

/**
 * 把 MCP 工具名解析回真实 skill id, 并强校验它确实是"可暴露的只读技能"。
 * 解析不到 / 非只读 → 返回 null (dispatch 侧据此拒绝, 防越权调用未暴露技能)。
 */
export function resolveReadOnlySkillId(toolName: string): string | null {
  // 先按原名直查 (工具名可能本就无 '.')
  const direct = skillRegistry.get(toolName);
  if (direct && isReadOnlySkill(direct)) return direct.id;
  // 再按 '-' → '.' 还原查
  const restored = fromMcpToolName(toolName);
  const s = skillRegistry.get(restored);
  return s && isReadOnlySkill(s) ? s.id : null;
}
