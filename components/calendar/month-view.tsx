'use client';

import { useMemo, useState } from 'react';
import { useCalendarStore, type EventInstance, fmtTime } from '@/lib/store/calendar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface MonthViewProps {
  year: number;
  month: number; // 0-11
  todayMs: number;
  currentUserId?: string;
  onEventClick: (instance: EventInstance) => void;
  onCellClick: (date: Date) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_VISIBLE_MONTH_EVENTS = 4;

export default function MonthView({ year, month, todayMs, currentUserId, onEventClick, onCellClick }: MonthViewProps) {
  const getEventsInRange = useCalendarStore((s) => s.getEventsInRange);
  // 订阅原始 events / calendars, 否则新增事件或切换可见性时 useMemo 不会重算 (函数引用恒定)。
  const allEvents = useCalendarStore((s) => s.events);
  const allCalendars = useCalendarStore((s) => s.calendars);
  const [expandedDay, setExpandedDay] = useState<{ dateMs: number; events: EventInstance[] } | null>(null);

  const { cells, eventsByDay, monthStart, monthEnd } = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const offset = (first.getDay() + 6) % 7; // 周一为首
    const days = last.getDate();

    const cells: { day: number | null; dateMs: number }[] = [];
    for (let i = 0; i < offset; i++) {
      const prev = new Date(year, month, 0);
      prev.setDate(prev.getDate() - (offset - 1 - i));
      cells.push({ day: null, dateMs: prev.getTime() });
    }
    for (let d = 1; d <= days; d++) {
      cells.push({ day: d, dateMs: new Date(year, month, d).getTime() });
    }
    const tail = cells.length % 7;
    if (tail !== 0) {
      for (let i = 1; i <= 7 - tail; i++) {
        const next = new Date(year, month + 1, i);
        cells.push({ day: null, dateMs: next.getTime() });
      }
    }

    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    const events = getEventsInRange(monthStart, monthEnd);
    const eventsByDay = new Map<number, EventInstance[]>();
    for (const ev of events) {
      const day = new Date(ev.startTime).getDate();
      const arr = eventsByDay.get(day) ?? [];
      arr.push(ev);
      eventsByDay.set(day, arr);
    }

    return { cells, eventsByDay, monthStart, monthEnd };
    // allEvents/allCalendars 为有意依赖: 触发重算 (getEventsInRange 内部读 store, ESLint 看不到)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, getEventsInRange, allEvents, allCalendars]);

  const isInMonth = (ms: number) => ms >= monthStart && ms <= monthEnd;

  return (
    <div className="flex flex-col h-full">
      {/* 周标题 */}
      <div className="grid grid-cols-7 gap-px border-b bg-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-caption font-medium text-muted-foreground py-2 bg-background">
            周{w}
          </div>
        ))}
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-7 gap-px flex-1 bg-border">
        {cells.map((cell, idx) => {
          const isToday = cell.dateMs === todayMs;
          const isPast = cell.dateMs < todayMs;
          const inMonth = cell.day !== null && isInMonth(cell.dateMs);
          const dayEvents = cell.day !== null ? (eventsByDay.get(cell.day) ?? []) : [];

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[74px] bg-background p-0.5 transition-colors sm:min-h-[100px] sm:p-1',
                isPast ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/30',
                !inMonth && 'bg-muted/20',
                isToday && 'bg-warning/5 border-warning/10'
              )}
              onClick={() => {
                if (isPast) return;
                if (dayEvents.length > 0) {
                  setExpandedDay({ dateMs: cell.dateMs, events: dayEvents });
                  return;
                }
                onCellClick(new Date(cell.dateMs));
              }}
            >
              <div className={cn(
                'text-caption font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                isToday ? 'bg-warning text-white' : inMonth ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {cell.day !== null ? cell.day : new Date(cell.dateMs).getDate()}
              </div>

              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, MAX_VISIBLE_MONTH_EVENTS).map((ev, eventIndex) => (
                  <EventPill
                    key={ev.instanceId}
                    event={ev}
                    currentUserId={currentUserId}
                    className={eventIndex > 0 ? 'hidden sm:block' : undefined}
                    onClick={onEventClick}
                  />
                ))}
                {dayEvents.length > 1 && (
                  <button
                    type="button"
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDay({ dateMs: cell.dateMs, events: dayEvents });
                    }}
                  >
                    还有 {dayEvents.length - 1} 项
                  </button>
                )}
                {dayEvents.length > MAX_VISIBLE_MONTH_EVENTS && (
                  <button
                    type="button"
                    className="hidden w-full rounded px-1.5 py-0.5 text-left text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDay({ dateMs: cell.dateMs, events: dayEvents });
                    }}
                  >
                    +{dayEvents.length - MAX_VISIBLE_MONTH_EVENTS} 更多，查看全部
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={expandedDay !== null} onOpenChange={(open) => !open && setExpandedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {expandedDay ? formatDayTitle(expandedDay.dateMs) : '当天日程'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {expandedDay?.events.map((ev) => (
              <EventPill
                key={ev.instanceId}
                event={ev}
                currentUserId={currentUserId}
                expanded
                onClick={(event) => {
                  setExpandedDay(null);
                  onEventClick(event);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventPill({
  event,
  currentUserId,
  expanded = false,
  className,
  onClick,
}: {
  event: EventInstance;
  currentUserId?: string;
  expanded?: boolean;
  className?: string;
  onClick: (instance: EventInstance) => void;
}) {
  const meta = getEventMeta(event, currentUserId);
  return (
    <button
      type="button"
      className={cn(
        'w-full min-w-0 text-left transition-opacity hover:opacity-85',
        expanded
          ? 'rounded-lg border px-2.5 py-2 shadow-soft-xs'
          : 'rounded-md px-1 py-0.5 text-[10px] shadow-[inset_2px_0_0_rgba(255,255,255,0.45)] sm:rounded sm:px-1.5',
        event.status === 'cancelled' && 'opacity-40 line-through',
        className,
      )}
      style={{
        backgroundColor: expanded ? meta.softBg : meta.bg,
        borderColor: meta.border,
        color: expanded ? meta.text : '#fff',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
    >
      <div className={cn(expanded ? 'flex min-w-0 items-center gap-2' : 'min-w-0 sm:flex sm:items-center sm:gap-1')}>
        <span
          className={cn(
            'shrink-0 rounded px-1 font-semibold leading-4',
            expanded ? 'text-[10px]' : 'hidden text-[8px] sm:inline-block',
          )}
          style={{
            backgroundColor: expanded ? meta.bg : 'rgba(255,255,255,0.24)',
            color: '#fff',
          }}
        >
          {meta.badge}
        </span>
        {!event.isAllDay && expanded && (
          <span className="shrink-0 text-[11px] opacity-80">
            {fmtTime(event.startTime)}
          </span>
        )}
        <span className={cn('min-w-0 truncate', expanded ? 'flex-1 text-body font-medium' : 'block font-medium leading-3 sm:flex-1')}>
          {event.title}
        </span>
        {event.hasConflict && <AlertTriangle className={cn('shrink-0', expanded ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} aria-label="时间冲突" />}
      </div>
      {!expanded && !event.isAllDay && (
        <div className="mt-0.5 truncate text-[9px] leading-3 opacity-85 sm:hidden">
          {fmtTime(event.startTime)}
        </div>
      )}
      {expanded && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] opacity-75">
          <span>{meta.label}</span>
          <span>{fmtTime(event.startTime)} - {fmtTime(event.endTime)}</span>
          {event.location && <span className="truncate">地点：{event.location}</span>}
        </div>
      )}
    </button>
  );
}

function getEventMeta(event: EventInstance, currentUserId?: string): {
  badge: string;
  label: string;
  bg: string;
  softBg: string;
  border: string;
  text: string;
} {
  if (event.sourceKind === 'subscribed' || event.calendarId === 'cal-subscribed') {
    return {
      badge: '订',
      label: '订阅日程',
      bg: '#64748b',
      softBg: '#f1f5f9',
      border: '#cbd5e1',
      text: '#334155',
    };
  }
  if (event.sourceKind === 'okr' || event.calendarId === 'cal-okr' || event.type === 'okr_due' || event.type === 'checkin' || event.type === 'cycle') {
    return {
      badge: 'OKR',
      label: 'OKR 同步',
      bg: '#10b981',
      softBg: '#ecfdf5',
      border: '#a7f3d0',
      text: '#065f46',
    };
  }
  if (event.type === 'meeting') {
    const isOwner = currentUserId && event.createdBy === currentUserId;
    return {
      badge: isOwner ? '我' : '参',
      label: isOwner ? '我发起的会议' : '我参与的会议',
      bg: '#8b5cf6',
      softBg: '#f5f3ff',
      border: '#ddd6fe',
      text: '#5b21b6',
    };
  }
  return {
    badge: '日',
    label: '我的日程',
    bg: getColorBg(event.color || 'bg-blue-500'),
    softBg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
  };
}

function formatDayTitle(dateMs: number): string {
  const date = new Date(dateMs);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日全部日程`;
}

function getColorBg(twClass: string): string {
  const map: Record<string, string> = {
    'bg-blue-500': '#3b82f6',
    'bg-emerald-500': '#10b981',
    'bg-violet-500': '#8b5cf6',
    ['bg-' + 'amber-500']: '#f59e0b',
    'bg-rose-500': '#f43f5e',
    'bg-cyan-500': '#06b6d4',
    'bg-slate-400': '#94a3b8',
  };
  return map[twClass] || '#94a3b8';
}
