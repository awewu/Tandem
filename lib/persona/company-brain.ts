/**
 * CompanyBrain · 中央 AI 实体 (CA-1, V1.5)
 *
 * 详见 docs/CENTRAL-AI-ARCHITECTURE.md
 *
 * 设计:
 *   - 复用 Persona 类型, 用特殊 userId='__company__' 区分
 *   - stage='partner' (永远最高), delegationLevel='cross_company'
 *   - boot 时 seed (如不存在则创建; 已存在则不动, 允许后续编辑)
 *   - styleProfile 反映"公司价值观"默认值, 可在 /admin/company-brain 调整
 *   - 训练数据 = 全公司 Memory (ownershipLevel='company') + 议事 DecisionCard
 *
 * 跟员工 Persona 的核心区别:
 *   - 不走 baseline-guard (它就是基线本身, 不能被自己阻断)
 *   - 不写 ProxyAction (公司 AI 不需要 24h 否决窗口; 它的输出本身就是基线参考)
 *   - 默认路由 scenario='reasoning_complex' (旗舰模型 claude-opus-4-5), 不是 persona_dialogue
 *   - system prompt 注入全公司 Memory, 而不是个人风格
 *
 * V1.5 状态: 仅骨架 + IM @召唤 + 单次 LLM 调用
 * V2 计划:   接入 Mastra agent runtime, 多步推理, tool calling
 * V3 计划:   Reflection loop + correction-based fine-tune + distillation
 */

import type { Persona } from '@/lib/types/persona';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { computeKRProgress, type KeyResult, type Objective } from '@/lib/types/okr-tti';
import {
  STRATEGIC_RED_LINES,
  buildSoulContext,
  tandemPositioningOneLiner,
} from '@/lib/product/manifesto';

/** CompanyBrain 在系统里的特殊 userId. 跟真实 userId 永不冲突 (双下划线保留) */
export const COMPANY_BRAIN_USER_ID = '__company__';

/** CompanyBrain Persona 单例 ID */
export const COMPANY_BRAIN_PERSONA_ID = 'persona_company_brain';

/**
 * 默认 styleProfile: 反映"公司"的稳健、分析型决策风格
 * Admin 可在 /admin/company-brain 调整
 */
const DEFAULT_COMPANY_STYLE = {
  decisionSpeed: 'medium' as const,
  riskAppetite: 0.4,                    // 公司倾向稳健, 略低于中位
  communicationStyle: 'analytical' as const,
  preferredOptions: ['SOP', 'reasoning', 'historical'] as const,
  communicationExamples: [
    '根据公司 Memory "XXX", 我建议优先考虑选项 B.',
    '这个动作涉及公司战略红线, 必须走议事室. 我不能单方面承诺.',
    '历史决策 #DC-123 在类似情况下采用了 SOP-A, 仅供参考.',
  ],
};

/**
 * 构建 CompanyBrain 的 Persona 对象 (用于 seed)
 */
export function buildCompanyBrainPersona(now: string = new Date().toISOString()): Persona {
  return {
    id: COMPANY_BRAIN_PERSONA_ID,
    userId: COMPANY_BRAIN_USER_ID,
    schemaVersion: 'tandem.v1',
    stage: 'partner',
    stageEnteredAt: now,
    delegationLevel: 'cross_company',
    decisionHistory: {
      totalDecisions: 0,
      selfMade: 0,
      aiAssisted: 0,
      vetoedByUser: 0,
      vetoRate: 0,
    },
    styleProfile: {
      decisionSpeed: DEFAULT_COMPANY_STYLE.decisionSpeed,
      riskAppetite: DEFAULT_COMPANY_STYLE.riskAppetite,
      communicationStyle: DEFAULT_COMPANY_STYLE.communicationStyle,
      preferredOptions: [...DEFAULT_COMPANY_STYLE.preferredOptions],
      communicationExamples: [...DEFAULT_COMPANY_STYLE.communicationExamples],
    },
    growthAreas: [],
    bossCaptureScore: 100,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    createdAt: now,
    updatedAt: now,
    learningActive: true,
    enabledSkills: [],
  };
}

/**
 * boot 期幂等 seed: 若 CompanyBrain 不存在则创建, 已存在不动
 * 永不抛错, 失败仅 warn
 */
