import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  computeWarningLevel,
  isClaimable,
} from '@/lib/pms/public-pool-service';

const DAY = 86_400_000;

describe('PMS public-pool · daysBetween', () => {
  it('整天数向下取整', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    expect(daysBetween(new Date(now.getTime() - 10 * DAY), now)).toBe(10);
    expect(daysBetween(new Date(now.getTime() - 10 * DAY - DAY / 2), now)).toBe(10);
  });

  it('未来时间返回 0 (不为负)', () => {
    const now = new Date('2026-04-01T00:00:00Z');
    expect(daysBetween(new Date(now.getTime() + 5 * DAY), now)).toBe(0);
  });
});

describe('PMS public-pool · computeWarningLevel (90天管控)', () => {
  const now = new Date('2026-04-01T00:00:00Z');
  const ago = (d: number) => new Date(now.getTime() - d * DAY);

  it('< 75 天 → none', () => {
    expect(computeWarningLevel(ago(0), now).level).toBe('none');
    expect(computeWarningLevel(ago(74), now).level).toBe('none');
  });

  it('[75, 90) 天 → yellow', () => {
    expect(computeWarningLevel(ago(75), now).level).toBe('yellow');
    expect(computeWarningLevel(ago(89), now).level).toBe('yellow');
  });

  it('>= 90 天 → red', () => {
    expect(computeWarningLevel(ago(90), now).level).toBe('red');
    expect(computeWarningLevel(ago(200), now).level).toBe('red');
  });

  it('自定义阈值生效', () => {
    expect(computeWarningLevel(ago(30), now, 30, 60).level).toBe('yellow');
    expect(computeWarningLevel(ago(60), now, 30, 60).level).toBe('red');
  });

  it('返回未跟进天数', () => {
    expect(computeWarningLevel(ago(88), now).days).toBe(88);
  });
});

describe('PMS public-pool · isClaimable', () => {
  const now = new Date('2026-04-01T00:00:00Z');

  it('已认领 → 不可', () => {
    expect(isClaimable({ claimed: true, protectionExpiresAt: null }, now)).toBe(false);
  });

  it('无保护期且未认领 → 可', () => {
    expect(isClaimable({ claimed: false, protectionExpiresAt: null }, now)).toBe(true);
    expect(isClaimable({ claimed: false }, now)).toBe(true);
  });

  it('保护期未到 → 不可 (原属主优先恢复)', () => {
    const future = new Date(now.getTime() + 3 * DAY);
    expect(isClaimable({ claimed: false, protectionExpiresAt: future }, now)).toBe(false);
  });

  it('保护期已过 → 可', () => {
    const past = new Date(now.getTime() - DAY);
    expect(isClaimable({ claimed: false, protectionExpiresAt: past }, now)).toBe(true);
  });
});
