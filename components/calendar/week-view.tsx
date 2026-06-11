'use client';

import { useMemo } from 'react';
import { useCalendarStore, type EventInstance, fmtTime, fmtDateCN, getWeekRange } from '@/lib/store/calendar';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  date: Date;
  todayMs: number;
  onEventClick: (instance: EventInstance) => void;
  onCellClick: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekView({ date, todayMs, onEventClick, onCellClick }: WeekViewProps) {
  const getEventsInRange = useCalendarStore((s) => s.getEventsInRange);
  // 订阅原始 events / calendars, 否则新增事件/切换可见性时 useMemo 不会重算。
  const allEvents = useCalendarStore((s) => s.events);
  const allCalendars = useCalendarStore((s) => s.calendars);

  const { days, events } = useMemo(() => {
    const { start, end } = getWeekRange(date);
    const days: { label: string; dateMs: number; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        dateMs: d.getTime(),
        isToday: d.getTime() === todayMs,
      });
    }
    const events = getEventsInRange(start, end);
    return { days, events };
  }, [date, todayMs, getEventsInRange, allEvents, allCalendars]);

  // 按天分组
  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventInstance[]>();
    for (const ev of events) {
      const dayStart = new Date(ev.startTime).setHours(0, 0, 0, 0);
      const arr = map.get(dayStart) ?? [];
      arr.push(ev);
      map.set(dayStart, arr);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 头部 */}
      <div className="grid grid-cols-8 gap-px border-b bg-border shrink-0">
        <div className="bg-background py-2 px-2 text-caption text-muted-foreground" /> {/* 时间列 */}
        {days.map((d) => (
          <div
            key={d.dateMs}
            className={cn(
              'bg-background py-2 text-center text-caption font-medium',
              d.isToday && 'bg-warning/5 border-warning/10 text-warning'
            )}
          >
            {d.label}
          </div>
        ))}
      </div>

      {/* 时间网格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8 gap-px bg-border min-h-[960px]">
          {/* 时间标签列 */}
          <div className="bg-background">
            {HOURS.map((h) => (
              <div key={h} className="h-10 border-b border-transparent flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[10px] text-muted-foreground">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* 7 天列 */}
          {days.map((d) => {
            const dayEvents = (eventsByDay.get(d.dateMs) ?? [])
              .filter((e) => !e.isAllDay)
              .sort((a, b) => a.startTime - b.startTime);
            const allDayEvents = (eventsByDay.get(d.dateMs) ?? []).filter((e) => e.isAllDay);

            return (
              <div
                key={d.dateMs}
                className={cn(
                  'bg-background relative cursor-pointer hover:bg-muted/20',
                  d.isToday && 'bg-warning/[0.03] border-warning/10'
                )}
                onClick={() => onCellClick(new Date(d.dateMs))}
              >
                {/* 全天事件 */}
                {allDayEvents.length > 0 && (
                  <div className="space-y-0.5 p-0.5 border-b min-h-[20px]">
                    {allDayEvents.map((ev) => (
                      <button
                        key={ev.instanceId}
                        className={cn(
                          'w-full text-[9px] px-1 py-0.5 rounded truncate text-left',
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

                {/* 小时网格 + 事件 */}
                <div className="relative">
                  {HOURS.map((h) => (
                    <div key={h} className="h-10 border-b border-dashed border-border/50" />
                  ))}

                  {/* 事件块 */}
                  {dayEvents.map((ev) => {
                    const startH = new Date(ev.startTime).getHours() + new Date(ev.startTime).getMinutes() / 60;
                    const endH = new Date(ev.endTime).getHours() + new Date(ev.endTime).getMinutes() / 60;
                    const top = startH * 40; // 40px per hour
                    const height = Math.max((endH - startH) * 40, 16);

                    return (
                      <button
                        key={ev.instanceId}
                        className={cn(
                          'absolute left-0.5 right-0.5 text-[10px] px-1.5 py-0.5 rounded text-left overflow-hidden leading-tight transition-opacity hover:opacity-90',
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
                        {height > 24 && (
                          <div className="text-[9px] opacity-80 truncate">
                            {fmtTime(ev.startTime)} - {fmtTime(ev.endTime)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
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
    ['bg-' + 'amber-500']: '#f59e0b',
    'bg-rose-500': '#f43f5e',
    'bg-cyan-500': '#06b6d4',
    'bg-slate-400': '#94a3b8',
  };
  return map[twClass] || '#94a3b8';
}
