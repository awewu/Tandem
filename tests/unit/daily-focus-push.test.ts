/**
 * tests/unit/daily-focus-push.test.ts
 *
 * 锁 lib/persona/daily-focus-push.ts 推送门控与过滤 (依赖注入, 不碰真库):
 *   - 默认关闭 (enabled=false) → 完全 no-op, 不生成/不推送
 *   - 启用后: 只推 actNowCount>0 的用户; disabled 用户跳过
 *   - 单用户失败 fail-soft, 不影响其余
 *   - 通知内容含 headline + sourceId 带日期
 */

import { describe, expect, it, vi } from 'vitest';

import { pushDailyFocusNotifications } from '@/lib/persona/daily-focus-push';
import type { DailyFocus } from '@/lib/persona/daily-focus';

function focus(actNowCount: number, headline = 'H'): DailyFocus {
  return {
    userId: 'x',
    generatedAt: new Date().toISOString(),
    itemCount: actNowCount,
    actNowCount,
    highCount: 0,
    headline,
    suggestedNextStep: actNowCount > 0 ? 'do it' : null,
    items: [],
    markdown: '',
  };
}

describe('pushDailyFocusNotifications', () => {
  it('默认关闭 → no-op, 不生成不推送', async () => {
    const generate = vi.fn();
    const notify = vi.fn();
    const r = await pushDailyFocusNotifications({
      deps: { enabled: false, listUsers: async () => [{ id: 'u1' }], generate, notify },
    });
    expect(r).toEqual({ enabled: false, scanned: 0, pushed: 0 });
    expect(generate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('启用: 只推 actNowCount>0, 跳过 disabled 用户', async () => {
    const notify = vi.fn(
      async (_cmd: { userId: string; title: string; body: string; sourceId: string; url: string }) => {},
    );
    const generate = vi.fn(async (userId: string) =>
      userId === 'urgent' ? focus(2, '你有 2 项急事') : focus(0),
    );
    const r = await pushDailyFocusNotifications({
      now: Date.parse('2026-08-01T00:00:00Z'),
      deps: {
        enabled: true,
        listUsers: async () => [
          { id: 'urgent' },
          { id: 'calm' },
          { id: 'gone', disabled: true },
        ],
        generate,
        notify,
      },
    });
    expect(r.enabled).toBe(true);
    expect(r.scanned).toBe(2); // disabled 已过滤
    expect(r.pushed).toBe(1);
    expect(generate).not.toHaveBeenCalledWith('gone', expect.anything());
    expect(notify).toHaveBeenCalledTimes(1);
    const cmd = notify.mock.calls[0]?.[0];
    expect(cmd).toBeDefined();
    if (!cmd) throw new Error('no notify command');
    expect(cmd.userId).toBe('urgent');
    expect(cmd.title).toContain('2');
    expect(cmd.body).toBe('你有 2 项急事');
    expect(cmd.sourceId).toBe('daily-focus:2026-08-01:urgent');
    expect(cmd.url).toBe('/');
  });

  it('单用户失败 fail-soft, 不影响其余', async () => {
    const notify = vi.fn(async (cmd: { userId: string }) => {
      if (cmd.userId === 'boom') throw new Error('nope');
    });
    const generate = vi.fn(async () => focus(1));
    const r = await pushDailyFocusNotifications({
      deps: {
        enabled: true,
        listUsers: async () => [{ id: 'boom' }, { id: 'ok' }],
        generate,
        notify,
      },
    });
    expect(r.scanned).toBe(2);
    expect(r.pushed).toBe(1); // boom 失败, ok 成功
  });
});
