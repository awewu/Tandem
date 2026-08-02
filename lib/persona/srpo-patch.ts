/**
 * lib/persona/srpo-patch.ts · P0-5 SRPO 反思补丁 (negative signal → 修正策略 → 检索复用)
 *
 * 前沿 (SRPO · Self-Reflection Policy Optimization): 情景级反思只"记录"负面信号还不够 —
 * 关键是把它转成**可复用的修正策略** (correction patch): "下次遇到类似情况, 应该改成 X"。
 * 再在未来相似 query 到来时**检索复用**这些补丁, 注入 system prompt, 形成闭环学习。
 *
 * 与 company-brain-reflection.ts 的分工:
 *   - episodic reflection = 记录单次负面信号 (overruled/投诉/护栏拦截)。
 *   - SRPO patch (本文件)  = 从负面信号**提炼修正策略** + **检索复用**。
 *
 * 数据: 新 KvStore 仓 correctionPatches (零 DDL, DrizzleKvRepository 自动建表)。
 * 纪律: LLM best-effort fail-soft; 补丁只注入 prompt (软引导), 不改任何治理/真值 (宪法 A)。
 */

import type { EpisodicReflection } from './company-brain-reflection';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

const NEGATIVE_SIGNALS: EpisodicReflection['signal'][] = [
  'overruled',
  'negative_feedback',
  'user_complaint',
  'guardrail_block',
];

export interface CorrectionPatch {
  id: string; // srpo_...
  tenantId: string;
  /** 触发场景 (im_reply / boss_ai / decision / perception ...) */
  context: string;
  /** 关键词 (从原 query 提取, 用于检索匹配) */
  keywords: string[];
  /** 原始负面情形一句话 */
  situation: string;
  /** 修正策略: 下次遇到类似情况应该怎么做 (≤120 字) */
  strategy: string;
  /** 来源 episodic reflection id */
  sourceEpisodicId: string;
  /** 命中复用次数 (检索时 +1, 反映补丁价值) */
  hitCount: number;
  createdAt: string;
}

/** 从中文/英文文本提取关键词 (去停用词, 取较长 token)。纯确定性, 无 LLM。 */
export function extractKeywords(text: string, max = 8): string[] {
  const cleaned = (text ?? '')
    .toLowerCase()
    .replace(/[，。！？、；：""''（）()[\]{}<>/\\|@#$%^&*=+~`]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  // 中文按 2-gram 也补充 (简单切分: 连续中文串取整段 + 前 2 字)
  const cjk = (text ?? '').match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const all = [...tokens, ...cjk];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of all) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 从一条负面 episodic reflection 提炼修正策略并落库。
 * 非负面信号 → 跳过返回 null。LLM 失败 → 用 note/规则兜底 (仍落一条最小补丁)。
 */
export async function generateCorrectionPatch(
  reflection: EpisodicReflection,
  useLlm = true,
): Promise<CorrectionPatch | null> {
  if (!NEGATIVE_SIGNALS.includes(reflection.signal)) return null;
  try {
    const store = getStore();
    const keywords = extractKeywords(`${reflection.query} ${reflection.note ?? ''}`);

    let strategy = reflection.note?.slice(0, 120) ?? '';
    if (useLlm) {
      try {
        const { getRouter } = await import('@/lib/boot');
        const router = getRouter();
        const system =
          '你是 AI 自我改进策略官。给定一次被否决/投诉/拦截的 AI 应答情形, ' +
          '提炼一条**可复用的修正策略**: 下次遇到类似情况应该怎么做才对 (具体、可操作、≤120字)。' +
          '只输出 JSON: {"situation":"≤60字情形","strategy":"≤120字修正策略"}。';
        const payload = {
          context: reflection.context,
          signal: reflection.signal,
          query: reflection.query,
          aiResponse: reflection.responseSummary,
          humanNote: reflection.note ?? '',
        };
        // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: SRPO 反思只读只记, 补丁仅注入 prompt (宪法A)
        const reply = await router.chat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `情形 (JSON):\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` },
          ],
          scenario: 'reasoning_complex',
          maxTokens: 250,
          metadata: { userId: '__srpo__', feature: 'srpo_patch' },
        });
        const content = typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
        const m = content.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as { situation?: unknown; strategy?: unknown };
          if (typeof parsed.strategy === 'string' && parsed.strategy.trim()) {
            strategy = parsed.strategy.slice(0, 120);
          }
          const situation = typeof parsed.situation === 'string' ? parsed.situation.slice(0, 60) : reflection.query.slice(0, 60);
          const patch = await persistPatch(store, reflection, keywords, situation, strategy);
          return patch;
        }
      } catch (err) {
        logger.warn({ err: (err as Error).message }, '[srpo] llm patch generation failed, using fallback');
      }
    }

    // 兜底 (无 LLM 或解析失败): 用 note/query 生成最小补丁
    if (!strategy.trim()) {
      strategy = `避免重复 "${reflection.responseSummary.slice(0, 60)}" 这类被${signalLabel(reflection.signal)}的应答。`;
    }
    return await persistPatch(store, reflection, keywords, reflection.query.slice(0, 60), strategy);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[srpo] generateCorrectionPatch failed (fail-soft)');
    return null;
  }
}

