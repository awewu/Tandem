import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRebateMargin } from './rebate-gate';

test('返利毛利闸：返利后净毛利≥阈值 → 过闸', () => {
  const r = computeRebateMargin(500, 10000, 0.2, 0.05); // 返利占比5%,净毛利15%
  assert.ok(Math.abs(r.rebateRatio - 0.05) < 1e-9);
  assert.ok(Math.abs(r.netMarginRate - 0.15) < 1e-9);
  assert.equal(r.gatePassed, true);
});

test('返利毛利闸：返利吃穿毛利 → 拦截', () => {
  const r = computeRebateMargin(1800, 10000, 0.2, 0.05); // 返利18%,净毛利2%
  assert.equal(r.gatePassed, false);
});

test('返利毛利闸：GMV=0 兜底不崩(净毛利=基线)', () => {
  const r = computeRebateMargin(100, 0, 0.2, 0.05);
  assert.equal(r.rebateRatio, 0);
  assert.equal(r.gatePassed, true);
});
