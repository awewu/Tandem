/**
 * StageMeta SSOT 单测
 *
 * 验证:
 *   1. 5 阶段全覆盖
 *   2. Lv.1-5 严格递增
 *   3. 与 PersonaStage / DelegationLevel 枚举对齐
 *   4. v2 命名 (新手→拿手) 已生效
 *   5. STAGE_LIST 顺序与 internalLabel 一致
 */

import { describe, it, expect } from 'vitest';
import {
  STAGE_META,
  STAGE_LIST,
  TONE_TOKENS,
  daysInStage,
} from '@/lib/persona/stage-meta';
import type { PersonaStage } from '@/lib/types/persona';

describe('STAGE_META · v2 命名 (新手→上手→熟手→老手→拿手)', () => {
  const expected: Array<[PersonaStage, string, number]> = [
    ['newborn', '新手', 1],
    ['apprentice', '上手', 2],
    ['assistant', '熟手', 3],
    ['deputy', '老手', 4],
    ['partner', '拿手', 5],
  ];

  it.each(expected)('%s → Lv.%i %s', (stage, title, level) => {
    const m = STAGE_META[stage];
    expect(m).toBeDefined();
    expect(m.title).toBe(title);
    expect(m.level).toBe(level);
  });

  it('5 阶段全覆盖', () => {
    expect(Object.keys(STAGE_META).sort()).toEqual(
      ['apprentice', 'assistant', 'deputy', 'newborn', 'partner'].sort(),
    );
  });

  it('STAGE_LIST 顺序与 level 递增一致', () => {
    expect(STAGE_LIST).toHaveLength(5);
    for (let i = 0; i < STAGE_LIST.length; i++) {
      expect(STAGE_LIST[i].level).toBe(i + 1);
    }
  });

  it('partner = 拿手 (谐音"拿捏"产品哲学)', () => {
    expect(STAGE_META.partner.title).toBe('拿手');
    expect(STAGE_META.partner.titleEn).toBe('Master');
  });

  it('每个 tone 都有对应的 TONE_TOKENS', () => {
    for (const m of STAGE_LIST) {
      expect(TONE_TOKENS[m.tone]).toBeDefined();
      expect(TONE_TOKENS[m.tone].progressFill).toMatch(/^bg-/);
    }
  });

  it('实习权限 (L0-L3) 随 level 单调递增 (允许相同)', () => {
    const ordering = { L0: 0, L1: 1, L2: 2, L3: 3 } as const;
    for (let i = 1; i < STAGE_LIST.length; i++) {
      expect(ordering[STAGE_LIST[i].delegationShort]).toBeGreaterThanOrEqual(
        ordering[STAGE_LIST[i - 1].delegationShort],
      );
    }
  });
});

describe('daysInStage', () => {
  it('支持 ISO 字符串', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400_000).toISOString();
    expect(daysInStage(tenDaysAgo)).toBeGreaterThanOrEqual(9);
    expect(daysInStage(tenDaysAgo)).toBeLessThanOrEqual(11);
  });

  it('未来时间返回 0 (clamp)', () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(daysInStage(future)).toBe(0);
  });
});
