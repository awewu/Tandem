const MAX_BROWSER_TIMEOUT_MS = 2_147_000_000;

export const REMINDER_TOAST_FALLBACK_DURATION_MS = MAX_BROWSER_TIMEOUT_MS;

export function getReminderToastDurationMs(body: string | null | undefined, nowMs = Date.now()): number {
  const startAtMs = parseReminderStartTimeMs(body ?? '');
  if (startAtMs === null) return REMINDER_TOAST_FALLBACK_DURATION_MS;
  return Math.min(Math.max(startAtMs - nowMs, 1), REMINDER_TOAST_FALLBACK_DURATION_MS);
}

function parseReminderStartTimeMs(body: string): number | null {
  const match = body.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*开始/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
