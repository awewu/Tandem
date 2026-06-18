/**
 * Built-in Skills · Tandem 默认工具集
 *
 * 这些工具在 boot 时自动注册.
 * 业务模块可继续扩展 (如 lib/integrations/* 注册自己的 skill).
 */

import type { Skill } from './registry';
import { skillRegistry } from './registry';
import {
  OkrCheckinProposeSkill,
  OkrObjectiveCheckinProposeSkill,
  PersonaProposeActionSkill,
  PersonaDraftReportSkill,
  PersonaDraftActionItemsSkill,
} from './persona-write';
import { getStore } from '../../storage/repository';
import { CompositeRetriever } from '../../memory/retriever';
import {
  computeKRProgress,
  effectiveObjectiveProgress,
  classifyNineBox,
  type NineBoxCell,
} from '../../types/okr-tti';
import { computeKpiCompletion, KPI_LEVEL_LABEL, type KpiLevel } from '../../types/kpi';
import { computeCrossRollup, misalignKindLabel } from '../../domain/analytics/cross-rollup';

// ---------------------------------------------------------------------------
// memory.search · 知识检索 (绿区, 代行允许)
// ---------------------------------------------------------------------------

export const MemorySearchSkill: Skill<{ query: string; limit?: number }, unknown[]> = {
  id: 'memory.search',
  description: '检索 Memory 层 (SOP / case / value / redline) 和 Materials 中相关的知识',
  tags: ['memory', '知识', '检索', 'rag', 'sop', '案例'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 500,
  schema: {
    type: 'function',
    function: {
      name: 'memory_search',
      description: '搜索公司知识库 (SOP / 案例 / 红线 / 价值观)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或自然语言问题' },
          limit: { type: 'number', description: '返回结果数, 默认 5' },
        },
        required: ['query'],
      },
    },
  },
  async execute({ query, limit = 5 }) {
    const retriever = new CompositeRetriever();
    const results = await retriever.search(query, limit);
    return { ok: true, data: results, tokensUsed: 200 + results.length * 50 };
  },
};

// ---------------------------------------------------------------------------
// decision_card.list · 列出最近决议 (绿区)
// ---------------------------------------------------------------------------

export const DecisionCardListSkill: Skill<
  { limit?: number; ownerId?: string; state?: string },
  unknown[]
> = {
  id: 'decision_card.list',
  description: '列出最近的议事决议 (DecisionCard)',
  tags: ['decision', '决议', '议事', 'card'],
  zone: 'green',
  proxyAllowed: true,
  // 按 ownerId 查他人决议需特权 (§19.3, registry 强制)
  dataScope: { level: 'personal', targetUserArg: 'ownerId' },
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'decision_card_list',
      description: '列出最近 N 个议事决议',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          ownerId: { type: 'string' },
          state: { type: 'string', enum: ['DIVERGE', 'CONVERGE', 'COMMIT', 'ESCALATED', 'VETOED'] },
        },
      },
    },
  },
  async execute({ limit = 10, ownerId, state }) {
    const store = getStore();
    let cards = await store.decisionCards.list();
    if (ownerId) cards = cards.filter((c) => c.createdBy === ownerId);
    if (state) cards = cards.filter((c) => c.convergenceState === state);
    cards = cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
    return { ok: true, data: cards, tokensUsed: 100 };
  },
};

// ---------------------------------------------------------------------------
// okr.read · 读取 OKR (绿区)
// ---------------------------------------------------------------------------

export const OkrReadSkill: Skill<{ ownerId?: string; cycleId?: string }, unknown> = {
  id: 'okr.read',
  description: '读取员工 OKR (Objectives + KRs)',
  tags: ['okr', '目标', 'kr'],
  zone: 'green',
  proxyAllowed: true,
  // 按 ownerId 查他人 OKR 需特权 (§19.3, registry 强制)
  dataScope: { level: 'personal', targetUserArg: 'ownerId' },
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'okr_read',
      description: '查询某员工或某周期的 OKR',
      parameters: {
        type: 'object',
        properties: {
          ownerId: { type: 'string' },
          cycleId: { type: 'string' },
        },
      },
    },
  },
  async execute({ ownerId, cycleId }) {
    const store = getStore();
    let objs = await store.objectives.list();
    if (ownerId) objs = objs.filter((o) => o.ownerId === ownerId);
    if (cycleId) objs = objs.filter((o) => o.cycleId === cycleId);
    const allKrs = await store.keyResults.list();
    const enriched = objs.map((o) => ({ ...o, keyResults: allKrs.filter((k) => k.objectiveId === o.id) }));
    return { ok: true, data: enriched };
  },
};

