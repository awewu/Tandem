'use client';

/**
 * /calendar — Tandem 日程中心 v2 (对标 Apple Calendar)
 *
 * 三视图: 月 / 周 / 日
 * 功能: 事件 CRUD · 重复规则 · 提醒 · 多日历管理
 * 集成: OKR due / Check-in / Cycle 自动同步 (cal-okr)
 */

import { useEffect, useState, useCallback } from 'react';
import { useCalendarStore, type CalendarEvent, type EventInstance, fmtMonthCN } from '@/lib/store/calendar';
import { useOKRStore } from '@/lib/store/okr';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { fetchWithTimeout } from '@/lib/http/fetch-with-timeout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, Wand2,
  LayoutGrid, Columns3, List, Eye, EyeOff,
  ShieldCheck, MessageSquare, History, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MonthView from '@/components/calendar/month-view';
import WeekView from '@/components/calendar/week-view';
import DayView from '@/components/calendar/day-view';
import EventEditor from '@/components/calendar/event-editor';
import CalendarSubscriptionPanel from '@/components/calendar/subscription-panel';
import UpcomingEvents from '@/components/calendar/upcoming-events';

type ViewMode = 'month' | 'week' | 'day';

const CALENDAR_REQUEST_TIMEOUT_MS = 15_000;
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

export default function CalendarPage() {
  const {
    calendars, events, toggleCalendarVisibility, addEvent, deleteEvent, replaceManagedEvents,
  } = useCalendarStore();
  const { user } = useCurrentUser();
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
    let managed = mapApiEvents(ownData.events ?? [], 'cal-personal');
    if (subscribedTargetId) {
      const subscribedResponse = await fetchWithTimeout(`/api/calendar?ownerId=${encodeURIComponent(subscribedTargetId)}`, { credentials: 'include', cache: 'no-store' }, CALENDAR_REQUEST_TIMEOUT_MS);
      if (subscribedResponse.ok) {
        const subscribedData = await subscribedResponse.json().catch(() => ({}));
        managed = [...managed, ...mapApiEvents(subscribedData.events ?? [], 'cal-meetings')];
      }
    }
    replaceManagedEvents(managed);
  }, [replaceManagedEvents, subscribedTargetId, user?.id]);

  useEffect(() => {
    void refreshManagedEvents().catch(() => undefined);
  }, [refreshManagedEvents]);

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
      const ownerName = nameOf(kr.ownerId);
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
      const authorName = nameOf(ci.authorId);
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
  }, [cycles, keyResults, checkIns, objectives, nameOf, year]);

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
      alert([
        event.title,
        `${new Date(event.startTime).toLocaleString('zh-CN')} - ${new Date(event.endTime).toLocaleString('zh-CN')}`,
        event.location,
        event.description,
        event.attendeeEmails?.length ? `参会人: ${formatEventAttendees(event)}` : '',
        event.organizer ? `发起人: ${formatPerson(event.organizer.name, event.organizer.email)}` : `发起人: ${event.createdBy}`,
        event.reminders?.length ? `提醒: ${describeReminder(event.reminders[0].minutesBefore)}` : '提醒: 无',
        event.recurrenceRule ? `重复: ${describeRecurrence(event.recurrenceRule)}` : '重复: 不重复',
        event.hasConflict ? '时间冲突' : '',
      ].filter(Boolean).join('\n'));
      return;
    }
    setEditorEventId(instance.eventId);
    setEditorDate(undefined);
    setEditorOpen(true);
  };

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
            onClick={openImReminderDialog}
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
          <CalendarSubscriptionPanel
            currentUserId={user?.id ?? ''}
            selectedTargetId={subscribedTargetId}
            onViewTarget={setSubscribedTargetId}
            onChanged={refreshManagedEvents}
          />
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

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-caption"
              onClick={() => {
                setActivityPage(1);
                setActivityOpen(true);
              }}
            >
              <History className="h-3.5 w-3.5" />
              日程记录
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
        onSaved={refreshManagedEvents}
      />

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
        <DialogContent className="sm:max-w-3xl max-h-[82vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              日程记录
            </DialogTitle>
            <DialogDescription>
              记录创建、修改、取消和订阅动作；可用来对照邮件实际到达时间。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <div className="text-caption text-muted-foreground">
              共 {activityTotal} 条 · 第 {activityPage}/{Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE))} 页
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadActivity(activityPage)} disabled={activityLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', activityLoading && 'animate-spin')} />
              刷新
            </Button>
          </div>

          {activityError && (
            <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
              {activityError}
            </div>
          )}

          <div className="min-h-[320px] max-h-[52vh] overflow-y-auto rounded-lg border">
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

          <div className="flex items-center justify-between">
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

function mapApiEvents(events: Array<Record<string, any>>, calendarId: string): CalendarEvent[] {
  return events.map((event) => ({
    id: event.id,
    calendarId,
    title: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    startTime: new Date(event.startAt).getTime(),
    endTime: new Date(event.endAt).getTime(),
    isAllDay: event.allDay === true,
    type: 'meeting',
    attendees: event.attendeeEmails ?? [],
    attendeeEmails: event.attendeeEmails ?? [],
    attendeeUsers: Array.isArray(event.attendeeUsers) ? event.attendeeUsers : [],
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
    color: calendarId === 'cal-meetings' ? 'bg-violet-500' : 'bg-blue-500',
    serverManaged: true,
  }));
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
