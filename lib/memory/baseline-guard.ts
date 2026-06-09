/**
 * Baseline Guard · Agent 调用前的"防跑偏"门禁
 *
 * 设计哲学 (§T15 + 宪章 §14):
 *   "组织记忆是员工 Agent 的方向盘, 不是建议. Agent 调用任何技能/产生任何输出前,
 *    必须经过 baseline-guard 校验; 与组织记忆冲突的 Agent 行为必须被阻断或转人工."
 *
 * 三级处置 (按风险递增):
 *   - PASS    · 无关或一致, 直接放行
 *   - SOFT    · 弱偏离 (信心度 < 0.7), 加 warning 注入 prompt, 留痕
 *   - HARD    · 强偏离 (违反 company-level memory 或 PromotionLevel='company' baseline), 阻断 + 通知治理委员会
 *
 * 工作流:
 *   1. Agent 接到 user intent
 *   2. 提取 intent 关键词/embedding → 召回相关 MemoryEntry (按可见性过滤)
 *   3. 比对意图 vs 记忆策略 (规则 + 文本相似度 + LLM 仲裁三级)
 *   4. 输出 BaselineDecision { verdict, reasons, contextToInject }
 *   5. 调用方按 verdict 决定继续/中断/降级
 */

import type { MemoryEntry } from '@/lib/types/memory';
import { canViewMemory } from '@/lib/types/memory';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { embed, cosineSim, isEmbeddingConfigured } from '@/lib/infra/embedding';
import { getActiveBrainVersion } from '@/lib/persona/company-brain-version';

export type BaselineVerdict = 'PASS' | 'SOFT_WARN' | 'HARD_BLOCK';

export interface BaselineCheckInput {
  /** Agent 要执行的意图描述 (自然语言, 用于召回) */
  intent: string;
  /** 调用方 (员工 Agent 关联的 userId) */
  actorUserId: string;
  /** 调用方部门 (用于可见性过滤) */
  actorDepartmentId?: string;
  /** Agent 类型 (skill / persona-reply / autonomous-task) */
  agentKind: 'skill' | 'persona' | 'autonomous';
  /** 候选 skill / 工具名, 用于审计 */
  toolName?: string;
  /** 业务参数 (用于规则匹配) */
  payload?: Record<string, unknown>;
}

export interface BaselineDecision {
  verdict: BaselineVerdict;
  /** 命中的记忆条目 (id + 简要原因) */
  hits: Array<{
    memoryId: string;
    title: string;
    ownershipLevel: MemoryEntry['ownershipLevel'];
    similarity: number;
    reason: string;
  }>;
  /** 决策原因 (人类可读, 写入 audit) */
  reasons: string[];
  /**
   * 注入 Agent system prompt 的额外上下文.
   * SOFT_WARN 时必填; PASS 可空; HARD_BLOCK 调用方不再走 LLM, 仅记录.
   */
  contextToInject: string;
  /** 是否需要人工确认才能继续 (SOFT_WARN with high stakes) */
  requireHumanConfirm: boolean;
  /** 命中的最高优先级 ownership */
  highestHitLevel?: MemoryEntry['ownershipLevel'];
  /** 用于审计追踪的 reqId */
  checkId: string;
  /**
   * §S3/CA-2 · 灰区 LLM 仲裁结果 (仅当对公司级灰区命中触发仲裁时有值).
   * 让"语义相关但相似度不够触发硬阻断"的模糊地带得到真实判断, 而非一律 SOFT_WARN。
   */
  arbitration?: {
    verdict: BaselineVerdict;
    rationale: string;
    /** 仲裁所基于的命中记忆 id */
    memoryIds: string[];
  };
}

// ---------------------------------------------------------------------------
// 简化文本相似度 (V1: keyword overlap; V2: pgvector cosine)
// ---------------------------------------------------------------------------

