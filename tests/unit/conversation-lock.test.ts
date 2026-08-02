import { describe, expect, it } from 'vitest';
import { withConversationLock } from '@/lib/infra/leader';

const TTL = 5_000;
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('withConversationLock (会话级串行租约)', () => {
  it('serializes concurrent calls on the same key (no interleave)', async () => {
    const log: string[] = [];
    const make = (id: number) => () =>
      (async () => {
        log.push(`start-${id}`);
        await tick(10);
        log.push(`end-${id}`);
        return id;
      })();

    const results = await Promise.all([
      withConversationLock('k', TTL, make(1)),
      withConversationLock('k', TTL, make(2)),
      withConversationLock('k', TTL, make(3)),
    ]);

    // FIFO 串行: 每个 start 紧跟自己的 end, 不交错
    expect(log).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
    expect(results).toEqual([1, 2, 3]);
  });

  it('allows different keys to run concurrently', async () => {
    const log: string[] = [];
    const make = (id: string) => () =>
      (async () => {
        log.push(`start-${id}`);
        await tick(10);
        log.push(`end-${id}`);
      })();

    await Promise.all([
      withConversationLock('a', TTL, make('a')),
      withConversationLock('b', TTL, make('b')),
    ]);

    // 不同 key 并发: 两个 start 都在任一 end 之前
    expect(log.slice(0, 2).sort()).toEqual(['start-a', 'start-b']);
  });

  it('keeps the queue alive after a rejection (one failure does not block the next)', async () => {
    const ran: string[] = [];
    const failing = withConversationLock('k2', TTL, async () => {
      ran.push('fail');
      throw new Error('boom');
    });
    const next = withConversationLock('k2', TTL, async () => {
      ran.push('ok');
      return 'ok';
    });

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
    expect(ran).toEqual(['fail', 'ok']);
  });

  it('propagates the fn return value', async () => {
    await expect(withConversationLock('k3', TTL, async () => 42)).resolves.toBe(42);
  });
});
