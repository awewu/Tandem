/**
 * useHandoffPrefill
 * ------------------------------------------------------------
 * 消费 /tandem DeliverCard 写入的 sessionStorage 草稿载荷.
 *
 * 写入约定 (生产者 = app/tandem/page.tsx DeliverCard):
 *   sessionStorage[`tandem.handoff.${target}`] = JSON.stringify({
 *     title: string,
 *     body:  string,
 *     from:  '/tandem',
 *   })
 *
 * 消费约定 (本 hook):
 *   - mount 时一次性 read + remove (确保不被刷新重复消费)
 *   - 成功消费时调用 onConsume(payload)
 *   - 任何 JSON 解析失败 / sessionStorage 不可用 → 静默忽略
 *
 * Target 取值与目标页面对应:
 *   im      → /im
 *   mail    → /mail
 *   memory  → /memories
 *
 * 设计原则:
 *   - 不依赖任何全局 store, 不产生跨页副作用
 *   - SSR 安全 (内部 typeof window 检查)
 *   - one-shot: 同一次 mount 只消费一次
 */

import { useEffect, useRef } from 'react';

export type HandoffTarget = 'im' | 'mail' | 'memory';

export interface HandoffPayload {
  title: string;
  body: string;
  from?: string;
}

const KEY_PREFIX = 'tandem.handoff.' as const;

/**
 * Read + remove a handoff payload from a sessionStorage-like store.
 * Pure function (no React, no implicit globals) → 单元可测.
 *
 * @returns 解析成功的 payload, 否则 null. 任何异常都被吞掉返回 null.
 */
export function consumeHandoff(
  target: HandoffTarget,
  store: Pick<Storage, 'getItem' | 'removeItem'>,
): HandoffPayload | null {
  const key = `${KEY_PREFIX}${target}`;
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    store.removeItem(key);
  } catch {
    /* ignore quota / private mode errors */
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && typeof obj.title === 'string' && typeof obj.body === 'string') {
      return {
        title: obj.title,
        body: obj.body,
        from: typeof obj.from === 'string' ? obj.from : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function useHandoffPrefill(
  target: HandoffTarget,
  onConsume: (payload: HandoffPayload) => void,
): void {
  const consumedRef = useRef(false);
  useEffect(() => {
    if (consumedRef.current) return;
    if (typeof window === 'undefined') return;
    const parsed = consumeHandoff(target, window.sessionStorage);
    if (!parsed) return;
    consumedRef.current = true;
    onConsume(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
}
