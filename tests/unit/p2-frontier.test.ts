/**
 * P2 前沿升级单测 · 纯函数部分 (Mnemis 层次 / GAM 主题相似 / RDC 可靠性曲线 / CWL 结构化驱逐)
 */
import { describe, it, expect } from 'vitest';
import { hierarchyScore } from '@/lib/memory/reranker';
import { topicSimilarity } from '@/lib/memory/consolidation';
import { computeReliabilityCurve, durationBucketOf } from '@/lib/eval/pass-k';
import { compactMessages } from '@/lib/agent-runtime/compaction';
import type { MemoryEntry } from '@/lib/types/memory';
import type { EvalTrace } from '@/lib/types/eval';
import type { ChatMessage } from '@/lib/taf/provider/types';

describe('P2 #16 Mnemis 层次化分类', () => {
  it('hierarchyScore: query token 命中 categoryPath 各段', () => {
    const m = { categoryPath: ['OKR', 'Q3', '进度'] } as MemoryEntry;
    const tokens = ['okr', 'q3'];
    expect(hierarchyScore(tokens, m)).toBeGreaterThan(0);
  });
  it('hierarchyScore: 无 categoryPath → 0', () => {
    expect(hierarchyScore(['okr'], {} as MemoryEntry)).toBe(0);
  });
});

describe('P2 #17 GAM 主题相似', () => {
  it('相同主题 → 高相似; 无关 → 低', () => {
    const high = topicSimilarity('OKR Q3 进度更新方案', 'OKR Q3 进度 复盘 方案');
    const low = topicSimilarity('OKR 进度', '报销 流程 财务');
    expect(high).toBeGreaterThan(low);
  });
});

describe('P2 #18 可靠性衰退曲线 (RDC)', () => {
  const g = (pass: boolean) => [{ graderId: 'a', score: pass ? 1 : 0, pass, rubric: '', gradedAt: '' }];
  const mk = (rounds: number, pass: boolean): EvalTrace => ({
    id: `t${Math.random()}`, traceId: 't', tenantId: 'default', kind: 'reasoning', actorUserId: 'u',
    isProxy: false, inputSummary: 'q', toolInvocations: [], finalOutputSummary: 'o',
    roundsExecuted: rounds, tokensUsed: 1, latencyMs: 1, grades: g(pass), createdAt: '2026-01-01',
  });

  it('durationBucketOf 分档正确', () => {
    expect(durationBucketOf(1)).toBe('short');
    expect(durationBucketOf(3)).toBe('medium');
    expect(durationBucketOf(5)).toBe('long');
    expect(durationBucketOf(9)).toBe('very_long');
  });

  it('短任务全过、长任务全败 → declineSlope 为正 (衰退)', () => {
    const traces = [mk(1, true), mk(1, true), mk(6, false), mk(6, false)];
    const curve = computeReliabilityCurve(traces);
    const short = curve.buckets.find((b) => b.bucket === 'short')!;
    const vlong = curve.buckets.find((b) => b.bucket === 'very_long')!;
    expect(short.passRate).toBe(1);
    expect(vlong.passRate).toBe(0);
    expect(curve.declineSlope).toBe(1);
  });
});

describe('P2 #13 CWL 结构化驱逐', () => {
  it('structuredEviction 驱逐已完成 tool 结果, 保留 user/assistant', async () => {
    const big = 'x'.repeat(3000);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      { role: 'assistant', content: 'thinking 1' },
      { role: 'tool', content: `tool result ${big}`, toolCallId: 'c1' },
      { role: 'assistant', content: 'thinking 2' },
      { role: 'tool', content: `tool result ${big}`, toolCallId: 'c2' },
      { role: 'assistant', content: 'thinking 3' },
      { role: 'tool', content: `tool result ${big}`, toolCallId: 'c3' },
      { role: 'user', content: 'follow up' },
      { role: 'assistant', content: 'recent' },
    ];
    const res = await compactMessages(messages, { triggerChars: 5000, keepLastTurns: 1, structuredEviction: true });
    expect(res.compacted).toBe(true);
    expect(res.usedLlm).toBe(false);
    expect(res.droppedCount).toBeGreaterThan(0);
    // 保留了推理上下文 (assistant) 与用户消息
    expect(res.messages.some((m) => m.role === 'assistant')).toBe(true);
    expect(res.messages.some((m) => m.role === 'user')).toBe(true);
  });
});