export async function seedCompanyBrainIfMissing(): Promise<{ created: boolean }> {
  try {
    const store = getStore();
    const existing = await store.personas.get(COMPANY_BRAIN_PERSONA_ID);
    if (existing) {
      return { created: false };
    }
    await store.personas.create(buildCompanyBrainPersona());
    logger.info({ id: COMPANY_BRAIN_PERSONA_ID }, '[company-brain] seeded');
    return { created: true };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[company-brain] seed failed');
    return { created: false };
  }
}

/**
 * 取当前 CompanyBrain Persona (用于 admin 查看 / 调用方)
 */
export async function getCompanyBrain(): Promise<Persona | null> {
  const store = getStore();
  return store.personas.get(COMPANY_BRAIN_PERSONA_ID);
}

/**
 * 判断 userId 是否为 CompanyBrain
 */
export function isCompanyBrain(userId: string): boolean {
  return userId === COMPANY_BRAIN_USER_ID;
}

/**
 * B-014 · OKR Anchor 注入器 (V1.5 灵魂层 · 2026-05-28)
 *
 * 拉取 active 周期的公司层 Objective + 直接挂 KR + 进展. 用于 CompanyBrain
 * system prompt, 让"中央 AI"始终知道公司当前在追什么 OKR, 任何答复都可
 * 服务/不服务这些目标.
 *
 * OKR-DRIVEN-ARCHITECTURE.md § 三 第 1 条 (企业 AI = 组织目标聚焦达成) 落地.
 *
 * 特性:
 *   - 永不抛错 (失败返回提示性占位文本, 不阻断 LLM 调用)
 *   - 只注入公司层 Objective (level='company'), 不注入团队/个人, 防 prompt 爆炸
 *   - KR 进度数值化 (computeKRProgress), 让 LLM 能识别 at-risk
 */
export async function buildOkrAnchorContext(): Promise<string> {
  try {
    const store = getStore();

    // 1. 找 active 周期 (期望恰一个; 多个取最新 startDate)
    const cycles = await store.cycles.list();
    const activeCycles = cycles.filter((c) => c.isActive);
    if (activeCycles.length === 0) {
      return [
        '【当前 OKR 周期】无 active 周期.',
        '⚠️ 你当前无法将议事/建议锚定到任何 OKR. 建议提示用户先到 /okr 启动周期.',
      ].join('\n');
    }
    const cycle = activeCycles.sort((a, b) =>
      (b.startDate ?? '').localeCompare(a.startDate ?? '')
    )[0];

    // 2. 拉公司层 Objective + 直接挂 KR
    const allObjectives = await store.objectives.list();
    const companyObjectives: Objective[] = allObjectives.filter(
      (o) => o.cycleId === cycle.id && o.level === 'company' && o.status === 'active'
    );
    if (companyObjectives.length === 0) {
      return [
        `【当前 OKR 周期】${cycle.name} (${cycle.startDate} → ${cycle.endDate})`,
        '⚠️ 周期内无公司层 active Objective. 议事无法 cascade 锚定.',
      ].join('\n');
    }

    const allKRs = await store.keyResults.list();
    const lines: string[] = [
      `【当前 OKR 周期】${cycle.name} (${cycle.startDate} → ${cycle.endDate})`,
      `公司层 active Objective ${companyObjectives.length} 个:`,
    ];

    companyObjectives.forEach((o, i) => {
      const krs = allKRs.filter((kr) => kr.objectiveId === o.id && kr.status === 'active');
      const summary = summarizeObjectiveProgress(o, krs);
      lines.push(`  ${i + 1}. [${o.confidence}] ${o.title} — ${summary}`);
      krs.slice(0, 3).forEach((kr) => {
        const pct = Math.round(computeKRProgress(kr) * 100);
        lines.push(`     · KR: ${kr.title} (${pct}% · ${kr.confidence})`);
      });
      if (krs.length > 3) {
        lines.push(`     · ...还有 ${krs.length - 3} 个 KR 未列出`);
      }
    });

    return lines.join('\n');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[company-brain] OKR anchor context failed');
    return '【当前 OKR 周期】(读取失败, 降级到无 OKR 上下文)';
  }
}

