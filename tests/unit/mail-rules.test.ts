import { describe, it, expect } from 'vitest';
import { ruleMatches, evaluateRules, sanitizeRules, type MailRule, type RuleEvaluableEmail } from '@/lib/mail/rules';

function rule(partial: Partial<MailRule>): MailRule {
  return {
    id: partial.id ?? 'r1',
    name: partial.name ?? 'test',
    enabled: partial.enabled ?? true,
    match: partial.match ?? 'all',
    conditions: partial.conditions ?? {},
    actions: partial.actions ?? {},
  };
}

function email(partial: Partial<RuleEvaluableEmail> & { uid: number }): RuleEvaluableEmail {
  return {
    uid: partial.uid,
    from: partial.from ?? [{ address: 'a@b.com' }],
    to: partial.to ?? [{ address: 'me@company.com' }],
    subject: partial.subject ?? '',
  };
}

describe('ruleMatches', () => {
  it('matches fromContains case-insensitively', () => {
    const r = rule({ conditions: { fromContains: 'BOSS@company' } });
    expect(ruleMatches(r, email({ uid: 1, from: [{ address: 'boss@company.com' }] }))).toBe(true);
    expect(ruleMatches(r, email({ uid: 2, from: [{ address: 'other@x.com' }] }))).toBe(false);
  });

  it('all vs any semantics', () => {
    const all = rule({ match: 'all', conditions: { fromContains: 'boss', subjectContains: '紧急' } });
    const any = rule({ match: 'any', conditions: { fromContains: 'boss', subjectContains: '紧急' } });
    const e = email({ uid: 1, from: [{ address: 'boss@x.com' }], subject: '日报' });
    expect(ruleMatches(all, e)).toBe(false); // subject 不含"紧急"
    expect(ruleMatches(any, e)).toBe(true);  // from 命中即可
  });

  it('disabled rule never matches', () => {
    const r = rule({ enabled: false, conditions: { fromContains: 'a@b.com' } });
    expect(ruleMatches(r, email({ uid: 1 }))).toBe(false);
  });

  it('rule with no conditions matches nothing', () => {
    const r = rule({ conditions: {} });
    expect(ruleMatches(r, email({ uid: 1 }))).toBe(false);
  });
});

describe('evaluateRules', () => {
  it('short-circuits to first matching rule per email', () => {
    const rules: MailRule[] = [
      rule({ id: 'archive', name: '归档', conditions: { fromContains: 'newsletter' }, actions: { moveTo: 'Archive' } }),
      rule({ id: 'star', name: '星标', conditions: { fromContains: 'newsletter' }, actions: { star: true } }),
    ];
    const applied = evaluateRules(rules, [email({ uid: 5, from: [{ address: 'newsletter@x.com' }] })]);
    expect(applied).toHaveLength(1);
    expect(applied[0].ruleId).toBe('archive');
    expect(applied[0].actions.moveTo).toBe('Archive');
  });

  it('returns nothing when no rule matches', () => {
    const rules = [rule({ conditions: { fromContains: 'zzz' } })];
    expect(evaluateRules(rules, [email({ uid: 1 })])).toHaveLength(0);
  });
});

describe('sanitizeRules', () => {
  it('drops invalid entries and fills defaults', () => {
    const out = sanitizeRules([
      { name: 'ok', conditions: { fromContains: 'a' }, actions: { markRead: true } },
      null,
      'garbage',
      { conditions: { subjectContains: 'x' } },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].enabled).toBe(true);
    expect(out[0].match).toBe('all');
    expect(out[0].actions.markRead).toBe(true);
    expect(out[1].name).toBe('未命名规则');
  });

  it('returns [] for non-array', () => {
    expect(sanitizeRules('nope')).toEqual([]);
    expect(sanitizeRules(null)).toEqual([]);
  });
});
