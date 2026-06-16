'use client';

/**
 * PushSubscribeToggle · 浏览器推送订阅开关
 *
 * 闭环:
 *   1. 注册 SW (/sw.js, PwaRegister 已做) → 取 registration
 *   2. 取 VAPID 公钥 (/api/push/vapid)
 *   3. pushManager.subscribe → POST /api/push/subscribe
 *   4. 取消: getSubscription → unsubscribe → DELETE /api/push/subscribe
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, AlertTriangle } from 'lucide-react';

type State = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushSubscribeToggle() {
  const [state, setState] = useState<State>('checking');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  async function subscribe() {
    setState('busy');
    setErr('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('denied');
        return;
      }
      const vapidRes = await fetch('/api/push/vapid', { credentials: 'include' });
      if (!vapidRes.ok) throw new Error('服务器未配置 Web Push (VAPID 密钥缺失)');
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error('VAPID 公钥为空');

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState('on');
    } catch (e) {
      setErr((e as Error).message);
      setState('off');
    }
  }

  async function unsubscribe() {
    setState('busy');
    setErr('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      setErr((e as Error).message);
      setState('on');
    }
  }

  if (state === 'checking') {
    return (
      <div className="flex items-center gap-2 text-caption text-ink-tertiary">
        <Loader2 className="h-4 w-4 animate-spin" /> 检查推送状态…
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-caption text-ink-tertiary">
        <BellOff className="h-4 w-4 shrink-0" /> 当前浏览器不支持桌面推送
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        通知权限已被拒绝，请在浏览器设置中重新允许后刷新
      </div>
    );
  }

  const on = state === 'on';
  const busy = state === 'busy';

  return (
    <div className="surface-card flex items-center justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${on ? 'bg-brand-50 text-brand-600' : 'bg-surface-2 text-ink-secondary'}`}>
          {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-caption font-medium text-ink-primary">桌面推送通知</p>
          <p className="text-footnote text-ink-tertiary">
            {on ? '已开启 · 即使关闭页面也能收到提醒' : '开启后可在浏览器收到待办、@提及、审批提醒'}
          </p>
          {err && <p className="mt-1 text-footnote text-danger">{err}</p>}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={on ? unsubscribe : subscribe}
        className={`shrink-0 rounded-md px-4 py-1.5 text-caption font-medium transition disabled:opacity-50 ${
          on
            ? 'border border-hairline text-ink-secondary hover:bg-surface-2'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? '关闭' : '开启'}
      </button>
    </div>
  );
}
