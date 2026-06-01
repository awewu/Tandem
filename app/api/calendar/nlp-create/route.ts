/**
 * POST /api/calendar/nlp-create
 *
 * 自然语言创建日历事件
 * Body: { text: string }
 * 返回: { ok, event: Partial<CalendarEvent> }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface Body {
  text?: unknown;
}

interface NLPEvent {
  title: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  type: 'meeting' | 'task' | 'reminder';
  location?: string;
  attendees?: string[];
  description?: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ ok: false, error: 'text 必填' }, { status: 400 });
  }

  const { createDefaultRouter } = await import('@/lib/taf');
  const router = createDefaultRouter();

  const systemPrompt = `
你是一个 Tandem 日历自然语言解析器。将用户输入解析为日历事件结构化数据。
当前时间是 ${new Date().toISOString()}。

请严格输出 JSON 格式，不要包含 Markdown 代码块，直接以 { 开始，以 } 结束。
JSON 字段：
{
  "title": "事件标题",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM(可选, 无时为null)",
  "endDate": "YYYY-MM-DD(可选, 默认同 startDate)",
  "endTime": "HH:MM(可选, 默认 startTime+1小时)",
  "isAllDay": false,
  "type": "meeting" | "task" | "reminder",
  "location": "地点(可选)",
  "attendees": ["邮箱1", "邮箱2"],
  "description": "备注(可选)"
}

解析规则：
- "明天" = 今天+1天, "后天" = 今天+2天, "下周" = 下周一
- "下午3点" = 15:00, "早上9点" = 09:00
- "跟/与/和 X 开会" → attendees 提取邮箱(如有)或人名, type=meeting
- "截止/DDL/交" → type=task
- "提醒/记得" → type=reminder
- 无明确时间则 startDate=今天, startTime=当前时间(整点)
- 时长未指定则默认 1 小时
`;

  try {
    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    });

    const content = response.message.content;
    const jsonText = typeof content === 'string' ? content : '{}';
    const parsed = JSON.parse(jsonText) as Partial<NLPEvent> & { startDate?: string; startTime?: string | null; endDate?: string; endTime?: string | null };

    // 解析为 timestamp
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sDate = parsed.startDate || todayStr;
    const sTime = parsed.startTime || '09:00';
    const eDate = parsed.endDate || sDate;
    const eTime = parsed.endTime || (parsed.isAllDay ? '23:59' : addHour(sTime));

    const startMs = parsed.isAllDay
      ? new Date(sDate).getTime()
      : new Date(`${sDate}T${sTime}`).getTime();
    const endMs = parsed.isAllDay
      ? new Date(eDate).setHours(23, 59, 59, 999)
      : new Date(`${eDate}T${eTime}`).getTime();

    return NextResponse.json({
      ok: true,
      event: {
        title: parsed.title || text.slice(0, 30),
        startTime: startMs,
        endTime: endMs,
        isAllDay: parsed.isAllDay || false,
        type: parsed.type || 'task',
        location: parsed.location,
        attendees: parsed.attendees,
        description: parsed.description,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'AI 解析失败' }, { status: 500 });
  }
});

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
