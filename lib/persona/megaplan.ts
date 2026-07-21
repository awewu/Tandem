/**
 * Megaplan · 四方案输出 (2026-07)
 *
 * 用户主动开启时, 中央 AI 对同一问题并行产出 4 张对照卡:
 *   1. SOP 答案     = 公司 Memory / 基线 / OKR 检索 (现有治理答)
 *   2. 最佳实践     = web.search 外部行业实践
 *   3. AI 推荐      = 松绑后的自由推理结论
 *   4. 个人补充     = 留空槽 (humanOnly, AI 不代写)
 *
 * 选定某卡 → CA-13 记 Decision + 反馈归因; 个人补充 → 存 Material 草稿候选 (走签批才进 Memory)。
 *
 * 设计: 3 次 LLM 调用 (+1 次 web.search) 并行, 全 fail-soft; 是 opt-in 模式 (4x 成本用户已知)。
 */

import { getRouter } from '@/lib/boot';
import { buildCompanyBrainSystemPrompt, COMPANY_BRAIN_USER_ID } from '@/lib/persona/company-brain';
import { logger } from '@/lib/infra/logger';

export type MegaplanSchemeId = 'sop' | 'best_practice' | 'ai' | 'personal';

export interface MegaplanScheme {
  id: MegaplanSchemeId;
  title: string;
  /** 卡片正文 (个人补充卡为空串, 由前端填写) */
  content: string;
  /** 来源 chips (最佳实践的联网结果) */
  sources?: Array<{ title: string; url: string }>;
  /** true = 该卡由人填写, AI 不代写 (个人补充) */
  editable?: boolean;
}

const SCHEME_TITLES: Record<MegaplanSchemeId, string> = {
  sop: 'SOP 答案 · 公司基线',
  best_practice: '最佳实践 · 行业外脑',
  ai: 'AI 推荐 · 自由推理',
  personal: '个人补充 · 你来拍板',
};

async function genSop(query: string, actorUserId: string): Promise<MegaplanScheme> {
  const router = getRouter();
  const base = await buildCompanyBrainSystemPrompt({ query });
  const system =
    `${base}\n\n【本卡任务】只依据上面的公司 Memory / SOP / 基线 / OKR, 给出"公司标准答案"。` +
    `若公司确有对应 SOP/规定就据此作答并点出依据; 若没有明确 SOP, 如实说明"暂无对应公司 SOP", 不要编造。简洁务实。`;
  const res = await router.chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ],
    scenario: 'reasoning_complex',
    temperature: 0.3,
    maxTokens: 600,
    metadata: { userId: actorUserId },
  });
  const content = typeof res.message.content === 'string' ? res.message.content.trim() : '';
  return { id: 'sop', title: SCHEME_TITLES.sop, content: content || '(暂无对应公司 SOP)' };
}

