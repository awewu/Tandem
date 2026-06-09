/**
 * 搭子手抄 · 离线捕获队列回归测试
 *
 * 覆盖: 入队 / 读队 / 冲洗成功清空 / 冲洗失败保留 / 无 storage 安全空操作.
 * 用内存 localStorage stub + mock fetch 模拟浏览器.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- 内存 localStorage stub ---
function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const g = globalThis as unknown as { window?: unknown; fetch?: unknown };

beforeEach(() => {
  vi.resetModules();
  g.window = { localStorage: makeStorage() };
});

afterEach(() => {
  delete g.window;
  delete g.fetch;
  vi.restoreAllMocks();
});

async function load() {
  return import('@/lib/shouchao/offline-queue');
}

describe('offline-queue', () => {
  it('enqueue 落队, readQueue/queueSize 可读', async () => {
    const q = await load();
    const n = q.enqueue({ content: '断网时记的' });
    expect(n.id).toMatch(/^sc_local_/);
    expect(n.content).toBe('断网时记的');
    expect(q.queueSize()).toBe(1);
    expect(q.readQueue()[0].content).toBe('断网时记的');
  });

  it('flushQueue 成功 → push 全部并清空队列', async () => {
    const q = await load();
    q.enqueue({ content: 'a' });
    q.enqueue({ content: 'b' });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ notes: [{ id: 'x' }, { id: 'y' }] }),
    }));
    g.fetch = fetchMock;

    const synced = await q.flushQueue();
    expect(fetchMock).toHaveBeenCalledWith('/api/shouchao/sync', expect.objectContaining({ method: 'POST' }));
    expect(synced).toHaveLength(2);
    expect(q.queueSize()).toBe(0); // 成功才清空
  });

  it('flushQueue 失败 (网络抛错) → 保留队列, 返回 null', async () => {
    const q = await load();
    q.enqueue({ content: '仍离线' });
    g.fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const synced = await q.flushQueue();
    expect(synced).toBeNull();
    expect(q.queueSize()).toBe(1); // 未清空, 下次再试
  });

  it('flushQueue 空队列直接返回空数组, 不发请求', async () => {
    const q = await load();
    const fetchMock = vi.fn();
    g.fetch = fetchMock;
    const synced = await q.flushQueue();
    expect(synced).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('无 window/storage → 安全空操作 (SSR 友好)', async () => {
    delete g.window;
    const q = await load();
    expect(q.enqueue({ content: 'x' }).content).toBe('x'); // 不抛
    expect(q.readQueue()).toEqual([]);
    expect(q.queueSize()).toBe(0);
  });
});
