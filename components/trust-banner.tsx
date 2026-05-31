/**
 * <TrustBanner> · 信任叙事条 (CHARTER §3.2 / MANIFESTO 第四条)
 *
 * 在所有"软评估 / 不审批 / 信任型录入"的页面顶部展示, 让员工知道:
 *   - 主管能看到, 但不会驳回
 *   - 数据不与奖金挂钩
 *   - 仅作成长方向参考
 *
 * 复用场景:
 *   - /tti          四要素填报
 *   - /1on1         主管对话纪要
 *   - /360          360 评估自我反思
 *   - /persona      人格画像演化
 *   - /retrospective 7 天后复盘
 *
 * 视觉一致 → 用户在多个页面看到同一条 → 信任语言成为产品基调.
 */

'use client';

import { Heart, Shield, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrustTone = 'trust' | 'audit' | 'soft';

const TONE_META: Record<
  TrustTone,
  { bg: string; border: string; fg: string; icon: LucideIcon; iconColor: string; defaultTitle: string }
> = {
  trust: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    fg: 'text-emerald-900',
    icon: Heart,
    iconColor: 'text-emerald-600',
    defaultTitle: '记录, 不审批',
  },
  audit: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    fg: 'text-sky-900',
    icon: Shield,
    iconColor: 'text-sky-600',
    defaultTitle: '审计可见, 不影响奖金',
  },
  soft: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    fg: 'text-violet-900',
    icon: Heart,
    iconColor: 'text-violet-600',
    defaultTitle: '软评估 · 信任优先',
  },
};

export interface TrustBannerProps {
  /** 'trust' (默认): TTI/check-in/1on1 用; 'audit': 审计相关; 'soft': persona/360 */
  tone?: TrustTone;
  /** 标题, 不传走默认 */
  title?: string;
  /** 副文案 (主体说明) */
  children?: React.ReactNode;
  /** 章程引用 (右上角小字, 如 "CHARTER §3.3") */
  charter?: string;
  className?: string;
}

export function TrustBanner({
  tone = 'trust',
  title,
  children,
  charter,
  className,
}: TrustBannerProps) {
  const meta = TONE_META[tone];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'border rounded-md px-3 py-2.5 flex items-start gap-3 text-caption',
        meta.bg,
        meta.border,
        className,
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', meta.iconColor)} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className={cn('font-medium flex items-center gap-2', meta.fg)}>
          <span>{title ?? meta.defaultTitle}</span>
          {charter && (
            <span className={cn('text-[10px] font-normal opacity-70', meta.fg)}>{charter}</span>
          )}
        </div>
        {children && <div className={cn('text-footnote opacity-90', meta.fg)}>{children}</div>}
      </div>
    </div>
  );
}
