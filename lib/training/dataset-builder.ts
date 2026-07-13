/**
 * CA-11 L2 · 训练数据集构建器 (组织 IQ 语料导出)
 *
 * 把散在 `CompanyBrainDecision` (决策即数据 · CA-13 飞轮) 里的 adopt/veto 信号,
 * 固化成可训练语料 — SFT (监督微调) + DPO (偏好对) — 作为 CA-11 "组织 IQ 蒸馏到
 * 本地模型" 的地基 (L2)。纯导出, 无 GPU, 只读, best-effort。
 *
 * §信号映射 (只取显式反馈, 隐式默许默认剔除, 与反思循环调阈值同纪律):
 *   - outcome=adopted            → SFT 正样本 (prompt=inputSummary, completion=outputSummary)
 *   - outcome=modified/overruled 且有 correctedOutput
 *       → SFT 正样本 (completion=correctedOutput, 学正确答案)
 *       → DPO 偏好对 (chosen=correctedOutput, rejected=outputSummary)
 *   - outcome=pending/ignored / 无 correctedOutput 的 overruled → 跳过 (无可学正样本)
 *
 * §决策防火墙: `CompanyBrainDecision` 本身是组织级 (中央 AI 判决), 归 organizational。
 *   reflexion 个人教训 (type=lesson, ownershipLevel=personal) 仅在 includeReflexionLessons
 *   显式开启时导出, 且**独立标 ownershipLevel='personal'**, 绝不静默混入组织语料 —
 *   下游训练可据 meta.ownershipLevel 拆分, 个人语料不得进组织模型权重。
 */

import type {
  CompanyBrainDecisionContext,
} from '@/lib/types/company-brain';
import { listDecisions } from '@/lib/persona/company-brain-decision';
import { getStore } from '@/lib/storage/repository';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SftExample {
  messages: ChatTurn[];
  meta: {
    source: 'company_brain_decision' | 'reflexion_lesson';
    ownershipLevel: 'organizational' | 'personal';
    signal: 'adopted' | 'corrected' | 'lesson';
    refId?: string;
    context?: string;
    outcome?: string;
    brainVersion?: number;
  };
}

export interface DpoExample {
  prompt: string;
  chosen: string;
  rejected: string;
  meta: {
    refId: string;
    context: CompanyBrainDecisionContext | string;
    outcome: string;
    reason?: string;
    brainVersion: number;
  };
}

export interface DatasetStats {
  totalDecisions: number;
  usableDecided: number;
  sftFromAdopted: number;
  sftFromCorrection: number;
  dpoPairs: number;
  skippedImplicit: number;
  skippedPendingOrIgnored: number;
  skippedNoSignal: number;
  reflexionLessons: number;
}

export interface DatasetBuildResult {
  sft: SftExample[];
  dpo: DpoExample[];
  stats: DatasetStats;
}

export interface BuildDatasetOptions {
  tenantId?: string;
  /** 只取 createdAt ≥ since 的决策 (UTC ISO) */
  since?: string;
  /** 最多扫描多少条决策 (默认 5000) */
  limit?: number;
  /**
   * 是否纳入隐式默许 (feedbackSource='implicit') 样本. 默认 false —
   * 隐式默许低置信, 与反思循环调阈值同纪律, 不当训练正样本以免带偏.
   */
  includeImplicit?: boolean;
  /**
   * 是否导出 reflexion 个人教训 (ownershipLevel=personal). 默认 false.
   * 开启时独立标 personal, 下游须据 meta.ownershipLevel 拆分 (决策防火墙).
   */
  includeReflexionLessons?: boolean;
  /** 过滤过短 IO (默认 8 字符) */
  minChars?: number;
}

const DEFAULT_SCAN_LIMIT = 5000;
const DEFAULT_MIN_CHARS = 8;

/**
 * 构建训练数据集 (SFT + DPO). 只读, 永不抛错前先做防御性 trim/过滤.
 */
