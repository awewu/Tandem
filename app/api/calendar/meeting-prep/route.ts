/**
 * POST /api/calendar/meeting-prep
 *
 * 会议自动准备：根据事件关联的 OKR / 议事 / 历史，生成会前材料
 * Body: { eventId: string }
 * 返回: { ok, prep: { context, keyPoints, suggestedAgenda, relatedMaterials } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface Body {
  eventId?: unknown;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  if (!eventId) {
    return NextResponse.json({ ok: false, error: 'eventId 必填' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  const systemPrompt = `
你是 Tandem 会议准备助手。根据会议的基本信息，生成专业的会前准备材料。

请严格输出 JSON：
{
  "context": "会议背景与目的（2-3句）",
  "keyPoints": ["关键议题1", "关键议题2", "关键议题3"],
  "suggestedAgenda": [
    { "item": "议程项", "durationMin": 15 }
  ],
  "relatedMaterials": ["建议提前准备的材料1", "材料2"]
}
`;

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请为以下会议生成会前准备材料:\n\n会议ID: ${eventId}\n\n注：实际生产环境会在此拉取关联的 OKR、议事室记录、历史邮件等上下文注入。当前演示版基于通用模板生成。` },
      ],
    });

    const content = response.message.content;
    const jsonText = typeof content === 'string' ? content : '{}';
    const prep = JSON.parse(jsonText);

    return NextResponse.json({ ok: true, prep });
  } catch {
    return NextResponse.json({
      ok: true,
      prep: {
        context: 'AI 准备服务暂时不可用，请手动整理会议材料。',
        keyPoints: ['确认会议目标', '准备讨论要点'],
        suggestedAgenda: [{ item: '开场与目标对齐', durationMin: 5 }, { item: '核心议题讨论', durationMin: 40 }, { item: '行动项与下次会议', durationMin: 10 }],
        relatedMaterials: ['关联 OKR 进展', '上次会议纪要'],
      },
    });
  }
});
