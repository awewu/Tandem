import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeHotWaterLoad, selectHotWaterUnit, computeHotWaterDesign, HotWaterCandidate } from './hot-water-sizing';

// P1-1 ②③ · 热水真精算：负荷方法可复现 + 仅 verified 驱动选型 + 未验证只进 BOM。

test('sizeHotWaterLoad：显式全参 → verified，负荷可复现', () => {
  // 4 人 × 60L = 240L/日；ΔT=45℃；E = 240×4.187×45/3600 = 12.561 kWh；/8h ≈ 1.57 kW
  const load = sizeHotWaterLoad({ residents: 4, perCapitaLiters: 60, targetTempC: 60, inletTempC: 15, recoveryHours: 8 });
  assert.equal(load.trust, 'verified');
  assert.equal(load.dailyDemandLiters, 240);
  assert.equal(load.deltaTempC, 45);
  assert.equal(load.dailyEnergyKwh, 12.56);
  assert.equal(load.requiredHeatingKw, 1.57);
  assert.equal(load.assumptions.length, 0);
});

test('sizeHotWaterLoad：缺人数按面积估算 + 缺项 calibrated 显式标注', () => {
  const load = sizeHotWaterLoad({ area: 140, city: '上海' });
  assert.equal(load.trust, 'calibrated');
  assert.equal(load.residents, 4); // 140/35=4
  assert.equal(load.inletTempC, 15); // 上海季节缺省
  assert.ok(load.assumptions.some((a) => a.includes('35 ㎡/人') && a.includes('calibrated')));
  assert.ok(load.assumptions.some((a) => a.includes('进水温度')));
});

test('sizeHotWaterLoad：未知城市进水温度回退 15℃', () => {
  const load = sizeHotWaterLoad({ residents: 3, city: '火星城' });
  assert.equal(load.inletTempC, 15);
});

const CANDIDATES: HotWaterCandidate[] = [
  { globalProductId: 'gp_v_small', name: '瑞好空气能热水器 3kW', dataTrustLevel: 'verified', canonicalParams: { heatingCapacityKw: 3, cop: 4.2, tankVolumeL: 200 }, listPrice: 8800 },
  { globalProductId: 'gp_v_big', name: '瑞好空气能热水器 6kW', dataTrustLevel: 'verified', canonicalParams: { heatingCapacityKw: 6, cop: 4.0, tankVolumeL: 300 }, listPrice: 12800 },
  { globalProductId: 'gp_cal', name: '第三方热泵(校准)', dataTrustLevel: 'calibrated', canonicalParams: { heatingCapacityKw: 5 }, listPrice: 6000 },
  { globalProductId: 'gp_unv', name: '杂牌热水机(未验证)', dataTrustLevel: 'unverified', canonicalParams: {}, listPrice: 3000 },
];

test('selectHotWaterUnit：仅 verified 驱动选型，选满足负荷的最小机型', () => {
  const sel = selectHotWaterUnit(2.5, CANDIDATES);
  assert.equal(sel.recommended?.globalProductId, 'gp_v_small', '3kW 满足 2.5kW，应选最小满足机型');
  assert.equal(sel.selectionTrust, 'verified');
});

test('selectHotWaterUnit：calibrated/unverified 一律进 BOM 备选、不驱动精算', () => {
  const sel = selectHotWaterUnit(2.5, CANDIDATES);
  const names = sel.bomOnlyAlternatives.map((b) => b.name);
  assert.ok(names.includes('第三方热泵(校准)'), 'calibrated 不驱动精算');
  assert.ok(names.includes('杂牌热水机(未验证)'), 'unverified 不驱动精算');
  assert.ok(sel.bomOnlyAlternatives.every((b) => /不驱动精算/.test(b.reason)));
  // 关键红线：5kW 的 calibrated 机型即使容量更合适，也绝不被选为 recommended
  assert.notEqual(sel.recommended?.name, '第三方热泵(校准)');
});

test('selectHotWaterUnit：负荷超最大 verified 机型 → 取最大并告警', () => {
  const sel = selectHotWaterUnit(10, CANDIDATES);
  assert.equal(sel.recommended?.globalProductId, 'gp_v_big');
  assert.ok(sel.warnings.some((w) => w.includes('仍低于所需')));
});

test('selectHotWaterUnit：无 verified 可用 → insufficient_data', () => {
  const sel = selectHotWaterUnit(3, [
    { name: 'X', dataTrustLevel: 'calibrated', canonicalParams: { heatingCapacityKw: 5 } },
    { name: 'Y', dataTrustLevel: 'unverified' },
  ]);
  assert.equal(sel.recommended, null);
  assert.equal(sel.selectionTrust, 'insufficient_data');
  assert.equal(sel.bomOnlyAlternatives.length, 2);
});

test('selectHotWaterUnit：verified 但缺 COP → selectionTrust 降级 calibrated', () => {
  const sel = selectHotWaterUnit(2, [
    { name: 'V缺COP', dataTrustLevel: 'verified', canonicalParams: { heatingCapacityKw: 4, tankVolumeL: 200 } },
  ]);
  assert.equal(sel.recommended?.name, 'V缺COP');
  assert.equal(sel.selectionTrust, 'calibrated');
  assert.ok(sel.warnings.some((w) => w.includes('COP')));
});

test('computeHotWaterDesign：端到端 overall trust = 负荷∧选型', () => {
  const verifiedInput = { residents: 4, perCapitaLiters: 60, targetTempC: 60, inletTempC: 15, recoveryHours: 8 };
  const r = computeHotWaterDesign(verifiedInput, CANDIDATES);
  assert.equal(r.system, 'hotWater');
  assert.equal(r.selection.selectionTrust, 'verified');
  assert.ok(!r.disclaimer.includes('calibrated'), '全 verified 时免责声明不含 calibrated 警示');

  const calibratedInput = { area: 140, city: '上海' }; // 负荷 calibrated
  const r2 = computeHotWaterDesign(calibratedInput, CANDIDATES);
  assert.ok(r2.disclaimer.includes('calibrated'), '含缺省时须标注不可作合规辩护');
});
