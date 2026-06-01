/**
 * POST /api/calendar/meeting-retro
 *
 * 会议自动复盘：根据会议基本信息生成纪要 + Action Items
 * Body: { eventId: string; notes?: string }
 * 返回: { ok, retro: { summary, decisions, actionItems, nextSteps } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface Body {
  eventId?: unknown;
  notes?: unknown;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  const notes = typeof body.notes === 'string' ? body.notes : '';

  if (!eventId) {
    return NextResponse.json({ ok: false, error: 'eventId 必填' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  const systemPrompt = `
你是 Tandem 会议复盘助手。根据会议信息生成结构化复盘纪要。

请严格输出 JSON：
{
  "summary": "会议核心结论与讨论要点（3-5句）",
  "decisions": ["已达成决策1", "决策2"],
  "actionItems": [
    { "task": "具体行动项", "owner": "负责人（可选）", "dueDate": "YYYY-MM-DD（可选）" }
  ],
  "nextSteps": ["下一步计划1", "计划2"]
}
`;

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请为以下会议生成复盘纪要:\n\n会议ID: ${eventId}\n会议笔记/录音转录:\n${notes || '(无额外笔记)'}` },
      ],
    });

    const content = response.message.content;
    const jsonText = typeof content === 'string' ? content : '{}';
    const retro = JSON.parse(jsonText);

    return NextResponse.json({ ok: true, retro });
  } catch {
    return NextResponse.json({
      ok: true,
      retro: {
        summary: 'AI 复盘服务暂时不可用。请手动记录会议纪要。',
        decisions: [],
        actionItems: [],
        nextSteps: ['整理会议笔记', '同步相关方'],
      },
    });
  }
});
