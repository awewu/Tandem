/**
 * P1 前沿升级单测 · 纯函数部分 (FIDES 信息流 / MAGMA 因果 / SimpleMem 注入文本)
 */
import { describe, it, expect } from 'vitest';
import { classifyIntegrity, isSensitiveTool, wrapUntrusted, containsUntrusted } from '@/lib/agent-runtime/info-flow';
import { isCausalQuery, causalScore } from '@/lib/memory/reranker';
import { memoryInjectionText } from '@/lib/memory/compression';
import type { MemoryEntry } from '@/lib/types/memory';

describe('P1 #7 FIDES 信息流标签', () => {
  it('classifyIntegrity: 外部来源工具 → untrusted', () => {
    expect(classifyIntegrity('web.search')).toBe('untrusted');
    expect(classifyIntegrity('shouchao.read')).toBe('untrusted');
    expect(classifyIntegrity('mail.fetch')).toBe('untrusted');
  });
  it('classifyIntegrity: 内部只读 → trusted (默认)', () => {
    expect(classifyIntegrity('okr.read')).toBe('trusted');
    expect(classifyIntegrity('okr.health_digest')).toBe('trusted');
  });
  it('classifyIntegrity: MCP → untrusted', () => {
    expect(classifyIntegrity('github.list_issues', { isMcp: true })).toBe('untrusted');
  });
  it('isSensitiveTool: 写/外发/执行 → true', () => {
    expect(isSensitiveTool('memory.write')).toBe(true);
    expect(isSensitiveTool('notification.send')).toBe(true);
    expect(isSensitiveTool('action.execute')).toBe(true);
    expect(isSensitiveTool('okr.read')).toBe(false);
  });
  it('wrapUntrusted / containsUntrusted 往返', () => {
    const wrapped = wrapUntrusted('some external content', 'web.search');
    expect(wrapped).toContain('source=web.search');
    expect(containsUntrusted(wrapped)).toBe(true);
    expect(containsUntrusted('plain trusted text')).toBe(false);
  });
});

describe('P1 #9 MAGMA 因果', () => {
  it('isCausalQuery: 中英因果词命中', () => {
    expect(isCausalQuery('这个决策为什么导致 KR 下降')).toBe(true);
    expect(isCausalQuery('why did the KR drop')).toBe(true);
    expect(isCausalQuery('OKR 进度如何')).toBe(false);
  });
  it('causalScore: 有因果链接得分, 无则 0', () => {
    const linked = { causedBy: ['m1'], caused: ['m2', 'm3'] } as MemoryEntry;
    const isolated = {} as MemoryEntry;
    expect(causalScore(linked)).toBeGreaterThan(0);
    expect(causalScore(isolated)).toBe(0);
  });
});

describe('P1 #8 SimpleMem 注入文本', () => {
  it('有压缩版 → 用压缩版 + 关键事实', () => {
    const m = { body: '很长的原始正文'.repeat(50), compressedBody: '摘要', compressedFacts: ['事实A', '事实B'] } as MemoryEntry;
    const text = memoryInjectionText(m);
    expect(text).toContain('摘要');
    expect(text).toContain('事实A');
    expect(text.length).toBeLessThan(m.body.length);
  });
  it('无压缩版 → 回退原始 body', () => {
    const m = { body: '原始正文' } as MemoryEntry;
    expect(memoryInjectionText(m)).toBe('原始正文');
  });
});