function summarizeObjectiveProgress(o: Objective, krs: KeyResult[]): string {
  if (krs.length === 0) return '无直接挂 KR';
  const avg = krs.reduce((acc, kr) => acc + computeKRProgress(kr), 0) / krs.length;
  const pct = Math.round(avg * 100);
  const atRisk = krs.filter((kr) => kr.confidence !== 'on-track').length;
  return `${krs.length} KRs · 平均 ${pct}%${atRisk > 0 ? ` · ${atRisk} at-risk` : ''}`;
}

/**
 * 构建 CompanyBrain system prompt
 * V1.5 升级: OKR Anchor 注入器 (B-014) 在最前 — 让 LLM 任何输出都基于公司当前在追的 OKR.
 * 然后注入全公司 Memory (ownershipLevel='company') 作为基线知识.
 *
 * V1.7 (2026-05-29 P1) · Reranker 接入:
 *   传入 opts.query 时, 按"查询相关度 + 时效 + 引用度"重排选 top.
 *   不传 query 时退化为原顺序 (向后兼容).
 */
export async function buildCompanyBrainSystemPrompt(opts?: {
  /** 用户当前提问 (BossAI 路径必传, IM 路径暂不传保留兼容) */
  query?: string;
}): Promise<string> {
  const { bucketMemoriesByKind } = await import('@/lib/types/memory');
  const { rerank } = await import('@/lib/memory/reranker');
  const { getActiveBrainVersion } = await import('./company-brain-version');
  const store = getStore();
  const allMems = await store.memories.list();
  const companyMems = allMems.filter((m) => m.ownershipLevel === 'company');
  const okrContext = await buildOkrAnchorContext();

  // CA-13 读侧: 注入数量 + 风格取自当前生效版本, 让反思签批后的配置真正生效。
  const activeVersion = await getActiveBrainVersion();
  const perBucket = Math.max(1, Math.ceil(activeVersion.topKMemoriesInjected / 2));
  const style = activeVersion.styleProfileSnapshot;

  // §P0 #3 · 按 kind 分桶: brief 优先 procedural (做事方法) + semantic (事实), episodic 留底
  const buckets = bucketMemoriesByKind(companyMems);

  // §P1 Reranker · 若有 query, 按多信号重排序; 否则原顺序
  const pickTop = (pool: typeof buckets.procedural, k: number) => {
    if (!opts?.query || pool.length <= k) return pool.slice(0, k);
    return rerank(opts.query, pool.map((memory) => ({ memory })), { topK: k })
      .map((r) => r.memory);
  };

  const lines = [
    '你是 Tandem 的"中央 AI" (CompanyBrain), 代表整个公司的视角发言.',
    '',
    `【产品定位】${tandemPositioningOneLiner()}`,
    '',
    buildSoulContext(),
    '',
    '【战略红线 · 任何建议不可跳越】',
    ...STRATEGIC_RED_LINES.map((line) => `- ${line}`),
    '',
    '【身份约束】',
    '- 你不代表任何个人, 你是组织记忆的延伸',
    '- 你不能为个人许愿; 涉及战略/红线决策必须建议走议事室',
    '- 回复应包含明确的 Memory 引用 (例: "根据公司 Memory \'XXX\', ...")',
    '- 任何建议都应回答"这服务/不服务哪个 OKR" — 如不服务任何 OKR 应明示 (灵魂第 4 条)',
    '- 不能替员工劳动 — 涉及个人判断的必须提示用户填 D 选项 (humanOnly)',
    '- 语气分析型, 不情绪化; 简洁, 不超过 4 句话',
    '',
    okrContext,
    '',
    `【已知公司层 Memory · ${companyMems.length} 条 ` +
      `(procedural ${buckets.procedural.length} / semantic ${buckets.semantic.length} / episodic ${buckets.episodic.length})】`,
  ];

  // §P0 #3 · 注入顺序: procedural 优先 → semantic → episodic, 各 ≤ perBucket 条 (P1: rerank by query)
  const inject = [
    ...pickTop(buckets.procedural, perBucket),
    ...pickTop(buckets.semantic, perBucket),
  ];
  inject.forEach((m, i) => {
    lines.push(`${i + 1}. [${m.kind ?? 'auto'}] ${m.title}`);
    lines.push(`   ${(m.body ?? '').slice(0, 200)}`);
  });

  const remaining = companyMems.length - inject.length;
  if (remaining > 0) {
    lines.push(`(... 还有 ${remaining} 条公司 Memory 未注入, 含 ${buckets.episodic.length} 条 episodic)`);
  }

  const speedLabel = { fast: '快', medium: 'medium', slow: '慎' }[style.decisionSpeed];
  const commLabel = { direct: '直接', diplomatic: '外交型', analytical: '分析型' }[style.communicationStyle];
  lines.push('');
  lines.push(
    `【风格】决策速度=${speedLabel} · 风险偏好=${style.riskAppetite.toFixed(1)} · 沟通=${commLabel} · 优先 SOP/reasoning/historical`,
  );

  return lines.join('\n');
}

