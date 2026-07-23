import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UpcomingEvents from '@/components/calendar/upcoming-events';
import { useCalendarStore, type CalendarEvent, type TandemCalendar } from '@/lib/store/calendar';

const NOW = new Date('2026-07-16T09:00:00+08:00').getTime();

const calendar: TandemCalendar = {
  id: 'cal-personal',
  name: '我的日程',
  type: 'personal',
  color: 'bg-blue-500',
  ownerId: 'user-1',
  isVisible: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const event: CalendarEvent = {
  id: 'event-1',
  calendarId: calendar.id,
  title: '客户端持久化日程',
  startTime: NOW + 60 * 60 * 1000,
  endTime: NOW + 2 * 60 * 60 * 1000,
  isAllDay: false,
  type: 'meeting',
  createdBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
  status: 'confirmed',
};

describe('calendar upcoming events hydration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useCalendarStore.setState({ calendars: [calendar], events: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    useCalendarStore.setState({ events: [] });
  });

  it('keeps the server and initial client markup identical before mount', () => {
    const serverMarkup = renderToStaticMarkup(React.createElement(UpcomingEvents));

    useCalendarStore.setState({ events: [event] });
    const clientInitialMarkup = renderToStaticMarkup(React.createElement(UpcomingEvents));

    expect(serverMarkup).toBe('');
    expect(clientInitialMarkup).toBe(serverMarkup);
  });

  it('does not hang when legacy persisted recurrence data has an invalid interval', () => {
    useCalendarStore.setState({
      calendars: [calendar],
      events: [{
        ...event,
        id: 'legacy-bad-recurrence',
        recurrence: { frequency: 'daily', interval: 0 },
      }],
    });

    const instances = useCalendarStore.getState().getEventsInRange(
      NOW,
      NOW + 24 * 60 * 60 * 1000,
    );

    expect(instances).toHaveLength(1);
    expect(instances[0].eventId).toBe('legacy-bad-recurrence');
  });

  it('replaces generated OKR calendar events in one store update and removes stale duplicates', () => {
    useCalendarStore.setState({
      calendars: [calendar, {
        id: 'cal-okr',
        name: 'OKR 同步',
        type: 'okr_sync',
        color: 'bg-success',
        ownerId: 'user-1',
        isVisible: true,
        createdAt: NOW,
        updatedAt: NOW,
      }],
      events: [
        event,
        {
          ...event,
          id: 'old-okr-1',
          calendarId: 'cal-okr',
          title: '旧 OKR Check-in',
          type: 'checkin',
        },
        {
          ...event,
          id: 'old-okr-2',
          calendarId: 'cal-okr',
          title: '重复旧 OKR Check-in',
          type: 'checkin',
        },
      ],
    });

    useCalendarStore.getState().replaceOkrEvents([{
      calendarId: 'cal-okr',
      title: '新的 OKR Check-in',
      startTime: NOW,
      endTime: NOW + 30 * 60 * 1000,
      isAllDay: false,
      type: 'checkin',
      createdBy: 'system',
      status: 'confirmed',
    }]);

    const state = useCalendarStore.getState();
    expect(state.events.filter((item) => item.calendarId === 'cal-okr')).toHaveLength(1);
    expect(state.events.find((item) => item.calendarId === 'cal-okr')?.title).toBe('新的 OKR Check-in');
    expect(state.events.some((item) => item.id === event.id)).toBe(true);
  });
});
