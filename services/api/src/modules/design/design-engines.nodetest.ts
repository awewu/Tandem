import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DesignService } from './design.service';

// P1 引擎单测（node:test + ts-node/transpile-only，零新依赖）：
// 锁定「设备推荐」与「BOM 生成」行为。ds/eventBus 未用到，传 null；productCatalog 用 mock。

const user: any = { tenantId: 'demo-tenant', userId: 'u1', role: 'dealer_admin' };

function makeService(bands: any[]) {
  const mockCatalog: any = {
    priceBandsForSystems: async () => ({ success: true, data: { currency: 'CNY', bands } }),
  };
  return new DesignService(null as any, null as any, mockCatalog);
}

test('equipmentRecommendation: 命中价带 → priced，含负荷定容', async () => {
  const svc = makeService([
    { code: 'hotWater', label: '热水', priced: true, count: 3, prices: [4200, 8000, 6000], currency: 'CNY' },
  ]);
  const r = await svc.equipmentRecommendation(user, { area: 140, city: '上海', systems: ['hotWater'] });
  assert.equal(r.implemented, true);
  assert.ok(r.data.load, '面积>0 应算出负荷');
  const item = r.data.items[0];
  assert.equal(item.system, 'hotWater');
  assert.equal(item.priced, true);
  assert.equal(item.priceLow, 4200);
  assert.equal(item.priceHigh, 8000);
});

test('equipmentRecommendation: 未命中价带 → priced=false（诚实）', async () => {
  const svc = makeService([]);
  const r = await svc.equipmentRecommendation(user, { area: 0, systems: ['heating'] });
  assert.equal(r.implemented, true);
  assert.equal(r.data.loadTrust, 'insufficient_data'); // area=0
  assert.equal(r.data.items[0].priced, false);
});

test('equipmentRecommendation: 过滤非法系统 key', async () => {
  const svc = makeService([]);
  const r = await svc.equipmentRecommendation(user, { area: 100, systems: ['hotWater', 'not-a-system'] as any });
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.items[0].system, 'hotWater');
});

test('generateMaterials: 主设备取牌价中位数 + 面积系数辅材 + 人工', async () => {
  const svc = makeService([
    { code: 'hotWater', label: '热水', priced: true, count: 3, prices: [4000, 6000, 8000], currency: 'CNY' },
  ]);
  const r = await svc.generateMaterials(user, { area: 100, systems: ['hotWater'] });
  assert.equal(r.implemented, true);
  const equip = r.data.lines.find((l: any) => l.category === 'equipment');
  assert.ok(equip);
  assert.equal(equip.unitPrice, 6000); // 中位数
  assert.equal(equip.priced, true);
  const pipe = r.data.lines.find((l: any) => l.category === 'material' && String(l.name).includes('管路'));
  assert.ok(pipe);
  assert.equal(pipe.quantity, 42); // 100 × 0.42
  const labor = r.data.lines.find((l: any) => l.category === 'labor');
  assert.ok(labor);
  assert.equal(labor.priced, true);
  assert.ok(r.data.summary.subtotalPriced > 0);
});

test('generateMaterials: 未命中价带 → 主设备 unitPrice=null，诚实标注', async () => {
  const svc = makeService([]);
  const r = await svc.generateMaterials(user, { area: 100, systems: ['heating'] });
  const equip = r.data.lines.find((l: any) => l.category === 'equipment');
  assert.ok(equip);
  assert.equal(equip.unitPrice, null);
  assert.equal(equip.priced, false);
});

test('generateMaterials: 无系统 → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.generateMaterials(user, { area: 100, systems: [] }));
});

test('generateLayout: 网格布点产出主机+末端节点', async () => {
  const svc = makeService([]);
  const r = await svc.generateLayout({ area: 144, systems: ['airConditioning'], roomCount: 4 });
  assert.equal(r.implemented, true);
  const sources = r.data.nodes.filter((n: any) => n.role === 'source');
  const terminals = r.data.nodes.filter((n: any) => n.role === 'terminal');
  assert.equal(sources.length, 1);
  assert.equal(terminals.length, 4);
  assert.equal(r.data.nodeCount, 5);
});

test('generateLayout: 缺 area/systems → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.generateLayout({ area: 0, systems: [] }));
});

test('collisionCheck: 相交=硬碰撞，远离不误报', async () => {
  const svc = makeService([]);
  const r = await svc.collisionCheck({
    elements: [
      { id: 'A', boundingBox: { min: [0, 0, 0], max: [1000, 50, 50] } },
      { id: 'B', boundingBox: { min: [500, 10, 10], max: [1500, 200, 200] } },
      { id: 'C', boundingBox: { min: [9000, 0, 0], max: [9100, 50, 50] } },
    ],
  });
  assert.equal(r.data.hardCollisions, 1);
  assert.equal(r.data.softCollisions, 0);
});

