/**
 * POST /api/mail/ai-review
 *
 * 发送前 AI 审校：语气/事实/红线检查
 * Body: { subject: string; body: string }
 * 返回: { ok, review: { score, issues, suggestions, isSafe } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface Body {
  subject?: unknown;
  body?: unknown;
}

interface ReviewIssue {
  severity: 'info' | 'warning' | 'critical';
  category: 'tone' | 'fact' | 'redline' | 'grammar' | 'clarity';
  message: string;
  suggestion: string;
}

interface ReviewResult {
  score: number; // 0-100
  summary: string;
  issues: ReviewIssue[];
  isSafe: boolean; // 无 critical 问题
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';

  if (!text) {
    return NextResponse.json({ ok: false, error: 'body 必填' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  const systemPrompt = `
你是 Tandem 企业邮件审校官。对即将发送的邮件进行多维质量检查。

请严格输出 JSON，不要包含 Markdown 代码块：
{
  "score": 0-100 (综合质量分),
  "summary": "整体评价（一句话）",
  "issues": [
    { "severity": "info|warning|critical", "category": "tone|fact|redline|grammar|clarity", "message": "问题描述", "suggestion": "修改建议" }
  ],
  "isSafe": true/false (无 critical 问题则为 true)
}

审校维度：
1. tone — 语气是否专业得体？对上级/客户/同事是否合适？
2. fact — 是否有明显事实错误、数据矛盾、日期不合理？
3. redline — 是否包含敏感信息泄露、不当承诺、越权表态？
4. grammar — 错别字、语法、标点
5. clarity — 是否表达清晰、结构合理、行动项明确

评分标准：90+ 优秀，70-89 良好，50-69 需改进，<50 不建议发送
`;

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `主题: ${subject}\n\n正文:\n${text}` },
      ],
    });

    const content = response.message.content;
    const jsonText = typeof content === 'string' ? content : '{}';
    const review: ReviewResult = JSON.parse(jsonText);

    return NextResponse.json({
      ok: true,
      review: {
        score: Math.min(100, Math.max(0, review.score ?? 70)),
        summary: review.summary || '审校完成',
        issues: review.issues || [],
        isSafe: review.isSafe ?? true,
      },
    });
  } catch {
    // AI 失败时返回中性审校结果，不阻断发送
    return NextResponse.json({
      ok: true,
      review: {
        score: 70,
        summary: 'AI 审校服务暂时不可用，请人工检查',
        issues: [],
        isSafe: true,
      },
    });
  }
});