// ---------------------------------------------------------------------------
// okr.health_digest · 全公司 OKR 健康度速览 (绿区, 代行允许) — S1 "眼睛"
//
// 中央 AI 的静态 prompt 只注入公司层 Objective; 本工具让它能**按需**查全层级
// (含团队/个人) 的 at-risk 真值, 主动发现"最迟的 KR / 哪个目标快崩了"。
// 进度用 S0 rollup 真值 (effectiveObjectiveProgress / computeKRProgress), 非静态文本。
// ---------------------------------------------------------------------------

export const OkrHealthDigestSkill: Skill<
  { level?: 'company' | 'team' | 'individual'; limit?: number },
  unknown
> = {
  id: 'okr.health_digest',
  description: '全公司 OKR 健康度速览: at-risk Objective/KR 排行 (按真值进度), 用于"哪些目标落后/最迟的KR是什么"',
  tags: ['okr', '目标', 'kr', '健康度', 'at-risk', '预警', '进度'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 400,
  schema: {
    type: 'function',
    function: {
      name: 'okr_health_digest',
      description: '查当前 active 周期的 OKR 健康度: 按真值进度排出最落后 / at-risk 的 Objective 与 KR',
      parameters: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['company', 'team', 'individual'],
            description: '仅看某层级 (缺省=全层级)',
          },
          limit: { type: 'number', description: '最落后项返回数 (默认 10)' },
        },
      },
    },
  },
  async execute({ level, limit = 10 }) {
    const store = getStore();
    const cycles = await store.cycles.list();
    const activeCycles = cycles.filter((c) => c.isActive);
    if (activeCycles.length === 0) {
      return { ok: true, data: { cycle: null, note: '无 active OKR 周期', objectives: [] } };
    }
    const cycle = activeCycles.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];

    let objs = (await store.objectives.list()).filter(
      (o) => o.cycleId === cycle.id && o.status === 'active',
    );
    if (level) objs = objs.filter((o) => o.level === level);

    const allKrs = await store.keyResults.list();
    const rows = objs.map((o) => {
      const krs = allKrs.filter((kr) => kr.objectiveId === o.id && kr.status === 'active');
      const progress = effectiveObjectiveProgress(o);
      const atRiskKrs = krs
        .filter((kr) => kr.confidence !== 'on-track')
        .map((kr) => ({
          title: kr.title,
          progress: Math.round(computeKRProgress(kr) * 100),
          confidence: kr.confidence,
        }))
        .sort((a, b) => a.progress - b.progress);
      return {
        objectiveId: o.id,
        title: o.title,
        level: o.level,
        confidence: o.confidence,
        progressPct: Math.round(progress * 100),
        krCount: krs.length,
        atRiskCount: atRiskKrs.length,
        atRiskKrs,
      };
    });

    // 健康度: at-risk 优先, 再按真值进度升序 (最落后在前)
    const worst = rows
      .sort((a, b) => b.atRiskCount - a.atRiskCount || a.progressPct - b.progressPct)
      .slice(0, limit);

    return {
      ok: true,
      data: {
        cycle: { id: cycle.id, name: cycle.name, endDate: cycle.endDate },
        totalObjectives: rows.length,
        atRiskObjectives: rows.filter((r) => r.atRiskCount > 0 || r.confidence !== 'on-track').length,
        worst,
      },
      tokensUsed: 150 + worst.length * 30,
    };
  },
};

// ---------------------------------------------------------------------------
// persona.get · 读取自己的 Persona (绿区)
// ---------------------------------------------------------------------------

export const PersonaGetSkill: Skill<{ userId: string }, unknown> = {
  id: 'persona.get',
  description: '查询拿捏老板分身当前阶段和成长情况',
  tags: ['persona', '分身', '拿捏老板', '阶段'],
  zone: 'green',
  proxyAllowed: false, // 元能力, 代行禁止 (避免分身自我审视)
  // 查他人 Persona 画像需特权 (§19.3, registry 强制)
  dataScope: { level: 'personal', targetUserArg: 'userId' },
  estimatedTokens: 100,
  schema: {
    type: 'function',
    function: {
      name: 'persona_get',
      description: '获取某员工的拿捏老板分身画像',
      parameters: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: ['userId'],
      },
    },
  },
  async execute({ userId }) {
    const store = getStore();
    const list = await store.personas.list({ userId } as never);
    return { ok: true, data: list[0] ?? null };
  },
};