test('optimizePipes: 流速法向上取标准 DN', async () => {
  const svc = makeService([]);
  // Q=3.6 m³/h → 0.001 m³/s, v=1.0 → d=√(4·0.001/π)≈0.0357m=35.7mm → DN40
  const r = await svc.optimizePipes({ segments: [{ id: 's1', system: 'water', flowM3h: 3.6, velocityMps: 1.0 }] });
  assert.equal(r.implemented, true);
  assert.equal(r.data.segments[0].selectedDN, 40);
  assert.ok(r.data.segments[0].theoreticalDiameterMm > 35 && r.data.segments[0].theoreticalDiameterMm < 36);
});

test('optimizePipes: 无 segments 且无 area → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.optimizePipes({}));
});

test('optimizePipes: 提供管网 → 水力平衡(流量分配+阻力+泵扬程)', async () => {
  const svc = makeService([]);
  // 热源→分集水器→两末端（采暖，各 3kW）
  const r = await svc.optimizePipes({
    systemType: 'heating', supplyT: 60, returnT: 50,
    network: {
      nodes: [
        { id: 'src', type: 'source' },
        { id: 'mani', type: 'manifold' },
        { id: 't1', type: 'terminal', power_W: 3000 },
        { id: 't2', type: 'terminal', power_W: 3000 },
      ],
      pipes: [
        { id: 'p0', from: 'src', to: 'mani', length_m: 10, fittings: { elbow90: 2 } },
        { id: 'p1', from: 'mani', to: 't1', length_m: 8, fittings: { tee: 1 } },
        { id: 'p2', from: 'mani', to: 't2', length_m: 12, fittings: { tee: 1 } },
      ],
    },
  });
  assert.equal(r.implemented, true);
  assert.equal(r.data.method, 'hydraulic-balance');
  assert.ok(r.data.totalFlow_Lh > 0, '总流量应>0');
  assert.equal(r.data.segments.length, 3);
  // 主干管 p0 承担两末端流量，应大于任一支管
  const p0 = r.data.segments.find((s: any) => s.pipeId === 'p0');
  const p1 = r.data.segments.find((s: any) => s.pipeId === 'p1');
  assert.ok(p0 && p1 && p0.flow_Lh > p1.flow_Lh, '主干流量>支管');
  assert.ok(p0.isMain === true, 'p0 应判为主干');
  assert.ok(r.data.pump && r.data.pump.head_m > 0, '应算出水泵扬程');
  assert.ok(r.data.worstLoop && Array.isArray(r.data.worstLoop.pipes), '应识别最不利环路');
});

test('optimizeDucts: 风管网 → 自动变径(下游更小)+风机余压', async () => {
  const svc = makeService([]);
  const r = await svc.optimizeDucts({
    network: {
      nodes: [
        { id: 'fan', type: 'source' },
        { id: 'mani', type: 'branch' },
        { id: 'r1', type: 'terminal', flow_m3h: 300 },
        { id: 'r2', type: 'terminal', flow_m3h: 300 },
      ],
      pipes: [
        { id: 'd0', from: 'fan', to: 'mani', length_m: 8 },
        { id: 'd1', from: 'mani', to: 'r1', length_m: 5 },
        { id: 'd2', from: 'mani', to: 'r2', length_m: 6 },
      ],
    },
  });
  assert.equal(r.implemented, true);
  assert.equal(r.data.method, 'duct-auto-sizing');
  assert.equal(r.data.totalFlow_m3h, 600);
  const d0 = r.data.segments.find((s: any) => s.pipeId === 'd0');
  const d1 = r.data.segments.find((s: any) => s.pipeId === 'd1');
  assert.ok(d0.diameter >= d1.diameter, `主风管应≥支管径 主=${d0.diameter} 支=${d1.diameter}`);
  assert.ok(r.data.fan.staticPressure_Pa > 0, '应算出风机余压');
});

test('optimizeDucts: 无 network → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.optimizeDucts({}));
});

