'use client';

/**
 * /calendar — Tandem 日程中心 v2 (对标 Apple Calendar)
 *
 * 三视图: 月 / 周 / 日
 * 功能: 事件 CRUD · 重复规则 · 提醒 · 多日历管理
 * 集成: OKR due / Check-in / Cycle 自动同步 (cal-okr)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useCalendarStore, type EventInstance, fmtMonthCN } from '@/lib/store/calendar';
import { useOKRStore } from '@/lib/store/okr';
import { checkReminders, sendReminderEmail } from '@/lib/calendar/email-bridge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, Wand2,
  LayoutGrid, Columns3, List, Eye, EyeOff,
  ShieldCheck, MessageSquare,
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

  // 自然语言快速创建
  const [nlpText, setNlpText] = useState('');
  const [nlpBusy, setNlpBusy] = useState(false);

  // 智能时间建议
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ startTime: number; endTime: number; reason: string }> | null>(null);
  const [showSmartTime, setShowSmartTime] = useState(false);

  // 初始化
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayMs(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  }, []);

  // 提醒轮询 (每 60 秒检查一次, 到期发邮件通知)
  useEffect(() => {
    if (events.length === 0) return;
    const timer = setInterval(() => {
      const fired = checkReminders(events);
      for (const f of fired) {
        const ev = events.find((e) => e.id === f.eventId);
        if (ev) sendReminderEmail(ev, f.minutesBefore).catch(() => {});
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [events]);

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

  // 自然语言快速创建
  async function handleNlpCreate() {
    if (!nlpText.trim()) return;
    setNlpBusy(true);
    try {
      const res = await fetch('/api/calendar/nlp-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: nlpText.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.event) {
        addEvent({
          ...json.event,
          calendarId: 'cal-personal',
          createdBy: 'me',
          status: 'confirmed',
          reminders: [{ minutesBefore: 15 }],
        } as any);
        setNlpText('');
      } else {
        alert(json.error || '解析失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setNlpBusy(false);
    }
  }

  // 智能时间建议
  async function handleSmartTime() {
    try {
      const res = await fetch('/api/calendar/smart-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ durationMinutes: 60 }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.suggestions) {
        setSmartSuggestions(json.suggestions);
        setShowSmartTime(true);
      }
    } catch {
      /* 静默失败 */
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-background">
      {/* 左侧边栏 — 日历列表 + 快速入口 */}
      <aside className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <Button
            className="w-full gap-1 bg-brand-500 hover:bg-brand-600 text-white"
            size="sm"
            onClick={handleNewEvent}
          >
            <Plus className="h-4 w-4" />
            新建事件
          </Button>
          <Button
            variant="outline"
            className="w-full gap-1 text-caption"
            size="sm"
            onClick={() => {
              // 一键创建 2 小时 Focus Time（今天剩余时间中找空档）
              const now = new Date();
              now.setMinutes(0, 0, 0);
              now.setHours(now.getHours() + 1);
              const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
              addEvent({
                calendarId: 'cal-personal',
                title: '🔒 深度工作 (Focus Time)',
                startTime: now.getTime(),
                endTime: end.getTime(),
                isAllDay: false,
                type: 'custom',
                createdBy: 'me',
                status: 'confirmed',
                reminders: [{ minutesBefore: 5 }],
              } as any);
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            创建 Focus Time
          </Button>
          <Button
            variant="outline"
            className="w-full gap-1 text-caption"
            size="sm"
            onClick={() => {
              const upcoming = events
                .filter((e) => e.type === 'meeting' && e.startTime > Date.now())
                .sort((a, b) => a.startTime - b.startTime)[0];
              if (upcoming) {
                alert(`[IM 提醒] 已触发:\n即将发送会议提醒到 IM:\n${upcoming.title}\n${new Date(upcoming.startTime).toLocaleString('zh-CN')}`);
              } else {
                alert('暂无即将到来的会议可提醒');
              }
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            IM 提醒参会人
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wider">我的日历</h3>
          <div className="space-y-1">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-body hover:bg-muted transition-colors"
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
            <h1 className="text-title-3 font-semibold ml-2">{monthLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* 自然语言快速创建 */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-md px-2 py-1">
              <Sparkles className="h-3.5 w-3.5 text-info" />
              <Input
                placeholder="自然语言创建: 明天下午3点跟张伟开会"
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNlpCreate()}
                className="h-7 w-64 border-0 bg-transparent text-caption focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
              />
              <Button variant="ghost" size="sm" className="h-6 px-2 text-caption" onClick={handleNlpCreate} disabled={nlpBusy}>
                {nlpBusy ? '...' : '创建'}
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="gap-1 text-caption" onClick={handleSmartTime}>
              <Wand2 className="h-3.5 w-3.5" />
              智能时间
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

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

        {/* 智能时间建议面板 */}
        {showSmartTime && smartSuggestions && (
          <div className="shrink-0 border-b px-4 py-2 bg-info/10/50">
            <div className="flex items-center gap-2 mb-1.5">
              <Wand2 className="h-3.5 w-3.5 text-info" />
              <span className="text-caption font-medium text-info">AI 建议的最佳会议时间</span>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] ml-auto" onClick={() => setShowSmartTime(false)}>
                关闭
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {smartSuggestions.map((s, i) => (
                <button
                  key={i}
                  className="text-caption px-2.5 py-1.5 rounded-md bg-white border border-info/30 hover:bg-info/10 transition-colors text-left"
                  onClick={() => {
                    setSelectedDate(new Date(s.startTime));
                    setEditorDate(new Date(s.startTime));
                    setEditorEventId(undefined);
                    setEditorOpen(true);
                    setShowSmartTime(false);
                  }}
                >
                  <div className="font-medium">{new Date(s.startTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-[10px] text-muted-foreground">{s.reason}</div>
                </button>
              ))}
            </div>
          </div>
        )}

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
      <h3 className="text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wider">即将到来</h3>
      <div className="space-y-1.5">
        {upcoming.map((ev) => {
          const cal = calendars.find((c) => c.id === ev.calendarId);
          const date = new Date(ev.startTime);
          const isToday = new Date().toDateString() === date.toDateString();
          return (
            <div key={ev.instanceId} className="text-caption px-2 py-1.5 rounded-md bg-muted/50">
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