function tokenize(s: string): Set<string> {
  // 英文按整词, 中文按字 (跟 lib/memory/retriever.ts 一致)
  // 不再 filter length>=2: 单个中文字也是有效 token
  const tokens = new Set<string>();
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.toLowerCase())) !== null) {
    tokens.add(m[1] ?? m[2]);
  }
  return tokens;
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------------------------------------------------------------------------
// §S3/CA-2 · 灰区 LLM 仲裁
//
// 问题: 公司级记忆命中, 但相似度落在 [softWarn, hardBlock) 灰区 —— 语义相关却不够
//       硬阻断。旧逻辑一律 SOFT_WARN, 既可能漏掉真违规 (该 HARD_BLOCK), 也可能误扰
//       合规意图 (该 PASS)。相似度本身分不清"相关"与"违反"。
// 方案: 对灰区公司级命中跑一次 LLM 仲裁, 真判定意图是否违反这些公司红线/策略, 返回
//       PASS / SOFT_WARN / HARD_BLOCK。fail-soft: 任何异常都回退到启发式裁决, 绝不放行
//       本应阻断的动作 (仲裁只能在灰区内升级/维持/降级, 不触碰已 HARD_BLOCK 的强命中)。
// ---------------------------------------------------------------------------

/** 关掉灰区仲裁的开关 (默认开; 设 'off' 退回纯启发式)。 */
function isArbitrationEnabled(): boolean {
  return (process.env.BASELINE_GREYZONE_ARBITRATION ?? 'on').toLowerCase() !== 'off';
}

const ARBITRATION_SYSTEM = [
  '你是 Tandem 组织治理的「红线仲裁官」。给你一个 Agent 准备执行的意图, 以及若干条语义相关的公司级组织记忆/红线。',
  '你的任务: 判定该意图是否**违反**这些公司级红线/策略。只判违反与否, 不要替 Agent 完成任务。',
  '裁决档位:',
  "- 'HARD_BLOCK': 意图清楚违反某条公司级红线 (如把红线禁止的数据/动作真的执行了)。",
  "- 'SOFT_WARN': 意图与红线相关、存在偏离风险, 但不构成明确违反, 需提醒 Agent 谨慎。",
  "- 'PASS': 意图与这些红线无实质冲突 (仅字面/话题相关, 并不触犯)。",
  '从严但不过度: 仅在确有违反证据时才 HARD_BLOCK; 拿不准时给 SOFT_WARN, 不要凭空 PASS 放过可疑动作。',
  '输出 JSON: { "verdict": "PASS|SOFT_WARN|HARD_BLOCK", "rationale": "一句话中文理由" }',
].join('\n');

/**
 * 对灰区公司级命中跑 LLM 仲裁。fail-soft: 出错返回 null (调用方回退启发式)。
 */
