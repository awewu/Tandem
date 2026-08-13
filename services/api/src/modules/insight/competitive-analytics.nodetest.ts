import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHhi, computeMomentum, scoreThreats, computeLeaderGap,
  MOMENTUM_MIN_SAMPLE,
} from './competitive-analytics';

// ── HHI ────────────────────────────────────────────────────────────────────

test('HHI：单一主体垄断 = 10000，且判为高集中', () => {
  const r = computeHhi([{ competitor: 'A', hits: 50 }]);
  assert.equal(r.hhi, 10000);
  assert.equal(r.band, 'highly-concentrated');
  assert.equal(r.effectivePlayers, 1);
});

test('HHI：四家均分 = 2500，有效竞争者数 = 4', () => {
  const r = computeHhi([
    { competitor: 'A', hits: 25 }, { competitor: 'B', hits: 25 },
    { competitor: 'C', hits: 25 }, { competitor: 'D', hits: 25 },
  ]);
  assert.equal(r.hhi, 2500);
  assert.equal(r.effectivePlayers, 4);
  assert.equal(r.players, 4);
});

test('HHI：足够分散时判为 unconcentrated（阈值 1000/1800 分档正确）', () => {
  // 20 家均分 → HHI=500
  const many = Array.from({ length: 20 }, (_, i) => ({ competitor: `C${i}`, hits: 5 }));
  assert.equal(computeHhi(many).band, 'unconcentrated');
  // 三家均分 → HHI≈3333 高集中
  assert.equal(computeHhi([
    { competitor: 'A', hits: 1 }, { competitor: 'B', hits: 1 }, { competitor: 'C', hits: 1 },
  ]).band, 'highly-concentrated');
  // 8 家均分 → HHI=1250 中度集中
  const eight = Array.from({ length: 8 }, (_, i) => ({ competitor: `C${i}`, hits: 1 }));
  assert.equal(computeHhi(eight).band, 'moderately-concentrated');
});

test('HHI：空样本不臆造集中度（hhi=0 且不报高集中）', () => {
  const r = computeHhi([]);
  assert.equal(r.hhi, 0);
  assert.equal(r.players, 0);
  assert.equal(r.band, 'unconcentrated');
  // 全 0 次命中等同空样本
  assert.equal(computeHhi([{ competitor: 'A', hits: 0 }]).hhi, 0);
});

// ── 动量 ──────────────────────────────────────────────────────────────────

test('动量：小样本必须返回 insufficient-data（n=1→n=2 不算翻倍增长）', () => {
  const [m] = computeMomentum([{ competitor: 'A', hits: 2 }], [{ competitor: 'A', hits: 1 }]);
  assert.equal(m.verdict, 'insufficient-data');
  assert.equal(m.shareDeltaPp, null, '样本不足时不得给出份额变化数字');
  assert.ok(m.reason.includes('样本不足'));
});

test('动量：样本充足且份额上升 → rising，含百分点', () => {
  // 当前 A 占 60/100=60%，上期 A 占 30/100=30% → +30pp
  const cur = [{ competitor: 'A', hits: 60 }, { competitor: 'B', hits: 40 }];
  const prev = [{ competitor: 'A', hits: 30 }, { competitor: 'B', hits: 70 }];
  const m = computeMomentum(cur, prev).find((x) => x.competitor === 'A')!;
  assert.equal(m.verdict, 'rising');
  assert.equal(m.shareDeltaPp, 30);
});

test('动量：份额下降 → falling；噪声带内 → flat', () => {
  const cur = [{ competitor: 'A', hits: 30 }, { competitor: 'B', hits: 70 }];
  const prev = [{ competitor: 'A', hits: 60 }, { competitor: 'B', hits: 40 }];
  const a = computeMomentum(cur, prev).find((x) => x.competitor === 'A')!;
  assert.equal(a.verdict, 'falling');
  assert.equal(a.shareDeltaPp, -30);

  // 份额 50%→51%，变化 1pp < 噪声带 2pp
  const flat = computeMomentum(
    [{ competitor: 'A', hits: 51 }, { competitor: 'B', hits: 49 }],
    [{ competitor: 'A', hits: 50 }, { competitor: 'B', hits: 50 }],
  ).find((x) => x.competitor === 'A')!;
  assert.equal(flat.verdict, 'flat');
});

test('动量：仅单窗口有数据时不出趋势（新出现的竞品不谎报暴涨）', () => {
  const [m] = computeMomentum([{ competitor: 'NEW', hits: 50 }], []);
  assert.equal(m.verdict, 'insufficient-data');
  assert.ok(m.reason.includes('单个窗口'));
});

test('动量：覆盖两窗口全部竞品（消失的竞品也要出现在结果里）', () => {
  const names = computeMomentum(
    [{ competitor: 'A', hits: 20 }],
    [{ competitor: 'A', hits: 10 }, { competitor: 'GONE', hits: 10 }],
  ).map((m) => m.competitor).sort();
  assert.deepEqual(names, ['A', 'GONE']);
});

