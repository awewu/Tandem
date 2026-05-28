/**
 * §B-015 (OKR-DRIVEN §三 第 2 条) · OKR Drift Detection · 主航道偏离检测
 *
 * 灵魂层第 2 条: "整体能力提升 + 约束聚焦"
 *   - 整体能力提升: 让 AI 看到公司在追什么 (已由 buildOkrAnchorContext 实现)
 *   - 约束聚焦: 检测员工 intent / Persona 输出 / 议事内容 是否偏离公司 OKR 主航道
 *     → 偏离 → SOFT_WARN (提示, 不阻断), 写 audit, 治理委员会月审看 drift 统计
 *
 * 跟 Baseline-Guard 的关系:
 *   - Baseline-Guard 是"红线/记忆基线", 判定 PASS/SOFT/HARD_BLOCK (跟红线词的相似度)
 *   - OKR Drift 是"主航道", 仅判定 ALIGNED / DRIFT_SUSPECTED / NO_OKR
 *   - 两者独立, 都是 IM/Persona 调用前的"二闸/三闸"
 *
 * V1.5 实现:
 *   - 仅检查公司层 active Objective (level='company')
 *   - 计算 intent vs Objective.title+description 的语义相似度
 *   - max(simObjective, max(simKR)) >= ALIGNED_THRESHOLD → ALIGNED
 *   - 反之 → DRIFT_SUSPECTED
 *   - 没有 active 周期 / 没有公司层 Objective → NO_OKR (跳过)
 *
 * V2 拓展:
 *   - 加 individual Objective 检查 (员工自己的 OKR)
 *   - 引入 LLM 仲裁 (intent 是否服务于 OKR)
 *   - 跟 Decision Card anchor 联动 (议事是否锚到 KR)
 */

import type { Objective, KeyResult } from '@/lib/types/okr-tti';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { embed, cosineSim, isEmbeddingConfigured } from '@/lib/infra/embedding';
import { audit } from '@/lib/audit/log';

export type OkrDriftVerdict = 'ALIGNED' | 'DRIFT_SUSPECTED' | 'NO_OKR';

export interface OkrDriftInput {
  /** 待检测的文本: IM message body / Persona 输出 / Decision Card 议题 */
  intent: string;
  /** 触发方 (用于 audit) */
  actorUserId: string;
  /** 检测来源 (用于 audit + 统计分桶) */
  source: 'im_persona_reply' | 'company_brain_reply' | 'decision_card' | 'proxy_action' | 'manual';
  /** 关联 ID (im_message.id / decision_card.id / ...) */
  refId?: string;
  /** 租户隔离 */
  tenantId?: string;
}

export interface OkrAlignmentHit {
  /** 命中 Objective.id */
  objectiveId: string;
  objectiveTitle: string;
  /** 若命中是 KR 比 Objective 更高分, 则填该 KR id */
  keyResultId?: string;
  keyResultTitle?: string;
  /** 0-1 相似度 */
  similarity: number;
}

export interface OkrDriftDecision {
  verdict: OkrDriftVerdict;
  /** 0-1, 任意 Objective/KR 的最高相似度 */
  alignmentScore: number;
  /** 命中的 Top 3 OKR */
  hits: OkrAlignmentHit[];
  /** 人类可读原因 */
  reasons: string[];
  /** 注入下游 prompt 的上下文 (DRIFT_SUSPECTED 时填) */
  contextToInject: string;
  /** 用于审计追踪 */
  checkId: string;
  /** 检查窗口里的公司层 Objective 数 (NO_OKR 时为 0) */
  okrCount: number;
}

// V1.5 阈值: 经验值, 后续根据 audit 数据校准
const ALIGNED_THRESHOLD = 0.28;       // embedding cosine ≥ 此值 → 视为 aligned
const ALIGNED_JACCARD_THRESHOLD = 0.15; // Jaccard 兜底阈值 (更宽松, embedding 失败时)
const TOP_K = 3;

