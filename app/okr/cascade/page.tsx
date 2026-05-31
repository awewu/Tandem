'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Target,
  Sparkles,
  ListChecks,
  Building2,
  Users,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Layers,
  BarChart3,
} from 'lucide-react';
import PageTabs from '@/components/page-tabs';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';

/**
 * /okr/cascade — OKR 5 层级联视图 (Q5 重型 OKR)
 *
 * 视图: O → KR → Initiative → DC → AP
 * 只读. 编辑在 /okr.
 *
 * Layer color coding:
 *   Objective    🏢 蓝
 *   KR          🎯 绿/黄/红 (健康度)
 *   Initiative  ⚡ 紫
 *   DecisionCard 💡 橙 (品牌)
 *   ActionItem  ✓ 中性
 */

interface KeyResult {
  id: string;
  title: string;
  ownerId: string;
  measureType: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit?: string;
  riskStatus: 'on_track' | 'at_risk' | 'off_track';
}

interface Objective {
  id: string;
  title: string;
  level: 'company' | 'team' | 'individual';
  ownerId: string;
  keyResults: KeyResult[];
}

interface Initiative {
  id: string;
  title: string;
  keyResultId: string;
  status: 'planned' | 'in_progress' | 'done' | 'blocked';
  decisionCardIds?: string[];
}

interface DecisionCard {
  id: string;
  title: string;
  convergenceState: string;
  primaryKrId?: string;
  noKrReason?: string;
  relatedKr?: string[];
  createdAt: string;
}

