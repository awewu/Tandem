/**
 * 战略合理性裁决端点 · 中央 AI 给 StratOS 的"审视回执" (反向桥, 姿势 B 闭环下半段)
 * ────────────────────────────────────────────────────────────────────────
 * StratOS 季度合理性复盘时, 把它的战略合理性摘要 (perception-digest 同形) POST 过来,
 * 中央 AI 跑一次结构化推理, 对每条脆弱前提 / 每个 at-risk Bet 给出
 * persevere(坚守) | pivot(转向) | kill(终止) 的**建议**与理由, 并给整体 crux 研判。
 *
 * 纪律:
 *   - 裁决是"建议", 不写任何战略真值; 人工最终决策与留痕在 StratOS 侧完成。
 *   - 服务令牌鉴权 (STRATEGY_VERDICT_TOKEN, 与 StratOS 侧 HERMES_VERDICT_TOKEN 一致);
 *     未配置则 503 (诚实告知未启用)。
 *   - fail-soft: LLM/解析失败 → ok:false + 诚实错误, 让 StratOS 优雅降级到本地规则提示。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';

export const runtime = 'nodejs';

interface DigestPremise {
  code: string;
  premise: string;
  category?: string;
  confidence?: number;
  fragility?: number;
  failSignal?: string | null;
}
interface DigestBet {
  code: string;
  title: string;
  type?: string;
  gateStatus?: string;
  fpaToggle?: string;
  capexTotal?: number;
}
interface StrategyDigest {
  diagnosis?: { crux?: string; challengeStatement?: string; bottleneckType?: string; period?: string };
  hardBlocks?: Array<{ assertionType?: string; message?: string; metricValue?: number; thresholdValue?: number }>;
  fragilePremises?: DigestPremise[];
  topDiffs?: Array<{ category?: string; severity?: string; title?: string; formationType?: string }>;
  bets?: DigestBet[];
  fpa?: { revenueBudget?: number; revenueForecast?: number; profitForecast?: number; cashRunwayMonths?: number };
  counts?: Record<string, number>;
}

function bearer(req: NextRequest): string {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7).trim();
  return '';
}

function verifyServiceToken(req: NextRequest): NextResponse | null {
  const expected = process.env.STRATEGY_VERDICT_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'strategy-verdict 未启用 (STRATEGY_VERDICT_TOKEN 未配置)' }, { status: 503 });
  }
  const token = bearer(req);
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export const VERDICT_SYSTEM = [
  '你是瑞合瑞德集团的中央 AI · 战略合理性参谋。集团正在做季度战略"合理性审视"(与"坚守"辩证的另一面): 不是替代人拍板, 而是基于战略真值给出理性的"该不该继续"研判。',
  '给你的是 StratOS 战略沙盘的合理性传感器摘要: 战略诊断 crux、硬阻断断言、脆弱/失效的前提假设、Top 战略差异(StratDiff)、重大投资 Bet 的门禁/预算勾连、FPA 现金 runway。',
  '任务: 对每条脆弱前提和每个存在风险的 Bet, 给出建议裁决之一 —— persevere(前提仍成立/风险可控, 应坚守) | pivot(前提部分失效/需调整打法或重定方向) | kill(前提根本失效/继续将放大损失, 应终止), 并给出简短、务实、可执行的理由(点出关键证据, 不空话)。同时给整体研判。',
  '判据要克制: 单一信号波动不轻言 kill; 只有前提根本失效或触及底线(如 runway 跌破安全线、硬阻断长期无解)才建议 kill。坚守与审视是一对辩证, 既不盲目坚守, 也不轻率转向。',
  '只输出一个 JSON 对象, 不要任何多余文字或 markdown 代码块围栏。JSON 形如:',
  '{',
  '  "overallStance": "persevere" | "pivot" | "kill" | "mixed",',
  '  "crux": "一句话点出当前战略成败的核心矛盾",',
  '  "summary": "2-3 句整体理性研判",',
  '  "premises": [ { "code": "P5", "recommendation": "pivot", "severity": "high|medium|low", "rationale": "…" } ],',
  '  "bets": [ { "code": "B1", "recommendation": "kill", "rationale": "…" } ]',
  '}',
  'premises/bets 只包含摘要里出现的、有明确风险信号的条目; 无风险条目可不列。code 必须与摘要一致。',
].join('\n');

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('LLM 未返回可解析 JSON');
  }
}

export async function POST(req: NextRequest) {
  const denied = verifyServiceToken(req);
  if (denied) return denied;

  let digest: StrategyDigest;
  try {
    digest = (await req.json()) as StrategyDigest;
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }
  if (!digest || typeof digest !== 'object') {
    return NextResponse.json({ ok: false, error: '缺少战略摘要 digest' }, { status: 400 });
  }

  try {
    await boot();
    const router = getRouter();

    const userPrompt =
      '这是当前战略合理性传感器摘要 (JSON):\n' +
      JSON.stringify(digest, null, 2) +
      '\n\n请据此输出你的合理性裁决 JSON。';

    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 跨系统服务令牌调用 (StratOS→中央AI), 无用户 session; 输出为只读建议, 不触发写动作
    const res = await router.chat({
      scenario: 'reasoning_complex',
      temperature: 0.3,
      responseFormat: 'json',
      messages: [
        { role: 'system', content: VERDICT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      metadata: { requestId: 'stratos-strategy-verdict' },
    });

    const content = typeof res.message.content === 'string' ? res.message.content : '';
    let verdict: unknown;
    try {
      verdict = extractJson(content);
    } catch (parseErr) {
      const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return NextResponse.json(
        { ok: false, error: `中央 AI 裁决解析失败: ${detail}`, rawSample: content.slice(0, 300) },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      model: res.model,
      verdict,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `中央 AI 裁决失败: ${detail}` }, { status: 500 });
  }
}
