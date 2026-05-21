'use client';

/**
 * /intranet/category/[cat] — 分类视图 (公告 / 政策 / 大事记 / 福利)
 *
 * 从 lib/intranet/featured 的 LATEST_NEWS + HERO_SLIDES 中按分类过滤.
 * V1 seed; M3 接 IntranetPost 表后改为查 DB.
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  Globe2,
} from 'lucide-react';
import { HERO_SLIDES, LATEST_NEWS, type NewsItem } from '@/lib/intranet/featured';

type Category = NewsItem['category'];

const META: Record<
  Category,
  { label: string; icon: typeof Megaphone; tone: string; eyebrow: string; description: string }
> = {
  announcement: {
    label: '公告',
    icon: Megaphone,
    tone: 'bg-brand-50 text-brand-700',
    eyebrow: 'ANNOUNCEMENTS',
    description: '公司级广播 · 来自 CEO / HR / 战略办的统一发声',
  },
  policy: {
    label: '政策',
    icon: FileLock,
    tone: 'bg-warning/10 text-warning',
    eyebrow: 'POLICIES',
    description: '红线与规则 · 涉客户 / 数据 / 财务的强制条款',
  },
  milestone: {
    label: '大事记',
    icon: PartyPopper,
    tone: 'bg-success/10 text-success',
    eyebrow: 'MILESTONES',
    description: '公司里程碑 · 融资 / 上线 / 重大成就',
  },
  welfare: {
    label: '福利',
    icon: Gift,
    tone: 'bg-info/10 text-info',
    eyebrow: 'WELFARE',
    description: '员工关怀 · 体检 / 节日 / 工会活动',
  },
};

interface ListItem {
  id: string;
  title: string;
  publishedAt: string;
  author: string;
  source: 'hero' | 'news';
}

function listForCategory(cat: Category): ListItem[] {
  const fromSlides: ListItem[] = HERO_SLIDES.filter((s) => s.category === cat).map((s) => ({
    id: s.id,
    title: s.title,
    publishedAt: '2026-05-08',
    author: s.eyebrow,
    source: 'hero',
  }));
  const fromNews: ListItem[] = LATEST_NEWS.filter((n) => n.category === cat).map((n) => ({
    id: n.id,
    title: n.title,
    publishedAt: n.publishedAt,
    author: n.author,
    source: 'news',
  }));
  return [...fromSlides, ...fromNews];
}

export default function IntranetCategoryPage() {
  const { cat } = useParams() as { cat: string };
  const isValid = cat in META;
  const meta = isValid ? META[cat as Category] : null;
  const items = isValid ? listForCategory(cat as Category) : [];

  if (!meta) {
    return (
      <div className="page-container py-10 max-w-3xl">
        <BackToIntranet />
        <div className="card-elevated mt-6 p-12 text-center">
          <p className="text-headline text-ink-primary">未知分类</p>
          <p className="mt-2 text-caption text-ink-tertiary">
            支持的分类: announcement / policy / milestone / welfare
          </p>
        </div>
      </div>
    );
  }

  const Icon = meta.icon;

  return (
    <div className="page-container py-10 max-w-4xl space-y-8">
      <BackToIntranet />

      <header className="space-y-2">
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">
          {meta.eyebrow}
        </p>
        <h1 className="text-title-1 text-ink-primary inline-flex items-center gap-3">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${meta.tone}`}>
            <Icon className="h-4 w-4" />
          </span>
          {meta.label}
        </h1>
        <p className="text-body text-ink-secondary">{meta.description}</p>
      </header>

      {items.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <p className="text-body text-ink-secondary">该分类暂无条目</p>
          <p className="mt-1 text-caption text-ink-tertiary italic">
            V1 seed · M3 接真表后会有动态条目
          </p>
        </div>
      ) : (
        <ul className="card-elevated divide-y divide-border overflow-hidden">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/intranet/posts/${it.id}`}
                className="flex items-start gap-3 px-5 py-3.5 surface-interactive hover:bg-surface-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-secondary">
                  <Globe2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary line-clamp-2">{it.title}</p>
                  <p className="mt-0.5 text-footnote text-ink-tertiary">
                    {it.publishedAt} · {it.author}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-tertiary shrink-0 mt-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · 当前从 lib/intranet/featured 过滤. M3 接 IntranetPost 表后启用 RBAC 与强制已读.
      </p>
    </div>
  );
}

function BackToIntranet() {
  return (
    <Link
      href="/intranet"
      className="inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      返回公司动态
    </Link>
  );
}
