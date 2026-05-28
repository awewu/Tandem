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
// 主入口
// ---------------------------------------------------------------------------

const HARD_BLOCK_SIM_THRESHOLD = 0.45; // 与 company-level memory 高相似度 → 强偏离
const SOFT_WARN_SIM_THRESHOLD = 0.2;
const TOP_K = 8;

export async function checkBaseline(input: BaselineCheckInput): Promise<BaselineDecision> {
  const checkId = `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const store = getStore();
  const allMems = await store.memories.list();

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
        .filter((x) => x.sim >= SOFT_WARN_SIM_THRESHOLD)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, TOP_K);
    }
  }
  if (scored.length === 0) {
    const intentTokens = tokenize(intentText);
    scored = visible
      .map((m) => ({ mem: m, sim: jaccardSim(intentTokens, tokenize(`${m.title} ${m.body}`)) }))
      .filter((x) => x.sim >= SOFT_WARN_SIM_THRESHOLD)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);
  }

  // 判定
  let verdict: BaselineVerdict = 'PASS';
  const reasons: string[] = [];
  let highestHitLevel: MemoryEntry['ownershipLevel'] | undefined;
  let requireHumanConfirm = false;

  for (const { mem, sim } of scored) {
    const level = mem.ownershipLevel;
    if (!highestHitLevel || ownerWeight(level) > ownerWeight(highestHitLevel)) {
      highestHitLevel = level;
    }
    // company-level + 高相似度 → HARD_BLOCK (战略红线)
    if (level === 'company' && sim >= HARD_BLOCK_SIM_THRESHOLD) {
      verdict = 'HARD_BLOCK';
      reasons.push(`命中公司级记忆"${mem.title}" (相似度 ${sim.toFixed(2)}), 视为战略红线偏离`);
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
      reason: sim >= HARD_BLOCK_SIM_THRESHOLD ? 'high-similarity' : 'related',
    })),
    reasons,
    contextToInject,
    requireHumanConfirm,
    highestHitLevel,
    checkId,
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
      createdAt: new Date().toISOString(),
    });
  } catch {
    // 审计失败不阻塞业务
  }
}