test('generateRadiantCoil: 蛇形盘管长度/环路/路径', async () => {
  const svc = makeService([]);
  const r = await svc.generateRadiantCoil({ rooms: [{ name: '客厅', area: 24 }], spacingMm: 200 });
  assert.equal(r.implemented, true);
  assert.equal(r.data.method, 'radiant-serpentine');
  const room = r.data.rooms[0];
  // 24㎡/0.2m ≈ 120m 直段量级；含折返+引管
  assert.ok(room.coilLengthM > 80 && room.coilLengthM < 200, `盘管长度量级合理，实=${room.coilLengthM}`);
  assert.ok(room.loops >= 1);
  assert.ok(room.loopLengthM <= 120 + 1, '单环路≤maxLoop');
  assert.ok(Array.isArray(room.serpentinePathMm) && room.serpentinePathMm.length >= 2, '首房间应出蛇形路径');
  assert.ok(r.data.totalCoilLengthM > 0 && r.data.totalLoops >= 1);
});

test('generateRadiantCoil: 大房间 → 拆多环路(单环≤上限)', async () => {
  const svc = makeService([]);
  const r = await svc.generateRadiantCoil({ rooms: [{ name: '大厅', area: 60 }], spacingMm: 200, maxLoopM: 100 });
  const room = r.data.rooms[0];
  assert.ok(room.loops >= 2, `60㎡ 应拆≥2 环路，实=${room.loops}`);
  assert.ok(room.loopLengthM <= 101);
});

test('autoRoute: A* 正交寻路 + 主干复用（节省≥0）', async () => {
  const svc = makeService([]);
  const r = await svc.autoRoute({
    bounds: { width: 12000, height: 8000 },
    source: { x: 0, y: 0 },
    terminals: [{ id: 'r1', x: 11000, y: 1000 }, { id: 'r2', x: 11000, y: 7000 }, { id: 'r3', x: 6000, y: 4000 }],
    gridStepMm: 500,
  });
  assert.equal(r.implemented, true);
  assert.equal(r.data.method, 'astar-grid-routing');
  assert.equal(r.data.routes.length, 3);
  assert.ok(r.data.routes.every((x: any) => x.reachable), '全部末端应可达');
  assert.ok(r.data.routes.every((x: any) => x.pathMm.length >= 2), '每条路径应有拐点序列');
  assert.ok(r.data.totalNetworkLengthM > 0, '应有实际用管量');
  // 主干复用：分支之和 ≥ 去重网络长度
  assert.ok(r.data.sumBranchLengthM >= r.data.totalNetworkLengthM - 0.01, '分支和应≥去重网络');
  assert.ok(r.data.savedByTrunkM >= 0);
});

test('autoRoute: 绕开障碍（路径不穿越障碍矩形）', async () => {
  const svc = makeService([]);
  const r = await svc.autoRoute({
    bounds: { width: 10000, height: 6000 },
    source: { x: 0, y: 3000 },
    terminals: [{ id: 'r1', x: 9500, y: 3000 }],
    obstacles: [{ x: 4000, y: 0, w: 1000, h: 4500 }], // 竖墙留下方缺口
    gridStepMm: 500,
  });
  assert.ok(r.data.routes[0].reachable, '应绕行可达');
  // 检查拐点不落在障碍内部
  const inObstacle = r.data.routes[0].pathMm.some(([x, y]: [number, number]) => x > 4000 && x < 5000 && y >= 0 && y < 4500);
  assert.ok(!inObstacle, '路径不应落入障碍内');
});

test('autoRoute: 缺参数 → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.autoRoute({ bounds: { width: 1000, height: 1000 } } as any));
});

test('simulateCfd: 返回 PMV/PPD/分布/建议（无原始场数组）', async () => {
  const svc = makeService([]);
  const r = await svc.simulateCfd({ roomDimensions: { length: 5, width: 4, height: 2.8 }, season: 'summer', resolutionM: 0.5 });
  assert.equal(r.implemented, true);
  assert.equal(r.data.method, 'cfd-simulation');
  assert.ok(typeof r.data.comfort.overall.pmv === 'number', 'PMV 应为数值');
  assert.ok(typeof r.data.comfort.overall.ppd === 'number', 'PPD 应为数值');
  const dist = r.data.comfort.distribution;
  const sum = dist.cold + dist.cool + dist.comfortable + dist.warm + dist.hot;
  assert.ok(sum >= 98 && sum <= 102, `舒适分布应≈100%，实=${sum}`);
  assert.ok(Array.isArray(r.data.recommendations));
  assert.ok(r.data.meshInfo.cellCount > 0);
  // 不应把原始场数组带出
  assert.equal((r.data as any).results, undefined);
});

test('simulateCfd: 网格过密 → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.simulateCfd({ roomDimensions: { length: 20, width: 20, height: 10 }, resolutionM: 0.05 }));
});

