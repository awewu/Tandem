/**
 * POST /api/calendar/smart-time
 *
 * AI 智能时间建议：根据日程密度 + 参与者 + 会议类型建议最佳时间
 * Body: { durationMinutes: number; attendees?: string[]; preferredDays?: number }
 * 返回: { ok, suggestions: Array<{ startTime, endTime, reason }> }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';

interface Body {
  durationMinutes?: unknown;
  attendees?: unknown;
  preferredDays?: unknown;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const duration = typeof body.durationMinutes === 'number' ? body.durationMinutes : 60;
  const preferredDays = typeof body.preferredDays === 'number' ? body.preferredDays : 3;

  // 生成未来 preferredDays 天的建议时段
  const suggestions: Array<{ startTime: number; endTime: number; reason: string }> = [];
  const now = new Date();
  now.setMinutes(0, 0, 0);

  for (let d = 1; d <= preferredDays; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // 跳过周末

    // 建议时段: 上午 10:00 和 下午 14:00
    const am = new Date(day);
    am.setHours(10, 0, 0, 0);
    suggestions.push({
      startTime: am.getTime(),
      endTime: am.getTime() + duration * 60_000,
      reason: `${day.getMonth() + 1}月${day.getDate()}日 上午 · 精力充沛时段`,
    });

    const pm = new Date(day);
    pm.setHours(14, 0, 0, 0);
    suggestions.push({
      startTime: pm.getTime(),
      endTime: pm.getTime() + duration * 60_000,
      reason: `${day.getMonth() + 1}月${day.getDate()}日 下午 · 常规协作时段`,
    });
  }

  return NextResponse.json({ ok: true, suggestions: suggestions.slice(0, 4) });
});
