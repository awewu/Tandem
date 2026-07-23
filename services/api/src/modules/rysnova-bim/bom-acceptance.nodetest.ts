import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBomItemSystem, extractDevices, buildAcceptanceChecklist } from './bom-acceptance';

// P1-1 · 验收清单按真实 BOM 逐设备生成 + 修复「devices 提取为 0」根因。
// 关键证明：标准报价 BOM 行（仅 sku/name/unitPrice/quantity/params，无 systemFamily/category）
// 也能被逐设备提取并分类，绝不因缺分类字段而丢弃。

// 贴近 quote.service 的真实快照 BOM 形状（见 snapshotItems 映射）。
const REALISTIC_BOM = [
  { sku: 'RH-WH-200', name: '瑞好空气能热水器 200L', unitPrice: 8800, quantity: 1 },
  { sku: 'RH-FH-KIT', name: '地暖盘管铺设套件', unitPrice: 6200, quantity: 2 },
  { sku: 'RH-ERV-350', name: '全热交换新风机 350', unitPrice: 9500, quantity: 1 },
  { sku: 'RH-RO-600', name: 'RO 反渗透净水机', unitPrice: 4200, quantity: 1 },
  { sku: 'RH-GW-ECONET', name: 'Econet 智能网关', unitPrice: 1800, quantity: 1 },
];

test('extractDevices：真实 BOM(无 systemFamily/category) 逐设备提取，devices 非 0', () => {
  const devices = extractDevices(REALISTIC_BOM);
  // 修复前此处为 0（旧 filter 依赖 systemFamily||category）；修复后应等于 BOM 行数。
  assert.equal(devices.length, 5, 'devices 应逐行提取，不得为 0');
  assert.equal(devices.reduce((n, d) => (d.system !== '设备' ? n + 1 : n), 0), 5, '5 台设备均应被正确归类');
});

test('classifyBomItemSystem：按名称关键词归类到中文系统', () => {
  assert.equal(classifyBomItemSystem({ name: '瑞好空气能热水器 200L' }), '热水');
  assert.equal(classifyBomItemSystem({ name: '地暖盘管铺设套件' }), '采暖');
  assert.equal(classifyBomItemSystem({ name: '全热交换新风机 350' }), '新风');
  assert.equal(classifyBomItemSystem({ name: 'RO 反渗透净水机' }), '净水');
  assert.equal(classifyBomItemSystem({ name: 'Econet 智能网关' }), '智控');
});

test('classifyBomItemSystem：显式字段优先，未知归「设备」而非丢弃', () => {
  assert.equal(classifyBomItemSystem({ systemFamily: 'hot_water', name: '未知型号' }), '热水');
  assert.equal(classifyBomItemSystem({ category: '新风', name: 'x' }), '新风');
  assert.equal(classifyBomItemSystem({ name: '不明辅料 X' }), '设备');
});

test('extractDevices：剔除空白行、数量缺省为 1、非法数量归 1', () => {
  const devices = extractDevices([
    { name: '热水器', quantity: 3 },
    { name: '', sku: '', model: '' }, // 空行 → 剔除
    { sku: 'ONLY-SKU' }, // 无 name，退回 sku 作名称
    { name: '阀门', quantity: -5 as any }, // 非法数量 → 1
  ]);
  assert.equal(devices.length, 3, '空行应被剔除');
  assert.equal(devices[0].quantity, 3);
  assert.equal(devices[1].name, 'ONLY-SKU');
  assert.equal(devices[2].quantity, 1, '非法数量应归 1');
});

test('buildAcceptanceChecklist：按 BOM 逐设备生成 + 通用验收项', () => {
  const cl = buildAcceptanceChecklist(REALISTIC_BOM, ['hot_water', 'heating']);
  const fromBom = cl.filter((c) => c.fromBom);
  const general = cl.filter((c) => !c.fromBom);
  assert.equal(fromBom.length, 5, '每台设备一条验收项');
  assert.equal(general.length, 2, '通用验收项恒为 2（现场确认 + 验收单签字）');
  assert.ok(fromBom.every((c) => c.deviceRef && c.item.includes('安装并调试确认')), '逐设备项应带 deviceRef 且措辞一致');
  assert.ok(fromBom.some((c) => c.item.includes('地暖盘管铺设套件') && c.item.includes('2 台')), '数量>1 应在措辞中体现');
});

test('buildAcceptanceChecklist：BOM 为空回退按系统族过滤的模板', () => {
  const cl = buildAcceptanceChecklist([], ['hot_water']);
  const fromBom = cl.filter((c) => c.fromBom);
  const templ = cl.filter((c) => !c.fromBom && c.system !== '验收');
  const general = cl.filter((c) => c.system === '验收');
  assert.equal(fromBom.length, 0, 'BOM 为空不应有逐设备项');
  assert.ok(templ.length > 0 && templ.every((c) => c.system === '热水'), '模板应按 systemFamilies 过滤到热水');
  assert.equal(general.length, 2, '通用验收项仍在');
});

test('smartDevices 口径：仅智控系统设备（与 buildIotHandoffPackage 一致）', () => {
  const smart = extractDevices(REALISTIC_BOM).filter((d) => d.system === '智控');
  assert.equal(smart.length, 1);
  assert.equal(smart[0].sku, 'RH-GW-ECONET');
});