// ---------------------------------------------------------------------------
// convergence.start · 发起议事室 (黄区, 代行需主管审批 - V2)
// ---------------------------------------------------------------------------

export const ConvergenceStartSkill: Skill<
  { title: string; description?: string; ownerId: string },
  unknown
> = {
  id: 'convergence.start',
  description: '发起新的议事室 (会自动生成 3+1 选项)',
  tags: ['convergence', '议事', '发起', '决议', 'meeting'],
  zone: 'yellow',
  proxyAllowed: false, // 重大议题禁止 AI 代发起 (反 AI 欺诈)
  estimatedTokens: 2000,
  schema: {
    type: 'function',
    function: {
      name: 'convergence_start',
      description: '发起一个新议事 (17 分钟内 3+1 决策)',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '议题标题' },
          description: { type: 'string', description: '议题背景' },
          ownerId: { type: 'string', description: '发起人 ID' },
        },
        required: ['title', 'ownerId'],
      },
    },
  },
  async execute(args) {
    // 通过 internal API (避免循环依赖)
    const res = await fetch('http://localhost:3000/api/convergence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      return { ok: false, error: `convergence start failed: ${res.status}` };
    }
    return { ok: true, data: await res.json(), tokensUsed: 2000 };
  },
};

// ---------------------------------------------------------------------------
// 红区示例 (永不允许 AI 代行)
// ---------------------------------------------------------------------------

export const SalaryAccessSkill: Skill<{ userId: string }, unknown> = {
  id: 'hr.salary_read',
  description: '读取员工薪资信息 (红区, AI 永远禁止)',
  tags: ['hr', 'salary', '薪资'],
  zone: 'red',
  proxyAllowed: false,
  estimatedTokens: 100,
  schema: {
    type: 'function',
    function: {
      name: 'hr_salary_read',
      description: '红区: 仅员工本人 / HR 可读, AI 禁止',
      parameters: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: ['userId'],
      },
    },
  },
  async execute() {
    return { ok: false, error: '红区数据只能员工本人 / HR 后台读取' };
  },
};

// ---------------------------------------------------------------------------
// web.search · 公开网络搜索 (绿区, 代行允许, "Open-Read"段)
//
// 让中央 AI / 分身能调用公开数据让自己不傻 (实时信息 / 行业资讯 / 竞品动态).
// 结果仅活在本次对话上下文, 不进 Memory; Memory 升级仍由人走三级签批 ("Locked-Write").
//
// Provider 优先级:
//   1. Tavily (TAVILY_API_KEY) — 为 AI 优化, 免费 1000 calls/月
//   2. Brave Search (BRAVE_SEARCH_API_KEY) — 免费 2000 calls/月
//   3. 都没配 → 返 not_configured (诚实告知, 不伪造)
// ---------------------------------------------------------------------------

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

async function tavilySearch(query: string, count: number, apiKey: string): Promise<WebSearchResult[]> {
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(count, 10),
      search_depth: 'basic',
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${await res.text().catch(() => '')}`);
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? '(no title)',
    url: r.url ?? '',
    snippet: r.content ?? '',
    publishedAt: r.published_date,
  }));
}

async function braveSearch(query: string, count: number, apiKey: string): Promise<WebSearchResult[]> {
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY not set');
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(count, 10)}`;
  const res = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`brave ${res.status}: ${await res.text().catch(() => '')}`);
  const data = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> } };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title ?? '(no title)',
    url: r.url ?? '',
    snippet: r.description ?? '',
    publishedAt: r.age,
  }));
}

export const WebSearchSkill: Skill<
  { query: string; count?: number },
  { provider: string; results: WebSearchResult[] }
