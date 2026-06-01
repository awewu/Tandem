'use client';

import { useState, useEffect } from 'react';
import { useCalendarStore, type CalendarEvent, type EventType, type EventStatus, type RecurrenceRule } from '@/lib/store/calendar';
import { sendCalendarInvite } from '@/lib/calendar/email-bridge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, MapPin, Trash2, Copy, X, Users, ClipboardList } from 'lucide-react';

interface EventEditorProps {
  open: boolean;
  onClose: () => void;
  initialDate?: Date; // 新建时默认日期
  editEventId?: string; // 编辑时传入
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
        variant="outline"
        size="sm"
        className="flex-1 gap-1 text-xs"
        onClick={handleRetro}
        disabled={loading || !isPast}
        title={isPast ? '生成会议纪要' : '会议结束后可用'}
      >
        <ClipboardList className="h-3.5 w-3.5" />
        {loading ? '复盘中...' : isPast ? '会议复盘' : '待结束'}
      </Button>
      {result && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-2 text-xs">
          <div className="font-medium text-emerald-800">会议纪要</div>
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

export default function EventEditor({ open, onClose, initialDate, editEventId }: EventEditorProps) {
  const { calendars, events, addEvent, updateEvent, deleteEvent, duplicateEvent } = useCalendarStore();
  const writableCals = calendars.filter((c) => c.type !== 'okr_sync');

  const editing = editEventId ? events.find((e) => e.id === editEventId) : undefined;

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState(writableCals[0]?.id || '');
  const [type, setType] = useState<EventType>('meeting');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('confirmed');
  const [reminderMins, setReminderMins] = useState<number>(15);
  const [attendees, setAttendees] = useState<string>('');
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurrenceRule['frequency']>('weekly');
  const [recurInterval, setRecurInterval] = useState(1);

  // 会议自动准备
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepResult, setPrepResult] = useState<{
    context: string;
    keyPoints: string[];
    suggestedAgenda: Array<{ item: string; durationMin: number }>;
    relatedMaterials: string[];
  } | null>(null);

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
      setLocation(editing.location || '');
      setDescription(editing.description || '');
      setStatus(editing.status);
      setReminderMins(editing.reminders?.[0]?.minutesBefore ?? 15);
      setAttendees(editing.attendees?.join(', ') ?? '');
      setHasRecurrence(!!editing.recurrence);
      setRecurFreq(editing.recurrence?.frequency ?? 'weekly');
      setRecurInterval(editing.recurrence?.interval ?? 1);
    } else {
      const base = initialDate || new Date();
      base.setMinutes(0, 0, 0);
      if (base.getHours() < 9) base.setHours(9);
      const end = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle('');
      setCalendarId(writableCals[0]?.id || '');
      setType('meeting');
      setIsAllDay(false);
      setStartDate(fmtDateInput(base.getTime()));
      setStartTime(fmtTimeInput(base.getTime()));
      setEndDate(fmtDateInput(end.getTime()));
      setEndTime(fmtTimeInput(end.getTime()));
      setLocation('');
      setDescription('');
      setStatus('confirmed');
      setReminderMins(15);
      setAttendees('');
      setHasRecurrence(false);
      setRecurFreq('weekly');
      setRecurInterval(1);
    }
    setPrepResult(null);
  }, [open, editing, initialDate, writableCals]);

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

  function handleSave() {
    const startMs = parseDateTime(startDate, startTime);
    const endMs = isAllDay
      ? new Date(endDate).setHours(23, 59, 59, 999)
      : parseDateTime(endDate, endTime);

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      alert('时间格式有误或结束时间早于开始时间');
      return;
    }

    // 冲突检测：检查与其他事件的时间重叠
    const conflicts = events.filter((e) => {
      if (editing && e.id === editing.id) return false;
      if (e.status === 'cancelled') return false;
      return startMs < e.endTime && endMs > e.startTime;
    });
    if (conflicts.length > 0 && !confirm(`检测到 ${conflicts.length} 个时间冲突:\n${conflicts.map((c) => `• ${c.title} (${new Date(c.startTime).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}-${new Date(c.endTime).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })})`).join('\n')}\n\n仍要保存吗？`)) {
      return;
    }

    const payload: Partial<CalendarEvent> = {
      title: title.trim() || '(无标题)',
      calendarId,
      type,
      isAllDay,
      startTime: startMs,
      endTime: endMs,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      status,
      attendees: attendees.trim()
        ? attendees.split(/[,;\s]+/).filter(Boolean)
        : undefined,
      reminders: reminderMins >= 0 ? [{ minutesBefore: reminderMins }] : undefined,
      recurrence: hasRecurrence
        ? { frequency: recurFreq, interval: recurInterval }
        : undefined,
    };

    if (editing) {
      const hadAttendees = (editing.attendees?.length ?? 0) > 0;
      updateEvent(editing.id, payload);
      // 如果是 meeting 且有 attendees, 发送更新通知
      if (type === 'meeting' && (hadAttendees || (payload.attendees && payload.attendees.length > 0))) {
        const updatedEvent = { ...editing, ...payload } as CalendarEvent;
        sendCalendarInvite({ event: updatedEvent, method: 'UPDATE' }).catch(() => {});
      }
    } else {
      const newEvent = addEvent({
        ...payload,
        createdBy: 'me',
      } as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>);
      // 新建 meeting 且有 attendees → 发邀请
      if (type === 'meeting' && newEvent.attendees && newEvent.attendees.length > 0) {
        sendCalendarInvite({ event: newEvent, method: 'REQUEST' }).catch(() => {});
      }
    }
    onClose();
  }

  function handleDelete() {
    if (!editing) return;
    if (confirm('确定删除此事件？')) {
      // 删除 meeting 且有 attendees → 发取消通知
      if (editing.type === 'meeting' && editing.attendees && editing.attendees.length > 0) {
        sendCalendarInvite({ event: { ...editing, status: 'cancelled' }, method: 'CANCEL' }).catch(() => {});
      }
      deleteEvent(editing.id);
      onClose();
    }
  }

  function handleDuplicate() {
    if (!editing) return;
    duplicateEvent(editing.id);
    onClose();
  }

  const selectedCal = calendars.find((c) => c.id === calendarId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-title-3">
            {editing ? '编辑事件' : '新建事件'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 标题 */}
          <div>
            <Input
              placeholder="添加标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium"
              autoFocus
            />
          </div>

          {/* 日历 + 类型 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">日历</Label>
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
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">类型</Label>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">全天</Label>
            </div>
            <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
          </div>

          {/* 时间 */}
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-muted-foreground mt-2.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1" />
                {!isAllDay && (
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">到</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1" />
                {!isAllDay && (
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
                )}
              </div>
            </div>
          </div>

          {/* 参会人 (仅 meeting 类型显示) */}
          {type === 'meeting' && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-2.5" />
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="参会人邮箱, 用逗号或空格分隔"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="flex-1"
                />
                <p className="text-[10px] text-muted-foreground">
                  保存后自动发送 ICS 日历邀请邮件
                </p>
              </div>
            </div>
          )}

          {/* 地点 */}
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-2.5" />
            <Input
              placeholder="添加地点"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* 描述 */}
          <Textarea
            placeholder="添加备注..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          {/* 提醒 */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">提醒</Label>
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

          {/* 重复 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">重复</Label>
              <Switch checked={hasRecurrence} onCheckedChange={setHasRecurrence} />
            </div>
            {hasRecurrence && (
              <div className="grid grid-cols-2 gap-2 pl-4">
                <Select value={recurFreq} onValueChange={(v) => setRecurFreq(v as RecurrenceRule['frequency'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                    <SelectItem value="yearly">每年</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">每</span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={recurInterval}
                    onChange={(e) => setRecurInterval(Math.max(1, Number(e.target.value)))}
                    className="w-16"
                  />
                  <span className="text-xs text-muted-foreground">
                    {recurFreq === 'daily' ? '天' : recurFreq === 'weekly' ? '周' : recurFreq === 'monthly' ? '月' : '年'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 状态 */}
          {editing && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EventStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="tentative">待定</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 会议自动准备 & 复盘 (仅 meeting 编辑模式) */}
          {editing && type === 'meeting' && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1 text-xs"
                  onClick={handleMeetingPrep}
                  disabled={prepLoading}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {prepLoading ? '准备中...' : '会议准备'}
                </Button>
                <MeetingRetroButton eventId={editing.id} eventEndTime={editing.endTime} />
              </div>

              {prepResult && (
                <div className="rounded-md border border-blue-200 bg-blue-50/40 p-2.5 space-y-2 text-xs">
                  <div className="font-medium text-blue-800">会前准备材料</div>
                  <p className="text-ink-secondary">{prepResult.context}</p>
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

        {/* 底部操作 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="flex items-center gap-1">
            {editing && (
              <>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-rose-500 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDuplicate}>
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              {editing ? '保存' : '创建'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
