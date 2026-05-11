'use client';

/**
 * /1on1 — 主管-员工 1on1 周期对话 (OKR P1 · 2026-05-10)
 *
 * 两栏布局:
 *   - 左: 会议列表 (按时间分 即将/进行中/已完成 3 段)
 *   - 右: 详情 (双方议程 + 三段式 notes + action items + 关联 KR)
 *
 * 对标 Tita 1on1, 差异化:
 *   - 关联 KR 必填 (避免空聊, 对 OKR)
 *   - moodScore 仅主管可见 (隐私尊严, §13)
 *   - actionItems 可一键变 KR 下 Initiative (M2)
 */

import { useMemo, useState, useEffect } from 'react';
import {
  useOneOnOneStore, useOKRStore,
  type OneOnOneMeeting, type OneOnOneCadence, type OneOnOneStatus,
} from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Calendar, MessageSquare, Target, CheckCircle2, Circle,
  Trash2, Clock, User, Users, AlertCircle, ListChecks, Heart, X,
} from 'lucide-react';
import { InsightsWidget } from '@/components/insights/insights-widget';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

const CADENCE_LABEL: Record<OneOnOneCadence, string> = {
  weekly: '每周',
  biweekly: '双周',
  monthly: '每月',
  adhoc: '临时',
};

const STATUS_META: Record<OneOnOneStatus, { label: string; color: string }> = {
  scheduled: { label: '已排期', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '已取消', color: 'bg-slate-100 text-slate-500' },
  'no-show': { label: '缺席', color: 'bg-rose-100 text-rose-700' },
};

