import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudCapabilityService } from './cloud-capability.service';
import { buildSampleIfc } from './ifc-sample';

// 真实 IFC 几何（web-ifc 服务端解析）碰撞 + 净高分析单测。样例含：
//   PipeA ∩ DuctB（相交）、Slab（楼板顶 Y=0）、DuctHigh（底 Y=2.2m）。

const svc = new CloudCapabilityService();
const ifcBase64 = Buffer.from(buildSampleIfc(), 'utf8').toString('base64');

test('clashFromIfc: 真实 IFC 网格 → 检出相交(硬碰撞)', async () => {
  const r = await svc.clashFromIfc({ projectId: 't', ifcBase64, clearanceMm: 50 });
  assert.equal(r.source, 'ifc-geometry');
  assert.ok(r.elementCount >= 4, `应解析出≥4构件，实=${r.elementCount}`);
  assert.ok(r.hardCollisions >= 1, `PipeA∩DuctB 应为硬碰撞，实 hard=${r.hardCollisions}`);
  const pair = r.collisions.find((c) => [c.elementA, c.elementB].includes('PipeA') && [c.elementA, c.elementB].includes('DuctB'));
  assert.ok(pair && pair.type === 'hard', 'PipeA-DuctB 应为 hard');
});

test('clearanceAnalysis: 净高=MEP底-楼板顶(Y轴)，抬高风管 2.2m < 2.4m 判不达标', async () => {
  const r = await svc.clearanceAnalysis({ projectId: 't', ifcBase64, minHeadroomMm: 2400 });
  assert.equal(r.data.method, 'ifc-clearance');
  assert.equal(r.data.floorTopMm, 0, `楼板顶应为 0mm，实=${r.data.floorTopMm}`);
  const high = r.data.items.find((i: any) => i.element === 'DuctHigh');
  assert.ok(high, '应含 DuctHigh');
  assert.ok(Math.abs(high.clearanceMm - 2200) < 5, `DuctHigh 净高应≈2200mm，实=${high.clearanceMm}`);
  assert.equal(high.ok, false, 'DuctHigh 2.2m < 2.4m 应不达标');
  assert.ok(high.deficitMm > 190 && high.deficitMm < 210, `亏空≈200mm，实=${high.deficitMm}`);
  assert.ok(r.data.violationCount >= 1);
});

test('clashFromIfc: 缺 ifcBase64 → 抛错', async () => {
  await assert.rejects(() => svc.clashFromIfc({ ifcBase64: '' } as any));
});
