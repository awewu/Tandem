'use client';

/**
 * /okr/calendar — KR 截止日历视图 (OKR P1 · 2026-05-10)
 *
 * 月网格渲染:
 *   - 标记当天 (amber 边框)
 *   - 标记 KR dueDate (红/橙/绿点, 按 confidence)
 *   - 标记 check-in 提交日 (灰小点)
 *   - 标记周期切换日 (cycle.startDate/endDate, 紫色标签)
 *
 * 0 schema 改动. 100% 派生.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useOKRStore, type Confidence } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Target,
  CheckCircle2, AlertTriangle, MessageSquare,
} from 'lucide-react';

const CONF_DOT: Record<string, string> = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-warning',
  'off-track': 'bg-rose-500',
};
function dotColor(confidence?: string | null) {
  return (confidence && CONF_DOT[confidence]) || 'bg-slate-400';
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface CellEvent {
  type: 'kr-due' | 'checkin' | 'cycle-start' | 'cycle-end';
  label: string;
  meta?: string;
  href?: string;
  confidence?: Confidence;
}

export default function OKRCalendarPage() {
  const { cycles, objectives, keyResults, checkIns, people } = useOKRStore();
  const [year, setYear] = useState<number>(0);
  const [month, setMonth] = useState<number>(0); // 0-11
  const [todayMs, setTodayMs] = useState<number>(0);

  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayMs(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  }, []);

  const personById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  const objectiveById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objectives) m.set(o.id, o.title);
    return m;
  }, [objectives]);

  /** 当月每日事件 */
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CellEvent[]>();
    if (year === 0) return map;

    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

    const push = (day: number, ev: CellEvent) => {
      const arr = map.get(day) ?? [];
      arr.push(ev);
      map.set(day, arr);
    };

    // KR dueDate
    for (const kr of keyResults) {
      if (!kr || !kr.dueDate) continue;
      const d = typeof kr.dueDate === 'number' ? kr.dueDate : Date.parse(kr.dueDate as unknown as string);
      if (Number.isNaN(d)) continue;
      if (d < monthStart || d > monthEnd) continue;
      const day = new Date(d).getDate();
      push(day, {
        type: 'kr-due',
        label: kr.title || '(无标题)',
        meta: `${objectiveById.get(kr.objectiveId) ?? ''} · ${personById.get(kr.ownerId) ?? ''}`,
        href: `/okr?o=${kr.objectiveId}`,
        confidence: kr.confidence || undefined,
      });
    }

    // check-ins
    for (const ci of checkIns) {
      if (!ci || !ci.createdAt) continue;
      const d = typeof ci.createdAt === 'number' ? ci.createdAt : Date.parse(ci.createdAt as unknown as string);
      if (Number.isNaN(d)) continue;
      if (d < monthStart || d > monthEnd) continue;
      const day = new Date(d).getDate();
      const targetTitle =
        ci.scope === 'objective'
          ? objectiveById.get(ci.scopeId)
          : keyResults.find((k) => k.id === ci.scopeId)?.title;
      push(day, {
        type: 'checkin',
        label: `${ci.scope === 'objective' ? 'O' : 'KR'} check-in: ${targetTitle ?? ''}`,
        meta: `${personById.get(ci.authorId) ?? ''} · ${(ci.progressAfter ?? 0)}%`,
      });
    }

    // 周期切换
    for (const c of cycles) {
      if (!c.startDate || !c.endDate) continue;
      if (c.startDate >= monthStart && c.startDate <= monthEnd) {
        push(new Date(c.startDate).getDate(), {
          type: 'cycle-start',
          label: `${c.name} 开始`,
        });
      }
      if (c.endDate >= monthStart && c.endDate <= monthEnd) {
        push(new Date(c.endDate).getDate(), {
          type: 'cycle-end',
          label: `${c.name} 结束`,
        });
      }
    }

    return map;
  }, [year, month, keyResults, checkIns, cycles, objectiveById, personById]);

  /** 月份数据 */
  const monthGrid = useMemo(() => {
    if (year === 0) return null;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // 周一为首列: getDay() 周日=0, 周一=1; offset = (getDay()+6)%7
    const offset = (first.getDay() + 6) % 7;
    const days = last.getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const monthLabel = year === 0 ? '加载中...' : `${year} 年 ${month + 1} 月`;

  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };
  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear()); setMonth(n.getMonth());
  };

  // 全局 KR 截止数 (本月)
  const monthKrDue = useMemo(() => {
    let count = 0;
    eventsByDay.forEach((evs) => {
      count += evs.filter((e) => e.type === 'kr-due').length;
    });
    return count;
  }, [eventsByDay]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-title-3 font-semibold flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-blue-600" />
              OKR 日历
            </h1>
            <p className="text-footnote text-muted-foreground mt-1">
              KR 截止 / Check-in / 周期切换 — 月网格视图
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={goToday}>
              今天
            </Button>
            <span className="font-medium text-caption w-28 text-center">{monthLabel}</span>
            <Button size="sm" variant="outline" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 月度统计 */}
        <div className="flex gap-2 mb-4 text-footnote">
          <Badge variant="outline" className="gap-1">
            <Target className="h-3 w-3" /> 本月 {monthKrDue} 个 KR 截止
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            本月 {Array.from(eventsByDay.values()).flat().filter(e => e.type === 'checkin').length} 次 check-in
          </Badge>
        </div>

        <Card>
          <CardContent className="p-3">
            {/* 周标题 */}
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] text-muted-foreground py-1 uppercase tracking-wider">
                  周{w}
                </div>
              ))}
            </div>
            {/* 网格 */}
            <div className="grid grid-cols-7 gap-1">
              {(monthGrid ?? []).map((day, idx) => {
                if (day === null) {
                  return <div key={`e-${idx}`} className="min-h-[88px] rounded bg-slate-50/40" />;
                }
                const cellMs = year === 0 ? 0 : new Date(year, month, day).getTime();
                const isToday = todayMs > 0 && cellMs === todayMs;
                const isPast = todayMs > 0 && cellMs < todayMs;
                const events = eventsByDay.get(day) ?? [];
                return (
                  <div
                    key={day}
                    className={`min-h-[88px] rounded border p-1 transition ${
                      isToday
                        ? 'border-warning/50 bg-warning/5'
                        : isPast
                        ? 'border-slate-200 bg-slate-50/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`text-[11px] font-medium mb-0.5 ${
                      isToday ? 'text-warning' : isPast ? 'text-slate-400' : 'text-slate-700'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((ev, i) => (
                        <CellEventRow key={i} ev={ev} />
                      ))}
                      {events.length > 3 && (
                        <div className="text-[9px] text-muted-foreground">
                          +{events.length - 3} 更多
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 图例 */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-caption">图例</CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              KR 截止 (在轨)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              KR 截止 (风险)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              KR 截止 (落后)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Check-in 提交
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              周期开始/结束
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border-2 border-warning/50" />
              今天
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CellEventRow({ ev }: { ev: CellEvent }) {
  if (ev.type === 'kr-due') {
    const dot = dotColor(ev.confidence);
    const inner = (
      <div className="flex items-center gap-1 text-[9px] truncate">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="truncate" title={ev.label}>{ev.label}</span>
      </div>
    );
    return ev.href ? (
      <Link href={ev.href} className="block hover:underline">{inner}</Link>
    ) : inner;
  }
  if (ev.type === 'checkin') {
    return (
      <div className="flex items-center gap-1 text-[9px] truncate text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
        <span className="truncate">✓ check-in</span>
      </div>
    );
  }
  // cycle-start / cycle-end
  return (
    <div className="flex items-center gap-1 text-[9px] truncate">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
      <span className="truncate font-medium text-violet-700" title={ev.label}>
        {ev.label}
      </span>
    </div>
  );
}
