'use client';

/**
 * <InsightsWidget /> — 可复用的 AI 信号卡片.
 *
 * 设计 (2026-05-10):
 *  - 派生自 zustand stores, 不依赖网络
 *  - SSR-safe: now 在 useEffect 内取
 *  - props 控制过滤/上限, 可在 home / okr / 1on1 等不同上下文复用
 *  - 极简: 只展示, 不交互 (点击跳 /insights)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock3,
  TrendingUp,
  MessagesSquare,
  Heart,
  CheckCircle2,
  Sparkles,
  Target,
  ArrowRight,
} from 'lucide-react';
import {
  useOKRStore,
  useOneOnOneStore,
  useReview360Store,
} from '@/lib/store';
import {
  generateInsights,
  type Insight,
  type InsightSeverity,
  type InsightCategory,
} from '@/lib/insights/derive';

const SEV_STYLES: Record<InsightSeverity, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-700' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700' },
  info: { dot: 'bg-blue-500', text: 'text-blue-700' },
  positive: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
};

const CAT_ICON: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
  'okr-risk': AlertTriangle,
  'okr-stale': Clock3,
  'okr-leading': TrendingUp,
  '1on1-cadence': MessagesSquare,
  '1on1-mood': Heart,
  '1on1-action-overdue': CheckCircle2,
  '360-theme': Sparkles,
  'cross-link': Target,
};

interface Props {
  /** 标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 最多显示几条 (默认 3) */
  limit?: number;
  /** 严重度过滤 (默认 critical + warning) */
  severities?: InsightSeverity[];
  /** 类别过滤 (默认全部) */
  categories?: InsightCategory[];
  /** 关联人员过滤 — 只显示 refs 包含该 personId 的信号 (用于 1on1 上下文) */
  personId?: string;
  /** 是否展示尾部"查看全部"链接 */
  showMore?: boolean;
}

export function InsightsWidget({
  title = 'AI 智能信号',
  subtitle = '跨 OKR · 1on1 · 360 自动归集',
  limit = 3,
  severities = ['critical', 'warning'],
  categories,
  personId,
  showMore = true,
}: Props) {
  const okr = useOKRStore();
  const oneOnOne = useOneOnOneStore();
  const r360 = useReview360Store();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const insights: Insight[] = useMemo(() => {
    if (now == null) return [];
    const all = generateInsights({
      objectives: okr.objectives,
      keyResults: okr.keyResults,
      checkIns: okr.checkIns,
      meetings: oneOnOne.meetings,
      submissions: r360.submissions,
      cycles360: r360.cycles,
      people: okr.people,
      now,
    });
    return all.filter((i) => {
      if (!severities.includes(i.severity)) return false;
      if (categories && !categories.includes(i.category)) return false;
      if (personId) {
        const hit = i.refs.some((r) => {
          if (r.type === 'person') return r.id === personId;
          if (r.type === 'objective') {
            const obj = okr.objectives.find((o) => o.id === r.id);
            return obj?.ownerId === personId;
          }
          if (r.type === 'kr') {
            const kr = okr.keyResults.find((k) => k.id === r.id);
            return kr?.ownerId === personId;
          }
          return false;
        });
        if (!hit) return false;
      }
      return true;
    });
  }, [now, okr.objectives, okr.keyResults, okr.checkIns, okr.people, oneOnOne.meetings, r360.submissions, r360.cycles, severities, categories, personId]);

  const shown = insights.slice(0, limit);
  const remaining = insights.length - shown.length;

  if (now == null) {
    return (
      <div className="card-elevated p-5 text-caption text-ink-tertiary">加载信号…</div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <div className="text-headline text-ink-primary">{title}</div>
        </div>
        <div className="mt-2 text-caption text-ink-tertiary">
          目前没有需要关注的信号. {subtitle}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-headline text-ink-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            {title}
          </div>
          <div className="mt-0.5 text-footnote text-ink-tertiary">{subtitle}</div>
        </div>
        {showMore && (
          <Link
            href="/insights"
            className="text-caption text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
          >
            查看全部 <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {shown.map((i) => {
          const sev = SEV_STYLES[i.severity];
          const Icon = CAT_ICON[i.category];
          return (
            <li key={i.id} className="flex items-start gap-2.5 group">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${sev.dot}`} />
              <Icon className="h-3.5 w-3.5 mt-0.5 text-ink-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={`text-caption font-medium ${sev.text}`}>{i.title}</div>
                <div className="text-footnote text-ink-tertiary line-clamp-1">{i.detail}</div>
              </div>
              {i.actions?.[0]?.href && (
                <Link
                  href={i.actions[0].href}
                  className="text-footnote text-brand-600 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition shrink-0"
                >
                  {i.actions[0].label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {remaining > 0 && (
        <div className="mt-3 text-footnote text-ink-tertiary">
          还有 <strong className="text-ink-secondary">{remaining}</strong> 条信号 ·{' '}
          <Link href="/insights" className="text-brand-600 hover:underline">
            打开 /insights
          </Link>
        </div>
      )}
    </div>
  );
}
