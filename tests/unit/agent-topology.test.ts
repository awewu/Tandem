/**
 * tests/unit/agent-topology.test.ts · 编排拓扑门控 (AdaptOrch 推理时落地 · Phase 4)
 */

import { describe, it, expect } from 'vitest';
import {
  selectTopology,
  applyTopologyCeiling,
  type OrchestrationTopology,
} from '@/lib/agent-runtime/topology';

const RANK: Record<OrchestrationTopology, number> = {
  direct: 0, single_pass: 1, multi_step: 2, deep: 3,
};

describe('selectTopology', () => {
  it('空查询 / 无工具 → direct', () => {
    expect(selectTopology('').topology).toBe('direct');
    expect(selectTopology('   ').topology).toBe('direct');
    expect(selectTopology('公司 OKR 进度?', { toolsetSize: 0 }).topology).toBe('direct');
  });

  it('跨维度 (≥2 数据域) → deep 满配 5 轮', () => {
    const p = selectTopology('OKR 进度和销售管道、奖金分配之间的错配在哪?', { toolsetSize: 9 });
    expect(p.topology).toBe('deep');
    expect(p.maxRounds).toBe(5);
    expect(p.maxTokens).toBe(1200);
  });

  it('融合/归因话术 → deep', () => {
    expect(selectTopology('为什么这个季度赢单率下滑?', { toolsetSize: 9 }).topology).toBe('deep');
    expect(selectTopology('KR-3 一路是怎么演进的、来龙去脉梳理下', { toolsetSize: 9 }).topology).toBe('deep');
  });

  it('多问 (≥2 问号) → deep', () => {
    expect(selectTopology('OKR 进度如何？还有哪些落后？', { toolsetSize: 9 }).topology).toBe('deep');
  });

  it('多实体 (≥2 编号) → deep', () => {
    expect(selectTopology('对比 KR-1 和 KR-2 的执行情况', { toolsetSize: 9 }).topology).toBe('deep');
  });

  it('单维度 + 单实体 → multi_step (3 轮)', () => {
    const p = selectTopology('查一下 KR-7 现在的完成进度到哪了', { toolsetSize: 9 });
    expect(p.topology).toBe('multi_step');
    expect(p.maxRounds).toBe(3);
  });

  it('单维度 + 较长 → multi_step (3 轮)', () => {
    const p = selectTopology('请帮我仔细看一下这个季度整个华东大区团队的绩效指标达成率目前大概处在什么样的水平线上有没有明显偏低的地方', { toolsetSize: 9 });
    expect(p.topology).toBe('multi_step');
  });

  it('单点短查询 → single_pass (2 轮)', () => {
    const p = selectTopology('KPI 达成率', { toolsetSize: 9 });
    expect(p.topology).toBe('single_pass');
    expect(p.maxRounds).toBe(2);
  });

  it('预算随复杂度单调不减', () => {
    const direct = selectTopology('', { toolsetSize: 0 });
    const single = selectTopology('KPI 达成率', { toolsetSize: 9 });
    const deep = selectTopology('OKR 和奖金的错配为什么出现?', { toolsetSize: 9 });
    expect(RANK[single.topology]).toBeGreaterThan(RANK[direct.topology]);
    expect(deep.maxRounds).toBeGreaterThanOrEqual(single.maxRounds);
    expect(deep.maxTokens).toBeGreaterThanOrEqual(single.maxTokens);
  });

  it('确定性: 同输入同输出', () => {
    const q = 'OKR 进度和销售管道的错配?';
    expect(selectTopology(q, { toolsetSize: 9 })).toEqual(selectTopology(q, { toolsetSize: 9 }));
  });

  it('永不抛 (含异常输入)', () => {
    expect(() => selectTopology(undefined as never)).not.toThrow();
    expect(() => selectTopology(null as never, { toolsetSize: -1 })).not.toThrow();
    expect(() => selectTopology('x'.repeat(5000), { toolsetSize: 9 })).not.toThrow();
  });
});

describe('applyTopologyCeiling', () => {
  it('显式上限只收紧不放大 (取 min)', () => {
    expect(applyTopologyCeiling(3, 5)).toBe(3); // 建议3 上限5 → 3
    expect(applyTopologyCeiling(5, 3)).toBe(3); // 建议5 上限3 → 3 (被上限压)
  });

  it('无上限 → 直接采用建议', () => {
    expect(applyTopologyCeiling(3, undefined)).toBe(3);
  });

  it('最小 1', () => {
    expect(applyTopologyCeiling(0, undefined)).toBe(1);
    expect(applyTopologyCeiling(5, 0)).toBe(1);
  });
});
