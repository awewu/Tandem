/**
 * HVAC kernels 域覆盖基准集（P0-2 · 2026-08-04）
 *
 * 背景：内核 7,456 行 / 9 域，此前仅 regression-baseline.test.js 覆盖
 *       load-calculation / noise / water-system 三域，其余六域零覆盖。
 *       内核是「客户专业度」的核心资产——算错的代价是品牌信任，必须有防线。
 *
 * 本文件两类断言，作用不同，不可混淆：
 *   ① 黄金值（frozen 2026-08-04）—— 只防**漂移**。任何改动使结果变化即失败，倒逼复核。
 *      黄金值 ≠ 正确性证明；它冻结的是「当前行为」，正确性需领域评审对国标核对。
 *   ② 不变量 —— 防**算错**。这些断言在任何合理实现下都必须成立
 *      （非 NaN/非 null、负荷为正、随面积单调、结构完整）。
 */

'use strict';

const k = require('../index');

/** 递归断言：对象内不得出现 NaN —— 静默 NaN 会一路流到方案里且不抛错。 */
function assertNoNaN(value, path = '$') {
  if (typeof value === 'number') {
    expect(Number.isNaN(value)).toBe(false);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) assertNoNaN(v, `${path}.${key}`);
  }
}

describe('heating 采暖内核', () => {
  test('黄金值：上海 120m² medium 保温', () => {
    const r = k.heating.calculateHeatLoad(120, 120, 'medium', '上海');
    expect(r.totalLoad).toBe(6120);
    expect(r.loadPerArea).toBe(51);
    expect(r.baseLoad).toBe(60);
    expect(r.factors).toEqual({ insulation: 1, city: 0.85 });
  });

  test('不变量：负荷为正且随面积单调递增', () => {
    const small = k.heating.calculateHeatLoad(60, 60, 'medium', '上海');
    const large = k.heating.calculateHeatLoad(240, 240, 'medium', '上海');
    expect(small.totalLoad).toBeGreaterThan(0);
    expect(large.totalLoad).toBeGreaterThan(small.totalLoad);
  });

  test('不变量：designHeatingSystem 结构完整且无 NaN', () => {
    const d = k.heating.designHeatingSystem({ area: 120, floorArea: 120, city: '上海', insulation: 'medium', houseType: '三居' });
    expect(Object.keys(d)).toEqual(expect.arrayContaining(['heatLoad', 'heatSource', 'systems', 'summary']));
    expect(d.heatLoad.totalLoad).toBeGreaterThan(0);
    assertNoNaN(d.heatLoad);
  });
});

describe('hot-water 热水内核', () => {
  const P = { area: 120, persons: 3, city: '上海', floors: 2, bathrooms: 2 };

  test('黄金值：120m²/3人/2卫 住宅热水负荷', () => {
    const r = k.hotWater.calculateResidentialHotWater(P);
    expect(r.load.dailyUsage).toBe(180);
    expect(r.load.peakHourlyUsage).toBe(72);
    expect(r.load.heatLoad).toBe('4.18');
    expect(r.load.storageVolume).toBe(24);
  });

  test('不变量：用水量随人数单调递增', () => {
    const one = k.hotWater.calculateResidentialHotWater({ ...P, persons: 1 });
    const six = k.hotWater.calculateResidentialHotWater({ ...P, persons: 6 });
    expect(one.load.dailyUsage).toBeGreaterThan(0);
    expect(six.load.dailyUsage).toBeGreaterThan(one.load.dailyUsage);
  });

  test('不变量：产出含选型与循环，且无 NaN', () => {
    const r = k.hotWater.calculateResidentialHotWater(P);
    expect(Object.keys(r)).toEqual(expect.arrayContaining(['load', 'heater', 'circulation', 'pipes']));
    assertNoNaN(r.load);
  });
});