export async function buildTrainingDataset(
  opts: BuildDatasetOptions = {},
): Promise<DatasetBuildResult> {
  const minChars = opts.minChars ?? DEFAULT_MIN_CHARS;
  const includeImplicit = opts.includeImplicit ?? false;

  const decisions = await listDecisions({
    tenantId: opts.tenantId,
    since: opts.since,
    limit: opts.limit ?? DEFAULT_SCAN_LIMIT,
  });

  const sft: SftExample[] = [];
  const dpo: DpoExample[] = [];
  const stats: DatasetStats = {
    totalDecisions: decisions.length,
    usableDecided: 0,
    sftFromAdopted: 0,
    sftFromCorrection: 0,
    dpoPairs: 0,
    skippedImplicit: 0,
    skippedPendingOrIgnored: 0,
    skippedNoSignal: 0,
    reflexionLessons: 0,
  };

  for (const d of decisions) {
    const fb = d.feedback;
    const outcome = fb.outcome;

    // 无学习信号: 待反馈 / 无声忽略
    if (outcome === 'pending' || outcome === 'ignored') {
      stats.skippedPendingOrIgnored++;
      continue;
    }

    // 隐式默许剔除 (低置信, 默认不进语料)
    if (fb.feedbackSource === 'implicit' && !includeImplicit) {
      stats.skippedImplicit++;
      continue;
    }

    const prompt = (d.inputSummary ?? '').trim();
    const aiAnswer = (d.outputSummary ?? '').trim();
    const corrected = (fb.correctedOutput ?? '').trim();

    if (prompt.length < minChars) {
      stats.skippedNoSignal++;
      continue;
    }

    stats.usableDecided++;

    if (outcome === 'adopted') {
      if (aiAnswer.length >= minChars) {
        sft.push({
          messages: [
            { role: 'user', content: prompt },
            { role: 'assistant', content: aiAnswer },
          ],
          meta: {
            source: 'company_brain_decision',
            ownershipLevel: 'organizational',
            signal: 'adopted',
            refId: d.refId,
            context: d.context,
            outcome,
            brainVersion: d.brainVersion,
          },
        });
        stats.sftFromAdopted++;
      } else {
        stats.skippedNoSignal++;
      }
      continue;
    }

    // modified / overruled: 只有拿到 correctedOutput 才有可学的正样本
    if (corrected.length >= minChars) {
      sft.push({
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: corrected },
        ],
        meta: {
          source: 'company_brain_decision',
          ownershipLevel: 'organizational',
          signal: 'corrected',
          refId: d.refId,
          context: d.context,
          outcome,
          brainVersion: d.brainVersion,
        },
      });
      stats.sftFromCorrection++;

      // 有被否/被改的原答案且与更正不同 → 构成偏好对
      if (aiAnswer.length >= minChars && aiAnswer !== corrected) {
        dpo.push({
          prompt,
          chosen: corrected,
          rejected: aiAnswer,
          meta: {
            refId: d.refId ?? d.id,
            context: d.context,
            outcome,
            reason: fb.reason,
            brainVersion: d.brainVersion,
          },
        });
        stats.dpoPairs++;
      }
    } else {
      // 被否但没给正确答案 = 只知错不知对, 无正样本可学
      stats.skippedNoSignal++;
    }
  }

  // ── reflexion 个人教训 (opt-in, 独立 personal split, 决策防火墙) ──────────
  if (opts.includeReflexionLessons) {
    try {
      const store = getStore();
      const all = await store.memories.list();
      const lessons = all.filter(
        (m) =>
          m.type === 'lesson' &&
          m.kind === 'episodic' &&
          m.ownershipLevel === 'personal' &&
          m.status === 'active',
      );
      for (const m of lessons) {
        const body = (m.body ?? '').trim();
        const title = (m.title ?? '').trim();
        if (body.length < minChars) continue;
        sft.push({
          messages: [
            { role: 'user', content: title || '复盘这次决策, 我该记住什么教训?' },
            { role: 'assistant', content: body },
          ],
          meta: {
            source: 'reflexion_lesson',
            ownershipLevel: 'personal',
            signal: 'lesson',
            refId: m.id,
          },
        });
        stats.reflexionLessons++;
      }
    } catch {
      /* best-effort: 教训导出失败不影响组织语料 */
    }
  }

  return { sft, dpo, stats };
}

/** SFT 语料序列化为 JSONL (每行一个 {messages}). */
export function sftToJsonl(examples: SftExample[]): string {
  return examples.map((e) => JSON.stringify({ messages: e.messages })).join('\n');
}

/** DPO 语料序列化为 JSONL (每行一个 {prompt, chosen, rejected}). */
export function dpoToJsonl(examples: DpoExample[]): string {
  return examples
    .map((e) => JSON.stringify({ prompt: e.prompt, chosen: e.chosen, rejected: e.rejected }))
    .join('\n');
}
