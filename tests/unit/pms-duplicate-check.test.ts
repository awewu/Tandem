import { describe, it, expect } from 'vitest';
import {
  jaccardSimilarity,
  addressSimilarity,
  phoneMatch,
  classifyDuplicate,
  normalizeName,
  nameSimilarityLexical,
  scoreDuplicate,
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

describe('PMS duplicate-check · classifyDuplicate 阈值分级 (含 suspect 疑似档)', () => {
  it('< 0.45 → pass', () => {
    expect(classifyDuplicate(0)).toBe('pass');
    expect(classifyDuplicate(0.44)).toBe('pass');
  });

  it('[0.45, 0.60) → suspect (人工复核)', () => {
    expect(classifyDuplicate(0.45)).toBe('suspect');
    expect(classifyDuplicate(0.59)).toBe('suspect');
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

describe('PMS duplicate-check · normalizeName 归一化 (破简称/全角/噪声词)', () => {
  it('剥离公司实体后缀 + 项目通用词', () => {
    expect(normalizeName('杭州希尔顿酒店管理有限公司')).toBe('杭州希尔顿酒店');
    expect(normalizeName('华住集团热水系统改造项目')).toBe('华住热水');
  });

  it('全角转半角 + 转小写 + 去标点空白', () => {
    expect(normalizeName('ＡＢＣ－１２３')).toBe('abc123');
    expect(normalizeName('北京 · 华住（总部）')).toBe('北京华住总部');
  });

  it('空值安全', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
  });
});

describe('PMS duplicate-check · nameSimilarityLexical 简称匹配', () => {
  it('简称 vs 全称: 归一化后字面相似度显著高于原始 (剩余靠语义层补)', () => {
    const raw = jaccardSimilarity('希尔顿', '杭州希尔顿酒店管理有限公司');
    const norm = nameSimilarityLexical('希尔顿', '杭州希尔顿酒店管理有限公司');
    expect(norm).toBeGreaterThan(raw);
    expect(norm).toBeGreaterThan(0.4);
  });

  it('任一空 → 0', () => {
    expect(nameSimilarityLexical('', '希尔顿')).toBe(0);
  });

  it('别名词典: 中英混写规范化后可匹配 (Hilton → 希尔顿)', () => {
    expect(normalizeName('Hilton酒店')).toBe('希尔顿酒店');
    // 中英两种写法归一到同一规范名 → 完全匹配
    expect(nameSimilarityLexical('Hilton酒店', '希尔顿酒店')).toBe(1);
  });
});

describe('PMS duplicate-check · scoreDuplicate 综合评分 (修复漏判)', () => {
  it('同名 + 同电话 → 直判撞单 (旧算法只得 0.425 放过)', () => {
    const s = scoreDuplicate({ nameSim: 0.9, projectSim: 0.3, addrSim: null, phoneExact: true });
    expect(s).toBeGreaterThanOrEqual(0.8);
    expect(classifyDuplicate(s)).toBe('duplicate');
  });

  it('电话一致但名称不相似 → 至少预警', () => {
    const s = scoreDuplicate({ nameSim: 0.2, projectSim: 0.1, addrSim: null, phoneExact: true });
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(classifyDuplicate(s)).not.toBe('pass');
  });

  it('信息不全(缺地址)不再结构性拉低: 高名+高项目 → 撞单', () => {
    const s = scoreDuplicate({ nameSim: 0.95, projectSim: 0.9, addrSim: null, phoneExact: false });
    expect(s).toBeGreaterThanOrEqual(0.8);
  });

  it('地址在场时纳入加权平均', () => {
    const withAddr = scoreDuplicate({ nameSim: 0.9, projectSim: 0.9, addrSim: 0.2, phoneExact: false });
    const noAddr = scoreDuplicate({ nameSim: 0.9, projectSim: 0.9, addrSim: null, phoneExact: false });
    expect(withAddr).toBeLessThan(noAddr); // 低地址分拉低总分
  });

  it('全不相似 → pass', () => {
    const s = scoreDuplicate({ nameSim: 0.1, projectSim: 0.1, addrSim: 0.1, phoneExact: false });
    expect(classifyDuplicate(s)).toBe('pass');
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
