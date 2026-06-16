'use client';

/**
 * /intranet — 企业内网员工门户 (PRODUCT-DEFINITION §3.6)
 *
 * 布局参考: RheemNet (Rheem Manufacturing intranet, 2026-05-10 用户提供截图)
 *   - 左主区: Hero 轮播 + 最新动态流 + 公司年鉴
 *   - 右栏:   A-Z + 社交频道 + CEO 直通车
 *
 * 数据源: /api/intranet/posts (真 IntranetPost CMS, store-backed). 视觉字段
 *         (轮播渐变 / 年鉴 emoji) 由 lib/intranet/post-view 按 type 派生.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Globe2,
  ArrowRight,
  Brain,
  BookOpen,
  Languages,
  Megaphone,
  Loader2,
} from 'lucide-react';
import type { IntranetPost } from '@/lib/types/intranet-post';
import {
  postToHeroSlide,
  fmtPublishDate,
  TYPE_TO_CATEGORY,
  TYPE_EMOJI,
  CATEGORY_LABEL,
  type IntranetCategory,
} from '@/lib/intranet/post-view';
import { HeroCarousel } from '@/components/hero-carousel';

// ─────────────────────────────────────────────────────────────────────────────
// Top-level page
// ─────────────────────────────────────────────────────────────────────────────

export default function IntranetPage() {
  const [posts, setPosts] = useState<IntranetPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/intranet/posts', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((j) => setPosts((j.posts ?? []) as IntranetPost[]))
      .catch((e) => setError(typeof e === 'string' ? e : '加载失败'));
  }, []);

  // 已发布在前 (API 已按 publishedAt desc 排序). Hero 取前 4, 年鉴优先取大事记.
  const heroSlides = useMemo(() => (posts ?? []).slice(0, 4).map(postToHeroSlide), [posts]);
  const newsItems = useMemo(() => (posts ?? []).slice(0, 6), [posts]);
  const archive = useMemo(
    () => (posts ?? []).find((p) => p.type === 'event') ?? (posts ?? [])[0] ?? null,
    [posts],
  );

  return (
    <div className="page-container py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ──────────── 左主区: 公告 + 新闻流 + 公司年鉴 ──────────── */}
        <div className="space-y-6 min-w-0">
          {error ? (
            <div className="card-elevated p-8 text-center text-caption text-danger">{error}</div>
          ) : posts === null ? (
            <div className="card-elevated flex h-[280px] items-center justify-center text-ink-tertiary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载公司动态…
            </div>
          ) : posts.length === 0 ? (
            <div className="card-elevated p-12 text-center text-ink-secondary">
              暂无已发布内容 · 管理员可在
              <Link href="/admin/intranet" className="mx-1 text-brand-600 hover:underline">内容管理</Link>
              发布公告
            </div>
          ) : (
            <>
              {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}
              <LatestNewsRow items={newsItems} />
              {archive && <FeaturedArchive post={archive} />}
            </>
          )}
        </div>

        {/* ──────────── 右栏: A-Z + 社交 + CEO 直通车 ──────────── */}
        <aside className="space-y-5">
          <AtoZLink />
          <SocialChannels />
          <CeoWeeklyPromo />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 最新动态 (3-card row, 含 RheemNet 风的地球图标)
// ─────────────────────────────────────────────────────────────────────────────

const CAT_TONE: Record<IntranetCategory, string> = {
  announcement: 'bg-brand-50 text-brand-700',
  milestone:    'bg-success/10 text-success',
  policy:       'bg-warning/10 text-warning',
  welfare:      'bg-info/10 text-info',
};

