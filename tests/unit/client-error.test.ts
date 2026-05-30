/**
 * §观测埋点 · client-error 纯逻辑单测
 *
 * 覆盖:
 *  1. fingerprint 稳定 (相同输入 → 相同输出, 不同输入 → 不同输出, ≤200 字)
 *  2. shouldReport 第一次 true, 同 fp 第二次 false (dedup)
 *  3. shouldReport 累计超 MAX_PER_SESSION 后 false (cap)
 *  4. reasonToMsg 处理 Error/string/object 三种 + 不抛
 *  5. 无 sessionStorage 时 (ss=null) 不报 (return false), 不抛
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  fingerprint,
  shouldReport,
  reasonToMsg,
  MAX_PER_SESSION,
  type SessionStorageLike,
} from '../../lib/analytics/client-error';

function makeMemSS(): SessionStorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, v); },
  };
}

describe('client-error · fingerprint', () => {
  it('produces stable & differing fingerprints', () => {
    const a = fingerprint('boom', 'a.js', 1, 2);
    const a2 = fingerprint('boom', 'a.js', 1, 2);
    const b = fingerprint('boom', 'a.js', 1, 3);
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });

  it('caps at 200 chars even with huge msg', () => {
    const huge = 'x'.repeat(500);
    expect(fingerprint(huge, 'src', 1, 2).length).toBeLessThanOrEqual(200);
  });
});

describe('client-error · shouldReport (dedup + cap)', () => {
  let ss: SessionStorageLike;

  beforeEach(() => {
    ss = makeMemSS();
  });

  it('first occurrence reports, second of same fp does not (dedup)', () => {
    expect(shouldReport(ss, 'fp-a')).toBe(true);
    expect(shouldReport(ss, 'fp-a')).toBe(false);
  });

  it('caps at MAX_PER_SESSION across distinct fingerprints', () => {
    let allowed = 0;
    for (let i = 0; i < MAX_PER_SESSION + 5; i++) {
      if (shouldReport(ss, `fp-${i}`)) allowed++;
    }
    expect(allowed).toBe(MAX_PER_SESSION);
  });

  it('returns false silently when no sessionStorage', () => {
    expect(shouldReport(null, 'fp-x')).toBe(false);
  });
});

describe('client-error · reasonToMsg', () => {
  it('Error → message', () => {
    expect(reasonToMsg(new Error('hi'))).toBe('hi');
  });

  it('string → as-is', () => {
    expect(reasonToMsg('plain reason')).toBe('plain reason');
  });

  it('object → JSON', () => {
    expect(reasonToMsg({ code: 42 })).toBe(JSON.stringify({ code: 42 }));
  });

  it('non-stringifiable circular → unknown, no throw', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(() => reasonToMsg(o)).not.toThrow();
    expect(reasonToMsg(o)).toBe('unknown');
  });

  it('null/undefined → unknown', () => {
    expect(reasonToMsg(null)).toBe(JSON.stringify(null));   // 'null'
    expect(reasonToMsg(undefined)).toBe('unknown');          // JSON.stringify(undefined) = undefined
  });
});