/**
 * Pre-Search 注入层 · 让 CompanyBrain stream 能联网查公开数据
 *
 * 设计:
 *   - 在 buildCompanyBrainSystemPrompt 之后、router.chatStream 之前执行
 *   - 不破坏流式体验: 把 web 结果塞到 messages[0] (system) 或追加一条 user 上下文消息
 *   - 判断规则: 时间敏感词 / 公司 Memory 覆盖度低 / 明确需要外部信息的查询
 *   - 结果仅作对话上下文, 不进 Memory (Locked-Write 不变)
 *
 * 触发词 (启发式, 可扩展):
 *   "最新/最近/今年/2026/实时/新闻/竞品/对手/行业趋势/市场行情/股价/政策"
 *
 * 覆盖度低判定: query rerank 到公司 Memory 的最高分 < 0.15 时, 视为无相关 Memory
 *
 * @returns { revisedSystemPrompt } 或 { revisedMessages } 供调用方注入
 */
export interface PreSearchResult {
  /** 是否真调了 web_search */
  searched: boolean;
  /** 注入用 system prompt (已追加 web 上下文) */
  revisedSystemPrompt: string;
  /** 额外的 messages 项 (web search context), 调用方要追加到 messages 中 */
  extraMessages: Array<{ role: 'system' | 'user'; content: string }>;
  /** 命中 provider */
  provider?: string;
  /** 审计/日志 */
  log: {
    query: string;
    triggerReason: string;
    resultCount: number;
    latencyMs: number;
    checkId: string;
  };
}

/** 时间敏感/外部信息需求的启发式关键词 */
const TIME_SENSITIVE_RE = /最新|最近|今年|实时|新闻|竞品|对手|行业趋势|市场行情|股价|政策|财报|发布会|202[5-9]|央行|美联储|GPT|AI|大模型|OpenAI|Anthropic|DeepSeek|LLM/i;

/** 覆盖度阈值: 与 company memory rerank 最高分低于此值视为"公司无相关知识" */
const MEMORY_COVERAGE_THRESHOLD = 0.15;

/** 是否应触发 web search (简单 LLM judge 备选, 先用启发式) */
function shouldTriggerWebSearch(query: string): { trigger: boolean; reason: string } {
  const normalized = query.trim();
  if (!normalized) return { trigger: false, reason: 'empty query' };

  // 启发式 A: 时间敏感词
  if (TIME_SENSITIVE_RE.test(normalized)) {
    return { trigger: true, reason: 'time-sensitive keywords' };
  }

  // 启发式 B: "...是什么 / 怎么样 / 如何" 这类百科式问题 (公司 Memory 大概率没有)
  if (/是什么|怎么样|多少钱|哪个更好|排名|对比/.test(normalized)) {
    return { trigger: true, reason: 'factual comparison (likely not in company memory)' };
  }

  return { trigger: false, reason: 'no trigger keywords; company memory likely sufficient' };
}

