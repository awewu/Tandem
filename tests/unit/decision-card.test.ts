import { describe, it, expect } from 'vitest';
import {
  validateKrBinding,
  classifyDecision,
  KR_BINDING_REASON_MIN_LENGTH,
} from '@/lib/types/decision-card';

describe('validateKrBinding · Q2 软绑定守门', () => {
  it('rejects when neither krId nor reason given', () => {
    const r = validateKrBinding({ primaryKrId: null, noKrReason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('missing_both');
  });

  it('rejects when both given (XOR)', () => {
    const r = validateKrBinding({ primaryKrId: 'kr_1', noKrReason: '充分的理由说明' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('both_present');
  });

  it('accepts a valid primaryKrId', () => {
    const r = validateKrBinding({ primaryKrId: 'kr_1', noKrReason: null });
    expect(r.ok).toBe(true);
  });

  it('accepts a long enough reason', () => {
    const r = validateKrBinding({
      primaryKrId: null,
      noKrReason: '这是一个超过十字符的解释理由',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects too-short reason (< MIN_LENGTH)', () => {
    const short = 'a'.repeat(KR_BINDING_REASON_MIN_LENGTH - 1);
    const r = validateKrBinding({ primaryKrId: null, noKrReason: short });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('reason_too_short');
  });
});

describe('classifyDecision', () => {
  it('relatedKr length > 1 → strategic', () => {
    expect(classifyDecision({ relatedKr: ['a', 'b'] })).toBe('strategic');
  });

  it('elapsedSeconds > 600 → complex', () => {
    expect(classifyDecision({ elapsedSeconds: 700 })).toBe('complex');
  });

  it('default → simple', () => {
    expect(classifyDecision({})).toBe('simple');
  });
});
