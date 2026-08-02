/**
 * lib/agent-runtime/tool-dag.ts · P3 #21 IPIGUARD 工具依赖图 (DAG) 防御
 *
 * 前沿 (IPIGUARD, EMNLP 2025): 把任务执行建模为 Tool Dependency Graph (DAG) 遍历,
 * 严格按拓扑序执行, 禁止访问未预批准的工具; 支持只读操作动态扩展 (Node Expansion)。
 *
 * TandemAI 现状: PlanGuard 生成的是**扁平**参考行动列表, 无依赖关系 —
 * 无法约束 "必须先查再写" 这类前置依赖。本模块把参考集升级为 DAG:
 *   - 节点 = 工具; 边 = 依赖 (dependsOn)。
 *   - 执行时校验: 一个工具的所有前置是否已执行 (validateDagStep)。
 *
 * 纪律: 纯确定性核心 (validate* 无 IO, 可单测); DAG 生成 1 次 LLM 调用 fail-soft;
 *       只读工具允许动态扩展 (不在 DAG 里也放行, 仅记录), 写工具严格按 DAG。
 */

export interface DagNode {
  /** 工具名 (skill id 或 mcp id) */
  tool: string;
  /** 前置依赖工具名 (须在本节点前完成) */
  dependsOn: string[];
  /** 是否只读 (只读节点允许动态扩展) */
  readOnly?: boolean;
}

export interface ToolDag {
  nodes: DagNode[];
}

export interface DagStepVerdict {
  allowed: boolean;
  reason: string;
  /** 命中的节点 (若在 DAG 内) */
  node?: DagNode;
  /** 未满足的前置 */
  missingDeps?: string[];
}

/** 名字宽松匹配 (含子串, 兼容 sanitize/点号差异: 点/下划线/连字符统一归一)。 */
function nameMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[._-]+/g, '_');
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * 校验一个工具调用是否符合 DAG 依赖顺序。纯函数, 永不抛。
 * @param dag 参考 DAG
 * @param tool 当前要调用的工具
 * @param executed 已成功执行的工具名集合
 * @param opts.allowReadOnlyExpansion 只读工具即使不在 DAG 内也放行 (Node Expansion, 默认 true)
 */
export function validateDagStep(
  dag: ToolDag,
  tool: string,
  executed: string[],
  opts: { allowReadOnlyExpansion?: boolean } = {},
): DagStepVerdict {
  const allowExpansion = opts.allowReadOnlyExpansion ?? true;
  const node = dag.nodes.find((n) => nameMatches(n.tool, tool));

  if (!node) {
    // 不在 DAG 内: 只读扩展放行 (仅记录), 否则拒绝 (未预批准工具)
    if (allowExpansion) {
      return { allowed: true, reason: 'node expansion (tool not in DAG, allowed as read-only exploration)' };
    }
    return { allowed: false, reason: `tool "${tool}" not in approved DAG` };
  }

  const missing = node.dependsOn.filter(
    (dep) => !executed.some((e) => nameMatches(e, dep)),
  );
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `prerequisite(s) not yet executed: ${missing.join(', ')}`,
      node,
      missingDeps: missing,
    };
  }
  return { allowed: true, reason: 'dependencies satisfied', node };
}

/** 检测 DAG 是否有环 (拓扑排序失败即有环)。纯函数。 */
export function hasCycle(dag: ToolDag): boolean {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of dag.nodes) {
    indeg.set(n.tool, indeg.get(n.tool) ?? 0);
    for (const dep of n.dependsOn) {
      adj.set(dep, [...(adj.get(dep) ?? []), n.tool]);
      indeg.set(n.tool, (indeg.get(n.tool) ?? 0) + 1);
      if (!indeg.has(dep)) indeg.set(dep, 0);
    }
  }
  const queue = Array.from(indeg.entries()).filter(([, d]) => d === 0).map(([t]) => t);
  let visited = 0;
  while (queue.length > 0) {
    const t = queue.shift()!;
    visited++;
    for (const next of adj.get(t) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  return visited < indeg.size;
}

/**
 * 让 LLM 生成工具 DAG (含依赖)。fail-soft: 失败/有环 → 返回空 DAG (调用方跳过 DAG 校验)。
 */
export async function generateToolDag(
  userQuery: string,
  toolNames: string[],
  feature?: string,
): Promise<ToolDag> {
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const system =
      'You are a tool-planning assistant. Given a user question and available tools, output a tool dependency graph (DAG). ' +
      'For each tool you expect to use, list its prerequisite tools (which must run first) and whether it is read-only. ' +
      'Output ONLY JSON: {"nodes":[{"tool":"name","dependsOn":["prereq"],"readOnly":true}]}';
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Question: ${userQuery}\n\nAvailable tools: ${toolNames.join(', ')}\n\nDAG:` },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 400,
      metadata: { userId: '__tooldag__', feature: feature ? `${feature}.tooldag` : 'tool_dag' },
    });
    const content = typeof reply.message.content === 'string' ? reply.message.content : '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return { nodes: [] };
    const parsed = JSON.parse(m[0]) as { nodes?: unknown };
    if (!Array.isArray(parsed.nodes)) return { nodes: [] };
    const nodes: DagNode[] = parsed.nodes
      .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
      .map((n) => ({
        tool: String((n as { tool?: unknown }).tool ?? ''),
        dependsOn: Array.isArray((n as { dependsOn?: unknown }).dependsOn)
          ? ((n as { dependsOn: unknown[] }).dependsOn.filter((d): d is string => typeof d === 'string'))
          : [],
        readOnly: (n as { readOnly?: unknown }).readOnly === true,
      }))
      .filter((n) => n.tool.length > 0)
      .slice(0, 15);
    const dag = { nodes };
    if (hasCycle(dag)) return { nodes: [] }; // 有环视为无效, 回退
    return dag;
  } catch {
    return { nodes: [] };
  }
}