export default function OkrCascadePage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedObj, setExpandedObj] = useState<Set<string>>(new Set());
  const [expandedKr, setExpandedKr] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] =
    useState<'all' | 'company' | 'team' | 'individual'>('all');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [okrRes, cardsRes] = await Promise.all([
        fetch('/api/tandem-okr'),
        fetch('/api/convergence'),
      ]);
      const okrJson = await okrRes.json();
      const cardsJson = await cardsRes.json();
      const objs = (okrJson.objectives ?? []) as Objective[];
      setObjectives(objs);
      setCards((cardsJson.cards ?? []) as DecisionCard[]);

      // Initiatives are not in /api/tandem-okr today; collect from KRs if exposed.
      // V1: Initiatives table exists in Prisma but no GET endpoint yet — fallback empty.
      // (Will surface in M2 with /api/initiatives endpoint.)
      setInitiatives([]);

      // Auto-expand first objective if any
      if (objs.length > 0) setExpandedObj(new Set([objs[0].id]));
    } finally {
      setLoading(false);
    }
  }

  function toggleObj(id: string) {
    setExpandedObj((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleKr(id: string) {
    setExpandedKr((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const totalKrs = objectives.reduce((acc, o) => acc + o.keyResults.length, 0);
  const krsOnTrack = objectives.reduce(
    (acc, o) => acc + o.keyResults.filter((kr) => kr.riskStatus === 'on_track').length,
    0
  );

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="page-container py-10 space-y-8">
        {/* Header */}
        <header className="animate-fade-in-up">
          <p className="text-caption text-ink-tertiary inline-flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            OKR · 5 层级联视图
          </p>
          <h1 className="mt-1 text-title-2 text-ink-primary">事半 · OKR 树</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Objective → KR → Initiative → DecisionCard → ActionItem · AI 滞后预警 (M3)
          </p>
        </header>

        {/* Top metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Objectives" value={objectives.length} icon={Building2} tone="brand" />
          <MetricCard
            label="KR 健康"
            value={totalKrs > 0 ? `${krsOnTrack}/${totalKrs}` : '—'}
            icon={Target}
            tone="success"
            hint={
              totalKrs > 0
                ? `${Math.round((krsOnTrack / totalKrs) * 100)}% 在轨`
                : '暂无 KR'
            }
          />
          <MetricCard
            label="议事室决议"
            value={cards.length}
            icon={Sparkles}
            tone="info"
            hint={`${cards.filter((c) => c.primaryKrId).length} 已绑 KR`}
          />
        </div>

        {/* Level filter tabs */}
        <PageTabs
          tabs={[
            {
              id: 'all',
              label: '全部',
              icon: Layers,
              badge: objectives.length,
            },
            {
              id: 'company',
              label: '公司级',
              icon: Building2,
              badge: objectives.filter((o) => o.level === 'company').length,
            },
            {
              id: 'team',
              label: '部门级',
              icon: Users,
              badge: objectives.filter((o) => o.level === 'team').length,
            },
            {
              id: 'individual',
              label: '我的',
              icon: User,
              badge: objectives.filter((o) => o.level === 'individual').length,
            },
          ]}
          active={levelFilter}
          onChange={(id) => setLevelFilter(id as 'all' | 'company' | 'team' | 'individual')}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/okr/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive"
                title="按部门聚合的进度/风险 · 管理层视角"
              >
                <BarChart3 className="h-3.5 w-3.5" /> 部门效能
              </Link>
              <Link
                href="/okr"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive"
              >
                编辑 OKR <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          }
        />

        {/* Cascade tree */}
        {loading ? (
          <div className="card-elevated flex items-center justify-center gap-2 p-12 text-caption text-ink-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载 OKR 树...
          </div>
        ) : objectives.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <p className="text-body text-ink-secondary">还没有 OKR</p>
            <Link
              href="/okr"
              className="mt-3 inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
            >
              去创建第一个 Objective <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (() => {
          const filtered =
            levelFilter === 'all'
              ? objectives
              : objectives.filter((o) => o.level === levelFilter);
          if (filtered.length === 0) {
            return (
              <div className="card-elevated p-12 text-center">
                <p className="text-body text-ink-secondary">
                  当前筛选下没有 Objective
                </p>
                <button
                  type="button"
                  onClick={() => setLevelFilter('all')}
                  className="mt-3 text-caption text-brand-600 hover:text-brand-700 font-medium"
                >
                  查看全部 →
                </button>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {filtered.map((obj) => (
                <ObjectiveNode
                  key={obj.id}
                  obj={obj}
                  expanded={expandedObj.has(obj.id)}
                  onToggle={() => toggleObj(obj.id)}
                  expandedKr={expandedKr}
                  onToggleKr={toggleKr}
                  initiatives={initiatives}
                  cards={cards}
                />
              ))}
            </div>
          );
        })()}

        {/* Legend */}
        <div className="card-elevated p-4 mt-8">
          <p className="text-caption font-semibold text-ink-primary mb-2">5 层结构</p>
          <div className="flex flex-wrap gap-4 text-footnote text-ink-secondary">
            <Legend icon={Building2} label="Objective (O)" tone="text-info" />
            <Legend icon={Target} label="Key Result (KR)" tone="text-success" />
            <Legend icon={Sparkles} label="Initiative (跨季度)" tone="text-purple-600" />
            <Legend icon={Sparkles} label="DecisionCard (议事)" tone="text-brand-600" />
            <Legend icon={ListChecks} label="ActionItem (任务)" tone="text-ink-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────── Sub-components ────────────

function ObjectiveNode({
  obj,
  expanded,
  onToggle,
  expandedKr,
  onToggleKr,
  initiatives,
  cards,
}: {
  obj: Objective;
  expanded: boolean;
  onToggle: () => void;
  expandedKr: Set<string>;
  onToggleKr: (id: string) => void;
  initiatives: Initiative[];
  cards: DecisionCard[];
}) {
  const LevelIcon = obj.level === 'company' ? Building2 : obj.level === 'team' ? Users : User;

  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 surface-interactive text-left hover:bg-surface-2 transition-colors duration-fast"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-ink-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-tertiary" />
        )}
        <span className="rounded-md bg-info/10 text-info p-2">
          <LevelIcon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-headline text-ink-primary truncate">{obj.title}</p>
          <p className="mt-0.5 text-footnote text-ink-tertiary">
            {obj.level === 'company' ? '公司级' : obj.level === 'team' ? '部门级' : '个人级'} ·
            {' '}{obj.keyResults.length} KR
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2/40 px-4 py-3 space-y-2 animate-fade-in-up">
          {obj.keyResults.length === 0 ? (
            <p className="ml-7 text-caption text-ink-tertiary py-2">暂无 KR</p>
          ) : (
            obj.keyResults.map((kr) => (
              <KrNode
                key={kr.id}
                kr={kr}
                expanded={expandedKr.has(kr.id)}
                onToggle={() => onToggleKr(kr.id)}
                initiatives={initiatives.filter((i) => i.keyResultId === kr.id)}
                cards={cards.filter((c) => c.primaryKrId === kr.id || c.relatedKr?.includes(kr.id))}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KrNode({
  kr,
  expanded,
  onToggle,
  initiatives,
  cards,
}: {
  kr: KeyResult;
  expanded: boolean;
  onToggle: () => void;
  initiatives: Initiative[];
  cards: DecisionCard[];
}) {
  const progress =
    kr.targetValue !== kr.startValue
      ? Math.max(0, Math.min(100, ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100))
      : 0;
  const progressBarRef = useDynamicStyle<HTMLDivElement>({ width: `${progress}%` });

  const riskTone =
    kr.riskStatus === 'on_track'
      ? 'text-success bg-success/10'
      : kr.riskStatus === 'at_risk'
      ? 'text-warning bg-warning/10'
      : 'text-danger bg-danger/10';

  const RiskIcon =
    kr.riskStatus === 'on_track' ? CheckCircle2 : kr.riskStatus === 'at_risk' ? AlertTriangle : XCircle;

  return (
    <div className="ml-4 rounded-md border border-border bg-surface-1 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 surface-interactive hover:bg-surface-2 transition-colors duration-fast"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-ink-tertiary" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-ink-tertiary" />
        )}
        <span className={`rounded p-1.5 ${riskTone}`}>
          <RiskIcon className="h-3 w-3" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body text-ink-primary truncate">{kr.title}</p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex-1 max-w-xs h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                ref={progressBarRef}
                className={`h-full transition-all duration-base ease-decelerate ${
                  kr.riskStatus === 'on_track'
                    ? 'bg-success'
                    : kr.riskStatus === 'at_risk'
                    ? 'bg-warning'
                    : 'bg-danger'
                }`}
              />
            </div>
            <span className="text-footnote text-ink-tertiary tabular-nums">
              {kr.currentValue}{kr.unit ?? ''} / {kr.targetValue}{kr.unit ?? ''} ({Math.round(progress)}%)
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2/30 px-4 py-2 space-y-1.5 animate-fade-in-up">
          {/* Initiatives */}
          {initiatives.length > 0 && (
            <div className="space-y-1">
              <p className="ml-6 text-footnote font-semibold text-ink-tertiary uppercase tracking-wider mt-1">
                Initiative ({initiatives.length})
              </p>
              {initiatives.map((init) => (
                <div key={init.id} className="ml-6 flex items-center gap-2 px-2 py-1 text-caption text-ink-secondary">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  <span className="flex-1 truncate">{init.title}</span>
                  <InitiativeBadge status={init.status} />
                </div>
              ))}
            </div>
          )}

          {/* Decision Cards */}
          {cards.length > 0 && (
            <div className="space-y-1">
              <p className="ml-6 text-footnote font-semibold text-ink-tertiary uppercase tracking-wider mt-2">
                议事 / DC ({cards.length})
              </p>
              {cards.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  href={`/convergence/${c.id}`}
                  className="ml-6 flex items-center gap-2 px-2 py-1 text-caption text-ink-secondary hover:bg-surface-3 hover:text-ink-primary rounded transition-colors duration-fast"
                >
                  <Sparkles className="h-3 w-3 text-brand-500" />
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="text-footnote text-ink-tertiary">{c.convergenceState}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
              {cards.length > 5 && (
                <p className="ml-6 px-2 py-0.5 text-footnote text-ink-tertiary">
                  ... 还有 {cards.length - 5} 条
                </p>
              )}
            </div>
          )}

          {initiatives.length === 0 && cards.length === 0 && (
            <p className="ml-6 text-footnote text-ink-tertiary py-1">
              暂无 Initiative / 议事 · 在 /convergence 发起新议事时绑定本 KR
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InitiativeBadge({ status }: { status: Initiative['status'] }) {
  const map = {
    planned:     { label: '计划', tone: 'bg-surface-3 text-ink-secondary' },
    in_progress: { label: '进行中', tone: 'bg-info/10 text-info' },
    done:        { label: '已成', tone: 'bg-success/10 text-success' },
    blocked:     { label: '阻塞', tone: 'bg-danger/10 text-danger' },
  };
  const m = map[status] ?? { label: status, tone: 'bg-surface-3 text-ink-secondary' };
  return <span className={`rounded px-1.5 py-0.5 text-footnote ${m.tone}`}>{m.label}</span>;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'info';
  hint?: string;
}) {
  const toneMap = {
    brand:   'bg-brand-50 text-brand-600',
    success: 'bg-success/10 text-success',
    info:    'bg-info/10 text-info',
  };
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between">
        <span className="text-caption text-ink-secondary">{label}</span>
        <span className={`rounded-md p-1.5 ${toneMap[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 text-title-1 font-bold text-ink-primary tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-footnote text-ink-tertiary">{hint}</p>}
    </div>
  );
}

function Legend({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span>{label}</span>
    </span>
  );
}
