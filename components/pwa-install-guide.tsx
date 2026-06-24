'use client';

/**
 * PwaInstallGuide · 「不上架,装到主屏当 App 用」的入口引导 + 装后推送闭环
 *
 * 三态 (互斥, 自动判断):
 *   1. android-install : 浏览器未安装 + 捕获到 beforeinstallprompt → 一键调起原生安装
 *   2. ios-install     : iOS Safari 未安装 → 图文引导「分享 → 添加到主屏」(iOS 无法程序化安装)
 *   3. enable-push     : 已 standalone 运行 + 通知权限为 default → 引导开启推送 (iOS 必须装后才能推)
 *
 * 设计:
 *   - 顶部细条 (避开底部 tab bar 与「问老板」FAB), 可关闭, 关闭后 COOLDOWN 天内不再打扰
 *   - 全部走特性检测, SSR 安全, 不支持的环境直接不渲染
 */

import { useEffect, useState, useCallback } from 'react';
import { Download, Share, Plus, Bell, X, Loader2 } from 'lucide-react';

type Kind = 'android-install' | 'ios-install' | 'enable-push' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const COOLDOWN_DAYS = 7;
const DISMISS_KEY = 'tandem.pwa-guide.dismissed'; // value: `${kind}:${epochMs}`

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari 私有标记
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ 伪装成 Mac, 用触点数兜底
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function recentlyDismissed(kind: Exclude<Kind, null>): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const [k, ts] = raw.split(':');
    if (k !== kind) return false;
    return Date.now() - Number(ts) < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PwaInstallGuide() {
  const [kind, setKind] = useState<Kind>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 捕获 Android 的 beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setKind(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 判定当前该展示哪一态 (延迟一点, 避免打开即弹)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      const standalone = isStandalone();
      let next: Kind = null;
      if (standalone) {
        if (pushSupported() && Notification.permission === 'default') next = 'enable-push';
      } else if (deferred) {
        next = 'android-install';
      } else if (isIOS()) {
        next = 'ios-install';
      }
      if (next && !recentlyDismissed(next)) setKind(next);
      else setKind(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [deferred]);

  const dismiss = useCallback(() => {
    if (kind) {
      try {
        localStorage.setItem(DISMISS_KEY, `${kind}:${Date.now()}`);
      } catch {
        /* ignore */
      }
    }
    setKind(null);
  }, [kind]);

  const handleAndroidInstall = useCallback(async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* 用户取消即可 */
    } finally {
      setBusy(false);
      setDeferred(null);
      setKind(null);
    }
  }, [deferred]);

  const handleEnablePush = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        dismiss();
        return;
      }
      const vapidRes = await fetch('/api/push/vapid', { credentials: 'include' });
      if (!vapidRes.ok) throw new Error('服务器未配置推送');
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error('推送公钥为空');
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
      setKind(null);
    } catch (e) {
      setErr((e as Error).message || '开启失败');
    } finally {
      setBusy(false);
    }
  }, [dismiss]);

  if (!kind) return null;

  return (
    <div
      role="dialog"
      aria-label="安装与通知引导"
      className={[
        'fixed inset-x-0 top-0 z-[55]',
        'px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)]',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface-1/95 px-4 py-3 shadow-soft-lg backdrop-blur">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {kind === 'enable-push' ? <Bell className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          {kind === 'android-install' && (
            <>
              <p className="text-caption font-semibold text-ink-primary">装到主屏,像 App 一样用</p>
              <p className="text-footnote text-ink-tertiary">全屏运行、独立图标、可收推送</p>
            </>
          )}
          {kind === 'ios-install' && (
            <p className="text-footnote leading-relaxed text-ink-secondary">
              装到主屏:点底部
              <Share className="mx-1 inline h-3.5 w-3.5 -translate-y-0.5" aria-label="分享" />
              分享,再选
              <span className="mx-1 inline-flex items-center gap-0.5 rounded bg-surface-2 px-1 py-0.5 text-[11px] font-medium text-ink-primary">
                <Plus className="h-3 w-3" />添加到主屏幕
              </span>
            </p>
          )}
          {kind === 'enable-push' && (
            <>
              <p className="text-caption font-semibold text-ink-primary">开启通知</p>
              <p className="text-footnote text-ink-tertiary">待办、@提及、审批即时提醒</p>
              {err && <p className="mt-0.5 text-footnote text-danger">{err}</p>}
            </>
          )}
        </div>

        {kind === 'android-install' && (
          <button
            type="button"
            disabled={busy}
            onClick={handleAndroidInstall}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-caption font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '安装'}
          </button>
        )}
        {kind === 'enable-push' && (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnablePush}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-caption font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '开启'}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