function signalLabel(signal: EpisodicReflection['signal']): string {
  switch (signal) {
    case 'overruled': return '否决';
    case 'negative_feedback': return '差评';
    case 'user_complaint': return '投诉';
    case 'guardrail_block': return '护栏拦截';
    default: return '负反馈';
  }
}

async function persistPatch(
  store: ReturnType<typeof getStore>,
  reflection: EpisodicReflection,
  keywords: string[],
  situation: string,
  strategy: string,
): Promise<CorrectionPatch> {
  const patch: CorrectionPatch = {
    id: `srpo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: reflection.tenantId,
    context: reflection.context,
    keywords,
    situation,
    strategy,
    sourceEpisodicId: reflection.id,
    hitCount: 0,
    createdAt: new Date().toISOString(),
  };
  await store.correctionPatches.create(patch);
  logger.info({ id: patch.id, context: patch.context, keywords }, '[srpo] correction patch generated');
  return patch;
}

/**
 * P0-5 检索复用: 给定即将处理的 query + context, 检索相关修正策略。
 * 确定性关键词重叠打分 (无 LLM, 零成本), 返回 topN 补丁。命中的补丁 hitCount +1。
 */
export async function retrieveCorrectionPatches(
  query: string,
  opts: { tenantId?: string; context?: string; topN?: number; minOverlap?: number } = {},
): Promise<CorrectionPatch[]> {
  const tenantId = opts.tenantId ?? 'default';
  const topN = opts.topN ?? 3;
  const minOverlap = opts.minOverlap ?? 1;
  try {
    const store = getStore();
    const all = (await store.correctionPatches.list()) as CorrectionPatch[];
    const qk = new Set(extractKeywords(query, 12));
    const scored = all
      .filter((p) => p.tenantId === tenantId && (!opts.context || p.context === opts.context))
      .map((p) => {
        const overlap = p.keywords.filter((k) => qk.has(k)).length;
        return { patch: p, overlap };
      })
      .filter((s) => s.overlap >= minOverlap)
      .sort((a, b) => b.overlap - a.overlap || b.patch.createdAt.localeCompare(a.patch.createdAt))
      .slice(0, topN);

    // 命中 hitCount +1 (best-effort, 不阻塞)
    for (const s of scored) {
      void store.correctionPatches
        .update(s.patch.id, { hitCount: s.patch.hitCount + 1 })
        .catch(() => {});
    }
    return scored.map((s) => s.patch);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[srpo] retrieveCorrectionPatches failed');
    return [];
  }
}

/**
 * 把检索到的修正策略拼成一段可注入 system prompt 的文本。无补丁 → 空串 (调用方零变化)。
 */
export function buildCorrectionPromptBlock(patches: CorrectionPatch[]): string {
  if (patches.length === 0) return '';
  const lines = patches.map((p, i) => `${i + 1}. [${p.context}] 情形: ${p.situation} → 修正: ${p.strategy}`);
  return `\n\n【历史修正经验 (来自过往被否决/投诉的教训, 请据此改进本次应答)】\n${lines.join('\n')}`;
}
