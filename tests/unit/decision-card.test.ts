import { describe, it, expect } from 'vitest';
import {
  validateOkrAnchor,
  validateKrBinding, // deprecated alias, 兼容性测试
  classifyDecision,
  KR_BINDING_REASON_MIN_LENGTH,
} from '@/lib/types/decision-card';

describe('validateOkrAnchor · V1.5 严绑定守门 (OKR-DRIVEN §三第4条)', () => {
  it('rejects when neither krId nor reason given', () => {
    const r = validateOkrAnchor({ primaryKrId: null, noKrReason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('missing_both');
  });

  it('rejects when both given (XOR)', () => {
    const r = validateOkrAnchor({
      primaryKrId: 'kr_1',
      noKrReason: 'a'.repeat(KR_BINDING_REASON_MIN_LENGTH),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('both_present');
  });

  it('accepts a valid primaryKrId (anchored state)', () => {
    const r = validateOkrAnchor({ primaryKrId: 'kr_1', noKrReason: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.anchorState).toBe('anchored');
  });

  it('accepts a long enough reason (unanchored_with_reason state, ≥30 字)', () => {
    const r = validateOkrAnchor({
      primaryKrId: null,
      noKrReason: '本议事是跨年度战略反思, 当前周期 KR 尚未定义, 因此无锚但有充分理由',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.anchorState).toBe('unanchored_with_reason');
  });

  // V1.5 严绑定: 10 字短理由 (V1 允许) 现在应被拒绝
  it('rejects reason < 30 chars (V1.5 严绑定升级)', () => {
    const r = validateOkrAnchor({
      primaryKrId: null,
      noKrReason: '这是一个超过十字符的解释理由', // 13 字, 旧版通过, 新版拒绝
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('reason_too_short');
  });

  it('validateKrBinding alias 仍工作 (向后兼容)', () => {
    const r = validateKrBinding({ primaryKrId: 'kr_1', noKrReason: null });
    expect(r.ok).toBe(true);
  });

  it('legacy long reason still passes', () => {
    const r = validateOkrAnchor({
      primaryKrId: null,
      noKrReason: '这是一个充分的, 至少三十个汉字以上的, 充分论证不锚 KR 的理由',
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
