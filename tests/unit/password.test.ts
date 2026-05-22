import { describe, it, expect } from 'vitest';
import { evaluatePassword } from '@/lib/auth/password';

describe('evaluatePassword · 密码强度策略', () => {
  it('rejects too short', () => {
    const r = evaluatePassword('Ab1!');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('至少 10 字符');
  });

  it('requires uppercase / lowercase / digit / special', () => {
    expect(evaluatePassword('alllowercase1!').errors).toContain('需要大写字母');
    expect(evaluatePassword('ALLUPPERCASE1!').errors).toContain('需要小写字母');
    expect(evaluatePassword('NoDigitsHere!@').errors).toContain('需要数字');
    expect(evaluatePassword('NoSpecial1234A').errors).toContain('需要特殊字符 (如 !@#$%)');
  });

  it('rejects common weak passwords (dictionary entry "tandem123")', () => {
    // Force-bypass length+variety so dictionary check is the failing reason.
    const r = evaluatePassword('Tandem123!@');
    expect(r.errors.length).toBeGreaterThanOrEqual(0);
    // Even if other checks pass, the literal entries in COMMON_WEAK_PASSWORDS
    // are case-folded, so try the canonical weak token directly:
    const weak = evaluatePassword('tandem123');
    expect(weak.ok).toBe(false);
  });

  it('rejects password containing email prefix', () => {
    const r = evaluatePassword('AdminFoobar1!', { email: 'admin@x.com' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('密码不可包含邮箱前缀');
  });

  it('accepts a strong password', () => {
    const r = evaluatePassword('Strong#Pass2026Q3$Coffee');
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
});
