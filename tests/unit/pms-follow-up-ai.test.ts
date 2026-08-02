/**
 * tests/unit/pms-follow-up-ai.test.ts
 *
 * 锁 lib/pms/follow-up-ai.ts 纯函数 (提取映射 + 日期归一化 + 基线):
 *   - buildFollowUpBaseline: 原文作正文, 阶段兜底, source=rule
 *   - normalizeIsoDate: 多格式 → yyyy-mm-dd; 非法 → undefined
 *   - mapFollowUpExtraction: null → baseline; 部分字段回退; 完整映射 source=ai
 */

import { describe, expect, it } from 'vitest';

import {
  buildFollowUpBaseline,
  normalizeIsoDate,
  mapFollowUpExtraction,
} from '@/lib/pms/follow-up-ai';

describe('buildFollowUpBaseline', () => {
  it('原文作正文 + 阶段兜底 + source=rule', () => {
    const b = buildFollowUpBaseline('  今天拜访了客户  ');
    expect(b.source).toBe('rule');
    expect(b.stage).toBe('跟进');
    expect(b.content).toBe('今天拜访了客户');
    expect(b.nextFollowUpAt).toBeUndefined();
    expect(b.keyPoints).toEqual([]);
  });
});

describe('normalizeIsoDate', () => {
  it('yyyy-mm-dd / yyyy/m/d → 补零 ISO', () => {
    expect(normalizeIsoDate('2026-08-05')).toBe('2026-08-05');
    expect(normalizeIsoDate('2026/8/5')).toBe('2026-08-05');
    expect(normalizeIsoDate('下次 2026-12-1 再谈')).toBe('2026-12-01');
  });
  it('非法/空/非字符串 → undefined', () => {
    expect(normalizeIsoDate('')).toBeUndefined();
    expect(normalizeIsoDate('下周')).toBeUndefined();
    expect(normalizeIsoDate(null)).toBeUndefined();
    expect(normalizeIsoDate(20260805)).toBeUndefined();
  });
});

describe('mapFollowUpExtraction', () => {
  const baseline = buildFollowUpBaseline('原始记录');

  it('null → 基线', () => {
    expect(mapFollowUpExtraction(null, baseline)).toBe(baseline);
  });

  it('完整映射 → source=ai + 日期归一化 + keyPoints', () => {
    const d = mapFollowUpExtraction(
      {
        stage: '方案沟通',
        content: '与客户确认了技术方案, 客户倾向变频机型',
        nextFollowUpAt: '2026/8/10',
        keyPoints: ['倾向变频', '预算 30 万'],
      },
      baseline,
    );
    expect(d.source).toBe('ai');
    expect(d.stage).toBe('方案沟通');
    expect(d.content).toContain('变频');
    expect(d.nextFollowUpAt).toBe('2026-08-10');
    expect(d.keyPoints).toHaveLength(2);
  });

  it('缺 stage/content → 回退基线值; 非法日期 → undefined', () => {
    const d = mapFollowUpExtraction(
      { stage: '  ', content: '', nextFollowUpAt: '待定', keyPoints: 'not-array' },
      baseline,
    );
    expect(d.source).toBe('ai');
    expect(d.stage).toBe(baseline.stage);
    expect(d.content).toBe(baseline.content);
    expect(d.nextFollowUpAt).toBeUndefined();
    expect(d.keyPoints).toEqual([]);
  });
});