async function arbitrateGreyZone(opts: {
  intent: string;
  toolName?: string;
  greyHits: Array<{ mem: MemoryEntry; sim: number }>;
}): Promise<{ verdict: BaselineVerdict; rationale: string } | null> {
  try {
    // 惰性解析 router: 优先 globalThis.__tandem_router__ (测试/已 boot), 避免顶层 import
    // 整条 boot 链 (boot→drizzle-store→drizzle-client 在 DATABASE_URL 缺省时模块级抛错)。
    // 与 governance/governed-chat.resolveRouter + reflexion.resolveRouter 同模式。
    const g = globalThis as { __tandem_router__?: { chat?: (req: unknown) => Promise<{ message: { content: unknown } }> } };
    let router = g.__tandem_router__;
    if (!router) {
      const { getRouter } = await import('@/lib/boot');
      router = getRouter() as never;
    }
    if (!router?.chat) return null;

    const policies = opts.greyHits
      .map(
        (h, i) =>
          `${i + 1}. [${ownerLabel(h.mem.ownershipLevel)}·相似度${h.sim.toFixed(2)}] ${h.mem.title}\n   ${(h.mem.body ?? '').slice(0, 400)}`,
      )
      .join('\n\n');

    const userMsg = [
      '【Agent 意图】',
      opts.intent.slice(0, 1500),
      opts.toolName ? `\n【调用工具】${opts.toolName}` : '',
      '\n【可能相关的公司级红线/组织记忆】',
      policies,
      '\n请判定该意图是否违反上述任一条公司级红线/策略。',
    ].join('\n');

    const res = await router.chat({
      messages: [
        { role: 'system', content: ARBITRATION_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 300,
      temperature: 0.1,
      responseFormat: {
        type: 'json_schema',
        name: 'baseline_greyzone_arbitration',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['verdict', 'rationale'],
          properties: {
            verdict: { type: 'string', enum: ['PASS', 'SOFT_WARN', 'HARD_BLOCK'] },
            rationale: { type: 'string', maxLength: 300 },
          },
        },
      },
    });

    const raw = typeof res.message.content === 'string' ? res.message.content : '{}';
    const parsed = JSON.parse(raw) as { verdict?: unknown; rationale?: unknown };
    const v = parsed.verdict;
    if (v !== 'PASS' && v !== 'SOFT_WARN' && v !== 'HARD_BLOCK') return null;
    return {
      verdict: v,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 300) : '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

// 阈值改读活动 CompanyBrainVersion (默认 hardBlock=0.45 / softWarn=0.2, 见 company-brain-version.ts),
// 让月度反思签批后的阈值调整 (CA-13 闭环写侧) 真正生效。
const TOP_K = 8;

export async function checkBaseline(input: BaselineCheckInput): Promise<BaselineDecision> {
  const checkId = `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const store = getStore();
  const allMems = await store.memories.list();

  // CA-13 读侧: 阈值取自当前生效的 CompanyBrain 版本 (无版本则默认 0.45/0.2)。
  const activeVersion = await getActiveBrainVersion();
  const hardBlockThreshold = activeVersion.baselineThresholds.hardBlock;
  const softWarnThreshold = activeVersion.baselineThresholds.softWarn;

  // 可见性过滤
  const viewer = {
    userId: input.actorUserId,
    departmentId: input.actorDepartmentId,
    isManagerOf: [], // V2: 从 org 服务取
  };
  const visible = allMems.filter((m) => canViewMemory(m, viewer));

  // 相似度计算: 优先 embedding cosine, 降级 Jaccard
  let scored: Array<{ mem: MemoryEntry; sim: number }> = [];
  const intentText = input.intent + ' ' + (input.toolName ?? '');

  if (isEmbeddingConfigured()) {
    const intentVec = await embed(intentText);
    if (intentVec) {
      // 性能保护: 仅对最近更新的 50 条 + 所有 company-level 记忆做向量计算.
      // 其余走 Jaccard 兜底, 避免 N+1 API 调用打挂.
      const ranked = [...visible].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
      const companyMems = ranked.filter((m) => m.ownershipLevel === 'company');
      const recent = ranked.filter((m) => m.ownershipLevel !== 'company').slice(0, 50);
      const evalSet = [...companyMems, ...recent];
      const items = await Promise.all(
        evalSet.map(async (m) => {
          let memVec = m.embedding;
          if (!memVec || memVec.length === 0) {
            memVec = (await embed(`${m.title}\n${m.body}`)) ?? undefined;
          }
          const sim = memVec ? cosineSim(intentVec, memVec) : 0;
          return { mem: m, sim };
        }),
      );
      scored = items
        .filter((x) => x.sim >= softWarnThreshold)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, TOP_K);
    }
  }
  if (scored.length === 0) {
    const intentTokens = tokenize(intentText);
    scored = visible
      .map((m) => ({ mem: m, sim: jaccardSim(intentTokens, tokenize(`${m.title} ${m.body}`)) }))
      .filter((x) => x.sim >= softWarnThreshold)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);
  }

  // 判定
  let verdict: BaselineVerdict = 'PASS';
  const reasons: string[] = [];
  let highestHitLevel: MemoryEntry['ownershipLevel'] | undefined;
  let requireHumanConfirm = false;
  // §S3/CA-2 · 灰区命中: 公司级记忆, 相似度落 [softWarn, hardBlock) —— 相关但不够硬阻断
  const greyCompanyHits: Array<{ mem: MemoryEntry; sim: number }> = [];

  for (const { mem, sim } of scored) {
    const level = mem.ownershipLevel;
    if (!highestHitLevel || ownerWeight(level) > ownerWeight(highestHitLevel)) {
      highestHitLevel = level;
    }
    // company-level + 高相似度 → HARD_BLOCK (战略红线)
    if (level === 'company' && sim >= hardBlockThreshold) {
      verdict = 'HARD_BLOCK';
      reasons.push(`命中公司级记忆"${mem.title}" (相似度 ${sim.toFixed(2)}), 视为战略红线偏离`);
    } else if (level === 'company' && sim >= softWarnThreshold) {
      greyCompanyHits.push({ mem, sim });
    }
  }

  if (verdict !== 'HARD_BLOCK' && scored.length > 0) {
    verdict = 'SOFT_WARN';
    reasons.push(`命中 ${scored.length} 条相关组织记忆, 注入 baseline 上下文供 Agent 参考`);
    // 命中 dept-level + autonomous → 需人工确认
    if (input.agentKind === 'autonomous' && (highestHitLevel === 'department' || highestHitLevel === 'company')) {
      requireHumanConfirm = true;
      reasons.push('autonomous Agent 命中部门/公司级记忆, 要求人工确认');
    }
  }

  // §S3/CA-2 · 灰区 LLM 仲裁: 仅对"未硬阻断的公司级灰区命中"做真判定 (相似度分不清相关/违反)。
  // fail-soft: 仲裁失败/未启用 → 保留上面的启发式裁决。仲裁可升级到 HARD_BLOCK, 也可降级到 PASS。
  let arbitration: BaselineDecision['arbitration'];
  if (verdict !== 'HARD_BLOCK' && greyCompanyHits.length > 0 && isArbitrationEnabled()) {
    const verdictRaw = await arbitrateGreyZone({
      intent: input.intent,
      toolName: input.toolName,
      greyHits: greyCompanyHits,
    });
    if (verdictRaw) {
      arbitration = {
        verdict: verdictRaw.verdict,
        rationale: verdictRaw.rationale,
        memoryIds: greyCompanyHits.map((h) => h.mem.id),
      };
      if (verdictRaw.verdict !== verdict) {
        reasons.push(
          `灰区 LLM 仲裁: ${verdict} → ${verdictRaw.verdict} (${verdictRaw.rationale || '无理由'})`,
        );
        verdict = verdictRaw.verdict;
        // 仲裁升级到 HARD_BLOCK 的公司级违规 → 强制人工确认
        if (verdict === 'HARD_BLOCK') requireHumanConfirm = true;
      } else {
        reasons.push(`灰区 LLM 仲裁: 维持 ${verdict} (${verdictRaw.rationale || '无理由'})`);
      }
    }
  }

  // 构造注入上下文
  const contextToInject =
    verdict === 'PASS'
      ? ''
      : [
          '【组织记忆基线 · 必须遵守】',
          ...scored.slice(0, 5).map(
            (s, i) =>
              `${i + 1}. [${ownerLabel(s.mem.ownershipLevel)}] ${s.mem.title}\n   ${(s.mem.body ?? '').slice(0, 200)}`,
          ),
          '【约束】偏离以上记忆需明确说明理由; 涉及战略/红线的禁止自主决策, 转人工.',
        ].join('\n');

  const decision: BaselineDecision = {
    verdict,
    hits: scored.map(({ mem, sim }) => ({
      memoryId: mem.id,
      title: mem.title,
      ownershipLevel: mem.ownershipLevel,
      similarity: Math.round(sim * 100) / 100,
      reason: sim >= hardBlockThreshold ? 'high-similarity' : 'related',
    })),
    reasons,
    contextToInject,
    requireHumanConfirm,
    highestHitLevel,
    checkId,
    arbitration,
  };

  // 留痕 (用于审计 + 后续训练)
  await persistAudit(input, decision);

  if (verdict === 'HARD_BLOCK') {
    logger.warn({ checkId, actor: input.actorUserId, intent: input.intent, hits: decision.hits.length }, '[baseline-guard] HARD_BLOCK');
  } else if (verdict === 'SOFT_WARN') {
    logger.info({ checkId, actor: input.actorUserId, hits: decision.hits.length }, '[baseline-guard] SOFT_WARN');
  }

  return decision;
}

function ownerWeight(level: MemoryEntry['ownershipLevel']): number {
  return { personal: 0, team: 1, department: 2, company: 3 }[level];
}

function ownerLabel(level: MemoryEntry['ownershipLevel']): string {
  return { personal: '个人', team: '团队', department: '部门', company: '公司级' }[level];
}

async function persistAudit(input: BaselineCheckInput, decision: BaselineDecision): Promise<void> {
  try {
    // 用 KvStore 通用层落盘 (后续可独立强类型)
    const store = getStore();
    await (store as unknown as { _baselineAuditRepo?: { create: (d: unknown) => Promise<unknown> } })._baselineAuditRepo?.create?.({
      id: decision.checkId,
      actorUserId: input.actorUserId,
      agentKind: input.agentKind,
      toolName: input.toolName ?? null,
      intent: input.intent.slice(0, 1000),
      verdict: decision.verdict,
      hitsCount: decision.hits.length,
      hitMemoryIds: decision.hits.map((h) => h.memoryId),
      reasons: decision.reasons,
      requireHumanConfirm: decision.requireHumanConfirm,
      arbitrationVerdict: decision.arbitration?.verdict ?? null,
      arbitrationRationale: decision.arbitration?.rationale ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // 审计失败不阻塞业务
  }
}