> = {
  id: 'web.search',
  description: '搜索公开互联网获取实时信息 (行业资讯/竞品动态/市场数据). 结果仅作上下文, 不进公司 Memory.',
  tags: ['web', 'search', '搜索', '网络', '实时', '资讯', '市场'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 800,
  schema: {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索公开互联网, 返回标题/URL/摘要列表. 用于需要实时/外部信息的场景.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索查询 (自然语言)' },
          count: { type: 'number', description: '返回结果数 (默认 5, 上限 10)' },
        },
        required: ['query'],
      },
    },
  },
  async execute({ query, count = 5 }) {
    const q = (query ?? '').trim();
    if (!q) return { ok: false, error: 'query 不能为空' };

    // key 解析: getAiSettings 合并 DB (admin 后台填写, 热更新) + env (.env.local).
    //   不再只读 process.env, 否则 admin UI 填的 key 永远不生效。
    let tavilyKey: string | undefined;
    let braveKey: string | undefined;
    try {
      const { getAiSettings } = await import('../../settings/ai-settings');
      const cfg = await getAiSettings();
      tavilyKey = cfg.tavilyApiKey;
      braveKey = cfg.braveSearchApiKey;
    } catch {
      tavilyKey = process.env.TAVILY_API_KEY;
      braveKey = process.env.BRAVE_SEARCH_API_KEY;
    }

    // 按优先级尝试
    const providers: Array<{ name: string; fn: (q: string, c: number) => Promise<WebSearchResult[]> }> = [];
    if (tavilyKey) providers.push({ name: 'tavily', fn: (qq, cc) => tavilySearch(qq, cc, tavilyKey!) });
    if (braveKey) providers.push({ name: 'brave', fn: (qq, cc) => braveSearch(qq, cc, braveKey!) });

    if (providers.length === 0) {
      return {
        ok: false,
        error:
          'not_configured: web_search 需要 TAVILY_API_KEY 或 BRAVE_SEARCH_API_KEY. ' +
          'Tavily: https://tavily.com (免费 1000/月); Brave: https://brave.com/search/api (免费 2000/月). ' +
          '在 admin 后台 AI 设置或 .env.local 配置后即可 (env 需重启服务).',
      };
    }

    const errors: string[] = [];
    for (const p of providers) {
      try {
        const results = await p.fn(q, count);
        return {
          ok: true,
          data: { provider: p.name, results },
          tokensUsed: 200 + results.length * 100,
        };
      } catch (err) {
        errors.push(`${p.name}: ${(err as Error).message}`);
      }
    }
    return { ok: false, error: `所有 web_search provider 失败: ${errors.join('; ')}` };
  },
};

// ---------------------------------------------------------------------------
// okr.business_review · 经营回顾 pre-read (绿区, 代行允许) — 按需 agent 产物
//
// 复用 analyzeOkrHealth (月度反思里同款参谋分析): 扫 active 周期公司/团队层 OKR,
// 产出"承压 KR / 停滞目标 / 长期承压趋势"优化方向提议 —— 但从月度 cron 里解放出来,
// 让中央 AI / BossAI / 经营回顾会前**按需**生成 (对位 WorkBoard 的 Business Review)。
// 纯只读: 不创建 ProxyAction, 不改任何 OKR (宪法 A 边界), 仅供治理/Owner 审视。
// ---------------------------------------------------------------------------

export const OkrBusinessReviewSkill: Skill<{ windowDays?: number }, unknown> = {
  id: 'okr.business_review',
  description:
    '经营回顾 pre-read: 扫公司/团队层 OKR 真值, 产出承压 KR / 停滞目标 / 长期承压趋势的优化方向提议 (参谋建议, 不自动改 OKR). 用于"这个月经营回顾该关注什么/哪些目标要复盘"。',
  tags: ['okr', '经营回顾', 'business review', '复盘', '承压', '参谋', 'pre-read', '月度'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 400,
  schema: {
    type: 'function',
    function: {
      name: 'okr_business_review',
      description:
        '生成经营回顾 pre-read: 当前 active 周期里最需治理关注的承压 KR / 停滞目标 / 长期承压趋势 (按真值)。',
      parameters: {
        type: 'object',
        properties: {
          windowDays: { type: 'number', description: 'check-in 趋势分析窗口 (天), 默认 30' },
        },
      },
    },
  },
  async execute({ windowDays = 30 }) {
    const { analyzeOkrHealth } = await import('../../persona/company-brain-reflection');
    const proposals = await analyzeOkrHealth(8, 5, windowDays, 5);
    const byKind = {
      kr_at_risk: proposals.filter((p) => p.kind === 'kr_at_risk'),
      objective_stalled: proposals.filter((p) => p.kind === 'objective_stalled'),
      kr_stalled_trend: proposals.filter((p) => p.kind === 'kr_stalled_trend'),
    };
    return {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        windowDays,
        totalSignals: proposals.length,
        summary: {
          atRiskKr: byKind.kr_at_risk.length,
          stalledObjectives: byKind.objective_stalled.length,
          stalledTrendKr: byKind.kr_stalled_trend.length,
        },
        proposals,
        note:
          proposals.length === 0
            ? '当前 active 周期公司/团队层 OKR 无显著承压信号 (或无 active 周期/目标)。'
            : '以上为参谋视角承压信号, 须人工治理处置 (资源再分配 / 复盘 / 进议事室), 中央 AI 不自动调整 OKR。',
      },
      tokensUsed: 300 + proposals.length * 40,
    };
  },
};

