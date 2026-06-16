'use client';

/**
 * 我的代表作 — 沉淀真实产出 (认证 / 日报成果 / COMMIT 决议)
 * 数据源: GET /api/me/portfolio (真实聚合, 不造假)
 */

import { useEffect, useState } from 'react';
import { Gift, Award, Sparkles, GitCommitHorizontal, Loader2, AlertTriangle } from 'lucide-react';

interface PortfolioItem {
  id: string;
  kind: 'certification' | 'achievement' | 'decision';
  title: string;
  detail?: string;
  date: string;
}

const KIND_META: Record<PortfolioItem['kind'], { label: string; icon: typeof Award; cls: string }> = {
  certification: { label: '认证', icon: Award, cls: 'bg-brand-50 text-brand-600' },
  achievement: { label: '产出', icon: Sparkles, cls: 'bg-success/10 text-success' },
  decision: { label: '决议', icon: GitCommitHorizontal, cls: 'bg-surface-2 text-ink-secondary' },
};

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/me/portfolio', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const list: PortfolioItem[] = j.items ?? [];
        setItems(list);
        setStatus(list.length === 0 ? 'empty' : 'ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <Gift className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          我的代表作
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
          沉淀真实产出 · 让成长可见
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载代表作…
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> 加载失败，请刷新重试
        </div>
      )}

      {status === 'empty' && (
        <div className="surface-card p-10 text-center space-y-2">
          <Gift className="mx-auto h-10 w-10 text-ink-tertiary" />
          <p className="text-caption text-ink-secondary">暂无代表作</p>
          <p className="text-footnote text-ink-tertiary">
            完成认证、写日报成果、收敛决议后，将自动沉淀到这里。
          </p>
        </div>
      )}

      {status === 'ok' && (
        <div className="space-y-3">
          {items.map((it) => {
            const meta = KIND_META[it.kind];
            const Icon = meta.icon;
            return (
              <div key={it.id} className="surface-card flex items-start gap-4 p-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption font-medium text-ink-primary truncate">{it.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  {it.detail && <p className="mt-0.5 text-footnote text-ink-tertiary line-clamp-2">{it.detail}</p>}
                  <p className="mt-1 text-footnote text-ink-tertiary">
                    {new Date(it.date).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
