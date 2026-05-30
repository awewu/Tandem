/**
 * BossAI 上下文感知 prompts 单测
 */
import { describe, it, expect } from 'vitest';
import { getExamplePrompts, getPathLabel } from '@/components/boss-ai/example-prompts';

describe('getExamplePrompts', () => {
  it('null/undefined path 返回通用 4 个', () => {
    expect(getExamplePrompts(null)).toHaveLength(4);
    expect(getExamplePrompts(undefined)).toHaveLength(4);
    expect(getExamplePrompts('')).toHaveLength(4);
  });

  it('/okr 精确匹配返回 OKR-specific', () => {
    const ps = getExamplePrompts('/okr');
    expect(ps).toHaveLength(4);
    expect(ps[0].text).toContain('OKR');
  });

  it('/okr/dashboard 前缀匹配 /okr', () => {
    const ps = getExamplePrompts('/okr/dashboard');
    expect(ps[0].text).toContain('OKR');
  });

  it('/convergence/abc-123 前缀匹配 /convergence', () => {
    const ps = getExamplePrompts('/convergence/abc-123');
    expect(ps.some((p) => p.text.includes('议事') || p.text.includes('议题') || p.text.includes('选项'))).toBe(true);
  });

  it('未注册 path 返回通用 prompts', () => {
    const ps = getExamplePrompts('/nonexistent-page');
    expect(ps).toHaveLength(4);
    // 通用第一个是 OKR 聚焦
    expect(ps[0].text).toContain('OKR');
  });

  it('所有注册路径都返回 4 个 prompts', () => {
    const paths = ['/okr', '/convergence', '/1on1', '/persona', '/atlas', '/tandem', '/report', '/learning', '/im', '/retros/me', '/360', '/nine-box'];
    for (const p of paths) {
      expect(getExamplePrompts(p)).toHaveLength(4);
    }
  });
});

describe('getPathLabel', () => {
  it('已知 path 返回人类可读标签', () => {
    expect(getPathLabel('/okr')).toBe('OKR 中心');
    expect(getPathLabel('/convergence')).toBe('议事室');
    expect(getPathLabel('/1on1')).toBe('1on1');
  });

  it('前缀匹配子路由', () => {
    expect(getPathLabel('/okr/cascade')).toBe('OKR 中心');
    expect(getPathLabel('/convergence/abc-123')).toBe('议事室');
    expect(getPathLabel('/retros/me')).toBe('复盘');
  });

  it('未知 path 返回 null', () => {
    expect(getPathLabel('/nonexistent')).toBeNull();
    expect(getPathLabel(null)).toBeNull();
    expect(getPathLabel(undefined)).toBeNull();
  });
});
