'use client';

/**
 * /intranet/forum — 内部论坛 stub.
 *
 * V1: 静态频道列表 + "匿名意见箱" deep-link.
 * M3: 接 IM 频道或独立 Forum 表实现真实发帖 / 回帖.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MessagesSquare,
  Megaphone,
  Brain,
  BookOpen,
  Languages,
  Inbox,
} from 'lucide-react';

interface ForumChannel {
  id: string;
  name: string;
  desc: string;
  icon: typeof MessagesSquare;
  href: string;
  posts?: number;
}

const CHANNELS: ForumChannel[] = [
  { id: 'ceo-feedback', name: '匿名意见箱', desc: '直达 CEO · 不可追溯发件人', icon: Inbox, href: '/intranet/forum?room=ceo-feedback' },
  { id: 'all-hands',    name: '全员频道',   desc: '公司级公告 + 大事件讨论',   icon: Megaphone, href: '/im', posts: 142 },
  { id: 'convergence',  name: '议事室热议', desc: '近 7 天高活议事室复盘',     icon: Brain,     href: '/convergence', posts: 28 },
  { id: 'memory',       name: 'Memory 精选', desc: '本周入选 SOP / 案例 / 红线', icon: BookOpen, href: '/memories', posts: 17 },
  { id: 'lounge',       name: '茶水间',     desc: '非工作向轻松话题',           icon: Languages, href: '/im', posts: 89 },
];

export default function ForumPage() {
  return (
    <Suspense fallback={null}>
      <ForumInner />
    </Suspense>
  );
}

function ForumInner() {
  const searchParams = useSearchParams();
  const focusedRoom = searchParams.get('room');

  return (
    <div className="page-container py-10 max-w-4xl space-y-8">
      <Link
        href="/intranet"
        className="inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回公司动态
      </Link>

      <header className="space-y-2">
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">FORUM</p>
        <h1 className="text-title-1 text-ink-primary">内部论坛</h1>
        <p className="text-body text-ink-secondary">
          频道交流 + 匿名意见 + 议事室热议导流
        </p>
      </header>

      {focusedRoom === 'ceo-feedback' && <AnonymousInbox />}

      <section className="space-y-3">
        <h2 className="text-headline text-ink-primary">频道</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            const isAnon = c.id === 'ceo-feedback';
            return (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className={
                    isAnon
                      ? 'block card-elevated p-4 surface-interactive bg-gradient-to-br from-slate-800 via-slate-700 to-brand-700 text-white'
                      : 'block card-elevated p-4 surface-interactive hover:border-brand-200'
                  }
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${isAnon ? '' : 'text-brand-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-callout font-semibold ${isAnon ? 'text-white' : 'text-ink-primary'}`}>
                        {c.name}
                      </p>
                      <p className={`mt-1 text-caption ${isAnon ? 'text-white/85' : 'text-ink-secondary'} line-clamp-2`}>
                        {c.desc}
                      </p>
                      {typeof c.posts === 'number' && (
                        <p className={`mt-2 text-footnote ${isAnon ? 'text-white/70' : 'text-ink-tertiary'}`}>
                          {c.posts} 条本周
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · M3 接独立 ForumPost 表后启用真实发帖 / 回帖 / 投票.
      </p>
    </div>
  );
}

function AnonymousInbox() {
  return (
    <section className="card-elevated p-5 border-l-4 border-l-[rgb(var(--brand-500))]">
      <h3 className="text-headline text-ink-primary inline-flex items-center gap-2">
        <Inbox className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        匿名意见箱
      </h3>
      <p className="mt-2 text-caption text-ink-secondary">
        投递的内容**不会留下发件人信息**, CEO 平均 48h 内回复. V1 阶段为占位 UI;
        M3 接入加密通道后启用真实投递.
      </p>
      <textarea
        rows={4}
        disabled
        placeholder="投递功能 V1 占位中 ... M3 接通后可使用"
        className="mt-3 w-full rounded-md border border-border bg-surface-2/50 p-3 text-caption text-ink-primary placeholder:text-ink-tertiary disabled:cursor-not-allowed"
      />
      <p className="mt-2 text-footnote text-ink-tertiary italic">
        V1 占位 · 不会发送任何内容
      </p>
    </section>
  );
}
