/**
 * lib/intranet/post-view.ts — IntranetPost → 门户视图映射 (单一数据源)
 *
 * 后端 IntranetPost (lib/types/intranet-post.ts) 只存内容/治理字段, 不含视觉字段
 * (轮播渐变、年鉴 emoji). 这里按 type 派生视觉, 并把后端 4 类
 * (announcement/policy/event/benefit) 映射成门户展示分类
 * (announcement/milestone/policy/welfare), 供 /intranet 主页 / 详情 / 分类页共用,
 * 杜绝多处维护与硬编码 seed.
 */

import type { HeroSlide } from '@/components/hero-carousel';
import type { IntranetPost, IntranetPostType } from '@/lib/types/intranet-post';

/** 门户展示分类 (历史 RheemNet 命名; 与后端 type 1:1 映射) */
export type IntranetCategory = 'announcement' | 'milestone' | 'policy' | 'welfare';

export const TYPE_TO_CATEGORY: Record<IntranetPostType, IntranetCategory> = {
  announcement: 'announcement',
  policy: 'policy',
  event: 'milestone',
  benefit: 'welfare',
};

export const CATEGORY_TO_TYPE: Record<IntranetCategory, IntranetPostType> = {
  announcement: 'announcement',
  policy: 'policy',
  milestone: 'event',
  welfare: 'benefit',
};

export const CATEGORY_LABEL: Record<IntranetCategory, string> = {
  announcement: '公告',
  milestone: '大事记',
  policy: '政策',
  welfare: '福利',
};

/** 轮播背景渐变 — 按 type 派生, 不污染后端模型 */
export const TYPE_GRADIENT: Record<IntranetPostType, string> = {
  announcement: 'from-slate-800 via-slate-700 to-brand-700',
  policy: 'from-rose-700 via-red-600 to-orange-500',
  event: 'from-brand-600 via-brand-500 to-amber-400',
  benefit: 'from-emerald-600 via-teal-500 to-sky-500',
};

/** 年鉴/列表占位封面 emoji — 按 type 派生 */
export const TYPE_EMOJI: Record<IntranetPostType, string> = {
  announcement: '📢',
  policy: '🛡️',
  event: '🎉',
  benefit: '🎁',
};

/** ISO → YYYY-MM-DD; null(草稿) → '草稿' */
export function fmtPublishDate(iso: string | null | undefined): string {
  if (!iso) return '草稿';
  return iso.slice(0, 10);
}

/** IntranetPost → HeroCarousel slide */
export function postToHeroSlide(p: IntranetPost): HeroSlide {
  const category = TYPE_TO_CATEGORY[p.type];
  return {
    id: p.id,
    category,
    eyebrow: `${CATEGORY_LABEL[category]}${p.mandatoryRead ? ' · 强制已读' : ''}`,
    title: p.title,
    bgGradient: TYPE_GRADIENT[p.type],
    href: `/intranet/posts/${p.id}`,
  };
}
