'use client';

/**
 * /intranet/town-hall — CEO 直通车 / 全员问答 stub.
 *
 * V1: 静态占位, 显示最近 12 次 Town Hall 回放占位 + 匿名意见箱入口.
 * M3: 接入会议录像 / Q&A 持久化.
 */

import Link from 'next/link';
import {
  ArrowLeft,
  Mic2,
  Inbox,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface TownHallSession {
  id: string;
  date: string;
  title: string;
  duration: string;
  attendees: number;
}

const SESSIONS: TownHallSession[] = [
  { id: 'th-2026-q2', date: '2026-04-28', title: 'Q2 启动 · 17 分钟达成共识 100 天复盘', duration: '58 min', attendees: 142 },
  { id: 'th-2026-q1', date: '2026-01-19', title: 'Q1 启动 · 全年战略地图', duration: '64 min', attendees: 138 },
  { id: 'th-2025-q4', date: '2025-10-22', title: 'Q4 复盘 · 5 个让我们慢下来的决议', duration: '52 min', attendees: 130 },
  { id: 'th-2025-q3', date: '2025-07-15', title: 'Q3 启动 · 议事室上线公告', duration: '45 min', attendees: 121 },
];

export default function TownHallPage() {
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
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--rheem-charcoal))] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
          <Mic2 className="h-3 w-3" />
          CEO 直通车
        </div>
        <h1 className="text-title-1 text-ink-primary">全员问答 &amp; 季度 Town Hall</h1>
        <p className="text-body text-ink-secondary">
          最近 12 次全员会的录像、Q&amp;A 备份与会议纪要 · 1 个匿名意见箱直达 CEO
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/intranet/forum?room=ceo-feedback"
          className="card-elevated p-5 group surface-interactive bg-gradient-to-br from-slate-800 via-slate-700 to-brand-700 text-white"
        >
          <Inbox className="h-6 w-6 mb-3" />
          <h3 className="text-headline font-bold">匿名意见箱</h3>
          <p className="mt-1.5 text-caption opacity-90">
            直达 CEO · 不可追溯发件人 · 平均 48h 回复
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-caption font-medium">
            投递 <ExternalLink className="h-3 w-3" />
          </span>
        </Link>

        <div className="card-elevated p-5 bg-surface-2/40">
          <Calendar className="h-6 w-6 text-brand-600 mb-3" />
          <h3 className="text-headline font-bold text-ink-primary">下次 Town Hall</h3>
          <p className="mt-1.5 text-caption text-ink-secondary">
            预计 2026-07-15 · Q3 启动 + 半年复盘
          </p>
          <p className="mt-2 text-footnote text-ink-tertiary italic">
            议程开放征集中 (V1 seed 占位)
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-headline text-ink-primary">历次回放</h2>
        <ul className="card-elevated divide-y divide-border overflow-hidden">
          {SESSIONS.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-4 px-5 py-3.5 surface-interactive hover:bg-surface-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Mic2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body text-ink-primary truncate">{s.title}</p>
                <p className="mt-0.5 text-footnote text-ink-tertiary">
                  {s.date} · {s.duration} · {s.attendees} 人参会
                </p>
              </div>
              <span className="text-caption text-ink-tertiary italic shrink-0">
                录像占位
              </span>
            </li>
          ))}
        </ul>
        <p className="text-footnote text-ink-tertiary italic px-1">
          V1 seed · M3 接 LiveKit 录像存储后启用真实回放.
        </p>
      </section>
    </div>
  );
}
