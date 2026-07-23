'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCalendarStore } from '@/lib/store/calendar';
import { cn } from '@/lib/utils';

/** 今日 upcoming 小部件 */
export default function UpcomingEvents() {
  const [mounted, setMounted] = useState(false);
  const { getUpcomingEvents, calendars } = useCalendarStore();
  const upcoming = useMemo(() => getUpcomingEvents(5), [getUpcomingEvents]);

  useEffect(() => setMounted(true), []);

  if (!mounted || upcoming.length === 0) return null;

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
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cal?.color || 'bg-surface-3')} />
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
