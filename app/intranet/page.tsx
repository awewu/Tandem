'use client';

/**
 * /intranet — 企业内网员工门户 (PRODUCT-DEFINITION §3.6)
 *
 * 布局参考: RheemNet (Rheem Manufacturing intranet, 2026-05-10 用户提供截图)
 *   - 顶部副导航 (4 大内容分类)
 *   - 品牌头 + 全局搜索
 *   - 左主区 ~60%: Hero 轮播 + 公告流 + 公司年鉴
 *   - 右栏 ~40%: 资源中心红色磁贴 + A-Z + 社交 + CEO 周记 promo
 *
 * 当前状态: 高保真原型, 数据是 seed/mock (M3 实现时换真 API).
 *           真后端模型见 PRODUCT-DEFINITION.md §3.6.3.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe2,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Shield,
  Brain,
  Plane,
  Heart,
  Code2,
  Users,
  Building2,
  BookOpen,
  Lightbulb,
  Trophy,
  Languages,
  Lock,
  type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Seed / mock data (M3 实接 IntranetPost / IntranetReadReceipt / ...)
// ─────────────────────────────────────────────────────────────────────────────

interface HeroSlide {
  id: string;
  category: 'milestone' | 'announcement' | 'welfare' | 'policy';
  eyebrow: string;
  title: string;
  bgGradient: string;   // tailwind gradient classes
  href: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'h1',
    category: 'milestone',
    eyebrow: '大事记 · 2026 Q2',
    title: 'Tandem 议事室上线 100 天 — 平均共识时长 19.2 分钟',
    bgGradient: 'from-brand-600 via-brand-500 to-amber-400',
    href: '/intranet/posts/h1',
  },
  {
    id: 'h2',
    category: 'announcement',
    eyebrow: '公告 · CEO',
    title: '2026 年度公司 O: 让 70% 的决议在 17 分钟内达成共识',
    bgGradient: 'from-slate-800 via-slate-700 to-brand-700',
    href: '/intranet/posts/h2',
  },
  {
    id: 'h3',
    category: 'welfare',
    eyebrow: '福利 · 5 月',
    title: '春季体检报名开放 — 8 家定点医院, 配偶可享同等权益',
    bgGradient: 'from-emerald-600 via-teal-500 to-sky-500',
    href: '/intranet/posts/h3',
  },
  {
    id: 'h4',
    category: 'policy',
    eyebrow: '政策 · 强制已读',
    title: 'AI 使用红线 v2.1 — 涉客户数据需经 Steward 批准',
    bgGradient: 'from-rose-700 via-red-600 to-orange-500',
    href: '/intranet/posts/h4',
  },
];

interface NewsItem {
  id: string;
  category: 'announcement' | 'milestone' | 'policy' | 'welfare';
  title: string;
  publishedAt: string;
  author: string;
}

const LATEST_NEWS: NewsItem[] = [
  {
    id: 'n1',
    category: 'announcement',
    title: 'Q2 OKR 全员对齐会 · 5 月 15 日 14:00',
    publishedAt: '2026-05-09',
    author: 'CEO',
  },
  {
    id: 'n2',
    category: 'milestone',
    title: '完成 A 轮融资 — Memory 沉淀 500 条 SOP',
    publishedAt: '2026-05-08',
    author: '市场部',
  },
  {
    id: 'n3',
    category: 'policy',
    title: '差旅政策修订 v1.4 — 国内出差日补 +50',
    publishedAt: '2026-05-07',
    author: 'HR',
  },
];

interface ResourceTile {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

// RheemNet 风格: 3 列方形红色磁贴, 12 块 (4 行)
const RESOURCE_TILES: ResourceTile[] = [
  { id: 't1',  label: '全球员工',     icon: Globe2,      href: '/organization' },
  { id: 't2',  label: '差旅报销',     icon: Plane,       href: '/intranet/category/welfare' },
  { id: 't3',  label: '政策手册',     icon: FileLock,    href: '/intranet/category/policy' },
  { id: 't4',  label: 'IP 知识产权',  icon: Shield,      href: '/intranet/posts/ip' },
  { id: 't5',  label: '公司战略',     icon: Briefcase,   href: '/okr/cascade' },
  { id: 't6',  label: '品牌资产',     icon: Lightbulb,   href: '/intranet/posts/brand' },
  { id: 't7',  label: '健康关怀',     icon: Heart,       href: '/intranet/category/welfare' },
  { id: 't8',  label: '沟通中心',     icon: Megaphone,   href: '/im' },
  { id: 't9',  label: '招聘 & 内推',  icon: Users,       href: '/intranet/posts/careers' },
  { id: 't10', label: '人才发展',     icon: GraduationCap, href: '/persona/evolution' },
  { id: 't11', label: '工程平台',     icon: Code2,       href: '/intranet/posts/eng' },
  { id: 't12', label: '荣誉墙',       icon: Trophy,      href: '/intranet/category/milestone' },
];

interface ArchiveArticle {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  emoji: string;
}

const FEATURED_ARCHIVE: ArchiveArticle = {
  id: 'a1',
  title: 'CEO 周记 #19 · 关于 17 分钟达成共识的真实代价',
  excerpt:
    '2026-05-08 · 这一周我们升级了 11 单决议, 其中 3 单是因为信息没准备齐就开议. 我想聊聊"前置 5 分钟"的纪律 — 它不是流程负担, 是对所有人时间的尊重...',
  author: 'CEO',
  publishedAt: '2026-05-08',
  emoji: '🧭',
};

// ─────────────────────────────────────────────────────────────────────────────
// Top-level page
// ─────────────────────────────────────────────────────────────────────────────

type Category = 'all' | 'announcement' | 'policy' | 'milestone' | 'welfare';

const SUBNAV: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: 'announcement', label: '公告',   icon: Megaphone },
  { id: 'policy',       label: '政策',   icon: FileLock },
  { id: 'milestone',    label: '大事记', icon: PartyPopper },
  { id: 'welfare',      label: '福利',   icon: Gift },
];

export default function IntranetPage() {
  return (
    <div className="h-full overflow-auto bg-surface-2/40">
      <TopSubnav />
      <BrandHeader />
      <div className="page-container py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ──────────── 左主区 ──────────── */}
          <div className="space-y-6 min-w-0">
            <HeroCarousel slides={HERO_SLIDES} />
            <LatestNewsRow items={LATEST_NEWS} />
            <FeaturedArchive article={FEATURED_ARCHIVE} />
          </div>

          {/* ──────────── 右栏 ──────────── */}
          <aside className="space-y-5">
            <ResourceTileGrid tiles={RESOURCE_TILES} />
            <AtoZLink />
            <SocialChannels />
            <CeoWeeklyPromo />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top secondary nav (4 categories + 高管页 + Ethics)
