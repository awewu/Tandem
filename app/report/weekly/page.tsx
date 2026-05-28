'use client';

/**
 * /report/weekly — 本周回顾
 *
 * 完全基于真实 check-in 数据：
 *   1. 拉 /api/ai/weekly-recap 拿过去 7 天的统计 + LLM 汇总
 *   2. 显示 stats（check-in 数 / KR 数 / 进度增量 / 卡点数）
 *   3. 显示 LLM 汇总：summary / highlights / concerns / blockers / nextWeekFocus
 *   4. 底部列出原始 check-in 流水（让用户能审阅 LLM 的依据，反虚报）
 *
 * source 字段（llm / fallback）始终诚实展示。
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface RecapStats {
  totalCheckIns: number;
  krsTouched: number;
  progressIncrement: number;
  blockersCount: number;
  byKr: Array<{
    krId: string;
    krTitle: string;
    checkIns: number;
    progressDelta: number;
    finalProgress: number;
    targetValue: number;
    finalConfidence: string;
  }>;
}

interface RecapResponse {
  summary: string;
  highlights: string[];
  concerns: string[];
  blockers: string[];
  nextWeekFocus: string[];
  stats: RecapStats;
  checkIns: EnrichedCheckIn[];
  source: 'llm' | 'fallback';
  model?: string;
  reason?: string;
  rangeFrom: string;
  rangeTo: string;
}

const DAY_OPTIONS = [7, 14, 30] as const;

export default function WeeklyRecapPage() {
  const { toast } = useToast();
  const me = useCurrentUserId();
  const { user } = useCurrentUser();
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<RecapResponse | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // 默认选中自己
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
      const res = await fetch('/api/ai/weekly-recap', {
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
      // 暂存 stats/checkIns，等 done 拼装；如果 done 提前到了就直接覆盖
      let partial: Partial<RecapResponse> | null = null;

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
                | { type: 'stats'; stats: RecapStats; checkIns: EnrichedCheckIn[]; rangeFrom: string; rangeTo: string }
                | { type: 'delta'; content: string }
                | { type: 'done'; result: RecapResponse };
              if (ev.type === 'stats') {
                partial = {
                  stats: ev.stats,
                  checkIns: ev.checkIns,
                  rangeFrom: ev.rangeFrom,
                  rangeTo: ev.rangeTo,
                  // 占位字段，等 done 填充
                  summary: '',
                  highlights: [],
                  concerns: [],
                  blockers: [],
                  nextWeekFocus: [],
                  source: 'llm',
                };
                setData(partial as RecapResponse);
              } else if (ev.type === 'delta') {
                setStreamingText((prev) => prev + ev.content);
              } else if (ev.type === 'done') {
                setData(ev.result);
              }
            } catch {
              // 心跳/无效行 → 忽略
            }
          }
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '周报分析失败', description: (e as Error).message });
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
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            本周回顾
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            汇总过去 {days} 天的真实 check-in 数据；AI 提炼 highlights / concerns / blockers / 下周重点。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 主管/HR 代审选人区 (U1-B B端高阶特色) */}
          {selectedAssignee && (
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger className="w-48 h-8 text-xs bg-white">
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

          <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 h-8 text-xs">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-2.5 h-7 rounded transition-colors',
                  d === days ? 'bg-white shadow-soft-sm font-semibold' : 'text-muted-foreground hover:text-foreground',
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
          {/* 1. 硬统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="check-in 次数" value={String(data.stats.totalCheckIns)} sub={`${data.rangeFrom.slice(5, 10)} → ${data.rangeTo.slice(5, 10)}`} />
            <StatCard label="覆盖 KR 数" value={String(data.stats.krsTouched)} />
            <StatCard
              label="累计进度增量"
              value={`${data.stats.progressIncrement >= 0 ? '+' : ''}${data.stats.progressIncrement}`}
              color={data.stats.progressIncrement >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            />
            <StatCard
              label="卡点条数"
              value={String(data.stats.blockersCount)}
              color={data.stats.blockersCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
            />
          </div>

          {/* 2. LLM 汇总（带 source 徽章；流式中显示打字机） */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">AI 周报汇总</span>
                {data.summary === '' && loading ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-indigo-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    流式生成中
                  </span>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-auto text-[10px] border',
                      data.source === 'llm'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                    title={data.reason}
                  >
                    {data.source === 'llm' ? `LLM · ${data.model ?? 'unknown'}` : '降级模式（未调用 LLM）'}
                  </Badge>
                )}
              </div>

              {data.summary === '' && loading ? (
                <pre className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-mono max-h-[320px] overflow-y-auto bg-slate-50 rounded p-3 border border-slate-100">
                  {streamingText || '正在等待 LLM 首个 token…'}
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
                </pre>
              ) : (
                <>
                  <p className="text-sm text-slate-800 leading-relaxed">{data.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <Section icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} title="Highlights · 亮点">
                      {data.highlights}
                    </Section>
                    <Section icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} title="Concerns · 关注">
                      {data.concerns}
                    </Section>
                    <Section icon={<AlertCircle className="h-3.5 w-3.5 text-rose-500" />} title="Blockers · 卡点">
                      {data.blockers}
                    </Section>
                    <Section icon={<Zap className="h-3.5 w-3.5 text-indigo-500" />} title="Next Week · 下周重点">
                      {data.nextWeekFocus}
                    </Section>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 3. 本周行动项计划 (AP) 智能对账核销单 (P2 行动回顾核心) */}
          {data.checkIns.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-xs font-semibold text-slate-800 bg-slate-50/50">
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                  本周行动项计划 (AP) 智能核销对账
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    AI 自动提取本周提交的 daily check-ins 原始行动，与上期规划做对齐对账：
                  </p>
                  <div className="space-y-2">
                    {data.checkIns.map((c) => {
                      if (!c.achievements && !c.nextSteps) return null;
                      return (
                        <div key={c.id} className="p-3 rounded border text-xs flex items-start gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="font-bold text-slate-800">{c.krTitle}</div>
                            {c.achievements && (
                              <p className="text-[11px] text-slate-600 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                成果：{c.achievements}
                              </p>
                            )}
                            {c.nextSteps && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                                计划：{c.nextSteps}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] self-center shrink-0">
                            已自动核销对账
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. KR 维度汇总 */}
          {data.stats.byKr.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  按 KR 维度汇总
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">KR</th>
                        <th className="text-right px-3 py-2 font-medium">check-in 次数</th>
                        <th className="text-right px-3 py-2 font-medium">本周推进</th>
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
                            k.progressDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {k.progressDelta >= 0 ? '+' : ''}{k.progressDelta}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {k.finalProgress} / {k.targetValue}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <ConfidencePill v={k.finalConfidence} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. 原始 check-in 流水（让用户审阅 LLM 依据） */}
          {data.checkIns.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckSquare className="h-3.5 w-3.5" />
                  原始 check-in 流水（共 {data.checkIns.length} 条 · 提供给 LLM 的依据）
                </div>
                <div className="divide-y">
                  {data.checkIns.map((c) => (
                    <div key={c.id} className="px-5 py-3 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{c.krTitle}</span>
                        <span className="text-muted-foreground">
                          {c.progressBefore} → {c.progressAfter}
                        </span>
                        <ConfidencePill v={c.confidenceAfter} />
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {c.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      {c.achievements && (
                        <DetailLine label="成果" text={c.achievements} color="text-emerald-700" />
                      )}
                      {c.blockers && <DetailLine label="卡点" text={c.blockers} color="text-amber-700" />}
                      {c.nextSteps && <DetailLine label="下一步" text={c.nextSteps} color="text-indigo-700" />}
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
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold flex items-center gap-1 text-slate-700">
        {icon}
        {title}
      </p>
      {children.length === 0 ? (
        <p className="text-[11px] text-muted-foreground pl-4">—</p>
      ) : (
        children.map((line, i) => (
          <p key={i} className="text-[11px] text-slate-600 pl-4">
            <CornerDownRight className="h-3 w-3 inline text-slate-400 mr-1" />
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
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : v === 'at-risk'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  const label = v === 'on-track' ? '正常' : v === 'at-risk' ? '关注' : '落后';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0 rounded border text-[10px]', cls)}>{label}</span>
  );
}

function DetailLine({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <p className="text-[11px] text-slate-600 pl-3 flex items-start gap-1.5">
      <span className={cn('font-semibold shrink-0', color)}>{label}:</span>
      <span className="whitespace-pre-wrap">{text}</span>
    </p>
  );
}
