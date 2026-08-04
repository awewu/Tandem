'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useCalendarStore, type CalendarEvent, type EventType, type EventStatus } from '@/lib/store/calendar';
import type { CalendarMutationScope, CalendarRecurrenceRule, RecurrenceFrequency, CalendarUser } from '@/lib/types/calendar-management';
import { fetchWithTimeout, isRequestTimeoutError } from '@/lib/http/fetch-with-timeout';
import { AttendeePicker } from '@/components/calendar/attendee-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Trash2, Copy, X, ClipboardList, CheckCircle2, AlertCircle, Loader2, Crown } from 'lucide-react';

interface EventEditorProps {
  open: boolean;
  onClose: () => void;
  initialDate?: Date; // 新建时默认日期
  editEventId?: string; // 编辑时传入
  onSaved?: () => void | Promise<void>;
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'meeting', label: '会议' },
  { value: 'task', label: '任务' },
  { value: 'reminder', label: '提醒' },
  { value: 'custom', label: '自定义' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: '准时' },
  { value: 5, label: '提前 5 分钟' },
  { value: 10, label: '提前 10 分钟' },
  { value: 15, label: '提前 15 分钟' },
  { value: 30, label: '提前 30 分钟' },
  { value: 60, label: '提前 1 小时' },
  { value: 120, label: '提前 2 小时' },
  { value: 1440, label: '提前 1 天' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15分钟' },
  { value: '30', label: '30分钟' },
  { value: '45', label: '45分钟' },
  { value: '60', label: '1小时' },
  { value: '120', label: '2小时' },
  { value: '180', label: '3小时' },
  { value: 'custom', label: '选择结束时间' },
] as const;

type RecurrencePreset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

const CALENDAR_MUTATION_TIMEOUT_MS = 90_000;
const FORM_ROW_CLASS = 'flex items-start gap-3';
const FORM_LABEL_CLASS = 'w-16 shrink-0 pt-2.5 text-body font-medium text-ink-primary';
const FORM_LABEL_MUTED_CLASS = 'w-16 shrink-0 pt-2.5 text-caption font-medium text-muted-foreground';

interface JobProgressStep {
  key: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  detail?: string;
}

interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  steps: JobProgressStep[];
  completedSteps: number;
  totalSteps: number;
  error?: string;
  result?: { events: CalendarEvent[]; warnings: string[] };
}

