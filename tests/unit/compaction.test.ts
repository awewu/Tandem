/**
 * Compaction 单测 · lib/agent-runtime/compaction.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '@/lib/taf/provider/types';

vi.mock('@/lib/boot', () => ({
  getRouter: vi.fn(() => ({
    chat: vi.fn(async () => ({
      message: { role: 'assistant', content: '摘要: 用户问了 5 个问题, 主要关于 OKR 对齐.' },
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })),
  })),
}));

import { compactMessages } from '@/lib/agent-runtime/compaction';

function makeMsg(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}

describe('compactMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未达阈值时原样返回', async () => {
    const msgs: ChatMessage[] = [
      makeMsg('system', 'system prompt'),
      makeMsg('user', '你好'),
      makeMsg('assistant', '你好, 有什么需要?'),
    ];
    const r = await compactMessages(msgs, { triggerChars: 10000 });
    expect(r.compacted).toBe(false);
    expect(r.droppedCount).toBe(0);
    expect(r.messages).toBe(msgs);
  });

  it('超过阈值且有可压缩中间段时调用 LLM 摘要', async () => {
    const big = 'X'.repeat(1500);
    const msgs: ChatMessage[] = [
      makeMsg('system', 'system prompt'),
      makeMsg('user', '初始任务'),
      // 8 轮中间对话
      ...Array.from({ length: 16 }, (_, i) =>
        makeMsg(i % 2 === 0 ? 'user' : 'assistant', `${big} #${i}`),
      ),
      makeMsg('user', '最近问题 1'),
      makeMsg('assistant', '最近答 1'),
      makeMsg('user', '最近问题 2'),
      makeMsg('assistant', '最近答 2'),
    ];

    const r = await compactMessages(msgs, { triggerChars: 5000, keepLastTurns: 2 });

    expect(r.compacted).toBe(true);
    expect(r.usedLlm).toBe(true);
    expect(r.droppedCount).toBeGreaterThan(0);
    // 保留: 1 system + 1 first user + 1 summary system + 4 tail (2 turns)
    expect(r.messages.length).toBe(7);
    expect(r.messages[0].role).toBe('system');
    expect(r.messages[1].role).toBe('user');
    expect(r.messages[1].content).toBe('初始任务');
    expect(r.messages[2].role).toBe('system');
    expect(String(r.messages[2].content)).toContain('对话摘要');
    // 末尾 4 条
    expect(r.messages[r.messages.length - 1].content).toBe('最近答 2');
    expect(r.charsBeforeAfter?.after).toBeLessThan(r.charsBeforeAfter!.before);
  });

  it('enableLlmSummary=false 时降级硬截断, 仍输出 fingerprint', async () => {
    const big = 'Y'.repeat(1500);
    const msgs: ChatMessage[] = [
      makeMsg('system', 'system'),
      makeMsg('user', '锚'),
      ...Array.from({ length: 10 }, (_, i) =>
        makeMsg(i % 2 === 0 ? 'user' : 'assistant', `${big} #${i}`),
      ),
      makeMsg('user', '末'),
      makeMsg('assistant', '末答'),
    ];
    const r = await compactMessages(msgs, {
      triggerChars: 3000,
      keepLastTurns: 1,
      enableLlmSummary: false,
    });
    expect(r.compacted).toBe(true);
    expect(r.usedLlm).toBe(false);
    const summary = String(r.messages.find((m) => m.role === 'system' && String(m.content).includes('对话摘要'))?.content ?? '');
    expect(summary).toContain('硬截断');
    expect(summary).toContain('历史消息指纹');
  });

  it('LLM 摘要失败时降级硬截断, 不抛错', async () => {
    const { getRouter } = await import('@/lib/boot');
    (getRouter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      chat: vi.fn(async () => {
        throw new Error('upstream timeout');
      }),
    });

    const big = 'Z'.repeat(2000);
    const msgs: ChatMessage[] = [
      makeMsg('system', 'sys'),
      makeMsg('user', '锚'),
      ...Array.from({ length: 6 }, (_, i) =>
        makeMsg(i % 2 === 0 ? 'user' : 'assistant', `${big} #${i}`),
      ),
      makeMsg('user', '末'),
      makeMsg('assistant', '末答'),
    ];
    const r = await compactMessages(msgs, { triggerChars: 3000, keepLastTurns: 1 });
    expect(r.compacted).toBe(true);
    expect(r.usedLlm).toBe(false); // 摘要失败 → 降级
    expect(r.droppedCount).toBeGreaterThan(0);
  });

  it('中间段过短即使超阈值也不压', async () => {
    // 一个 user + 巨大 system 触发阈值, 但中间 user/assistant 不够多
    const msgs: ChatMessage[] = [
      makeMsg('system', 'X'.repeat(20000)),
      makeMsg('user', '一个简短任务'),
      makeMsg('assistant', '答'),
    ];
    const r = await compactMessages(msgs, { triggerChars: 1000, keepLastTurns: 4 });
    // tail 至少 8 条 (4 轮), 实际只有 1 条 assistant → middle = 0
    expect(r.compacted).toBe(false);
  });
});
