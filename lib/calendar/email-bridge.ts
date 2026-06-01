/**
 * Calendar ↔ Email 桥梁
 *
 * 打通点:
 *   1. 会议邀请: 新建/编辑 meeting 事件 → 自动发 ICS 邀请邮件给 attendees
 *   2. 事件变更/取消: 更新/删除 meeting → 自动发更新/取消通知
 *   3. 提醒通知: 到期前通过邮件提醒 (客户端定时轮询)
 *   4. 邮件 AI → 日历: 见 email-ai-brain.ts suggestedEvents
 */

import type { CalendarEvent } from '@/lib/store/calendar';

export interface SendInviteInput {
  event: CalendarEvent;
  organizerEmail?: string;
  method: 'REQUEST' | 'CANCEL' | 'UPDATE';
}

/**
 * 生成 iCalendar (ICS) 文本
 */
export function generateICS(event: CalendarEvent, method: 'REQUEST' | 'CANCEL' = 'REQUEST', sequence = 0): string {
  const uid = `${event.id}@tandem.local`;
  const start = toUTCString(event.startTime, event.isAllDay);
  const end = toUTCString(event.endTime, event.isAllDay);
  const dtStamp = toUTCString(Date.now(), false);
  const status = event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `METHOD:${method}`,
    'PRODID:Tandem Calendar',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART${event.isAllDay ? ';VALUE=DATE' : ''}:${start}`,
    `DTEND${event.isAllDay ? ';VALUE=DATE' : ''}:${end}`,
    `DTSTAMP:${dtStamp}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  // Organizer (用 createdBy 作为 organizer)
  lines.push(`ORGANIZER;CN=Tandem:mailto:${event.createdBy === 'me' ? 'organizer@tandem.local' : event.createdBy}`);

  // Attendees
  for (const email of event.attendees ?? []) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${email}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function toUTCString(ms: number, isAllDay: boolean): string {
  const d = new Date(ms);
  if (isAllDay) {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}00Z`;
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * 发送会议邀请/更新/取消邮件 (客户端调用)
 */
export async function sendCalendarInvite({ event, method }: SendInviteInput): Promise<{ ok: boolean; error?: string }> {
  const attendees = event.attendees ?? [];
  if (attendees.length === 0) return { ok: true };

  const icsMethod = method === 'CANCEL' ? 'CANCEL' : 'REQUEST';
  const sequence = method === 'UPDATE' ? 1 : 0;
  const icsContent = generateICS(event, icsMethod, sequence);
  const methodLabel = method === 'REQUEST' ? '邀请' : method === 'UPDATE' ? '更新' : '取消';
  const subject = `[Tandem 日程] ${methodLabel}: ${event.title}`;

  const bodyText = [
    `日程 ${methodLabel}通知`,
    ``,
    `标题: ${event.title}`,
    `时间: ${new Date(event.startTime).toLocaleString('zh-CN')}`,
    event.location ? `地点: ${event.location}` : '',
    event.description ? `备注: ${event.description}` : '',
    ``,
    `请将下方 ICS 附件导入您的日历客户端。`,
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        to: attendees,
        subject,
        text: bodyText,
        attachments: [
          {
            filename: `tandem-${event.id}.ics`,
            content: icsContent,
            contentType: 'text/calendar;method=' + method,
          },
        ],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? `发送失败 (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 检查并发送提醒通知 (建议在客户端用 setInterval 每 60s 调用)
 * 返回本次触发了哪些提醒
 */
export function checkReminders(events: CalendarEvent[]): Array<{ eventId: string; title: string; minutesBefore: number }> {
  const now = Date.now();
  const fired: Array<{ eventId: string; title: string; minutesBefore: number }> = [];

  for (const ev of events) {
    if (ev.status === 'cancelled') continue;
    if (!ev.reminders || ev.reminders.length === 0) continue;

    for (const r of ev.reminders) {
      const remindAt = ev.startTime - r.minutesBefore * 60 * 1000;
      // 只允许在过去 60 秒内触发的提醒（避免重启后重复发送旧提醒）
      const windowStart = now - 60 * 1000;
      const windowEnd = now;
      if (remindAt >= windowStart && remindAt <= windowEnd) {
        fired.push({ eventId: ev.id, title: ev.title, minutesBefore: r.minutesBefore });
      }
    }
  }

  return fired;
}

/**
 * 发送单条提醒邮件
 */
export async function sendReminderEmail(event: CalendarEvent, minutesBefore: number): Promise<void> {
  const subject = `[Tandem 提醒] ${minutesBefore === 0 ? '即将开始' : `${minutesBefore}分钟后开始`}: ${event.title}`;
  const bodyText = [
    `日程提醒`,
    ``,
    `标题: ${event.title}`,
    `时间: ${new Date(event.startTime).toLocaleString('zh-CN')}`,
    event.location ? `地点: ${event.location}` : '',
    event.description ? `备注: ${event.description}` : '',
    ``,
    `详情: ${typeof window !== 'undefined' ? `${window.location.origin}/calendar` : ''}`,
  ].filter(Boolean).join('\n');

  try {
    await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        to: event.createdBy === 'me' ? 'me@tandem.local' : event.createdBy, // fallback
        subject,
        text: bodyText,
      }),
    });
  } catch {
    // 提醒发送失败静默处理，不阻断业务
  }
}

/**
 * 从邮件正文解析可能的会议/截止日建议
 * (简单启发式规则, 真提取靠 AI)
 */
export function extractDateHints(text: string): Array<{
  type: 'meeting' | 'deadline';
  title: string;
  dateStr: string;
  timeStr?: string;
}> {
  const hints: Array<{ type: 'meeting' | 'deadline'; title: string; dateStr: string; timeStr?: string }> = [];

  // 匹配 "截止/截至/DDL: YYYY-MM-DD"
  const deadlineRe = /(?:截止|截至|DDL|deadline|期限)[:：]?\s*(\d{4}-\d{2}-\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = deadlineRe.exec(text)) !== null) {
    hints.push({ type: 'deadline', title: '邮件截止提醒', dateStr: m[1] });
  }

  // 匹配 "会议/开会/讨论: ... YYYY-MM-DD HH:MM"
  const meetingRe = /(?:会议|开会|讨论|评审|对齐)[:：]?\s*(.+?)(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})?/gi;
  while ((m = meetingRe.exec(text)) !== null) {
    hints.push({ type: 'meeting', title: m[1].trim().slice(0, 30), dateStr: m[2], timeStr: m[3] });
  }

  return hints.slice(0, 3); // 最多 3 条
}
