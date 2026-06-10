'use client';

/**
 * /governance/three-departments · 三省六部 · 项目治理协同
 *
 * Phase 2: 真 API 驱动 + 多战略项目 + RACI 矩阵视图
 * 详见 docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PILLAR_META,
  RACI_META,
  DEFAULT_PROJECT_ID,
  type Department,
  type GovernancePillar,
  type GovernanceProject,
  type GovernanceTemplate,
  type Ministry,
  type RaciTag,
} from '@/lib/types/governance';
import {
  Swords,
  Users,
  Plus,
  Trash2,
  Network,
  Building2,
  Info,
  Save,
  Loader2,
  LayoutGrid,
  GitBranch,
  Sparkles,
  Link as LinkIcon,
  ExternalLink,
  X,
  Target as TargetIcon,
  GitMerge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PILLAR_BADGE: Record<GovernancePillar, string> = {
  decision: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300',
  review: 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15 dark:text-warning',
  execution: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300',
};

const RACI_BADGE: Record<RaciTag, string> = {
  R: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  A: 'bg-rose-50 text-rose-700 border-rose-200',
  C: 'bg-sky-50 text-sky-700 border-sky-200',
  I: 'bg-warning/10 text-warning border-warning/30',
  O: 'bg-muted text-muted-foreground border-border',
};

const RACI_TAGS: RaciTag[] = ['R', 'A', 'C', 'I', 'O'];

type ViewMode = 'tree' | 'raci';

export default function ThreeDepartmentsPage() {
  const [projects, setProjects] = useState<GovernanceProject[]>([]);
  const [projectId, setProjectId] = useState<string>(DEFAULT_PROJECT_ID);
  const [template, setTemplate] = useState<GovernanceTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<ViewMode>('tree');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedMinId, setSelectedMinId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);
  const departments = template?.departments ?? [];
  const linkCount =
    (project?.linkedObjectiveIds?.length ?? 0) + (project?.linkedDecisionIds?.length ?? 0);

  const reloadProjects = useCallback(async () => {
    const res = await fetch('/api/governance/projects');
    const data = await res.json();
    if (data.ok) setProjects(data.items);
  }, []);

  const loadTemplate = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/governance/projects/${id}/template`);
      const data = await res.json();
      if (data.ok) {
        setTemplate(data.template);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadProjects();
  }, [reloadProjects]);

  useEffect(() => {
    void loadTemplate(projectId);
  }, [projectId, loadTemplate]);

  const patchDepartments = (next: Department[]) => {
    if (!template) return;
    setTemplate({ ...template, departments: next });
    setDirty(true);
  };

  const updateMinistry = (deptId: string, minId: string, patch: Partial<Ministry>) => {
    patchDepartments(
      departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              ministries: d.ministries.map((m) => (m.id === minId ? { ...m, ...patch } : m)),
            }
          : d,
      ),
    );
  };

  const addMinistry = (deptId: string) => {
    patchDepartments(
      departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              ministries: [
                ...d.ministries,
                {
                  id: crypto.randomUUID(),
                  name: '新职能司',
                  tag: 'custom',
                  description: '',
                  agents: [],
                  raci: 'R',
                },
              ],
            }
          : d,
      ),
    );
  };

  const removeMinistry = (deptId: string, minId: string) => {
    patchDepartments(
      departments.map((d) =>
        d.id === deptId ? { ...d, ministries: d.ministries.filter((m) => m.id !== minId) } : d,
      ),
    );
    if (selectedMinId === minId) setSelectedMinId(null);
  };

  const saveAll = async () => {
    if (!template || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/governance/projects/${projectId}/template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments }),
      });
      const data = await res.json();
      if (data.ok) {
        setTemplate(data.template);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const selectedMinistry = selectedDept?.ministries.find((m) => m.id === selectedMinId);

  return (
    <div className="flex flex-col h-full">
      {/* Hero · 概念锚定 */}
      <header className="border-b bg-gradient-to-r from-violet-50/60 via-amber-50/40 to-emerald-50/40 dark:from-violet-900/10 dark:via-amber-900/5 dark:to-emerald-900/10 px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <Network className="w-5 h-5 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-[280px]">
            <div className="text-caption font-semibold flex items-center gap-2 flex-wrap">
              三省六部 · 执行协同
              <Badge variant="outline" className="text-[10px] font-normal">
                重大公司级工作
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              <strong>事业项目 / 重大公司级工作 / 执行项目组</strong>的协同骨架 · 中书 (提案) →
              门下 (审议) → 尚书六部 (执行) · 锚定 OKR 战略执行 ·{' '}
              <Link href="/admin/organization" className="text-violet-600 hover:underline">
                员工部门 (HR) →
              </Link>
            </p>
          </div>

          {/* 项目选择器 */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-muted-foreground">战略项目:</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-8 w-[220px] text-footnote">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-footnote">
                    {p.name}
                    {p.status !== 'active' && (
                      <span className="ml-1 text-muted-foreground">({p.status})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-footnote"
              onClick={() => setShowNewProject(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              新项目
            </Button>
          </div>

          {/* 视图切换 + 保存 */}
          <div className="w-full flex items-center justify-between gap-2 mt-1">
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => setView('tree')}
                className={cn(
                  'px-3 py-1 text-footnote rounded transition-colors flex items-center gap-1',
                  view === 'tree' ? 'bg-background shadow-soft-sm' : 'text-muted-foreground',
                )}
              >
                <GitBranch className="w-3 h-3" />
                树形视图
              </button>
              <button
                onClick={() => setView('raci')}
                className={cn(
                  'px-3 py-1 text-footnote rounded transition-colors flex items-center gap-1',
                  view === 'raci' ? 'bg-background shadow-soft-sm' : 'text-muted-foreground',
                )}
              >
                <LayoutGrid className="w-3 h-3" />
                RACI 矩阵
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {project?.northStar && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-warning" />
                  {project.northStar}
                </span>
              )}
              {project && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-footnote"
                  onClick={() => setShowLinks(true)}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  闭环看板
                  {linkCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                      {linkCount}
                    </Badge>
                  )}
                </Button>
              )}
              {dirty && (
                <Button size="sm" onClick={saveAll} disabled={saving} className="h-7 text-footnote">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  保存修改
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* New Project Dialog · 简易内联 */}
      {showNewProject && (
        <NewProjectDialog
          onClose={() => setShowNewProject(false)}
          onCreated={async (id) => {
            await reloadProjects();
            setProjectId(id);
            setShowNewProject(false);
          }}
          sourceProjects={projects}
        />
      )}

      {/* Links Drawer · 闭环看板 (OKR / 决议关联) */}
      {showLinks && project && (
        <LinksDrawer
          project={project}
          onClose={() => setShowLinks(false)}
          onChange={async () => {
            await reloadProjects();
          }}
        />
      )}

      {/* 主体 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-caption">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          加载模板…
        </div>
      ) : view === 'raci' ? (
        <RaciMatrix
          departments={departments}
          onUpdateMinistry={(deptId, minId, patch) => updateMinistry(deptId, minId, patch)}
        />
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* 左 · 树 */}
          <div className="w-72 border-r flex flex-col">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-caption flex items-center gap-2">
                <Swords className="h-4 w-4" />
                治理结构
              </h2>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-3">
                {departments.map((dept) => (
                  <div key={dept.id}>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-md text-caption font-medium cursor-pointer flex items-center justify-between gap-2',
                        selectedDeptId === dept.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                      )}
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        setSelectedMinId(null);
                      }}
                    >
                      <span>{dept.name}</span>
                      {dept.pillar && (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] h-4 px-1.5', PILLAR_BADGE[dept.pillar])}
                        >
                          {PILLAR_META[dept.pillar].short}
                        </Badge>
                      )}
                    </div>
                    <div className="ml-3 mt-1 space-y-0.5">
                      {dept.ministries.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            'flex items-center justify-between px-3 py-1.5 rounded-md text-footnote cursor-pointer',
                            selectedMinId === m.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted text-muted-foreground',
                          )}
                          onClick={() => {
                            setSelectedDeptId(dept.id);
                            setSelectedMinId(m.id);
                          }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="truncate">{m.name}</span>
                          </span>
                          {m.raci && (
                            <Badge variant="outline" className={cn('text-[9px] h-4 px-1', RACI_BADGE[m.raci])}>
                              {m.raci}
                            </Badge>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-footnote h-7"
                        onClick={() => addMinistry(dept.id)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        添加职能司
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* 右 · 详情 */}
          <div className="flex-1 p-6 overflow-auto">
            {selectedMinistry && selectedDept ? (
              <MinistryEditor
                dept={selectedDept}
                ministry={selectedMinistry}
                onPatch={(p) => updateMinistry(selectedDept.id, selectedMinistry.id, p)}
                onDelete={() => removeMinistry(selectedDept.id, selectedMinistry.id)}
              />
            ) : selectedDept ? (
              <DepartmentSummary dept={selectedDept} onPick={setSelectedMinId} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center max-w-md mx-auto">
                <Building2 className="h-12 w-12 opacity-20" />
                <p className="mt-3 text-caption font-medium">选择左侧三省 / 六部查看与配置</p>
                <p className="text-footnote mt-1 max-w-xs leading-relaxed">
                  {projectId === DEFAULT_PROJECT_ID
                    ? '当前是公司级总治理模板。新建战略项目时会以此为种子复制。'
                    : '当前项目独立模板, 修改不影响公司级总模板。'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · MinistryEditor
// ---------------------------------------------------------------------------

function MinistryEditor({
  dept,
  ministry,
  onPatch,
  onDelete,
}: {
  dept: Department;
  ministry: Ministry;
  onPatch: (p: Partial<Ministry>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-headline flex items-center gap-2 flex-wrap">
            {ministry.name}
            {dept.pillar && (
              <Badge variant="outline" className={cn('text-[10px]', PILLAR_BADGE[dept.pillar])}>
                {PILLAR_META[dept.pillar].label}
              </Badge>
            )}
            {ministry.raci && (
              <Badge variant="outline" className={cn('text-[10px]', RACI_BADGE[ministry.raci])}>
                {RACI_META[ministry.raci].full}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-caption font-medium">名称</label>
            <Input value={ministry.name} onChange={(e) => onPatch({ name: e.target.value })} />
          </div>
          <div>
            <label className="text-caption font-medium">短标签 (tag)</label>
            <Input value={ministry.tag} onChange={(e) => onPatch({ tag: e.target.value })} />
          </div>
          <div>
            <label className="text-caption font-medium">职能说明</label>
            <Textarea
              value={ministry.description}
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-caption font-medium">RACI 责任</label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {RACI_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onPatch({ raci: tag })}
                  className={cn(
                    'px-3 py-1 rounded-full text-footnote border transition-colors',
                    ministry.raci === tag
                      ? RACI_BADGE[tag] + ' font-medium'
                      : 'bg-background border-border hover:border-primary/40 text-muted-foreground',
                  )}
                  title={RACI_META[tag].full}
                >
                  {tag} · {RACI_META[tag].full.split(' · ')[1]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-caption font-medium">
              在本项目中负责
              <span className="text-[10px] text-muted-foreground ml-1 font-normal">RACI 视角</span>
            </label>
            <Textarea
              placeholder="例: 为本项目负责安全合规审查, 把关接口设计是否符合等保 2.0"
              value={ministry.purpose ?? ''}
              onChange={(e) => onPatch({ purpose: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              删除该职能司
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · DepartmentSummary
// ---------------------------------------------------------------------------

function DepartmentSummary({ dept, onPick }: { dept: Department; onPick: (id: string) => void }) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {dept.name}
          {dept.pillar && (
            <Badge variant="outline" className={cn('text-footnote', PILLAR_BADGE[dept.pillar])}>
              {PILLAR_META[dept.pillar].label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-caption text-muted-foreground">下辖 {dept.ministries.length} 个职能司.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dept.ministries.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer hover:border-primary/50"
              onClick={() => onPick(m.id)}
            >
              <CardContent className="p-4">
                <div className="font-medium text-caption flex items-center justify-between">
                  {m.name}
                  {m.raci && (
                    <Badge variant="outline" className={cn('text-[10px]', RACI_BADGE[m.raci])}>
                      {m.raci}
                    </Badge>
                  )}
                </div>
                <div className="text-footnote text-muted-foreground mt-1 line-clamp-2">{m.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · RaciMatrix
// ---------------------------------------------------------------------------

function RaciMatrix({
  departments,
  onUpdateMinistry,
}: {
  departments: Department[];
  onUpdateMinistry: (deptId: string, minId: string, patch: Partial<Ministry>) => void;
}) {
  const rows = useMemo(
    () =>
      departments.flatMap((d) =>
        d.ministries.map((m) => ({ dept: d, ministry: m })),
      ),
    [departments],
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="text-body flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            RACI 责任矩阵
            <span className="text-footnote text-muted-foreground font-normal ml-2">
              点击对应字母切换该职能司的 RACI 角色
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-caption border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium text-footnote text-muted-foreground w-32">省</th>
                <th className="text-left py-2 px-3 font-medium text-footnote text-muted-foreground">职能司</th>
                <th className="text-left py-2 px-3 font-medium text-footnote text-muted-foreground">职责说明</th>
                {RACI_TAGS.map((tag) => (
                  <th key={tag} className="text-center py-2 px-1 font-medium text-footnote w-12">
                    <span
                      title={RACI_META[tag].full}
                      className={cn(
                        'inline-block w-7 h-7 rounded-full border text-footnote leading-7',
                        RACI_BADGE[tag],
                      )}
                    >
                      {tag}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dept, ministry }, i) => {
                const newDept = i === 0 || rows[i - 1].dept.id !== dept.id;
                return (
                  <tr key={`${dept.id}-${ministry.id}`} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 align-top">
                      {newDept && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{dept.name}</span>
                          {dept.pillar && (
                            <Badge variant="outline" className={cn('text-[10px]', PILLAR_BADGE[dept.pillar])}>
                              {PILLAR_META[dept.pillar].short}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 align-top font-medium">{ministry.name}</td>
                    <td className="py-2 px-3 align-top text-footnote text-muted-foreground max-w-md">
                      {ministry.purpose || ministry.description || '—'}
                    </td>
                    {RACI_TAGS.map((tag) => {
                      const active = ministry.raci === tag;
                      return (
                        <td key={tag} className="text-center py-2 px-1 align-top">
                          <button
                            onClick={() => onUpdateMinistry(dept.id, ministry.id, { raci: tag })}
                            className={cn(
                              'w-7 h-7 rounded-full border text-footnote transition-all',
                              active
                                ? RACI_BADGE[tag] + ' font-bold scale-110'
                                : 'border-dashed border-border hover:border-solid hover:border-primary/40 text-muted-foreground/40',
                            )}
                          >
                            {active ? tag : '·'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-muted-foreground">
            {RACI_TAGS.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5">
                <span className={cn('w-5 h-5 rounded-full border text-center text-footnote leading-5', RACI_BADGE[tag])}>
                  {tag}
                </span>
                {RACI_META[tag].full}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · NewProjectDialog
// ---------------------------------------------------------------------------

function NewProjectDialog({
  onClose,
  onCreated,
  sourceProjects,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  sourceProjects: GovernanceProject[];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [northStar, setNorthStar] = useState('');
  const [copyFrom, setCopyFrom] = useState(DEFAULT_PROJECT_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/governance/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          northStar: northStar || undefined,
          copyFromProjectId: copyFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '创建失败');
        return;
      }
      onCreated(data.project.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-body flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新建战略项目
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-footnote font-medium text-muted-foreground">项目名称 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如: Q3 客户成功升级" />
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">一句话简介</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="选填"
            />
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">北极星指标</label>
            <Input
              value={northStar}
              onChange={(e) => setNorthStar(e.target.value)}
              placeholder="如: NPS ≥ 60 / 签约 100 客户"
            />
          </div>
          <div>
            <label className="text-footnote font-medium text-muted-foreground">从哪个项目复制模板</label>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-footnote text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-2 py-1.5 rounded">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button size="sm" onClick={submit} disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              创建
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · LinksDrawer · 闭环看板 (战略项目 ↔ OKR / 决议)
// ---------------------------------------------------------------------------

interface DecisionRef {
  id: string;
  title: string;
  state?: string;
  createdAt?: string;
}

function LinksDrawer({
  project,
  onClose,
  onChange,
}: {
  project: GovernanceProject;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  // OKR 仍是 zustand 客户端 (Phase 3 后续后端化), 这里 dynamic import 避免 SSR 报错
  const [okrItems, setOkrItems] = useState<{ id: string; title: string }[]>([]);
  const [decisionPool, setDecisionPool] = useState<DecisionRef[]>([]);
  const [busy, setBusy] = useState(false);

  // 加载 OKR (从 zustand · 仅客户端)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const m = await import('@/lib/store');
        if (cancelled) return;
        const objs = m.useOKRStore.getState().objectives;
        setOkrItems(objs.map((o) => ({ id: o.id, title: o.title })));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 加载决议候选池
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/convergence');
        const d = await r.json();
        if (Array.isArray(d.cards)) {
          setDecisionPool(
            d.cards.map((c: { id: string; title: string; convergenceState?: string; createdAt?: string }) => ({
              id: c.id,
              title: c.title,
              state: c.convergenceState,
              createdAt: c.createdAt,
            })),
          );
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const linkedObj = project.linkedObjectiveIds ?? [];
  const linkedDc = project.linkedDecisionIds ?? [];

  async function add(kind: 'objective' | 'decision', targetId: string) {
    setBusy(true);
    try {
      await fetch(`/api/governance/projects/${project.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, targetId }),
      });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: 'objective' | 'decision', targetId: string) {
    setBusy(true);
    try {
      await fetch(
        `/api/governance/projects/${project.id}/links?kind=${kind}&targetId=${encodeURIComponent(targetId)}`,
        { method: 'DELETE' },
      );
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  const okrUnlinked = okrItems.filter((o) => !linkedObj.includes(o.id));
  const dcUnlinked = decisionPool.filter((d) => !linkedDc.includes(d.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-md h-full bg-background border-l shadow-soft-xl flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="text-caption font-semibold flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-violet-600" />
              闭环看板
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">
              {project.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            disabled={busy}
            title="关闭"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* OKR 区 */}
          <section>
            <h3 className="text-footnote font-semibold flex items-center gap-1.5 mb-2 text-muted-foreground">
              <TargetIcon className="w-3.5 h-3.5" />
              关联 OKR Objective ({linkedObj.length})
            </h3>
            <div className="space-y-1.5">
              {linkedObj.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">暂无关联</p>
              )}
              {linkedObj.map((id) => {
                const o = okrItems.find((x) => x.id === id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-footnote"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <TargetIcon className="w-3 h-3 shrink-0 text-emerald-600" />
                      <span className="truncate">{o?.title ?? id}</span>
                      {!o && (
                        <Badge variant="outline" className="text-[9px]">
                          已删除?
                        </Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href="/okr"
                        className="text-muted-foreground hover:text-foreground"
                        title="去 OKR 页"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => remove('objective', id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        title="移除关联"
                        aria-label="移除关联"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {okrUnlinked.length > 0 && (
              <Select
                onValueChange={(val) => {
                  if (val) void add('objective', val);
                }}
              >
                <SelectTrigger className="mt-2 h-8 text-footnote">
                  <SelectValue placeholder="+ 添加 OKR…" />
                </SelectTrigger>
                <SelectContent>
                  {okrUnlinked.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-footnote">
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {okrItems.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                还没创建 OKR ?{' '}
                <Link href="/okr" className="text-violet-600 hover:underline">
                  去 /okr →
                </Link>
              </p>
            )}
          </section>

          {/* 决议区 */}
          <section>
            <h3 className="text-footnote font-semibold flex items-center gap-1.5 mb-2 text-muted-foreground">
              <GitMerge className="w-3.5 h-3.5" />
              关联决议卡 ({linkedDc.length})
            </h3>
            <div className="space-y-1.5">
              {linkedDc.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">暂无关联</p>
              )}
              {linkedDc.map((id) => {
                const d = decisionPool.find((x) => x.id === id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/40 text-footnote"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <GitMerge className="w-3 h-3 shrink-0 text-violet-600" />
                      <span className="truncate">{d?.title ?? id}</span>
                      {d?.state && (
                        <Badge variant="outline" className="text-[9px]">
                          {d.state}
                        </Badge>
                      )}
                      {!d && (
                        <Badge variant="outline" className="text-[9px]">
                          已删除?
                        </Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/convergence/${id}`}
                        className="text-muted-foreground hover:text-foreground"
                        title="去议事室"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => remove('decision', id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        title="移除关联"
                        aria-label="移除关联"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {dcUnlinked.length > 0 && (
              <Select
                onValueChange={(val) => {
                  if (val) void add('decision', val);
                }}
              >
                <SelectTrigger className="mt-2 h-8 text-footnote">
                  <SelectValue placeholder="+ 添加决议卡…" />
                </SelectTrigger>
                <SelectContent>
                  {dcUnlinked.slice(0, 30).map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-footnote">
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {decisionPool.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                还没有议事室 ?{' '}
                <Link href="/convergence" className="text-violet-600 hover:underline">
                  去 /convergence →
                </Link>
              </p>
            )}
          </section>

          {/* 提示 */}
          <div className="text-[10px] text-muted-foreground border-t pt-3 leading-relaxed">
            <Info className="w-3 h-3 inline mr-1" />
            「闭环看板」让一个战略项目能挂所有相关 OKR 与决议, 形成「事如何流转」的可追溯链路.
            <br />
            软链接, 删除原始 OKR / 决议不会自动清理, 需要手动维护.
          </div>
        </div>
      </div>
    </div>
  );
}
