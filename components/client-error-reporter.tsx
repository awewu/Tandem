/**
 * §观测埋点 · 前端错误捕获 (window.onerror + unhandledrejection)
 *
 * 设计:
 *   - 浏览器异常 / Promise reject → POST /api/analytics/track (eventName='client_error')
 *   - 去重: 同 fingerprint (msg+url+lineno) 24h 只报 1 次/sessionStorage
 *   - 限流: 每会话 ≤ 10 次, 超出静默丢 (防爆量打爆 backend)
 *   - 不影响业务: try/catch 包裹, fetch 失败静默
 *   - keepalive: true · 让浏览器在 navigation 时也能送达
 *
 * 不做的:
 *   - 不引 Sentry / Datadog SDK (重量, V1 不需要)
 *   - 不报 React render error (那个走 ErrorBoundary)
 */
'use client';

import { useEffect } from 'react';
import { fingerprint, shouldReport, reasonToMsg } from '@/lib/analytics/client-error';

function reportClientError(payload: Record<string, unknown>) {
  try {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'client_error', props: payload }),
      keepalive: true,
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

export function ClientErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null;

    function onError(ev: ErrorEvent) {
      try {
        const msg = String(ev.message ?? 'unknown');
        const src = String(ev.filename ?? '');
        const line = Number(ev.lineno ?? 0);
        const col = Number(ev.colno ?? 0);
        const fp = fingerprint(msg, src, line, col);
        if (!shouldReport(ss, fp)) return;
        reportClientError({
          kind: 'window_error',
          msg,
          src,
          line,
          col,
          stack: ev.error instanceof Error ? String(ev.error.stack ?? '').slice(0, 2000) : null,
          path: location.pathname,
          ua: navigator.userAgent.slice(0, 200),
        });
      } catch { /* swallow */ }
    }

    function onRejection(ev: PromiseRejectionEvent) {
      try {
        const reason = ev.reason;
        const msg = reasonToMsg(reason);
        const fp = fingerprint(msg, 'promise', 0, 0);
        if (!shouldReport(ss, fp)) return;
        reportClientError({
          kind: 'unhandled_rejection',
          msg: msg.slice(0, 500),
          stack: reason instanceof Error ? String(reason.stack ?? '').slice(0, 2000) : null,
          path: location.pathname,
          ua: navigator.userAgent.slice(0, 200),
        });
      } catch { /* swallow */ }
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
