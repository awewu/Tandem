'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useOKRStore, useOrgStore,
  type Objective, type KeyResult, type CheckIn, type Confidence,
  type ObjectiveStatus, type KRType, type Cycle, type Person,
} from '@/lib/store';
import {
  buildSnapshot, parseSnapshot, exportTitaCSV, importTitaCSV,
} from '@/lib/tita-adapter';
import { cn } from '@/lib/utils';
import {
  Target, Plus, Trash2, ChevronRight, ChevronDown, Download, Upload,
  CheckCircle2, AlertCircle, AlertTriangle, Edit2, MessageSquare,
  Calendar, User, Tag, Cloud, Save, X, Filter, FileSpreadsheet, FileJson,
  Sparkles, Stethoscope, TrendingUp, ListChecks, Award, Activity, Eye,
  BookOpen, CalendarRange, Network, Edit3,
} from 'lucide-react';
import { OKRInitiatives } from '@/components/okr/okr-initiatives';
import { OKRComments } from '@/components/okr/okr-comments';
import { OKRActivityFeed } from '@/components/okr/okr-activity';
import { OKRScoring } from '@/components/okr/okr-scoring';
import { OKRTemplatePicker } from '@/components/okr/okr-templates';
import { OKRBulkCreateDialog } from '@/components/okr/okr-bulk-create-dialog';
import { OKRTrendChart } from '@/components/okr/okr-trend-chart';
import { OKRHealthPanel } from '@/components/okr/okr-health-panel';
import { OKRDiagnosisPanel } from '@/components/okr/okr-diagnosis-panel';
import { OKRWatchers } from '@/components/okr/okr-watchers';
import { OKRTtiPanel } from '@/components/okr/okr-tti-panel';
import { OKRRetrospective } from '@/components/okr/okr-retrospective';
import { OKRMonthlyComparison } from '@/components/okr/okr-monthly-comparison';
import { OKRAlignmentTree } from '@/components/okr/okr-alignment-tree';
import { AskBossButton } from '@/components/boss-ai';
import { checkQuality } from '@/lib/okr/quality';
import { calcObjectiveScore } from '@/lib/okr/scoring';
import { objectivePulse, pulseLabel, summarizePulses, CADENCE_LABEL } from '@/lib/okr/cadence';
import {
  availableActions, applyTransition, TRANSITIONS,
  type LifecycleAction, type LifecycleActor,
} from '@/lib/okr/objective-lifecycle';
import { hasOkrApproverRole } from '@/lib/okr/visibility';
import { useCurrentUserId, useAuthStore } from '@/lib/hooks/use-current-user';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import {
  hydrateOkrFromApi,
  persistCreateObjective, persistUpdateObjective, persistDeleteObjective,
  persistCreateKeyResult, persistUpdateKeyResult, persistDeleteKeyResult,
  persistCreateCheckIn,
} from '@/lib/store/okr-sync';

// =============================================================
// 视觉小组件
// =============================================================
const CONFIDENCE_META: Record<Confidence, { label: string; color: string; ring: string; icon: React.ElementType }> = {
  'on-track': { label: '正常', color: 'bg-success', ring: 'ring-success/40', icon: CheckCircle2 },
  'at-risk': { label: '有风险', color: 'bg-warning', ring: 'ring-warning/40', icon: AlertTriangle },
  'off-track': { label: '严重偏离', color: 'bg-danger', ring: 'ring-danger/40', icon: AlertCircle },
};
const STATUS_LABEL: Record<ObjectiveStatus, string> = {
  draft: '草稿', submitted: '待审批', active: '进行中', paused: '暂停', completed: '已完成', archived: '已归档',
};
// 审批漏斗状态视觉区分: 草稿/待审批用色块突出, 其余沿用默认 secondary.
const STATUS_BADGE_CLASS: Partial<Record<ObjectiveStatus, string>> = {
  draft: 'bg-muted text-muted-foreground border-dashed',
  submitted: 'bg-warning/15 text-warning dark:text-warning border-warning/30',
};
const KR_TYPE_LABEL: Record<KRType, string> = {
  numeric: '数值', percentage: '百分比', milestone: '里程碑', binary: '是否完成',
};

// =============================================================
// 审批漏斗动作条 (对标 Tita 目标审批): 草稿→提交→通过/打回.
// owner 看到 提交/放弃; approver 看到 通过/打回; 角色叠加取并集.
// 乐观更新 (updateObjective 立即改 + 记日志), 落库失败回滚.
// =============================================================
function ApprovalActions({ objective }: { objective: Objective }) {
  const updateObjective = useOKRStore((s) => s.updateObjective);
  const meUserId = useAuthStore((s) => s.user?.id);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const [busy, setBusy] = useState<LifecycleAction | null>(null);

  const isOwner = !!meUserId && objective.ownerId === meUserId;
  const isApprover = hasOkrApproverRole(roles);

  const acts = new Set<LifecycleAction>();
  if (isOwner) availableActions(objective.status, 'owner' as LifecycleActor).forEach((a) => acts.add(a));
  if (isApprover) availableActions(objective.status, 'approver' as LifecycleActor).forEach((a) => acts.add(a));
  // 仅保留与审批漏斗强相关的动作 (提交/通过/打回); 暂停/完成/放弃走详情编辑表单, 不在动作条重复.
  const FUNNEL: LifecycleAction[] = ['submit', 'approve', 'reject'];
  const list = FUNNEL.filter((a) => acts.has(a));
  if (list.length === 0) return null;

  const run = async (action: LifecycleAction) => {
    const to = applyTransition(action);
    const prev = objective.status;
    setBusy(action);
    updateObjective(objective.id, { status: to });
    try {
      await persistUpdateObjective(objective.id, { status: to });
    } catch (err: any) {
      updateObjective(objective.id, { status: prev });
      alert(`操作失败：${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {list.map((a) => {
        const primary = a === 'submit' || a === 'approve';
        return (
          <Button
            key={a}
            size="sm"
            variant={primary ? 'default' : 'outline'}
            disabled={busy != null}
            onClick={() => run(a)}
            className="h-7 text-footnote"
          >
            {busy === a ? '处理中…' : TRANSITIONS[a].label}
          </Button>
        );
      })}
    </div>
  );
}

function ProgressBar({ value, confidence }: { value: number; confidence?: Confidence }) {
  const w = Math.max(0, Math.min(100, value));
  const color = confidence ? CONFIDENCE_META[confidence].color : 'bg-primary';
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${w}%` }} />
    </div>
  );
}

function PulseBadge({
  pulse, className,
}: { pulse: ReturnType<typeof objectivePulse> | undefined; className?: string }) {
  if (!pulse) return null;
  if (pulse.urgency === 'fresh') {
    // 新鲜状态也显示，但低调
    return (
      <Badge
        variant="outline"
        className={cn('gap-1 text-[10px] text-muted-foreground border-muted', className)}
        title={pulseLabel(pulse)}
      >
        <Calendar className="h-2.5 w-2.5" />
        {pulse.daysSinceLast == null ? `${pulse.daysToNext}天后 Check-in` : `${pulse.daysToNext}天`}
      </Badge>
    );
  }
  if (pulse.urgency === 'soon') {
    return (
      <Badge
        variant="outline"
        className={cn('gap-1 text-[10px] border-warning/50 text-warning bg-warning/5', className)}
        title={pulseLabel(pulse)}
      >
        ⏰ {pulse.daysToNext === 0 ? '今天 Check-in' : `${pulse.daysToNext}天内 Check-in`}
      </Badge>
    );
  }
  // overdue
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-[10px] border-danger/50 text-danger bg-danger/5 animate-pulse', className)}
      title={pulseLabel(pulse)}
    >
      ⚠ 逆期 {-pulse.daysToNext}天
    </Badge>
  );
}

function DetailTabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 text-footnote whitespace-nowrap border-b-2 -mb-px transition',
        active ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon size={12} /> {children}
    </button>
  );
}

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const meta = CONFIDENCE_META[confidence];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Icon className={cn('h-2.5 w-2.5', confidence === 'on-track' ? 'text-success' : confidence === 'at-risk' ? 'text-warning' : 'text-danger')} />
      {meta.label}
    </Badge>
  );
}