async function genBestPractice(query: string, actorUserId: string): Promise<MegaplanScheme> {
  const router = getRouter();
  let sources: Array<{ title: string; url: string }> = [];
  let searchSummaryInput = '';
  try {
    const { skillRegistry } = await import('@/lib/taf/skills/registry');
    const r = await skillRegistry.execute('web.search', { query, count: 5 }, {
      userId: actorUserId,
      isProxy: false,
      tenantId: 'default',
    });
    if (r.ok && r.data && typeof r.data === 'object') {
      const results = (r.data as { results?: Array<{ title?: string; url?: string; snippet?: string; content?: string }> }).results ?? [];
      sources = results
        .filter((x) => x.url)
        .map((x) => ({ title: x.title || x.url || '', url: x.url as string }));
      searchSummaryInput = results
        .map((x, i) => `[${i + 1}] ${x.title ?? ''}\n${x.snippet ?? x.content ?? ''}`)
        .join('\n\n');
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[megaplan] web.search failed');
  }

  if (!searchSummaryInput) {
    return {
      id: 'best_practice',
      title: SCHEME_TITLES.best_practice,
      content: '(未配置联网检索或未取到外部结果, 暂无法给出行业最佳实践)',
    };
  }

  const res = await router.chat({
    messages: [
      {
        role: 'system',
        content:
          '你是行业研究助手。基于给定的联网搜索摘要, 归纳该问题的"行业最佳实践"。' +
          '只根据材料归纳, 不编造; 给出 2-4 条可操作要点, 标明这是外部通行做法 (未必符合本公司实际)。',
      },
      { role: 'user', content: `问题: ${query}\n\n联网搜索摘要:\n${searchSummaryInput}` },
    ],
    scenario: 'high_frequency',
    temperature: 0.4,
    maxTokens: 600,
    metadata: { userId: actorUserId },
  });
  const content = typeof res.message.content === 'string' ? res.message.content.trim() : '';
  return {
    id: 'best_practice',
    title: SCHEME_TITLES.best_practice,
    content: content || '(未取到外部最佳实践)',
    sources: sources.length > 0 ? sources : undefined,
  };
}

async function genAiRecommendation(query: string, actorUserId: string): Promise<MegaplanScheme> {
  const router = getRouter();
  const system =
    '你是 Tandem 的中央 AI 参谋。针对下面的问题, 给出你判断下最好的分析与建议: ' +
    '有推理链、可下结论、给方向与优先级。这是"AI 自由推荐"视角 (与公司 SOP / 外部实践并列), ' +
    '不必受限于现有规定, 但要务实、可执行。';
  const res = await router.chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ],
    scenario: 'reasoning_complex',
    temperature: 0.6,
    maxTokens: 700,
    metadata: { userId: actorUserId },
  });
  const content = typeof res.message.content === 'string' ? res.message.content.trim() : '';
  return { id: 'ai', title: SCHEME_TITLES.ai, content: content || '(AI 未返回内容)' };
}

/**
 * 并行产出 4 张方案卡 (前 3 张 LLM/联网, 第 4 张为空槽)。全 fail-soft: 单卡失败以占位文案兜底。
 */
export async function generateMegaplanSchemes(
  query: string,
  opts?: { actorUserId?: string },
): Promise<MegaplanScheme[]> {
  const actorUserId = opts?.actorUserId ?? COMPANY_BRAIN_USER_ID;
  const [sop, best, ai] = await Promise.allSettled([
    genSop(query, actorUserId),
    genBestPractice(query, actorUserId),
    genAiRecommendation(query, actorUserId),
  ]);

  const fallback = (id: MegaplanSchemeId): MegaplanScheme => ({
    id,
    title: SCHEME_TITLES[id],
    content: '(本卡生成失败, 请重试)',
  });

  return [
    sop.status === 'fulfilled' ? sop.value : fallback('sop'),
    best.status === 'fulfilled' ? best.value : fallback('best_practice'),
    ai.status === 'fulfilled' ? ai.value : fallback('ai'),
    { id: 'personal', title: SCHEME_TITLES.personal, content: '', editable: true },
  ];
}

/**
 * 选定某方案 → 归因映射 (喂 CA-13 学习飞轮):
 *   - ai        → adopted   (AI 自由推理被采纳, 最强正向信号)
 *   - sop       → modified  (用了公司 SOP, 非纯 AI 推演)
 *   - best_practice → modified (用了外部实践)
 *   - personal  → overruled (员工原创, AI 方案未被采纳)
 */
export function megaplanOutcomeFor(
  schemeId: MegaplanSchemeId,
): { outcome: 'adopted' | 'modified' | 'overruled'; reason: string } {
  switch (schemeId) {
    case 'ai':
      return { outcome: 'adopted', reason: '四方案选定 AI 推荐 (自由推理)' };
    case 'sop':
      return { outcome: 'modified', reason: '四方案选定 SOP 答案 (公司基线)' };
    case 'best_practice':
      return { outcome: 'modified', reason: '四方案选定最佳实践 (外部行业)' };
    case 'personal':
    default:
      return { outcome: 'overruled', reason: '四方案选定个人补充 (员工原创), AI 方案未被采纳' };
  }
}