export default function OneOnOnePage() {
  const ME = useCurrentUserId();
  const { meetings, addMeeting, updateMeeting, deleteMeeting,
          addActionItem, toggleActionItem, removeActionItem } = useOneOnOneStore();
  const { people, keyResults, objectives } = useOKRStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [nowMs, setNowMs] = useState(0);
  useEffect(() => { setNowMs(Date.now()); }, []);

  // 分组: 即将 / 已完成 / 取消
  const grouped = useMemo(() => {
    const upcoming: OneOnOneMeeting[] = [];
    const done: OneOnOneMeeting[] = [];
    const other: OneOnOneMeeting[] = [];
    for (const m of [...meetings].sort((a, b) => b.scheduledAt - a.scheduledAt)) {
      if (m.status === 'scheduled') upcoming.push(m);
      else if (m.status === 'completed') done.push(m);
      else other.push(m);
    }
    return { upcoming, done, other };
  }, [meetings]);

  const selected = meetings.find((m) => m.id === selectedId) ?? null;
  const personById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 左: 列表 */}
      <aside className="w-80 border-r bg-white flex flex-col">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-violet-600" />
              1on1 对话
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              主管-员工 双向周期沟通
            </div>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> 新建
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {meetings.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              还没有 1on1 记录
              <div className="mt-1 text-[10px]">点右上角新建第一次对话</div>
            </div>
          )}

          {grouped.upcoming.length > 0 && (
            <MeetingSection
              title="即将进行"
              icon={Clock}
              items={grouped.upcoming}
              selectedId={selectedId}
              onSelect={setSelectedId}
              personById={personById}
              nowMs={nowMs}
              currentUserId={ME}
            />
          )}
          {grouped.done.length > 0 && (
            <MeetingSection
              title="已完成"
              icon={CheckCircle2}
              items={grouped.done}
              selectedId={selectedId}
              onSelect={setSelectedId}
              personById={personById}
              nowMs={nowMs}
              currentUserId={ME}
            />
          )}
          {grouped.other.length > 0 && (
            <MeetingSection
              title="其他"
              icon={X}
              items={grouped.other}
              selectedId={selectedId}
              onSelect={setSelectedId}
              personById={personById}
              nowMs={nowMs}
              currentUserId={ME}
            />
          )}
        </div>
      </aside>

      {/* 右: 详情 */}
      <main className="flex-1 overflow-y-auto">
        {showNew ? (
          <NewMeetingForm
            people={people}
            currentUserId={ME}
            onCreate={(payload) => {
              const id = addMeeting(payload);
              setSelectedId(id);
              setShowNew(false);
            }}
            onCancel={() => setShowNew(false)}
          />
        ) : selected ? (
          <MeetingDetail
            key={selected.id}
            meeting={selected}
            personById={personById}
            people={people}
            keyResults={keyResults}
            objectives={objectives}
            currentUserId={ME}
            onUpdate={(patch) => updateMeeting(selected.id, patch)}
            onDelete={() => {
              if (confirm('确认删除这次 1on1 记录?')) {
                deleteMeeting(selected.id);
                setSelectedId(null);
              }
            }}
            onAddAction={(text, assigneeId, dueDate) =>
              addActionItem(selected.id, text, assigneeId, dueDate)
            }
            onToggleAction={(itemId) => toggleActionItem(selected.id, itemId)}
            onRemoveAction={(itemId) => removeActionItem(selected.id, itemId)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                左侧选一次 1on1 查看详情
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                或点 <strong>新建</strong> 开始排期下次
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 左侧分组列表
// -----------------------------------------------------------------------------
function MeetingSection({
  title, icon: Icon, items, selectedId, onSelect, personById, nowMs, currentUserId,
}: {
  title: string;
  icon: React.ElementType;
  items: OneOnOneMeeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  personById: Map<string, string>;
  nowMs: number;
  currentUserId: string;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 bg-slate-50/60">
        <Icon className="h-2.5 w-2.5" />
        {title} ({items.length})
      </div>
      {items.map((m) => {
        const when = nowMs > 0 ? formatRelative(m.scheduledAt, nowMs) : '';
        const isSelected = selectedId === m.id;
        const other = m.managerId === currentUserId ? m.reportId : m.managerId;
        const meta = STATUS_META[m.status];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`w-full border-b border-slate-100 px-4 py-2.5 text-left transition hover:bg-muted/50 ${
              isSelected ? 'bg-violet-50/60' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-xs font-medium truncate">
                  {personById.get(other) ?? other}
                </span>
              </div>
              <Badge className={`text-[9px] h-4 px-1.5 ${meta.color} hover:${meta.color}`}>
                {meta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              <span>{when}</span>
              <span>·</span>
              <span>{CADENCE_LABEL[m.cadence]}</span>
              {m.linkedKrIds.length > 0 && (
                <>
                  <span>·</span>
                  <Target className="h-2.5 w-2.5" />
                  <span>{m.linkedKrIds.length} KR</span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 新建会议表单
// -----------------------------------------------------------------------------
function NewMeetingForm({
  people, onCreate, onCancel, currentUserId,
}: {
  people: { id: string; name: string }[];
  onCreate: (p: {
    managerId: string;
    reportId: string;
    cadence: OneOnOneCadence;
    scheduledAt: number;
  }) => void;
  onCancel: () => void;
  currentUserId: string;
}) {
  const [managerId, setManagerId] = useState(currentUserId);
  const [reportId, setReportId] = useState(people.find((p) => p.id !== currentUserId)?.id ?? '');
  const [cadence, setCadence] = useState<OneOnOneCadence>('weekly');
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const valid = managerId && reportId && managerId !== reportId && dateStr;

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="text-lg font-semibold">排期新 1on1</div>
        <div className="text-xs text-muted-foreground mt-1">
          选参与人 + 节奏 + 时间, 稍后可在详情里补议程和 KR
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">主管</Label>
            <select
              aria-label="主管"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
            >
              <option value="">选择...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">员工</Label>
            <select
              aria-label="员工"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
            >
              <option value="">选择...</option>
              {people.filter((p) => p.id !== managerId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">节奏</Label>
          <div className="flex gap-2">
            {(Object.keys(CADENCE_LABEL) as OneOnOneCadence[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={`flex-1 h-8 rounded text-xs transition ${
                  cadence === c
                    ? 'bg-violet-600 text-white'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                {CADENCE_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">计划时间</Label>
          <Input
            type="datetime-local"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onCreate({
              managerId,
              reportId,
              cadence,
              scheduledAt: new Date(dateStr).getTime(),
            });
          }}
        >
          创建
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 详情面板
// -----------------------------------------------------------------------------
function MeetingDetail({
  meeting, personById, people, keyResults, objectives, currentUserId,
  onUpdate, onDelete, onAddAction, onToggleAction, onRemoveAction,
}: {
  meeting: OneOnOneMeeting;
  personById: Map<string, string>;
  people: { id: string; name: string }[];
  keyResults: { id: string; objectiveId: string; title: string }[];
  objectives: { id: string; title: string }[];
  currentUserId: string;
  onUpdate: (patch: Partial<OneOnOneMeeting>) => void;
  onDelete: () => void;
  onAddAction: (text: string, assigneeId: string, dueDate?: number) => void;
  onToggleAction: (itemId: string) => void;
  onRemoveAction: (itemId: string) => void;
}) {
  const [actionText, setActionText] = useState('');
  const [actionAssignee, setActionAssignee] = useState(meeting.reportId);

  const isManager = currentUserId === meeting.managerId;
  const managerName = personById.get(meeting.managerId) ?? meeting.managerId;
  const reportName = personById.get(meeting.reportId) ?? meeting.reportId;
  const meta = STATUS_META[meeting.status];

  const availableKRs = keyResults.map((kr) => {
    const obj = objectives.find((o) => o.id === kr.objectiveId);
    return { ...kr, objTitle: obj?.title };
  });

  const toggleKR = (krId: string) => {
    const has = meeting.linkedKrIds.includes(krId);
    onUpdate({
      linkedKrIds: has
        ? meeting.linkedKrIds.filter((x) => x !== krId)
        : [...meeting.linkedKrIds, krId],
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {managerName} ↔ {reportName}
            </h1>
            <Badge className={`text-[10px] ${meta.color} hover:${meta.color}`}>
              {meta.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {new Date(meeting.scheduledAt).toLocaleString('zh-CN')}
            <span>·</span>
            {CADENCE_LABEL[meeting.cadence]}
          </div>
        </div>
        <div className="flex gap-2">
          {meeting.status === 'scheduled' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate({ startedAt: Date.now() })}
              >
                开始
              </Button>
              <Button
                size="sm"
                onClick={() => onUpdate({
                  status: 'completed',
                  completedAt: Date.now(),
                })}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                完成
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ status: 'cancelled' })}
              >
                取消
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete} title="删除">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* AI 信号 (员工相关 · 2026-05-10 跨模块联动) */}
      <InsightsWidget
        title="AI 信号 · 会前必读"
        subtitle={`${reportName} 相关的 OKR / 1on1 / 360 信号`}
        personId={meeting.reportId}
        severities={['critical', 'warning', 'info']}
        limit={4}
      />

      {/* 议程 (双方各写) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-blue-600" />
            议程 / Talking Points
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">
              👔 {managerName} (主管) 想聊:
            </Label>
            <Textarea
              value={meeting.agendaManager ?? ''}
              onChange={(e) => onUpdate({ agendaManager: e.target.value })}
              placeholder="· 上季度 Q 目标进展&#10;· 下一步优先级"
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">
              👤 {reportName} (员工) 想聊:
            </Label>
            <Textarea
              value={meeting.agendaReport ?? ''}
              onChange={(e) => onUpdate({ agendaReport: e.target.value })}
              placeholder="· 卡点/障碍&#10;· 职业发展想法"
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* 关联 KR */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Target className="h-4 w-4 text-amber-600" />
            关联 KR · 避免空聊 ({meeting.linkedKrIds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableKRs.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              还没创建任何 KR · 去 <a href="/okr" className="text-blue-600 underline">/okr</a> 先建
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableKRs.map((kr) => {
                const checked = meeting.linkedKrIds.includes(kr.id);
                return (
                  <label key={kr.id} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKR(kr.id)}
                      className="mt-0.5 h-3.5 w-3.5 accent-amber-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{kr.title}</div>
                      {kr.objTitle && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          O: {kr.objTitle}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 三段式 notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-violet-600" />
            会议记录 · 三段式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-[11px] text-emerald-700">✓ 进展 (Progress)</Label>
            <Textarea
              value={meeting.noteProgress ?? ''}
              onChange={(e) => onUpdate({ noteProgress: e.target.value })}
              placeholder="本周/月 完成了什么..."
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-rose-700">⚠️ 障碍 (Blockers)</Label>
            <Textarea
              value={meeting.noteBlockers ?? ''}
              onChange={(e) => onUpdate({ noteBlockers: e.target.value })}
              placeholder="遇到什么卡点, 需要什么帮助..."
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-blue-700">→ 下一步 (Next Steps)</Label>
            <Textarea
              value={meeting.noteNextSteps ?? ''}
              onChange={(e) => onUpdate({ noteNextSteps: e.target.value })}
              placeholder="下周/月 的聚焦事项..."
              rows={3}
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Action Items ({meeting.actionItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {meeting.actionItems.length === 0 && (
            <div className="text-xs text-muted-foreground py-1">
              还没有 action item
            </div>
          )}
          {meeting.actionItems.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs group">
              <button
                type="button"
                onClick={() => onToggleAction(a.id)}
                className="shrink-0"
                aria-label={a.done ? '取消完成' : '标记完成'}
              >
                {a.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-400" />
                )}
              </button>
              <div className={`flex-1 min-w-0 ${a.done ? 'line-through text-muted-foreground' : ''}`}>
                {a.text}
              </div>
              <Badge variant="outline" className="text-[9px] h-4">
                {personById.get(a.assigneeId) ?? a.assigneeId}
              </Badge>
              {a.dueDate && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(a.dueDate).toLocaleDateString('zh-CN')}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveAction(a.id)}
                className="opacity-0 group-hover:opacity-100 text-destructive"
                aria-label="删除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <div className="flex gap-1.5 pt-2 border-t">
            <Input
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="新 action item..."
              className="text-xs h-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && actionText.trim()) {
                  onAddAction(actionText.trim(), actionAssignee);
                  setActionText('');
                }
              }}
            />
            <select
              value={actionAssignee}
              onChange={(e) => setActionAssignee(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs"
              aria-label="指派给"
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!actionText.trim()}
              onClick={() => {
                onAddAction(actionText.trim(), actionAssignee);
                setActionText('');
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 主管私密笔记 + 心情评分 */}
      {isManager && (
        <Card className="border-amber-200/50 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-rose-500" />
              主管私密区 · 仅主管可见
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-[11px]">员工干劲评分 (1-5)</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onUpdate({ moodScore: meeting.moodScore === n ? undefined : n })}
                    className={`h-8 w-8 rounded text-sm transition ${
                      meeting.moodScore === n
                        ? 'bg-rose-500 text-white'
                        : 'bg-white border hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[11px]">私密笔记</Label>
              <Textarea
                value={meeting.privateManagerNote ?? ''}
                onChange={(e) => onUpdate({ privateManagerNote: e.target.value })}
                placeholder="员工本人看不到, 用于主管自己记忆..."
                rows={2}
                className="mt-1 text-xs"
              />
            </div>
            <div className="text-[10px] text-amber-700 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />
              §13 数据尊严: 此区内容永不暴露给 {reportName}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 相对时间格式
// -----------------------------------------------------------------------------
function formatRelative(ts: number, nowMs: number): string {
  const diff = ts - nowMs;
  const absHours = Math.abs(diff) / (60 * 60 * 1000);
  if (Math.abs(diff) < 60 * 60 * 1000) {
    const mins = Math.round(diff / 60000);
    return diff > 0 ? `${mins}分钟后` : `${Math.abs(mins)}分钟前`;
  }
  if (absHours < 48) {
    const h = Math.round(diff / (60 * 60 * 1000));
    return diff > 0 ? `${h}小时后` : `${Math.abs(h)}小时前`;
  }
  const d = new Date(ts);
  return d.toLocaleDateString('zh-CN');
}
