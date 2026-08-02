'use client';

/**
 * <DailyFocusCard /> — 首页个人日级聚焦晨报 (对标 WorkBoard Daily Focus)
 *
 * 消费 GET /api/me/daily-focus: 排序后的今日聚焦 + 一句话摘要 + 建议下一步。
 * 与 <RiskCockpit /> 分工: 本卡片是"我今天该做什么"的个人行动简报;
 * RiskCockpit 是可见范围内的风险雷达。无聚焦项时自动隐藏 (保持首页干净)。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sunrise, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

type Severity = 'high' | 'medium' | 'low';

interface FocusItem {
  id: string;
  kind: string;
  severity: Severity;
  actNow: boolean;
  title: string;
  detail: string;
  href?: string;
}

interface DailyFocus {
  itemCount: number;
  actNowCount: number;
  highCount: number;
  headline: string;
  suggestedNextStep: string | null;
  items: FocusItem[];
}

const SEVERITY_DOT: Record<Severity, string> = {
  high: 'text-danger',
  medium: 'text-warning',
  low: 'text-ink-tertiary',
};

export function DailyFocusCard() {
  const [focus, setFocus] = useState<DailyFocus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/me/daily-focus', { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok && data.ok) setFocus(data.focus as DailyFocus);
      } catch {
        if (!cancelled) setFocus(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 无聚焦项 → 隐藏 (避免与 RiskCockpit 的"无风险"绿条重复)
  if (!focus || focus.itemCount === 0) return null;

  const actNow = focus.items.filter((i) => i.actNow);
  const later = focus.items.filter((i) => !i.actNow);

  return (
    <div className="card-elevated p-4 ring-1 ring-brand-500/15">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-md bg-brand-50 flex items-center justify-center">
          <Sunrise className="h-4 w-4 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-headline text-ink-primary">今日聚焦</div>
          <p className="mt-0.5 text-caption text-ink-secondary">{focus.headline}</p>

          {focus.suggestedNextStep && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-brand-50/60 px-3 py-2">
              <ArrowRight className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
              <span className="text-caption text-ink-primary">
                <strong className="text-brand-700">下一步 </strong>
                {focus.suggestedNextStep}
              </span>
            </div>
          )}

          {actNow.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {actNow.slice(0, 4).map((i) => (
                <FocusRow key={i.id} item={i} urgent />
              ))}
            </ul>
          )}

          {later.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {later.slice(0, 3).map((i) => (
                <FocusRow key={i.id} item={i} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FocusRow({ item, urgent = false }: { item: FocusItem; urgent?: boolean }) {
  const Icon = urgent ? AlertTriangle : CheckCircle2;
  return (
    <li className="flex min-w-0 items-center gap-2 text-caption">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${SEVERITY_DOT[item.severity]}`} />
      {item.href ? (
        <Link href={item.href} className="text-ink-primary hover:text-brand-600 truncate">
          {item.title}
        </Link>
      ) : (
        <span className="text-ink-primary truncate">{item.title}</span>
      )}
      <span className="ml-auto text-footnote text-ink-tertiary shrink-0 truncate max-w-[45%]">
        {item.detail}
      </span>
    </li>
  );
}
