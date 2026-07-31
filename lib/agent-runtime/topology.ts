/**
 * lib/agent-runtime/topology.ts · 编排拓扑门控 (AdaptOrch 推理时落地 · Phase 4 深化)
 * ─────────────────────────────────────────────────────────
 * AdaptOrch 的核心洞见是"拓扑 > 模型": 与其对所有任务用同一套固定的编排深度,
 * 不如**按任务复杂度自适应选择编排拓扑** (要不要用工具、跑几轮、给多少 token)。
 * 我们不训练模型, 只把这条洞见翻译成推理时的一个**确定性门控函数**:
 *
 *   selectTopology(query) → { topology, maxRounds, maxTokens, rationale }
 *
 * 四档拓扑 (轮次/预算单调递增):
 *   - direct     : 无需查数据 (空/寒暄) — 1 轮兜底
 *   - single_pass: 单点查询 (查一个实体/一个维度) — 2 轮
 *   - multi_step : 单维度但要推理 (一路演进 / 单实体多跳) — 3 轮
 *   - deep       : 跨维度融合 / 对比 / 归因 / 多问 — 5 轮 (满配)
 *
 * 用法契约 (零行为变更):
 *   - 纯函数, 无 IO, 确定性, 永不抛。
 *   - runToolLoop 仅在 adaptiveTopology=true 时启用; 且调用方显式传入的 maxRounds/maxTokens
 *     作为**上限** (ceiling), 拓扑只能对简单问题**收紧**, 不会超过调用方允许的预算。
 *     → 复杂融合问题保持满配 (不欠算), 简单问题省 token (纯收益)。
 */

export type OrchestrationTopology = 'direct' | 'single_pass' | 'multi_step' | 'deep';

export interface TopologyPlan {
  topology: OrchestrationTopology;
  maxRounds: number;
  maxTokens: number;
  rationale: string;
}

export interface SelectTopologyOptions {
  /** 可用工具数量 (0 → 无工具可调, 倾向 direct)。 */
  toolsetSize?: number;
}

/** 各档默认预算 (轮次/token 单调递增)。 */
const TOPOLOGY_BUDGET: Record<OrchestrationTopology, { maxRounds: number; maxTokens: number }> = {
  direct: { maxRounds: 1, maxTokens: 400 },
  single_pass: { maxRounds: 2, maxTokens: 700 },
  multi_step: { maxRounds: 3, maxTokens: 900 },
  deep: { maxRounds: 5, maxTokens: 1200 },
};

/** 经营数据域 (命中的**不同**域越多 → 越像跨维度融合)。 */
const DOMAIN_PATTERNS: Array<{ domain: string; re: RegExp }> = [
  { domain: 'okr', re: /OKR|目标|关键结果|\bKR\b|完成率|进度|对齐/i },
  { domain: 'kpi', re: /KPI|绩效|指标|达成率/i },
  { domain: 'talent', re: /人才|9\s*宫格|九宫格|nine[ -]?box|梯队|盘点|继任/i },
  { domain: 'bonus', re: /奖金|bonus|激励|薪酬|分配/i },
  { domain: 'sales', re: /销售|商机|管道|赢单|丢单|经销商|报备|回款|招标/i },
  { domain: 'governance', re: /决议|议事|裁定|审批|治理/i },
  { domain: 'memory', re: /记忆|知识|沉淀|案例|复盘|SOP|红线/i },
];

/** 融合/推理型话术 (对比、归因、演进、关系)。 */
const FUSION_RE =
  /对比|相比|交叉|综合|全面|整体|分别|多个|之间|关系|为什么|原因|归因|影响|趋势|演进|来龙去脉|一路|从.+到|结合|联动/;

/** 多问信号: 问号 + 连接词。 */
const MULTIPART_RE = /[?？]/g;
const CONJUNCTION_RE = /以及|还有|并且|同时|、|另外|此外/g;

/** 实体编号 (KR-3 / OBJ-1 / KPI-x …)。 */
const ENTITY_RE = /(?:kr|okr|obj|conv|persona|kpi)[-_][a-z0-9]/gi;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * 按查询复杂度确定性地选择编排拓扑。纯函数, 永不抛。
 */
export function selectTopology(query: string, opts: SelectTopologyOptions = {}): TopologyPlan {
  const q = (query ?? '').trim();
  const toolsetSize = opts.toolsetSize ?? Infinity;

  // 无工具可调 / 空查询 → direct
  if (q.length === 0 || toolsetSize <= 0) {
    return plan('direct', q.length === 0 ? '空查询' : '无可用工具');
  }

  const domainHits = DOMAIN_PATTERNS.filter((d) => d.re.test(q)).length;
  const fusion = FUSION_RE.test(q);
  const questionMarks = countMatches(q, MULTIPART_RE);
  const conjunctions = countMatches(q, CONJUNCTION_RE);
  const multiPart = questionMarks + conjunctions;
  const entityCount = countMatches(q, ENTITY_RE);

  // deep: 跨维度 (≥2 域) / 融合话术 / 多问 (≥2) / 多实体 (≥2)
  if (domainHits >= 2 || fusion || multiPart >= 2 || entityCount >= 2) {
    const why: string[] = [];
    if (domainHits >= 2) why.push(`跨${domainHits}维度`);
    if (fusion) why.push('融合/归因话术');
    if (multiPart >= 2) why.push(`多问(${multiPart})`);
    if (entityCount >= 2) why.push(`多实体(${entityCount})`);
    return plan('deep', why.join(' · '));
  }

  // multi_step: 单维度但要推理 (命中一个域且问题较长, 或单实体多跳)
  if (domainHits === 1 && (q.length >= 40 || entityCount === 1)) {
    return plan('multi_step', `单维度需推理 (len=${q.length}${entityCount ? ', 单实体' : ''})`);
  }

  // single_pass: 单点查询
  if (domainHits >= 1 || entityCount >= 1) {
    return plan('single_pass', '单点查询');
  }

  // 命中不到任何数据域 → 仍给 single_pass (让 gate 上层已判过是否要感知)
  return plan('single_pass', '无明确数据域, 保守单轮查询');
}

function plan(topology: OrchestrationTopology, rationale: string): TopologyPlan {
  const b = TOPOLOGY_BUDGET[topology];
  return { topology, maxRounds: b.maxRounds, maxTokens: b.maxTokens, rationale };
}

/**
 * 把拓扑建议与调用方显式上限合并: 显式值是**上限**, 拓扑只能收紧 (取 min)。
 * ceiling 为 undefined 时直接采用拓扑建议。返回不小于 1。
 */
export function applyTopologyCeiling(recommended: number, ceiling?: number): number {
  const capped = ceiling === undefined ? recommended : Math.min(ceiling, recommended);
  return Math.max(1, capped);
}
