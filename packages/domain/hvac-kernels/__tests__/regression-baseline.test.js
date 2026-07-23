/**
 * HVAC kernels 回归基准集（W1 · 决议#1）
 *
 * 目的：精算归位后，冻结 kernel 关键输出，任何引擎改动若使结果漂移则测试失败，
 *       倒逼复核（国标为底线，企标更严不更松）。
 * 范围：loadCalculation.quickEstimate（负荷）+ noise.evaluateRoomNoise（GB 50118 噪声）。
 *
 * 黄金值由 2026-06 迁移完成时的 kernel 输出冻结；如需更新须经评审并记录依据。
 */

'use strict';

const k = require('../index');
const LoadCalcV3 = require('../load-calculation/LoadCalculationEngineV3');

describe('HVAC kernels 回归基准集 (W1)', () => {
  describe('loadCalculation.quickEstimate', () => {
    const engine = new LoadCalcV3();

    test('上海 120m² 住宅 — 冷/热负荷基准', () => {
      const r = engine.quickEstimate(120, '上海', 'residential');
      expect(r.coolingLoad).toBe(14.4);
      expect(r.heatingLoad).toBe(12);
      expect(r.accuracy).toBe('±30%');
    });

    test('北京 90m² 住宅 — 冷/热负荷基准', () => {
      const r = engine.quickEstimate(90, '北京', 'residential');
      expect(r.coolingLoad).toBe(10.8);
      expect(r.heatingLoad).toBe(9);
    });
  });

  describe('noise.evaluateRoomNoise (GB 50118-2010)', () => {
    test('卧室夜间达标场景 — 32.3 dB(A) ≤ 37', () => {
      const r = k.noise.evaluateRoomNoise({
        roomType: 'bedroom', period: 'night',
        room: { floorArea: 15, height: 2.8, absorption: 0.18 },
        sources: [{ soundPowerLevel: 40, distance: 2.5, pathAttenuation: 6 }],
        backgroundLp: 30,
      });
      expect(r.predictedLp).toBe(32.3);
      expect(r.limit).toBe(37);
      expect(r.pass).toBe(true);
      expect(r.marginDb).toBe(4.7);
    });

    test('卧室夜间超标场景 — 58.4 dB(A) > 37', () => {
      const r = k.noise.evaluateRoomNoise({
        roomType: 'bedroom', period: 'night',
        room: { floorArea: 12 },
        sources: [{ soundPowerLevel: 62, distance: 1.5 }],
      });
      expect(r.predictedLp).toBe(58.4);
      expect(r.pass).toBe(false);
      expect(r.marginDb).toBe(-21.4);
    });

    test('缺声源数据 — 报数据不足而非伪装通过', () => {
      const r = k.noise.evaluateRoomNoise({ roomType: 'bedroom', period: 'night', sources: [] });
      expect(r.pass).toBeNull();
    });

    test('多房间汇总取最差项', () => {
      const agg = k.noise.evaluateRooms([
        { roomType: 'bedroom', period: 'night', room: { floorArea: 15 }, sources: [{ soundPowerLevel: 40, distance: 2.5, pathAttenuation: 6 }] },
        { roomType: 'bedroom', period: 'night', room: { floorArea: 12 }, sources: [{ soundPowerLevel: 62, distance: 1.5 }] },
      ]);
      expect(agg.pass).toBe(false);
      expect(agg.failedCount).toBe(1);
      expect(agg.worst.predictedLp).toBe(58.4);
    });
  });

  describe('water.WaterSystemEngine（净水/给水系统）', () => {
    const eng = new k.water.WaterSystemEngine();

    test('用水量需求基准 — 120m²/3人/2卫', () => {
      const wd = eng.calculateWaterDemand(120, 3, 2);
      expect(wd.dailyConsumption).toBe(450);
      expect(wd.hourlyConsumption).toBe(46.875);
      expect(wd.fixtureUnits).toBe(1.6);
      expect(wd.designFlowM3h).toBeCloseTo(0.9289, 3);
    });

    test('generateDesign 产出结构稳定', () => {
      const d = eng.generateDesign({ houseType: '三居', area: 120, residents: 3, bathrooms: 2, waterQuality: '中', city: '上海' });
      expect(Object.keys(d)).toEqual(expect.arrayContaining(['waterDemand', 'systems', 'summary']));
    });

    test('legacy 薄壳与 kernel 同源', () => {
      const legacy = require('../../../../server/core/WaterSystemEngine');
      expect(legacy.WaterSystemEngine).toBe(k.water.WaterSystemEngine);
    });
  });

  describe('GB 50118 室内限值基线（防误改）', () => {
    test('卧室夜间 37 / 昼间 45', () => {
      expect(k.noise.GB50118_INDOOR_LIMITS.bedroom.night).toBe(37);
      expect(k.noise.GB50118_INDOOR_LIMITS.bedroom.day).toBe(45);
    });
  });
});
