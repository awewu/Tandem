/**
 * Output Guard · 输出矫正镜片 (中央 AI / 分身回答后置闸)
 *
 * 设计哲学:
 *   "中央 AI 可以调用公开数据让自己不傻, 但答案给员工前必须经过公司 Memory + 红线 + OKR
 *    矫正镜片. 锁死知识库升级 — AI 不能自己写 Memory, 只能被基线约束."
 *
 * 与 baseline-guard 的区别:
 *   - baseline-guard: 检查 INPUT (intent 意图), 决定是否允许调用
 *   - output-guard:    检查 OUTPUT (LLM 答案), 决定是否需要矫正/拒交
 *
 * 三级处置:
 *   - PASS          → 原样交付
 *   - SOFT_DRIFT    → 附加脚注提示偏离, 但允许交付
 *   - HARD_CONFLICT → 让 LLM 用 revisionPrompt 重写一次; 仍冲突 → 拒交
 *
 * Fail-soft: judge LLM 失败 → PASS + 告警, 不阻断业务路径.
 * 关闭开关: OUTPUT_GUARD_ENABLED=0 → 全部 PASS (性能压测 / 紧急 bypass).
 */

import type { MemoryEntry } from '@/lib/types/memory';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { audit } from '@/lib/audit/log';
import { rerank } from '@/lib/memory/reranker';

export type OutputVerdict = 'PASS' | 'SOFT_DRIFT' | 'HARD_CONFLICT';

export interface OutputGuardInput {
  /** 员工原始提问 (上下文) */
  query: string;
  /** 中央 AI / 分身的最终回答 (待审) */
  response: string;
  /** 调用方 userId (审计) */
  actorUserId: string;
  /** 出口标识: 'company_brain_im' / 'company_brain_boss' / 'persona_train' 等 */
  source: string;
  /** ref id (im message / boss session 等), 用于审计追踪 */
  refId?: string;
}

export interface OutputGuardHit {
  memoryId: string;
  title: string;
  conflict: string;
}

export interface OutputGuardDecision {
  verdict: OutputVerdict;
  hits: OutputGuardHit[];
  reasons: string[];
  /** HARD_CONFLICT 时, 给 LLM 重写用的提示词 */
  revisionPrompt?: string;
  /** SOFT_DRIFT 时, 附加在回答末尾的脚注 */
  footnote?: string;
  checkId: string;
  latencyMs: number;
}

const TOP_K_MEMORIES = 8;
const MIN_RESPONSE_LENGTH = 20;
const ENABLED = process.env.OUTPUT_GUARD_ENABLED !== '0';

/**
 * 审核 LLM 输出是否与公司 Memory 基线冲突. 详见模块顶部说明.
 */