// ---------------------------------------------------------------------------
// kpi.health_digest · KPI 体系健康度速览 (绿区, 代行允许)
//
// 让中央 AI 把推演从"目标层 (OKR)"下沉到"底线层 (KPI)": 达成分布 + scope/层级
// 权重结构 + cascade 覆盖 + 奖金权重校验 + 最落后 KPI。全部 S0 真值, 非静态文本。
// ---------------------------------------------------------------------------

export const KpiHealthDigestSkill: Skill<{ limit?: number }, unknown> = {
  id: 'kpi.health_digest',
  description:
    'KPI 体系健康度速览: 当前 active 财年周期的达成分布 (绿/黄/红)、bonus/monitor 各层级分布、cascade 孤儿/未拆解、奖金权重≠100 违规、最落后 KPI。用于"KPI 整体怎么样/哪些 KPI 红了/权重配置有没有问题"。',
  tags: ['kpi', '绩效', '健康度', '达成率', '奖金权重', 'cascade', '红灯', 'bonus', 'monitor', '底线'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 450,
  schema: {
    type: 'function',
    function: {
      name: 'kpi_health_digest',
      description:
        '查当前 active KPI 周期健康度: 达成分布 / scope×层级分布 / cascade 覆盖 / 奖金权重校验 / 最落后 KPI',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: '最落后 KPI 返回数, 默认 10' } },
      },
    },
  },
  async execute({ limit = 10 }) {
    const store = getStore();
    const cycles = (await store.kpiCycles.list()).filter((c) => c.status === 'active');
    if (cycles.length === 0) return { ok: true, data: { cycle: null, note: '无 active KPI 周期' } };
    const cycle = cycles.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
    const kpis = (await store.kpis.list()).filter((k) => k.cycleId === cycle.id);
    const withC = kpis.map((k) => ({ k, c: computeKpiCompletion(k) }));
    const health = (c: number): 'green' | 'amber' | 'red' =>
      c >= 0.9 ? 'green' : c >= 0.6 ? 'amber' : 'red';
    const bonus = withC.filter((x) => x.k.scope === 'bonus');
    const monitor = withC.filter((x) => x.k.scope === 'monitor');
    const byLevel = (rows: typeof withC) => {
      const m: Record<string, number> = {};
      for (const x of rows) m[x.k.level] = (m[x.k.level] ?? 0) + 1;
      return m;
    };
    const wByAssignee = new Map<string, number>();
    for (const x of bonus)
      wByAssignee.set(x.k.assigneeId, (wByAssignee.get(x.k.assigneeId) ?? 0) + x.k.weight);
    const weightViolations = Array.from(wByAssignee.entries())
      .filter(([, w]) => Math.round(w) !== 100)
      .map(([assigneeId, totalWeight]) => ({ assigneeId, totalWeight }));
    const referencedAsParent = new Set(
      kpis.map((k) => k.parentKpiId).filter((id): id is string => !!id),
    );
    const counts = { green: 0, amber: 0, red: 0 };
    for (const x of withC) counts[health(x.c)]++;
    const worstKpis = withC
      .filter((x) => x.c < 0.6)
      .sort((a, b) => a.c - b.c)
      .slice(0, limit)
      .map((x) => ({
        title: x.k.title,
        level: KPI_LEVEL_LABEL[x.k.level as KpiLevel] ?? x.k.level,
        scope: x.k.scope,
        completionPct: Math.round(x.c * 100),
        assigneeId: x.k.assigneeId,
      }));
    return {
      ok: true,
      data: {
        cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
        total: kpis.length,
        bonus: bonus.length,
        monitor: monitor.length,
        healthCounts: counts,
        bonusByLevel: byLevel(bonus),
        monitorByLevel: byLevel(monitor),
        cascade: {
          orphans: kpis.filter((k) => k.level !== 'company' && !k.parentKpiId).length,
          uncascadedParents: kpis.filter(
            (k) => k.level !== 'individual' && !referencedAsParent.has(k.id),
          ).length,
        },
        weightValidation: {
          ok: weightViolations.length === 0,
          violations: weightViolations.slice(0, 10),
        },
        worstKpis,
      },
      tokensUsed: 300,
    };
  },
};

