/**
 * #11 学习归因 · hindsight 因果归因 pass (P0 · 2026-07-20)
 *
 * 把中央 AI 的**参谋输出**与 KR 真实进度 delta 关联, 回答"这条建议是否带来了改善"。
 * MVP 主力链路: reflection 报告里被治理 **acknowledged** 的 OKR 优化提议 (承压 KR / 停滞目标),
 *   —— governance 认了 AI 的预警 → 之后该 KR/目标是否在窗口内真的改善?
 *
 * 纪律 (宪法 A + 决策防火墙):
 *   - 只读 OKR / check-in 真值 + reflection 提议; 绝不引入个人手抄/拿捏上下文。
 *   - 只产归因记录 (供治理/进化观察), 绝不改任何 OKR / 配置 / 成为 proposer。
 *   - 永不抛错 (best-effort)。
 *   - 因果免责: KR 受多因素影响, 这是**相关信号**非严格因果; LLM 诊断标注为观察。
 */

import type { AttributionSummary, AttributionVerdict, EvalAttribution } from '@/lib/types/eval';
import type { CheckIn } from '@/lib/types/okr-tti';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { computeKRProgress, effectiveObjectiveProgress } from '@/lib/types/okr-tti';

/** 改善阈值: delta ≥ +5pt → positive; ≤ −2pt → negative; 其余 neutral */
const POSITIVE_DELTA = 0.05;
const NEGATIVE_DELTA = -0.02;

export interface RunAttributionInput {
  windowDays?: number;
  tenantId?: string;
  /** 是否对 positive/negative 归因补一句 LLM 诊断 (best-effort, 默认 false 省成本) */
  enrichWithLlm?: boolean;
}

