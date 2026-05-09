// 编译 adapter 到 .tmp-test/ 后跑 round-trip 测试
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = resolve(root, '.tmp-test');
const fixtures = resolve(root, 'scripts', 'fixtures');
mkdirSync(fixtures, { recursive: true });
if (existsSync(out)) rmSync(out, { recursive: true, force: true });

console.log('1) tsc 编译 lib/tita-adapter.ts ...');
execSync(
  `npx tsc lib/tita-adapter.ts --outDir ${JSON.stringify(out)} --target es2020 --module esnext --moduleResolution node --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports`,
  { cwd: root, stdio: 'inherit' }
);

const adapterUrl = 'file:///' + resolve(out, 'tita-adapter.js').replace(/\\/g, '/');
const { buildSnapshot, parseSnapshot, exportTitaCSV, importTitaCSV } = await import(adapterUrl);

const now = Date.now();
const sample = {
  cycles: [{ id: 'cy1', name: '2026-Q1', type: 'quarter', startDate: now, endDate: now, isActive: true }],
  people: [{ id: 'p1', name: '张三' }, { id: 'p2', name: '李四' }],
  objectives: [
    { id: 'o1', title: '提升用户留存', description: '通过 AI 推荐改善次日留存', cycleId: 'cy1', ownerId: 'p1', parentId: null, weight: 100, status: 'active', confidence: 'on-track', visibility: 'public', tags: ['增长', '北极星'], progressOverride: null, createdAt: now, updatedAt: now },
    { id: 'o2', title: '冷启动用户体验优化', cycleId: 'cy1', ownerId: 'p2', parentId: 'o1', weight: 50, status: 'active', confidence: 'at-risk', visibility: 'public', tags: ['增长'], progressOverride: null, createdAt: now, updatedAt: now },
  ],
  keyResults: [
    { id: 'k1', objectiveId: 'o1', title: '次日留存从 30% 提升到 45%', ownerId: 'p1', type: 'percentage', startValue: 30, currentValue: 38, targetValue: 45, unit: '%', weight: 60, confidence: 'on-track', status: 'active', tags: [], createdAt: now, updatedAt: now },
    { id: 'k2', objectiveId: 'o1', title: 'AI 推荐覆盖率 100%', ownerId: 'p1', type: 'percentage', startValue: 0, currentValue: 80, targetValue: 100, unit: '%', weight: 40, confidence: 'at-risk', status: 'active', tags: ['ml'], createdAt: now, updatedAt: now },
    { id: 'k3', objectiveId: 'o2', title: '新用户引导完成率 80%', ownerId: 'p2', type: 'percentage', startValue: 50, currentValue: 65, targetValue: 80, unit: '%', weight: 100, confidence: 'at-risk', status: 'active', tags: [], createdAt: now, updatedAt: now },
  ],
  checkIns: [],
  initiatives: [
    { id: 'i1', scope: 'kr', scopeId: 'k1', title: '优化新手引导流程', ownerId: 'p1', status: 'in-progress', priority: 'high', tags: [], createdAt: now, updatedAt: now },
    { id: 'i2', scope: 'kr', scopeId: 'k1', title: '首日激活推送', ownerId: 'p1', status: 'todo', priority: 'medium', tags: [], createdAt: now, updatedAt: now },
    { id: 'i3', scope: 'kr', scopeId: 'k2', title: '搭建 A/B 测试基础设施', ownerId: 'p1', status: 'done', priority: 'urgent', tags: [], createdAt: now, updatedAt: now },
    { id: 'i4', scope: 'objective', scopeId: 'o2', title: '招募一位 UX 设计师', ownerId: 'p2', status: 'blocked', priority: 'high', tags: [], createdAt: now, updatedAt: now },
  ],
  comments: [],
  activities: [],
};

let pass = 0, fail = 0;
const check = (cond, name) => { if (cond) { console.log('  ✅ ' + name); pass++; } else { console.error('  ❌ ' + name); fail++; } };

console.log('\n2) JSON round-trip ...');
const snap = buildSnapshot(sample);
const json = JSON.stringify(snap, null, 2);
writeFileSync(resolve(fixtures, 'okr-snapshot.json'), json);
const parsed = parseSnapshot(json);
check(parsed.objectives.length === 2, 'objectives 数 = 2');
check(parsed.keyResults.length === 3, 'KR 数 = 3');
check(parsed.objectives[0].tags.includes('增长'), 'tags 保留');
check(parsed.initiatives && parsed.initiatives.length === 4, 'JSON initiatives = 4 (实际 ' + (parsed.initiatives && parsed.initiatives.length) + ')');
check(snap.schemaVersion === 2, 'JSON schemaVersion = 2');
check(snap.source === 'nanie', 'JSON source = nanie');

console.log('\n3) CSV round-trip ...');
const csv = exportTitaCSV(sample);
writeFileSync(resolve(fixtures, 'okr-tita.csv'), csv);
console.log('  CSV ' + (csv.split('\n').length - 1) + ' 行');
const re = importTitaCSV(csv, { people: sample.people, cycles: sample.cycles });
check(re.objectives.length === 2, '导入后 objectives = 2 (实际 ' + re.objectives.length + ')');
check(re.keyResults.length === 3, '导入后 KR = 3 (实际 ' + re.keyResults.length + ')');
const child = re.objectives.find((o) => o.title === '冷启动用户体验优化');
const parent = re.objectives.find((o) => o.title === '提升用户留存');
check(child?.parentId === parent?.id, '上级对齐保留');
check(child?.confidence === 'at-risk', 'confidence 中→英映射 (at-risk)');
const k1 = re.keyResults.find((k) => k.title.includes('次日留存'));
check(k1 && k1.targetValue === 45 && k1.currentValue === 38, 'KR 数值保留');
check(k1?.unit === '%', 'KR 单位保留');
check(re.objectives[0].tags.includes('增长'), 'objective tags 保留');
check(re.initiatives && re.initiatives.length === 4, 'CSV initiatives 涵盖与还原 = 4 (实际 ' + (re.initiatives && re.initiatives.length) + ')');
const doneInit = re.initiatives && re.initiatives.find((i) => i.title === '搭建 A/B 测试基础设施');
check(doneInit && doneInit.status === 'done', 'CSV initiative 状态保留 (done)');
const blockedInit = re.initiatives && re.initiatives.find((i) => i.title === '招募一位 UX 设计师');
check(blockedInit && blockedInit.status === 'blocked' && blockedInit.scope === 'objective', 'CSV objective-级 initiative 保留');

console.log('\n=== ' + pass + ' 通过 / ' + fail + ' 失败 ===');
console.log('样本：' + resolve(fixtures, 'okr-tita.csv'));
process.exit(fail > 0 ? 1 : 0);
