import { describe, it, expect } from 'vitest';
import {
  severityWeight,
  shouldEscalate,
  resolveChannels,
} from '@/lib/pms/alert-service';

describe('PMS alert · severityWeight', () => {
  it('critical>high>medium>low>unknown', () => {
    expect(severityWeight('critical')).toBeGreaterThan(severityWeight('high'));
    expect(severityWeight('high')).toBeGreaterThan(severityWeight('medium'));
    expect(severityWeight('medium')).toBeGreaterThan(severityWeight('low'));
    expect(severityWeight('low')).toBeGreaterThan(severityWeight('xxx'));
  });
});

describe('PMS alert · shouldEscalate', () => {
  const created = new Date('2026-06-01T10:00:00Z');
  it('未处理且超 SLA → 升级', () => {
    const now = new Date('2026-06-01T10:31:00Z'); // 31 min later
    expect(shouldEscalate(created, 30, false, now)).toBe(true);
  });
  it('未处理但未超 SLA → 不升级', () => {
    const now = new Date('2026-06-01T10:20:00Z');
    expect(shouldEscalate(created, 30, false, now)).toBe(false);
  });
  it('已处理 → 不升级', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    expect(shouldEscalate(created, 30, true, now)).toBe(false);
  });
  it('无 SLA → 不升级', () => {
    const now = new Date('2026-06-02T10:00:00Z');
    expect(shouldEscalate(created, null, false, now)).toBe(false);
    expect(shouldEscalate(created, 0, false, now)).toBe(false);
  });
});

describe('PMS alert · resolveChannels', () => {
  it('合并启用规则渠道, 去重保序', () => {
    const rules = [
      { channels: ['im', 'sms'], enabled: true },
      { channels: ['sms', 'email'], enabled: true },
      { channels: ['push'], enabled: false },
    ];
    expect(resolveChannels(rules)).toEqual(['im', 'sms', 'email']);
  });
  it('全禁用 → 空', () => {
    expect(resolveChannels([{ channels: ['im'], enabled: false }])).toEqual([]);
  });
});
