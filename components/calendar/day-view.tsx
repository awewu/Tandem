'use client';

import { useMemo } from 'react';
import { useCalendarStore, type EventInstance, fmtTime, getDayRange } from '@/lib/store/calendar';
import { cn } from '@/lib/utils';

interface DayViewProps {
  date: Date;
  todayMs: number;
  onEventClick: (instance: EventInstance) => void;
  onCellClick: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ date, todayMs, onEventClick, onCellClick }: DayViewProps) {
  const { getEventsInRange } = useCalendarStore();
  const isToday = date.getTime() === todayMs;

  const { events, allDayEvents } = useMemo(() => {
    const { start, end } = getDayRange(date);
    const all = getEventsInRange(start, end);
    return {
      events: all.filter((e) => !e.isAllDay).sort((a, b) => a.startTime - b.startTime),
      allDayEvents: all.filter((e) => e.isAllDay),
    };
  }, [date, getEventsInRange]);

  const dayLabel = useMemo(() => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const prefix = isToday ? '今天' : isTomorrow ? '明天' : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return `${prefix} · ${d.getMonth() + 1}月${d.getDate()}日`;
  }, [date]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 日期头部 */}
      <div className={cn(
        'shrink-0 px-4 py-3 border-b',
        isToday ? 'bg-amber-50' : 'bg-background'
      )}>
        <h2 className="text-lg font-semibold">{dayLabel}</h2>
        {allDayEvents.length > 0 && (
          <div className="mt-2 space-y-1">
            {allDayEvents.map((ev) => (
              <button
                key={ev.instanceId}
                className={cn(
                  'text-xs px-2 py-1 rounded truncate w-full text-left',
                  ev.status === 'cancelled' && 'opacity-40 line-through'
                )}
                style={{ backgroundColor: getColorBg(ev.color), color: '#fff' }}
                onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
              >
                {ev.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 时间轴 */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative min-h-[960px] bg-background" onClick={() => onCellClick(date)}>
          {HOURS.map((h) => (
            <div key={h} className="flex h-16 border-b border-dashed border-border/40">
              <div className="w-14 shrink-0 text-right pr-2 pt-1">
                <span className="text-[10px] text-muted-foreground">{String(h).padStart(2, '0')}:00</span>
              </div>
              <div className="flex-1" />
            </div>
          ))}

          {/* 事件块 */}
          {events.map((ev) => {
            const startH = new Date(ev.startTime).getHours() + new Date(ev.startTime).getMinutes() / 60;
            const endH = new Date(ev.endTime).getHours() + new Date(ev.endTime).getMinutes() / 60;
            const top = startH * 64; // 64px per hour
            const height = Math.max((endH - startH) * 64, 20);

            return (
              <button
                key={ev.instanceId}
                className={cn(
                  'absolute left-16 right-2 text-xs px-2 py-1 rounded text-left overflow-hidden shadow-sm transition-opacity hover:opacity-90',
                  ev.status === 'cancelled' && 'opacity-40 line-through'
                )}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: getColorBg(ev.color),
                  color: '#fff',
                }}
                onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
              >
                <div className="font-medium truncate">{ev.title}</div>
                {height > 32 && (
                  <div className="text-[10px] opacity-80">
                    {fmtTime(ev.startTime)} - {fmtTime(ev.endTime)}
                    {ev.location && ` · ${ev.location}`}
                  </div>
                )}
                {height > 48 && ev.description && (
                  <div className="text-[10px] opacity-70 mt-0.5 truncate">{ev.description}</div>
                )}
              </button>
            );
          })}
        </div>
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
