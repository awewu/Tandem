import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMargin } from './pricing-gate';

test('毛利闸：毛利率≥阈值 → 过闸', () => {
  const r = computeMargin(1000, 700, 0.15); // 30% 毛利
  assert.equal(r.marginAmt, 300);
  assert.ok(Math.abs(r.marginRate - 0.3) < 1e-9);
  assert.equal(r.gatePassed, true);
});

test('毛利闸：毛利率<阈值 → 拦截', () => {
  const r = computeMargin(1000, 900, 0.15); // 10% 毛利
  assert.equal(r.gatePassed, false);
});

test('毛利闸：边界(恰等于阈值) → 过闸', () => {
  const r = computeMargin(1000, 850, 0.15); // 恰 15%
  assert.equal(r.gatePassed, true);
});

test('毛利闸：拟定价为0/负成本兜底不崩', () => {
  assert.equal(computeMargin(0, 0, 0.15).gatePassed, false);
  assert.equal(computeMargin(1000, 0, 0.15).gatePassed, true); // 100% 毛利
});