describe('air-conditioning 空调内核', () => {
  const BASE = { area: 120, city: '上海', houseType: '三居', residents: 3 };

  test('黄金值：无房间清单时的冷负荷构成', () => {
    const d = k.airConditioning.designAirConditioning(BASE);
    expect(d.loads.cooling.totalLoad).toBe(3056);
    expect(d.loads.cooling.components).toEqual({ envelope: 1728, internal: 1328, freshAir: 0 });
    expect(d.loads.cooling.safetyFactor).toBe(1.1);
  });

  // 回归：房间对象缺 name 时 selectIndoorUnit/suggestIndoorType 曾直接崩溃，
  // 导致整份空调设计不可用（2026-08-04 修复为缺失回落默认型式）。
  test('回归：房间缺 name 不得崩溃', () => {
    expect(() => k.airConditioning.designAirConditioning({
      ...BASE,
      rooms: [{ type: 'livingRoom', area: 35 }, { type: 'bedroom', area: 18 }],
    })).not.toThrow();
  });

  // ⚠️ 待领域评审后启用（宪章 §8 未决 #4）：
  // 房间级 calculateRoomLoad = 120 W/m²（与 quickEstimate 一致），
  // 整机级 calculateCoolingLoad = 25 W/m²（且 freshAir 分项为 0），同引擎相差 4.8 倍。
  // 物理上「整机冷负荷 ≥ 各房间负荷之和」必须成立。暖通评审核定后，删掉 .skip 即为红线。
  test.skip('不变量（待评审启用）：整机冷负荷不得小于各房间负荷之和', () => {
    const d = k.airConditioning.designAirConditioning({
      ...BASE,
      rooms: [{ name: '客厅', area: 35 }, { name: '主卧', area: 18 }, { name: '次卧', area: 15 }],
    });
    const sumRooms = d.loads.cooling.roomLoads.reduce((s, r) => s + r.load, 0);
    expect(d.loads.cooling.totalLoad).toBeGreaterThanOrEqual(sumRooms);
  });

  test('带房间清单可产出室内机配置', () => {
    const d = k.airConditioning.designAirConditioning({
      ...BASE,
      rooms: [{ name: '客厅', area: 35 }, { name: '主卧', area: 18 }, { name: '次卧', area: 15 }],
    });
    expect(d.acSystem.indoorUnits.length).toBe(3);
    assertNoNaN(d.loads);
  });
});

describe('fresh-air 新风内核', () => {
  test('黄金值：120m²/3人 standard 等级', () => {
    const d = k.freshAir.designFreshAir({ area: 120, occupancy: 3, height: 2.8, climateZone: '夏热冬冷', level: 'standard' });
    expect(d.performance.totalFreshAir).toBe('180 m³/h');
    expect(d.performance.perPerson).toBe('60 m³/h·人');
    expect(d.performance.perSqm).toBe('1.5 m³/h·㎡');
    expect(d.performance.airChanges).toBe('0.5 次/h');
  });

  test('不变量：新风量随人数单调不减', () => {
    const few = k.freshAir.designFreshAir({ area: 120, occupancy: 2, level: 'standard' });
    const many = k.freshAir.designFreshAir({ area: 120, occupancy: 8, level: 'standard' });
    const num = (s) => parseFloat(String(s));
    expect(num(many.performance.totalFreshAir)).toBeGreaterThanOrEqual(num(few.performance.totalFreshAir));
  });

  // facade 的 calculateAirVolume 第 4 参是 STANDARDS 对象而非字符串；
  // 传错类型会静默返回一堆 null 而不抛错——此测试锁住"传对就必须有值"。
  test('不变量：calculateAirVolume 传入合法 standard 不得返回 null', () => {
    const engine = new k.freshAir.FreshAirProEngine();
    const standard = engine.STANDARDS.standard || engine.STANDARDS.residential;
    const r = engine.calculateAirVolume(120, 3, [], standard);
    expect(r.byArea).toBeGreaterThan(0);
    expect(r.byPerson).not.toBeNull();
    expect(r.total).not.toBeNull();
  });
});

describe('hydraulic 水力内核', () => {
  test('可实例化且暴露方法', () => {
    const Engine = k.hydraulic.HydraulicEngine;
    expect(typeof Engine).toBe('function');
    const inst = new Engine();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter((m) => m !== 'constructor');
    expect(methods.length).toBeGreaterThan(0);
  });
});

describe('quotation 报价内核', () => {
  // 当前 facade 的 generateQuotation 对最小入参返回空对象（无 items/无总价）。
  // 冻结此现状以防被误认为"已可用"；正式启用前须由领域评审补齐入参契约。
  test('现状记录：最小入参返回空产出（待补入参契约）', () => {
    const q = k.quotation.generateQuotation({ area: 120, city: '上海', systems: ['heating'] });
    expect(q).toBeDefined();
    expect(Object.keys(q || {}).length).toBe(0);
  });
});