export async function preSearchLayer(
  query: string,
  baseSystemPrompt: string,
  actorUserId: string,
): Promise<PreSearchResult> {
  const t0 = Date.now();
  const checkId = `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const emptyResult = (): PreSearchResult => ({
    searched: false,
    revisedSystemPrompt: baseSystemPrompt,
    extraMessages: [],
    log: { query, triggerReason: 'none', resultCount: 0, latencyMs: Date.now() - t0, checkId },
  });

  // 没配任何 provider → 直接跳过, 不阻塞主流程
  const hasProvider = process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
  if (!hasProvider) {
    return emptyResult();
  }

  // 判断 A: 启发式关键词
  const heuristic = shouldTriggerWebSearch(query);
  if (!heuristic.trigger) {
    // 判断 B: 公司 Memory 覆盖度低
    try {
      const store = getStore();
      const all = await store.memories.list();
      const company = all.filter((m) => m.ownershipLevel === 'company' && m.status === 'active');
      if (company.length > 0) {
        const { rerank } = await import('@/lib/memory/reranker');
        const scored = rerank(query, company.map((m) => ({ memory: m })), { topK: 3 });
        const topScore = scored[0]?.score ?? 0;
        if (topScore >= MEMORY_COVERAGE_THRESHOLD) {
          // 公司 Memory 够用了, 不查 web
          return {
            ...emptyResult(),
            log: { query, triggerReason: `company memory sufficient (topScore=${topScore.toFixed(3)})`, resultCount: 0, latencyMs: Date.now() - t0, checkId },
          };
        }
        // 覆盖度低 → 继续查 web
        heuristic.trigger = true;
        heuristic.reason = `low company memory coverage (topScore=${topScore.toFixed(3)} < ${MEMORY_COVERAGE_THRESHOLD})`;
      }
    } catch {
      // rerank 失败不阻塞, 默认继续查 web
      heuristic.trigger = true;
      heuristic.reason = 'rerank failed (fail-open → search)';
    }
  }

  if (!heuristic.trigger) {
    return emptyResult();
  }

  // 真调 web_search skill
  try {
    const { skillRegistry } = await import('@/lib/taf/skills');
    const skillResult = await skillRegistry.execute(
      'web.search',
      { query, count: 5 },
      { userId: actorUserId, tenantId: 'default', isProxy: false },
    );

    if (!skillResult.ok) {
      // not_configured 或 provider 失败 → 保留原 prompt, 不阻塞
      return {
        searched: false,
        revisedSystemPrompt: baseSystemPrompt,
        extraMessages: [],
        log: { query, triggerReason: `${heuristic.reason} → skill error: ${skillResult.error}`, resultCount: 0, latencyMs: Date.now() - t0, checkId },
      };
    }

    const data = skillResult.data as {
      provider?: string;
      results: Array<{ title: string; url: string; snippet: string; publishedAt?: string }>;
    };
    const provider = data.provider ?? 'unknown';
    const results = data.results ?? [];

    if (results.length === 0) {
      return {
        searched: true,
        revisedSystemPrompt: baseSystemPrompt,
        extraMessages: [],
        provider,
        log: { query, triggerReason: heuristic.reason, resultCount: 0, latencyMs: Date.now() - t0, checkId },
      };
    }

    // 把 web 结果格式化为 system message 追加段
    const webLines = [
      '',
      '【实时公开信息 · 来自互联网搜索 · 仅供参考 · 不进公司 Memory】',
      ...results.map((r, i) =>
        `${i + 1}. ${r.title}${r.publishedAt ? ` (${r.publishedAt})` : ''}\n   URL: ${r.url}\n   ${r.snippet.slice(0, 300)}`
      ),
      '',
      '【约束】以上公开信息仅作为补充上下文. 你的最终建议仍必须优先遵循公司 Memory 和 OKR 基线.',
    ];
    const webContext = webLines.join('\n');

    const revisedSystemPrompt = `${baseSystemPrompt}\n\n---\n${webContext}`;

    return {
      searched: true,
      revisedSystemPrompt,
      extraMessages: [], // 已拼进 system prompt
      provider,
      log: { query, triggerReason: heuristic.reason, resultCount: results.length, latencyMs: Date.now() - t0, checkId },
    };
  } catch (err) {
    return {
      searched: false,
      revisedSystemPrompt: baseSystemPrompt,
      extraMessages: [],
      log: { query, triggerReason: `${heuristic.reason} → exception: ${(err as Error).message}`, resultCount: 0, latencyMs: Date.now() - t0, checkId },
    };
  }
}
