'use client';

/**
 * /report/monthly — 月度回顾
 *
 * 在周报基础上增加:
 *   1. KPI 板块数据回顾 (BSC 四维度完成率 + 环比)
 *   2. OKR 进展推进汇报 (月度进度增量 + 信心变化)
 *   3. 问题分析 (卡点归因 + 信心下滑 KR + KPI 未达)
 *   4. 未来规划 (下月重点行动 + KPI 达标路径)
 *
 * 完全基于真实 check-in + KPI 数据；AI 提炼结构化 JSON 月报。
 * source 字段 (llm / fallback) 始终诚实展示。
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CalendarRange,
  RefreshCw,
  CheckSquare,
  AlertTriangle,
  Zap,
  TrendingUp,
  AlertCircle,
  CornerDownRight,
  ListChecks,
  Target,
  Coins,
  Activity,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  ClipboardList,
  User,
  Clock,
  Flag,
} from 'lucide-react';

interface EnrichedCheckIn {
  id: string;
  createdAt: string;
  krId: string;
  krTitle: string;
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: string;
  confidenceAfter: string;
  achievements: string | null;
  blockers: string | null;
  nextSteps: string | null;
  mood: string | null;
}

interface OkrProgressItem {
  krId: string;
  krTitle: string;
  checkIns: number;
  progressDelta: number;
  finalProgress: number;
  targetValue: number;
  finalConfidence: string;
  confidenceChanged: boolean;
}

interface MonthlyStats {
  totalCheckIns: number;
  krsTouched: number;
  progressIncrement: number;
  blockersCount: number;
  byKr: OkrProgressItem[];
}

interface KpiReviewItem {
  kpiId: string;
  title: string;
  bscPerspective: string;
  scope: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  completion: number;
  color: string;
  unit?: string;
  monthDelta: number;
  snapshotsCount: number;
}

interface KpiReviewSummary {
  totalKpis: number;
  bonusKpis: number;
  monitorKpis: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  byPerspective: Array<{
    perspective: string;
    label: string;
    count: number;
    avgCompletion: number;
  }>;
  items: KpiReviewItem[];
}

interface ActionItem {
  action: string;
  owner: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  relatedKpi?: string;
  relatedKr?: string;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface KpiTrendItem {
  kpiId: string;
  title: string;
  bscPerspective: string;
  points: TrendPoint[];
  target: number;
  unit?: string;
}

interface KrTrendItem {
  krId: string;
  krTitle: string;
  points: TrendPoint[];
  target: number;
}

interface MonthlyRecapResponse {
  summary: string;
  kpiHighlights: string[];
  okrProgress: string[];
  problemAnalysis: string[];
  futurePlan: string[];
  actionItems: ActionItem[];
  stats: MonthlyStats;
  kpiReview: KpiReviewSummary;
  kpiTrends: KpiTrendItem[];
  krTrends: KrTrendItem[];
  checkIns: EnrichedCheckIn[];
  source: 'llm' | 'fallback';
  model?: string;
  reason?: string;
  rangeFrom: string;
  rangeTo: string;
}

const DAY_OPTIONS = [30, 60, 90] as const;

const BSC_ICONS: Record<string, React.ReactNode> = {
  financial: <Coins className="h-3.5 w-3.5 text-success" />,
  customer: <Target className="h-3.5 w-3.5 text-info" />,
  process: <Activity className="h-3.5 w-3.5 text-warning" />,
  growth: <BookOpen className="h-3.5 w-3.5 text-primary" />,
};

export default function MonthlyRecapPage() {
  const { toast } = useToast();
  const me = useCurrentUserId();
  const { user } = useCurrentUser();
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<MonthlyRecapResponse | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (me && !selectedAssignee) {
      setSelectedAssignee(me);
    }
  }, [me, selectedAssignee]);

  const load = useCallback(async (n: number, assigneeId: string) => {
    if (!assigneeId) return;
    setLoading(true);
    setData(null);
    setStreamingText('');
    try {
      const res = await fetch('/api/ai/monthly-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ days: n, ownerId: assigneeId }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let partial: Partial<MonthlyRecapResponse> | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as
                | { type: 'stats'; stats: MonthlyStats; kpiReview: KpiReviewSummary; kpiTrends: KpiTrendItem[]; krTrends: KrTrendItem[]; checkIns: EnrichedCheckIn[]; rangeFrom: string; rangeTo: string }
                | { type: 'delta'; content: string }
                | { type: 'done'; result: MonthlyRecapResponse };
              if (ev.type === 'stats') {
                partial = {
                  stats: ev.stats,
                  kpiReview: ev.kpiReview,
                  kpiTrends: ev.kpiTrends ?? [],
                  krTrends: ev.krTrends ?? [],
                  checkIns: ev.checkIns,
                  rangeFrom: ev.rangeFrom,
                  rangeTo: ev.rangeTo,
                  summary: '',
                  kpiHighlights: [],
                  okrProgress: [],
                  problemAnalysis: [],
                  futurePlan: [],
                  actionItems: [],
                  source: 'llm',
                };
                setData(partial as MonthlyRecapResponse);
              } else if (ev.type === 'delta') {
                setStreamingText((prev) => prev + ev.content);
              } else if (ev.type === 'done') {
                setData(ev.result);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '月报分析失败', description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(days, selectedAssignee);
  }, [days, selectedAssignee, load]);

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline font-semibold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            月度回顾
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            汇总过去 {days} 天的 OKR check-in + KPI 完成情况；AI 提炼 KPI 回顾 / OKR 进展 / 问题分析 / 未来规划。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedAssignee && (
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="w-48 h-8 text-footnote bg-surface-1">
                <SelectValue placeholder="选择审阅人选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo-user">👨 我自己 (demo-user)</SelectItem>
                <SelectItem value="demo-star">⭐ 明星 (demo-star)</SelectItem>
                <SelectItem value="demo-burnout">⚠️ 风险枯萎 (demo-burnout)</SelectItem>
                <SelectItem value="demo-mismatch">🔄 人岗错位 (demo-mismatch)</SelectItem>
                <SelectItem value="demo-intervene">🚨 必须干预 (demo-intervene)</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 h-8 text-footnote">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-2.5 h-7 rounded transition-colors',
                  d === days ? 'bg-surface-1 shadow-soft-sm font-semibold' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {d} 天
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load(days, selectedAssignee)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : data ? (
        <>
          {/* 0. 封面摘要区 */}
          <Card className="border-border bg-surface-2/30">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-footnote text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" />
                    月度管理报告
                  </div>
                  <h2 className="text-headline font-bold tracking-tight">
                    {data.rangeFrom.slice(0, 10)} ~ {data.rangeTo.slice(0, 10)}
                  </h2>
                  <div className="flex items-center gap-3 text-caption text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {selectedAssignee}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      生成于 {new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {data.source === 'llm' ? (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                        AI 生成 · {data.model ?? 'unknown'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-warning/5 text-warning border-warning/20">
                        降级模式
                      </Badge>
                    )}
                  </div>
                </div>
                {data.summary && (
                  <div className="flex-1 min-w-[280px] max-w-md">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">执行摘要</div>
                    <p className="text-caption text-ink-primary leading-relaxed border-l-2 border-primary/30 pl-3">
                      {data.summary}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 1. OKR 硬统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="check-in 次数" value={String(data.stats.totalCheckIns)} sub={`${data.rangeFrom.slice(5, 10)} → ${data.rangeTo.slice(5, 10)}`} />
            <StatCard label="覆盖 KR 数" value={String(data.stats.krsTouched)} />
            <StatCard
              label="累计进度增量"
              value={`${data.stats.progressIncrement >= 0 ? '+' : ''}${data.stats.progressIncrement}`}
              color={data.stats.progressIncrement >= 0 ? 'text-success' : 'text-danger'}
            />
            <StatCard
              label="卡点条数"
              value={String(data.stats.blockersCount)}
              color={data.stats.blockersCount > 0 ? 'text-warning' : 'text-success'}
            />
          </div>

          {/* 2. KPI 板块数据回顾 */}
          {data.kpiReview.totalKpis > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote font-semibold text-ink-primary bg-surface-2/50">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  KPI 板块数据回顾
                  <Badge variant="outline" className="ml-auto text-[10px] bg-surface-1">
                    {data.kpiReview.bonusKpis} 奖金 + {data.kpiReview.monitorKpis} 监控
                  </Badge>
                </div>

                {/* KPI 达标概览 */}
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <KpiSummaryCard label="达标" count={data.kpiReview.greenCount} total={data.kpiReview.totalKpis} color="text-success" bg="bg-success/10" border="border-success/30" />
                    <KpiSummaryCard label="关注" count={data.kpiReview.yellowCount} total={data.kpiReview.totalKpis} color="text-warning" bg="bg-warning/10" border="border-warning/30" />
                    <KpiSummaryCard label="未达" count={data.kpiReview.redCount} total={data.kpiReview.totalKpis} color="text-danger" bg="bg-danger/10" border="border-danger/30" />
                  </div>

                  {/* BSC 维度汇总 */}
                  {data.kpiReview.byPerspective.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {data.kpiReview.byPerspective.map((p) => (
                        <div key={p.perspective} className="rounded-md border border-border bg-surface-2/40 p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-footnote font-semibold text-ink-secondary">
                            {BSC_ICONS[p.perspective]}
                            {p.label}
                          </div>
                          <div className="text-caption text-muted-foreground">{p.count} 个 KPI</div>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.round(p.avgCompletion * 100)} className="h-1.5 flex-1" />
                            <span className="text-footnote font-bold tabular-nums">{Math.round(p.avgCompletion * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KPI 明细表 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-caption">
                      <thead>
                        <tr className="border-b text-footnote text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">KPI</th>
                          <th className="text-left px-3 py-2 font-medium">维度</th>
                          <th className="text-right px-3 py-2 font-medium">当前 / 目标</th>
                          <th className="text-right px-3 py-2 font-medium">完成率</th>
                          <th className="text-right px-3 py-2 font-medium">月增量</th>
                          <th className="text-left px-3 py-2 font-medium">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.kpiReview.items.map((k) => (
                          <tr key={k.kpiId} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{k.title}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {BSC_ICONS[k.bscPerspective] ? (
                                <span className="inline-flex items-center gap-1">
                                  {BSC_ICONS[k.bscPerspective]}
                                  {k.bscPerspective === 'financial' ? '财务' : k.bscPerspective === 'customer' ? '客户' : k.bscPerspective === 'process' ? '流程' : '成长'}
                                </span>
                              ) : k.bscPerspective}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {k.currentValue} / {k.targetValue} {k.unit ?? ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {Math.round(k.completion * 100)}%
                            </td>
                            <td className={cn(
                              'px-3 py-2 text-right tabular-nums font-medium',
                              k.monthDelta > 0 ? 'text-success' : k.monthDelta < 0 ? 'text-danger' : 'text-muted-foreground',
                            )}>
                              {k.monthDelta > 0 ? '+' : ''}{k.monthDelta}
                            </td>
                            <td className="px-3 py-2">
                              <ColorPill color={k.color} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. AI 月报汇总 */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-caption font-semibold text-ink-primary">AI 月报汇总</span>
                {data.summary === '' && loading ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-info">
                    <span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                    流式生成中
                  </span>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-auto text-[10px] border',
                      data.source === 'llm'
                        ? 'bg-success/10 text-success border-success/30'
                        : 'bg-warning/5 text-warning border-warning/20',
                    )}
                    title={data.reason}
                  >
                    {data.source === 'llm' ? `LLM · ${data.model ?? 'unknown'}` : '降级模式（未调用 LLM）'}
                  </Badge>
                )}
              </div>

              {data.summary === '' && loading ? (
                <div className="space-y-3 rounded border border-border bg-surface-2 p-4">
                  <div className="flex items-center gap-2 text-[10px] text-info">
                    <span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                    正在生成月报摘要
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-caption text-ink-primary leading-relaxed">{data.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-footnote">
                    <Section icon={<TrendingUp className="h-3.5 w-3.5 text-success" />} title="KPI 回顾 · 达标亮点">
                      {data.kpiHighlights}
                    </Section>
                    <Section icon={<CheckSquare className="h-3.5 w-3.5 text-info" />} title="OKR 进展 · 推进汇报">
                      {data.okrProgress}
                    </Section>
                    <Section icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />} title="问题分析 · 根因剖析">
                      {data.problemAnalysis}
                    </Section>
                    <Section icon={<Zap className="h-3.5 w-3.5 text-primary" />} title="未来规划 · 下月重点">
                      {data.futurePlan}
                    </Section>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 3b. 行动项清单 */}
          {data.actionItems && data.actionItems.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote font-semibold text-ink-primary bg-surface-2/50">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" />
                  行动项清单
                  <Badge variant="outline" className="ml-auto text-[10px] bg-surface-1">
                    {data.actionItems.length} 项
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-caption">
                    <thead>
                      <tr className="border-b text-footnote text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">行动</th>
                        <th className="text-left px-3 py-2 font-medium">负责人</th>
                        <th className="text-left px-3 py-2 font-medium">截止日</th>
                        <th className="text-left px-3 py-2 font-medium">优先级</th>
                        <th className="text-left px-3 py-2 font-medium">关联</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.actionItems.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{item.action}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.owner}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.deadline}</td>
                          <td className="px-3 py-2">
                            <PriorityPill priority={item.priority} />
                          </td>
                          <td className="px-3 py-2 text-[10px] text-muted-foreground">
                            {item.relatedKpi && <div>{item.relatedKpi}</div>}
                            {item.relatedKr && <div>{item.relatedKr}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. OKR 进展推进汇报 — KR 维度汇总 */}
          {data.stats.byKr.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote font-semibold text-ink-primary bg-surface-2/50">
                  <ListChecks className="h-3.5 w-3.5 text-info" />
                  OKR 进展推进汇报 — 按 KR 维度
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-caption">
                    <thead>
                      <tr className="border-b text-footnote text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">KR</th>
                        <th className="text-right px-3 py-2 font-medium">check-in 次数</th>
                        <th className="text-right px-3 py-2 font-medium">本月推进</th>
                        <th className="text-right px-3 py-2 font-medium">当前 / 目标</th>
                        <th className="text-left px-3 py-2 font-medium">信心</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.stats.byKr.map((k) => (
                        <tr key={k.krId} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{k.krTitle}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{k.checkIns}</td>
                          <td className={cn(
                            'px-3 py-2 text-right tabular-nums font-medium',
                            k.progressDelta >= 0 ? 'text-success' : 'text-danger',
                          )}>
                            {k.progressDelta >= 0 ? '+' : ''}{k.progressDelta}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {k.finalProgress} / {k.targetValue}
                          </td>
                          <td className="px-3 py-2 text-footnote">
                            <ConfidencePill v={k.finalConfidence} />
                            {k.confidenceChanged && (
                              <span className="ml-1 text-[9px] text-warning">变化</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4b. KPI 趋势图 */}
          {data.kpiTrends && data.kpiTrends.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote font-semibold text-ink-primary bg-surface-2/50">
                  <LineChart className="h-3.5 w-3.5 text-info" />
                  KPI 趋势图
                  <Badge variant="outline" className="ml-auto text-[10px] bg-surface-1">
                    {data.kpiTrends.length} 个 KPI
                  </Badge>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {data.kpiTrends.map((t) => (
                    <div key={t.kpiId} className="space-y-1">
                      <div className="flex items-center gap-2 text-footnote">
                        <span className="font-medium text-ink-secondary">{t.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          目标 {t.target} {t.unit ?? ''}
                        </span>
                      </div>
                      <TrendLine points={t.points} target={t.target} unit={t.unit} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4c. OKR 进度趋势图 */}
          {data.krTrends && data.krTrends.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote font-semibold text-ink-primary bg-surface-2/50">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  OKR 进度趋势图
                  <Badge variant="outline" className="ml-auto text-[10px] bg-surface-1">
                    {data.krTrends.length} 个 KR
                  </Badge>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {data.krTrends.map((t) => (
                    <div key={t.krId} className="space-y-1">
                      <div className="flex items-center gap-2 text-footnote">
                        <span className="font-medium text-ink-secondary">{t.krTitle}</span>
                        <span className="text-[10px] text-muted-foreground">
                          目标 {t.target}
                        </span>
                      </div>
                      <TrendLine points={t.points} target={t.target} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. 原始 check-in 流水 */}
          {data.checkIns.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-footnote text-muted-foreground">
                  <CheckSquare className="h-3.5 w-3.5" />
                  原始 check-in 流水（共 {data.checkIns.length} 条 · 提供给 LLM 的依据）
                </div>
                <div className="divide-y">
                  {data.checkIns.map((c) => (
                    <div key={c.id} className="px-5 py-3 text-footnote space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-primary">{c.krTitle}</span>
                        <span className="text-muted-foreground">
                          {c.progressBefore} → {c.progressAfter}
                        </span>
                        <ConfidencePill v={c.confidenceAfter} />
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {c.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      {c.achievements && (
                        <DetailLine label="成果" text={c.achievements} color="text-success" />
                      )}
                      {c.blockers && <DetailLine label="卡点" text={c.blockers} color="text-warning" />}
                      {c.nextSteps && <DetailLine label="下一步" text={c.nextSteps} color="text-info" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-footnote text-muted-foreground mb-1">{label}</div>
        <div className={cn('text-headline font-bold tabular-nums', color)}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function KpiSummaryCard({ label, count, total, color, bg, border }: { label: string; count: number; total: number; color: string; bg: string; border: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={cn('rounded-md border p-3 space-y-1', bg, border)}>
      <div className={cn('text-footnote font-semibold', color)}>{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-headline font-bold tabular-nums', color)}>{count}</span>
        <span className="text-[10px] text-muted-foreground">/ {total} ({pct}%)</span>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold flex items-center gap-1 text-ink-secondary">
        {icon}
        {title}
      </p>
      {children.length === 0 ? (
        <p className="text-[11px] text-muted-foreground pl-4">—</p>
      ) : (
        children.map((line, i) => (
          <p key={i} className="text-[11px] text-ink-secondary pl-4">
            <CornerDownRight className="h-3 w-3 inline text-ink-tertiary mr-1" />
            {line}
          </p>
        ))
      )}
    </div>
  );
}

function ConfidencePill({ v }: { v: string }) {
  const cls =
    v === 'on-track'
      ? 'bg-success/10 text-success border-success/30'
      : v === 'at-risk'
        ? 'bg-warning/5 text-warning border-warning/20'
        : 'bg-danger/5 text-danger border-danger/30';
  const label = v === 'on-track' ? '正常' : v === 'at-risk' ? '关注' : '落后';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0 rounded border text-[10px]', cls)}>{label}</span>
  );
}

function ColorPill({ color }: { color: string }) {
  const cls =
    color === 'green'
      ? 'bg-success/10 text-success border-success/30'
      : color === 'yellow'
        ? 'bg-warning/10 text-warning border-warning/30'
        : 'bg-danger/10 text-danger border-danger/30';
  const label = color === 'green' ? '达标' : color === 'yellow' ? '关注' : '未达';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0 rounded border text-[10px]', cls)}>{label}</span>
  );
}

function DetailLine({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <p className="text-[11px] text-ink-secondary pl-3 flex items-start gap-1.5">
      <span className={cn('font-semibold shrink-0', color)}>{label}:</span>
      <span className="whitespace-pre-wrap">{text}</span>
    </p>
  );
}

function PriorityPill({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const cls =
    priority === 'high'
      ? 'bg-danger/10 text-danger border-danger/30'
      : priority === 'medium'
        ? 'bg-warning/10 text-warning border-warning/30'
        : 'bg-muted text-muted-foreground border-border';
  const label = priority === 'high' ? '高' : priority === 'medium' ? '中' : '低';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-medium', cls)}>
      <Flag className="h-2.5 w-2.5 mr-0.5" />
      {label}
    </span>
  );
}

function TrendLine({ points, target, unit }: { points: TrendPoint[]; target: number; unit?: string }) {
  const width = 320;
  const height = 48;
  const padX = 4;
  const padY = 6;

  if (points.length < 2) {
    return <div className="text-[10px] text-muted-foreground italic">数据点不足</div>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values, target);
  const max = Math.max(...values, target);
  const range = max - min || 1;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = padX + step * i;
    const y = padY + innerH - ((p.value - min) / range) * innerH;
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${(padY + innerH).toFixed(1)} L${coords[0].x.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;
  const targetY = padY + innerH - ((target - min) / range) * innerH;

  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const isUp = lastVal >= firstVal;
  const lastCoord = coords[coords.length - 1];

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`trend ${points.length} points`}>
        <path d={area} className="fill-sky-500/10" stroke="none" />
        <path d={path} className="stroke-sky-500" fill="none" strokeWidth={1.5} />
        {targetY >= padY && targetY <= padY + innerH && (
          <line x1={padX} x2={width - padX} y1={targetY} y2={targetY} className="stroke-zinc-400" strokeWidth={1} strokeDasharray="3 2" />
        )}
        <circle cx={lastCoord.x} cy={lastCoord.y} r={2.5} className="fill-sky-500" stroke="white" strokeWidth={1} />
      </svg>
      <div className="flex flex-col text-[10px] tabular-nums">
        <span className="text-muted-foreground">{firstVal} →</span>
        <span className={cn('font-bold', isUp ? 'text-success' : 'text-danger')}>
          {lastVal} {unit ?? ''}
        </span>
        <span className={cn('text-[9px]', isUp ? 'text-success' : 'text-danger')}>
          {isUp ? '↑' : '↓'} {Math.abs(lastVal - firstVal).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
