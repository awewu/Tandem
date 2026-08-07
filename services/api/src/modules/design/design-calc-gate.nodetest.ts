import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCalcGate } from './design.service';

const EXPECTED = 8;

test('全部内核算出且无自报阻断 → 合规闸放行', () => {
  const systems = Object.fromEntries(
    Array.from({ length: EXPECTED }, (_, i) => [`k${i}`, { ok: true }]),
  );
  const { gate, coverage } = evaluateCalcGate(systems, {}, EXPECTED);
  assert.equal(gate.pass, true);
  assert.equal(gate.blocked, false);
  assert.equal(gate.reason, null);
  assert.deepEqual(coverage, { expected: EXPECTED, computed: EXPECTED, failed: [] });
});

// 这是历史缺陷的回归用例：8 个内核挂 7 个，旧实现会判 pass=true。
test('8 个内核挂 7 个 → 必须阻断（静默降级回归防线）', () => {
  const systems = { load: { ok: true } };
  const failures = {
    heating: 'boom', hotWater: 'boom', airConditioning: 'boom',
    freshAir: 'boom', hydraulic: 'boom', noise: 'boom', water: 'boom',
  };
  const { gate, coverage } = evaluateCalcGate(systems, failures, EXPECTED);
  assert.equal(gate.pass, false, '大部分内核失败时绝不允许通过合规闸');
  assert.equal(gate.blocked, true);
  assert.match(String(gate.reason), /内核计算失败/);
  assert.equal(coverage.computed, 1);
  assert.equal(coverage.failed.length, 7);
});

test('仅 1 个内核失败 → 也必须阻断（不允许部分合规）', () => {
  const systems = Object.fromEntries(
    Array.from({ length: EXPECTED - 1 }, (_, i) => [`k${i}`, { ok: true }]),
  );
  const { gate } = evaluateCalcGate(systems, { water: '水系统内核异常' }, EXPECTED);
  assert.equal(gate.pass, false);
  assert.match(String(gate.reason), /water/);
});

test('内核自报 gate.blocked → 阻断', () => {
  const systems: Record<string, unknown> = Object.fromEntries(
    Array.from({ length: EXPECTED - 1 }, (_, i) => [`k${i}`, { ok: true }]),
  );
  systems.heating = { gate: { blocked: true } };
  const { gate } = evaluateCalcGate(systems, {}, EXPECTED);
  assert.equal(gate.pass, false);
  assert.equal(gate.reason, '内核自报合规阻断');
});

test('无异常但覆盖不完整 → 阻断（防内核被悄悄摘除）', () => {
  const systems = { load: { ok: true }, heating: { ok: true } };
  const { gate } = evaluateCalcGate(systems, {}, EXPECTED);
  assert.equal(gate.pass, false);
  assert.match(String(gate.reason), /覆盖不完整/);
});

test('零内核算出 → 阻断（不得把空结果当合规）', () => {
  const { gate } = evaluateCalcGate({}, {}, EXPECTED);
  assert.equal(gate.pass, false);
  assert.equal(gate.blocked, true);
});
