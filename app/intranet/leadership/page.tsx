'use client';

/**
 * /intranet/leadership — 高管动态 stub.
 * 占位高管列表 + 最近发声 / 周记 摘要. M3 接真实 Person 表后启用.
 */

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Crown, MessageSquare } from 'lucide-react';

interface Leader {
  id: string;
  name: string;
  title: string;
  initial: string;
  latest: { title: string; date: string };
}

const LEADERS: Leader[] = [
  {
    id: 'ceo',
    name: 'CEO',
    title: '创始人 / 首席执行官',
    initial: 'C',
    latest: { title: 'CEO 周记 #19 · 关于 17 分钟达成共识的真实代价', date: '2026-05-08' },
  },
  {
    id: 'cto',
    name: 'CTO',
    title: '首席技术官',
    initial: 'T',
    latest: { title: '工程平台 Q2 路线图', date: '2026-05-05' },
  },
  {
    id: 'cpo',
    name: 'CPO',
    title: '首席产品官',
    initial: 'P',
    latest: { title: 'Persona AI 进化路径白皮书', date: '2026-04-30' },
  },
  {
    id: 'chro',
    name: 'CHRO',
    title: '首席人才官',
    initial: 'H',
    latest: { title: 'Q2 OKR 全员对齐会议程', date: '2026-04-28' },
  },
];

export default function LeadershipPage() {
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
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">LEADERSHIP</p>
        <h1 className="text-title-1 text-ink-primary inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <Crown className="h-4 w-4" />
          </span>
          高管动态
        </h1>
        <p className="text-body text-ink-secondary">CEO / CTO / CPO / CHRO 最近发声 · 周记 / 战略 / 公开沟通</p>
      </header>

      <ul className="grid sm:grid-cols-2 gap-4">
        {LEADERS.map((l) => (
          <li key={l.id} className="card-elevated p-5 surface-interactive hover:border-brand-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold">
                {l.initial}
              </div>
              <div className="min-w-0">
                <p className="text-callout font-semibold text-ink-primary">{l.name}</p>
                <p className="text-footnote text-ink-tertiary">{l.title}</p>
              </div>
            </div>
            <Link
              href="/intranet/town-hall"
              className="block rounded-md bg-surface-2/60 p-3 hover:bg-surface-2"
            >
              <p className="text-caption text-ink-primary line-clamp-2 font-medium">
                {l.latest.title}
              </p>
              <p className="mt-1 text-footnote text-ink-tertiary inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {l.latest.date}
              </p>
            </Link>
            <Link
              href="/intranet/town-hall"
              className="mt-3 inline-flex items-center gap-1 text-caption text-brand-600 hover:text-brand-700 font-medium"
            >
              查看更多 <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · M3 接 Person + AuthorPost 表后启用真实高管发声流.
      </p>
    </div>
  );
}