function genId(): string {
  return `eva_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function classify(delta: number, hasData: boolean): AttributionVerdict {
  if (!hasData) return 'insufficient_data';
  if (delta >= POSITIVE_DELTA) return 'positive';
  if (delta <= NEGATIVE_DELTA) return 'negative';
  return 'neutral';
}

/**
 * 跑一次归因 pass。返回汇总; 明细落 evalAttributions 仓。
 * 幂等: 同 (decisionId + targetId + windowDays) 不重复落。
 */
export async function runAttributionPass(input: RunAttributionInput = {}): Promise<AttributionSummary> {
  const windowDays = input.windowDays ?? 30;
  const tenantId = input.tenantId ?? 'default';
  const summary: AttributionSummary = {
    windowDays,
    samples: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    insufficient: 0,
    generatedAt: new Date().toISOString(),
  };

  try {
    const store = getStore();
    const [reports, existingAttribs, checkIns, krs, objectives] = await Promise.all([
      store.companyBrainReflections.list(),
      store.evalAttributions.list(),
      store.checkIns.list(),
      store.keyResults.list(),
      store.objectives.list(),
    ]);

    const existingKeys = new Set(
      existingAttribs.map((a) => `${a.decisionId}:${a.targetId}:${a.windowDays}`),
    );
    const krById = new Map(krs.map((k) => [k.id, k]));
    const objById = new Map(objectives.map((o) => [o.id, o]));
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const pendingLlm: EvalAttribution[] = [];

    for (const report of reports) {
      if (report.tenantId !== tenantId) continue;
      const proposals = report.optimizationProposals ?? [];
      const decisionTime = new Date(report.createdAt).getTime();
      const windowEnd = decisionTime + windowMs;

      for (const p of proposals) {
        // 只归因: 被治理认可的 OKR 承压提议 (governance 采纳了 AI 的预警)
        if (p.status !== 'acknowledged') continue;
        if (p.targetType !== 'key_result' && p.targetType !== 'objective') continue;
        const key = `${p.id}:${p.targetId}:${windowDays}`;
        if (existingKeys.has(key)) continue;

        // 决策后窗口内、该对象的 check-in (按时间升序)
        const scope = p.targetType === 'key_result' ? 'kr' : 'objective';
        const inWindow = checkIns
          .filter(
            (c) =>
              c.scope === scope &&
              c.scopeId === p.targetId &&
              new Date(c.createdAt).getTime() >= decisionTime &&
              new Date(c.createdAt).getTime() <= windowEnd,
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        // 当前对象进度 (无 check-in 时的兜底)
        const currentProgress =
          p.targetType === 'key_result'
            ? krById.has(p.targetId)
              ? computeKRProgress(krById.get(p.targetId)!)
              : 0
            : objById.has(p.targetId)
              ? effectiveObjectiveProgress(objById.get(p.targetId)!)
              : 0;

        const hasData = inWindow.length > 0;
        const progressBefore = hasData ? inWindow[0].progressBefore : currentProgress;
        const progressAfter = hasData ? inWindow[inWindow.length - 1].progressAfter : currentProgress;
        const progressDelta = progressAfter - progressBefore;
        const verdict = classify(progressDelta, hasData);

        const attrib: EvalAttribution = {
          id: genId(),
          tenantId,
          sourceType: 'okr_proposal',
          decisionId: p.id,
          sourceReportId: report.id,
          targetType: p.targetType,
          targetId: p.targetId,
          adoptedOutcome: 'acknowledged',
          windowDays,
          progressBefore,
          progressAfter,
          progressDelta,
          verdict,
          createdAt: new Date().toISOString(),
        };

        await store.evalAttributions.create(attrib);
        existingKeys.add(key);
        summary.samples += 1;
        if (verdict === 'positive') summary.positive += 1;
        else if (verdict === 'negative') summary.negative += 1;
        else if (verdict === 'neutral') summary.neutral += 1;
        else summary.insufficient += 1;

        if (input.enrichWithLlm && (verdict === 'positive' || verdict === 'negative')) {
          pendingLlm.push(attrib);
        }
      }
    }

    // best-effort LLM 诊断 (只对已落库的 positive/negative 补一句, 失败不影响汇总)
    if (pendingLlm.length > 0) {
      await enrichAttributionDiagnoses(pendingLlm, checkIns, windowDays);
    }

    if (summary.samples > 0) {
      logger.info({ ...summary }, '[attribution] pass done');
    }
    return summary;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[attribution] pass failed (fail-soft)');
    return summary;
  }
}

/** 列归因记录 (admin 看板用) */
export async function listAttributions(opts: {
  tenantId?: string;
  verdict?: AttributionVerdict;
  limit?: number;
} = {}): Promise<EvalAttribution[]> {
  try {
    const store = getStore();
    const all = await store.evalAttributions.list();
    let out = all;
    if (opts.tenantId) out = out.filter((a) => a.tenantId === opts.tenantId);
    if (opts.verdict) out = out.filter((a) => a.verdict === opts.verdict);
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out.slice(0, opts.limit ?? 100);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[attribution] list failed');
    return [];
  }
}

/**
 * best-effort: 给 positive/negative 归因补一句 hindsight 诊断 (读窗口内 blockers/nextSteps)。
 * 单次 LLM 批量调用; 失败保持 llmDiagnosis 空。
 */
async function enrichAttributionDiagnoses(
  attribs: EvalAttribution[],
  checkIns: CheckIn[],
  windowDays: number,
): Promise<void> {
  try {
    const payload = attribs.map((a) => {
      const scope = a.targetType === 'key_result' ? 'kr' : 'objective';
      const signals = checkIns
        .filter((c) => c.scope === scope && c.scopeId === a.targetId)
        .flatMap((c) => [c.blockers, c.nextSteps])
        .filter((t): t is string => !!t && t.trim().length > 0)
        .slice(0, 6);
      return {
        id: a.decisionId,
        verdict: a.verdict,
        progressDelta: Math.round(a.progressDelta * 100),
        signals,
      };
    });
    if (payload.every((p) => p.signals.length === 0)) return;

    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const system =
      '你是企业 OKR 归因分析官。给定每条"被采纳的 AI 预警 + 之后 KR 进度变化 + check-in 信号", ' +
      `为每条写一句 ≤60 字中文 hindsight 诊断 (为什么改善/停滞, 相关性非因果断言, 近 ${windowDays} 天窗口)。` +
      '只输出 JSON: {"diagnoses":[{"id":"...","diagnosis":"..."}]}。';
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 归因分析只读只记 (宪法A), actor='__company__'
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `归因输入 (JSON):\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 700,
    });
    const content =
      typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return;
    const parsed = JSON.parse(m[0]) as { diagnoses?: Array<{ id?: unknown; diagnosis?: unknown }> };
    if (!Array.isArray(parsed.diagnoses)) return;
    const byId = new Map<string, string>();
    for (const d of parsed.diagnoses) {
      if (typeof d.id === 'string' && typeof d.diagnosis === 'string' && d.diagnosis.trim()) {
        byId.set(d.id, d.diagnosis.trim());
      }
    }
    const store = getStore();
    for (const a of attribs) {
      const diag = byId.get(a.decisionId);
      if (diag) await store.evalAttributions.update(a.id, { llmDiagnosis: diag });
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[attribution] llm diagnosis failed');
  }
}
