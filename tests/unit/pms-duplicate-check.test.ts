import { describe, it, expect } from 'vitest';
import {
  jaccardSimilarity,
  addressSimilarity,
  phoneMatch,
  classifyDuplicate,
} from '@/lib/pms/duplicate-check';
import { generateDedupeKey } from '@/lib/pms/opportunity-service';

describe('PMS duplicate-check · 五维查重纯函数', () => {
  describe('jaccardSimilarity', () => {
    it('完全相同字符串返回 1', () => {
      expect(jaccardSimilarity('北京华住酒店', '北京华住酒店')).toBe(1);
    });

    it('完全不同字符串返回较低分', () => {
      expect(jaccardSimilarity('abc', 'xyz')).toBe(0);
    });

    it('大小写不敏感', () => {
      expect(jaccardSimilarity('Hilton', 'hilton')).toBe(1);
    });

    it('部分重叠返回 0-1 之间', () => {
      const score = jaccardSimilarity('北京华住酒店集团', '北京华住酒店');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('两个空字符串返回 0（并集为空）', () => {
      expect(jaccardSimilarity('', '')).toBe(0);
    });
  });

  describe('addressSimilarity', () => {
    it('缺失任一地址返回 0', () => {
      expect(addressSimilarity(undefined, '北京市朝阳区')).toBe(0);
      expect(addressSimilarity('北京市朝阳区', undefined)).toBe(0);
      expect(addressSimilarity(undefined, undefined)).toBe(0);
    });

    it('相同地址返回 1', () => {
      expect(addressSimilarity('北京市朝阳区建国路88号', '北京市朝阳区建国路88号')).toBe(1);
    });

    it('相似地址返回较高分', () => {
      const score = addressSimilarity('北京市朝阳区建国路88号', '北京市朝阳区建国路90号');
      expect(score).toBeGreaterThan(0.7);
    });
  });

  describe('phoneMatch', () => {
    it('缺失任一电话返回 false', () => {
      expect(phoneMatch(undefined, '13800138000')).toBe(false);
      expect(phoneMatch('13800138000', undefined)).toBe(false);
    });

    it('相同号码返回 true', () => {
      expect(phoneMatch('13800138000', '13800138000')).toBe(true);
    });

    it('忽略格式符号（空格/横线/括号）', () => {
      expect(phoneMatch('138-0013-8000', '13800138000')).toBe(true);
      expect(phoneMatch('138 0013 8000', '13800138000')).toBe(true);
      expect(phoneMatch('(138)00138000', '13800138000')).toBe(true);
    });

    it('不同号码返回 false', () => {
      expect(phoneMatch('13800138000', '13900139000')).toBe(false);
    });
  });
});

describe('PMS duplicate-check · classifyDuplicate 阈值分级', () => {
  it('< 0.60 → pass', () => {
    expect(classifyDuplicate(0)).toBe('pass');
    expect(classifyDuplicate(0.59)).toBe('pass');
  });

  it('[0.60, 0.80) → warning', () => {
    expect(classifyDuplicate(0.6)).toBe('warning');
    expect(classifyDuplicate(0.79)).toBe('warning');
  });

  it('>= 0.80 → duplicate', () => {
    expect(classifyDuplicate(0.8)).toBe('duplicate');
    expect(classifyDuplicate(1)).toBe('duplicate');
  });
});

describe('PMS · generateDedupeKey 确定性', () => {
  it('相同输入 → 相同键', () => {
    const a = generateDedupeKey('北京华住', '朝阳路1号', '热水项目');
    const b = generateDedupeKey('北京华住', '朝阳路1号', '热水项目');
    expect(a).toBe(b);
  });

  it('大小写不敏感', () => {
    expect(generateDedupeKey('ACME', 'Road', 'Proj')).toBe(
      generateDedupeKey('acme', 'road', 'proj')
    );
  });

  it('不同输入 → 不同键', () => {
    const a = generateDedupeKey('客户A', '地址X', '项目1');
    const b = generateDedupeKey('客户B', '地址Y', '项目2');
    expect(a).not.toBe(b);
  });

  it('键长度不超过 32', () => {
    const k = generateDedupeKey('很长的客户名称'.repeat(10), '很长地址'.repeat(10), '项目'.repeat(10));
    expect(k.length).toBeLessThanOrEqual(32);
  });
});
