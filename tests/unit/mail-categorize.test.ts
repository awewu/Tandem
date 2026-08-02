import { describe, it, expect } from 'vitest';
import { categorizeEmail, priorityScore, type CategorizableEmail } from '@/lib/mail/categorize';

function mk(partial: { from: string; subject?: string; date?: string; flags?: string[]; seen?: boolean }): CategorizableEmail {
  return {
    from: [{ address: partial.from }],
    subject: partial.subject ?? '',
    date: partial.date ?? new Date().toISOString(),
    flags: partial.flags ?? [],
    seen: partial.seen ?? true,
  };
}

describe('categorizeEmail', () => {
  it('classifies social domains', () => {
    expect(categorizeEmail(mk({ from: 'jobs@linkedin.com', subject: '你有新消息' }))).toBe('social');
    expect(categorizeEmail(mk({ from: 'x@notifications.twitter.com' }))).toBe('social');
  });

  it('classifies promotions by localpart or keywords', () => {
    expect(categorizeEmail(mk({ from: 'marketing@shop.com', subject: 'hi' }))).toBe('promotions');
    expect(categorizeEmail(mk({ from: 'a@b.com', subject: '限时优惠 unsubscribe' }))).toBe('promotions');
  });

  it('classifies updates by system localpart or keywords', () => {
    expect(categorizeEmail(mk({ from: 'noreply@bank.com', subject: 'hi' }))).toBe('updates');
    expect(categorizeEmail(mk({ from: 'a@b.com', subject: '您的发票已生成' }))).toBe('updates');
    expect(categorizeEmail(mk({ from: 'a@b.com', subject: '验证码 123456' }))).toBe('updates');
  });

  it('defaults to primary for a normal colleague', () => {
    expect(categorizeEmail(mk({ from: 'alice@company.com', subject: '关于项目进度' }))).toBe('primary');
  });
});

describe('priorityScore', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');

  it('ranks starred + urgent + known contact highest', () => {
    const important = priorityScore(
      mk({ from: 'boss@company.com', subject: '紧急: 需要立即处理', flags: ['\\Flagged'], seen: false, date: '2026-01-10T10:00:00Z' }),
      { now, isKnownContact: () => true },
    );
    const promo = priorityScore(
      mk({ from: 'marketing@shop.com', subject: '限时优惠', seen: true, date: '2026-01-01T00:00:00Z' }),
      { now },
    );
    expect(important).toBeGreaterThan(promo);
  });

  it('unread scores higher than read, all else equal', () => {
    const unread = priorityScore(mk({ from: 'a@b.com', subject: 'x', seen: false, date: '2026-01-10T11:00:00Z' }), { now });
    const read = priorityScore(mk({ from: 'a@b.com', subject: 'x', seen: true, date: '2026-01-10T11:00:00Z' }), { now });
    expect(unread).toBeGreaterThan(read);
  });

  it('demotes promotions', () => {
    const promo = priorityScore(mk({ from: 'promo@x.com', subject: 'sale', seen: true, date: '2026-01-10T11:00:00Z' }), { now });
    const primary = priorityScore(mk({ from: 'alice@company.com', subject: 'hello', seen: true, date: '2026-01-10T11:00:00Z' }), { now });
    expect(primary).toBeGreaterThan(promo);
  });
});