function LatestNewsRow({ items }: { items: IntranetPost[] }) {
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-footnote uppercase tracking-wider text-ink-tertiary">
            最新动态
          </p>
          <h3 className="text-headline text-ink-primary">LATEST NEWS</h3>
        </div>
        <Link
          href="/intranet/category/announcement"
          className="text-caption text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
        >
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((p) => {
          const cat = TYPE_TO_CATEGORY[p.type];
          return (
            <Link
              key={p.id}
              href={`/intranet/posts/${p.id}`}
              className="card-elevated p-4 flex items-start gap-3 surface-interactive group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-secondary">
                <Globe2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CAT_TONE[cat]}`}>
                  {CATEGORY_LABEL[cat]}
                  {p.mandatoryRead && ' · 强读'}
                </span>
                <h4 className="mt-1 text-caption text-ink-primary leading-snug line-clamp-2 group-hover:text-brand-700">
                  {p.title}
                </h4>
                <p className="mt-1 text-footnote text-ink-tertiary">
                  {fmtPublishDate(p.publishedAt)} · {p.publishedBy}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 公司年鉴 (1 大卡, 图 + 文)
// ─────────────────────────────────────────────────────────────────────────────

function FeaturedArchive({ post }: { post: IntranetPost }) {
  const cat = TYPE_TO_CATEGORY[post.type];
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-footnote uppercase tracking-wider text-ink-tertiary">
            公司年鉴
          </p>
          <h3 className="text-headline text-ink-primary">NEWS ARCHIVE</h3>
        </div>
        <Link
          href="/intranet/category/milestone"
          className="text-caption text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
        >
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Link
        href={`/intranet/posts/${post.id}`}
        className="card-elevated p-5 flex flex-col sm:flex-row gap-5 surface-interactive group"
      >
        <div className="shrink-0 flex h-32 w-full sm:w-44 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-amber-50 to-emerald-50 text-5xl">
          {TYPE_EMOJI[post.type]}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
            {CATEGORY_LABEL[cat]}
          </span>
          <h4 className="mt-2 text-title-3 text-ink-primary leading-snug group-hover:text-brand-700">
            {post.title}
          </h4>
          {post.summary && (
            <p className="mt-1.5 text-caption text-ink-secondary line-clamp-2">
              {post.summary}
            </p>
          )}
          <p className="mt-2 text-footnote text-ink-tertiary">
            {fmtPublishDate(post.publishedAt)} · {post.publishedBy}
          </p>
        </div>
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A-Z 资源
// ─────────────────────────────────────────────────────────────────────────────

function AtoZLink() {
  return (
    <Link
      href="/intranet/a-z"
      className="block text-center py-2 text-caption font-semibold text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline"
    >
      A 到 Z 全部资源 →
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 社交频道 (Hermes 内部, 不是外部 YouTube/Facebook — 改成 IM 频道入口)
// ─────────────────────────────────────────────────────────────────────────────

function SocialChannels() {
  const channels = useMemo(
    () => [
      { name: 'IM 全员频道', href: '/im', icon: Megaphone },
      { name: '议事室热议',  href: '/convergence', icon: Brain },
      { name: 'Memory 精选', href: '/memories', icon: BookOpen },
      { name: '内部论坛',    href: '/intranet/forum', icon: Languages },
    ],
    []
  );
  return (
    <section className="card-elevated p-4">
      <p className="text-caption font-semibold text-ink-primary mb-2">
        #GetSocial — 关注、互动、分享
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {channels.map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="text-caption text-brand-700 hover:text-brand-800 hover:underline"
          >
            {c.name}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-footnote text-ink-tertiary italic">
        点
        <Link href="/intranet/channels" className="mx-1 text-brand-700 hover:underline">
          这里
        </Link>
        查看全部内部频道
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 底部 CTA: CEO 周记 / Town Hall 回放
// ─────────────────────────────────────────────────────────────────────────────

function CeoWeeklyPromo() {
  return (
    <Link
      href="/intranet/town-hall"
      className="block rounded-2xl overflow-hidden shadow-soft-md group"
    >
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-brand-700 p-5 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_30%,white_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative">
          <span className="text-footnote uppercase tracking-wider opacity-80">
            CEO 直通车
          </span>
          <h4 className="mt-1 text-headline font-bold leading-snug">
            全员问答 & 季度 Town Hall 回放
          </h4>
          <p className="mt-2 text-caption opacity-85 line-clamp-2">
            最近 12 次全员会的录像、Q&A 备份与会议纪要, 加 1 个匿名意见箱直达 CEO.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white text-brand-700 px-3 py-1.5 text-caption font-semibold group-hover:bg-brand-50 transition-colors">
            进入直通车 <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

