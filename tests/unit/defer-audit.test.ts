/**
 * deferAudit 单测 · lib/audit/defer.ts
 *
 * 验证:
 *   1. deferAudit 不阻塞 (sync return undefined)
 *   2. audit() 被异步调用
 *   3. audit() 抛错时不传播
 *   4. pending counter 正确
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audit } from '@/lib/audit/log';

vi.mock('@/lib/audit/log', () => ({
  audit: vi.fn(async () => ({ id: 'mock' } as never)),
}));

import { deferAudit, deferredAuditPending } from '@/lib/audit/defer';

describe('deferAudit', () => {
  beforeEach(() => {
    (audit as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it('立即返回 undefined (不 await)', () => {
    const r = deferAudit('boss_ai.ask', 'u1');
    expect(r).toBeUndefined();
  });

  it('audit() 最终被调用', async () => {
    deferAudit('boss_ai.ask', 'u1', { metadata: { x: 1 } });
    // microtask + 一轮 event loop 后应已 fired
    await new Promise((r) => setTimeout(r, 5));
    expect(audit).toHaveBeenCalledOnce();
    expect((audit as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      'boss_ai.ask',
      'u1',
      { metadata: { x: 1 } },
    ]);
  });

  it('audit() 抛错时不传播', async () => {
    (audit as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db down'));
    expect(() => deferAudit('boss_ai.ask', 'u1')).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
    // 此处不抛, 测试通过即可
  });

  it('pending counter 跟随调用变化', async () => {
    const before = deferredAuditPending();
    deferAudit('boss_ai.ask', 'u1');
    deferAudit('boss_ai.answer', 'u1');
    // 在 audit 跑完前, counter 应已 +2
    expect(deferredAuditPending()).toBe(before + 2);
    // 等 finalize
    await new Promise((r) => setTimeout(r, 10));
    expect(deferredAuditPending()).toBe(before);
  });
});
