'use client';

/**
 * /nine-box/suggestions · 9-box 联动建议工作台
 *
 * CHARTER-KPI-TTI §5 M4
 *
 * 主管 / HR / steward 视图: 看每个下属的 9-box 落点 + 系统建议管理动作.
 * 建议要么:
 *   1. 跳到 /persona 启动 Persona 升级流程 (star / high_performer / growth_star)
 *   2. 跳到决策卡 / 议事室创建一张干预决策卡 (risk_burnout / must_intervene / misalign / ...)
 *
 * 9-box 真双轨 (M2b 完成后): 纵 KPI 加权完成率 + 横 TTI = KR 平均进度
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw,
  AlertCircle,
  Grid3x3,
  TrendingUp,
  AlertTriangle,
  Star,
  Sparkles,
  Users,
  ExternalLink,
  Zap,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

type Cell =
  | 'star'
  | 'high_performer'
  | 'risk_burnout'
  | 'rising_talent'
  | 'core'
  | 'plateau'
  | 'mismatch'
  | 'low_engagement'
  | 'must_intervene';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface SuggestionAction {
  kind: 'decision_card' | 'persona_upgrade';
  priority: Priority;
  title: string;
  description: string;
  draft?: { decisionClass: 'simple' | 'complex' | 'strategic'; timelineDays: number };
}

interface Suggestion {
  userId: string;
  name?: string;
  cell: Cell;
  kpiScore: number;
  ttiScore: number;
  actions: SuggestionAction[];
}

interface Cycle {
  id: string;
  name: string;
  status: string;
}

interface OrgUser {
  id: string;
  name?: string;
  email?: string;
}

type CardCreateState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'ok'; cardId: string }
  | { status: 'error'; message: string };

const CELL_META: Record<Cell, { label: string; emoji: string; color: string }> = {
  star: { label: '明星', emoji: '⭐', color: 'bg-warning/5 text-warning border-warning/20' },
  high_performer: { label: '高产', emoji: '🚀', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  risk_burnout: { label: '风险枯萎', emoji: '⚠️', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  rising_talent: { label: '升星人才', emoji: '🌱', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  core: { label: '核心力量', emoji: '🧱', color: 'bg-surface-1 text-ink-primary border' },
  plateau: { label: '平台期', emoji: '➖', color: 'bg-surface-1 text-ink-secondary border' },
  mismatch: { label: '人岗错位', emoji: '🔄', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  low_engagement: { label: '投入不足', emoji: '😴', color: 'bg-warning/5 text-warning border-warning/20' },
  must_intervene: { label: '必须干预', emoji: '🚨', color: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const PRIORITY_META: Record<Priority, { label: string; color: string; rank: number }> = {
  urgent: { label: '紧急', color: 'bg-rose-100 text-rose-800 border-rose-300', rank: 0 },
  high: { label: '高', color: 'bg-warning/5 text-warning border-warning/20', rank: 1 },
  medium: { label: '中', color: 'bg-sky-50 text-sky-700 border-sky-200', rank: 2 },
  low: { label: '低', color: 'bg-surface-1 text-ink-secondary border', rank: 3 },
};

export default function NineBoxSuggestionsPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, OrgUser>>({});
  /** key = `${userId}::${actionIndex}` */
  const [cardStates, setCardStates] = useState<Record<string, CardCreateState>>({});

  const loadCycles = useCallback(async () => {
    const r = await fetch('/api/kpi/cycles', { cache: 'no-store' });
    if (!r.ok) throw new Error(`cycles HTTP ${r.status}`);
    const j = await r.json();
    const list: Cycle[] = j.cycles ?? [];
    setCycles(list);
    if (list.length > 0 && !cycleId) {
      const sorted = [...list].sort((a, b) => b.name.localeCompare(a.name));
      const pref = sorted.find((c) => c.status === 'active') ?? sorted[0];
      setCycleId(pref.id);
    }
  }, [cycleId]);

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/org/users', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const map: Record<string, OrgUser> = {};
      for (const u of (j.users ?? []) as OrgUser[]) map[u.id] = u;
      setUserMap(map);
    } catch {
      /* noop */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCycles(), loadUsers()]);
      const r = await fetch(
        cycleId ? `/api/nine-box/suggestions?cycleId=${cycleId}` : '/api/nine-box/suggestions',
        { cache: 'no-store' },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setSuggestions(j.suggestions ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadCycles, loadUsers, cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------------------------------------------------------------------------
  // Decision card creation
  // ---------------------------------------------------------------------------

  const createDecisionCard = async (s: Suggestion, actionIdx: number) => {
    const a = s.actions[actionIdx];
    if (!a || a.kind !== 'decision_card') return;
    const key = `${s.userId}::${actionIdx}`;
    setCardStates((prev) => ({ ...prev, [key]: { status: 'busy' } }));
    const displayName =
      s.name ?? userMap[s.userId]?.name ?? userMap[s.userId]?.email ?? s.userId;
    const cellMeta = CELL_META[s.cell];
    const noKrReason =
      `9-box 联动: ${displayName} 落点 ${cellMeta.emoji} ${cellMeta.label} (KPI ` +
      `${Math.round(s.kpiScore * 100)}% / TTI ${Math.round(s.ttiScore * 100)}%). ` +
      `${a.description}`;
    try {
      const r = await fetch('/api/convergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${a.title} · ${displayName}`,
          description: a.description,
          noKrReason,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const cardId = j.cardId as string;
      setCardStates((prev) => ({ ...prev, [key]: { status: 'ok', cardId } }));
    } catch (e) {
      setCardStates((prev) => ({
        ...prev,
        [key]: { status: 'error', message: (e as Error).message },
      }));
    }
  };

  const stats = useMemo(() => {
    const byCell = new Map<Cell, number>();
    let urgent = 0;
    let high = 0;
    for (const s of suggestions) {
      byCell.set(s.cell, (byCell.get(s.cell) ?? 0) + 1);
      for (const a of s.actions) {
        if (a.priority === 'urgent') urgent++;
        else if (a.priority === 'high') high++;
      }
    }
    return { byCell, urgent, high };
  }, [suggestions]);

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4 md:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Grid3x3 className="h-6 w-6 text-primary" />
            9-box 联动建议
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            按 9-box 落点生成管理动作建议 · 紧急者优先 · 跳决策卡 / Persona 升级流程
            <span className="ml-2 text-footnote">CHARTER §5 M4</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 周期 + 总体统计 */}
      <Card>
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="min-w-[260px]">
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="周期 (可选)" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-caption">
              共 <strong>{suggestions.length}</strong> 人有数据
            </span>
          </div>
          {stats.urgent > 0 && (
            <Badge variant="outline" className={PRIORITY_META.urgent.color}>
              <Zap className="h-3 w-3 mr-1" />
              紧急 {stats.urgent}
            </Badge>
          )}
          {stats.high > 0 && (
            <Badge variant="outline" className={PRIORITY_META.high.color}>
              高优先 {stats.high}
            </Badge>
          )}

          <div className="ml-auto">
            <a
              href={cycleId ? `/nine-box?cycleId=${cycleId}` : '/nine-box'}
              className="text-caption text-primary inline-flex items-center gap-1 hover:underline"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              看 9-box 全景图
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-caption text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-caption text-muted-foreground">
            本周期暂无可分析的人 · 需要至少有 KPI 或 KR 数据
          </CardContent>
        </Card>
      ) : (
        suggestions.map((s) => {
          const cell = CELL_META[s.cell];
          if (s.actions.length === 0) return null; // core_force 等无 action 的不展示
          return (
            <Card key={s.userId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={cell.color}>
                      {cell.emoji} {cell.label}
                    </Badge>
                    <span className="text-caption">
                      {s.name ?? userMap[s.userId]?.name ?? userMap[s.userId]?.email ?? (
                        <span className="font-mono text-muted-foreground">{s.userId}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-footnote text-muted-foreground tabular-nums">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      KPI {Math.round(s.kpiScore * 100)}%
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      TTI {Math.round(s.ttiScore * 100)}%
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.actions.map((a, i) => {
                  const pr = PRIORITY_META[a.priority];
                  const Icon = a.kind === 'persona_upgrade' ? Star : AlertTriangle;
                  const key = `${s.userId}::${i}`;
                  const cardState = cardStates[key] ?? { status: 'idle' as const };
                  return (
                    <div
                      key={i}
                      className="border rounded-md p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 ${
                              a.kind === 'persona_upgrade' ? 'text-warning' : 'text-rose-600'
                            }`}
                          />
                          <span className="font-medium text-caption">{a.title}</span>
                          <Badge variant="outline" className={`${pr.color} text-footnote`}>
                            {pr.label}
                          </Badge>
                        </div>
                        <p className="text-footnote text-muted-foreground">{a.description}</p>
                        {a.draft && (
                          <div className="text-footnote text-muted-foreground flex items-center gap-3">
                            <span>类别: {a.draft.decisionClass}</span>
                            <span>建议时限: {a.draft.timelineDays} 天</span>
                          </div>
                        )}
                        {cardState.status === 'error' && (
                          <div className="text-footnote text-rose-600">
                            创建失败: {cardState.message}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {a.kind === 'persona_upgrade' ? (
                          <a
                            href={`/persona?owner=${encodeURIComponent(s.userId)}`}
                            className="text-caption text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            去 Persona
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : cardState.status === 'ok' ? (
                          <a
                            href={`/convergence/${cardState.cardId}`}
                            className="text-caption text-emerald-700 inline-flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            进议事室
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void createDecisionCard(s, i)}
                            disabled={cardState.status === 'busy'}
                          >
                            {cardState.status === 'busy' ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                创建中
                              </>
                            ) : (
                              '建决策卡'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
