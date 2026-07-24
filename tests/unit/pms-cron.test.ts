import { describe, it, expect } from 'vitest';
import { daysUntil, isExpiringSoon } from '@/lib/pms/cron-service';

describe('PMS cron · daysUntil', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('未来日期 → 正天数', () => {
    expect(daysUntil('2026-06-11', now)).toBe(10);
  });
  it('过期日期 → 负天数', () => {
    expect(daysUntil('2026-05-22', now)).toBe(-10);
  });
  it('空/非法 → null', () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('bad', now)).toBeNull();
  });
});

describe('PMS cron · isExpiringSoon', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('30 天内 → true', () => {
    expect(isExpiringSoon('2026-06-20', now, 30)).toBe(true);
  });
  it('已过期 → true (需预警)', () => {
    expect(isExpiringSoon('2026-05-01', now, 30)).toBe(true);
  });
  it('超出窗口 → false', () => {
    expect(isExpiringSoon('2026-09-01', now, 30)).toBe(false);
  });
  it('空 → false', () => {
    expect(isExpiringSoon(null, now, 30)).toBe(false);
  });
});
