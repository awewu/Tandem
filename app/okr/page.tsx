'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  BookOpen, CalendarRange, Network,
} from 'lucide-react';
import { OKRInitiatives } from '@/components/okr/okr-initiatives';
import { OKRComments } from '@/components/okr/okr-comments';
import { OKRActivityFeed } from '@/components/okr/okr-activity';
import { OKRScoring } from '@/components/okr/okr-scoring';
import { OKRTemplatePicker } from '@/components/okr/okr-templates';
import { OKRTrendChart } from '@/components/okr/okr-trend-chart';
import { OKRHealthPanel } from '@/components/okr/okr-health-panel';
import { OKRDiagnosisPanel } from '@/components/okr/okr-diagnosis-panel';
import { OKRWatchers } from '@/components/okr/okr-watchers';
import { OKRTtiPanel } from '@/components/okr/okr-tti-panel';
import { OKRRetrospective } from '@/components/okr/okr-retrospective';
import { OKRMonthlyComparison } from '@/components/okr/okr-monthly-comparison';
import { OKRAlignmentTree } from '@/components/okr/okr-alignment-tree';
import { checkQuality } from '@/lib/okr/quality';
import { calcObjectiveScore } from '@/lib/okr/scoring';
import { objectivePulse, pulseLabel, summarizePulses, CADENCE_LABEL } from '@/lib/okr/cadence';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