// ---------------------------------------------------------------------------
// talent.nine_box · 人才 9 宫格分布 (绿区, 代行允许)
//
// 融合三套子系统: KPI bonus 完成率 (纵轴) × (OKR KR 完成率 + 360 评分) (横轴),
// 给每位被考核人定格, 让推演能看见"人": 谁是 star / 谁要干预 / 谁在烧穿。
// ---------------------------------------------------------------------------

export const TalentNineBoxSkill: Skill<{ limit?: number }, unknown> = {
  id: 'talent.nine_box',
  description:
    '人才 9 宫格分布: 用 KPI bonus 完成率 (纵轴) × (OKR KR 完成率 + 360 评分) (横轴) 给每位被考核人定格 (star / risk_burnout / must_intervene 等), 返回各格人数与典型人员。用于"人才梯队怎么样/谁该重点保留/谁要干预/有没有又拼又快烧穿的人"。',
  tags: ['9宫格', 'nine-box', '人才', '梯队', 'star', '继任', '保留', '干预', 'talent', '盘点'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 450,
  schema: {
    type: 'function',
    function: {
      name: 'talent_nine_box',
      description: '人才 9 宫格分布 (KPI×TTI), 返回各格人数与重点格典型人员',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: '每个重点格返回人数, 默认 5' } },
      },
    },
  },
  async execute({ limit = 5 }) {
    const store = getStore();
    const kpis = await store.kpis.list();
    const bonusByAssignee = new Map<string, { w: number; ws: number }>();
    for (const k of kpis) {
      if (k.scope !== 'bonus') continue;
      const cur = bonusByAssignee.get(k.assigneeId) ?? { w: 0, ws: 0 };
      cur.w += k.weight;
      cur.ws += k.weight * computeKpiCompletion(k);
      bonusByAssignee.set(k.assigneeId, cur);
    }
    const krByOwner = new Map<string, number[]>();
    for (const kr of await store.keyResults.list()) {
      if (!kr.ownerId) continue;
      const a = krByOwner.get(kr.ownerId) ?? [];
      a.push(computeKRProgress(kr));
      krByOwner.set(kr.ownerId, a);
    }
    const r360 = new Map<string, number[]>();
    for (const s of await store.review360Submissions.list()) {
      const sub = s as { overallScore?: number; subjectId?: string };
      if (sub.overallScore == null || !sub.subjectId) continue;
      const a = r360.get(sub.subjectId) ?? [];
      a.push(sub.overallScore);
      r360.set(sub.subjectId, a);
    }
    const avg = (a: number[]): number | null =>
      a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const people = new Set<string>(
      Array.from(bonusByAssignee.keys())
        .concat(Array.from(krByOwner.keys()))
        .concat(Array.from(r360.keys())),
    );
    const distribution: Record<string, number> = {};
    const byCell: Record<string, string[]> = {};
    for (const pid of Array.from(people)) {
      const b = bonusByAssignee.get(pid);
      const kpiScore = b && b.w > 0 ? b.ws / b.w : 0;
      const krAvg = avg(krByOwner.get(pid) ?? []);
      const rAvg = avg(r360.get(pid) ?? []);
      const ttiParts: number[] = [];
      if (krAvg != null) ttiParts.push(krAvg);
      if (rAvg != null) ttiParts.push((rAvg - 1) / 4); // 1-5 → 0-1
      const ttiScore = ttiParts.length
        ? ttiParts.reduce((s, x) => s + x, 0) / ttiParts.length
        : 0;
      const cell = classifyNineBox(kpiScore, ttiScore);
      distribution[cell] = (distribution[cell] ?? 0) + 1;
      (byCell[cell] ??= []).push(pid);
    }
    const focus = (c: NineBoxCell) => (byCell[c] ?? []).slice(0, limit);
    return {
      ok: true,
      data: {
        population: people.size,
        distribution,
        focus: {
          star: focus('star'),
          risk_burnout: focus('risk_burnout'),
          must_intervene: focus('must_intervene'),
          mismatch: focus('mismatch'),
        },
        note: 'kpiScore=bonus KPI 加权完成率; ttiScore=(OKR KR 完成率 + 360 归一化 1-5→0-1) 均值',
      },
      tokensUsed: 300,
    };
  },
};