// ─────────────────────────────────────────────────────────────────────────────

function TopSubnav() {
  return (
    <nav className="border-b border-border bg-surface-1">
      <div className="page-container flex h-11 items-center gap-1 overflow-x-auto">
        {SUBNAV.map((item) => (
          <Link
            key={item.id}
            href={`/intranet/category/${item.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Link>
        ))}
        <span className="mx-2 h-4 w-px bg-border" />
        <Link
          href="/intranet/leadership"
          className="px-3 py-1.5 rounded text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
        >
          高管动态
        </Link>
        <Link
          href="/intranet/ethics"
          className="px-3 py-1.5 rounded text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2"
        >
          廉洁举报
        </Link>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand header (logo + search + ...)
// ─────────────────────────────────────────────────────────────────────────────

function BrandHeader() {
  return (
    <header className="border-b border-border bg-surface-1">
      <div className="page-container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white shadow-soft-sm">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-headline tracking-tight text-ink-primary truncate">
              Tandem 内网
            </span>
            <span className="text-footnote text-ink-tertiary truncate">
              公告 · 政策 · 大事记 · 福利
            </span>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-tertiary" />
            <input
              type="search"
              placeholder="搜索公告 / 政策 / CEO 周记..."
              className="w-full pl-9 pr-3 h-9 rounded-md border border-border bg-surface-2/60 text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400"
            />
          </div>
        </div>

        <button
          type="button"
          className="text-ink-tertiary hover:text-ink-primary text-caption"
          aria-label="更多"
        >
          •••
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero carousel (auto-advance 6s, dot indicators, prev/next)
// ─────────────────────────────────────────────────────────────────────────────

function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  const slide = slides[idx];

  return (
    <section
      className="relative rounded-xl overflow-hidden shadow-soft-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link href={slide.href} className="block group">
        <div
          className={`relative h-[280px] sm:h-[320px] bg-gradient-to-br ${slide.bgGradient}`}
        >
          {/* subtle pattern */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:24px_24px]" />
          {/* gradient overlay for legibility */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="relative h-full flex flex-col justify-end p-6 sm:p-8 text-white">
            <span className="text-footnote uppercase tracking-wider opacity-90">
              {slide.eyebrow}
            </span>
            <h2 className="mt-1.5 text-title-2 sm:text-title-1 font-bold leading-tight max-w-2xl group-hover:translate-x-0.5 transition-transform duration-fast">
              {slide.title}
            </h2>
            <span className="mt-3 inline-flex items-center gap-1 text-caption opacity-90">
              查看详情 <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      {/* prev/next */}
      <button
        type="button"
        onClick={() => setIdx((i) => (i - 1 + n) % n)}
        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
        aria-label="上一条"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setIdx((i) => (i + 1) % n)}
        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
        aria-label="下一条"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIdx(i)}
            className={
              i === idx
                ? 'h-1.5 w-6 rounded-full bg-white transition-all'
                : 'h-1.5 w-1.5 rounded-full bg-white/50 hover:bg-white/80 transition-all'
            }
            aria-label={`第 ${i + 1} 条`}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 最新公告 (3-card row, 含 RheemNet 风的地球图标)
// ─────────────────────────────────────────────────────────────────────────────

const CAT_META: Record<NewsItem['category'], { label: string; tone: string }> = {
  announcement: { label: '公告',   tone: 'bg-brand-50 text-brand-700' },
  milestone:    { label: '大事记', tone: 'bg-success/10 text-success' },
  policy:       { label: '政策',   tone: 'bg-warning/10 text-warning' },
  welfare:      { label: '福利',   tone: 'bg-info/10 text-info' },
};

function LatestNewsRow({ items }: { items: NewsItem[] }) {
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-footnote uppercase tracking-wider text-ink-tertiary">
            最新动态
          </p>
          <h3 className="text-headline text-ink-primary">EXTERNAL NEWS</h3>
        </div>
        <Link
          href="/intranet/category/announcement"
          className="text-caption text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
        >
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/intranet/posts/${it.id}`}
            className="card-elevated p-4 flex items-start gap-3 surface-interactive"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-secondary">
              <Globe2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CAT_META[it.category].tone}`}
              >
                {CAT_META[it.category].label}
              </span>
              <h4 className="mt-1 text-caption text-ink-primary leading-snug line-clamp-2 group-hover:text-brand-700">
                {it.title}
              </h4>
              <p className="mt-1 text-footnote text-ink-tertiary">
                {it.publishedAt} · {it.author}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 公司年鉴 (1 大卡, 图 + 文)
// ─────────────────────────────────────────────────────────────────────────────

function FeaturedArchive({ article }: { article: ArchiveArticle }) {
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
          href="/intranet/archive"
          className="text-caption text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Link
        href={`/intranet/posts/${article.id}`}
        className="card-elevated p-5 flex flex-col sm:flex-row gap-5 surface-interactive group"
      >
        <div className="shrink-0 flex h-32 w-full sm:w-44 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-amber-50 to-emerald-50 text-5xl">
          {article.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
            CEO 周记
          </span>
          <h4 className="mt-2 text-title-3 text-ink-primary leading-snug group-hover:text-brand-700">
            {article.title}
          </h4>
          <p className="mt-1.5 text-caption text-ink-secondary line-clamp-2">
            {article.excerpt}
          </p>
          <p className="mt-2 text-footnote text-ink-tertiary">
            {article.publishedAt} · {article.author}
          </p>
        </div>
      </Link>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 右栏: 资源中心红色磁贴 (3×4 grid)
// ─────────────────────────────────────────────────────────────────────────────

function ResourceTileGrid({ tiles }: { tiles: ResourceTile[] }) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">
          资源中心
        </p>
        <h3 className="text-headline text-ink-primary">QUICK ACCESS</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-center p-2 shadow-soft-sm hover:shadow-soft-md transition-all duration-fast hover:-translate-y-0.5"
          >
            <t.icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="text-footnote font-medium leading-tight line-clamp-2">
              {t.label}
            </span>
          </Link>
        ))}
      </div>
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
      className="block rounded-xl overflow-hidden shadow-soft-md group"
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

// Suppress unused-warning for icons reserved for future M3 wiring.
const _reserved = { Lock, Building2 };
void _reserved;
