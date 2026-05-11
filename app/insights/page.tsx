'use client';

/**
 * /insights — AI 智能层 · 跨模块信号聚合.
 *
 * 设计 (2026-05-10 v1):
 *  - 加新 sub-route, 不动 /okr /1on1 /360 主页
 *  - 信号源: OKR + 1on1 + 360 + 跨模块联动
 *  - SSR-safe: now 在 useEffect 内取, 避免 hydration mismatch
 *  - 无 LLM 调用 (v1 启发式), v2 可接 generateInsights → LLM 增强
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  TrendingUp,
  Clock3,
  Heart,
  CheckCircle2,
  MessagesSquare,
  Target,
  Sparkles,
  Filter,
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

const SEV_COLORS: Record<InsightSeverity, { bg: string; text: string; ring: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', label: '严重' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: '注意' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', label: '信息' },
  positive: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: '正向' },
};

const CAT_ICONS: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
  'okr-risk': AlertTriangle,
  'okr-stale': Clock3,
  'okr-leading': TrendingUp,
  '1on1-cadence': MessagesSquare,
  '1on1-mood': Heart,
  '1on1-action-overdue': CheckCircle2,
  '360-theme': Sparkles,
  'cross-link': Target,
};

const CAT_LABEL: Record<InsightCategory, string> = {
  'okr-risk': 'OKR 风险',
  'okr-stale': 'OKR 失联',
  'okr-leading': '领先案例',
  '1on1-cadence': '1on1 节奏',
  '1on1-mood': '干劲走低',
  '1on1-action-overdue': 'Action 逾期',
  '360-theme': '360 主题',
  'cross-link': '跨模块联动',
};

export default function InsightsPage() {
  const okr = useOKRStore();
  const oneOnOne = useOneOnOneStore();
  const r360 = useReview360Store();

  const [now, setNow] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<InsightSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<InsightCategory | 'all'>('all');

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const insights: Insight[] = useMemo(() => {
    if (now == null) return [];
    return generateInsights({
      objectives: okr.objectives,
      keyResults: okr.keyResults,
      checkIns: okr.checkIns,
      meetings: oneOnOne.meetings,
      submissions: r360.submissions,
      cycles360: r360.cycles,
      people: okr.people,
      now,
    });
  }, [now, okr.objectives, okr.keyResults, okr.checkIns, okr.people, oneOnOne.meetings, r360.submissions, r360.cycles]);

  const counts = useMemo(() => {
    const out: Record<InsightSeverity, number> = { critical: 0, warning: 0, info: 0, positive: 0 };
    for (const i of insights) out[i.severity]++;
    return out;
  }, [insights]);

  const filtered = insights.filter(
    (i) =>
      (severityFilter === 'all' || i.severity === severityFilter) &&
      (categoryFilter === 'all' || i.category === categoryFilter)
  );

  const allCategories = Array.from(new Set(insights.map((i) => i.category))) as InsightCategory[];

  return (
    <div className="page-container section-y space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-500" />
            AI 智能层 · 信号聚合
          </h1>
          <p className="mt-1 text-body text-ink-secondary">
            跨 OKR · 1on1 · 360 信号自动归集, 帮主管在 30 秒内定位需要介入的人/目标.
          </p>
        </div>
        <div className="text-caption text-ink-tertiary">
          {now == null ? '初始化中…' : `共 ${insights.length} 条信号 · ${new Date(now).toLocaleString('zh-CN')}`}
        </div>
      </header>

      {/* 严重度概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'warning', 'info', 'positive'] as InsightSeverity[]).map((s) => {
          const c = SEV_COLORS[s];
          const active = severityFilter === s;
          return (
            <button
              key={s}
              onClick={() => setSeverityFilter(active ? 'all' : s)}
              className={`text-left p-4 rounded-lg ring-1 transition ${c.bg} ${c.ring} ${
                active ? 'ring-2' : 'hover:ring-2'
              }`}
            >
              <div className={`text-caption font-semibold ${c.text}`}>{c.label}</div>
              <div className={`mt-1 text-title-1 font-bold ${c.text}`}>{counts[s]}</div>
            </button>
          );
        })}
      </div>

      {/* 过滤器 */}
      <div className="flex items-center gap-2 flex-wrap text-caption">
        <Filter className="h-3.5 w-3.5 text-ink-tertiary" />
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2.5 py-1 rounded-full ring-1 ring-surface-3 ${
            categoryFilter === 'all'
              ? 'bg-brand-50 text-brand-700 ring-brand-200'
              : 'text-ink-secondary hover:bg-surface-3'
          }`}
        >
          全部 · {insights.length}
        </button>
        {allCategories.map((cat) => {
          const Icon = CAT_ICONS[cat];
          const n = insights.filter((i) => i.category === cat).length;
          const active = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(active ? 'all' : cat)}
              className={`px-2.5 py-1 rounded-full ring-1 ring-surface-3 inline-flex items-center gap-1 ${
                active
                  ? 'bg-brand-50 text-brand-700 ring-brand-200'
                  : 'text-ink-secondary hover:bg-surface-3'
              }`}
            >
              <Icon className="h-3 w-3" />
              {CAT_LABEL[cat]} · {n}
            </button>
          );
        })}
      </div>

      {/* 信号列表 */}
      {now == null ? (
        <div className="card-elevated p-10 text-center text-ink-tertiary">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <div className="mt-3 text-headline text-ink-primary">没有需要关注的信号</div>
          <div className="mt-1 text-caption text-ink-tertiary">
            {insights.length === 0
              ? '尚无 OKR / 1on1 / 360 数据, 或都健康. 添加 check-in 后回来看看.'
              : '当前过滤条件下无信号, 试试切换上方过滤器.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const sev = SEV_COLORS[insight.severity];
  const Icon = CAT_ICONS[insight.category];
  return (
    <div className={`card-elevated p-4 ring-1 ${sev.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${sev.bg}`}>
          <Icon className={`h-4 w-4 ${sev.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-footnote font-semibold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
              {sev.label}
            </span>
            <span className="text-footnote text-ink-tertiary">{CAT_LABEL[insight.category]}</span>
          </div>
          <div className="mt-1 text-headline text-ink-primary">{insight.title}</div>
          <div className="mt-1 text-caption text-ink-secondary">{insight.detail}</div>
          {insight.actions && insight.actions.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {insight.actions.map((a, idx) =>
                a.href ? (
                  <Link
                    key={idx}
                    href={a.href}
                    className="text-caption px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
                  >
                    {a.label}
                  </Link>
                ) : (
                  <span
                    key={idx}
                    className="text-caption px-2.5 py-1 rounded-md bg-surface-3 text-ink-secondary"
                  >
                    {a.label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