// =============================================================
// 主页面
// =============================================================
export default function OKRPage() {
  const store = useOKRStore();
  const {
    cycles, people, objectives, keyResults, checkIns, activeCycleId,
    addPerson, addCycle, setActiveCycleId, replaceAll,
    getObjectiveProgress, getKRProgress,
  } = store;

  const { departments } = useOrgStore();
  const ministries = departments.flatMap((d) => d.ministries);
  const { people: peopleForUi, nameOf: ownerLabel } = useOwnerDirectory();

  // 真实登录用户 id (B4 Phase-2: 新建 OKR 默认归属当前用户, 保证落库后本人可见).
  const meUser = useAuthStore((s) => s.user);
  const meUserId = meUser?.id;

  // ===== 视图状态 =====
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  type DetailTab = 'overview' | 'initiatives' | 'comments' | 'activity' | 'scoring' | 'watchers' | 'trend' | 'tti' | 'retro' | 'monthly' | 'alignment';
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterConfidence, setFilterConfidence] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ownerFilterInitializedRef = useRef(false);
  const ownerFilterPickerRef = useRef<HTMLDivElement | null>(null);
  const [ownerFilterOpen, setOwnerFilterOpen] = useState(false);
  const [ownerFilterSearch, setOwnerFilterSearch] = useState('');

  useEffect(() => {
    if (ownerFilterInitializedRef.current) return;
    if (!meUserId) return;
    const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const ownerParam = params?.get('owner') ?? null;
    const objectiveParam = params?.get('o') ?? null;
    if (objectiveParam) setSelectedObjId(objectiveParam);
    if (ownerParam === 'all') {
      setFilterOwner('');
    } else if (ownerParam && ownerParam !== 'me') {
      setFilterOwner(ownerParam);
    } else if (objectiveParam) {
      const objectiveOwner = objectives.find((o) => o.id === objectiveParam)?.ownerId;
      setFilterOwner(objectiveOwner?.startsWith('person:') ? objectiveOwner.slice(7) : objectiveOwner ?? meUserId);
    } else {
      setFilterOwner(meUserId);
    }
    ownerFilterInitializedRef.current = true;
  }, [meUserId, objectives]);

  // OKR 在同租户内公开可读; 写权限仍由后端 owner/admin 路由校验.
  const canViewAllOwners = true;

  const visibleOwnerIds = useMemo(() => {
    if (canViewAllOwners) return new Set(peopleForUi.map((p) => p.id));
    const visible = new Set([meUserId].filter(Boolean) as string[]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of peopleForUi) {
        if (!p.managerId || !visible.has(p.managerId) || visible.has(p.id)) continue;
        visible.add(p.id);
        changed = true;
      }
    }
    return visible;
  }, [canViewAllOwners, meUserId, peopleForUi]);

  const ownerFilterOptions = useMemo(() => {
    const scoped = peopleForUi.filter((p) => visibleOwnerIds.has(p.id) && !(meUserId && p.id === 'me'));
    if (!meUserId || scoped.some((p) => p.id === meUserId)) return scoped;
    return [{ id: meUserId, name: meUser?.name || meUser?.email || '我' } as Person, ...scoped];
  }, [meUser?.email, meUser?.name, meUserId, peopleForUi, visibleOwnerIds]);

  const ownerFilterItems = useMemo(() => {
    const personItems = ownerFilterOptions.map((p) => ({
      value: p.id,
      label: p.id === meUserId && p.name !== '我' ? `${p.name}（我）` : p.name,
    }));
    const allItem = canViewAllOwners ? [{ value: '__all__', label: '所有负责人' }] : [];
    const teamItems = canViewAllOwners
      ? ministries.map((m) => ({ value: `team:${m.id}`, label: `[团队] ${m.name}` }))
      : [];
    return [...allItem, ...personItems, ...teamItems];
  }, [canViewAllOwners, meUserId, ministries, ownerFilterOptions]);

  const ownerFilterLabel = useMemo(() => {
    if (!filterOwner) return canViewAllOwners ? '所有负责人' : '我的 OKR';
    return ownerFilterItems.find((item) => item.value === filterOwner)?.label ?? ownerLabel(filterOwner);
  }, [canViewAllOwners, filterOwner, ownerFilterItems, ownerLabel]);

  useEffect(() => {
    if (!ownerFilterOpen) setOwnerFilterSearch(ownerFilterLabel);
  }, [ownerFilterLabel, ownerFilterOpen]);

  useEffect(() => {
    if (!ownerFilterOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ownerFilterPickerRef.current?.contains(target)) return;
      setOwnerFilterOpen(false);
      setOwnerFilterSearch(ownerFilterLabel);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [ownerFilterLabel, ownerFilterOpen]);

  const filteredOwnerFilterItems = useMemo(() => {
    const q = ownerFilterSearch.trim().toLowerCase();
    if (!q || q === ownerFilterLabel.toLowerCase()) return ownerFilterItems;
    return ownerFilterItems.filter((item) =>
      item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q),
    );
  }, [ownerFilterItems, ownerFilterLabel, ownerFilterSearch]);

  function chooseOwnerFilter(value: string) {
    if (value === '__all__' && !canViewAllOwners) return;
    if (value !== '__all__' && !value.startsWith('team:') && !visibleOwnerIds.has(value)) return;
    if (value.startsWith('team:') && !canViewAllOwners) return;
    setFilterOwner(value === '__all__' ? '' : value);
    setOwnerFilterOpen(false);
  }

  useEffect(() => {
    if (!ownerFilterInitializedRef.current || !meUserId) return;
    if (!filterOwner && canViewAllOwners) return;
    if (!filterOwner && !canViewAllOwners) {
      setFilterOwner(meUserId);
      return;
    }
    if (filterOwner.startsWith('team:')) {
      if (!canViewAllOwners) setFilterOwner(meUserId);
      return;
    }
    if (filterOwner && !visibleOwnerIds.has(filterOwner)) setFilterOwner(meUserId);
  }, [canViewAllOwners, filterOwner, meUserId, visibleOwnerIds]);

  // ===== 当前周期下的 Objectives =====
  const cycleObjectives = useMemo(
    () => objectives.filter((o) => o.cycleId === activeCycleId),
    [objectives, activeCycleId]
  );
  const filteredObjectives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cycleObjectives.filter((o) => {
      const owner = ownerLabel(o.ownerId).toLowerCase();
      if (q) {
        if (
          !o.title.toLowerCase().includes(q) &&
          !(o.description || '').toLowerCase().includes(q) &&
          !owner.includes(q) &&
          !o.ownerId.toLowerCase().includes(q) &&
          !o.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      } else if (filterOwner && o.ownerId !== filterOwner && o.ownerId !== `person:${filterOwner}`) {
        return false;
      }
      if (filterTag && !o.tags.includes(filterTag)) return false;
      if (filterConfidence && o.confidence !== filterConfidence) return false;
      if (filterStatus && o.status !== filterStatus) return false;
      return true;
    });
  }, [cycleObjectives, filterOwner, filterTag, filterConfidence, filterStatus, search, ownerLabel]);

  const treeObjectiveIds = useMemo(() => {
    const ids = new Set<string>();
    const filteredIds = new Set(filteredObjectives.map((o) => o.id));
    const byId = new Map(cycleObjectives.map((o) => [o.id, o]));
    for (const obj of filteredObjectives) {
      const hasVisibleChild = cycleObjectives.some((o) => filteredIds.has(o.id) && o.parentId === obj.id);
      if (!obj.parentId && !hasVisibleChild) continue;
      ids.add(obj.id);
      let parentId = obj.parentId || null;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        ids.add(parent.id);
        parentId = parent.parentId || null;
      }
    }
    return ids;
  }, [cycleObjectives, filteredObjectives]);
  const objectiveById = useMemo(() => new Map(cycleObjectives.map((o) => [o.id, o])), [cycleObjectives]);
  const childCountByObjective = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of cycleObjectives) {
      if (!o.parentId) continue;
      map.set(o.parentId, (map.get(o.parentId) ?? 0) + 1);
    }
    return map;
  }, [cycleObjectives]);
  const objectivePathLabel = (obj: Objective) => {
    const parts: string[] = [];
    const visited = new Set<string>();
    let parentId = obj.parentId || null;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = objectiveById.get(parentId);
      if (!parent) {
        parts.unshift('未找到上级');
        break;
      }
      parts.unshift(parent.title);
      parentId = parent.parentId || null;
    }
    return parts.length > 0 ? parts.join(' / ') : '顶层目标';
  };

  const selected = objectives.find((o) => o.id === selectedObjId) || null;
  const selectedKRs = keyResults.filter((k) => k.objectiveId === selectedObjId);
  useEffect(() => {
    if (filteredObjectives.length === 0) {
      if (selectedObjId) setSelectedObjId(null);
      return;
    }
    if (!selectedObjId || !filteredObjectives.some((o) => o.id === selectedObjId)) {
      setSelectedObjId(filteredObjectives[0].id);
    }
  }, [filteredObjectives, selectedObjId]);
  const selectedCheckIns = useMemo(() => {
    if (!selected) return [];
    const krIds = new Set(selectedKRs.map((k) => k.id));
    return checkIns
      .filter((c) =>
        (c.scope === 'objective' && c.scopeId === selected.id) ||
        (c.scope === 'kr' && krIds.has(c.scopeId))
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [checkIns, selected, selectedKRs]);

  // 周期级别统计
  const cycleStats = useMemo(() => {
    const total = cycleObjectives.length;
    if (total === 0) return { total: 0, avgProgress: 0, onTrack: 0, atRisk: 0, offTrack: 0 };
    const progs = cycleObjectives.map((o) => getObjectiveProgress(o.id));
    const avg = Math.round(progs.reduce((a, b) => a + b, 0) / total);
    const onTrack = cycleObjectives.filter((o) => o.confidence === 'on-track').length;
    const atRisk = cycleObjectives.filter((o) => o.confidence === 'at-risk').length;
    const offTrack = cycleObjectives.filter((o) => o.confidence === 'off-track').length;
    return { total, avgProgress: avg, onTrack, atRisk, offTrack };
  }, [cycleObjectives, getObjectiveProgress]);

  // Cadence 脚本及在列表使用的 pulse 映射
  const activeCycle = cycles.find((c) => c.id === activeCycleId);
  const pulseMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof objectivePulse>>();
    if (!activeCycle) return map;
    for (const obj of cycleObjectives) {
      const krIds = keyResults.filter((k) => k.objectiveId === obj.id).map((k) => k.id);
      map.set(obj.id, objectivePulse(obj, activeCycle, checkIns, krIds));
    }
    return map;
  }, [cycleObjectives, activeCycle, keyResults, checkIns]);
  const pulseSummary = useMemo(() => summarizePulses(Array.from(pulseMap.values())), [pulseMap]);

  // 全部标签
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const o of objectives) o.tags.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [objectives]);

  // ===== 创建/编辑弹窗 =====
  const [editing, setEditing] = useState<
    | { kind: 'objective'; data: Partial<Objective>; focus?: 'alignment' }
    | { kind: 'kr'; data: Partial<KeyResult> }
    | null
  >(null);
  const [checkinFor, setCheckinFor] = useState<{ scope: 'objective' | 'kr'; scopeId: string } | null>(null);

  // B4 Phase-2: 落库 — 创建/编辑写后端, 再 hydrate 收敛到服务端真值 (含服务端 id).
  // 失败时弹错并保留弹窗内容, 不丢用户输入.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openEditDialog = (
    next:
      | { kind: 'objective'; data: Partial<Objective>; focus?: 'alignment' }
      | { kind: 'kr'; data: Partial<KeyResult> },
  ) => {
    setSaveError(null);
    setEditing(next);
  };

  const startNewObjective = (parentId?: string | null) => {
    openEditDialog({
      kind: 'objective',
      data: {
        title: '', description: '', cycleId: activeCycleId,
        ownerId: meUserId || people[0]?.id || 'me', parentId: parentId || null,
        weight: 100, status: 'active', confidence: 'on-track',
        visibility: 'public', tags: [], progressOverride: null,
      },
    });
  };
  const startEditObjective = (obj: Objective, focus?: 'alignment') => openEditDialog({ kind: 'objective', data: { ...obj }, focus });
  const startNewKR = (objectiveId: string) => {
    openEditDialog({
      kind: 'kr',
      data: {
        objectiveId, title: '', ownerId: meUserId || people[0]?.id || 'me',
        type: 'numeric', startValue: 0, currentValue: 0, targetValue: 100, unit: '',
        weight: 1, confidence: 'on-track', status: 'active', tags: [],
      },
    });
  };
  const startEditKR = (kr: KeyResult) => openEditDialog({ kind: 'kr', data: { ...kr } });

  const saveEdit = async () => {
    if (!editing || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing.kind === 'objective') {
        const d = editing.data;
        if (!d.title?.trim()) { setSaveError('目标标题必填'); return; }
        if ('id' in d && d.id) {
          await persistUpdateObjective(d.id, d);
          useOKRStore.getState().updateObjective(d.id, d);
          setSelectedObjId(d.id);
          setEditing(null);
          void hydrateOkrFromApi(true);
          return;
        } else {
          const newId = await persistCreateObjective(d);
          await hydrateOkrFromApi(true);
          if (newId) setSelectedObjId(newId);
        }
      } else {
        const d = editing.data;
        if (!d.title?.trim()) { setSaveError('KR 标题必填'); return; }
        if ('id' in d && d.id) await persistUpdateKeyResult(d.id, d);
        else await persistCreateKeyResult(d);
        await hydrateOkrFromApi(true);
      }
      setEditing(null);
    } catch (err: any) {
      setSaveError(`保存失败：${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // ===== 导入/导出 =====
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const s = useOKRStore.getState();
    const snap = buildSnapshot({
      cycles, people, objectives, keyResults, checkIns,
      initiatives: s.initiatives, comments: s.comments, activities: s.activities,
    });
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okr-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleExportCSV = () => {
    const s = useOKRStore.getState();
    const csv = exportTitaCSV({ cycles, people, objectives, keyResults, initiatives: s.initiatives });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okr-tita-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const snap = parseSnapshot(text);
          if (!confirm(`将完全替换当前 OKR 数据：${snap.objectives.length} 个目标 / ${snap.keyResults.length} 个 KR。确定继续？`)) return;
          replaceAll(snap);
          alert(`已导入 ${snap.objectives.length} 个目标 / ${snap.keyResults.length} 个 KR`);
        } else {
          const result = importTitaCSV(text, { people, cycles });
          const initCount = result.initiatives.length;
          const msg = `将合并 CSV 数据：${result.objectives.length} 个目标 / ${result.keyResults.length} 个 KR / ${initCount} 个行动项。\n` +
            (result.warnings.length > 0 ? `\n⚠️ 警告 ${result.warnings.length} 条：\n${result.warnings.slice(0, 3).join('\n')}\n` : '') +
            `\n注意：将与现有数据合并（不覆盖）。继续？`;
          if (!confirm(msg)) return;
          const s = useOKRStore.getState();
          replaceAll({
            cycles: result.cycles,
            people: result.people,
            objectives: [...objectives, ...result.objectives],
            keyResults: [...keyResults, ...result.keyResults],
            initiatives: [...s.initiatives, ...result.initiatives],
          });
          alert(`已导入 ${result.objectives.length} 个目标 / ${result.keyResults.length} 个 KR / ${initCount} 个行动项`);
        }
      } catch (err: any) {
        alert(`导入失败：${err?.message || err}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // ===== 渲染：周期切换器 =====
  const renderCycleSwitcher = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {cycles.map((c) => (
        <button
          key={c.id}
          onClick={() => setActiveCycleId(c.id)}
          className={cn(
            'px-3 py-1 text-footnote rounded-full border transition-colors',
            c.id === activeCycleId
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted'
          )}
        >
          {c.name}
        </button>
      ))}
      <Button
        size="sm" variant="ghost" className="h-6 text-footnote"
        onClick={() => {
          const name = prompt('新周期名（如 2027 / 2027-Q1）');
          if (!name?.trim()) return;
          const c = addCycle({
            name: name.trim(),
            type: name.includes('Q') ? 'quarter' : name.includes('H') ? 'half' : name.includes('-') ? 'month' : 'year',
            startDate: Date.now(), endDate: Date.now() + 90 * 86400000, isActive: false,
          });
          setActiveCycleId(c.id);
        }}
      >
        <Plus className="h-3 w-3 mr-0.5" /> 周期
      </Button>
    </div>
  );

  // ===== 渲染：树视图 =====
  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = cycleObjectives.filter((o) => treeObjectiveIds.has(o.id) && (o.parentId || null) === parentId);
    return children.map((obj) => {
      const objKRs = keyResults.filter((k) => k.objectiveId === obj.id);
      const subChildren = cycleObjectives.filter((o) => treeObjectiveIds.has(o.id) && o.parentId === obj.id);
      const hasChildren = subChildren.length > 0;
      const isExpanded = expanded.has(obj.id) || (!!search.trim() && hasChildren);
      const progress = getObjectiveProgress(obj.id);
      const isSelected = obj.id === selectedObjId;
      return (
        <div key={obj.id}>
          <div
            className={cn(
              'flex items-start gap-2 px-2 py-2 rounded cursor-pointer border border-transparent',
              isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
            )}
            style={{ marginLeft: depth * 20 }}
            onClick={() => setSelectedObjId(obj.id)}
          >
            <button
              className="text-muted-foreground hover:text-foreground mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(obj.id)) next.delete(obj.id);
                  else next.add(obj.id);
                  return next;
                });
              }}
            >
              {hasChildren || objKRs.length > 0 ? (
                isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              ) : <span className="inline-block w-3" />}
            </button>
            <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-caption truncate">{obj.title}</span>
                <ConfidencePill confidence={obj.confidence} />
                <Badge variant="secondary" className={cn('text-[10px]', STATUS_BADGE_CLASS[obj.status])}>{STATUS_LABEL[obj.status]}</Badge>
                <PulseBadge pulse={pulseMap.get(obj.id)} />
                {obj.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1"><ProgressBar value={progress} confidence={obj.confidence} /></div>
                <span className="text-footnote text-muted-foreground tabular-nums">{progress}%</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                <span><User className="h-2.5 w-2.5 inline mr-0.5" />{ownerLabel(obj.ownerId)}</span>
                <span>{objKRs.length} KR</span>
              </div>
            </div>
          </div>
          {isExpanded && objKRs.length > 0 && (
            <div className="ml-8 mt-1 space-y-1" style={{ paddingLeft: depth * 20 }}>
              {objKRs.map((kr) => {
                const krProg = getKRProgress(kr.id);
                return (
                  <div
                    key={kr.id}
                    className="flex items-center gap-2 px-2 py-1 rounded text-footnote hover:bg-muted/40"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', CONFIDENCE_META[kr.confidence].color)} />
                    <span className="flex-1 truncate">{kr.title || '(未命名 KR)'}</span>
                    <span className="text-muted-foreground tabular-nums hidden md:inline">
                      {kr.currentValue} / {kr.targetValue} {kr.unit}
                    </span>
                    <div className="w-16"><ProgressBar value={krProg} confidence={kr.confidence} /></div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{krProg}%</span>
                    {/* §P4 mobile 快速写进展: tap 跳 /report?krId=xxx 直接锚定该 KR */}
                    <a
                      href={`/report?krId=${kr.id}`}
                      className="md:hidden inline-flex items-center justify-center h-6 w-6 rounded-md text-brand-600 hover:bg-brand-50 shrink-0"
                      title="写进展 → 自动锚定到此 KR"
                      aria-label="写进展"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          {isExpanded && hasChildren && renderTree(obj.id, depth + 1)}
        </div>
      );
    });
  };

  // ===== 渲染：右侧详情 =====
  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 text-caption">
          <Target className="h-10 w-10 opacity-30" />
          选中一个目标查看详情
        </div>
      );
    }
    const progress = getObjectiveProgress(selected.id);
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h2 className="font-semibold text-headline">{selected.title}</h2>
                {selected.description && (
                  <p className="text-footnote text-muted-foreground mt-1">{selected.description}</p>
                )}
              </div>
              <AskBossButton
                variant="icon"
                prompt={`关于这个目标「${selected.title}」, 我应该怎么推进? 它跟当前公司 OKR 的关系是什么?`}
                task={`OKR Objective: ${selected.title}`}
                aria-label="问 Tandem 这个目标怎么推进"
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditObjective(selected)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger"
                onClick={async () => {
                  if (confirm(`删除目标「${selected.title}」（连同其 KR 与子目标）？`)) {
                    try {
                      await persistDeleteObjective(selected.id);
                      await hydrateOkrFromApi(true);
                      setSelectedObjId(null);
                    } catch (err: any) {
                      alert(`删除失败：${err?.message || err}`);
                    }
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <ConfidencePill confidence={selected.confidence} />
              <Badge variant="secondary" className={cn(STATUS_BADGE_CLASS[selected.status])}>{STATUS_LABEL[selected.status]}</Badge>
              <PulseBadge pulse={pulseMap.get(selected.id)} />
              <Badge variant="outline" className="gap-1">
                <User className="h-2.5 w-2.5" /> {ownerLabel(selected.ownerId)}
              </Badge>
              {selected.tags.map((t) => (
                <Badge key={t} variant="outline" className="gap-1">
                  <Tag className="h-2.5 w-2.5" />{t}
                </Badge>
              ))}
            </div>
            <div className="mt-2">
              <ApprovalActions objective={selected} />
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-footnote mb-1">
                <span className="text-muted-foreground">总进度{selected.progressOverride != null && '（已覆盖）'}</span>
                <span className="font-semibold tabular-nums">{progress}%</span>
              </div>
              <ProgressBar value={progress} confidence={selected.confidence} />
            </div>
          </div>

          {/* ===== 详情子 Tab 栏 ===== */}
          <div className="flex items-center gap-0.5 border-b text-footnote overflow-x-auto -mx-1 px-1">
            <DetailTabBtn active={detailTab === 'overview'} onClick={() => setDetailTab('overview')} icon={Target}>概览</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'initiatives'} onClick={() => setDetailTab('initiatives')} icon={ListChecks}>行动项</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'comments'} onClick={() => setDetailTab('comments')} icon={MessageSquare}>评论</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'activity'} onClick={() => setDetailTab('activity')} icon={Activity}>动态</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'trend'} onClick={() => setDetailTab('trend')} icon={TrendingUp}>趋势</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'tti'} onClick={() => setDetailTab('tti')} icon={Sparkles}>TTI</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'monthly'} onClick={() => setDetailTab('monthly')} icon={CalendarRange}>月度+MoM</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'alignment'} onClick={() => setDetailTab('alignment')} icon={Network}>对齐树</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'scoring'} onClick={() => setDetailTab('scoring')} icon={Award}>评分</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'retro'} onClick={() => setDetailTab('retro')} icon={BookOpen}>复盘</DetailTabBtn>
            <DetailTabBtn active={detailTab === 'watchers'} onClick={() => setDetailTab('watchers')} icon={Eye}>关注</DetailTabBtn>
          </div>

          {/* ===== 行动项 Tab ===== */}
          {detailTab === 'initiatives' && (
            <div className="space-y-4">
              <OKRInitiatives scope="objective" scopeId={selected.id} />
              {selectedKRs.map((kr) => (
                <div key={kr.id}>
                  <div className="text-footnote text-muted-foreground mb-1">KR · {kr.title}</div>
                  <OKRInitiatives scope="kr" scopeId={kr.id} />
                </div>
              ))}
            </div>
          )}

          {/* ===== 评论 Tab ===== */}
          {detailTab === 'comments' && (
            <OKRComments scope="objective" scopeId={selected.id} />
          )}

          {/* ===== 活动 Tab ===== */}
          {detailTab === 'activity' && (
            <OKRActivityFeed scope="objective" scopeId={selected.id} />
          )}

          {/* ===== 趋势 Tab ===== */}
          {detailTab === 'trend' && (
            <div className="space-y-4">
              <div>
                <div className="text-caption font-medium mb-2 flex items-center gap-1.5">
                  <TrendingUp size={14} /> 目标进度趋势
                </div>
                <OKRTrendChart scope="objective" objectiveId={selected.id} width={420} height={140} />
              </div>
              {selectedKRs.length > 0 && (
                <div>
                  <div className="text-caption font-medium mb-2">KR 趋势</div>
                  <div className="space-y-3">
                    {selectedKRs.map((kr) => (
                      <div key={kr.id}>
                        <div className="text-footnote mb-1">{kr.title}</div>
                        <OKRTrendChart scope="kr" krId={kr.id} width={420} height={100} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 质量诊断 */}
              <div>
                <div className="text-caption font-medium mb-2 flex items-center gap-1.5">
                  <BookOpen size={14} /> OKR 质量诊断
                </div>
                {(() => {
                  const q = checkQuality(selected, selectedKRs);
                  return (
                    <div className="border rounded p-3 text-footnote space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-title-3 font-bold">{q.score}</span>
                        <span className="text-muted-foreground">/ 100</span>
                        <span className="ml-auto">{q.summary}</span>
                      </div>
                      {q.issues.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {q.issues.map((it, i) => (
                            <li key={i} className={cn(
                              'text-[11px] pl-2 border-l-2',
                              it.level === 'error' ? 'border-danger text-danger' :
                              it.level === 'warning' ? 'border-warning text-warning' :
                              'border-info text-info'
                            )}>
                              {it.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== TTI + 月度 Tab (2026-05-10 增量补丁) ===== */}
          {detailTab === 'tti' && (
            <OKRTtiPanel
              ownerId={selected.ownerId}
              cycle={cycles.find((c) => c.id === selected.cycleId)}
              keyResults={selectedKRs}
            />
          )}

          {/* ===== 评分 Tab ===== */}
          {detailTab === 'scoring' && (
            <OKRScoring objectiveId={selected.id} />
          )}

          {/* ===== 复盘 Tab (P0.1, 2026-05-10) ===== */}
          {detailTab === 'retro' && (
            <OKRRetrospective objectiveId={selected.id} />
          )}

          {/* ===== 月度+MoM Tab (P0.3+P0.4, 2026-05-10) ===== */}
          {detailTab === 'monthly' && (
            <OKRMonthlyComparison
              objective={selected}
              cycle={cycles.find((c) => c.id === selected.cycleId)}
              keyResults={selectedKRs}
              checkIns={checkIns}
            />
          )}

          {/* ===== 对齐树 Tab (P0.2, 2026-05-10) ===== */}
          {detailTab === 'alignment' && (
            <OKRAlignmentTree
              selectedId={selected.id}
              cycleId={selected.cycleId}
              onSelect={(id) => setSelectedObjId(id)}
            />
          )}

          {/* ===== 关注 Tab ===== */}
          {detailTab === 'watchers' && (
            <OKRWatchers scope="objective" scopeId={selected.id} />
          )}

          {/* ===== 概览 Tab：原 KR + Check-in ===== */}
          {detailTab === 'overview' && <>
          {/* KR 列表 */}
          <Card>
            <CardHeader className="py-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-caption">关键结果（{selectedKRs.length}）</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-footnote" onClick={() => startNewKR(selected.id)}>
                  <Plus className="h-3 w-3 mr-0.5" /> KR
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-footnote"
                  onClick={() => setCheckinFor({ scope: 'objective', scopeId: selected.id })}
                >
                  <MessageSquare className="h-3 w-3 mr-0.5" /> Check-in
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedKRs.length === 0 && (
                <div className="text-footnote text-muted-foreground text-center py-4">
                  尚无 KR，点击「+ KR」新建
                </div>
              )}
              {selectedKRs.map((kr) => {
                const krProg = getKRProgress(kr.id);
                return (
                  <div key={kr.id} className="border rounded p-2 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-caption">{kr.title || '(未命名)'}</span>
                          <ConfidencePill confidence={kr.confidence} />
                          <Badge variant="outline" className="text-[10px]">{KR_TYPE_LABEL[kr.type]}</Badge>
                          {kr.weight !== 1 && (
                            <Badge variant="outline" className="text-[10px]">权重 {kr.weight}</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          <User className="h-2.5 w-2.5 inline mr-0.5" />
                          {ownerLabel(kr.ownerId)}
                          {kr.dueDate && (
                            <>
                              <span className="mx-1">·</span>
                              <Calendar className="h-2.5 w-2.5 inline mr-0.5" />
                              {new Date(kr.dueDate).toLocaleDateString('zh-CN')}
                            </>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditKR(kr)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                        onClick={() => setCheckinFor({ scope: 'kr', scopeId: kr.id })}>
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-danger"
                        onClick={async () => {
                          if (!confirm('删除此 KR？')) return;
                          try {
                            await persistDeleteKeyResult(kr.id);
                            await hydrateOkrFromApi(true);
                          } catch (err: any) {
                            alert(`删除失败：${err?.message || err}`);
                          }
                        }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><ProgressBar value={krProg} confidence={kr.confidence} /></div>
                      <span className="text-footnote tabular-nums text-muted-foreground w-32 text-right">
                        {kr.currentValue} / {kr.targetValue} {kr.unit} · {krProg}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Check-in 时间线 */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-caption">进度更新（{selectedCheckIns.length}）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedCheckIns.length === 0 && (
                <div className="text-footnote text-muted-foreground text-center py-4">尚无 Check-in</div>
              )}
              {selectedCheckIns.map((c) => (
                <div key={c.id} className="border-l-2 border-muted pl-2 space-y-1 text-footnote">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                    <span>·</span>
                    <span>{ownerLabel(c.authorId)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{c.progressBefore}% → {c.progressAfter}%</span>
                    <ConfidencePill confidence={c.confidenceAfter} />
                  </div>
                  {c.achievements && <div><span className="font-semibold">✅ 进展：</span>{c.achievements}</div>}
                  {c.blockers && <div><span className="font-semibold">⚠️ 障碍：</span>{c.blockers}</div>}
                  {c.nextSteps && <div><span className="font-semibold">➡️ 下一步：</span>{c.nextSteps}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
          </>}
        </div>
      </ScrollArea>
    );
  };

  // Health 折叠面板 (含 EVO-2 智能纠偏)
  const renderHealthDrawer = () => {
    if (!showHealth) return null;
    const jumpToTarget = (kind: 'objective' | 'kr', id: string) => {
      if (kind === 'objective') {
        setSelectedObjId(id);
        setDetailTab('overview');
      } else {
        const kr = keyResults.find((k) => k.id === id);
        if (kr) {
          setSelectedObjId(kr.objectiveId);
          setDetailTab('overview');
        }
      }
    };
    return (
      <div className="border-b bg-muted/30 px-4 py-3 max-h-96 overflow-auto space-y-3">
        <OKRHealthPanel cycleId={activeCycleId} onJump={jumpToTarget} />
        <OKRDiagnosisPanel
          cycleId={activeCycleId}
          onApply={(sug) => {
            // 守则: 不自动改写 OKR, 仅做"跳转 + 打开正确入口"
            const targetId = sug.action.targetId;
            const obj = cycleObjectives.find((o) => o.id === targetId);
            const kr = keyResults.find((k) => k.id === targetId);
            const scopeObjId = obj?.id ?? kr?.objectiveId ?? null;
            if (!scopeObjId) return;
            switch (sug.action.kind) {
              case 'open-checkin':
                if (kr) setCheckinFor({ scope: 'kr', scopeId: kr.id });
                else setCheckinFor({ scope: 'objective', scopeId: scopeObjId });
                break;
              case 'open-discussion':
                setSelectedObjId(scopeObjId);
                setDetailTab('comments');
                break;
              case 'open-kr-editor':
              case 'open-objective-editor':
              case 'jump-to-objective':
              case 'jump-to-kr':
              default:
                setSelectedObjId(scopeObjId);
                setDetailTab('overview');
                break;
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ===== 顶栏 ===== */}
      <div className="border-b px-3 py-2 space-y-2 shrink-0 md:px-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-headline font-semibold flex items-center gap-1.5">
            <Target className="h-5 w-5" /> OKR
          </h1>
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            {renderCycleSwitcher()}
          </div>
          <div className="flex-1" />
          {/* 主 CTA: mobile + desktop 都显示 */}
          <Button size="sm" variant="default" onClick={() => startNewObjective()}>
            <Plus className="h-3 w-3 mr-1" /> 新目标
          </Button>
          {/* 次要按钮: 仅 md+ 显示, mobile 走抽屉 (下版本补) */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-footnote" onClick={() => setShowTemplates(true)} title="从模板库新建">
              <Sparkles className="h-3 w-3 mr-1 text-warning" /> 模板库
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-footnote" onClick={() => setShowBulkCreate(true)} title="AI 起草 4 套 OKR 候选 (季初推荐)">
              <Sparkles className="h-3 w-3 mr-1 text-[rgb(var(--brand-500))]" /> AI 起草 4 套
            </Button>
            <a
              href="/okr/calibration"
              className="h-7 px-2.5 text-footnote inline-flex items-center gap-1 border rounded hover:bg-muted/40"
              title="经理一屏校准下属 OKR 评分 (季末推荐)"
            >
              <CalendarRange className="h-3 w-3" /> 校准下属
            </a>
            <Button size="sm" variant="outline" className="h-7 text-footnote" onClick={() => setShowHealth(!showHealth)} title="OKR 健康度诊断">
              <Stethoscope className="h-3 w-3 mr-1" /> 健康度
            </Button>
            <a
              href="/insights"
              className="h-7 px-2.5 text-footnote inline-flex items-center gap-1 border rounded hover:bg-muted/40"
              title="AI 智能层 · 跨模块信号"
            >
              <Sparkles className="h-3 w-3 text-brand-500" /> AI 信号
            </a>
            <div className="flex border rounded">
              <Button size="sm" variant="ghost" className="h-7 text-footnote" onClick={handleExportJSON} title="导出 JSON 全量备份">
                <FileJson className="h-3 w-3 mr-1" /> JSON
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-footnote" onClick={handleExportCSV} title="导出 Tita 兼容 CSV">
                <FileSpreadsheet className="h-3 w-3 mr-1" /> CSV
              </Button>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-footnote" onClick={() => importInputRef.current?.click()} title="导入 Tita CSV 或 JSON">
              <Upload className="h-3 w-3 mr-1" /> 导入
            </Button>
            <input ref={importInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImportFile} title="选择 Tita CSV 或 JSON 文件" />
            <Button size="sm" variant="outline" className="h-7 text-footnote" disabled title="Tita 远程同步：需要 Tita 企业 API token，未配置">
              <Cloud className="h-3 w-3 mr-1" /> 同步 Tita
            </Button>
          </div>
        </div>

        {/* mobile-only cycle switcher (独立一行, 横滚) */}
        <div className="md:hidden -mx-3 px-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max pb-0.5">
            {renderCycleSwitcher()}
          </div>
        </div>

        {/* 周期统计条 (mobile 可横滚) */}
        <div className="flex items-center gap-4 text-footnote text-muted-foreground overflow-x-auto -mx-3 px-3 pb-0.5 md:mx-0 md:px-0 md:overflow-visible">
          <span>当前周期：<span className="font-medium text-foreground">{activeCycle?.name || '—'}</span></span>
          {activeCycle && (
            <span title="Check-in 节奏（可在『新建周期』时设置）">节奏 <span className="font-medium text-foreground">{CADENCE_LABEL[activeCycle.cadence || 'weekly']}</span></span>
          )}
          <span>目标 <span className="font-medium text-foreground">{cycleStats.total}</span></span>
          <span>平均进度 <span className="font-medium text-foreground">{cycleStats.avgProgress}%</span></span>
          <span className="flex items-center gap-1" title="信心：正常">
            <span className="h-2 w-2 rounded-full bg-success" /> {cycleStats.onTrack}
          </span>
          <span className="flex items-center gap-1" title="信心：有风险">
            <span className="h-2 w-2 rounded-full bg-warning" /> {cycleStats.atRisk}
          </span>
          <span className="flex items-center gap-1" title="信心：严重偏离">
            <span className="h-2 w-2 rounded-full bg-danger" /> {cycleStats.offTrack}
          </span>
          {pulseSummary.overdue > 0 && (
            <span className="flex items-center gap-1 text-danger" title="Check-in 逆期的目标数">
              ⚠ {pulseSummary.overdue} 逆期
            </span>
          )}
          {pulseSummary.soon > 0 && (
            <span className="flex items-center gap-1 text-warning" title="未来 2 天内应做 Check-in">
              ⏰ {pulseSummary.soon} 即将
            </span>
          )}
        </div>

        {/* 过滤条 (mobile 仅显示搜索 + 视图切换, 其他隐藏) */}
        <div className="flex items-center gap-2 flex-wrap md:flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="全员搜索目标 / 描述 / 负责人..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-48 text-footnote" />
          <div ref={ownerFilterPickerRef} className="relative hidden md:block w-36">
            <input
              value={ownerFilterOpen ? ownerFilterSearch : ownerFilterLabel}
              onChange={(e) => {
                setOwnerFilterSearch(e.target.value);
                setOwnerFilterOpen(true);
              }}
              onFocus={() => {
                setOwnerFilterSearch('');
                setOwnerFilterOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOwnerFilterOpen(false);
                  return;
                }
                if (e.key === 'Enter' && filteredOwnerFilterItems[0]) {
                  e.preventDefault();
                  chooseOwnerFilter(filteredOwnerFilterItems[0].value);
                }
              }}
              placeholder="搜索负责人"
              className="h-7 w-full rounded-md border border-input bg-background px-3 text-footnote outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
            {ownerFilterOpen && (
              <div className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-soft-lg">
                {filteredOwnerFilterItems.length === 0 ? (
                  <div className="px-3 py-2 text-footnote text-muted-foreground">没有匹配的负责人</div>
                ) : (
                  filteredOwnerFilterItems.map((item) => {
                    const active = (filterOwner || '__all__') === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseOwnerFilter(item.value)}
                        className={cn(
                          'block w-full px-3 py-2 text-left text-footnote',
                          active ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <Select value={filterConfidence || '__all__'} onValueChange={(v) => setFilterConfidence(v === '__all__' ? '' : v)}>
            <SelectTrigger className="hidden md:flex h-7 w-28 text-footnote"><SelectValue placeholder="所有信心" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">所有信心</SelectItem>
              <SelectItem value="on-track">正常</SelectItem>
              <SelectItem value="at-risk">有风险</SelectItem>
              <SelectItem value="off-track">严重偏离</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
            <SelectTrigger className="hidden md:flex h-7 w-28 text-footnote"><SelectValue placeholder="所有状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">所有状态</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filterTag || '__all__'} onValueChange={(v) => setFilterTag(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-7 w-28 text-footnote"><SelectValue placeholder="所有标签" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">所有标签</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          <div className="flex border rounded">
            <Button size="sm" variant={view === 'tree' ? 'default' : 'ghost'} className="h-7 text-footnote" onClick={() => setView('tree')}>对齐树</Button>
            <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="h-7 text-footnote" onClick={() => setView('list')}>列表</Button>
          </div>
        </div>
      </div>

      {/* ===== 健康度抽屉（顶部可折叠）===== */}
      {renderHealthDrawer()}

      {/* ===== 主体 ===== */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto p-3 md:border-r">
          {filteredObjectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 text-caption">
              <Target className="h-10 w-10 opacity-30" />
              <div>{cycleObjectives.length === 0 ? '当前周期没有目标' : '没有匹配的目标'}</div>
              {cycleObjectives.length === 0 ? (
                <Button size="sm" onClick={() => startNewObjective()}>
                  <Plus className="h-3 w-3 mr-1" /> 新建第一个目标
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setFilterTag('');
                    setFilterConfidence('');
                    setFilterStatus('');
                    setFilterOwner('');
                  }}
                >
                  清空筛选
                </Button>
              )}
            </div>
          ) : view === 'tree' ? (
            treeObjectiveIds.size > 0 ? (
              <div className="space-y-1">{renderTree(null, 0)}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed bg-muted/20 text-muted-foreground gap-3 text-caption">
                <Network className="h-10 w-10 opacity-30" />
                <div className="text-center">
                  <div className="font-medium text-foreground">当前筛选下暂无对齐关系</div>
                  <div className="mt-1 text-footnote">
                    这些目标都是顶层目标，或筛选后只剩单层目标；需要在目标编辑里选择“上级目标”后才会形成对齐树。
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setView('list')}>
                  查看目标列表
                </Button>
              </div>
            )
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground md:grid-cols-[minmax(220px,1.3fr)_120px_90px_130px] lg:grid-cols-[minmax(260px,1.4fr)_minmax(180px,0.9fr)_120px_90px_130px]">
                <span>目标</span>
                <span className="hidden lg:block">对齐路径</span>
                <span className="hidden md:block">负责人</span>
                <span className="hidden md:block">结构</span>
                <span className="text-right">进度</span>
              </div>
              {filteredObjectives.map((obj) => {
                const objKRs = keyResults.filter((k) => k.objectiveId === obj.id);
                const progress = getObjectiveProgress(obj.id);
                const childCount = childCountByObjective.get(obj.id) ?? 0;
                const pathLabel = objectivePathLabel(obj);
                return (
                  <div
                    key={obj.id}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_110px] gap-3 border-b px-3 py-3 cursor-pointer transition-colors last:border-b-0 md:grid-cols-[minmax(220px,1.3fr)_120px_90px_130px] lg:grid-cols-[minmax(260px,1.4fr)_minmax(180px,0.9fr)_120px_90px_130px]',
                      obj.id === selectedObjId ? 'bg-primary/5' : 'hover:bg-muted/40'
                    )}
                    onClick={() => setSelectedObjId(obj.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <ListChecks className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-caption font-medium">{obj.title}</span>
                      </div>
                      {obj.description && (
                        <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{obj.description}</div>
                      )}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <ConfidencePill confidence={obj.confidence} />
                        <Badge variant="secondary" className={cn('text-[10px]', STATUS_BADGE_CLASS[obj.status])}>{STATUS_LABEL[obj.status]}</Badge>
                        <PulseBadge pulse={pulseMap.get(obj.id)} />
                      </div>
                    </div>
                    <div className="hidden min-w-0 items-center lg:flex">
                      <button
                        type="button"
                        className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        title={`修改对齐：${pathLabel}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedObjId(obj.id);
                          startEditObjective(obj, 'alignment');
                        }}
                      >
                        <Network className="h-3 w-3 shrink-0" />
                        <span className="truncate">{pathLabel}</span>
                      </button>
                    </div>
                    <div className="hidden items-center text-[11px] text-muted-foreground md:flex">
                      <User className="mr-1 h-3 w-3" />
                      {ownerLabel(obj.ownerId)}
                    </div>
                    <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
                      <span>{objKRs.length} KR</span>
                      <span>·</span>
                      <span>{childCount} 子目标</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex-1"><ProgressBar value={progress} confidence={obj.confidence} /></div>
                      <span className="w-10 text-right text-footnote tabular-nums text-muted-foreground">{progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* 右栏详情 (mobile 隐藏, 详情编辑走桌面; mobile 用户进入 OKR 看进度 + /report 写进展) */}
        <div className="hidden md:block w-[420px] shrink-0 bg-muted/10 overflow-hidden">{renderDetail()}</div>
      </div>

      {/* ===== 编辑弹窗 ===== */}
      {editing && (
        <EditDialog
          editing={editing}
          setEditing={setEditing}
          onSave={saveEdit}
          saving={saving}
          saveError={saveError}
          people={peopleForUi}
          ministries={ministries}
          objectives={objectives}
          activeCycleId={activeCycleId}
          ownerLabel={ownerLabel}
          onAddPerson={addPerson}
        />
      )}

      {/* ===== Check-in 弹窗 ===== */}
      {checkinFor && (
        <CheckInDialog
          target={checkinFor}
          objectives={objectives}
          keyResults={keyResults}
          getObjectiveProgress={getObjectiveProgress}
          getKRProgress={getKRProgress}
          onClose={() => setCheckinFor(null)}
          onSubmit={async (payload) => {
            try {
              await persistCreateCheckIn(payload);
              await hydrateOkrFromApi(true);
            } catch (err: any) {
              alert(`Check-in 失败：${err?.message || err}`);
            }
            setCheckinFor(null);
          }}
        />
      )}

      {/* ===== 模板库弹窗 ===== */}
      <OKRTemplatePicker
        open={showTemplates}
        cycleId={activeCycleId}
        onClose={() => setShowTemplates(false)}
        onApplied={(objId) => { setSelectedObjId(objId); setDetailTab('overview'); }}
      />

      {/* ===== AI 批量创建 OKR 候选弹窗 (vs Tita 2025 H2 #1 缺口) ===== */}
      <OKRBulkCreateDialog
        open={showBulkCreate}
        cycleId={activeCycleId}
        cycleName={cycles.find((c) => c.id === activeCycleId)?.name ?? '当前周期'}
        onClose={() => setShowBulkCreate(false)}
        onApplied={(objId) => { setSelectedObjId(objId); setDetailTab('overview'); }}
      />
    </div>
  );
}

// =============================================================
// 编辑弹窗：Objective / KR
// =============================================================
function EditDialog({
  editing, setEditing, onSave,
  saving, saveError, people, ministries, objectives, activeCycleId, ownerLabel, onAddPerson,
}: {
  editing: { kind: 'objective'; data: Partial<Objective>; focus?: 'alignment' } | { kind: 'kr'; data: Partial<KeyResult> };
  setEditing: (e: any) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  people: Person[];
  ministries: { id: string; name: string }[];
  objectives: Objective[];
  activeCycleId: string;
  ownerLabel: (id: string) => string;
  onAddPerson: (p: { name: string }) => Person;
}) {
  const isObj = editing.kind === 'objective';
  const data: any = editing.data;
  const setField = (k: string, v: any) =>
    setEditing({ ...editing, data: { ...data, [k]: v } });

  const cycleObjCandidates = objectives.filter(
    (o) => o.cycleId === activeCycleId && o.id !== data.id
  );
  const allObjCandidates = objectives.filter((o) => o.id !== data.id);
  const objCandidates = cycleObjCandidates.length > 0 ? cycleObjCandidates : allObjCandidates;
  const candidateScopeText = cycleObjCandidates.length > 0 ? '当前周期' : '全部周期';
  const [alignmentOpen, setAlignmentOpen] = useState(isObj && editing.focus === 'alignment');
  const [alignmentSearch, setAlignmentSearch] = useState('');
  const filteredObjCandidates = useMemo(() => {
    const q = alignmentSearch.trim().toLowerCase();
    if (!q) return objCandidates;
    return objCandidates.filter((o) => {
      const owner = ownerLabel(o.ownerId).toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        owner.includes(q) ||
        o.ownerId.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [alignmentSearch, objCandidates, ownerLabel]);
  const selectedParent = objCandidates.find((o) => o.id === data.parentId) || null;
  const selectedParentLabel = selectedParent ? `${ownerLabel(selectedParent.ownerId)} · ${selectedParent.title}` : '无（顶层）';

  // FP&A 锚定: 拉取 BSC KPI 候选 (供 KR.targetKpiId 选择), 仅 KR 编辑时
  const [kpiOptions, setKpiOptions] = useState<{ id: string; title: string; unit?: string | null }[]>([]);
  useEffect(() => {
    if (isObj) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/kpi', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setKpiOptions((j.kpis ?? []).map((k: any) => ({ id: k.id, title: k.title, unit: k.unit })));
        }
      } catch {
        /* ignore — 锚定为选填, 拉取失败不阻塞 KR 编辑 */
      }
    })();
    return () => { cancelled = true; };
  }, [isObj]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <Card className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-body">
            {isObj ? (data.id ? '编辑目标' : '新建目标') : (data.id ? '编辑 KR' : '新建 KR')}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto text-caption">
          <div>
            <label className="text-footnote font-medium text-muted-foreground">{isObj ? '目标标题' : 'KR 标题'} *</label>
            <Input value={data.title || ''} onChange={(e) => setField('title', e.target.value)} className="mt-1" />
          </div>

          {isObj && (
            <div>
              <label className="text-footnote font-medium text-muted-foreground">描述</label>
              <Textarea value={data.description || ''} onChange={(e) => setField('description', e.target.value)} rows={2} className="mt-1" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-footnote font-medium text-muted-foreground">负责人</label>
              <Select value={data.ownerId || ''} onValueChange={(v) => {
                if (v === '__new__') {
                  const name = prompt('新人员姓名');
                  if (name?.trim()) {
                    const p = onAddPerson({ name: name.trim() });
                    setField('ownerId', p.id);
                  }
                } else setField('ownerId', v);
              }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  {ministries.map((m) => <SelectItem key={`team:${m.id}`} value={`team:${m.id}`}>[团队] {m.name}</SelectItem>)}
                  <SelectItem value="__new__">＋ 新增人员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-footnote font-medium text-muted-foreground">信心</label>
              <Select value={data.confidence || 'on-track'} onValueChange={(v) => setField('confidence', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track">🟢 正常</SelectItem>
                  <SelectItem value="at-risk">🟡 有风险</SelectItem>
                  <SelectItem value="off-track">🔴 严重偏离</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isObj && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">状态</label>
                  <Select value={data.status || 'active'} onValueChange={(v) => setField('status', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">上级目标（对齐）</label>
                  <div
                    className="relative mt-1"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAlignmentOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-footnote transition-colors hover:bg-muted/50"
                      onClick={() => {
                        setAlignmentOpen((v) => {
                          if (!v) setAlignmentSearch('');
                          return !v;
                        });
                      }}
                    >
                      <span className="group relative min-w-0 flex-1">
                        <span className="block truncate">{selectedParentLabel}</span>
                        {selectedParent && (
                          <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-80 max-w-[min(80vw,20rem)] whitespace-normal break-words rounded-md border bg-popover p-2 text-[11px] leading-relaxed text-popover-foreground shadow-soft-lg group-hover:block">
                            {selectedParentLabel}
                          </span>
                        )}
                      </span>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', alignmentOpen && 'rotate-180')} />
                    </button>
                    {alignmentOpen && (
                      <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-soft-lg">
                        <Input
                          value={alignmentSearch}
                          onChange={(e) => setAlignmentSearch(e.target.value)}
                          placeholder={`${candidateScopeText} · 输入姓名 / 目标标题搜索`}
                          className="h-8 text-footnote"
                          autoFocus
                        />
                        <div className="mt-2 max-h-36 overscroll-contain overflow-auto">
                          <button
                            type="button"
                            className={cn(
                              'block w-full px-3 py-2 text-left text-footnote transition-colors',
                              !data.parentId ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setField('parentId', null);
                              setAlignmentSearch('');
                              setAlignmentOpen(false);
                            }}
                          >
                            无（顶层）
                          </button>
                          {filteredObjCandidates.length === 0 ? (
                            <div className="px-3 py-3 text-footnote text-muted-foreground">
                              {objCandidates.length === 0 ? '暂无可选择的上级目标' : '没有匹配的上级目标'}
                            </div>
                          ) : (
                            filteredObjCandidates.map((o) => {
                              const label = `${ownerLabel(o.ownerId)} · ${o.title}`;
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  className={cn(
                                    'group relative block w-full px-3 py-2 text-left text-footnote transition-colors',
                                    data.parentId === o.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                                  )}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setField('parentId', o.id);
                                    setAlignmentSearch('');
                                    setAlignmentOpen(false);
                                  }}
                                >
                                  <span className="block truncate font-medium">{o.title}</span>
                                  <span className="block truncate text-[11px] text-muted-foreground">{ownerLabel(o.ownerId)}</span>
                                  <span className="mt-1 hidden whitespace-normal break-words rounded-md border bg-background p-2 text-[11px] leading-relaxed text-popover-foreground shadow-soft-sm group-hover:block">
                                    {label}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-footnote font-medium text-muted-foreground">权重（0-100）</label>
                <Input type="number" min={0} max={100} value={data.weight ?? 100}
                  onChange={(e) => setField('weight', Number(e.target.value))} className="mt-1" />
              </div>
            </>
          )}

          {!isObj && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">类型</label>
                  <Select value={data.type || 'numeric'} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">数值</SelectItem>
                      <SelectItem value="percentage">百分比</SelectItem>
                      <SelectItem value="milestone">里程碑（0-100%）</SelectItem>
                      <SelectItem value="binary">是/否</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">权重</label>
                  <Input type="number" value={data.weight ?? 1} onChange={(e) => setField('weight', Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">起始</label>
                  <Input type="number" value={data.startValue ?? 0} onChange={(e) => setField('startValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">当前</label>
                  <Input type="number" value={data.currentValue ?? 0} onChange={(e) => setField('currentValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">目标</label>
                  <Input type="number" value={data.targetValue ?? 100} onChange={(e) => setField('targetValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">单位</label>
                  <Input value={data.unit || ''} placeholder="个 / % / 万元" onChange={(e) => setField('unit', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-footnote font-medium text-muted-foreground">截止日期</label>
                <Input
                  type="date"
                  value={data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => setField('dueDate', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                  className="mt-1"
                />
              </div>
              {/* FP&A 锚定: KR → BSC KPI 数据契约桥 (三省六部推演用, 选填) */}
              <div className="rounded-md border border-dashed border-brand-200 bg-brand-50/40 dark:bg-brand-900/10 p-3 space-y-2">
                <div className="text-footnote font-medium text-brand-700 dark:text-brand-600 flex items-center gap-1 flex-wrap">
                  <Network className="h-3 w-3" /> FP&amp;A 锚定 · 这个 KR 推动哪个 BSC 指标
                  <span className="text-[10px] font-normal text-muted-foreground">三省六部推演用 · 选填</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-footnote text-muted-foreground">目标 BSC KPI</label>
                    <Select
                      value={data.targetKpiId ?? '__none__'}
                      onValueChange={(v) => setField('targetKpiId', v === '__none__' ? null : v)}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="不锚定" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">不锚定</SelectItem>
                        {kpiOptions.map((k) => (
                          <SelectItem key={k.id} value={k.id}>{k.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-footnote text-muted-foreground">预期推动增量 Δ (KR 100% 时)</label>
                    <Input
                      type="number"
                      value={data.expectedKpiDelta ?? ''}
                      placeholder="如 0.3 / 1500"
                      onChange={(e) => setField('expectedKpiDelta', e.target.value === '' ? null : Number(e.target.value))}
                      className="mt-1"
                      disabled={!data.targetKpiId}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-footnote font-medium text-muted-foreground">标签（逗号分隔）</label>
            <Input
              value={(data.tags || []).join(', ')}
              onChange={(e) => setField('tags', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="例：增长, 北极星"
              className="mt-1"
            />
          </div>

        </CardContent>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-3">
          {saveError && (
            <div className="mr-auto text-footnote text-danger">
              {saveError}
            </div>
          )}
          <Button variant="outline" size="sm" disabled={saving} onClick={() => setEditing(null)}>取消</Button>
          <Button size="sm" disabled={saving} onClick={onSave}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// =============================================================
// Check-in 弹窗
// =============================================================
function CheckInDialog({
  target, objectives, keyResults, getObjectiveProgress, getKRProgress, onClose, onSubmit,
}: {
  target: { scope: 'objective' | 'kr'; scopeId: string };
  objectives: Objective[];
  keyResults: KeyResult[];
  getObjectiveProgress: (id: string) => number;
  getKRProgress: (id: string) => number;
  onClose: () => void;
  onSubmit: (payload: Omit<CheckIn, 'id' | 'createdAt'>) => void;
}) {
  const targetEntity = target.scope === 'objective'
    ? objectives.find((o) => o.id === target.scopeId)
    : keyResults.find((k) => k.id === target.scopeId);
  const targetTitle = targetEntity?.title || '';
  const progressBefore = target.scope === 'objective'
    ? getObjectiveProgress(target.scopeId)
    : getKRProgress(target.scopeId);
  const confidenceBefore = (targetEntity as any)?.confidence || 'on-track';

  const ME = useCurrentUserId();
  const [progressAfter, setProgressAfter] = useState(progressBefore);
  const [confidenceAfter, setConfidenceAfter] = useState<Confidence>(confidenceBefore);
  const [achievements, setAchievements] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-body">
            <MessageSquare className="h-4 w-4 inline mr-1" /> Check-in：{targetTitle}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-caption">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-footnote font-medium text-muted-foreground">进度（%）</label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} max={100} value={progressAfter}
                  onChange={(e) => setProgressAfter(Number(e.target.value))} />
                <span className="text-footnote text-muted-foreground whitespace-nowrap">原 {progressBefore}%</span>
              </div>
            </div>
            <div>
              <label className="text-footnote font-medium text-muted-foreground">信心</label>
              <Select value={confidenceAfter} onValueChange={(v) => setConfidenceAfter(v as Confidence)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track">🟢 正常</SelectItem>
                  <SelectItem value="at-risk">🟡 有风险</SelectItem>
                  <SelectItem value="off-track">🔴 严重偏离</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">✅ 进展（本周做了什么）</label>
            <Textarea rows={2} value={achievements} onChange={(e) => setAchievements(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">⚠️ 障碍（遇到什么困难）</label>
            <Textarea rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">➡️ 下一步</label>
            <Textarea rows={2} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={() => {
              onSubmit({
                scope: target.scope,
                scopeId: target.scopeId,
                authorId: ME,
                progressBefore,
                progressAfter,
                confidenceBefore,
                confidenceAfter,
                achievements: achievements || undefined,
                blockers: blockers || undefined,
                nextSteps: nextSteps || undefined,
              });
            }}>
              <Save className="h-3 w-3 mr-1" /> 提交
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
