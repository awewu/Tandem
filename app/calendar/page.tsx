'use client';

/**
 * /calendar — Tandem 日程中心 v2 (对标 Apple Calendar)
 *
 * 三视图: 月 / 周 / 日
 * 功能: 事件 CRUD · 重复规则 · 提醒 · 多日历管理
 * 集成: OKR due / Check-in / Cycle 自动同步 (cal-okr)
 */

import { useEffect, useMemo, useState } from 'react';
import { useCalendarStore, type EventInstance, fmtMonthCN } from '@/lib/store/calendar';
import { useOKRStore } from '@/lib/store/okr';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, ChevronRight, Plus,
  LayoutGrid, Columns3, List, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MonthView from '@/components/calendar/month-view';
import WeekView from '@/components/calendar/week-view';
import DayView from '@/components/calendar/day-view';
import EventEditor from '@/components/calendar/event-editor';

type ViewMode = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const {
    calendars, events, toggleCalendarVisibility, addEvent, deleteEvent,
  } = useCalendarStore();
  const { cycles, keyResults, checkIns, objectives, people } = useOKRStore();

  const [view, setView] = useState<ViewMode>('month');
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0); // 0-11
  const [todayMs, setTodayMs] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 事件编辑器
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState<Date | undefined>();
  const [editorEventId, setEditorEventId] = useState<string | undefined>();

  // 初始化
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayMs(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  }, []);

  // 自动同步 OKR 数据 → CalendarEvent (cal-okr)
  useEffect(() => {
    if (year === 0) return;
    const okrCalId = 'cal-okr';
    const now = Date.now();

    // 清理旧的同步事件
    const toRemove = events.filter(
      (e) => e.calendarId === okrCalId && !e.externalSource
    );
    for (const e of toRemove) deleteEvent(e.id);

    // KR dueDate
    for (const kr of keyResults) {
      if (!kr || !kr.dueDate) continue;
      const d = typeof kr.dueDate === 'number' ? kr.dueDate : Date.parse(kr.dueDate as unknown as string);
      if (Number.isNaN(d)) continue;
      const objTitle = objectives.find((o) => o.id === kr.objectiveId)?.title || '';
      const ownerName = people.find((p) => p.id === kr.ownerId)?.name || '';
      addEvent({
        calendarId: okrCalId,
        title: `KR截止: ${kr.title || '(无标题)'}`,
        startTime: new Date(new Date(d).setHours(9, 0, 0, 0)).getTime(),
        endTime: new Date(new Date(d).setHours(10, 0, 0, 0)).getTime(),
        isAllDay: false,
        type: 'okr_due',
        linkedKrId: kr.id,
        createdBy: 'system',
        status: 'confirmed',
        description: `目标: ${objTitle}\n负责人: ${ownerName}`,
      });
    }

    // Check-ins
    for (const ci of checkIns) {
      if (!ci || !ci.createdAt) continue;
      const d = typeof ci.createdAt === 'number' ? ci.createdAt : Date.parse(ci.createdAt as unknown as string);
      if (Number.isNaN(d)) continue;
      const authorName = people.find((p) => p.id === ci.authorId)?.name || '';
      addEvent({
        calendarId: okrCalId,
        title: `${ci.scope === 'objective' ? 'O' : 'KR'} Check-in`,
        startTime: d,
        endTime: d + 30 * 60 * 1000,
        isAllDay: false,
        type: 'checkin',
        createdBy: 'system',
        status: 'confirmed',
        description: `提交人: ${authorName}\n进度: ${ci.progressAfter ?? 0}%`,
      });
    }

    // Cycle 切换
    for (const c of cycles) {
      if (!c.startDate || !c.endDate) continue;
      addEvent({
        calendarId: okrCalId,
        title: `${c.name} 开始`,
        startTime: c.startDate,
        endTime: c.startDate + 60 * 60 * 1000,
        isAllDay: true,
        type: 'cycle',
        createdBy: 'system',
        status: 'confirmed',
      });
      addEvent({
        calendarId: okrCalId,
        title: `${c.name} 结束`,
        startTime: c.endDate,
        endTime: c.endDate + 60 * 60 * 1000,
        isAllDay: true,
        type: 'cycle',
        createdBy: 'system',
        status: 'confirmed',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, keyResults, checkIns, objectives, people, year]);

  const goPrev = () => {
    if (view === 'month') {
      if (month === 0) { setYear(y => y - 1); setMonth(11); }
      else setMonth(m => m - 1);
    } else if (view === 'week') {
      const d = selectedDate || new Date(year, month, 1);
      d.setDate(d.getDate() - 7);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(new Date(d));
    } else {
      const d = selectedDate || new Date(year, month, 1);
      d.setDate(d.getDate() - 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(new Date(d));
    }
  };

  const goNext = () => {
    if (view === 'month') {
      if (month === 11) { setYear(y => y + 1); setMonth(0); }
      else setMonth(m => m + 1);
    } else if (view === 'week') {
      const d = selectedDate || new Date(year, month, 1);
      d.setDate(d.getDate() + 7);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(new Date(d));
    } else {
      const d = selectedDate || new Date(year, month, 1);
      d.setDate(d.getDate() + 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(new Date(d));
    }
  };

  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
    setSelectedDate(new Date(n));
  };

  const currentDate = selectedDate || new Date(year, month, 1);
  const monthLabel = year === 0 ? '加载中...' : fmtMonthCN(year, month);

  const handleEventClick = (instance: EventInstance) => {
    setEditorEventId(instance.eventId);
    setEditorDate(undefined);
    setEditorOpen(true);
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(new Date(date));
    setEditorDate(new Date(date));
    setEditorEventId(undefined);
    setEditorOpen(true);
  };

  const handleNewEvent = () => {
    setEditorDate(selectedDate || new Date());
    setEditorEventId(undefined);
    setEditorOpen(true);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-background">
      {/* 左侧边栏 — 日历列表 + 快速入口 */}
      <aside className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <Button
            className="w-full gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
            onClick={handleNewEvent}
          >
            <Plus className="h-4 w-4" />
            新建事件
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">我的日历</h3>
          <div className="space-y-1">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                onClick={() => toggleCalendarVisibility(cal.id)}
              >
                {cal.isVisible ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cal.color)} />
                <span className={cn('truncate', !cal.isVisible && 'text-muted-foreground line-through')}>
                  {cal.name}
                </span>
              </button>
            ))}
          </div>

          {/* 今日 upcoming */}
          <UpcomingEvents />
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 工具栏 */}
        <div className="shrink-0 border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              今天
            </Button>
            <Button variant="outline" size="sm" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold ml-2">{monthLabel}</h1>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={view === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className="gap-1"
            >
              <LayoutGrid className="h-4 w-4" />
              月
            </Button>
            <Button
              variant={view === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className="gap-1"
            >
              <Columns3 className="h-4 w-4" />
              周
            </Button>
            <Button
              variant={view === 'day' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
              className="gap-1"
            >
              <List className="h-4 w-4" />
              日
            </Button>
          </div>
        </div>

        {/* 视图区域 */}
        <div className="flex-1 overflow-hidden">
          {year === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">加载中...</div>
          ) : view === 'month' ? (
            <MonthView
              year={year}
              month={month}
              todayMs={todayMs}
              onEventClick={handleEventClick}
              onCellClick={handleCellClick}
            />
          ) : view === 'week' ? (
            <WeekView
              date={currentDate}
              todayMs={todayMs}
              onEventClick={handleEventClick}
              onCellClick={handleCellClick}
            />
          ) : (
            <DayView
              date={currentDate}
              todayMs={todayMs}
              onEventClick={handleEventClick}
              onCellClick={handleCellClick}
            />
          )}
        </div>
      </main>

      <EventEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialDate={editorDate}
        editEventId={editorEventId}
      />
    </div>
  );
}

/** 今日 upcoming 小部件 */
function UpcomingEvents() {
  const { getUpcomingEvents, calendars } = useCalendarStore();
  const upcoming = useMemo(() => getUpcomingEvents(5), [getUpcomingEvents]);

  if (upcoming.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">即将到来</h3>
      <div className="space-y-1.5">
        {upcoming.map((ev) => {
          const cal = calendars.find((c) => c.id === ev.calendarId);
          const date = new Date(ev.startTime);
          const isToday = new Date().toDateString() === date.toDateString();
          return (
            <div key={ev.instanceId} className="text-xs px-2 py-1.5 rounded bg-muted/50">
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cal?.color || 'bg-slate-400')} />
                <span className="font-medium truncate">{ev.title}</span>
              </div>
              <div className="text-muted-foreground mt-0.5 pl-3">
                {isToday ? '今天' : `${date.getMonth() + 1}/${date.getDate()}`}
                {!ev.isAllDay && ` · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