test('动量：minSample 门槛可调且默认值生效', () => {
  const cur = [{ competitor: 'A', hits: 4 }];
  const prev = [{ competitor: 'A', hits: 4 }];
  assert.equal(computeMomentum(cur, prev)[0].verdict, 'insufficient-data',
    `合计 8 < 默认门槛 ${MOMENTUM_MIN_SAMPLE} 应判样本不足`);
  assert.notEqual(computeMomentum(cur, prev, { minSample: 4 })[0].verdict, 'insufficient-data');
});

// ── 威胁评分 ───────────────────────────────────────────────────────────────

test('威胁评分：我方不进入威胁榜', () => {
  const rows = [{ competitor: 'US', isSelf: true, hits: 80 }, { competitor: 'A', hits: 20 }];
  const t = scoreThreats(rows, computeMomentum(rows, rows));
  assert.deepEqual(t.map((x) => x.competitor), ['A']);
});

test('威胁评分：小而猛涨者能压过大而不动者（动量被看见）', () => {
  const cur = [{ competitor: 'BIG', hits: 55 }, { competitor: 'FAST', hits: 45 }];
  const prev = [{ competitor: 'BIG', hits: 90 }, { competitor: 'FAST', hits: 10 }];
  const mom = computeMomentum(cur, prev);
  const t = scoreThreats(cur, mom);
  const big = t.find((x) => x.competitor === 'BIG')!;
  const fast = t.find((x) => x.competitor === 'FAST')!;
  assert.ok(fast.score > big.score, `猛涨者应更高威胁：FAST=${fast.score} BIG=${big.score}`);
  assert.ok(fast.factors.momentum > 0, '上升者应得动量分');
  assert.equal(big.factors.momentum, 0, '下降者不得动量分');
});

test('威胁评分：头部加成生效且分数封顶 100', () => {
  const cur = [{ competitor: 'A', hits: 99 }, { competitor: 'B', hits: 1 }];
  const prev = [{ competitor: 'A', hits: 1 }, { competitor: 'B', hits: 99 }];
  const t = scoreThreats(cur, computeMomentum(cur, prev));
  const a = t.find((x) => x.competitor === 'A')!;
  assert.equal(a.factors.leader, 10, '当前头部应得加成');
  assert.ok(a.score <= 100, '分数必须封顶 100');
  assert.ok(a.score > 0);
});

test('威胁评分：样本不足时不加动量分，且在理由里如实标注', () => {
  const cur = [{ competitor: 'A', hits: 2 }, { competitor: 'B', hits: 1 }];
  const prev = [{ competitor: 'A', hits: 1 }, { competitor: 'B', hits: 1 }];
  const a = scoreThreats(cur, computeMomentum(cur, prev)).find((x) => x.competitor === 'A')!;
  assert.equal(a.factors.momentum, 0);
  assert.ok(a.reason.includes('样本不足'));
});

test('威胁评分：按分数降序返回（运营直接取前几名应对）', () => {
  const cur = [{ competitor: 'S', hits: 10 }, { competitor: 'L', hits: 60 }, { competitor: 'M', hits: 30 }];
  const scores = scoreThreats(cur, computeMomentum(cur, cur)).map((x) => x.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

// ── 头部差距 ───────────────────────────────────────────────────────────────

test('头部差距：无我方口径时 selfShare/gap 为 null（不得填 0 冒充"我方零声量"）', () => {
  const g = computeLeaderGap([{ competitor: 'A', hits: 60 }, { competitor: 'B', hits: 40 }]);
  assert.equal(g.leader, 'A');
  assert.equal(g.selfShare, null);
  assert.equal(g.gapPp, null);
  assert.equal(g.selfIsLeader, false);
});

test('头部差距：有我方口径时算出百分点差', () => {
  const g = computeLeaderGap([
    { competitor: 'A', hits: 70 },
    { competitor: 'US', isSelf: true, hits: 30 },
  ]);
  assert.equal(g.leader, 'A');
  assert.equal(g.gapPp, 40);
  assert.equal(g.selfIsLeader, false);
  assert.equal(g.selfShare, 0.3);
});

test('头部差距：我方即头部时 gap=0 且标记 selfIsLeader', () => {
  const g = computeLeaderGap([
    { competitor: 'US', isSelf: true, hits: 70 },
    { competitor: 'A', hits: 30 },
  ]);
  assert.equal(g.selfIsLeader, true);
  assert.equal(g.gapPp, 0);
});

test('头部差距：空样本不臆造头部', () => {
  const g = computeLeaderGap([]);
  assert.equal(g.leader, null);
  assert.equal(g.selfShare, null);
});
