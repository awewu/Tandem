/**
 * PMS · 跟进记录 AI 提取 (对标 销售易米其林渠道 Agent "拜访记录自动提取回填")
 *
 * 把一线随手记的非结构化文本 (语音转写 / 便签 / 微信复制) 提炼为**结构化跟进草稿**,
 * 预填到跟进表单供人确认后保存 (不自动落库 — 人是最后一道闸)。
 *
 * 纪律 (对齐 lib/pms/ai-service.ts):
 *   - LLM best-effort, 解析失败/抛错一律 fail-soft 到规则基线 (source='rule')。
 *   - 纯只读, 不写业务真值 (保存走既有 createFollowUp, 由 API/人确认后调用)。
 *   - 映射与日期归一化抽成纯函数, 便于单测 (无需真 LLM)。
 */

import { logger } from '@/lib/infra/logger';
import { extractJsonObject, toStringArray, type InsightSource } from './ai-service';

export interface FollowUpDraft {
  source: InsightSource;
  /** 跟进阶段/类型的简短标签 (如 "初次拜访" / "方案沟通" / "报价跟进") */
  stage: string;
  /** 结构化后的跟进正文 (清晰可直接入库) */
  content: string;
  /** 下次跟进日期 (ISO yyyy-mm-dd; 提取不到则空) */
  nextFollowUpAt?: string;
  /** 关键要点 bullets (供 UI 展示, 不入库主字段) */
  keyPoints: string[];
}

const MAX_RAW = 8000;

/** 规则基线: 无 LLM 时也能给出可用草稿 (原文作正文, 阶段兜底)。纯函数。 */
export function buildFollowUpBaseline(rawText: string): FollowUpDraft {
  const text = (rawText ?? '').trim();
  return {
    source: 'rule',
    stage: '跟进',
    content: text.slice(0, 2000),
    nextFollowUpAt: undefined,
    keyPoints: [],
  };
}

/** 归一化为 ISO yyyy-mm-dd; 非法/空 → undefined。纯函数。 */
export function normalizeIsoDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(dt.getTime())) return undefined;
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** 把 LLM 解析结果映射为 FollowUpDraft, 缺字段回退基线。纯函数。 */
export function mapFollowUpExtraction(
  parsed: { stage?: unknown; content?: unknown; nextFollowUpAt?: unknown; keyPoints?: unknown } | null,
  baseline: FollowUpDraft,
): FollowUpDraft {
  if (!parsed) return baseline;
  const stage =
    typeof parsed.stage === 'string' && parsed.stage.trim() ? parsed.stage.trim().slice(0, 40) : baseline.stage;
  const content =
    typeof parsed.content === 'string' && parsed.content.trim()
      ? parsed.content.trim().slice(0, 2000)
      : baseline.content;
  return {
    source: 'ai',
    stage,
    content,
    nextFollowUpAt: normalizeIsoDate(parsed.nextFollowUpAt),
    keyPoints: toStringArray(parsed.keyPoints, []),
  };
}

export interface ExtractFollowUpCtx {
  tenantId?: string;
  /** 商机名称/客户名, 提供给 LLM 增强接地 (可选) */
  opportunityName?: string;
  /** 参考的今天日期 (ISO), 供 LLM 换算"下周/三天后"; 默认今天 */
  today?: string;
}

/**
 * 从非结构化文本提取跟进草稿 (LLM 增强, fail-soft 到规则基线)。
 */
export async function extractFollowUpDraft(
  rawText: string,
  ctx?: ExtractFollowUpCtx,
): Promise<FollowUpDraft> {
  const baseline = buildFollowUpBaseline(rawText);
  if (!rawText || !rawText.trim()) return baseline;

  const today = ctx?.today ?? new Date().toISOString().slice(0, 10);
  const system =
    '你是销售跟进记录整理助手。把一线随手记的杂乱文本整理成结构化的客户跟进记录。' +
    '必须基于原文, 不臆造未提及的信息。若原文提到"下周/几天后/某日"再约, 换算成绝对日期。' +
    `参考今天=${today}。只输出 JSON: ` +
    '{"stage":"跟进阶段简短标签","content":"整理后的跟进正文(客观、要点清晰)","nextFollowUpAt":"YYYY-MM-DD或空串","keyPoints":["关键要点"]}。';
  const userParts = [ctx?.opportunityName ? `商机/客户: ${ctx.opportunityName}` : '', `原始记录:\n${rawText.slice(0, MAX_RAW)}`]
    .filter(Boolean)
    .join('\n');

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: PMS 只读提取, 不改业务真值
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userParts },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 800,
    });
    const content =
      typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
    const parsed = extractJsonObject<{
      stage?: unknown;
      content?: unknown;
      nextFollowUpAt?: unknown;
      keyPoints?: unknown;
    }>(content);
    return mapFollowUpExtraction(parsed, baseline);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[follow-up-ai] LLM extract failed, fallback to baseline');
    return baseline;
  }
}
