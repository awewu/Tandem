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
});
