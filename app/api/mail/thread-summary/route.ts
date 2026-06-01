/**
 * POST /api/mail/thread-summary
 *
 * 邮件链智能摘要：长线程邮件自动生成时间线摘要
 * Body: { emails: Array<{ subject, from, date, text }> }
 * 返回: { ok, summary: { timeline, keyDecisions, outstandingQuestions, nextActions } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface EmailEntry {
  subject: string;
  from: string;
  date: string;
  text: string;
}

interface Body {
  emails?: unknown;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const emails = Array.isArray(body.emails) ? body.emails.filter((e): e is EmailEntry =>
    typeof e === 'object' && e !== null &&
    typeof (e as any).subject === 'string' &&
    typeof (e as any).text === 'string'
  ) : [];

  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: 'emails 必填且至少一条' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  const systemPrompt = `
你是 Tandem 邮件链摘要助手。将多封往来邮件整理为结构化摘要。

请严格输出 JSON：
{
  "timeline": [
    { "date": "YYYY-MM-DD", "who": "发件人", "what": "一句话概括此邮件的核心动作或观点" }
  ],
  "keyDecisions": ["已达成决策1", "决策2"],
  "outstandingQuestions": ["待解决问题1", "问题2"],
  "nextActions": ["下一步行动1", "行动2"]
}
`;

  const emailChain = emails.map((e, i) =>
    `[${i + 1}] ${e.date} | ${e.from} | ${e.subject}\n${e.text.slice(0, 800)}`
  ).join('\n\n---\n\n');

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请为以下邮件链生成结构化摘要:\n\n${emailChain}` },
      ],
    });

    const content = response.message.content;
    const jsonText = typeof content === 'string' ? content : '{}';
    const summary = JSON.parse(jsonText);

    return NextResponse.json({ ok: true, summary });
  } catch {
    return NextResponse.json({
      ok: true,
      summary: {
        timeline: emails.map((e) => ({ date: e.date.slice(0, 10), who: e.from, what: e.subject })),
        keyDecisions: ['AI 摘要服务暂时不可用，请手动阅读邮件链'],
        outstandingQuestions: [],
        nextActions: [],
      },
    });
  }
});
