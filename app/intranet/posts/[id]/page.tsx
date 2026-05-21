'use client';

/**
 * /intranet/posts/[id] — 公司动态详情 stub.
 *
 * V1: 从 lib/intranet/featured 的 seed 数据 (HERO_SLIDES + LATEST_NEWS) 中按 id 查找
 * 渲染基本元数据 + 占位正文. M3 接 IntranetPost 表后改为读 DB.
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Megaphone, FileLock, PartyPopper, Gift, Calendar, User } from 'lucide-react';
import {
  HERO_SLIDES,
  LATEST_NEWS,
  type NewsItem,
} from '@/lib/intranet/featured';

const CAT_META: Record<
  'announcement' | 'milestone' | 'policy' | 'welfare',
  { label: string; tone: string; icon: typeof Megaphone }
> = {
  announcement: { label: '公告',   tone: 'bg-brand-50 text-brand-700',     icon: Megaphone },
  milestone:    { label: '大事记', tone: 'bg-success/10 text-success',     icon: PartyPopper },
  policy:       { label: '政策',   tone: 'bg-warning/10 text-warning',     icon: FileLock },
  welfare:      { label: '福利',   tone: 'bg-info/10 text-info',           icon: Gift },
};

interface ResolvedPost {
  id: string;
  category: NewsItem['category'];
  title: string;
  publishedAt: string;
  author: string;
  body: string;
}

function resolvePost(id: string): ResolvedPost | null {
  const slide = HERO_SLIDES.find((s) => s.id === id);
  if (slide) {
    return {
      id: slide.id,
      category: slide.category,
      title: slide.title,
      publishedAt: '2026-05-08',
      author: slide.eyebrow,
      body:
        '此条目目前为 V1 seed 数据占位。完整正文将在 M3 阶段接入 IntranetPost 表后落实，' +
        '届时将包含富文本、附件、强制已读回执等。',
    };
  }
  const news = LATEST_NEWS.find((n) => n.id === id);
  if (news) {
    return {
      id: news.id,
      category: news.category,
      title: news.title,
      publishedAt: news.publishedAt,
      author: news.author,
      body:
        '此条目目前为 V1 seed 数据占位。完整正文将在 M3 阶段接入 IntranetPost 表后落实，' +
        '届时将包含富文本、附件、强制已读回执等。',
    };
  }
  return null;
}

export default function IntranetPostPage() {
  const { id } = useParams() as { id: string };
  const post = resolvePost(id);

  if (!post) {
    return (
      <div className="page-container py-10 max-w-3xl">
        <BackToIntranet />
        <div className="card-elevated mt-6 p-12 text-center">
          <p className="text-headline text-ink-primary">条目不存在</p>
          <p className="mt-2 text-caption text-ink-tertiary">
            id <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded">{id}</code> 未匹配任何 seed 数据.
          </p>
        </div>
      </div>
    );
  }

  const meta = CAT_META[post.category];
  const Icon = meta.icon;

  return (
    <div className="page-container py-10 max-w-3xl">
      <BackToIntranet />

      <article className="mt-6 card-elevated p-8 space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
          </div>
          <h1 className="text-title-1 text-ink-primary leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-footnote text-ink-tertiary">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {post.publishedAt}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.author}
            </span>
          </div>
        </header>

        <div className="border-t border-border pt-6">
          <p className="text-body text-ink-primary leading-relaxed whitespace-pre-wrap">
            {post.body}
          </p>
        </div>

        <footer className="border-t border-border pt-4 flex items-center justify-between text-caption text-ink-tertiary">
          <span>条目 ID: <code className="font-mono text-[12px]">{post.id}</code></span>
          <span className="italic">V1 seed · M3 接真表后启用富文本</span>
        </footer>
      </article>
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
