'use client';

import { useEffect, useState } from 'react';

interface HealthResp {
  success?: boolean;
  platform?: string;
  framework?: string;
  httpAdapter?: string;
  architecture?: string;
}

type Status = 'loading' | 'up' | 'down';

// Probes the backend via the server-side /api/session/health route handler
// (which calls NestJS /api/v2/health). Auth-gated KPIs (tenants/brand) are
// fetched server-side in the page using the httpOnly session cookie.
export default function LiveHealth() {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<HealthResp | null>(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    fetch('/api/session/health', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: HealthResp) => {
        if (!alive) return;
        setData(j);
        setStatus(j?.success ? 'up' : 'down');
      })
      .catch(() => alive && setStatus('down'))
      .finally(() => clearTimeout(t));
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, []);

  const badge =
    status === 'loading'
      ? { cls: '', text: '探测中…' }
      : status === 'up'
        ? { cls: 'ok', text: '在线' }
        : { cls: 'warn', text: '未连接' };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <p className="t">❤️ 后端服务健康（实时 /api/health）</p>
      <p style={{ margin: '4px 0 8px' }}>
        <span className={`badge ${badge.cls}`.trim()}>{badge.text}</span>
      </p>
      {status === 'up' && data ? (
        <p className="d">
          {data.platform} · {data.framework}
          {data.httpAdapter ? ` / ${data.httpAdapter}` : ''}
          {data.architecture ? ` · ${data.architecture}` : ''}
        </p>
      ) : (
        <p className="d">
          目标 API：<code>{'{API_URL}'}</code>/api/health（默认 http://localhost:3300）。启动 NestJS 后此卡自动转「在线」。
        </p>
      )}
    </div>
  );
}
