'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

type Status = 'loading' | 'ok' | 'error';

export function HermesHealth({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<string>('');

  const check = useCallback(async () => {
    setStatus((s) => (s === 'ok' ? 'ok' : 'loading'));
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const d = await res.json();
      if (d.ok) {
        setStatus('ok');
        setInfo(d.version || 'hermes');
      } else {
        setStatus('error');
        setInfo(d.error || 'unavailable');
      }
    } catch (e: any) {
      setStatus('error');
      setInfo(e?.message || 'network error');
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [check]);

  const dot =
    status === 'ok' ? 'bg-green-500' :
    status === 'error' ? 'bg-red-500' :
    'bg-yellow-500 animate-pulse';

  if (compact) {
    return (
      <button
        type="button"
        onClick={check}
        title={`Hermes: ${status === 'ok' ? info : info || status}`}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted text-xs"
      >
        <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
        <span className="truncate max-w-[140px]">
          {status === 'loading' ? '检查中…' : status === 'ok' ? (info || 'Hermes') : 'Hermes 离线'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dot)} />
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          {status === 'loading' ? 'Hermes 健康检查中…' : status === 'ok' ? 'Hermes 在线' : 'Hermes 不可用'}
        </div>
        <div className="text-xs text-muted-foreground truncate" title={info}>
          {status === 'ok' ? info : info || '尚未响应'}
        </div>
      </div>
      <button
        type="button"
        onClick={check}
        className="p-1.5 rounded-md hover:bg-muted"
        title="重新检查"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', status === 'loading' && 'animate-spin')} />
      </button>
    </div>
  );
}
