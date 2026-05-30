import { describe, expect, it } from 'vitest';
import { formatStatValue, formatStatDelta, deltaSemantic } from '@/lib/format/stat';

describe('formatStatValue', () => {
  it('integer · 千分位 + 整数', () => {
    expect(formatStatValue(12345, 'integer', 0)).toEqual({ num: '12,345', suffix: '' });
  });

  it('integer · 自定义单位', () => {
    expect(formatStatValue(42, 'integer', 0, '条')).toEqual({ num: '42', suffix: '条' });
  });

  it('integer · 浮点四舍五入', () => {
    expect(formatStatValue(12.6, 'integer', 0)).toEqual({ num: '13', suffix: '' });
  });

  it('decimal · 默认 1 位小数', () => {
    expect(formatStatValue(3.14159, 'decimal', 1)).toEqual({ num: '3.1', suffix: '' });
  });

  it('decimal · 大数千分位', () => {
    expect(formatStatValue(1234.5, 'decimal', 1)).toEqual({ num: '1,234.5', suffix: '' });
  });

  it('percent · 0.72 → "72.0" + "%"', () => {
    expect(formatStatValue(0.72, 'percent', 1)).toEqual({ num: '72.0', suffix: '%' });
  });

  it('percent · 0 位小数', () => {
    expect(formatStatValue(0.5, 'percent', 0)).toEqual({ num: '50', suffix: '%' });
  });

  it('currency · 默认 ¥', () => {
    expect(formatStatValue(1234.5, 'currency', 2)).toEqual({ num: '1,234.50', suffix: '¥' });
  });

  it('currency · 自定义单位 (USD)', () => {
    expect(formatStatValue(1234, 'currency', 2, '$')).toEqual({ num: '1,234.00', suffix: '$' });
  });
});

describe('formatStatDelta', () => {
  it('正 delta · 加号 + 千分位', () => {
    expect(formatStatDelta(1234, 'integer', 0)).toBe('+1,234');
  });

  it('负 delta · U+2212 减号 (不是 ASCII -)', () => {
    expect(formatStatDelta(-3, 'integer', 0)).toBe('\u22123');
  });

  it('零 delta · 无符号', () => {
    expect(formatStatDelta(0, 'integer', 0)).toBe('0');
  });

  it('percent delta · 单位 pp', () => {
    expect(formatStatDelta(0.05, 'percent', 1)).toBe('+5.0pp');
    expect(formatStatDelta(-0.012, 'percent', 1)).toBe('\u22121.2pp');
  });

  it('decimal delta · 保留精度', () => {
    expect(formatStatDelta(2.345, 'decimal', 2)).toBe('+2.35');
  });
});

describe('deltaSemantic', () => {
  it('null/undefined/0 都是 flat', () => {
    expect(deltaSemantic(null, false)).toEqual({ dir: 'flat', good: false });
    expect(deltaSemantic(undefined, false)).toEqual({ dir: 'flat', good: false });
    expect(deltaSemantic(0, false)).toEqual({ dir: 'flat', good: false });
  });

  it('正常指标 (越高越好): up=good, down=bad', () => {
    expect(deltaSemantic(5, false)).toEqual({ dir: 'up', good: true });
    expect(deltaSemantic(-5, false)).toEqual({ dir: 'down', good: false });
  });

  it('反向指标 (越低越好, 如事故数): down=good', () => {
    expect(deltaSemantic(5, true)).toEqual({ dir: 'up', good: false });
    expect(deltaSemantic(-5, true)).toEqual({ dir: 'down', good: true });
  });
});