// 会议复盘子组件 (必须在 EventEditor 之前定义)
function MeetingRetroButton({ eventId, eventEndTime }: { eventId: string; eventEndTime: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    decisions: string[];
    actionItems: Array<{ task: string; owner?: string; dueDate?: string }>;
    nextSteps: string[];
  } | null>(null);
  const isPast = Date.now() > eventEndTime;

  async function handleRetro() {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/meeting-retro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.retro) setResult(json.retro);
    } catch { /* 静默失败 */ }
    finally { setLoading(false); }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 gap-1 text-caption"
        onClick={handleRetro}
        disabled={loading || !isPast}
        title={isPast ? '生成会议纪要' : '会议结束后可用'}
      >
        <ClipboardList className="h-3.5 w-3.5" />
        {loading ? '复盘中...' : isPast ? '会议复盘' : '待结束'}
      </Button>
      {result && (
        <div className="rounded-md border border-success/30 bg-success/10 p-2.5 space-y-2 text-caption">
          <div className="font-medium text-success">会议纪要</div>
          <p className="text-ink-secondary">{result.summary}</p>
          {result.decisions.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">已达成决策</div>
              <ul className="list-disc list-inside space-y-0.5 text-ink-secondary">
                {result.decisions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {result.actionItems.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">Action Items</div>
              <ul className="space-y-0.5 text-ink-secondary">
                {result.actionItems.map((a, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{a.task}</span>
                    <span className="text-ink-tertiary">{a.owner}{a.dueDate ? ` · ${a.dueDate}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function EventEditor({ open, onClose, initialDate, editEventId, onSaved }: EventEditorProps) {
  const { calendars, events, updateEvent, deleteEvent, duplicateEvent } = useCalendarStore();
  const writableCals = useMemo(() => calendars.filter((c) => c.type !== 'okr_sync'), [calendars]);

  const editing = editEventId ? events.find((e) => e.id === editEventId) : undefined;

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState(writableCals[0]?.id || '');
  const [type, setType] = useState<EventType>('meeting');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [durationValue, setDurationValue] = useState<string>('30');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('confirmed');
  const [reminderMins, setReminderMins] = useState<number>(15);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>('none');
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurrenceFrequency>('weekly');
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurEndType, setRecurEndType] = useState<'never' | 'date' | 'count'>('count');
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurCount, setRecurCount] = useState(10);
  const [recurWeekdays, setRecurWeekdays] = useState<number[]>([]);
  const [mutationScope, setMutationScope] = useState<CalendarMutationScope>('single');
  const [createImReminder, setCreateImReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferringOwner, setTransferringOwner] = useState(false);
  const [ownerTransferUserId, setOwnerTransferUserId] = useState('');
  const [formError, setFormError] = useState('');

  // Async job progress state
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollErrorCountRef = useRef(0);
  const createImReminderAfterSaveRef = useRef(false);

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  // 会议自动准备
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepResult, setPrepResult] = useState<{
    context: string;
    keyPoints: string[];
    suggestedAgenda: Array<{ item: string; durationMin: number }>;
    relatedMaterials: string[];
  } | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const sendImReminderForEvent = useCallback(async (eventId: string) => {
    const response = await fetchWithTimeout('/api/calendar/im-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId }),
    }, CALENDAR_MUTATION_TIMEOUT_MS);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message ?? data.error ?? 'IM 群提醒发送失败');
    }
    return data;
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/calendar/jobs/${jobId}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = data.error?.message ?? data.error ?? '保存任务状态读取失败';
          setJobStatus((current) => current ? { ...current, status: 'failed', error: message } : {
            jobId,
            status: 'failed',
            steps: [],
            completedSteps: 0,
            totalSteps: 5,
            error: message,
          });
          setFormError(message);
          setSaving(false);
          pollTimerRef.current = null;
          return;
        }
        pollErrorCountRef.current = 0;
        setJobStatus(data);
        if (data.status === 'running' || data.status === 'pending') {
          pollTimerRef.current = setTimeout(poll, 800);
        } else {
          // Completed, failed, or partial — stop polling
          pollTimerRef.current = null;
          if (data.status === 'completed') {
            try { await onSaved?.(); } catch { /* refresh failed, not critical */ }
            const warnings = Array.isArray(data.result?.warnings) ? data.result.warnings : [];
            if (createImReminderAfterSaveRef.current) {
              const eventId = data.result?.events?.[0]?.id;
              if (!eventId) {
                setFormError('日程已创建，但未返回可用于建立 IM 群聊的日程 ID。');
                setSaving(false);
                return;
              }
              try {
                await sendImReminderForEvent(eventId);
              } catch (error) {
                setFormError(`日程已创建，但 IM 群聊提醒失败：${error instanceof Error ? error.message : '未知错误'}`);
                setSaving(false);
                return;
              }
            }
            if (warnings.length) {
              const prefix = createImReminderAfterSaveRef.current ? '日程已保存，IM 群聊提醒已发送' : '日程已保存';
              setFormError(`${prefix}，但邮件发送有警告：${warnings.join('；')}`);
            } else {
              onClose();
            }
          } else if (data.status === 'partial') {
            setFormError(`部分步骤失败：${data.error ?? '未知错误'}。可点击"重试"从断点继续。`);
          } else {
            setFormError(data.error ?? '保存失败，可点击"重试"重新开始。');
          }
          setSaving(false);
        }
      } catch {
        pollErrorCountRef.current += 1;
        setFormError(`正在等待保存结果，网络已重试 ${pollErrorCountRef.current} 次。`);
        pollTimerRef.current = setTimeout(poll, 1500);
      }
    };
    void poll();
  }, [onClose, onSaved, sendImReminderForEvent]);

  // 初始化表单
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setCalendarId(editing.calendarId);
      setType(editing.type);
      setIsAllDay(editing.isAllDay);
      setStartDate(fmtDateInput(editing.startTime));
      setStartTime(fmtTimeInput(editing.startTime));
      setEndDate(fmtDateInput(editing.endTime));
      setEndTime(fmtTimeInput(editing.endTime));
      setDurationValue(durationValueFor(editing.startTime, editing.endTime));
      setLocation(editing.location || '');
      setDescription(editing.description || '');
      setStatus(editing.status);
      setReminderMins(editing.reminders?.[0]?.minutesBefore ?? 15);
      setAttendees(editing.attendeeEmails ?? editing.attendees ?? []);
      const legacyFrequency = editing.recurrence?.frequency;
      const nextHasRecurrence = !!editing.recurrenceRule || !!editing.recurrence;
      const nextFreq = editing.recurrenceRule?.frequency ?? (legacyFrequency === 'yearly' ? 'monthly' : legacyFrequency) ?? 'weekly';
      const nextInterval = editing.recurrenceRule?.interval ?? editing.recurrence?.interval ?? 1;
      const nextWeekdays = editing.recurrenceRule?.weekdays ?? [];
      setHasRecurrence(nextHasRecurrence);
      setRecurrencePreset(inferRecurrencePreset(nextHasRecurrence, nextFreq, nextInterval, nextWeekdays, fmtDateInput(editing.startTime)));
      setRecurFreq(nextFreq);
      setRecurInterval(nextInterval);
      const ruleEnd = editing.recurrenceRule?.end;
      setRecurEndType(ruleEnd?.type ?? 'count');
      setRecurEndDate(ruleEnd?.type === 'date' ? ruleEnd.date : '');
      setRecurCount(ruleEnd?.type === 'count' ? ruleEnd.count : 10);
      setRecurWeekdays(nextWeekdays);
      setMutationScope(editing.seriesId ? 'series' : 'single');
      setCreateImReminder(false);
      setOwnerTransferUserId(firstOwnerTransferCandidate(editing)?.id ?? '');
    } else {
      const base = defaultStartDate(initialDate);
      const end = new Date(base.getTime() + 30 * 60 * 1000);
      setTitle('');
      setCalendarId(writableCals[0]?.id || '');
      setType('meeting');
      setIsAllDay(false);
      setStartDate(fmtDateInput(base.getTime()));
      setStartTime(fmtTimeInput(base.getTime()));
      setEndDate(fmtDateInput(end.getTime()));
      setEndTime(fmtTimeInput(end.getTime()));
      setDurationValue('30');
      setLocation('');
      setDescription('');
      setStatus('confirmed');
      setReminderMins(15);
      setAttendees([]);
      setRecurrencePreset('none');
      setHasRecurrence(false);
      setRecurFreq('weekly');
      setRecurInterval(1);
      setRecurEndType('count');
      setRecurEndDate(fmtDateInput(base.getTime() + 30 * 24 * 60 * 60 * 1000));
      setRecurCount(10);
      setRecurWeekdays([base.getDay()]);
      setMutationScope('single');
      setCreateImReminder(false);
      setOwnerTransferUserId('');
    }
    setFormError('');
    setPrepResult(null);
    setJobStatus(null);
    createImReminderAfterSaveRef.current = false;
    stopPolling();
  }, [open, editing, initialDate, writableCals, stopPolling]);

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleMeetingPrep() {
    if (!editing) return;
    setPrepLoading(true);
    try {
      const res = await fetch('/api/calendar/meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId: editing.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.prep) {
        setPrepResult(json.prep);
      }
    } catch {
      /* 静默失败 */
    } finally {
      setPrepLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setFormError('请填写日程标题');
      return;
    }
    const startMs = parseDateTime(startDate, startTime);
    const endMs = isAllDay
      ? new Date(startDate).setHours(23, 59, 59, 999)
      : durationValue === 'custom'
        ? parseDateTime(endDate, endTime)
        : startMs + Number(durationValue) * 60_000;

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      setFormError('时间格式有误或结束时间早于开始时间');
      return;
    }
    if (!isAllDay && startMs < Date.now()) {
      setFormError('开始时间不能早于当前时间');
      return;
    }
    if (startDate < fmtDateInput(Date.now())) {
      setFormError('不能在过去日期创建或移动日程');
      return;
    }

    const recurrence: CalendarRecurrenceRule | null = hasRecurrence ? {
      frequency: recurFreq,
      interval: recurInterval,
      weekdays: recurFreq === 'weekly' || recurFreq === 'custom' ? recurWeekdays : undefined,
      end: recurEndType === 'date'
        ? { type: 'date', date: recurEndDate || defaultRecurrenceEndDate(startDate) }
        : recurEndType === 'count'
          ? { type: 'count', count: recurCount }
          : { type: 'never' },
    } : null;
    const recurrenceChanged = !editing || !sameRecurrence(recurrence, editing.recurrenceRule ?? null);
    const attendeesChanged = !editing || !sameEmailSet(attendees, editing.attendeeEmails ?? editing.attendees ?? []);

    const payload: Partial<CalendarEvent> = {
      title: title.trim(),
      calendarId,
      type,
      isAllDay,
      startTime: startMs,
      endTime: endMs,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      status,
      attendees,
      attendeeEmails: attendees,
      reminders: reminderMins >= 0 ? [{ minutesBefore: reminderMins }] : undefined,
      recurrence: hasRecurrence && ['daily', 'weekly', 'monthly'].includes(recurFreq)
        ? { frequency: recurFreq as 'daily' | 'weekly' | 'monthly', interval: recurInterval }
        : undefined,
      recurrenceRule: recurrence ?? undefined,
    };

    setSaving(true);
    setFormError('');
    setJobStatus(null);
    stopPolling();
    pollErrorCountRef.current = 0;
    createImReminderAfterSaveRef.current = !editing && type === 'meeting' && createImReminder;

    let startedAsyncJob = false;
    try {
      if (!editing) {
        // NEW event: use async job with progress bar
        const response = await fetch('/api/calendar/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            startAt: new Date(startMs).toISOString(),
            endAt: new Date(endMs).toISOString(),
            location: location.trim() || null,
            attendeeEmails: type === 'meeting' ? attendees : [],
            reminderMinutes: reminderMins,
            recurrence: recurrenceChanged ? recurrence : undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '提交失败');
        if (data.jobId) {
          startedAsyncJob = true;
          setJobStatus({ jobId: data.jobId, status: 'pending', steps: [], completedSteps: 0, totalSteps: 5 });
          void pollJobStatus(data.jobId);
        }
      } else if (editing.serverManaged) {
        // EDIT server-managed event: still use PATCH synchronously (shorter operation)
        const response = await fetchWithTimeout(`/api/calendar/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            startAt: new Date(startMs).toISOString(),
            endAt: new Date(endMs).toISOString(),
            location: location.trim() || null,
            attendeeEmails: attendeesChanged ? (type === 'meeting' ? attendees : []) : undefined,
            reminderMinutes: reminderMins,
            recurrence: recurrenceChanged ? recurrence : undefined,
            scope: mutationScope,
          }),
        }, CALENDAR_MUTATION_TIMEOUT_MS);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '保存失败');
        try { await onSaved?.(); } catch { alert('日程已保存，但列表刷新失败，请刷新页面查看。'); }
        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          alert(`日程已保存，但邮件发送失败：${data.warnings.join('；')}`);
        }
        onClose();
      } else {
        updateEvent(editing.id, payload);
        onClose();
      }
    } catch (error) {
      setFormError(isRequestTimeoutError(error)
        ? '保存请求超时，无法确认是否已保存。请检查网络后刷新日程再重试。'
        : error instanceof Error ? error.message : '保存失败');
    } finally {
      if (!startedAsyncJob) setSaving(false);
    }
  }

  async function handleRetryJob() {
    if (!jobStatus) return;
    setSaving(true);
    setFormError('');
    stopPolling();
    try {
      const res = await fetch(`/api/calendar/jobs/${jobStatus.jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'resume' }),
      });
      if (!res.ok) throw new Error('重试请求失败');
      await pollJobStatus(jobStatus.jobId);
    } catch (err) {
      setSaving(false);
      setFormError(err instanceof Error ? err.message : '重试失败');
    }
  }

  async function handleTransferOwner() {
    if (!editing?.serverManaged || !ownerTransferUserId) return;
    const target = ownerTransferOptions.find((user) => user.id === ownerTransferUserId);
    if (!confirm(`确认将日程发起人转交给 ${formatCalendarUserLabel(target)}？`)) return;
    setTransferringOwner(true);
    setFormError('');
    try {
      const response = await fetchWithTimeout(`/api/calendar/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'transferOwner',
          newOwnerId: ownerTransferUserId,
          scope: mutationScope,
        }),
      }, CALENDAR_MUTATION_TIMEOUT_MS);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '转交失败');
      try { await onSaved?.(); } catch { alert('日程已转交，但列表刷新失败，请刷新页面查看。'); }
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        alert(data.warnings.join('；'));
      }
      onClose();
    } catch (error) {
      setFormError(isRequestTimeoutError(error)
        ? '转交请求超时，无法确认是否已转交。请刷新日程后再确认。'
        : error instanceof Error ? error.message : '转交失败');
    } finally {
      setTransferringOwner(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (confirm('确定删除此日程？')) {
      setDeleting(true);
      setFormError('');
      setJobStatus(null);
      stopPolling();
      try {
        if (editing.serverManaged) {
          const response = await fetchWithTimeout(`/api/calendar/${editing.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ scope: mutationScope }),
          }, CALENDAR_MUTATION_TIMEOUT_MS);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error?.message ?? data.error ?? '删除失败');
          const cancelledEvents = Array.isArray(data.events) ? data.events : [];
          if (cancelledEvents.length > 0) {
            cancelledEvents.forEach((event: { id?: unknown }) => {
              if (typeof event.id === 'string') deleteEvent(event.id);
            });
          } else {
            deleteEvent(editing.id);
          }
          void Promise.resolve(onSaved?.()).catch(() => undefined);
          if (Array.isArray(data.warnings) && data.warnings.length > 0) {
            alert(`日程已删除，但邮件发送失败：${data.warnings.join('；')}`);
          }
        } else {
          deleteEvent(editing.id);
        }
        onClose();
      } catch (error) {
        if (isRequestTimeoutError(error)) {
          void Promise.resolve(onSaved?.()).catch(() => undefined);
        }
        setFormError(isRequestTimeoutError(error)
          ? '删除请求等待时间过长，已刷新日程状态。若该日程仍显示，请稍后再点一次删除。'
          : error instanceof Error ? error.message : '删除失败');
      } finally {
        setDeleting(false);
      }
    }
  }

  function handleDuplicate() {
    if (!editing) return;
    duplicateEvent(editing.id);
    onClose();
  }

  const selectedCal = calendars.find((c) => c.id === calendarId);
  const ownerTransferOptions = useMemo(() => {
    if (!editing?.serverManaged) return [];
    return ownerTransferCandidates(editing);
  }, [editing]);
  const startTimeOptions = useMemo(() => {
    const options = buildStartTimeOptions(startDate);
    return options.includes(startTime) ? options : [startTime, ...options].filter(Boolean).sort();
  }, [startDate, startTime]);
  const computedEndMs = (() => {
    const startMs = parseDateTime(startDate, startTime);
    if (Number.isNaN(startMs)) return NaN;
    if (isAllDay) return new Date(startDate).setHours(23, 59, 59, 999);
    return durationValue === 'custom'
      ? parseDateTime(endDate, endTime)
      : startMs + Number(durationValue) * 60_000;
  })();

  function handleStartDateChange(value: string) {
    const options = buildStartTimeOptions(value);
    const nextDate = options.length > 0 ? value : fmtDateInput(new Date(value).getTime() + 24 * 60 * 60 * 1000);
    const nextOptions = options.length > 0 ? options : buildStartTimeOptions(nextDate);
    const nextTime = nextOptions.includes(startTime) ? startTime : nextOptions[0] ?? '00:00';
    setStartDate(nextDate);
    setStartTime(nextTime);
    if (recurrencePreset === 'weekly' || recurrencePreset === 'biweekly' || (recurrencePreset === 'custom' && recurFreq === 'weekly')) {
      setRecurWeekdays([weekdayOfDateInput(nextDate)]);
    }
    if (recurrencePreset === 'custom' && !recurEndDate) {
      setRecurEndDate(defaultRecurrenceEndDate(nextDate));
    }
    if (durationValue === 'custom') {
      ensureCustomEndAfterStart(nextDate, nextTime);
    }
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    if (durationValue === 'custom') ensureCustomEndAfterStart(startDate, value);
  }

  function handleDurationChange(value: string) {
    setDurationValue(value);
    if (value === 'custom') {
      const startMs = parseDateTime(startDate, startTime);
      const fallbackEnd = Number.isNaN(startMs) ? Date.now() + 30 * 60_000 : startMs + 30 * 60_000;
      const currentEnd = parseDateTime(endDate, endTime);
      const nextEnd = Number.isNaN(currentEnd) || currentEnd <= startMs ? fallbackEnd : currentEnd;
      setEndDate(fmtDateInput(nextEnd));
      setEndTime(fmtTimeInput(nextEnd));
    }
  }

  function ensureCustomEndAfterStart(date: string, time: string) {
    const startMs = parseDateTime(date, time);
    const currentEnd = parseDateTime(endDate, endTime);
    if (!Number.isNaN(startMs) && (Number.isNaN(currentEnd) || currentEnd <= startMs)) {
      const nextEnd = startMs + 30 * 60_000;
      setEndDate(fmtDateInput(nextEnd));
      setEndTime(fmtTimeInput(nextEnd));
    }
  }

  function handleRecurrencePresetChange(value: RecurrencePreset) {
    setRecurrencePreset(value);
    if (value === 'none') {
      setHasRecurrence(false);
      return;
    }

    const startWeekday = weekdayOfDateInput(startDate);
    setHasRecurrence(true);
    setRecurEndType(value === 'custom' ? 'date' : 'count');
    setRecurEndDate((current) => current || defaultRecurrenceEndDate(startDate));
    setRecurCount((current) => Math.max(1, Math.min(current || 10, 10)));
    if (value === 'daily') {
      setRecurFreq('daily');
      setRecurInterval(1);
      setRecurWeekdays([]);
    } else if (value === 'weekdays') {
      setRecurFreq('weekdays');
      setRecurInterval(1);
      setRecurWeekdays([]);
    } else if (value === 'weekly') {
      setRecurFreq('weekly');
      setRecurInterval(1);
      setRecurWeekdays([startWeekday]);
    } else if (value === 'biweekly') {
      setRecurFreq('weekly');
      setRecurInterval(2);
      setRecurWeekdays([startWeekday]);
    } else if (value === 'monthly') {
      setRecurFreq('monthly');
      setRecurInterval(1);
      setRecurWeekdays([]);
    } else {
      setRecurFreq((current) => (current === 'weekdays' || current === 'custom' ? 'daily' : current));
      setRecurInterval((current) => Math.max(1, current || 1));
      if (recurFreq === 'weekly') setRecurWeekdays([startWeekday]);
    }
  }

  function handleCustomRecurrenceUnitChange(value: RecurrenceFrequency) {
    setRecurFreq(value);
    if (value === 'weekly') setRecurWeekdays([weekdayOfDateInput(startDate)]);
    else setRecurWeekdays([]);
  }

  const recurrenceOptions = buildRecurrenceOptions(startDate);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0">
        <div className="max-h-[90vh] overflow-y-auto px-6 py-6 [scrollbar-gutter:stable]">
        <DialogHeader>
          <DialogTitle className="text-title-3">
            {editing ? '编辑事件' : '新建事件'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 标题 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>标题</Label>
            <Input
              placeholder="添加标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-title-3 font-medium"
              autoFocus
            />
          </div>

          {/* 日历 + 类型 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>日历</Label>
            <div className="min-w-0 flex-1">
              <Select value={calendarId} onValueChange={setCalendarId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {writableCals.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>类型</Label>
            <div className="min-w-0 flex-1">
              <Select value={type} onValueChange={(v) => setType(v as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 全天开关 */}
          <div className="flex items-center gap-3">
            <Label className="w-16 shrink-0 text-body font-medium text-ink-primary">全天</Label>
            <div className="flex flex-1 justify-end">
              <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
            </div>
          </div>

          {/* 时间 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>时间</Label>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Input type="date" min={fmtDateInput(Date.now())} value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="flex-1" />
                {!isAllDay && (
                  <Select value={startTime} onValueChange={handleStartTimeChange}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {startTimeOptions.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {!isAllDay && (
                <div className="space-y-2">
                  <Select value={durationValue} onValueChange={handleDurationChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择时长" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {durationValue === 'custom' && (
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-caption text-muted-foreground">结束</span>
                      <Input type="date" min={startDate || fmtDateInput(Date.now())} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1" />
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
                    </div>
                  )}
                  {durationValue !== 'custom' && !Number.isNaN(computedEndMs) && (
                    <p className="text-[11px] text-muted-foreground">
                      预计结束：{new Date(computedEndMs).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 参会人 (仅 meeting 类型显示) */}
          {type === 'meeting' && (
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>成员</Label>
              <div className="min-w-0 flex-1"><AttendeePicker value={attendees} onChange={setAttendees} showLabel={false} /></div>
            </div>
          )}

          {editing?.serverManaged && type === 'meeting' && ownerTransferOptions.length > 0 && (
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>发起人</Label>
              <div className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
                <div className="mb-2 flex min-w-0 items-center gap-2 text-caption text-ink-secondary">
                  <Crown className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <span className="truncate">当前：{formatCalendarUserLabel(editing.organizer)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={ownerTransferUserId} onValueChange={setOwnerTransferUserId}>
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue placeholder="选择接收人" />
                    </SelectTrigger>
                    <SelectContent>
                      {ownerTransferOptions.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{formatCalendarUserLabel(user)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTransferOwner}
                    disabled={saving || deleting || transferringOwner || !ownerTransferUserId}
                    className="shrink-0 gap-1.5"
                  >
                    {transferringOwner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
                    转交
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!editing && type === 'meeting' && (
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>IM</Label>
              <div className="min-w-0 flex-1 rounded-lg border border-brand-200/70 bg-brand-50/40 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-body font-medium text-ink-primary">创建后建立 IM 群聊并通知</div>
                    <p className="text-caption leading-5 text-muted-foreground">
                      勾选后，日程创建完成会为系统内参会人创建或复用 IM 群，并发送参会提醒；外部邮箱不会入群。
                    </p>
                  </div>
                  <Switch checked={createImReminder} onCheckedChange={setCreateImReminder} />
                </div>
              </div>
            </div>
          )}

          {/* 地点 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>地点</Label>
            <Input
              placeholder="添加地点"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* 描述 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>备注</Label>
            <Textarea
              placeholder="添加备注..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex-1"
            />
          </div>

          {/* 提醒 */}
          <div className={FORM_ROW_CLASS}>
            <Label className={FORM_LABEL_CLASS}>提醒</Label>
            <div className="min-w-0 flex-1">
            <Select
              value={String(reminderMins)}
              onValueChange={(v) => setReminderMins(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>

          {/* 重复 */}
          <div className="space-y-2">
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>重复</Label>
              <Select value={recurrencePreset} onValueChange={(value) => handleRecurrencePresetChange(value as RecurrencePreset)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrencePreset === 'custom' && (
              <div className="space-y-3 pl-[76px]">
                <div className="flex items-center gap-3">
                  <Label className={FORM_LABEL_MUTED_CLASS}>频率</Label>
                  <Select value={String(recurInterval)} onValueChange={(value) => setRecurInterval(Math.max(1, Number(value)))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                        <SelectItem key={value} value={String(value)}>每 {value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={recurFreq === 'weekly' || recurFreq === 'monthly' ? recurFreq : 'daily'} onValueChange={(value) => handleCustomRecurrenceUnitChange(value as RecurrenceFrequency)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">天</SelectItem>
                      <SelectItem value="weekly">周</SelectItem>
                      <SelectItem value="monthly">月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurFreq === 'weekly' && (
                  <div className="grid grid-cols-7 gap-1">
                    {['日', '一', '二', '三', '四', '五', '六'].map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        className={recurWeekdays.includes(day)
                          ? 'h-8 rounded border border-brand-500 bg-brand-500 text-caption text-white'
                          : 'h-8 rounded border text-caption hover:bg-muted'}
                        onClick={() => setRecurWeekdays((current) => current.includes(day)
                          ? current.filter((item) => item !== day)
                          : [...current, day].sort())}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Label className={FORM_LABEL_MUTED_CLASS}>结束于</Label>
                  <Select value={recurEndType} onValueChange={(value) => setRecurEndType(value as typeof recurEndType)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">某天</SelectItem>
                      <SelectItem value="never">未来一年</SelectItem>
                      <SelectItem value="count">指定次数</SelectItem>
                    </SelectContent>
                  </Select>
                  {recurEndType === 'date' ? (
                    <Input type="date" min={startDate} value={recurEndDate || defaultRecurrenceEndDate(startDate)} onChange={(event) => setRecurEndDate(event.target.value)} className="flex-1" />
                  ) : recurEndType === 'count' ? (
                    <Input type="number" min={1} max={366} value={recurCount} onChange={(event) => setRecurCount(Math.max(1, Number(event.target.value)))} className="flex-1" />
                  ) : <div className="flex-1" />}
                </div>
              </div>
            )}
          </div>

          {editing?.seriesId && (
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>变更范围</Label>
              <div className="min-w-0 flex-1">
              <Select value={mutationScope} onValueChange={(value) => setMutationScope(value as CalendarMutationScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">仅本次日程</SelectItem>
                  <SelectItem value="future">本次及以后日程</SelectItem>
                  <SelectItem value="series">整个重复日程</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          )}

          {/* 状态 */}
          {editing && !editing.serverManaged && (
            <div className={FORM_ROW_CLASS}>
              <Label className={FORM_LABEL_CLASS}>状态</Label>
              <div className="min-w-0 flex-1">
              <Select value={status} onValueChange={(v) => setStatus(v as EventStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="tentative">待定</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          )}

          {/* 会议自动准备 & 复盘 (仅 meeting 编辑模式) */}
          {editing && !editing.serverManaged && type === 'meeting' && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1 text-caption"
                  onClick={handleMeetingPrep}
                  disabled={prepLoading}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {prepLoading ? '准备中...' : '会议准备'}
                </Button>
                <MeetingRetroButton eventId={editing.id} eventEndTime={editing.endTime} />
              </div>

              {prepResult && (
                <div className="rounded-md border border-info/30 bg-info/10 p-2.5 space-y-2 text-caption">
                  <div className="font-medium text-info">会前准备材料</div>                  <p className="text-ink-secondary">{prepResult.context}</p>
                  {prepResult.keyPoints.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">关键议题</div>
                      <ul className="list-disc list-inside space-y-0.5 text-ink-secondary">
                        {prepResult.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}
                      </ul>
                    </div>
                  )}
                  {prepResult.suggestedAgenda.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">建议议程</div>
                      <ul className="space-y-0.5 text-ink-secondary">
                        {prepResult.suggestedAgenda.map((a, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{a.item}</span>
                            <span className="text-ink-tertiary">{a.durationMin}min</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {formError && (
          <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
            {formError}
          </div>
        )}

        {/* 进度条 (异步作业) */}
        {jobStatus && (
          <div className="mt-4 rounded-md border border-info/30 bg-info/10 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-caption font-medium text-info">保存进度</span>
              <span className="text-caption text-info">                {jobStatus.completedSteps}/{jobStatus.totalSteps}
                {jobStatus.status === 'running' && ' · 进行中...'}
                {jobStatus.status === 'completed' && ' · 已完成'}
                {jobStatus.status === 'partial' && ' · 部分失败'}
                {jobStatus.status === 'failed' && ' · 失败'}
              </span>
            </div>
            <Progress value={jobStatus.totalSteps > 0 ? (jobStatus.completedSteps / jobStatus.totalSteps) * 100 : 0} className="h-2" />
            <div className="space-y-1">
              {(jobStatus.steps.length > 0 ? jobStatus.steps : [
                { key: 'validating', label: '校验日程', status: 'pending' as const, detail: undefined },
                { key: 'creating_events', label: '写入日程到参会人', status: 'pending' as const, detail: undefined },
                { key: 'creating_reminders', label: '生成提醒任务', status: 'pending' as const, detail: undefined },
                { key: 'sending_emails', label: '发送邮件通知', status: 'pending' as const, detail: undefined },
                { key: 'finalizing', label: '完成', status: 'pending' as const, detail: undefined },
              ]).map((step) => (
                <div key={step.key} className="flex items-center gap-2 text-caption">
                  {step.status === 'done' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : step.status === 'in_progress' ? (
                    <Loader2 className="h-3.5 w-3.5 text-info shrink-0 animate-spin" />                  ) : step.status === 'failed' ? (
                    <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={step.status === 'done' ? 'text-success' : step.status === 'in_progress' ? 'text-info font-medium' : step.status === 'failed' ? 'text-danger' : 'text-muted-foreground'}>                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="text-ink-tertiary text-[11px]">· {step.detail}</span>
                  )}
                </div>
              ))}
            </div>
            {(jobStatus.status === 'partial' || jobStatus.status === 'failed') && (
              <div className="flex items-center gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={handleRetryJob} disabled={saving || deleting || transferringOwner} className="text-caption">
                  {saving ? '重试中...' : '从断点重试'}
                </Button>
                <span className="text-[11px] text-ink-tertiary">已完成的步骤不会重复执行</span>
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="flex items-center gap-1">
            {editing && (
              <>
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={saving || deleting || transferringOwner} className="gap-1.5 px-3 shadow-sm" title="删除日程">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{deleting ? '删除中...' : '删除'}</span>
                </Button>
                {!editing.serverManaged && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleDuplicate} disabled={saving || deleting || transferringOwner} title="复制事件">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={(saving && !jobStatus) || deleting || transferringOwner}>
              <X className="h-4 w-4 mr-1" />
              取消
            </Button>
            <Button type="button" size="sm" onClick={jobStatus?.status === 'completed' ? onClose : handleSave} disabled={saving || deleting || transferringOwner} className="bg-info/80 hover:bg-info/70 text-white">
              {transferringOwner ? '转交中...' : deleting ? '删除中...' : jobStatus?.status === 'completed' ? '完成' : saving ? (jobStatus ? '处理中...' : '保存中...') : editing ? '保存' : '创建'}
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function firstOwnerTransferCandidate(event: CalendarEvent): CalendarUser | undefined {
  return ownerTransferCandidates(event)[0];
}

function ownerTransferCandidates(event: CalendarEvent): CalendarUser[] {
  const ownerId = event.createdBy;
  const attendeeEmails = new Set((event.attendeeEmails ?? event.attendees ?? []).map(normalizeEmailLoose));
  const byId = new Map<string, CalendarUser>();
  for (const user of event.attendeeUsers ?? []) {
    if (user.id === ownerId) continue;
    if (attendeeEmails.size > 0 && !attendeeEmails.has(normalizeEmailLoose(user.email))) continue;
    if (!byId.has(user.id)) byId.set(user.id, user);
  }
  return Array.from(byId.values());
}

function formatCalendarUserLabel(user: CalendarUser | undefined, fallback = '原发起人（账号已禁用或已删除）'): string {
  if (!user) return fallback;
  return user.name && user.name !== user.email ? `${user.name} (${user.email})` : user.email;
}

function normalizeEmailLoose(value: string): string {
  return value.trim().toLowerCase();
}

// 辅助格式化
function fmtDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDateTime(dateStr: string, timeStr: string): number {
  return new Date(`${dateStr}T${timeStr}`).getTime();
}

function defaultStartDate(initialDate?: Date): Date {
  const now = new Date();
  const selected = initialDate ? new Date(initialDate) : new Date(now);
  const selectedDay = new Date(selected).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  if (selectedDay <= today) return nextHalfHour(now);
  selected.setHours(9, 0, 0, 0);
  return selected;
}

function nextHalfHour(value: Date): Date {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const add = minutes === 0 || minutes === 30 ? 0 : minutes < 30 ? 30 - minutes : 60 - minutes;
  next.setMinutes(minutes + add);
  if (next.getTime() <= value.getTime()) next.setMinutes(next.getMinutes() + 30);
  return next;
}

function buildStartTimeOptions(dateStr: string): string[] {
  const selectedDay = new Date(`${dateStr}T00:00`).setHours(0, 0, 0, 0);
  const now = new Date();
  const today = new Date(now).setHours(0, 0, 0, 0);
  const nextStart = nextHalfHour(now);
  if (selectedDay === today && new Date(nextStart).setHours(0, 0, 0, 0) > today) return [];
  const minTime = selectedDay === today ? fmtTimeInput(nextStart.getTime()) : '00:00';
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (selectedDay !== today || time >= minTime) options.push(time);
    }
  }
  return options;
}

function buildRecurrenceOptions(dateStr: string): Array<{ value: RecurrencePreset; label: string }> {
  const weekday = weekdayLabel(weekdayOfDateInput(dateStr));
  const day = dayOfMonthInput(dateStr);
  return [
    { value: 'none', label: '不重复' },
    { value: 'daily', label: '每天' },
    { value: 'weekdays', label: '每个工作日' },
    { value: 'weekly', label: `每周 (${weekday})` },
    { value: 'biweekly', label: `每两周 (${weekday})` },
    { value: 'monthly', label: `每月 (${day})日` },
    { value: 'custom', label: '自定义' },
  ];
}

function inferRecurrencePreset(
  hasRecurrence: boolean,
  frequency: RecurrenceFrequency,
  interval: number,
  weekdays: number[],
  dateStr: string,
): RecurrencePreset {
  if (!hasRecurrence) return 'none';
  const startWeekday = weekdayOfDateInput(dateStr);
  const normalizedDays = [...weekdays].sort((a, b) => a - b);
  const isStartWeekdayOnly = normalizedDays.length === 0 || (normalizedDays.length === 1 && normalizedDays[0] === startWeekday);
  if (frequency === 'daily' && interval === 1) return 'daily';
  if (frequency === 'weekdays' && interval === 1) return 'weekdays';
  if (frequency === 'weekly' && interval === 1 && isStartWeekdayOnly) return 'weekly';
  if (frequency === 'weekly' && interval === 2 && isStartWeekdayOnly) return 'biweekly';
  if (frequency === 'monthly' && interval === 1) return 'monthly';
  return 'custom';
}

function weekdayOfDateInput(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00`);
  return Number.isNaN(date.getTime()) ? new Date().getDay() : date.getDay();
}

function dayOfMonthInput(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00`);
  return Number.isNaN(date.getTime()) ? new Date().getDate() : date.getDate();
}

function weekdayLabel(day: number): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day] ?? '周日';
}

function defaultRecurrenceEndDate(dateStr: string): string {
  const base = new Date(`${dateStr}T00:00`);
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  date.setDate(date.getDate() + 7);
  return fmtDateInput(date.getTime());
}

function durationValueFor(startMs: number, endMs: number): string {
  const minutes = Math.round((endMs - startMs) / 60_000);
  return DURATION_OPTIONS.some((option) => option.value === String(minutes)) ? String(minutes) : 'custom';
}

function sameRecurrence(left: CalendarRecurrenceRule | null, right: CalendarRecurrenceRule | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.frequency !== right.frequency || left.interval !== right.interval || left.end.type !== right.end.type) return false;
  const leftDays = [...(left.weekdays ?? [])].sort((a, b) => a - b);
  const rightDays = [...(right.weekdays ?? [])].sort((a, b) => a - b);
  if (leftDays.join(',') !== rightDays.join(',')) return false;
  if (left.end.type === 'date' && right.end.type === 'date') return left.end.date === right.end.date;
  if (left.end.type === 'count' && right.end.type === 'count') return left.end.count === right.end.count;
  return true;
}

function sameEmailSet(left: string[], right: string[]): boolean {
  const normalize = (values: string[]) => Array.from(new Set(values.map((value) => value.trim().toLowerCase()))).sort();
  return normalize(left).join(',') === normalize(right).join(',');
}
