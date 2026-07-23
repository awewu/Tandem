import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudCapabilityService } from './cloud-capability.service';

// P1 引擎单测（node:test + ts-node/transpile-only，零新依赖）：锁定碰撞检测与工程量算法行为。

const svc = new CloudCapabilityService();

test('clash: 相交包围盒 → 1 个硬碰撞，且定位在重叠中心', async () => {
  const r = await svc.clashDetection({
    projectId: 'p',
    elements: [
      { id: 'A', type: 'pipe', boundingBox: { min: [0, 0, 0], max: [1000, 50, 50] } },
      { id: 'B', type: 'duct', boundingBox: { min: [500, 10, 10], max: [1500, 200, 200] } },
    ],
  });
  assert.equal(r.hardCollisions, 1);
  assert.equal(r.softCollisions, 0);
  assert.equal(r.collisions[0].type, 'hard');
  assert.equal(r.collisions[0].distanceMm, 0);
});

test('clash: 远离构件不产生碰撞', async () => {
  const r = await svc.clashDetection({
    projectId: 'p',
    elements: [
      { id: 'A', type: 'pipe', boundingBox: { min: [0, 0, 0], max: [100, 50, 50] } },
      { id: 'C', type: 'pipe', boundingBox: { min: [5000, 0, 0], max: [6000, 50, 50] } },
    ],
  });
  assert.equal(r.hardCollisions, 0);
  assert.equal(r.softCollisions, 0);
  assert.equal(r.collisions.length, 0);
});

test('clash: 净距在 clearance 内 → 软碰撞', async () => {
  const r = await svc.clashDetection({
    projectId: 'p',
    clearanceMm: 50,
    elements: [
      { id: 'A', type: 'pipe', boundingBox: { min: [0, 0, 0], max: [100, 50, 50] } },
      { id: 'B', type: 'pipe', boundingBox: { min: [130, 0, 0], max: [200, 50, 50] } }, // 净距 30mm
    ],
  });
  assert.equal(r.softCollisions, 1);
  assert.equal(r.collisions[0].type, 'soft');
  assert.equal(r.collisions[0].distanceMm, 30);
});

test('boq geometry: 管线取包围盒最长边(→m)，设备计数', async () => {
  const r = await svc.billOfQuantities({
    projectId: 'p',
    elements: [
      { id: 'A', type: 'pipe', boundingBox: { min: [0, 0, 0], max: [3000, 50, 50] } },
      { id: 'E', type: 'equipment', boundingBox: { min: [0, 0, 0], max: [600, 600, 600] } },
    ],
  });
  assert.equal(r.method, 'geometry');
  const pipe = r.items.find((i) => i.category === 'pipe');
  const eq = r.items.find((i) => i.category === 'equipment');
  assert.equal(pipe?.quantity, 3);
  assert.equal(pipe?.unit, 'm');
  assert.equal(eq?.quantity, 1);
});

test('boq coefficient: 面积×系统系数量算', async () => {
  const r = await svc.billOfQuantities({ projectId: 'p', area: 140, systems: ['heating', 'freshAir'] });
  assert.equal(r.method, 'coefficient');
  const heat = r.items.find((i) => i.name === '采暖管路');
  const fresh = r.items.find((i) => i.name === '新风风管');
  assert.equal(heat?.quantity, 100.8); // 140 × 0.72
  assert.equal(fresh?.quantity, 77);   // 140 × 0.55
});

test('boq empty: 无 elements 且无 area+systems → empty', async () => {
  const r = await svc.billOfQuantities({ projectId: 'p' });
  assert.equal(r.method, 'empty');
  assert.equal(r.items.length, 0);
});
