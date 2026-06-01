'use client';

import { useMemo } from 'react';
import { useCalendarStore, type EventInstance, fmtTime } from '@/lib/store/calendar';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number; // 0-11
  todayMs: number;
  onEventClick: (instance: EventInstance) => void;
  onCellClick: (date: Date) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export default function MonthView({ year, month, todayMs, onEventClick, onCellClick }: MonthViewProps) {
  const { getEventsInRange } = useCalendarStore();

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
  }, [year, month, getEventsInRange]);

  const isInMonth = (ms: number) => ms >= monthStart && ms <= monthEnd;

  return (
    <div className="flex flex-col h-full">
      {/* 周标题 */}
      <div className="grid grid-cols-7 gap-px border-b bg-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-muted-foreground py-2 bg-background">
            周{w}
          </div>
        ))}
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-7 gap-px flex-1 bg-border">
        {cells.map((cell, idx) => {
          const isToday = cell.dateMs === todayMs;
          const inMonth = cell.day !== null && isInMonth(cell.dateMs);
          const dayEvents = cell.day !== null ? (eventsByDay.get(cell.day) ?? []) : [];

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[100px] bg-background p-1 cursor-pointer transition-colors hover:bg-muted/30',
                !inMonth && 'bg-muted/20',
                isToday && 'bg-amber-50'
              )}
              onClick={() => onCellClick(new Date(cell.dateMs))}
            >
              <div className={cn(
                'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                isToday ? 'bg-amber-500 text-white' : inMonth ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {cell.day !== null ? cell.day : new Date(cell.dateMs).getDate()}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.instanceId}
                    className={cn(
                      'w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 transition-opacity hover:opacity-80',
                      ev.status === 'cancelled' && 'opacity-40 line-through'
                    )}
                    style={{ backgroundColor: getColorBg(ev.color) }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  >
                    {!ev.isAllDay && (
                      <span className="text-[9px] opacity-70 shrink-0">{fmtTime(ev.startTime)}</span>
                    )}
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-muted-foreground pl-1.5">
                    +{dayEvents.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getColorBg(twClass: string): string {
  const map: Record<string, string> = {
    'bg-blue-500': '#3b82f6',
    'bg-emerald-500': '#10b981',
    'bg-violet-500': '#8b5cf6',
    'bg-amber-500': '#f59e0b',
    'bg-rose-500': '#f43f5e',
    'bg-cyan-500': '#06b6d4',
    'bg-slate-400': '#94a3b8',
  };
  return map[twClass] || '#94a3b8';
}
