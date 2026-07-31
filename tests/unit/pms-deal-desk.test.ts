import { describe, it, expect } from 'vitest';
import {
  daysSinceActivity,
  classifyLifecycle,
  LIFECYCLE_BLUE_DAYS,
  LIFECYCLE_YELLOW_DAYS,
  LIFECYCLE_RED_DAYS,
} from '@/lib/pms/deal-desk-service';

const NOW = new Date('2026-07-25T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

describe('deal-desk · daysSinceActivity', () => {
  it('优先用 lastFollowUpAt', () => {
    expect(daysSinceActivity(daysAgo(10), daysAgo(100), NOW)).toBe(10);
  });

  it('无 lastFollowUpAt 回退 createdAt', () => {
    expect(daysSinceActivity(null, daysAgo(30), NOW)).toBe(30);
  });
});

describe('deal-desk · classifyLifecycle (30/60/90 三阶回顾)', () => {
  it('阈值常量为 30/60/90', () => {
    expect(LIFECYCLE_BLUE_DAYS).toBe(30);
    expect(LIFECYCLE_YELLOW_DAYS).toBe(60);
    expect(LIFECYCLE_RED_DAYS).toBe(90);
  });

  it('四级分级 ok/blue/yellow/red', () => {
    expect(classifyLifecycle(0)).toBe('ok');
    expect(classifyLifecycle(LIFECYCLE_BLUE_DAYS - 1)).toBe('ok');
    expect(classifyLifecycle(LIFECYCLE_BLUE_DAYS)).toBe('blue');
    expect(classifyLifecycle(LIFECYCLE_YELLOW_DAYS - 1)).toBe('blue');
    expect(classifyLifecycle(LIFECYCLE_YELLOW_DAYS)).toBe('yellow');
    expect(classifyLifecycle(LIFECYCLE_RED_DAYS - 1)).toBe('yellow');
    expect(classifyLifecycle(LIFECYCLE_RED_DAYS)).toBe('red');
    expect(classifyLifecycle(120)).toBe('red');
  });
});
