'use client';

/**
 * 外部用户落地 Hub (经销商 / 申请注册人 / 合作伙伴).
 *
 * 两层用户模型的外部层入口 (MANIFESTO / lib/auth/module-scope.ts):
 *   - 内部员工 (企业邮箱) → 全功能首页 '/'
 *   - 纯外部用户 → 本页, 只见后台授权给他的模块 (搭子手抄等), 不露内部管理
 *
 * 中间件 (middleware.ts) 把纯外部角色访问 '/' 的请求重定向到这里.
 * 模块可见性复用 launchpad 的 isAppVisibleTo (按 visibleToRoles / 部门 / 租户授权).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { NotebookPen, LayoutGrid, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import type { LaunchpadAppWithBadge } from '@/lib/types/launchpad';

function trackClick(appId: string) {
  fetch(`/api/launchpad/${appId}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'hub' }),
  }).catch(() => {});
}

const TILE_CLASS =
  'flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-4 shadow-soft-sm hover:border-brand-200 hover:shadow-soft-md surface-interactive';

function HubAppTile({ app }: { app: LaunchpadAppWithBadge }) {
  const internal = app.url.startsWith('/');
  const icon = app.iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={app.iconUrl} alt={app.name} className="h-5 w-5 object-contain" />
  ) : internal ? (
    <LayoutGrid className="h-4 w-4" />
  ) : (
    <ExternalLink className="h-4 w-4" />
  );
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-ink-secondary">
        {icon}
      </span>
      <span className="line-clamp-2 text-caption font-medium text-ink-primary">{app.name}</span>
    </>
  );

  // 内部 Tandem 路由 (如 /shouchao): 同窗导航, 不开新标签页 (移动端 PWA 体验)
  if (internal) {
    return (
      <Link href={app.url} onClick={() => trackClick(app.id)} className={TILE_CLASS} title={app.description || app.name}>
        {inner}
      </Link>
    );
  }
  // 外部系统链接: 新标签页打开
  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackClick(app.id)}
      className={TILE_CLASS}
      title={app.description || app.name}
    >
      {inner}
    </a>
  );
}

function greetingForHour(h: number): string {
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export default function HubPage() {
  const { user } = useCurrentUser();
  const [apps, setApps] = useState<LaunchpadAppWithBadge[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/launchpad', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { apps: [] }))
      .then((d) => {
        if (!cancelled) setApps(d.apps ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = greetingForHour(new Date().getHours());
  const displayName = user?.name || user?.email?.split('@')[0] || '伙伴';

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-10">
        {/* 头部 */}
        <header className="flex items-center gap-3">
          <BrandLogo variant="mark" theme="auto" size={36} alt="Tandem" />
          <div>
            <h1 className="text-title-2 font-bold text-ink-primary leading-tight">
              {greeting}，{displayName}
            </h1>
            <p className="mt-0.5 text-footnote text-ink-tertiary">
              欢迎使用瑞合瑞德 · 牛马搭子合作伙伴空间
            </p>
          </div>
        </header>

        {/* 主推: 搭子手抄 */}
        <section className="mt-6">
          <Link
            href="/shouchao"
            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-soft-sm hover:border-brand-200 hover:shadow-soft-md surface-interactive"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <NotebookPen className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-headline font-semibold text-ink-primary">搭子手抄</h2>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-footnote font-medium text-brand-700">
                  <Sparkles className="h-3 w-3" /> AI 笔记
                </span>
              </div>
              <p className="mt-0.5 truncate text-caption text-ink-tertiary">
                随手记 · 链接剪藏 · AI 总结润色 — 你的个人 AI 笔记本
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-ink-tertiary group-hover:text-brand-500" />
          </Link>
        </section>

        {/* 授权模块 (后台按角色授权) */}
        {apps.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-ink-tertiary" />
              <h2 className="text-caption font-semibold text-ink-secondary">更多应用</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {apps.map((a) => (
                <HubAppTile key={a.id} app={a} />
              ))}
            </div>
          </section>
        )}

        {/* 页脚 */}
        <footer className="mt-12 text-center text-footnote text-ink-tertiary">
          © 瑞合瑞德 · Tandem 牛马搭子 · 你的数据由你掌控
        </footer>
      </div>
    </div>
  );
}