function tokenize(s: string): Set<string> {
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

function genCheckId(): string {
  return `okrdr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 检测 intent 是否偏离公司 OKR 主航道
 *
 * 永不抛错 (best-effort): 失败返回 NO_OKR + reasons, 不阻断主流程.
 */
export async function checkOkrDrift(input: OkrDriftInput): Promise<OkrDriftDecision> {
  const checkId = genCheckId();
  try {
    const store = getStore();

    // 1. 找 active 周期
    const cycles = await store.cycles.list();
    const activeCycles = cycles.filter((c) => c.isActive);
    if (activeCycles.length === 0) {
      return {
        verdict: 'NO_OKR',
        alignmentScore: 0,
        hits: [],
        reasons: ['无 active 周期, 跳过 drift 检查'],
        contextToInject: '',
        checkId,
        okrCount: 0,
      };
    }
    const cycle = activeCycles.sort((a, b) =>
      (b.startDate ?? '').localeCompare(a.startDate ?? '')
    )[0];

    // 2. 拉公司层 active Objective + KR
    const allObjectives = await store.objectives.list();
    const companyObjectives: Objective[] = allObjectives.filter(
      (o) =>
        o.cycleId === cycle.id &&
        o.level === 'company' &&
        o.status === 'active' &&
        (input.tenantId === undefined || (o.tenantId ?? 'default') === input.tenantId)
    );
    if (companyObjectives.length === 0) {
      return {
        verdict: 'NO_OKR',
        alignmentScore: 0,
        hits: [],
        reasons: ['周期内无公司层 active Objective, 跳过 drift 检查'],
        contextToInject: '',
        checkId,
        okrCount: 0,
      };
    }

    const allKRs = await store.keyResults.list();
    const krsByObjective = new Map<string, KeyResult[]>();
    for (const kr of allKRs) {
      if (kr.status !== 'active') continue;
      const arr = krsByObjective.get(kr.objectiveId) ?? [];
      arr.push(kr);
      krsByObjective.set(kr.objectiveId, arr);
    }

    // 3. 算相似度
    const intentText = input.intent.slice(0, 500); // 截断防止 embed token 爆
    let usedEmbedding = false;
    const scored: OkrAlignmentHit[] = [];

    if (isEmbeddingConfigured()) {
      const intentVec = await embed(intentText);
      if (intentVec) {
        usedEmbedding = true;
        for (const o of companyObjectives) {
          const oText = `${o.title}\n${o.description ?? ''}`;
          const oVec = await embed(oText);
          const oSim = oVec ? cosineSim(intentVec, oVec) : 0;

          // 检查 O 下的 KR
          const krs = krsByObjective.get(o.id) ?? [];
          let bestKr: KeyResult | undefined;
          let bestKrSim = 0;
          for (const kr of krs) {
            const krVec = await embed(kr.title);
            const krSim = krVec ? cosineSim(intentVec, krVec) : 0;
            if (krSim > bestKrSim) {
              bestKrSim = krSim;
              bestKr = kr;
            }
          }

          const bestSim = Math.max(oSim, bestKrSim);
          if (bestSim > 0) {
            scored.push({
              objectiveId: o.id,
              objectiveTitle: o.title,
              keyResultId: bestKrSim > oSim ? bestKr?.id : undefined,
              keyResultTitle: bestKrSim > oSim ? bestKr?.title : undefined,
              similarity: bestSim,
            });
          }
        }
      }
    }

    // 兜底: Jaccard
    if (!usedEmbedding || scored.length === 0) {
      const intentTokens = tokenize(intentText);
      for (const o of companyObjectives) {
        const oSim = jaccardSim(intentTokens, tokenize(`${o.title} ${o.description ?? ''}`));

        const krs = krsByObjective.get(o.id) ?? [];
        let bestKr: KeyResult | undefined;
        let bestKrSim = 0;
        for (const kr of krs) {
          const krSim = jaccardSim(intentTokens, tokenize(kr.title));
          if (krSim > bestKrSim) {
            bestKrSim = krSim;
            bestKr = kr;
          }
        }

        const bestSim = Math.max(oSim, bestKrSim);
        if (bestSim > 0) {
          scored.push({
            objectiveId: o.id,
            objectiveTitle: o.title,
            keyResultId: bestKrSim > oSim ? bestKr?.id : undefined,
            keyResultTitle: bestKrSim > oSim ? bestKr?.title : undefined,
            similarity: bestSim,
          });
        }
      }
    }

    // 4. 排序 + 判定
    scored.sort((a, b) => b.similarity - a.similarity);
    const topHits = scored.slice(0, TOP_K);
    const alignmentScore = topHits[0]?.similarity ?? 0;

    const threshold = usedEmbedding ? ALIGNED_THRESHOLD : ALIGNED_JACCARD_THRESHOLD;
    const aligned = alignmentScore >= threshold;
    const verdict: OkrDriftVerdict = aligned ? 'ALIGNED' : 'DRIFT_SUSPECTED';

    const reasons: string[] = [];
    if (aligned) {
      reasons.push(
        `与"${topHits[0].objectiveTitle}"对齐 (相似度 ${alignmentScore.toFixed(2)})`
      );
    } else {
      reasons.push(
        `内容与所有公司层 OKR 相似度均低于阈值 (最高 ${alignmentScore.toFixed(2)} < ${threshold})`
      );
      reasons.push(`使用算法: ${usedEmbedding ? 'embedding-cosine' : 'jaccard-fallback'}`);
    }

    const contextToInject =
      verdict === 'DRIFT_SUSPECTED'
        ? [
            '【⚠️ OKR 主航道偏离提示 · §B-015】',
            `本次输入与公司当前 ${companyObjectives.length} 个公司层 OKR 相关度低 (max ${alignmentScore.toFixed(2)}).`,
            '当前公司层 Objective:',
            ...companyObjectives.slice(0, 3).map((o, i) => `  ${i + 1}. ${o.title}`),
            '【建议】如本议题确与公司战略相关, 请显式说明关联 KR; 否则视为辅助性话题.',
          ].join('\n')
        : '';

    return {
      verdict,
      alignmentScore: Math.round(alignmentScore * 1000) / 1000,
      hits: topHits,
      reasons,
      contextToInject,
      checkId,
      okrCount: companyObjectives.length,
    };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: input.source },
      '[okr-drift] check failed, returning NO_OKR'
    );
    return {
      verdict: 'NO_OKR',
      alignmentScore: 0,
      hits: [],
      reasons: [`检测异常: ${(err as Error).message}`],
      contextToInject: '',
      checkId,
      okrCount: 0,
    };
  }
}

/**
 * 调用方拿到 OkrDriftDecision 后, 调本函数写 audit (best-effort).
 *
 * 仅 DRIFT_SUSPECTED 写 audit; ALIGNED / NO_OKR 跳过 (减少 audit 噪音).
 * 治理委员会月审通过 audit.action='governance.okr_drift_detected' 拿统计.
 */
export async function auditOkrDriftIfNeeded(
  decision: OkrDriftDecision,
  input: OkrDriftInput
): Promise<void> {
  if (decision.verdict !== 'DRIFT_SUSPECTED') return;
  try {
    await audit('governance.okr_drift_detected', input.actorUserId, {
      targetId: input.refId,
      targetType: input.source,
      tenantId: input.tenantId,
      metadata: {
        checkId: decision.checkId,
        source: input.source,
        alignmentScore: decision.alignmentScore,
        okrCount: decision.okrCount,
        topHits: decision.hits.slice(0, 3).map((h) => ({
          objectiveTitle: h.objectiveTitle,
          keyResultTitle: h.keyResultTitle,
          similarity: h.similarity,
        })),
        intentPreview: input.intent.slice(0, 120),
      },
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[okr-drift] audit failed');
  }
}

