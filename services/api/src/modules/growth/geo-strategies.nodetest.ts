import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendHierarchicalDelta, selectStrategies } from './geo-strategies';

// 三层收缩估计：解决「新品牌从零学」与「n=1 就学」两个硬伤
const K = { kBrand: 5, kCategory: 3, scale: 0.2, cap: 5 };

test('新品牌(n_brand=0)继承品类先验，而不是从零', () => {
  const r = blendHierarchicalDelta({ brandN: 0, brandSum: 0, categoryN: 6, categorySum: 60 }, K);
  assert.equal(r.source, 'category', '来源应标记为继承自品类');
  assert.ok(r.delta > 0, '有正向品类经验时，新品牌应获得正增量');
  // 品类均值 10，向 L0 收缩：6*10/(6+3)=6.67 → ×0.2 ≈ 1.3
  assert.ok(Math.abs(r.delta - 1.3) < 0.15, `继承值应≈品类先验×scale，实际 ${r.delta}`);
});

test('完全无数据时不产生权重（不臆造）', () => {
  const r = blendHierarchicalDelta({ brandN: 0, brandSum: 0, categoryN: 0, categorySum: 0 }, K);
  assert.equal(r.delta, 0);
  assert.equal(r.source, 'none');
});

test('n=1 的极端值被先验主导，噪声不冒充经验', () => {
  // 品牌仅 1 次实验且 lift 极高(100)，品类经验平平(均值 0)
  const noisy = blendHierarchicalDelta({ brandN: 1, brandSum: 100, categoryN: 10, categorySum: 0 }, K);
  // 若不做收缩，delta 会是 100*0.2=20；收缩后应远小于此
  assert.ok(noisy.delta < 5, `单次噪声不应主导，实际 ${noisy.delta}`);
  assert.ok(noisy.brandAvg === 100, '原始品牌均值仍如实暴露，便于排查');
});

test('样本变大时收敛到品牌自身经验', () => {
  const small = blendHierarchicalDelta({ brandN: 1, brandSum: 20, categoryN: 10, categorySum: 0 }, K);
  const large = blendHierarchicalDelta({ brandN: 50, brandSum: 1000, categoryN: 10, categorySum: 0 }, K);
  assert.ok(large.delta > small.delta, '大样本应更贴近品牌自身均值(20)');
  assert.ok(Math.abs(large.delta - 20 * 0.2) < 0.6, `大样本应收敛到 brandAvg×scale，实际 ${large.delta}`);
});

test('增量有上下限，防单点主导', () => {
  const huge = blendHierarchicalDelta({ brandN: 100, brandSum: 100000, categoryN: 0, categorySum: 0 }, K);
  assert.equal(huge.delta, 5, '应被 cap 夹住');
  const negative = blendHierarchicalDelta({ brandN: 100, brandSum: -100000, categoryN: 0, categorySum: 0 }, K);
  assert.equal(negative.delta, -5, '负向同样被夹住');
});

test('负 lift 会降权（自进化能纠错，不是只会加分）', () => {
  const r = blendHierarchicalDelta({ brandN: 10, brandSum: -50, categoryN: 10, categorySum: -50 }, K);
  assert.ok(r.delta < 0, '持续负 lift 的策略应被降权');
});

test('权重覆盖会改变策略选择顺序（自进化真的影响产出）', () => {
  const before = selectStrategies('comparison', { max: 4 });
  const after = selectStrategies('comparison', { max: 4, weightOverrides: { quotation: 50 } });
  const rank = (list: { key: string }[]) => list.findIndex((s) => s.key === 'quotation');
  assert.ok(rank(after) >= 0, '被大幅提权的策略应入选');
  assert.ok(rank(after) <= Math.max(rank(before), 0), '提权后排序应不劣于提权前');
});
