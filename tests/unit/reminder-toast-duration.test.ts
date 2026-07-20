import { describe, expect, it } from 'vitest';
import { getReminderToastDurationMs, REMINDER_TOAST_FALLBACK_DURATION_MS } from '@/lib/reminders/toast-duration';

describe('reminder toast duration', () => {
  it('keeps calendar reminders visible until their start time', () => {
    const now = new Date(2026, 6, 20, 14, 45, 0).getTime();

    expect(getReminderToastDurationMs('2026/7/20 15:00:00 开始', now)).toBe(15 * 60 * 1000);
  });

  it('falls back to a long-lived toast when the start time is not machine-readable', () => {
    expect(getReminderToastDurationMs('请及时查看这条提醒', Date.now())).toBe(REMINDER_TOAST_FALLBACK_DURATION_MS);
  });

  it('does not keep already-started reminders open indefinitely', () => {
    const now = new Date(2026, 6, 20, 15, 1, 0).getTime();

    expect(getReminderToastDurationMs('2026/7/20 15:00:00 开始', now)).toBe(1);
  });
});
