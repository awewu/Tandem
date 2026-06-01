/**
 * lib/store/calendar.ts · 日程中心 (Tandem Calendar v2)
 *
 * 对标 Apple Calendar：
 *   - 多日历（个人/团队/OKR 同步/外部）
 *   - 月/周/日三视图
 *   - 事件 CRUD + 重复规则 + 提醒
 *   - 与 OKR/议事室/IM 自动联动
 *
 * persist key: 铁山-calendar-store (version 1)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

export type CalendarType = 'personal' | 'team' | 'okr_sync' | 'external';

export interface TandemCalendar {
  id: string;
  name: string;
  type: CalendarType;
  color: string; // tailwind bg class, e.g. 'bg-blue-500'
  ownerId: string;
  memberIds?: string[]; // 共享成员 (team 类型)
  isVisible: boolean; // 侧边栏勾选显示/隐藏
  createdAt: number;
  updatedAt: number;
}

export type EventType = 'meeting' | 'task' | 'reminder' | 'okr_due' | 'cycle' | 'checkin' | 'custom';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // 每 N 个 frequency
  endDate?: number; // 重复截止日期
  count?: number; // 最大重复次数
  byDay?: number[]; // 周几重复 [0=日, 1=一...]
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  recurrence?: RecurrenceRule;
  reminders?: { minutesBefore: number }[];
  type: EventType;
  color?: string; // 覆盖日历颜色
  // 参会人 (邮箱列表, meeting 类型用)
  attendees?: string[];
  // 系统关联
  linkedObjectiveId?: string;
  linkedKrId?: string;
  linkedConvergenceId?: string;
  linkedMeetingId?: string;
  // 创建信息
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  status: EventStatus;
  // 外部同步标记
  externalSource?: string; // e.g. 'google', 'outlook'
  externalId?: string;
}

// 虚拟展开后的单个实例（用于渲染）
export interface EventInstance {
  instanceId: string; // `${eventId}#${startTime}`
  eventId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  type: EventType;
  color: string;
  calendarId: string;
  recurrence?: RecurrenceRule;
  attendees?: string[];
  linkedObjectiveId?: string;
  linkedKrId?: string;
  linkedConvergenceId?: string;
  linkedMeetingId?: string;
  status: EventStatus;
  reminders?: { minutesBefore: number }[];
}

// ═══════════════════════════════════════════════════════════
// Store 接口
// ═══════════════════════════════════════════════════════════

interface CalendarStore {
  calendars: TandemCalendar[];
  events: CalendarEvent[];

  // Calendar CRUD
  addCalendar: (c: Omit<TandemCalendar, 'id' | 'createdAt' | 'updatedAt'>) => TandemCalendar;
  updateCalendar: (id: string, patch: Partial<TandemCalendar>) => void;
  deleteCalendar: (id: string) => void;
  toggleCalendarVisibility: (id: string) => void;

  // Event CRUD
  addEvent: (e: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => CalendarEvent;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  duplicateEvent: (id: string) => CalendarEvent | null;

  // 查询
  getEventsInRange: (start: number, end: number) => EventInstance[];
  getEventsByDay: (dateMs: number) => EventInstance[];
  getUpcomingEvents: (limit?: number) => EventInstance[];
}

// ═══════════════════════════════════════════════════════════
// 默认数据
// ═══════════════════════════════════════════════════════════

const _now = () => Date.now();

function defaultCalendars(): TandemCalendar[] {
  const now = _now();
  return [
    {
      id: 'cal-personal',
      name: '我的日程',
      type: 'personal',
      color: 'bg-blue-500',
      ownerId: 'me',
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cal-okr',
      name: 'OKR 同步',
      type: 'okr_sync',
      color: 'bg-emerald-500',
      ownerId: 'me',
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cal-meetings',
      name: '会议',
      type: 'team',
      color: 'bg-violet-500',
      ownerId: 'me',
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ═══════════════════════════════════════════════════════════
// 重复事件展开引擎
// ═══════════════════════════════════════════════════════════

function expandRecurrence(
  event: CalendarEvent,
  rangeStart: number,
  rangeEnd: number
): EventInstance[] {
  if (!event.recurrence) {
    if (event.startTime >= rangeStart && event.startTime <= rangeEnd) {
      return [toInstance(event, event.startTime)];
    }
    return [];
  }

  const { frequency, interval, endDate, count, byDay } = event.recurrence;
  const instances: EventInstance[] = [];
  const duration = event.endTime - event.startTime;

  let current = event.startTime;
  let instanceCount = 0;
  const maxEnd = Math.min(rangeEnd, endDate ?? Infinity);

  // 先找到 rangeStart 之后的第一个实例
  while (current < rangeStart) {
    current = nextOccurrence(current, frequency, interval, byDay);
    if (current > maxEnd || (count && instanceCount >= count)) break;
  }

  while (current <= maxEnd && (!count || instanceCount < count)) {
    if (current >= rangeStart) {
      instances.push(toInstance(event, current, duration));
      instanceCount++;
    }
    current = nextOccurrence(current, frequency, interval, byDay);
  }

  return instances;
}

function nextOccurrence(
  current: number,
  frequency: RecurrenceRule['frequency'],
  interval: number,
  byDay?: number[]
): number {
  const d = new Date(current);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      if (byDay && byDay.length > 0) {
        // 找到下一个匹配的星期几
        const currentDay = d.getDay();
        let daysAhead = 1;
        while (daysAhead <= 7) {
          const checkDay = (currentDay + daysAhead) % 7;
          if (byDay.includes(checkDay)) {
            d.setDate(d.getDate() + daysAhead);
            break;
          }
          daysAhead++;
        }
      } else {
        d.setDate(d.getDate() + interval * 7);
      }
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval);
      break;
  }
  return d.getTime();
}

function toInstance(
  event: CalendarEvent,
  startTime: number,
  duration?: number
): EventInstance {
  const dur = duration ?? (event.endTime - event.startTime);
  const calColor = event.color || 'bg-slate-400';
  return {
    instanceId: `${event.id}#${startTime}`,
    eventId: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime,
    endTime: startTime + dur,
    isAllDay: event.isAllDay,
    type: event.type,
    color: calColor,
    calendarId: event.calendarId,
    recurrence: event.recurrence,
    attendees: event.attendees,
    linkedObjectiveId: event.linkedObjectiveId,
    linkedKrId: event.linkedKrId,
    linkedConvergenceId: event.linkedConvergenceId,
    linkedMeetingId: event.linkedMeetingId,
    status: event.status,
    reminders: event.reminders,
  };
}

// ═══════════════════════════════════════════════════════════
// Zustand Store
// ═══════════════════════════════════════════════════════════

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      calendars: defaultCalendars(),
      events: [],

      // ===== Calendar =====
      addCalendar: (c) => {
        const now = _now();
        const cal: TandemCalendar = {
          id: crypto.randomUUID(),
          ...c,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ calendars: [...s.calendars, cal] }));
        return cal;
      },
      updateCalendar: (id, patch) =>
        set((s) => ({
          calendars: s.calendars.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: _now() } : c
          ),
        })),
      deleteCalendar: (id) =>
        set((s) => ({
          calendars: s.calendars.filter((c) => c.id !== id),
          events: s.events.filter((e) => e.calendarId !== id),
        })),
      toggleCalendarVisibility: (id) =>
        set((s) => ({
          calendars: s.calendars.map((c) =>
            c.id === id ? { ...c, isVisible: !c.isVisible } : c
          ),
        })),

      // ===== Event =====
      addEvent: (e) => {
        const now = _now();
        const event: CalendarEvent = {
          id: crypto.randomUUID(),
          ...e,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ events: [...s.events, event] }));
        return event;
      },
      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: _now() } : e
          ),
        })),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      duplicateEvent: (id) => {
        const original = get().events.find((e) => e.id === id);
        if (!original) return null;
        const now = _now();
        const copy: CalendarEvent = {
          ...original,
          id: crypto.randomUUID(),
          title: `${original.title} (副本)`,
          startTime: original.startTime + 24 * 60 * 60 * 1000, // +1 day
          endTime: original.endTime + 24 * 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ events: [...s.events, copy] }));
        return copy;
      },

      // ===== 查询 =====
      getEventsInRange: (start, end) => {
        const visibleCalIds = new Set(
          get().calendars.filter((c) => c.isVisible).map((c) => c.id)
        );
        const events = get().events.filter(
          (e) => visibleCalIds.has(e.calendarId) && e.status !== 'cancelled'
        );
        const instances: EventInstance[] = [];
        for (const ev of events) {
          instances.push(...expandRecurrence(ev, start, end));
        }
        return instances.sort((a, b) => a.startTime - b.startTime);
      },

      getEventsByDay: (dateMs) => {
        const startOfDay = new Date(dateMs).setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateMs).setHours(23, 59, 59, 999);
        return get().getEventsInRange(startOfDay, endOfDay);
      },

      getUpcomingEvents: (limit = 10) => {
        const now = _now();
        const dayEnd = new Date(now).setHours(23, 59, 59, 999);
        return get().getEventsInRange(now, dayEnd + 7 * 24 * 60 * 60 * 1000).slice(0, limit);
      },
    }),
    {
      name: '铁山-calendar-store',
      version: 1,
    }
  )
);

// ═══════════════════════════════════════════════════════════
// 工具函数 (纯函数, 供 UI 使用)
// ═══════════════════════════════════════════════════════════

/** 获取某月第一天和最后一天 */
export function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

