'use client';

/**
 * /calendar — Tandem 日程中心 v2 (对标 Apple Calendar)
 *
 * 三视图: 月 / 周 / 日
 * 功能: 事件 CRUD · 重复规则 · 提醒 · 多日历管理
 * 集成: OKR due / Check-in / Cycle 自动同步 (cal-okr)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useCalendarStore, type CalendarEvent, type EventInstance, fmtMonthCN } from '@/lib/store/calendar';
import { useOKRStore } from '@/lib/store/okr';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { useCurrentUser, useCurrentUserId } from '@/lib/hooks/use-current-user';
import { fetchWithTimeout, isRequestTimeoutError } from '@/lib/http/fetch-with-timeout';
import { buildCurrentOkrOwnerIds, buildOkrCalendarEvents } from '@/lib/calendar/okr-calendar-events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, Wand2,
  LayoutGrid, Columns3, List, Eye, EyeOff,
  ShieldCheck, MessageSquare, History, RefreshCw, PanelLeft,
  KeyRound, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MonthView from '@/components/calendar/month-view';
import WeekView from '@/components/calendar/week-view';
import DayView from '@/components/calendar/day-view';
import EventEditor from '@/components/calendar/event-editor';
import CalendarSubscriptionPanel from '@/components/calendar/subscription-panel';
import UpcomingEvents from '@/components/calendar/upcoming-events';

type ViewMode = 'month' | 'week' | 'day';
type LeaveScope = 'single' | 'series';

const CALENDAR_REQUEST_TIMEOUT_MS = 15_000;
const CALENDAR_SYNC_TIMEOUT_MS = 45_000;
const ACTIVITY_PAGE_SIZE = 10;

interface CalendarActivityItem {
  id: string;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  action: string;
  targetType: 'event' | 'subscription';
  targetId: string;
  eventId?: string;
  eventTitle?: string;
  scope?: 'single' | 'future' | 'series';
  attendeeEmails?: string[];
  attendeeUsers?: Array<{ id: string; name: string; email: string }>;
  targetUserId?: string;
  subscriberId?: string;
  detailPermission?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

interface ImReminderMeeting {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  meetingUrl?: string | null;
  status: string;
  ownerId: string;
  organizer?: { id: string; name: string; email: string };
  attendeeUsers?: Array<{ id: string; name: string; email: string }>;
  hasConflict?: boolean;
}

interface NeteaseCalendarSyncStatus {
  configured: boolean;
  account?: string | null;
  autoEnabled: boolean;
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  lastSyncAt?: string | null;
  lastAttemptAt?: string | null;
  lastManualSyncAt?: string | null;
  lastError?: string | null;
  lastResult?: {
    source: string;
    total?: number;
    created: number;
    updated: number;
    skipped: number;
    cancelled?: number;
  } | null;
}

export default function CalendarPage() {
  const {
    calendars, events, toggleCalendarVisibility, replaceManagedEvents, replaceOkrEvents, deleteEvent,
  } = useCalendarStore();
  const { user } = useCurrentUser();
  const legacyCurrentUserId = useCurrentUserId();
  const { cycles, keyResults, checkIns, objectives } = useOKRStore();
  const { nameOf } = useOwnerDirectory();

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
  const [subscribedTargetId, setSubscribedTargetId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityItems, setActivityItems] = useState<CalendarActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [imReminderOpen, setImReminderOpen] = useState(false);
  const [imReminderEventId, setImReminderEventId] = useState('');
  const [imReminderSending, setImReminderSending] = useState(false);
  const [imReminderLoading, setImReminderLoading] = useState(false);
  const [imReminderError, setImReminderError] = useState('');
  const [imReminderResult, setImReminderResult] = useState<{ channelId: string; channelName: string; reused: boolean } | null>(null);
  const [imReminderMeetings, setImReminderMeetings] = useState<ImReminderMeeting[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [neteaseSyncing, setNeteaseSyncing] = useState(false);
  const [neteaseSyncError, setNeteaseSyncError] = useState('');
  const [neteaseCredentialGuideOpen, setNeteaseCredentialGuideOpen] = useState(false);
  const [neteaseSyncStatus, setNeteaseSyncStatus] = useState<NeteaseCalendarSyncStatus | null>(null);
  const [leaveDialog, setLeaveDialog] = useState<{ event: CalendarEvent; detail: string } | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const primaryCalendars = useMemo(() => calendars.filter((calendar) => calendar.id !== 'cal-subscribed'), [calendars]);
  const subscribedCalendar = useMemo(() => calendars.find((calendar) => calendar.id === 'cal-subscribed'), [calendars]);
  const neteaseSubscribedCalendarNames = useMemo(() => {
    const names = events
      .filter((event) => event.status !== 'cancelled')
      .map((event) => extractNeteaseSourceCalendarName(event.description))
      .filter((name): name is string => Boolean(name))
      .map(formatSubscribedCalendarOwnerName);
    return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [events]);
  const currentOkrOwnerIds = useMemo(() => buildCurrentOkrOwnerIds({
    legacyCurrentUserId,
    authUserId: user?.id,
    authEmail: user?.email,
  }), [legacyCurrentUserId, user?.email, user?.id]);

  // 初始化
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayMs(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  }, []);

  const refreshManagedEvents = useCallback(async () => {
    if (!user?.id) return;
    const ownResponse = await fetchWithTimeout('/api/calendar', { credentials: 'include', cache: 'no-store' }, CALENDAR_REQUEST_TIMEOUT_MS);
    if (!ownResponse.ok) return;
    const ownData = await ownResponse.json().catch(() => ({}));
    let managed = mapApiEvents(ownData.events ?? [], 'cal-personal', 'own');
    if (subscribedTargetId) {
      const subscribedResponse = await fetchWithTimeout(`/api/calendar?ownerId=${encodeURIComponent(subscribedTargetId)}`, { credentials: 'include', cache: 'no-store' }, CALENDAR_REQUEST_TIMEOUT_MS);
      if (subscribedResponse.ok) {
        const subscribedData = await subscribedResponse.json().catch(() => ({}));
        managed = [...managed, ...mapApiEvents(subscribedData.events ?? [], 'cal-subscribed', 'subscribed')];
      }
    }
    replaceManagedEvents(managed);
  }, [replaceManagedEvents, subscribedTargetId, user?.id]);

  useEffect(() => {
    void refreshManagedEvents().catch(() => undefined);
  }, [refreshManagedEvents]);

  const loadNeteaseSyncStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetchWithTimeout(
        '/api/calendar/sync/netease',
        { credentials: 'include', cache: 'no-store' },
        CALENDAR_REQUEST_TIMEOUT_MS,
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) setNeteaseSyncStatus(data);
    } catch {
      // 保留最近一次状态，不打扰主日历使用。
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNeteaseSyncStatus();
  }, [loadNeteaseSyncStatus]);

  const loadActivity = useCallback(async (page = activityPage) => {
    if (!user?.id) return;
    setActivityLoading(true);
    setActivityError('');
    try {
      const response = await fetchWithTimeout(
        `/api/calendar/activity?page=${page}&pageSize=${ACTIVITY_PAGE_SIZE}`,
        { credentials: 'include', cache: 'no-store' },
        CALENDAR_REQUEST_TIMEOUT_MS,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '日程记录读取失败');
      setActivityItems(Array.isArray(data.items) ? data.items : []);
      setActivityTotal(Number(data.total ?? 0));
      setActivityPage(Number(data.page ?? page));
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : '日程记录读取失败');
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, user?.id]);

  useEffect(() => {
    if (activityOpen) void loadActivity(activityPage);
  }, [activityOpen, activityPage, loadActivity]);

  useEffect(() => {
    const refreshOnFocus = () => void refreshManagedEvents().catch(() => undefined);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshManagedEvents().catch(() => undefined);
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshManagedEvents]);

  // 提醒轮询只触发站内通知任务，不发送提醒邮件。
  useEffect(() => {
    if (!user?.id) return;
    const processReminders = () => fetch('/api/calendar/reminders/process', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
    void processReminders();
    const timer = setInterval(processReminders, 60_000);
    return () => clearInterval(timer);
  }, [user?.id]);

  // 自动同步 OKR 数据 → CalendarEvent (cal-okr)
  useEffect(() => {
    if (year === 0) return;
    replaceOkrEvents(buildOkrCalendarEvents({
      cycles,
      objectives,
      keyResults,
      checkIns,
      currentOwnerIds: currentOkrOwnerIds,
      nameOf,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, keyResults, checkIns, objectives, nameOf, year, currentOkrOwnerIds, replaceOkrEvents]);

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

  useEffect(() => {
    if (!imReminderOpen) return;
    if (imReminderMeetings.length === 0) {
      if (imReminderEventId) setImReminderEventId('');
      return;
    }
    if (!imReminderMeetings.some((event) => event.id === imReminderEventId)) {
      setImReminderEventId(imReminderMeetings[0].id);
    }
  }, [imReminderEventId, imReminderMeetings, imReminderOpen]);

  const handleEventClick = (instance: EventInstance) => {
    const event = events.find((item) => item.id === instance.eventId);
    if (event?.serverManaged && event.createdBy !== user?.id) {
      const isAttendee = isCurrentUserEventAttendee(event, user);
      const detail = [
        event.title,
        `${new Date(event.startTime).toLocaleString('zh-CN')} - ${new Date(event.endTime).toLocaleString('zh-CN')}`,
        event.location,
        event.description,
        event.attendeeEmails?.length ? `参会人: ${formatEventAttendees(event)}` : '',
        event.organizer ? `发起人: ${formatPerson(event.organizer.name, event.organizer.email)}` : `发起人: ${event.createdBy}`,
        event.reminders?.length ? `提醒: ${describeReminder(event.reminders[0].minutesBefore)}` : '提醒: 无',
        event.recurrenceRule ? `重复: ${describeRecurrence(event.recurrenceRule)}` : '重复: 不重复',
        event.hasConflict ? '时间冲突' : '',
      ].filter(Boolean).join('\n');
      if (isAttendee && isRecurringCalendarEvent(event)) {
        setLeaveDialog({ event, detail });
      } else if (isAttendee && confirm(`${detail}\n\n你是参会人，是否退出这个日程？`)) {
        void handleLeaveEvent(event, 'single');
      } else if (!isAttendee) {
        alert(detail);
      }
      return;
    }
    setEditorEventId(instance.eventId);
    setEditorDate(undefined);
    setEditorOpen(true);
  };

  async function handleLeaveEvent(event: CalendarEvent, scope: LeaveScope) {
    setLeaveBusy(true);
    removeLeftEventLocally(event, scope);
    setLeaveDialog(null);
    setLeaveBusy(false);
    try {
      const response = await fetch(`/api/calendar/${event.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'leave', scope, async: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '退出日程失败');
      void refreshManagedEvents().catch(() => undefined);
    } catch (error) {
      void refreshManagedEvents().catch(() => undefined);
      alert(error instanceof Error ? error.message : '退出日程失败');
    }
  }

  function removeLeftEventLocally(event: CalendarEvent, scope: LeaveScope) {
    if (scope === 'series' && event.seriesId) {
      events
        .filter((item) => item.seriesId === event.seriesId)
        .forEach((item) => deleteEvent(item.id));
      return;
    }
    deleteEvent(event.id);
  }

  const handleCellClick = (date: Date) => {
    if (new Date(date).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) return;
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

  const openImReminderDialog = () => {
    setImReminderError('');
    setImReminderResult(null);
    setImReminderEventId('');
    setImReminderOpen(true);
    void loadImReminderMeetings();
  };

  async function loadImReminderMeetings() {
    setImReminderLoading(true);
    setImReminderError('');
    try {
      const response = await fetchWithTimeout('/api/calendar/im-reminder', {
        credentials: 'include',
        cache: 'no-store',
      }, CALENDAR_REQUEST_TIMEOUT_MS);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '可提醒会议读取失败');
      const next = Array.isArray(data.events) ? data.events : [];
      setImReminderMeetings(next);
      setImReminderEventId(next[0]?.id ?? '');
    } catch (error) {
      setImReminderMeetings([]);
      setImReminderEventId('');
      setImReminderError(error instanceof Error ? error.message : '可提醒会议读取失败');
    } finally {
      setImReminderLoading(false);
    }
  }

  async function handleImReminderConfirm() {
    if (!imReminderEventId) {
      setImReminderError('请先选择一个会议');
      return;
    }
    setImReminderSending(true);
    setImReminderError('');
    setImReminderResult(null);
    try {
      const response = await fetchWithTimeout('/api/calendar/im-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId: imReminderEventId }),
      }, CALENDAR_REQUEST_TIMEOUT_MS);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? 'IM 提醒发送失败');
      if (!data.channel?.id) throw new Error('IM 群创建成功但未返回群 ID，请刷新后重试');
      setImReminderResult({
        channelId: data.channel.id,
        channelName: data.channel?.name ?? '会议群',
        reused: data.reused === true,
      });
    } catch (error) {
      setImReminderError(error instanceof Error ? error.message : 'IM 提醒发送失败');
    } finally {
      setImReminderSending(false);
    }
  }

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
        const createResponse = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: json.event.title,
            description: json.event.description,
            startAt: new Date(json.event.startTime).toISOString(),
            endAt: new Date(json.event.endTime).toISOString(),
            location: json.event.location,
            attendeeEmails: Array.isArray(json.event.attendees) ? json.event.attendees : [],
            reminderMinutes: 15,
          }),
        });
        if (!createResponse.ok) {
          const error = await createResponse.json().catch(() => ({}));
          throw new Error(error.error?.message ?? '创建失败');
        }
        await refreshManagedEvents();
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

  async function handleNeteaseSync() {
    if (neteaseSyncing) return;
    setNeteaseSyncing(true);
    setNeteaseSyncError('');
    try {
      const credentialResponse = await fetchWithTimeout(
        '/api/mail/credentials',
        { credentials: 'include', cache: 'no-store' },
        CALENDAR_REQUEST_TIMEOUT_MS,
      );
      const credentialData = await credentialResponse.json().catch(() => ({}));
      if (!credentialResponse.ok || credentialData.configured !== true) {
        setNeteaseCredentialGuideOpen(true);
        return;
      }

      const visibleRange = year > 0
        ? {
            from: new Date(year, month, 1).toISOString(),
            to: new Date(year, month + 1, 1).toISOString(),
          }
        : {};
      const response = await fetchWithTimeout('/api/calendar/sync/netease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(visibleRange),
      }, CALENDAR_SYNC_TIMEOUT_MS);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 428 && typeof data.error?.configureUrl === 'string') {
          setNeteaseCredentialGuideOpen(true);
          return;
        }
        throw new Error(readNeteaseSyncResponseError(data));
      }
      setNeteaseSyncStatus((current) => ({
        configured: true,
        account: current?.account ?? credentialData.smtp?.user ?? null,
        autoEnabled: data.autoEnabled !== false,
        status: 'succeeded',
        lastSyncAt: data.lastSyncAt ?? new Date().toISOString(),
        lastAttemptAt: data.lastSyncAt ?? new Date().toISOString(),
        lastManualSyncAt: data.lastSyncAt ?? new Date().toISOString(),
        lastError: null,
        lastResult: {
          source: String(data.source ?? 'netease'),
          total: Number(data.total ?? 0),
          created: Number(data.created ?? 0),
          updated: Number(data.updated ?? 0),
          skipped: Number(data.skipped ?? 0),
          cancelled: Number(data.cancelled ?? 0),
        },
      }));
      await loadNeteaseSyncStatus();
      await refreshManagedEvents();
    } catch (error) {
      setNeteaseSyncError(formatNeteaseSyncError(error));
    } finally {
      setNeteaseSyncing(false);
    }
  }

  const renderSidebarContent = () => (
    <>
      <div className="p-3 border-b space-y-2">
        <Button
          className="w-full gap-1 bg-brand-500 hover:bg-brand-600 text-white"
          size="sm"
          onClick={() => {
            setMobileSidebarOpen(false);
            handleNewEvent();
          }}
        >
          <Plus className="h-4 w-4" />
          新建事件
        </Button>
        <Button
          variant="outline"
          className="w-full gap-1 text-caption"
          size="sm"
          onClick={() => {
            setMobileSidebarOpen(false);
            const now = new Date();
            now.setMinutes(0, 0, 0);
            now.setHours(now.getHours() + 1);
            const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            void createQuickManagedEvent({
              title: '🔒 深度工作 (Focus Time)',
              startTime: now.getTime(),
              endTime: end.getTime(),
              reminderMinutes: 5,
            });
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
            setMobileSidebarOpen(false);
            openImReminderDialog();
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          IM 提醒参会人
        </Button>
        <Button
          variant="outline"
          className="w-full gap-1 text-caption"
          size="sm"
          onClick={() => {
            setMobileSidebarOpen(false);
            void handleNeteaseSync();
          }}
          disabled={neteaseSyncing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', neteaseSyncing && 'animate-spin')} />
          {neteaseSyncing ? '同步中' : '同步网易日程'}
        </Button>
        <div className="px-1 text-[11px] leading-relaxed text-ink-tertiary">
          {formatNeteaseSyncStatusText(neteaseSyncStatus, neteaseSyncing)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-caption font-semibold text-muted-foreground mb-2 uppercase tracking-wider">我的日历</h3>
        <div className="space-y-1">
          {primaryCalendars.map((cal) => (
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
        {neteaseSubscribedCalendarNames.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-caption font-semibold uppercase tracking-wider text-ink-tertiary">网易订阅日历</h3>
            <div className="space-y-1">
              {neteaseSubscribedCalendarNames.map((name) => {
                const visible = subscribedCalendar?.isVisible ?? true;
                return (
                  <button
                    key={name}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-body transition-colors hover:bg-surface-2"
                    onClick={() => subscribedCalendar && toggleCalendarVisibility(subscribedCalendar.id)}
                  >
                    {visible ? (
                      <Eye className="h-3.5 w-3.5 text-ink-tertiary" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-ink-tertiary" />
                    )}
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
                    <span className={cn('truncate', !visible && 'text-ink-tertiary line-through')}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <UpcomingEvents />
        <CalendarSubscriptionPanel
          currentUserId={user?.id ?? ''}
          selectedTargetId={subscribedTargetId}
          onViewTarget={setSubscribedTargetId}
          onChanged={refreshManagedEvents}
        />
      </div>
    </>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-background">
      {/* 左侧边栏 — 日历列表 + 快速入口 */}
      <aside className="hidden w-56 border-r bg-muted/20 md:flex md:flex-col md:shrink-0">
        {renderSidebarContent()}
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 工具栏 */}
        <div className="shrink-0 border-b px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 md:hidden" onClick={() => setMobileSidebarOpen(true)} title="日历设置">
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                今天
              </Button>
              <Button variant="outline" size="sm" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h1 className="min-w-0 truncate text-title-3 font-semibold sm:ml-2">{monthLabel}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-md bg-muted/30 p-0.5 sm:gap-2 sm:bg-transparent sm:p-0">
              <Button
                variant={view === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                className="h-8 gap-1 px-2 sm:h-9 sm:px-3"
              >
                <LayoutGrid className="h-4 w-4" />
                月
              </Button>
              <Button
                variant={view === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
                className="h-8 gap-1 px-2 sm:h-9 sm:px-3"
              >
                <Columns3 className="h-4 w-4" />
                周
              </Button>
              <Button
                variant={view === 'day' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
                className="h-8 gap-1 px-2 sm:h-9 sm:px-3"
              >
                <List className="h-4 w-4" />
                日
              </Button>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 flex-col gap-2 lg:mt-0 lg:flex-row lg:items-center lg:justify-end">
            {/* 自然语言快速创建 */}
            <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted/30 px-2 py-1">
              <Sparkles className="h-3.5 w-3.5 text-info" />
              <Input
                placeholder="自然语言创建: 明天下午3点跟张伟开会"
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNlpCreate()}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-caption focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-64 sm:flex-none"
              />
              <Button variant="ghost" size="sm" className="h-6 px-2 text-caption" onClick={handleNlpCreate} disabled={nlpBusy}>
                {nlpBusy ? '...' : '创建'}
              </Button>
            </div>

            <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5 sm:gap-2 sm:overflow-visible sm:pb-0">
              <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-caption" onClick={handleSmartTime}>
                <Wand2 className="h-3.5 w-3.5" />
                智能时间
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 text-caption"
                onClick={() => {
                  setActivityPage(1);
                  setActivityOpen(true);
                }}
              >
                <History className="h-3.5 w-3.5" />
                日程记录
              </Button>
            </div>
          </div>
        </div>

        {neteaseSyncError && (
          <div className={cn(
            'shrink-0 border-b px-4 py-2 text-caption',
            'bg-warning/5 text-warning',
          )}>
            {neteaseSyncError}
          </div>
        )}

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
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {smartSuggestions.map((s, i) => (
                <button
                  key={i}
                  className="shrink-0 text-caption px-2.5 py-1.5 rounded-md bg-surface-1 border border-info/30 hover:bg-info/10 transition-colors text-left"
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
              currentUserId={user?.id ?? ''}
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

      <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DialogContent className="max-h-[86vh] w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-sm md:hidden">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>日历设置</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[calc(86vh-56px)] flex-col overflow-hidden bg-muted/20">
            {renderSidebarContent()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={neteaseCredentialGuideOpen} onOpenChange={setNeteaseCredentialGuideOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-title-3">
              <KeyRound className="h-5 w-5 text-[rgb(var(--brand-600))]" />
              需要先配置邮箱账号和密码
            </DialogTitle>
            <DialogDescription>
              网易日程同步会通过你的公司邮箱账号连接 CalDAV，所以首次同步前需要先在邮箱配置页填写个人邮箱地址和密码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-caption text-ink-secondary">
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="font-medium text-ink-primary">配置后会做什么？</p>
              <p className="mt-1">系统会用这组账号密码收取邮件、发送邮件，并同步网易企业邮箱里的日程。配置只需做一次。</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="font-medium text-ink-primary">填什么密码？</p>
              <p className="mt-1">按当前公司邮箱策略，先填写平时登录网易企业邮箱使用的账号和密码。</p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setNeteaseCredentialGuideOpen(false)}>
                稍后再说
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/settings/email?next=/calendar&reason=netease-calendar-sync';
                }}
              >
                <Settings className="mr-1.5 h-4 w-4" />
                去配置邮箱
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EventEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialDate={editorDate}
        editEventId={editorEventId}
        onSaved={refreshManagedEvents}
      />

      <Dialog open={Boolean(leaveDialog)} onOpenChange={(open) => {
        if (!open && !leaveBusy) setLeaveDialog(null);
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>退出日程</DialogTitle>
            <DialogDescription>
              这是一个重复日程，请选择退出范围。
            </DialogDescription>
          </DialogHeader>
          {leaveDialog && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 p-3 text-caption text-ink-secondary whitespace-pre-line">
                {leaveDialog.detail}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLeaveDialog(null)}
                  disabled={leaveBusy}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleLeaveEvent(leaveDialog.event, 'single')}
                  disabled={leaveBusy}
                >
                  仅退出本次
                </Button>
                <Button
                  type="button"
                  className="bg-danger hover:bg-danger/90 text-white"
                  onClick={() => void handleLeaveEvent(leaveDialog.event, 'series')}
                  disabled={leaveBusy}
                >
                  {leaveBusy ? '退出中...' : '退出整个重复日程'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={imReminderOpen} onOpenChange={(open) => {
        setImReminderOpen(open);
        if (!open) {
          setImReminderError('');
          setImReminderResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              IM 提醒参会人
            </DialogTitle>
            <DialogDescription>
              先选择一个你发起或参与的会议，系统会创建或复用会议 IM 群，并发送参会提醒。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {imReminderMeetings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-caption text-muted-foreground">
                {imReminderLoading ? '正在读取可提醒会议...' : '暂无可提醒的会议。已取消会议和订阅他人的日程不会显示在这里。'}
              </div>
            ) : (
              <div className="max-h-[46vh] overflow-y-auto rounded-lg border bg-background">
                <div className="divide-y">
                  {imReminderMeetings.map((event) => {
                    const selected = event.id === imReminderEventId;
                    const internalCount = event.attendeeUsers?.length ?? 0;
                    const startTime = new Date(event.startAt).getTime();
                    const endTime = new Date(event.endAt).getTime();
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={cn(
                          'w-full p-3 text-left transition-colors hover:bg-muted/40',
                          selected && 'bg-brand-50/80',
                        )}
                        onClick={() => {
                          setImReminderEventId(event.id);
                          setImReminderError('');
                          setImReminderResult(null);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            'mt-1 h-3.5 w-3.5 rounded-full border',
                            selected ? 'border-brand-500 bg-brand-500 shadow-[inset_0_0_0_3px_white]' : 'border-muted-foreground/40',
                          )} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{event.title}</span>
                              {event.hasConflict && (
                                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                                  时间冲突
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-caption text-muted-foreground">
                              {new Date(startTime).toLocaleString('zh-CN')} - {new Date(endTime).toLocaleString('zh-CN')}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              地点/会议方式：{event.location || event.meetingUrl || '未填写'} · 系统内参会人：{internalCount} 人
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {imReminderError && (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
                {imReminderError}
              </div>
            )}
            {imReminderResult && (
              <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-caption text-brand-700">
                已{imReminderResult.reused ? '复用' : '创建'} IM 群「{imReminderResult.channelName}」，并发送参会提醒。
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {imReminderResult?.channelId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/im?ch=${encodeURIComponent(imReminderResult.channelId)}`;
                  }}
                >
                  打开 IM 群
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setImReminderOpen(false)}>
                关闭
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-brand-500 hover:bg-brand-600 text-white"
                disabled={imReminderSending || imReminderMeetings.length === 0}
                onClick={handleImReminderConfirm}
              >
                {imReminderSending ? '发送中...' : '确认提醒'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-8rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[82vh] sm:max-w-3xl">
          <DialogHeader className="shrink-0 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              日程记录
            </DialogTitle>
            <DialogDescription>
              记录创建、修改、取消和订阅动作；可用来对照邮件实际到达时间。
            </DialogDescription>
          </DialogHeader>

          <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-3 sm:px-6">
            <div className="text-caption text-muted-foreground">
              共 {activityTotal} 条 · 第 {activityPage}/{Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE))} 页
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadActivity(activityPage)} disabled={activityLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', activityLoading && 'animate-spin')} />
              刷新
            </Button>
          </div>

          {activityError && (
            <div className="mx-5 mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger sm:mx-6">
              {activityError}
            </div>
          )}

          <div className="mx-5 min-h-0 flex-1 overflow-y-auto rounded-lg border sm:mx-6">
            {activityLoading && activityItems.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-caption text-muted-foreground">读取中...</div>
            ) : activityItems.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-caption text-muted-foreground">暂无日程记录</div>
            ) : (
              <div className="divide-y">
                {activityItems.map((item) => (
                  <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                            {activityActionLabel(item.action)}
                          </span>
                          {item.scope && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {activityScopeLabel(item.scope)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-medium truncate">
                          {activityTitle(item)}
                        </div>
                        <div className="mt-1 text-caption text-muted-foreground">
                          操作人：{formatActivityActor(item)}
                        </div>
                        {item.attendeeEmails?.length ? (
                          <div className="mt-1 break-words text-[11px] text-muted-foreground">
                            参会人：{formatActivityAttendees(item)}
                          </div>
                        ) : null}
                        {(item.subscriberId || item.targetUserId) && (
                          <div className="mt-1 text-[11px] text-muted-foreground truncate">
                            订阅人：{item.subscriberId || '-'} · 被订阅人：{item.targetUserId || '-'}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-caption text-muted-foreground">
                        <div>{formatActivityTime(item.occurredAt)}</div>
                        <div className="text-[11px]">{new Date(item.occurredAt).toLocaleTimeString('zh-CN')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex shrink-0 items-center justify-between border-t bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={activityLoading || activityPage <= 1}
              onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </Button>
            <div className="text-caption text-muted-foreground">
              每页 {ACTIVITY_PAGE_SIZE} 条
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={activityLoading || activityPage >= Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE))}
              onClick={() => setActivityPage((page) => page + 1)}
            >
              下一页
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function createQuickManagedEvent(input: { title: string; startTime: number; endTime: number; reminderMinutes: number }) {
    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: input.title,
        startAt: new Date(input.startTime).toISOString(),
        endAt: new Date(input.endTime).toISOString(),
        reminderMinutes: input.reminderMinutes,
      }),
    });
    if (response.ok) await refreshManagedEvents();
  }
}

function mapApiEvents(events: Array<Record<string, any>>, calendarId: string, sourceKind: 'own' | 'subscribed'): CalendarEvent[] {
  const meetingSeriesIds = new Set(
    events
      .filter((event) => event.seriesId && isApiMeetingEvent(event))
      .map((event) => String(event.seriesId)),
  );
  return events.map((event) => {
    const attendeeEmails = Array.isArray(event.attendeeEmails) ? event.attendeeEmails : [];
    const attendeeUsers = Array.isArray(event.attendeeUsers) ? event.attendeeUsers : [];
    const isMeeting = isApiMeetingEvent(event) || Boolean(event.seriesId && meetingSeriesIds.has(String(event.seriesId)));
    const mappedSourceKind = sourceKind === 'own' && isNeteaseSubscribedEvent(event) ? 'subscribed' : sourceKind;
    const mappedCalendarId = mappedSourceKind === 'subscribed'
      ? 'cal-subscribed'
      : event.calendarSource === 'netease'
        ? 'cal-netease'
        : calendarId;
    return {
      id: event.id,
      calendarId: mappedCalendarId,
      title: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      startTime: new Date(event.startAt).getTime(),
      endTime: new Date(event.endAt).getTime(),
      isAllDay: event.allDay === true,
      type: isMeeting ? 'meeting' : 'custom',
      attendees: attendeeEmails,
      attendeeEmails,
      attendeeUsers,
      externalAttendeeEmails: event.externalAttendeeEmails ?? [],
      reminders: event.reminderMinutes === null || event.reminderMinutes === undefined
        ? undefined
        : [{ minutesBefore: event.reminderMinutes }],
      recurrenceRule: event.recurringRule ?? undefined,
      seriesId: event.seriesId ?? undefined,
      hasConflict: event.hasConflict === true,
      visibility: event.visibility,
      organizer: event.organizer,
      createdBy: event.ownerId,
      createdAt: new Date(event.createdAt).getTime(),
      updatedAt: new Date(event.updatedAt).getTime(),
      status: event.status,
      color: mappedSourceKind === 'subscribed'
        ? 'bg-info'
        : event.calendarSource === 'netease'
          ? 'bg-brand-500'
          : isMeeting
            ? 'bg-brand-500'
            : 'bg-info',
      serverManaged: true,
    };
  });
}

function isApiMeetingEvent(event: Record<string, any>): boolean {
  const attendeeEmails = Array.isArray(event.attendeeEmails) ? event.attendeeEmails : [];
  const attendeeUsers = Array.isArray(event.attendeeUsers) ? event.attendeeUsers : [];
  return attendeeEmails.length > 0 || attendeeUsers.length > 0 || Boolean(event.meetingUrl);
}

function isNeteaseSubscribedEvent(event: Record<string, any>): boolean {
  return event.calendarSource === 'netease'
    && typeof event.description === 'string'
    && event.description.includes('来源日历：');
}

function extractNeteaseSourceCalendarName(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/来源日历：(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || null;
}

function formatSubscribedCalendarOwnerName(calendarName: string): string {
  return calendarName
    .replace(/[（(].*?[）)]/g, '')
    .replace(/的(日历|日程)$/g, '')
    .trim() || calendarName;
}

function describeReminder(minutes: number): string {
  if (minutes === 0) return '准时';
  if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`;
  if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`;
  return `提前 ${minutes} 分钟`;
}

function describeRecurrence(rule: NonNullable<CalendarEvent['recurrenceRule']>): string {
  const frequency = { daily: '每天', weekly: '每周', monthly: '每月', weekdays: '工作日', custom: '自定义' }[rule.frequency];
  const interval = rule.interval > 1 ? `，间隔 ${rule.interval}` : '';
  const ending = rule.end.type === 'count'
    ? `，共 ${rule.end.count} 次`
    : rule.end.type === 'date'
      ? `，至 ${rule.end.date}`
      : '，永不结束';
  return `${frequency}${interval}${ending}`;
}

function formatEventAttendees(event: CalendarEvent): string {
  const usersByEmail = new Map(
    (event.attendeeUsers ?? []).map((person) => [person.email.trim().toLowerCase(), person]),
  );
  return Array.from(new Set((event.attendeeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean)))
    .map((email) => {
      const user = usersByEmail.get(email);
      return user ? formatPerson(user.name, user.email) : email;
    })
    .join(', ');
}

function formatPerson(name: string | undefined, email: string): string {
  const trimmedName = name?.trim();
  const trimmedEmail = email.trim();
  return trimmedName && trimmedName !== trimmedEmail ? `${trimmedName} (${trimmedEmail})` : trimmedEmail;
}

function isCurrentUserEventAttendee(
  event: CalendarEvent,
  user: { id?: string | null; email?: string | null } | null | undefined,
): boolean {
  const userId = user?.id ?? '';
  const email = normalizeCalendarEmail(user?.email);
  return Boolean(
    (userId && (event.attendeeUsers ?? []).some((person) => person.id === userId)) ||
    (email && (event.attendeeEmails ?? []).some((attendeeEmail) => normalizeCalendarEmail(attendeeEmail) === email)) ||
    (email && (event.attendees ?? []).some((attendee) => normalizeCalendarEmail(attendee) === email)) ||
    (userId && (event.attendees ?? []).includes(userId)),
  );
}

function normalizeCalendarEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? '';
}

function isRecurringCalendarEvent(event: CalendarEvent): boolean {
  return Boolean(event.seriesId || event.recurrenceRule || event.recurrence);
}

function formatNeteaseSyncStatusText(status: NeteaseCalendarSyncStatus | null, syncing: boolean): string {
  if (syncing) return '网易同步：本次同步中，同步成功后自动后台更新';
  if (!status) return '网易同步：状态暂未读取';
  if (!status.configured) return '未配置邮箱，首次同步前需要先配置账号和密码';
  if (status.lastSyncAt) {
    return `网易同步：最近 ${formatShortDateTime(status.lastSyncAt)} · ${status.autoEnabled ? '自动更新已开启' : '自动更新未开启'}`;
  }
  return status.autoEnabled ? '网易同步：自动更新已开启，等待首次同步' : '网易同步：尚未开启，首次需手动点击';
}

function formatNeteaseSyncError(error: unknown): string {
  if (isRequestTimeoutError(error)) {
    return '网易日程同步请求超时。可能是服务端仍在连接邮箱，请稍后刷新查看最近同步时间，或再次点击同步。';
  }
  const message = error instanceof Error ? error.message : '网易邮箱日程同步失败';
  if (/internal server error/i.test(message)) {
    return '网易同步服务暂时不可用，请刷新页面后重试。';
  }
  return message;
}

function readNeteaseSyncResponseError(data: unknown): string {
  if (!data || typeof data !== 'object') return '网易邮箱日程同步失败';
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return '网易邮箱日程同步失败';
}

function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatActivityActor(item: CalendarActivityItem): string {
  if (item.actorEmail) return formatPerson(item.actorName, item.actorEmail);
  return item.actorName || item.actorId;
}

function formatActivityAttendees(item: CalendarActivityItem): string {
  const usersByEmail = new Map(
    (item.attendeeUsers ?? []).map((person) => [person.email.trim().toLowerCase(), person]),
  );
  return Array.from(new Set((item.attendeeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean)))
    .map((email) => {
      const user = usersByEmail.get(email);
      return user ? formatPerson(user.name, user.email) : email;
    })
    .join(', ');
}

function activityActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'event.created': '创建日程',
    'event.updated': '修改日程',
    'event.cancelled': '取消日程',
    'event.left': '退出日程',
    'subscription.created': '创建订阅',
    'subscription.cancelled': '取消订阅',
    'subscription.approved': '同意详情',
    'subscription.rejected': '拒绝详情',
    'subscription.revoked': '撤销详情',
  };
  return labels[action] ?? action;
}

function activityScopeLabel(scope: 'single' | 'future' | 'series'): string {
  return scope === 'single' ? '仅本次' : scope === 'future' ? '本次及以后' : '整个重复日程';
}

function activityTitle(item: CalendarActivityItem): string {
  if (item.targetType === 'event') return item.eventTitle || item.eventId || item.targetId;
  if (item.action === 'subscription.created') return '订阅了他人的日程';
  if (item.action === 'subscription.cancelled') return '取消了日程订阅';
  return '处理了日程详情权限';
}

function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
