'use client';

/**
 * /admin/kpi/subjects · KPI 科目主数据管理工作台
 *
 * CHARTER-KPI-TTI §2.4: 科目体系动态可扩展, HR/财务/高管 (kpi.subject_admin) 管理
 * 三层默认: 一级 (Lv1) / 二级 (Lv2) / 三级 (Lv3)
 *
 * 功能:
 *   - 列表 (含软删除筛选)
 *   - 新增 (parentId 选父科目, level 自动派生)
 *   - 编辑 (改 name/description/defaultUnit/defaultScope/parent)
 *   - 软删除 (active=false), 物理删除被 405 拒绝
 *
 * 字段约束 (与 API 一致):
 *   - code 创建后不可改 (Excel 导入唯一键)
 *   - level 由 parentId 推导 (无父 = 1, 否则 = parent.level + 1)
 *   - defaultScope: bonus | monitor
 *   - defaultMeasureType: numeric | percentage | currency | count
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Plus,
  FolderTree,
  Pencil,
  Archive,
  ArchiveRestore,
  AlertCircle,
  Coins,
  Activity,
} from 'lucide-react';
import type { KpiSubject } from '@/lib/types/kpi';
import { ExcelImportExport } from '@/components/kpi/ExcelImportExport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Scope = 'bonus' | 'monitor';
type Measure = 'numeric' | 'percentage' | 'currency' | 'count';

interface SubjectFormState {
  id?: string;
  parentId?: string;
  code: string;
  name: string;
  description: string;
  defaultScope: Scope;
  defaultUnit: string;
  defaultMeasureType: Measure;
  bscPerspective?: 'financial' | 'customer' | 'process' | 'growth';
}

const EMPTY_FORM: SubjectFormState = {
  code: '',
  name: '',
  description: '',
  defaultScope: 'bonus',
  defaultUnit: '',
  defaultMeasureType: 'numeric',
};

const SCOPE_LABEL: Record<Scope, { label: string; color: string; icon: typeof Coins }> = {
  bonus: { label: '考核 (bonus)', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Coins },
  monitor: { label: '监控 (monitor)', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: Activity },
};

const MEASURE_LABEL: Record<Measure, string> = {
  numeric: '数值',
  percentage: '百分比 (%)',
  currency: '金额',
  count: '次数',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiSubjectsPage() {
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SubjectFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ------- Fetch -------

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/kpi/subjects', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setSubjects(j.subjects ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ------- Tree sort: 按 parentId 链 + code 排序, 计算缩进深度 -------

  const sorted = useMemo(() => {
    const visible = showInactive ? subjects : subjects.filter((s) => s.active);
    const byParent = new Map<string, KpiSubject[]>();
    for (const s of visible) {
      const pid = s.parentId ?? '__root__';
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(s);
    }
    Array.from(byParent.values()).forEach((arr) =>
      arr.sort((a: KpiSubject, b: KpiSubject) => a.code.localeCompare(b.code)),
    );
    const out: Array<{ subject: KpiSubject; depth: number }> = [];
    const walk = (pid: string, depth: number) => {
      const kids = byParent.get(pid) ?? [];
      for (const k of kids) {
        out.push({ subject: k, depth });
        walk(k.id, depth + 1);
      }
    };
    walk('__root__', 0);
    return out;
  }, [subjects, showInactive]);

  // 用作"父级科目"下拉选项 (排除自己, 仅含 active)
  const parentOptions = useMemo(() => {
    const exclude = form.id ? new Set<string>([form.id]) : new Set<string>();
    // 防止把自己嵌到自己的子树下: 把 form.id 的所有后代也排除
    if (form.id) {
      const children = (pid: string) => {
        for (const s of subjects) {
          if (s.parentId === pid) {
            exclude.add(s.id);
            children(s.id);
          }
        }
      };
      children(form.id);
    }
    return subjects.filter((s) => s.active && !exclude.has(s.id));
  }, [subjects, form.id]);

  const subjectName = useCallback(
    (id?: string) => (id ? subjects.find((s) => s.id === id)?.name ?? id : '—'),
    [subjects],
  );

  // ------- Submit -------

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setDialogOpen(true);
  };

  const openEdit = (s: KpiSubject) => {
    setForm({
      id: s.id,
      parentId: s.parentId,
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      defaultScope: s.defaultScope,
      defaultUnit: s.defaultUnit ?? '',
      defaultMeasureType: s.defaultMeasureType,
      bscPerspective: s.bscPerspective,
    });
    setSubmitError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/kpi/subjects/${form.id}` : '/api/kpi/subjects';
      const method = isEdit ? 'PATCH' : 'POST';
      // PATCH: 不传 code (后端拒绝改); POST: 传完整 payload
      const payload: Record<string, unknown> = isEdit
        ? {
            parentId: form.parentId || undefined,
            name: form.name,
            description: form.description || undefined,
            defaultScope: form.defaultScope,
            defaultUnit: form.defaultUnit || undefined,
            defaultMeasureType: form.defaultMeasureType,
            bscPerspective: form.bscPerspective || undefined,
          }
        : {
            parentId: form.parentId || undefined,
            code: form.code,
            name: form.name,
            description: form.description || undefined,
            defaultScope: form.defaultScope,
            defaultUnit: form.defaultUnit || undefined,
            defaultMeasureType: form.defaultMeasureType,
            bscPerspective: form.bscPerspective || undefined,
          };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (s: KpiSubject) => {
    const next = !s.active;
    const verb = next ? '恢复' : '软删除';
    if (!next && !confirm(`确认${verb}科目 "${s.code} · ${s.name}" ?`)) return;
    try {
      const r = await fetch(`/api/kpi/subjects/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (typeof j.referenceCount === 'number' && j.referenceCount > 0) {
        alert(
          `已${verb}. 注意: 仍有 ${j.referenceCount} 条 KPI 引用此科目, 历史记录可读但不可新建`,
        );
      }
      await refresh();
    } catch (e) {
      alert(`${verb}失败: ${(e as Error).message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const total = subjects.length;
  const active = subjects.filter((s) => s.active).length;
  const inactive = total - active;

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4 md:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            KPI 科目管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            动态可扩展科目树 · 默认三层 (一级/二级/三级) · 软删除保护历史 KPI 数据
            <span className="ml-2 text-footnote">CHARTER-KPI-TTI §2.4</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <ExcelImportExport
            label="科目"
            exportUrl="/api/kpi/subjects/export"
            importUrl="/api/kpi/subjects/import"
            exportFilename={`kpi-subjects-${new Date().toISOString().slice(0, 10)}.xlsx`}
            onImported={() => void refresh()}
          />
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新增科目
          </Button>
        </div>
      </header>

      {/* 统计 + 控制 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-caption">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            启用 {active}
          </Badge>
          <Badge variant="outline" className="bg-surface-1 text-ink-secondary border">
            软删 {inactive}
          </Badge>
          <Badge variant="outline">合计 {total}</Badge>
        </div>
        <div className="flex items-center gap-2 text-caption">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(v) => setShowInactive(!!v)}
          />
          <Label htmlFor="show-inactive" className="cursor-pointer text-muted-foreground">
            显示软删除
          </Label>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            加载失败: {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">科目树</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-caption text-muted-foreground">加载中…</div>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-center text-caption text-muted-foreground">
              暂无科目. 点击右上 &quot;新增科目&quot; 开始建立公司科目体系.
            </div>
          ) : (
            <table className="w-full text-caption">
              <thead className="border-b bg-muted/40 text-footnote uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium w-32">编码</th>
                  <th className="px-4 py-2 text-left font-medium">名称</th>
                  <th className="px-4 py-2 text-left font-medium w-24">层级</th>
                  <th className="px-4 py-2 text-left font-medium w-32">默认 scope</th>
                  <th className="px-4 py-2 text-left font-medium w-28">度量</th>
                  <th className="px-4 py-2 text-left font-medium w-20">单位</th>
                  <th className="px-4 py-2 text-left font-medium w-20">状态</th>
                  <th className="px-4 py-2 text-right font-medium w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ subject: s, depth }) => {
                  const Scope = SCOPE_LABEL[s.defaultScope];
                  const ScopeIcon = Scope.icon;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b last:border-0 ${s.active ? '' : 'opacity-50'}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-footnote text-muted-foreground">
                        {s.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <span style={{ paddingLeft: `${depth * 18}px` }} className="inline-block">
                          {depth > 0 && (
                            <span className="text-muted-foreground/60 mr-1">└</span>
                          )}
                          <span className="font-semibold">{s.name}</span>
                        </span>
                        {s.level === 1 && s.bscPerspective && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'ml-2 text-[10px] py-0 px-1 border',
                              s.bscPerspective === 'financial'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : s.bscPerspective === 'customer'
                                  ? 'bg-warning/5 text-warning border-warning/20'
                                  : s.bscPerspective === 'process'
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            )}
                          >
                            {s.bscPerspective === 'financial'
                              ? '📈 财务'
                              : s.bscPerspective === 'customer'
                                ? '👥 客户'
                                : s.bscPerspective === 'process'
                                  ? '⚙️ 流程'
                                  : '🧠 成长'}
                          </Badge>
                        )}
                        {s.description && (
                          <p className="text-footnote text-muted-foreground mt-0.5 ml-[18px]">
                            {s.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-footnote">
                          Lv{s.level}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`${Scope.color} text-footnote`}>
                          <ScopeIcon className="h-3 w-3 mr-1" />
                          {Scope.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {MEASURE_LABEL[s.defaultMeasureType]}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.defaultUnit || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.active ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-footnote">
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-surface-1 text-ink-secondary border text-footnote">
                            软删
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(s)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleActive(s)}
                          title={s.active ? '软删除' : '恢复'}
                        >
                          {s.active ? (
                            <Archive className="h-3.5 w-3.5" />
                          ) : (
                            <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 父级提示 */}
      {sorted.length > 0 && (
        <p className="text-footnote text-muted-foreground">
          科目树深度上限 5 层. 编码 (code) 创建后不可修改 — 它是 Excel 导入的唯一键.
        </p>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? '编辑科目' : '新增科目'}</DialogTitle>
            <DialogDescription>
              {form.id
                ? '注意: 编码 (code) 不可修改, 历史 KPI 数据完整性约束'
                : '编码 (code) 是 Excel 导入唯一键, 创建后无法修改 — 请按业务规范命名'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">
                  编码 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="REV-001"
                  value={form.code}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent">父级科目</Label>
                <Select
                  value={form.parentId ?? '__none__'}
                  onValueChange={(v) =>
                    setForm({ ...form, parentId: v === '__none__' ? undefined : v })
                  }
                >
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="一级科目 (无父级)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">一级科目 (无父级)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Lv{p.level} · {p.code} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">
                名称 <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="主营业务收入"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* 平衡记分卡维度选择 (仅一级科目需要归属) */}
            {!form.parentId && (
              <div className="space-y-1.5">
                <Label htmlFor="bsc">平衡记分卡维度归属 (BSC)</Label>
                <Select
                  value={form.bscPerspective ?? '__none__'}
                  onValueChange={(v) =>
                    setForm({ ...form, bscPerspective: v === '__none__' ? undefined : v as any })
                  }
                >
                  <SelectTrigger id="bsc">
                    <SelectValue placeholder="不属于平衡记分卡维度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不属于平衡记分卡维度</SelectItem>
                    <SelectItem value="financial">📈 财务与经营维度 (Financial)</SelectItem>
                    <SelectItem value="customer">👥 客户与市场维度 (Customer)</SelectItem>
                    <SelectItem value="process">⚙️ 内部运营流程维度 (Internal Processes)</SelectItem>
                    <SelectItem value="growth">🧠 学习与成长维度 (Learning & Growth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="desc">描述 / 计算口径</Label>
              <Textarea
                id="desc"
                rows={2}
                placeholder="可选 · 解释科目含义/计算口径"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scope">
                  默认 scope <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.defaultScope}
                  onValueChange={(v) => setForm({ ...form, defaultScope: v as Scope })}
                >
                  <SelectTrigger id="scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">考核 (bonus)</SelectItem>
                    <SelectItem value="monitor">监控 (monitor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="measure">
                  度量 <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.defaultMeasureType}
                  onValueChange={(v) => setForm({ ...form, defaultMeasureType: v as Measure })}
                >
                  <SelectTrigger id="measure">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">数值</SelectItem>
                    <SelectItem value="percentage">百分比</SelectItem>
                    <SelectItem value="currency">金额</SelectItem>
                    <SelectItem value="count">次数</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">单位</Label>
                <Input
                  id="unit"
                  placeholder="元 / % / 次"
                  value={form.defaultUnit}
                  onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })}
                />
              </div>
            </div>

            {submitError && (
              <div className="text-caption text-rose-600 flex items-center gap-1.5 bg-rose-50 px-3 py-2 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            )}

            {form.id && form.parentId && (
              <p className="text-footnote text-muted-foreground">
                父级: {subjectName(form.parentId)}. 修改 parent 会重新派生 level.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={submitting || !form.code.trim() || !form.name.trim()}
            >
              {submitting ? '保存中…' : form.id ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