test('exportDesign: 生成真实 PDF base64', async () => {
  const svc = makeService([]);
  const r = await svc.exportDesign({ projectName: 'T1', area: 140, city: '上海', systems: ['heating'], load: { coolingLoad: 16.8, heatingLoad: 14 } });
  assert.equal(r.implemented, true);
  assert.equal(r.data.format, 'pdf');
  assert.ok((r.data.sizeBytes ?? 0) > 0);
  // PDF 魔数 %PDF
  const head = Buffer.from(String(r.data.contentBase64), 'base64').slice(0, 4).toString();
  assert.equal(head, '%PDF');
});

test('exportDesign: dwg → 诚实 not implemented', async () => {
  const svc = makeService([]);
  const r = await svc.exportDesign({ format: 'dwg' });
  assert.equal(r.implemented, false);
});

test('generateSystemDiagram: 生成系统原理图 SVG', async () => {
  const svc = makeService([]);
  const r = await svc.generateSystemDiagram({ projectName: '样板', city: '上海', area: 144, systems: ['heating', 'freshAir'] });
  assert.equal(r.implemented, true);
  assert.equal(r.data.format, 'svg');
  assert.ok(r.data.svg.startsWith('<svg') && r.data.svg.includes('</svg>'), 'SVG 结构完整');
  assert.ok(r.data.svg.includes('采暖') && r.data.svg.includes('新风'), '含系统标签');
  assert.ok(r.data.width > 0 && r.data.height > 0);
  // base64 可解码回 SVG
  assert.ok(Buffer.from(r.data.contentBase64, 'base64').toString('utf8').startsWith('<svg'));
});

test('generateSystemDiagram: 无系统 → 抛错', async () => {
  const svc = makeService([]);
  await assert.rejects(() => svc.generateSystemDiagram({ area: 100, systems: [] }));
});

test('listTemplates: 返回内置模板集', async () => {
  const svc = makeService([]);
  const r = await svc.listTemplates();
  assert.ok(r.data.count >= 5);
  assert.ok(r.data.templates.every((t: any) => Array.isArray(t.systems) && t.systems.length));
});

// ── DXF 导入（dxf-parser 真实解析） ──
function sampleDxf(): string {
  const g = (code: number, val: string) => `${code}\n${val}\n`;
  return g(0, 'SECTION') + g(2, 'ENTITIES')
    + g(0, 'LINE') + g(8, 'WATER-PIPE') + g(10, '0') + g(20, '0') + g(30, '0') + g(11, '5000') + g(21, '0') + g(31, '0')
    + g(0, 'LINE') + g(8, 'HVAC-DUCT') + g(10, '0') + g(20, '1000') + g(30, '0') + g(11, '3000') + g(21, '1000') + g(31, '0')
    + g(0, 'INSERT') + g(8, 'EQUIP') + g(2, 'AHU-01') + g(10, '1000') + g(20, '500') + g(30, '0')
    + g(0, 'ENDSEC') + g(0, 'EOF');
}

test('parseCad(DXF): 按图层归类管线长度 + 设备块计数', async () => {
  const svc = makeService([]);
  const r = await svc.parseCad({ dxf: sampleDxf() });
  assert.equal(r.implemented, true);
  const d: any = r.data;
  assert.equal(d.method, 'dxf-parser');
  assert.ok(Math.abs(d.byClass.pipe.totalLengthMm - 5000) < 1, `水管总长≈5000，实=${d.byClass.pipe.totalLengthMm}`);
  assert.ok(Math.abs(d.byClass.duct.totalLengthMm - 3000) < 1, `风管总长≈3000，实=${d.byClass.duct.totalLengthMm}`);
  const ahu = d.equipmentBlocks.find((b: any) => b.name === 'AHU-01');
  assert.ok(ahu && ahu.count === 1, '应计到 AHU-01 设备块');
});

test('parseCad(DXF base64): 与文本一致', async () => {
  const svc = makeService([]);
  const b64 = Buffer.from(sampleDxf(), 'utf8').toString('base64');
  const r = await svc.parseCad({ dxfBase64: b64 });
  assert.equal(r.implemented, true);
  const d: any = r.data;
  assert.ok(d.layers.includes('WATER-PIPE') && d.layers.includes('HVAC-DUCT'));
});

test('parseCad: dwg → 诚实 not implemented（建议导出 DXF/IFC）', async () => {
  const svc = makeService([]);
  const r = await svc.parseCad({ format: 'dwg' });
  assert.equal(r.implemented, false);
  assert.ok(String((r.data as any).note).includes('DXF') || String((r.data as any).note).includes('IFC'));
});
