'use client';

/**
 * /intranet/channels — 全部内部频道索引 stub.
 * 列出 IM 频道 / 议事室 / Memory 精选 / 论坛 等内部社交入口.
 */

import Link from 'next/link';
import {
  ArrowLeft,
  Megaphone,
  Brain,
  BookOpen,
  Languages,
  MessagesSquare,
  Mic2,
} from 'lucide-react';

interface ChannelEntry {
  id: string;
  name: string;
  desc: string;
  icon: typeof MessagesSquare;
  href: string;
  group: '即时沟通' | '议事 / 决议' | '知识与论坛';
}

const CHANNELS: ChannelEntry[] = [
  { id: 'all', name: '全员频道', desc: '公司级广播 + 大事件即时讨论', icon: Megaphone, href: '/im', group: '即时沟通' },
  { id: 'lounge', name: '茶水间', desc: '非工作向轻松话题', icon: Languages, href: '/im', group: '即时沟通' },
  { id: 'town-hall', name: 'CEO 直通车', desc: '全员问答 + Town Hall 录像', icon: Mic2, href: '/intranet/town-hall', group: '即时沟通' },

  { id: 'convergence', name: '议事室热议', desc: '近 7 天高活议事 + 决议复盘', icon: Brain, href: '/convergence', group: '议事 / 决议' },

  { id: 'memories', name: 'Memory 精选', desc: '本周入选 SOP / 案例 / 红线', icon: BookOpen, href: '/memories', group: '知识与论坛' },
  { id: 'forum', name: '内部论坛', desc: '主题贴 + 投票 + 长文讨论', icon: MessagesSquare, href: '/intranet/forum', group: '知识与论坛' },
];

export default function ChannelsPage() {
  const grouped = CHANNELS.reduce<Record<string, ChannelEntry[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

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
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">CHANNELS</p>
        <h1 className="text-title-1 text-ink-primary">全部内部频道</h1>
        <p className="text-body text-ink-secondary">
          IM / 议事 / 知识 / 论坛 — 所有内部沟通入口的索引
        </p>
      </header>

      {Object.entries(grouped).map(([group, list]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-headline text-ink-primary">{group}</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {list.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.id}>
                  <Link
                    href={c.href}
                    className="block card-elevated p-4 surface-interactive hover:border-brand-200"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-callout font-semibold text-ink-primary">
                          {c.name}
                        </p>
                        <p className="mt-1 text-caption text-ink-secondary line-clamp-2">
                          {c.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · 频道索引为静态. M3 接通频道目录服务后改为实时.
      </p>
    </div>
  );
}