/** 获取某周范围 (周一为首) */
export function getWeekRange(date: Date) {
  const day = date.getDay(); // 0=日, 1=一...
  const diff = day === 0 ? -6 : 1 - day; // 周一为第一天
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.getTime(), end: sunday.getTime() };
}

/** 获取某天的 0 点和 23:59 */
export function getDayRange(date: Date) {
  const start = new Date(date).setHours(0, 0, 0, 0);
  const end = new Date(date).setHours(23, 59, 59, 999);
  return { start, end };
}

/** 格式化时间 HH:MM */
export function fmtTime(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 格式化日期 YYYY-MM-DD */
export function fmtDate(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 格式化日期 YYYY年M月D日 */
export function fmtDateCN(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 格式化日期 YYYY年M月 */
export function fmtMonthCN(year: number, month: number) {
  return `${year}年${month + 1}月`;
}

/** 格式化时长 */
export function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}

/** 获取 type 对应的显示名 */
export function eventTypeLabel(type: EventType): string {
  const map: Record<EventType, string> = {
    meeting: '会议',
    task: '任务',
    reminder: '提醒',
    okr_due: 'KR截止',
    cycle: '周期',
    checkin: 'Check-in',
    custom: '自定义',
  };
  return map[type] || '事件';
}

/** type 对应的 lucide 颜色类 */
export function eventTypeColor(type: EventType): string {
  const map: Record<EventType, string> = {
    meeting: 'bg-blue-500',
    task: 'bg-amber-500',
    reminder: 'bg-rose-500',
    okr_due: 'bg-emerald-500',
    cycle: 'bg-violet-500',
    checkin: 'bg-slate-400',
    custom: 'bg-cyan-500',
  };
  return map[type];
}
