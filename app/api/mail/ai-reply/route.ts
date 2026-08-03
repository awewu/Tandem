/**
 * POST /api/mail/ai-reply
 *
 * AI 智能回复草稿：根据邮件上下文 + 公司基线 + 个人风格生成回复
 * Body: { originalText: string; originalSubject: string; tone?: 'formal'|'friendly'|'brief' }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

interface Body {
  originalText?: unknown;
  originalSubject?: unknown;
  tone?: unknown;
}

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const text = typeof body.originalText === 'string' ? body.originalText.trim() : '';
  const subject = typeof body.originalSubject === 'string' ? body.originalSubject.trim() : '';
  const tone = typeof body.tone === 'string' ? body.tone : 'formal';

  if (!text) {
    return NextResponse.json({ ok: false, error: 'originalText 必填' }, { status: 400 });
  }

  const { governedChat } = await import('@/lib/governance/governed-chat');

  const systemPrompt = `
你是 Tandem 企业邮件助手。根据用户收到的邮件，生成专业、得体的回复草稿。

规则：
1. 语气选择：formal(正式商务) / friendly(友好协作) / brief(极简)
2. 默认使用中文回复（如原邮件是英文则用英文）
3. 保持礼貌、专业、结构化
4. 如果邮件涉及请求/问题，直接给出明确答复或下一步行动
5. 结尾包含适当的敬语
6. 如果无法判断如何回复，给出礼貌的确认收到/进一步了解模板

请直接输出回复正文，不要加 "回复草稿" 等前缀，不要包含签名块。
`;

  const userPrompt = `请根据以下邮件生成 ${tone === 'formal' ? '正式' : tone === 'friendly' ? '友好' : '极简'} 语气的回复草稿：

原邮件主题: ${subject}
原邮件正文:
${text}`;

  const gc = await governedChat({
    actorUserId: auth.userId,
    intent: `邮件回复草稿(${tone}): ${subject || '(无主题)'}`,
    basePersonaPrompt: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    agentKind: 'persona',
    scenario: 'persona_dialogue',
    maxTokens: 600,
    outputGuardSource: 'mail.ai_reply',
    metadata: { userId: auth.userId, feature: 'mail_ai_reply' },
  }).catch(() => null);

  if (!gc) {
    return NextResponse.json({ ok: false, error: 'AI 生成失败' }, { status: 500 });
  }

  if (!gc.ok) {
    return NextResponse.json(
      { ok: false, error: gc.blocked?.reasons?.join('; ') || 'AI 回复被企业治理拦截，请人工撰写' },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, draft: (gc.answer ?? '').trim() });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/ai-reply' });