// =============================================================
// 视觉小组件
// =============================================================
const CONFIDENCE_META: Record<Confidence, { label: string; color: string; ring: string; icon: React.ElementType }> = {
  'on-track': { label: '正常', color: 'bg-green-500', ring: 'ring-green-500/40', icon: CheckCircle2 },
  'at-risk': { label: '有风险', color: 'bg-yellow-500', ring: 'ring-yellow-500/40', icon: AlertTriangle },
  'off-track': { label: '严重偏离', color: 'bg-red-500', ring: 'ring-red-500/40', icon: AlertCircle },
};
const STATUS_LABEL: Record<ObjectiveStatus, string> = {
  draft: '草稿', active: '进行中', paused: '暂停', completed: '已完成', archived: '已归档',
};
const KR_TYPE_LABEL: Record<KRType, string> = {
  numeric: '数值', percentage: '百分比', milestone: '里程碑', binary: '是否完成',
};

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
        className={cn('gap-1 text-[10px] border-amber-400 text-amber-700 bg-amber-50', className)}
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
      className={cn('gap-1 text-[10px] border-red-400 text-red-700 bg-red-50 animate-pulse', className)}
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
        'flex items-center gap-1 px-2.5 py-1.5 text-xs whitespace-nowrap border-b-2 -mb-px transition',
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
      <Icon className={cn('h-2.5 w-2.5', confidence === 'on-track' ? 'text-green-600' : confidence === 'at-risk' ? 'text-yellow-600' : 'text-red-600')} />
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
    addObjective, updateObjective, deleteObjective,
    addKeyResult, updateKeyResult, deleteKeyResult,
    addCheckIn, addPerson, addCycle, setActiveCycleId, replaceAll,
    getObjectiveProgress, getKRProgress,
  } = store;

  const { departments } = useOrgStore();
  const ministries = departments.flatMap((d) => d.ministries);

  // ===== 视图状态 =====
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  type DetailTab = 'overview' | 'initiatives' | 'comments' | 'activity' | 'scoring' | 'watchers' | 'trend' | 'tti' | 'retro' | 'monthly' | 'alignment';
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterConfidence, setFilterConfidence] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ===== 当前周期下的 Objectives =====
  const cycleObjectives = useMemo(
    () => objectives.filter((o) => o.cycleId === activeCycleId),
    [objectives, activeCycleId]
  );
  const filteredObjectives = useMemo(() => {
    return cycleObjectives.filter((o) => {
      if (filterOwner && o.ownerId !== filterOwner) return false;
      if (filterTag && !o.tags.includes(filterTag)) return false;
      if (filterConfidence && o.confidence !== filterConfidence) return false;
      if (filterStatus && o.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.title.toLowerCase().includes(q) && !(o.description || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [cycleObjectives, filterOwner, filterTag, filterConfidence, filterStatus, search]);

  const selected = objectives.find((o) => o.id === selectedObjId) || null;
  const selectedKRs = keyResults.filter((k) => k.objectiveId === selectedObjId);
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

  // Owner 显示名
  const ownerLabel = (id: string): string => {
    if (id?.startsWith('team:')) {
      const minId = id.slice(5);
      return `[团队] ${ministries.find((m) => m.id === minId)?.name || minId}`;
    }
    return people.find((p) => p.id === id)?.name || id || '—';
  };

  // 全部标签
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const o of objectives) o.tags.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [objectives]);

  // ===== 创建/编辑弹窗 =====
  const [editing, setEditing] = useState<{ kind: 'objective'; data: Partial<Objective> } | { kind: 'kr'; data: Partial<KeyResult> } | null>(null);
  const [checkinFor, setCheckinFor] = useState<{ scope: 'objective' | 'kr'; scopeId: string } | null>(null);

  const startNewObjective = (parentId?: string | null) => {
    setEditing({
      kind: 'objective',
      data: {
        title: '', description: '', cycleId: activeCycleId,
        ownerId: people[0]?.id || 'me', parentId: parentId || null,
        weight: 100, status: 'active', confidence: 'on-track',
        visibility: 'public', tags: [], progressOverride: null,
      },
    });
  };
  const startEditObjective = (obj: Objective) => setEditing({ kind: 'objective', data: { ...obj } });
  const startNewKR = (objectiveId: string) => {
    setEditing({
      kind: 'kr',
      data: {
        objectiveId, title: '', ownerId: people[0]?.id || 'me',
        type: 'numeric', startValue: 0, currentValue: 0, targetValue: 100, unit: '',
        weight: 1, confidence: 'on-track', status: 'active', tags: [],
      },
    });
  };
  const startEditKR = (kr: KeyResult) => setEditing({ kind: 'kr', data: { ...kr } });

  const saveEdit = () => {
    if (!editing) return;
    if (editing.kind === 'objective') {
      const d = editing.data;
      if (!d.title?.trim()) { alert('目标标题必填'); return; }
      if ('id' in d && d.id) {
        updateObjective(d.id, d);
      } else {
        const created = addObjective(d as any);
        setSelectedObjId(created.id);
      }
    } else {
      const d = editing.data;
      if (!d.title?.trim()) { alert('KR 标题必填'); return; }
      if ('id' in d && d.id) updateKeyResult(d.id, d);
      else addKeyResult(d as any);
    }
    setEditing(null);
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
            'px-3 py-1 text-xs rounded-full border transition-colors',
            c.id === activeCycleId
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted'
          )}
        >
          {c.name}
        </button>
      ))}
      <Button
        size="sm" variant="ghost" className="h-6 text-xs"
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
    const children = filteredObjectives.filter((o) => (o.parentId || null) === parentId);
    return children.map((obj) => {
      const isExpanded = expanded.has(obj.id);
      const objKRs = keyResults.filter((k) => k.objectiveId === obj.id);
      const subChildren = filteredObjectives.filter((o) => o.parentId === obj.id);
      const hasChildren = subChildren.length > 0;
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
                <span className="font-medium text-sm truncate">{obj.title}</span>
                <ConfidencePill confidence={obj.confidence} />
                <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[obj.status]}</Badge>
                <PulseBadge pulse={pulseMap.get(obj.id)} />
                {obj.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1"><ProgressBar value={progress} confidence={obj.confidence} /></div>
                <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
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
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/40"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', CONFIDENCE_META[kr.confidence].color)} />
                    <span className="flex-1 truncate">{kr.title || '(未命名 KR)'}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {kr.currentValue} / {kr.targetValue} {kr.unit}
                    </span>
                    <div className="w-16"><ProgressBar value={krProg} confidence={kr.confidence} /></div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{krProg}%</span>
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
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 text-sm">
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
                <h2 className="font-semibold text-lg">{selected.title}</h2>
                {selected.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selected.description}</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditObjective(selected)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                onClick={() => {
                  if (confirm(`删除目标「${selected.title}」（连同其 KR 与子目标）？`)) {
                    deleteObjective(selected.id);
                    setSelectedObjId(null);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <ConfidencePill confidence={selected.confidence} />
              <Badge variant="secondary">{STATUS_LABEL[selected.status]}</Badge>
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
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">总进度{selected.progressOverride != null && '（已覆盖）'}</span>
                <span className="font-semibold tabular-nums">{progress}%</span>
              </div>
              <ProgressBar value={progress} confidence={selected.confidence} />
            </div>
          </div>

          {/* ===== 详情子 Tab 栏 ===== */}
          <div className="flex items-center gap-0.5 border-b text-xs overflow-x-auto -mx-1 px-1">
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
                  <div className="text-xs text-muted-foreground mb-1">KR · {kr.title}</div>
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
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <TrendingUp size={14} /> 目标进度趋势
                </div>
                <OKRTrendChart scope="objective" objectiveId={selected.id} width={420} height={140} />
              </div>
              {selectedKRs.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">KR 趋势</div>
                  <div className="space-y-3">
                    {selectedKRs.map((kr) => (
                      <div key={kr.id}>
                        <div className="text-xs mb-1">{kr.title}</div>
                        <OKRTrendChart scope="kr" krId={kr.id} width={420} height={100} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 质量诊断 */}
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <BookOpen size={14} /> OKR 质量诊断
                </div>
                {(() => {
                  const q = checkQuality(selected, selectedKRs);
                  return (
                    <div className="border rounded p-3 text-xs space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{q.score}</span>
                        <span className="text-muted-foreground">/ 100</span>
                        <span className="ml-auto">{q.summary}</span>
                      </div>
                      {q.issues.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {q.issues.map((it, i) => (
                            <li key={i} className={cn(
                              'text-[11px] pl-2 border-l-2',
                              it.level === 'error' ? 'border-red-500 text-red-700' :
                              it.level === 'warning' ? 'border-amber-500 text-amber-700' :
                              'border-blue-500 text-blue-700'
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
              <CardTitle className="text-sm">关键结果（{selectedKRs.length}）</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startNewKR(selected.id)}>
                  <Plus className="h-3 w-3 mr-0.5" /> KR
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setCheckinFor({ scope: 'objective', scopeId: selected.id })}
                >
                  <MessageSquare className="h-3 w-3 mr-0.5" /> Check-in
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedKRs.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
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
                          <span className="font-medium text-sm">{kr.title || '(未命名)'}</span>
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
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500"
                        onClick={() => { if (confirm('删除此 KR？')) deleteKeyResult(kr.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><ProgressBar value={krProg} confidence={kr.confidence} /></div>
                      <span className="text-xs tabular-nums text-muted-foreground w-32 text-right">
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
              <CardTitle className="text-sm">进度更新（{selectedCheckIns.length}）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedCheckIns.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">尚无 Check-in</div>
              )}
              {selectedCheckIns.map((c) => (
                <div key={c.id} className="border-l-2 border-muted pl-2 space-y-1 text-xs">
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
          <h1 className="text-lg font-semibold flex items-center gap-1.5">
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
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowTemplates(true)} title="从模板库新建">
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" /> 模板库
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowHealth(!showHealth)} title="OKR 健康度诊断">
              <Stethoscope className="h-3 w-3 mr-1" /> 健康度
            </Button>
            <a
              href="/insights"
              className="h-7 px-2.5 text-xs inline-flex items-center gap-1 border rounded hover:bg-muted/40"
              title="AI 智能层 · 跨模块信号"
            >
              <Sparkles className="h-3 w-3 text-brand-500" /> AI 信号
            </a>
            <div className="flex border rounded">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleExportJSON} title="导出 JSON 全量备份">
                <FileJson className="h-3 w-3 mr-1" /> JSON
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleExportCSV} title="导出 Tita 兼容 CSV">
                <FileSpreadsheet className="h-3 w-3 mr-1" /> CSV
              </Button>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => importInputRef.current?.click()} title="导入 Tita CSV 或 JSON">
              <Upload className="h-3 w-3 mr-1" /> 导入
            </Button>
            <input ref={importInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImportFile} title="选择 Tita CSV 或 JSON 文件" />
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled title="Tita 远程同步：需要 Tita 企业 API token，未配置">
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
        <div className="flex items-center gap-4 text-xs text-muted-foreground overflow-x-auto -mx-3 px-3 pb-0.5 md:mx-0 md:px-0 md:overflow-visible">
          <span>当前周期：<span className="font-medium text-foreground">{activeCycle?.name || '—'}</span></span>
          {activeCycle && (
            <span title="Check-in 节奏（可在『新建周期』时设置）">节奏 <span className="font-medium text-foreground">{CADENCE_LABEL[activeCycle.cadence || 'weekly']}</span></span>
          )}
          <span>目标 <span className="font-medium text-foreground">{cycleStats.total}</span></span>
          <span>平均进度 <span className="font-medium text-foreground">{cycleStats.avgProgress}%</span></span>
          <span className="flex items-center gap-1" title="信心：正常">
            <span className="h-2 w-2 rounded-full bg-green-500" /> {cycleStats.onTrack}
          </span>
          <span className="flex items-center gap-1" title="信心：有风险">
            <span className="h-2 w-2 rounded-full bg-yellow-500" /> {cycleStats.atRisk}
          </span>
          <span className="flex items-center gap-1" title="信心：严重偏离">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {cycleStats.offTrack}
          </span>
          {pulseSummary.overdue > 0 && (
            <span className="flex items-center gap-1 text-red-600" title="Check-in 逆期的目标数">
              ⚠ {pulseSummary.overdue} 逆期
            </span>
          )}
          {pulseSummary.soon > 0 && (
            <span className="flex items-center gap-1 text-amber-600" title="未来 2 天内应做 Check-in">
              ⏰ {pulseSummary.soon} 即将
            </span>
          )}
        </div>

        {/* 过滤条 (mobile 仅显示搜索 + 视图切换, 其他隐藏) */}
        <div className="flex items-center gap-2 flex-wrap md:flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="搜索目标标题/描述..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-48 text-xs" />
          <Select value={filterOwner || '__all__'} onValueChange={(v) => setFilterOwner(v === '__all__' ? '' : v)}>
            <SelectTrigger className="hidden md:flex h-7 w-32 text-xs"><SelectValue placeholder="所有负责人" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">所有负责人</SelectItem>
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              {ministries.map((m) => <SelectItem key={`team:${m.id}`} value={`team:${m.id}`}>[团队] {m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterConfidence || '__all__'} onValueChange={(v) => setFilterConfidence(v === '__all__' ? '' : v)}>
            <SelectTrigger className="hidden md:flex h-7 w-28 text-xs"><SelectValue placeholder="所有信心" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">所有信心</SelectItem>
              <SelectItem value="on-track">正常</SelectItem>
              <SelectItem value="at-risk">有风险</SelectItem>
              <SelectItem value="off-track">严重偏离</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
            <SelectTrigger className="hidden md:flex h-7 w-28 text-xs"><SelectValue placeholder="所有状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">所有状态</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filterTag || '__all__'} onValueChange={(v) => setFilterTag(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="所有标签" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">所有标签</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          <div className="flex border rounded">
            <Button size="sm" variant={view === 'tree' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setView('tree')}>对齐树</Button>
            <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setView('list')}>列表</Button>
          </div>
        </div>
      </div>

      {/* ===== 健康度抽屉（顶部可折叠）===== */}
      {renderHealthDrawer()}

      {/* ===== 主体 ===== */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto p-3 md:border-r">
          {filteredObjectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 text-sm">
              <Target className="h-10 w-10 opacity-30" />
              <div>当前周期没有目标</div>
              <Button size="sm" onClick={() => startNewObjective()}>
                <Plus className="h-3 w-3 mr-1" /> 新建第一个目标
              </Button>
            </div>
          ) : view === 'tree' ? (
            <div className="space-y-1">{renderTree(null, 0)}</div>
          ) : (
            <div className="space-y-1">
              {filteredObjectives.map((obj) => {
                const objKRs = keyResults.filter((k) => k.objectiveId === obj.id);
                const progress = getObjectiveProgress(obj.id);
                return (
                  <div
                    key={obj.id}
                    className={cn(
                      'flex items-start gap-2 px-2 py-2 rounded cursor-pointer border',
                      obj.id === selectedObjId ? 'bg-primary/5 border-primary/30' : 'border-transparent hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedObjId(obj.id)}
                  >
                    <Target className="h-4 w-4 text-primary mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{obj.title}</span>
                        <ConfidencePill confidence={obj.confidence} />
                        <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[obj.status]}</Badge>
                        <PulseBadge pulse={pulseMap.get(obj.id)} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1"><ProgressBar value={progress} confidence={obj.confidence} /></div>
                        <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">{progress}%</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {ownerLabel(obj.ownerId)} · {objKRs.length} KR
                      </div>
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
          people={people}
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
          onSubmit={(payload) => { addCheckIn(payload); setCheckinFor(null); }}
        />
      )}

      {/* ===== 模板库弹窗 ===== */}
      <OKRTemplatePicker
        open={showTemplates}
        cycleId={activeCycleId}
        onClose={() => setShowTemplates(false)}
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
  people, ministries, objectives, activeCycleId, ownerLabel, onAddPerson,
}: {
  editing: { kind: 'objective'; data: Partial<Objective> } | { kind: 'kr'; data: Partial<KeyResult> };
  setEditing: (e: any) => void;
  onSave: () => void;
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

  const objCandidates = objectives.filter(
    (o) => o.cycleId === activeCycleId && o.id !== data.id
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isObj ? (data.id ? '编辑目标' : '新建目标') : (data.id ? '编辑 KR' : '新建 KR')}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{isObj ? '目标标题' : 'KR 标题'} *</label>
            <Input value={data.title || ''} onChange={(e) => setField('title', e.target.value)} className="mt-1" />
          </div>

          {isObj && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">描述</label>
              <Textarea value={data.description || ''} onChange={(e) => setField('description', e.target.value)} rows={2} className="mt-1" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">负责人</label>
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
              <label className="text-xs font-medium text-muted-foreground">信心</label>
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
                  <label className="text-xs font-medium text-muted-foreground">状态</label>
                  <Select value={data.status || 'active'} onValueChange={(v) => setField('status', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">上级目标（对齐）</label>
                  <Select value={data.parentId || '__none__'} onValueChange={(v) => setField('parentId', v === '__none__' ? null : v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">无（顶层）</SelectItem>
                      {objCandidates.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">权重（0-100）</label>
                <Input type="number" min={0} max={100} value={data.weight ?? 100}
                  onChange={(e) => setField('weight', Number(e.target.value))} className="mt-1" />
              </div>
            </>
          )}

          {!isObj && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">类型</label>
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
                  <label className="text-xs font-medium text-muted-foreground">权重</label>
                  <Input type="number" value={data.weight ?? 1} onChange={(e) => setField('weight', Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">起始</label>
                  <Input type="number" value={data.startValue ?? 0} onChange={(e) => setField('startValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">当前</label>
                  <Input type="number" value={data.currentValue ?? 0} onChange={(e) => setField('currentValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">目标</label>
                  <Input type="number" value={data.targetValue ?? 100} onChange={(e) => setField('targetValue', Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">单位</label>
                  <Input value={data.unit || ''} placeholder="个 / % / 万元" onChange={(e) => setField('unit', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">截止日期</label>
                <Input
                  type="date"
                  value={data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => setField('dueDate', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                  className="mt-1"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">标签（逗号分隔）</label>
            <Input
              value={(data.tags || []).join(', ')}
              onChange={(e) => setField('tags', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="例：增长, 北极星"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
            <Button size="sm" onClick={onSave}><Save className="h-3 w-3 mr-1" /> 保存</Button>
          </div>
        </CardContent>
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
          <CardTitle className="text-base">
            <MessageSquare className="h-4 w-4 inline mr-1" /> Check-in：{targetTitle}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">进度（%）</label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} max={100} value={progressAfter}
                  onChange={(e) => setProgressAfter(Number(e.target.value))} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">原 {progressBefore}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">信心</label>
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
            <label className="text-xs font-medium text-muted-foreground">✅ 进展（本周做了什么）</label>
            <Textarea rows={2} value={achievements} onChange={(e) => setAchievements(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">⚠️ 障碍（遇到什么困难）</label>
            <Textarea rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">➡️ 下一步</label>
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
