import test from 'node:test';
import assert from 'node:assert/strict';
import { touchWeights, attributeConversion, type Touch } from './attribution';

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const t = (channel: string, atDay: number): Touch => ({ channel, at: atDay * 24 * 3600 * 1000 });

test('线性:每触点均分,和为1', () => {
  const w = touchWeights([t('geo', 0), t('paid', 1), t('referral', 2), t('organic', 3)], 'linear');
  assert.deepEqual(w, [0.25, 0.25, 0.25, 0.25]);
  assert.ok(Math.abs(sum(w) - 1) < 1e-9);
});

test('位置(U型):n=2 → 50/50', () => {
  assert.deepEqual(touchWeights([t('a', 0), t('b', 1)], 'position'), [0.5, 0.5]);
});

test('位置(U型):n=3 → 40/20/40', () => {
  const w = touchWeights([t('a', 0), t('b', 1), t('c', 2)], 'position');
  assert.deepEqual(w, [0.4, 0.2, 0.4]);
  assert.ok(Math.abs(sum(w) - 1) < 1e-9);
});

test('时间衰减:越近转化权重越高,和为1', () => {
  const w = touchWeights([t('old', 0), t('recent', 7)], 'time_decay', { halfLifeMs: 7 * 24 * 3600 * 1000 });
  assert.ok(w[1] > w[0], '近触点权重更高');
  assert.ok(Math.abs(sum(w) - 1) < 1e-9);
});

test('单触点 → 独占信用1', () => {
  assert.deepEqual(touchWeights([t('geo', 0)], 'linear'), [1]);
});

test('按渠道聚合:同渠道多触点累加', () => {
  const credit = attributeConversion([t('geo', 0), t('geo', 1), t('paid', 2)], 'linear');
  assert.ok(Math.abs(credit.geo - 2 / 3) < 1e-9);
  assert.ok(Math.abs(credit.paid - 1 / 3) < 1e-9);
  assert.ok(Math.abs((credit.geo + credit.paid) - 1) < 1e-9);
});