// ---------------------------------------------------------------------------
// bonus.digest · 年终奖金池速览 (绿区, 代行允许)
//
// 把"钱"接进推演: payout 分布 (committed vs draft)、池子合计、完成率分布、下发就绪度。
// ---------------------------------------------------------------------------

export const BonusDigestSkill: Skill<Record<string, never>, unknown> = {
  id: 'bonus.digest',
  description:
    '年终奖金池速览: 当前 active KPI 周期已算 payout 的分布 (已下发 committed vs 草稿)、基础/最终池合计、加权完成率分布、下发就绪度 (多少 bonus 被考核人已 committed)。用于"奖金算得怎么样/池子多大/还有多少人没下发/谁系数最高最低"。',
  tags: ['奖金', 'bonus', 'payout', '年终', '激励', '下发', '绩效系数', '池'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 350,
  schema: {
    type: 'function',
    function: {
      name: 'bonus_digest',
      description: '年终奖金 payout 分布与下发就绪度 (active KPI 周期)',
      parameters: { type: 'object', properties: {} },
    },
  },
  async execute() {
    const store = getStore();
    const cycles = (await store.kpiCycles.list()).filter((c) => c.status === 'active');
    if (cycles.length === 0) return { ok: true, data: { cycle: null, note: '无 active KPI 周期' } };
    const cycle = cycles.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
    const payouts = (await store.kpiBonusPayouts.list()).filter((p) => p.cycleId === cycle.id);
    const committed = payouts.filter((p) => p.committed);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    const wc = payouts.map((p) => p.weightedCompletion);
    const kpis = await store.kpis.list();
    const bonusAssignees = new Set(
      kpis.filter((k) => k.cycleId === cycle.id && k.scope === 'bonus').map((k) => k.assigneeId),
    );
    const committedAssignees = new Set(committed.map((p) => p.assigneeId));
    const missing = Array.from(bonusAssignees).filter((a) => !committedAssignees.has(a));
    const sorted = [...payouts].sort((a, b) => b.weightedCompletion - a.weightedCompletion);
    const brief = (p: (typeof payouts)[number]) => ({
      assigneeId: p.assigneeId,
      weightedCompletion: Math.round(p.weightedCompletion * 100) / 100,
      finalBonus: Math.round(p.finalBonus),
      committed: p.committed,
    });
    return {
      ok: true,
      data: {
        cycle: { id: cycle.id, name: cycle.name },
        payouts: payouts.length,
        committed: committed.length,
        draft: payouts.length - committed.length,
        baseBonusTotal: Math.round(sum(payouts.map((p) => p.baseBonus))),
        finalBonusTotal: Math.round(sum(payouts.map((p) => p.finalBonus))),
        committedFinalTotal: Math.round(sum(committed.map((p) => p.finalBonus))),
        weightedCompletion: {
          min: wc.length ? Math.round(Math.min(...wc) * 100) / 100 : null,
          max: wc.length ? Math.round(Math.max(...wc) * 100) / 100 : null,
          avg: wc.length ? Math.round((sum(wc) / wc.length) * 100) / 100 : null,
        },
        readiness: {
          bonusAssignees: bonusAssignees.size,
          committedAssignees: committedAssignees.size,
          missingCount: missing.length,
        },
        top: sorted.slice(0, 5).map(brief),
        bottom: sorted.slice(-5).reverse().map(brief),
      },
      tokensUsed: 250,
    };
  },
};

// ---------------------------------------------------------------------------
// analytics.cross_rollup · 四维错配交叉速览 (绿区, 代行允许) · 机会#5
//
// 一次性把 OKR / KPI / 9宫格 / 奖金 在「人」上对齐, 直接返回跨维度错配信号与
// 0-100 错配得分。让融合推演不必多次取数自行拼接, 直接拿到"谁在烧穿、奖金跟
// 产出错配、哪个事业部四维最不一致"的真值。
// ---------------------------------------------------------------------------

export const CrossRollupSkill: Skill<{ cycleId?: string }, unknown> = {
  id: 'analytics.cross_rollup',
  description:
    '四维错配交叉速览: 在「人」上对齐 OKR 目标进度 / KPI 底线完成 / 9宫格定格 / 年终奖金, 返回全公司与各事业部的「四维错配得分」(0-100)、错配信号统计 (烧穿/人岗错位/紧急干预/奖金错配/奖金未下发) 和错配最严重的人。用于"系统整体哪里最不一致/哪个事业部错配最重/奖金跟产出对不对得上/谁在烧穿"等融合推演。',
  tags: ['错配', '融合', '交叉', 'cross-rollup', '四维', '杠杆', '烧穿', '奖金错配', '一致性', 'OKR', 'KPI', '9宫格', '奖金'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 550,
  schema: {
    type: 'function',
    function: {
      name: 'analytics_cross_rollup',
      description: '四维 (OKR/KPI/9宫格/奖金) 错配交叉速览, 返回错配得分/信号统计/重点风险人',
      parameters: {
        type: 'object',
        properties: { cycleId: { type: 'string', description: 'OKR 周期 id, 省略则跨全部周期' } },
      },
    },
  },
  async execute({ cycleId }, ctx) {
    const store = getStore();
    const r = await computeCrossRollup(store, ctx.tenantId, cycleId && cycleId !== 'all' ? cycleId : null);
    const unitBrief = r.units.slice(0, 8).map((u) => ({
      businessUnit: u.businessUnit,
      headcount: u.headcount,
      misalignScore: u.misalignScore,
      avgOkrProgress: Math.round(u.avgOkrProgress * 100) / 100,
      avgKpiScore: Math.round(u.avgKpiScore * 100) / 100,
      bonusTotal: Math.round(u.bonusTotal),
      bonusCommittedRatio: Math.round(u.bonusCommittedRatio * 100) / 100,
      signalCounts: u.signalCounts,
    }));
    const riskBrief = r.topRisks.slice(0, 10).map((p) => ({
      name: p.name,
      businessUnit: p.businessUnit,
      cell: p.cell,
      kpiScore: Math.round(p.kpiScore * 100) / 100,
      ttiScore: Math.round(p.ttiScore * 100) / 100,
      misalignScore: p.misalignScore,
      signals: p.signals.map((s) => `${misalignKindLabel(s.kind)}: ${s.detail}`),
    }));
    return {
      ok: true,
      data: {
        cycle: { id: r.cycleId, name: r.cycleName },
        overall: {
          headcount: r.overall.headcount,
          misalignScore: r.overall.misalignScore,
          bonusTotal: Math.round(r.overall.bonusTotal),
          bonusCommittedRatio: Math.round(r.overall.bonusCommittedRatio * 100) / 100,
          signalCounts: r.overall.signalCounts,
        },
        units: unitBrief,
        topRisks: riskBrief,
        note: '错配得分 0-100 越高越不一致; 维度口径与 /api/nine-box、奖金引擎一致',
      },
      tokensUsed: 400,
    };
  },
};

// ---------------------------------------------------------------------------
// 注册所有内置工具
// ---------------------------------------------------------------------------

export function registerBuiltinSkills(): void {
  skillRegistry.register(MemorySearchSkill);
  skillRegistry.register(DecisionCardListSkill);
  skillRegistry.register(OkrReadSkill);
  skillRegistry.register(OkrHealthDigestSkill);
  skillRegistry.register(OkrBusinessReviewSkill);
  // 融合推演: KPI 底线 / 人才 9 宫格 / 年终奖金 (只读, 绿区, 代行允许)
  skillRegistry.register(KpiHealthDigestSkill);
  skillRegistry.register(TalentNineBoxSkill);
  skillRegistry.register(BonusDigestSkill);
  skillRegistry.register(CrossRollupSkill);
  skillRegistry.register(PersonaGetSkill);
  skillRegistry.register(ConvergenceStartSkill);
  skillRegistry.register(SalaryAccessSkill);
  skillRegistry.register(WebSearchSkill);
  // S1 搭子写动作肢体 (提议→治理→24h否决窗; 真治理在 proposeAction 下游)
  skillRegistry.register(OkrCheckinProposeSkill);
  skillRegistry.register(OkrObjectiveCheckinProposeSkill);
  skillRegistry.register(PersonaProposeActionSkill);
  // A 执行肢体扩面: 起草类代行 (周报 / 行动项), 落 decision_draft ProxyAction (24h)
  skillRegistry.register(PersonaDraftReportSkill);
  skillRegistry.register(PersonaDraftActionItemsSkill);
}