export async function checkOutput(input: OutputGuardInput): Promise<OutputGuardDecision> {
  const t0 = Date.now();
  const checkId = `og_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const baseDecision = (
    verdict: OutputVerdict,
    extra: Partial<OutputGuardDecision> = {},
  ): OutputGuardDecision => ({
    verdict,
    hits: [],
    reasons: [],
    checkId,
    latencyMs: Date.now() - t0,
    ...extra,
  });

  if (!ENABLED) {
    return baseDecision('PASS', { reasons: ['guard disabled via OUTPUT_GUARD_ENABLED=0'] });
  }

  const trimmedResponse = input.response.trim();
  if (trimmedResponse.length < MIN_RESPONSE_LENGTH) {
    return baseDecision('PASS', { reasons: ['response too short to need check'] });
  }

  // P1 下推: 走 KvStore_memory_ownershipLevel/status partial 索引 (0007).
  const store = getStore();
  const company = await store.memories.list({
    ownershipLevel: 'company',
    status: 'active',
  } as Partial<MemoryEntry>);
  if (company.length === 0) {
    return baseDecision('PASS', { reasons: ['no company-level memories to check against'] });
  }

  const rerankQuery = `${input.query}\n\n回答: ${trimmedResponse}`;
  const top: MemoryEntry[] = rerank(
    rerankQuery,
    company.map((m) => ({ memory: m })),
    { topK: TOP_K_MEMORIES },
  ).map((r) => r.memory);

  let verdict: OutputVerdict = 'PASS';
  const hits: OutputGuardHit[] = [];
  const reasons: string[] = [];
  let suggestedRevision: string | undefined;

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();

    const memoriesText = top
      .map(
        (m, i) =>
          `[M${i + 1}] (${m.type}/${m.kind ?? 'auto'}) ${m.title}\n${(m.body ?? '').slice(0, 400)}`,
      )
      .join('\n\n---\n\n');

    const systemPrompt = [
      '你是 Tandem 的"输出矫正镜片". 审核中央 AI 给员工的回答是否与公司 Memory (基线知识/红线/价值观) 冲突.',
      '',
      '判定标准:',
      '- HARD_CONFLICT: 回答直接违反公司红线, 或与公司 Memory 关键事实/立场明显矛盾 → 必须改写或拒交',
      '- SOFT_DRIFT:    回答未引用任何相关 Memory, 或部分偏离但未矛盾 → 加脚注提醒',
      '- PASS:          回答与 Memory 一致, 或与所有 Memory 无关',
      '',
      '只输出 JSON, 严格 schema:',
      '{',
      '  "verdict": "PASS" | "SOFT_DRIFT" | "HARD_CONFLICT",',
      '  "conflicts": [{"memoryRef": "M1", "conflict": "<简述冲突点>"}],',
      '  "suggestedRevision": "<若 HARD_CONFLICT, 一句话改写指引; 否则空字符串>"',
      '}',
    ].join('\n');

    const userPrompt = [
      '## 员工提问',
      input.query,
      '',
      '## 中央 AI 回答',
      trimmedResponse,
      '',
      `## 相关公司 Memory (top ${top.length})`,
      memoriesText,
      '',
      '判定:',
    ].join('\n');

    const res = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      scenario: 'high_frequency',
      temperature: 0.1,
      maxTokens: 500,
      responseFormat: 'json',
    });

    const rawContent = res.message.content;
    const content = typeof rawContent === 'string' ? rawContent : '{}';
    const judged = JSON.parse(content) as {
      verdict?: string;
      conflicts?: Array<{ memoryRef?: string; conflict?: string }>;
      suggestedRevision?: string;
    };

    const v = judged.verdict;
    if (v === 'HARD_CONFLICT' || v === 'SOFT_DRIFT') {
      verdict = v;
      const conflicts = judged.conflicts ?? [];
      for (const c of conflicts) {
        const ref = (c.memoryRef ?? '').replace('M', '');
        const idx = parseInt(ref, 10) - 1;
        if (idx >= 0 && idx < top.length && c.conflict) {
          hits.push({
            memoryId: top[idx].id,
            title: top[idx].title,
            conflict: c.conflict,
          });
        }
      }
      for (const h of hits) {
        reasons.push(`[${h.title}] ${h.conflict}`);
      }
      if (typeof judged.suggestedRevision === 'string' && judged.suggestedRevision.trim()) {
        suggestedRevision = judged.suggestedRevision.trim();
      }
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: input.source },
      '[output-guard] judge failed (fail-soft → PASS)',
    );
    reasons.push(`judge failed: ${(err as Error).message}`);
    verdict = 'PASS';
  }

  await audit('output_guard.checked', input.actorUserId, {
    targetId: input.refId,
    targetType: input.source,
    metadata: {
      verdict,
      hits: hits.length,
      checkId,
      source: input.source,
      latencyMs: Date.now() - t0,
    },
  }).catch(() => {
    /* audit failure shouldn't block business path */
  });

  const decision: OutputGuardDecision = {
    verdict,
    hits,
    reasons,
    checkId,
    latencyMs: Date.now() - t0,
  };

  if (verdict === 'HARD_CONFLICT') {
    const conflictLines = hits.length > 0
      ? hits.map((h) => `- [Memory: ${h.title}] ${h.conflict}`).join('\n')
      : '- (未具体定位 Memory, judge 仅给出整体判定)';
    decision.revisionPrompt = [
      '你之前的回答与公司 Memory 存在冲突:',
      conflictLines,
      '',
      '请按以下指引重写你的回答, 明确引用相关公司 Memory:',
      suggestedRevision ?? '回答需与上述公司 Memory 立场一致, 并明确引用 (例: "根据公司 Memory \'XXX\', ...")',
    ].join('\n');
  }
  if (verdict === 'SOFT_DRIFT' && hits.length > 0) {
    decision.footnote = `\n\n_⚠️ 输出矫正提示: 与公司 Memory 「${hits.map((h) => h.title).join('、')}」存在偏离, 请以公司 Memory 为准_`;
  }

  return decision;
}
