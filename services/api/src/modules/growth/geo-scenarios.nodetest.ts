import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTopics, scoreTopic, SCENARIO_TEMPLATES } from './geo-scenarios';

const base = {
  category: '空调',
  audience: 'owner' as const,
  painPoint: '电费高',
  intent: 'compare' as const,
};

test('缺少可选字段时，需要该字段的模板被跳过（绝不产出未填充占位）', () => {
  const topics = deriveTopics({ ...base, houseType: null, climateZone: null });
  assert.ok(topics.length > 0, '应仍能派生出不依赖可选字段的问题');
  for (const t of topics) {
    assert.ok(!t.question.includes('null'), `问句不得包含 null: ${t.question}`);
    assert.ok(!t.question.includes('undefined'), `问句不得包含 undefined: ${t.question}`);
    assert.ok(!/\{|\}/.test(t.question), `问句不得残留占位符: ${t.question}`);
  }
});

test('补齐房型与气候区后，派生问题数量增加且填充正确', () => {
  const few = deriveTopics({ ...base });
  const many = deriveTopics({ ...base, houseType: '老房', climateZone: '寒冷' });
  assert.ok(many.length > few.length, '字段更全应派生出更多问题');
  assert.ok(many.some((t) => t.question.includes('老房')), '应把房型填入问句');
  assert.ok(many.some((t) => t.question.includes('寒冷')), '应把气候区填入问句');
});

test('priority 方向正确：商业价值越高，priority 数字越小（与问题库 ASC 排序一致）', () => {
  const decide = scoreTopic({ intent: 'decide' });
  const info = scoreTopic({ intent: 'info' });
  assert.ok(decide.score > info.score, '决策型意向强度应高于信息型');
  assert.ok(decide.priority < info.priority, '价值高者 priority 数字应更小');
  assert.ok(decide.priority >= 1 && info.priority <= 199, 'priority 应落在合法区间');
});

test('具体度与胜算提升分数，且分数封顶 100', () => {
  const plain = scoreTopic({ intent: 'compare' });
  const specific = scoreTopic({ intent: 'compare', hasHouseType: true, hasClimateZone: true });
  assert.ok(specific.score > plain.score, '更具体的问题应得分更高');
  const maxed = scoreTopic({ intent: 'decide', hasHouseType: true, hasClimateZone: true, winnability: 999 });
  assert.equal(maxed.score, 100, '分数应封顶 100');
  assert.ok(maxed.factors.winnability <= 20, '胜算因子应被夹到 0-20');
});

test('角色专属模板只对相应角色生效', () => {
  const installerOnly = SCENARIO_TEMPLATES.find((t) => t.audiences?.includes('installer') && t.audiences.length === 1);
  assert.ok(installerOnly, '应存在仅安装工可见的模板');
  const owner = deriveTopics({ ...base, audience: 'owner' });
  const installer = deriveTopics({ ...base, audience: 'installer' });
  assert.ok(!owner.some((t) => t.templateId === installerOnly!.id), '业主不应看到安装工专属问题');
  assert.ok(installer.some((t) => t.templateId === installerOnly!.id), '安装工应看到其专属问题');
});

test('派生结果按商业价值排序（priority 升序）', () => {
  const topics = deriveTopics({ ...base, houseType: '老房', climateZone: '寒冷' });
  for (let i = 1; i < topics.length; i += 1) {
    assert.ok(topics[i - 1].priority <= topics[i].priority, '结果应按 priority 升序');
  }
});
