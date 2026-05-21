/**
 * lib/intranet/featured.ts — 公司动态 / 公告 单一数据源
 *
 * 当前为 seed 数据 (M3 接 IntranetPost 表后此模块改为查询).
 * 首页 / `/intranet` / `/api/announcements/featured` 共用此源, 杜绝多处维护.
 */

import type { HeroSlide } from '@/components/hero-carousel';

export const HERO_SLIDES: HeroSlide[] = [
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
    title: '2026 年度公司 O · 让 70% 的决议在 17 分钟内达成共识',
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

export interface NewsItem {
  id: string;
  category: 'announcement' | 'milestone' | 'policy' | 'welfare';
  title: string;
  publishedAt: string;
  author: string;
}

export const LATEST_NEWS: NewsItem[] = [
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

export interface ArchiveArticle {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  emoji: string;
}

export const FEATURED_ARCHIVE: ArchiveArticle = {
  id: 'a1',
  title: 'CEO 周记 #19 · 关于 17 分钟达成共识的真实代价',
  excerpt:
    '2026-05-08 · 这一周我们升级了 11 单决议, 其中 3 单是因为信息没准备齐就开议. 我想聊聊"前置 5 分钟"的纪律 — 它不是流程负担, 是对所有人时间的尊重...',
  author: 'CEO',
  publishedAt: '2026-05-08',
  emoji: '🧭',
};
