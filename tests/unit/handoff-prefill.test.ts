/**
 * consumeHandoff 单测 · hooks/useHandoffPrefill.ts
 *
 * 验证 /tandem DeliverCard 写入 → /im / /mail / /memories 消费的契约:
 *   - 正常 payload 读取后立即 remove (one-shot)
 *   - 不存在的 key → null, 不调用 remove
 *   - 非法 JSON → null
 *   - 字段缺失 (title 或 body 非 string) → null
 *   - storage.getItem 抛错 → null (private mode 兜底)
 */
import { describe, it, expect, vi } from 'vitest';
import { consumeHandoff, type HandoffTarget } from '@/hooks/useHandoffPrefill';

function makeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => (map.has(k) ? (map.get(k) as string) : null)),
    removeItem: vi.fn((k: string) => { map.delete(k); }),
    _map: map,
  };
}

describe('consumeHandoff', () => {
  const target: HandoffTarget = 'mail';
  const key = `tandem.handoff.${target}`;

  it('正常 payload → 返回 payload 并 remove 一次', () => {
    const store = makeStore({ [key]: JSON.stringify({ title: 'T', body: 'B', from: '/tandem' }) });
    const out = consumeHandoff(target, store);
    expect(out).toEqual({ title: 'T', body: 'B', from: '/tandem' });
    expect(store.removeItem).toHaveBeenCalledWith(key);
    expect(store._map.has(key)).toBe(false);
  });

  it('key 不存在 → null, 不 remove', () => {
    const store = makeStore({});
    const out = consumeHandoff(target, store);
    expect(out).toBeNull();
    expect(store.removeItem).not.toHaveBeenCalled();
  });

  it('非法 JSON → null (但已 remove, 避免下次再卡)', () => {
    const store = makeStore({ [key]: 'not-json{' });
    const out = consumeHandoff(target, store);
    expect(out).toBeNull();
    expect(store.removeItem).toHaveBeenCalledWith(key);
  });

  it('title 缺失 → null', () => {
    const store = makeStore({ [key]: JSON.stringify({ body: 'B' }) });
    expect(consumeHandoff(target, store)).toBeNull();
  });

  it('body 缺失 → null', () => {
    const store = makeStore({ [key]: JSON.stringify({ title: 'T' }) });
    expect(consumeHandoff(target, store)).toBeNull();
  });

  it('body 非 string → null', () => {
    const store = makeStore({ [key]: JSON.stringify({ title: 'T', body: 123 }) });
    expect(consumeHandoff(target, store)).toBeNull();
  });

  it('getItem 抛错 (private mode 模拟) → null', () => {
    const store = {
      getItem: vi.fn(() => { throw new Error('SecurityError'); }),
      removeItem: vi.fn(),
    };
    expect(consumeHandoff(target, store)).toBeNull();
    expect(store.removeItem).not.toHaveBeenCalled();
  });

  it('from 字段非 string → 退化为 undefined', () => {
    const store = makeStore({ [key]: JSON.stringify({ title: 'T', body: 'B', from: 42 }) });
    const out = consumeHandoff(target, store);
    expect(out).toEqual({ title: 'T', body: 'B', from: undefined });
  });

  it('不同 target → 不串扰', () => {
    const store = makeStore({
      'tandem.handoff.mail': JSON.stringify({ title: 'M', body: 'mail' }),
      'tandem.handoff.im': JSON.stringify({ title: 'I', body: 'im' }),
    });
    expect(consumeHandoff('mail', store)?.title).toBe('M');
    expect(consumeHandoff('im', store)?.title).toBe('I');
  });
});
