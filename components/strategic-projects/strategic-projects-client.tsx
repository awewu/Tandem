'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Download,
  FileText,
  Folder,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { FixedModal } from '@/components/ui/fixed-modal';
import type {
  StrategicMilestone,
  StrategicProject,
  StrategicProjectRisk,
  StrategicProjectStatus,
  StrategicTask,
  StrategicTaskStatus,
} from '@/lib/strategic-projects/sample-data';
import type { StrategicProjectMember } from '@/lib/strategic-projects/members';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { formatOwnerDepartment } from '@/lib/org/ownership';
import { useOrgStore } from '@/lib/store/org';
import { cn } from '@/lib/utils';

const pageTabs = ['项目概览'];
const detailTabs = ['里程碑'];

type DetailViewMode = 'card' | 'list';
type TaskSortMode = '默认排序' | '截止日期优先' | '进度高到低' | '逾期优先';
type TaskOverdueFilter = '全部过期状态' | '仅逾期' | '未逾期';
type FlatTaskRow = {
  milestoneId: string;
  milestoneTitle: string;
  milestoneIndex: number;
  task: StrategicTask;
  taskIndex: number;
};

const riskClass: Record<StrategicProjectRisk, string> = {
  normal: 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]',
  attention: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/10 text-danger',
};

const statusClass: Record<StrategicTaskStatus, string> = {
  进行中: 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]',
  未接受: 'bg-[rgb(var(--surface-2))] text-ink-secondary',
  已取消: 'bg-[rgb(var(--surface-2))] text-ink-tertiary',
  已完成: 'bg-success/10 text-success',
};

const milestoneToneClass: Record<StrategicMilestone['tone'], string> = {
  blue: 'bg-[rgb(var(--brand-50))]',
  yellow: 'bg-warning/10',
  neutral: 'bg-[rgb(var(--surface-2))]',
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function cloneProjects(projects: StrategicProject[]) {
  return JSON.parse(JSON.stringify(projects)) as StrategicProject[];
}

function memberKey(name: string) {
  return name.trim().toLowerCase();
}

function extractParticipantMembers(value?: string) {
  return (value ?? '')
    .split(/[,，;；、]/)
    .map((item) => item.replace(/[（(].*$/, '').trim())
    .filter((name) => name && name !== '-');
}

function addUniqueMember(map: Map<string, StrategicProjectMember>, name?: string, department?: string) {
  const cleanName = (name ?? '').trim();
  if (!cleanName || cleanName === '-') return;
  const cleanDepartment = (department ?? '').trim();
  const key = memberKey(cleanName);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { id: key, name: cleanName, department: cleanDepartment || undefined });
  } else if (!existing.department && cleanDepartment) {
    map.set(key, { ...existing, department: cleanDepartment });
  }
}

function deriveProjectMembers(projects: StrategicProject[]) {
  const members = new Map<string, StrategicProjectMember>();
  projects.forEach((project) => {
    addUniqueMember(members, project.owner, project.ownerDepartment);
    extractParticipantMembers(project.participants).forEach((name) => addUniqueMember(members, name));
    project.milestones.forEach((milestone) => {
      addUniqueMember(members, milestone.owner, milestone.ownerDepartment);
      milestone.tasks.forEach((task) => {
        addUniqueMember(members, task.owner, task.ownerDepartment);
        extractParticipantMembers(task.participants).forEach((name) => addUniqueMember(members, name));
      });
    });
  });
  return Array.from(members.values());
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function recalculateProject(project: StrategicProject): StrategicProject {
  const milestones = project.milestones.map((milestone) => ({
    ...milestone,
    progress: average(milestone.tasks.map((task) => task.progress)),
  }));
  const tasks = milestones.flatMap((milestone) => milestone.tasks);
  const completion = tasks.length > 0 ? average(tasks.map((task) => task.progress)) : project.completion;
  const completedTasks = tasks.filter((task) => task.status === '已完成').length;
  const overdueTasks = tasks.filter((task) => task.overdueText || /逾期|延期|延迟/.test(task.rawStatus ?? '')).length;

  return {
    ...project,
    milestones,
    completion,
    completionText: formatPercent(completion),
    progressChip: formatPercent(completion),
    completedTasks,
    totalTasks: tasks.length,
    tasksText: `${completedTasks}/${tasks.length}`,
    overdueTasks,
  };
}

function riskLabel(risk: StrategicProjectRisk) {
  if (risk === 'overdue') return '已有延期...';
  if (risk === 'attention') return '注意风险';
  return '正常推进';
}

function riskOptionLabel(risk: StrategicProjectRisk) {
  if (risk === 'overdue') return '已有延期';
  if (risk === 'attention') return '注意风险';
  return '正常推进';
}

function toDateInputValue(value?: string) {
  if (!value || value === '长期') return '';
  const normalized = value.replace(/\//g, '-').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function fromDateInputValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  return raw ? raw.replace(/-/g, '/') : '';
}

function hrDeptPath(
  deptId: string | null | undefined,
  byId: Map<string, { id: string; name: string; parentId: string | null }>,
): string | null {
  if (!deptId) return null;
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(deptId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.length > 0 ? parts.join(' / ') : null;
}

function makeProjectId(name: string) {
  const match = name.match(/^V(\d+)/i);
  return match ? `v${match[1]}` : `project-${Date.now()}`;
}

function Avatar({ name, index = 0, className }: { name: string; index?: number; className?: string }) {
  const tones = [
    'bg-[rgb(var(--brand-500))]',
    'bg-success',
    'bg-info',
    'bg-warning',
    'bg-ink-secondary',
  ];

  return (
    <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white', tones[index % tones.length], className)}>
      {(name || '-').slice(0, 1)}
    </span>
  );
}

function progressClass(completion: number) {
  if (completion === 0) return 'bg-[rgb(var(--brand-50))] text-ink-secondary';
  if (completion >= 60) return 'bg-danger/20 text-ink-primary';
  if (completion >= 40) return 'bg-warning/25 text-ink-primary';
  return 'bg-danger/20 text-ink-primary';
}

function isTaskOverdue(task: StrategicTask) {
  return Boolean(task.overdueText || /逾期|延期|延迟/.test(task.rawStatus ?? ''));
}

function parseLooseDate(value?: string) {
  if (!value || value === '长期') return Number.POSITIVE_INFINITY;
  const normalized = value.replace(/\//g, '-').replace(/\s+18:00$/, 'T18:00:00');
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function useEditableProjects(initialProjects: StrategicProject[]) {
  const [projects, setProjects] = useState(() => cloneProjects(initialProjects));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function persist(nextProjects: StrategicProject[], successMessage = '已保存') {
    setProjects(nextProjects);
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/strategic-projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projects: nextProjects }),
      });
      if (!res.ok) throw new Error(`保存失败 (${res.status})`);
      setMessage(successMessage);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/strategic-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = (await res.json()) as { ok: boolean; projects?: StrategicProject[]; error?: string };
      if (!res.ok || !data.ok || !data.projects) throw new Error(data.error ?? `恢复失败 (${res.status})`);
      setProjects(data.projects);
      setMessage('已恢复 Excel 导入数据');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setSaving(true);
    setMessage('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/strategic-projects', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = (await res.json()) as { ok: boolean; projects?: StrategicProject[]; error?: string };
      if (!res.ok || !data.ok || !data.projects) throw new Error(data.error ?? `刷新失败 (${res.status})`);
      setProjects(cloneProjects(data.projects));
      setMessage('已刷新数据');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? '刷新超时，请稍后重试' : (error as Error).message);
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  }

  return { projects, setProjects, saving, message, persist, reset, refresh };
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-footnote text-ink-tertiary">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 text-caption text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-footnote text-ink-tertiary">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 text-caption text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
      >
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-footnote text-ink-tertiary">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full resize-y rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption leading-relaxed text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
      />
    </label>
  );
}

function OwnerPickerField({
  initialName,
  initialDepartment,
  label = '负责人',
  placeholder = '搜索并选择负责人',
}: {
  initialName?: string;
  initialDepartment?: string;
  label?: string;
  placeholder?: string;
}) {
  const { people, resolve } = useOwnerDirectory();
  const hrDepts = useOrgStore((s) => s.hrDepts);
  const hrDeptsHydrated = useOrgStore((s) => s._hrHydrated);
  const hydrateHrDepts = useOrgStore((s) => s.hydrateHrDepts);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [ownerName, setOwnerName] = useState(initialName ?? '');
  const [ownerDepartment, setOwnerDepartment] = useState(initialDepartment ?? '');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hrDeptsHydrated) void hydrateHrDepts();
  }, [hrDeptsHydrated, hydrateHrDepts]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && pickerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const hrDeptById = useMemo(
    () => new Map(hrDepts.map((dept) => [dept.id, { id: dept.id, name: dept.name, parentId: dept.parentId }])),
    [hrDepts],
  );

  const ownerOptions = useMemo(() => (
    people.map((person) => {
      const departmentLabel = hrDeptPath(person.ministryId, hrDeptById) ?? formatOwnerDepartment(resolve(person.id));
      return {
        id: person.id,
        name: person.name,
        departmentLabel,
        searchText: `${person.name} ${departmentLabel}`.toLowerCase(),
      };
    })
  ), [hrDeptById, people, resolve]);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ownerOptions.slice(0, 30);
    return ownerOptions.filter((option) => option.searchText.includes(q)).slice(0, 50);
  }, [ownerOptions, query]);

  function choose(option: { name: string; departmentLabel: string }) {
    setOwnerName(option.name);
    setOwnerDepartment(option.departmentLabel);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={pickerRef} className="relative md:col-span-2">
      <span className="text-footnote text-ink-tertiary">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 text-left text-caption text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
      >
        <span className={cn('truncate', !ownerName && 'text-ink-tertiary')}>{ownerName || placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 text-ink-tertiary transition', open && 'rotate-180')} />
      </button>
      <input type="hidden" name="owner" value={ownerName} required />
      <input type="hidden" name="ownerDepartment" value={ownerDepartment} />
      <div className="mt-1 truncate text-[11px] text-ink-tertiary">
        组织部门：{ownerDepartment || '选择负责人后自动带出'}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-[rgb(var(--surface-1))] p-2 shadow-soft-lg">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入姓名或部门搜索"
            autoFocus
            className="mb-2 h-9 w-full rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 text-caption text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
          />
          <div className="max-h-72 overflow-auto">
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-2 text-footnote text-ink-tertiary">没有匹配的人员</div>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choose(option)}
                  className={cn(
                    'block w-full rounded-md px-3 py-2 text-left hover:bg-[rgb(var(--surface-2))]',
                    option.name === ownerName && 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]',
                  )}
                >
                  <span className="block truncate text-caption font-medium">{option.name}</span>
                  <span className="block truncate text-[11px] text-ink-tertiary">{option.departmentLabel}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormActions({ saving, onCancel, formId }: { saving: boolean; onCancel: () => void; formId: string }) {
  return (
    <>
      <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-border px-4 text-caption text-ink-secondary">
        取消
      </button>
      <button type="submit" form={formId} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[rgb(var(--brand-500))] px-4 text-caption font-semibold text-white disabled:opacity-60">
        <Save className="h-4 w-4" />
        保存
      </button>
    </>
  );
}

function DeleteConfirmModal({
  title,
  description,
  saving,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <FixedModal
      title={title}
      size="md"
      onClose={onCancel}
      bodyClassName="px-5 py-5"
      footer={
        <>
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-border px-4 text-caption text-ink-secondary">
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="h-9 rounded-lg bg-danger px-4 text-caption font-semibold text-white disabled:opacity-60"
          >
            确认删除
          </button>
        </>
      }
    >
      <p className="text-caption leading-relaxed text-ink-secondary">{description}</p>
    </FixedModal>
  );
}

function ProjectForm({
  project,
  saving,
  onClose,
  onSubmit,
}: {
  project?: StrategicProject;
  saving: boolean;
  onClose: () => void;
  onSubmit: (project: StrategicProject) => void;
}) {
  const formId = 'strategic-project-form';

  return (
    <FixedModal
      title={project ? '编辑项目' : '新增项目'}
      onClose={onClose}
      footer={<FormActions saving={saving} onCancel={onClose} formId={formId} />}
      bodyClassName="px-5 py-4"
    >
      <form
        id={formId}
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const risk = String(data.get('risk') ?? 'normal') as StrategicProjectRisk;
          const status = String(data.get('status') ?? '进行中') as StrategicProjectStatus;
          const completion = Number(data.get('completion') ?? 0);
          const ownerName = String(data.get('owner') ?? '').trim();
          if (!ownerName) {
            window.alert('请选择负责人');
            return;
          }
          const next: StrategicProject = {
            ...(project ?? {
              id: makeProjectId(String(data.get('name') ?? '新项目')),
              completedTasks: 0,
              totalTasks: 0,
              tasksText: '0/0',
              overdueTasks: 0,
              participants: '',
              milestones: [],
            }),
            name: String(data.get('name') ?? '').trim(),
            status,
            rawStatus: status,
            risk,
            riskLabel: riskLabel(risk),
            owner: ownerName,
            ownerDepartment: String(data.get('ownerDepartment') ?? '').trim(),
            completion,
            completionText: formatPercent(completion),
            progressChip: formatPercent(completion),
            startDate: fromDateInputValue(data.get('startDate')),
            dueDate: fromDateInputValue(data.get('dueDate')),
            objective: String(data.get('objective') ?? '').trim() || '-',
          };
          onSubmit(next);
        }}
      >
        <Field label="项目名称" name="name" defaultValue={project?.name} required />
        <OwnerPickerField initialName={project?.owner} initialDepartment={project?.ownerDepartment} />
        <SelectField label="状态" name="status" defaultValue={project?.status} options={['进行中', '未开始', '已完成']} />
        <SelectField
          label="风险等级"
          name="risk"
          defaultValue={project?.risk}
          options={[
            { value: 'normal', label: riskOptionLabel('normal') },
            { value: 'attention', label: riskOptionLabel('attention') },
            { value: 'overdue', label: riskOptionLabel('overdue') },
          ]}
        />
        <Field label="完成度" name="completion" type="number" defaultValue={project?.completion ?? 0} />
        <Field label="开始日期" name="startDate" type="date" defaultValue={toDateInputValue(project?.startDate)} />
        <Field label="截止日期" name="dueDate" type="date" defaultValue={toDateInputValue(project?.dueDate)} />
        <div className="md:col-span-2">
          <TextAreaField label="项目目标" name="objective" defaultValue={project?.objective} rows={3} />
        </div>
      </form>
    </FixedModal>
  );
}

function ProjectMemberForm({
  members,
  saving,
  onClose,
  onSubmit,
}: {
  members: StrategicProjectMember[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (member: Omit<StrategicProjectMember, 'id'>) => void;
}) {
  const formId = 'strategic-project-member-form';

  return (
    <FixedModal
      title="新增项目成员"
      size="md"
      className="overflow-visible"
      onClose={onClose}
      footer={<FormActions saving={saving} onCancel={onClose} formId={formId} />}
      bodyClassName="min-h-[360px] overflow-visible px-5 py-4"
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get('owner') ?? '').trim();
          const department = String(data.get('ownerDepartment') ?? '').trim();
          if (!name) {
            window.alert('请选择项目成员');
            return;
          }
          if (members.some((member) => memberKey(member.name) === memberKey(name))) {
            window.alert('该成员已存在');
            return;
          }
          onSubmit({ name, department: department || undefined });
        }}
      >
        <OwnerPickerField label="项目成员" placeholder="搜索并选择项目成员" />
      </form>
    </FixedModal>
  );
}

export function StrategicProjectsList({ initialProjects }: { initialProjects: StrategicProject[] }) {
  const { projects, saving, message, persist, refresh } = useEditableProjects(initialProjects);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部状态');
  const [owner, setOwner] = useState('全部负责人');
  const [editingProject, setEditingProject] = useState<StrategicProject | null | undefined>(undefined);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<StrategicProject | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<StrategicProjectMember[]>(() => deriveProjectMembers(initialProjects));
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberMessage, setMemberMessage] = useState('');
  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(20);

  const owners = useMemo(() => Array.from(new Set(projects.map((project) => project.owner).filter(Boolean))), [projects]);
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchesQuery = `${project.name} ${project.owner} ${project.ownerDepartment ?? ''}`.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === '全部状态' || project.status === status;
        const matchesOwner = owner === '全部负责人' || project.owner === owner;
        return matchesQuery && matchesStatus && matchesOwner;
      }),
    [owner, projects, query, status],
  );
  const projectPageCount = Math.max(1, Math.ceil(filteredProjects.length / projectPageSize));
  const currentProjectPage = Math.min(projectPage, projectPageCount);
  const pagedProjects = useMemo(() => {
    const start = (currentProjectPage - 1) * projectPageSize;
    return filteredProjects.slice(start, start + projectPageSize);
  }, [currentProjectPage, filteredProjects, projectPageSize]);

  useEffect(() => {
    setProjectPage(1);
  }, [owner, projectPageSize, query, status]);

  useEffect(() => {
    setProjectPage((page) => Math.min(page, projectPageCount));
  }, [projectPageCount]);

  async function refreshMembers() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/strategic-project-members', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = (await res.json()) as { ok: boolean; members?: StrategicProjectMember[]; error?: string };
      if (!res.ok || !data.ok || !data.members) throw new Error(data.error ?? `刷新项目成员失败 (${res.status})`);
      setProjectMembers(data.members);
    } catch (error) {
      setMemberMessage(error instanceof DOMException && error.name === 'AbortError' ? '刷新项目成员超时，请稍后重试' : (error as Error).message);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  useEffect(() => {
    void refreshMembers();
  }, []);

  async function addProjectMember(member: Omit<StrategicProjectMember, 'id'>) {
    setMemberSaving(true);
    setMemberMessage('');
    try {
      const res = await fetch('/api/strategic-project-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(member),
      });
      const data = (await res.json()) as { ok: boolean; members?: StrategicProjectMember[]; error?: string };
      if (!res.ok || !data.ok || !data.members) throw new Error(data.error ?? `新增项目成员失败 (${res.status})`);
      setProjectMembers(data.members);
      setMemberMessage('项目成员已新增');
      setMemberModalOpen(false);
    } catch (error) {
      setMemberMessage((error as Error).message);
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleRefresh() {
    setMemberMessage('');
    await Promise.all([refresh(), refreshMembers()]);
  }

  function upsertProject(project: StrategicProject) {
    const exists = projects.some((item) => item.id === project.id);
    const next = exists ? projects.map((item) => (item.id === project.id ? project : item)) : [...projects, project];
    void persist(next, exists ? '项目已更新' : '项目已新增');
    setEditingProject(undefined);
  }

  function confirmDeleteProject() {
    if (!projectDeleteTarget) return;
    void persist(projects.filter((project) => project.id !== projectDeleteTarget.id), '项目已删除');
    setProjectDeleteTarget(null);
  }

  return (
    <main className="min-h-full bg-[rgb(var(--surface-2))] text-ink-primary">
      <div className="flex gap-3 px-3 py-4">
        <aside className="hidden w-[150px] shrink-0 rounded-2xl bg-[rgb(var(--surface-1))] p-3 shadow-soft-sm md:block">
          <div className="mb-4 flex items-center gap-2 text-footnote text-ink-tertiary">
            <ArrowLeft className="h-4 w-4" />
            返回
            <span>项目集</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[rgb(var(--brand-50))] px-3 py-3 text-caption font-semibold text-[rgb(var(--brand-700))]">
            <Folder className="h-4 w-4 fill-current" />
            V项目
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl bg-[rgb(var(--surface-1))] shadow-soft-sm">
          <header className="flex min-h-[118px] flex-col justify-between border-b border-border px-6 pt-4">
            <div className="flex items-center gap-3">
              <ArrowLeft className="h-6 w-6 text-ink-primary" />
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
                <Folder className="h-5 w-5 fill-current" />
              </div>
              <h1 className="text-title-3 font-semibold">V项目</h1>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setMemberModalOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]"
                  title="新增项目成员"
                >
                  <Plus className="h-5 w-5" />
                </button>
                {projectMembers.slice(0, 5).map((member, index) => (
                  <Avatar key={member.id} name={member.name} index={index} />
                ))}
                <button
                  onClick={() => void handleRefresh()}
                  disabled={saving || memberSaving}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-tertiary disabled:opacity-60"
                  title="刷新数据"
                >
                  <RefreshCw className={cn('h-4 w-4', (saving || memberSaving) && 'animate-spin')} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-8">
              {pageTabs.map((tab) => (
                <span
                  key={tab}
                  className={cn(
                    'relative pb-4 text-caption text-ink-secondary',
                    tab === '项目概览' && 'font-semibold text-[rgb(var(--brand-600))] after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--brand-500))]',
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>
          </header>

          <div className="px-6 py-4">
            <div className="mb-4 flex flex-wrap items-center gap-4 text-footnote text-ink-tertiary">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
                {['全部状态', '进行中', '未开始', '已完成'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select value={owner} onChange={(event) => setOwner(event.target.value)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
                <option>全部负责人</option>
                {owners.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2">
                <Search className="h-4 w-4" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-48 bg-transparent outline-none" placeholder="搜索" />
              </label>
              <div className="ml-auto flex gap-3">
                <button onClick={() => setEditingProject(null)} className="inline-flex h-8 items-center gap-1 rounded-full bg-[rgb(var(--brand-500))] px-4 font-semibold text-white">
                  <Plus className="h-4 w-4" />
                  添加项目
                </button>
              </div>
            </div>
            {(message || memberMessage) && <div className="mb-3 rounded-lg bg-[rgb(var(--brand-50))] px-3 py-2 text-footnote text-[rgb(var(--brand-700))]">{saving || memberSaving ? '处理中...' : memberMessage || message}</div>}

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1508px] table-fixed border-collapse text-caption">
                  <colgroup>
                    <col className="w-[300px]" />
                    <col className="w-[108px]" />
                    <col className="w-[140px]" />
                    <col className="w-[120px]" />
                    <col className="w-[116px]" />
                    <col className="w-[88px]" />
                    <col className="w-[88px]" />
                    <col className="w-[124px]" />
                    <col className="w-[124px]" />
                    <col className="w-[300px]" />
                  </colgroup>
                  <thead className="bg-[rgb(var(--surface-2))] text-left text-footnote font-medium text-ink-tertiary">
                    <tr>
                      {['名称', '状态', '风险等级', '负责人', '完成度', '任务数', '过期任务数', '开始日期', '截止日期', '项目目标'].map((column) => (
                        <th key={column} className="whitespace-nowrap border-b border-r border-border px-4 py-3 last:border-r-0">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProjects.map((project, index) => (
                      <tr key={project.id} className="h-[56px] hover:bg-[rgb(var(--brand-50))]/45">
                        <td className="group/name relative border-b border-r border-border px-4 last:border-r-0">
                          <div className="flex min-w-0 items-center gap-2 pr-8">
                            <Link href={`/strategic-projects/${project.id}`} className="flex min-w-0 items-center gap-2 font-medium text-ink-secondary hover:text-[rgb(var(--brand-600))]">
                              <FileText className="h-4 w-4 shrink-0 text-ink-tertiary" />
                              <span className="truncate">{project.name}</span>
                            </Link>
                          </div>
                          <div className="group/menu absolute right-3 top-1/2 z-20 -translate-y-1/2">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-ink-tertiary opacity-0 shadow-soft-sm transition hover:text-ink-primary group-hover/name:opacity-100 group-focus-within/name:opacity-100"
                              aria-label={`${project.name} 更多操作`}
                              title="更多操作"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            <div className="absolute left-8 top-1/2 hidden w-24 -translate-y-1/2 rounded-lg border border-border bg-[rgb(var(--surface-1))] p-1 shadow-soft-lg group-hover/menu:block group-focus-within/menu:block">
                              <button
                                type="button"
                                onClick={() => setProjectDeleteTarget(project)}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-caption text-ink-secondary hover:bg-[rgb(var(--surface-2))] hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" />
                                移除
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[rgb(var(--brand-50))] px-3 py-1 text-ink-secondary">{project.status}</span>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className={cn('inline-flex min-w-[96px] justify-center whitespace-nowrap rounded-full px-3 py-1', riskClass[project.risk])}>{project.riskLabel}</span>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <Avatar name={project.owner} index={index} />
                            {project.owner}
                          </span>
                        </td>
                        <td className="border-b border-r border-border px-2 last:border-r-0">
                          <div className={cn('relative h-9 overflow-hidden rounded-lg text-center leading-9', progressClass(project.completion))}>
                            {project.completion > 0 && (
                              <span className={cn('absolute inset-y-0 left-0', project.completion >= 40 ? 'bg-danger/60' : 'bg-[rgb(var(--brand-300))]')} style={{ width: `${project.completion}%` }} />
                            )}
                            <span className="relative">{formatPercent(project.completion)}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-r border-border px-4 text-ink-secondary">{project.tasksText}</td>
                        <td className="whitespace-nowrap border-b border-r border-border px-4 text-danger">{project.overdueTasks > 0 ? project.overdueTasks : ''}</td>
                        <td className="whitespace-nowrap border-b border-r border-border px-4 text-ink-secondary">{project.startDate}</td>
                        <td className="whitespace-nowrap border-b border-r border-border px-4 text-ink-secondary">{project.dueDate}</td>
                        <td className="border-b border-r border-border px-4 text-ink-secondary">
                          <div className="line-clamp-2 leading-relaxed">{project.objective}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 text-caption text-ink-secondary">
              <span>共 {filteredProjects.length} 条</span>
              <button
                onClick={() => setProjectPage((page) => Math.max(1, page - 1))}
                disabled={currentProjectPage <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-tertiary disabled:opacity-40"
              >
                ‹
              </button>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-[rgb(var(--brand-500))] px-2 text-[rgb(var(--brand-600))]">
                {currentProjectPage}
              </span>
              <span className="text-ink-tertiary">/ {projectPageCount}</span>
              <button
                onClick={() => setProjectPage((page) => Math.min(projectPageCount, page + 1))}
                disabled={currentProjectPage >= projectPageCount}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-tertiary disabled:opacity-40"
              >
                ›
              </button>
              <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3">
                <select
                  value={projectPageSize}
                  onChange={(event) => setProjectPageSize(Number(event.target.value))}
                  className="bg-transparent outline-none"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} 条/页
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4" />
              </label>
            </div>
          </div>
        </section>
      </div>
      {editingProject !== undefined && (
        <ProjectForm
          project={editingProject ?? undefined}
          saving={saving}
          onClose={() => setEditingProject(undefined)}
          onSubmit={upsertProject}
        />
      )}
      {projectDeleteTarget && (
        <DeleteConfirmModal
          title="删除项目"
          description={`确认删除「${projectDeleteTarget.name}」？删除后会移除该项目下的里程碑和任务。`}
          saving={saving}
          onCancel={() => setProjectDeleteTarget(null)}
          onConfirm={confirmDeleteProject}
        />
      )}
      {memberModalOpen && (
        <ProjectMemberForm
          members={projectMembers}
          saving={memberSaving}
          onClose={() => setMemberModalOpen(false)}
          onSubmit={addProjectMember}
        />
      )}
    </main>
  );
}

function MilestoneForm({
  milestone,
  saving,
  onClose,
  onSubmit,
}: {
  milestone?: StrategicMilestone;
  saving: boolean;
  onClose: () => void;
  onSubmit: (milestone: StrategicMilestone) => void;
}) {
  const formId = 'strategic-milestone-form';

  return (
    <FixedModal
      title={milestone ? '编辑里程碑' : '新增里程碑'}
      onClose={onClose}
      footer={<FormActions saving={saving} onCancel={onClose} formId={formId} />}
    >
      <form
        id={formId}
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const ownerName = String(data.get('owner') ?? '').trim();
          if (!ownerName) {
            window.alert('请选择负责人');
            return;
          }
          onSubmit({
            ...(milestone ?? { id: `milestone-${Date.now()}`, tone: 'blue', tasks: [] }),
            title: String(data.get('title') ?? '').trim(),
            owner: ownerName,
            ownerDepartment: String(data.get('ownerDepartment') ?? '').trim(),
            dueDate: fromDateInputValue(data.get('dueDate')),
            progress: Number(data.get('progress') ?? 0),
          });
        }}
      >
        <Field label="里程碑名称" name="title" defaultValue={milestone?.title} required />
        <OwnerPickerField initialName={milestone?.owner} initialDepartment={milestone?.ownerDepartment} />
        <Field label="截止日期" name="dueDate" type="date" defaultValue={toDateInputValue(milestone?.dueDate)} />
        <Field label="进度" name="progress" type="number" defaultValue={milestone?.progress ?? 0} />
      </form>
    </FixedModal>
  );
}

function TaskForm({
  task,
  saving,
  onClose,
  onSubmit,
}: {
  task?: StrategicTask;
  saving: boolean;
  onClose: () => void;
  onSubmit: (task: StrategicTask) => void;
}) {
  const formId = 'strategic-task-form';

  return (
    <FixedModal
      title={task ? '编辑任务' : '新增任务'}
      onClose={onClose}
      footer={<FormActions saving={saving} onCancel={onClose} formId={formId} />}
    >
      <form
        id={formId}
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const status = String(data.get('status') ?? '进行中') as StrategicTaskStatus;
          onSubmit({
            ...(task ?? { id: `task-${Date.now()}` }),
            title: String(data.get('title') ?? '').trim(),
            priority: String(data.get('priority') ?? 'P3').trim(),
            status,
            rawStatus: status,
            owner: String(data.get('owner') ?? '').trim(),
            ownerDepartment: String(data.get('ownerDepartment') ?? '').trim(),
            dueDate: String(data.get('dueDate') ?? '').trim(),
            progress: Number(data.get('progress') ?? 0),
            latestProgress: String(data.get('latestProgress') ?? '').trim(),
          });
        }}
      >
        <div className="md:col-span-2">
          <Field label="任务名称" name="title" defaultValue={task?.title} required />
        </div>
        <Field label="优先级" name="priority" defaultValue={task?.priority ?? 'P3'} />
        <SelectField label="状态" name="status" defaultValue={task?.status} options={['进行中', '未接受', '已取消', '已完成']} />
        <Field label="负责人" name="owner" defaultValue={task?.owner} required />
        <Field label="负责人部门" name="ownerDepartment" defaultValue={task?.ownerDepartment} />
        <Field label="截止日期" name="dueDate" defaultValue={task?.dueDate} />
        <Field label="进度" name="progress" type="number" defaultValue={task?.progress ?? 0} />
        <label className="block md:col-span-2">
          <span className="text-footnote text-ink-tertiary">最新进展</span>
          <textarea
            name="latestProgress"
            defaultValue={task?.latestProgress}
            className="mt-1 min-h-24 w-full rounded-lg border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
          />
        </label>
      </form>
    </FixedModal>
  );
}

function TaskCard({
  task,
  index,
  bulkMode = false,
  selected = false,
  onToggleSelected,
}: {
  task: StrategicTask;
  index: number;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}) {
  const avatarTone = ['bg-[rgb(var(--brand-500))]', 'bg-success', 'bg-warning', 'bg-info', 'bg-ink-primary'];

  return (
    <article className="rounded-lg bg-[rgb(var(--surface-1))] p-4 shadow-soft-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {bulkMode && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-500))]"
              aria-label={`选择任务 ${task.title}`}
            />
          )}
          <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-footnote font-medium', statusClass[task.status])}>
            {task.status === '进行中' ? '⌛ ' : task.status === '已完成' ? '✓ ' : task.status === '已取消' ? '× ' : '▷ '}
            {task.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={task.owner} className={avatarTone[index % avatarTone.length]} />
        </div>
      </div>
      <h3 className="min-h-[44px] text-caption leading-relaxed text-ink-primary">
        <span className={cn('mr-2 font-semibold', task.priority === 'P2' ? 'text-warning' : 'text-[rgb(var(--brand-600))]')}>{task.priority}</span>
        {task.title}
      </h3>
      {task.latestProgress && <p className="mt-3 line-clamp-2 text-footnote leading-relaxed text-ink-tertiary">{task.latestProgress}</p>}
      <div className="mt-4 flex items-center gap-4 text-footnote text-ink-tertiary">
        <span className="inline-flex items-center gap-1">
          <Settings2 className="h-3.5 w-3.5" />
          0/0
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {task.dueDate}
        </span>
        {task.overdueText && <span className="text-danger">{task.overdueText}</span>}
        <span className="ml-auto inline-flex items-center gap-1">
          <span className="relative h-4 w-4 overflow-hidden rounded-full border-2 border-[rgb(var(--brand-200))]">
            <span className="absolute inset-y-0 left-0 bg-[rgb(var(--brand-500))]" style={{ width: `${task.progress}%` }} />
          </span>
          {task.progress}%
        </span>
      </div>
    </article>
  );
}

export function StrategicProjectDetail({
  initialProjects,
  projectId,
}: {
  initialProjects: StrategicProject[];
  projectId: string;
}) {
  const { projects, saving, message, persist } = useEditableProjects(initialProjects);
  const project = projects.find((item) => item.id === projectId);
  const [milestoneModal, setMilestoneModal] = useState<StrategicMilestone | null | undefined>(undefined);
  const [taskModal, setTaskModal] = useState<{ milestoneId: string; task?: StrategicTask } | null>(null);
  const [openMilestoneMenuId, setOpenMilestoneMenuId] = useState<string | null>(null);
  const [taskTypeFilter, setTaskTypeFilter] = useState('全部类型');
  const [taskStatusFilter, setTaskStatusFilter] = useState<StrategicTaskStatus | '全部状态'>('全部状态');
  const [taskOverdueFilter, setTaskOverdueFilter] = useState<TaskOverdueFilter>('全部过期状态');
  const [taskOwnerFilter, setTaskOwnerFilter] = useState('全部人员');
  const [taskSortMode, setTaskSortMode] = useState<TaskSortMode>('默认排序');
  const [taskQuery, setTaskQuery] = useState('');
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>('card');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [showTaskHelp, setShowTaskHelp] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'milestone'; milestoneId: string; title: string }
    | { type: 'task'; milestoneId: string; taskId: string; title: string }
    | { type: 'tasks'; tasks: Array<{ milestoneId: string; taskId: string; title: string }> }
    | null
  >(null);
  const milestoneScrollerRef = useRef<HTMLDivElement | null>(null);
  const milestoneTopScrollerRef = useRef<HTMLDivElement | null>(null);
  const syncingMilestoneScrollRef = useRef(false);
  const [milestoneScrollState, setMilestoneScrollState] = useState({
    scrollWidth: 0,
  });

  const updateMilestoneScrollState = useCallback(() => {
    const scroller = milestoneScrollerRef.current;
    if (!scroller) return;
    setMilestoneScrollState({
      scrollWidth: scroller.scrollWidth,
    });
  }, []);

  const syncMilestoneScroller = useCallback((source: 'top' | 'content') => {
    const topScroller = milestoneTopScrollerRef.current;
    const contentScroller = milestoneScrollerRef.current;
    if (!topScroller || !contentScroller || syncingMilestoneScrollRef.current) return;
    syncingMilestoneScrollRef.current = true;
    if (source === 'top') {
      contentScroller.scrollLeft = topScroller.scrollLeft;
    } else {
      topScroller.scrollLeft = contentScroller.scrollLeft;
    }
    window.requestAnimationFrame(() => {
      syncingMilestoneScrollRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!openMilestoneMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-milestone-menu]')) return;
      setOpenMilestoneMenuId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMilestoneMenuId]);

  const allTaskRows = useMemo<FlatTaskRow[]>(() => (
    (project?.milestones ?? []).flatMap((milestone, milestoneIndex) =>
      milestone.tasks.map((task, taskIndex) => ({
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        milestoneIndex,
        task,
        taskIndex,
      })),
    )
  ), [project]);

  const taskTypeOptions = useMemo(() => (
    Array.from(new Set(allTaskRows.map((row) => row.task.priority).filter(Boolean))).sort()
  ), [allTaskRows]);

  const taskOwnerOptions = useMemo(() => (
    Array.from(new Set(allTaskRows.map((row) => row.task.owner).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  ), [allTaskRows]);

  const filteredTaskRows = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    const rows = allTaskRows.filter((row) => {
      const task = row.task;
      if (taskTypeFilter !== '全部类型' && task.priority !== taskTypeFilter) return false;
      if (taskStatusFilter !== '全部状态' && task.status !== taskStatusFilter) return false;
      if (taskOverdueFilter === '仅逾期' && !isTaskOverdue(task)) return false;
      if (taskOverdueFilter === '未逾期' && isTaskOverdue(task)) return false;
      if (taskOwnerFilter !== '全部人员' && task.owner !== taskOwnerFilter) return false;
      if (!q) return true;
      return [
        row.milestoneTitle,
        task.title,
        task.priority,
        task.status,
        task.owner,
        task.ownerDepartment,
        task.dueDate,
        task.latestProgress,
        task.description,
      ].join(' ').toLowerCase().includes(q);
    });

    return [...rows].sort((a, b) => {
      if (taskSortMode === '截止日期优先') return parseLooseDate(a.task.dueDate) - parseLooseDate(b.task.dueDate);
      if (taskSortMode === '进度高到低') return b.task.progress - a.task.progress;
      if (taskSortMode === '逾期优先') return Number(isTaskOverdue(b.task)) - Number(isTaskOverdue(a.task));
      return (a.milestoneIndex - b.milestoneIndex) || (a.taskIndex - b.taskIndex);
    });
  }, [allTaskRows, taskOverdueFilter, taskOwnerFilter, taskQuery, taskSortMode, taskStatusFilter, taskTypeFilter]);

  const filteredTaskIds = useMemo(() => new Set(filteredTaskRows.map((row) => row.task.id)), [filteredTaskRows]);

  const listPageCount = Math.max(1, Math.ceil(filteredTaskRows.length / listPageSize));
  const currentListPage = Math.min(listPage, listPageCount);
  const pagedTaskRows = filteredTaskRows.slice((currentListPage - 1) * listPageSize, currentListPage * listPageSize);

  useEffect(() => {
    setListPage(1);
  }, [detailViewMode, taskOverdueFilter, taskOwnerFilter, taskQuery, taskSortMode, taskStatusFilter, taskTypeFilter]);

  useEffect(() => {
    setListPage((page) => Math.min(page, listPageCount));
  }, [listPageCount]);

  useEffect(() => {
    setSelectedTaskIds((current) => {
      const next = new Set(Array.from(current).filter((id) => filteredTaskIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredTaskIds]);

  useEffect(() => {
    if (detailViewMode !== 'card') return;
    const scroller = milestoneScrollerRef.current;
    if (!scroller) return;
    updateMilestoneScrollState();
    scroller.addEventListener('scroll', updateMilestoneScrollState, { passive: true });
    window.addEventListener('resize', updateMilestoneScrollState);
    return () => {
      scroller.removeEventListener('scroll', updateMilestoneScrollState);
      window.removeEventListener('resize', updateMilestoneScrollState);
    };
  }, [detailViewMode, filteredTaskRows.length, project?.id, project?.milestones.length, updateMilestoneScrollState]);

  if (!project) {
    return (
      <main className="min-h-full bg-[rgb(var(--surface-2))] p-6 text-ink-primary">
        <Link href="/strategic-projects" className="inline-flex items-center gap-2 text-[rgb(var(--brand-600))]">
          <ArrowLeft className="h-4 w-4" />
          返回战略项目
        </Link>
        <div className="mt-6 rounded-2xl bg-[rgb(var(--surface-1))] p-8 text-ink-secondary">项目不存在或已被删除。</div>
      </main>
    );
  }
  const activeProject = project;

  function updateProject(nextProject: StrategicProject, successMessage: string) {
    void persist(projects.map((item) => (item.id === nextProject.id ? recalculateProject(nextProject) : item)), successMessage);
  }

  function upsertMilestone(milestone: StrategicMilestone) {
    const exists = activeProject.milestones.some((item) => item.id === milestone.id);
    const nextProject = {
      ...activeProject,
      milestones: exists ? activeProject.milestones.map((item) => (item.id === milestone.id ? milestone : item)) : [...activeProject.milestones, milestone],
    };
    updateProject(nextProject, exists ? '里程碑已更新' : '里程碑已新增');
    setMilestoneModal(undefined);
  }

  function performDeleteMilestone(milestoneId: string) {
    updateProject({ ...activeProject, milestones: activeProject.milestones.filter((item) => item.id !== milestoneId) }, '里程碑已删除');
  }

  function upsertTask(milestoneId: string, task: StrategicTask) {
    const nextProject = {
      ...activeProject,
      milestones: activeProject.milestones.map((milestone) => {
        if (milestone.id !== milestoneId) return milestone;
        const exists = milestone.tasks.some((item) => item.id === task.id);
        return {
          ...milestone,
          tasks: exists ? milestone.tasks.map((item) => (item.id === task.id ? task : item)) : [...milestone.tasks, task],
        };
      }),
    };
    updateProject(nextProject, '任务已保存');
    setTaskModal(null);
  }

  function performDeleteTask(milestoneId: string, taskId: string) {
    const nextProject = {
      ...activeProject,
      milestones: activeProject.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, tasks: milestone.tasks.filter((task) => task.id !== taskId) } : milestone,
      ),
    };
    updateProject(nextProject, '任务已删除');
  }

  function confirmDeleteTarget() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'milestone') {
      performDeleteMilestone(deleteTarget.milestoneId);
    } else if (deleteTarget.type === 'tasks') {
      const deleteIds = new Set(deleteTarget.tasks.map((task) => task.taskId));
      const nextProject = {
        ...activeProject,
        milestones: activeProject.milestones.map((milestone) => ({
          ...milestone,
          tasks: milestone.tasks.filter((task) => !deleteIds.has(task.id)),
        })),
      };
      updateProject(nextProject, '任务已删除');
      setSelectedTaskIds(new Set());
      setBulkMode(false);
    } else {
      performDeleteTask(deleteTarget.milestoneId, deleteTarget.taskId);
    }
    setDeleteTarget(null);
  }

  function alignMilestoneColumn(element: HTMLElement) {
    const scroller = milestoneScrollerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(window.getComputedStyle(scroller).paddingLeft) || 0;
    const nextLeft = scroller.scrollLeft + elementRect.left - scrollerRect.left - paddingLeft;
    scroller.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
    window.requestAnimationFrame(updateMilestoneScrollState);
  }

  function exportFilteredTasks() {
    const headers = ['里程碑', '优先级', '状态', '任务', '负责人', '负责人部门', '截止日期', '进度', '最新进展'];
    const lines = [
      headers.map(csvCell).join(','),
      ...filteredTaskRows.map((row) => [
        row.milestoneTitle,
        row.task.priority,
        row.task.status,
        row.task.title,
        row.task.owner,
        row.task.ownerDepartment ?? '',
        row.task.dueDate,
        `${row.task.progress}%`,
        row.task.latestProgress ?? '',
      ].map(csvCell).join(',')),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.name}-任务导出.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleBulkMode() {
    setBulkMode((current) => {
      const next = !current;
      if (!next) setSelectedTaskIds(new Set());
      return next;
    });
  }

  function toggleSelectedTask(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function updateSelectedTaskStatus(status: StrategicTaskStatus) {
    if (selectedTaskIds.size === 0) return;
    const nextProject = {
      ...activeProject,
      milestones: activeProject.milestones.map((milestone) => ({
        ...milestone,
        tasks: milestone.tasks.map((task) => (
          selectedTaskIds.has(task.id)
            ? { ...task, status, rawStatus: status, progress: status === '已完成' ? 100 : task.progress }
            : task
        )),
      })),
    };
    updateProject(nextProject, '任务已批量更新');
  }

  function requestDeleteSelectedTasks() {
    const tasks = filteredTaskRows
      .filter((row) => selectedTaskIds.has(row.task.id))
      .map((row) => ({ milestoneId: row.milestoneId, taskId: row.task.id, title: row.task.title }));
    if (tasks.length === 0) return;
    setDeleteTarget({ type: 'tasks', tasks });
  }

  const visibleTasksByMilestoneId = new Map<string, FlatTaskRow[]>();
  for (const row of filteredTaskRows) {
    visibleTasksByMilestoneId.set(row.milestoneId, [...(visibleTasksByMilestoneId.get(row.milestoneId) ?? []), row]);
  }

  return (
    <main className="min-h-full bg-[rgb(var(--surface-2))] text-ink-primary">
      <header className="border-b border-border bg-[rgb(var(--surface-1))] shadow-soft-xs">
        <div className="flex h-[78px] items-center gap-3 px-7">
          <Link href="/strategic-projects" className="text-ink-secondary hover:text-ink-primary">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <Folder className="h-6 w-6 fill-current text-[rgb(var(--brand-600))]" />
          <h1 className="text-title-3 font-semibold">{project.name}</h1>
          <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-footnote font-semibold', project.completion >= 40 ? 'bg-warning/20 text-warning' : 'bg-danger/10 text-danger')}>
            <span className="h-3 w-3 rounded-full border-2 border-current" />
            {formatPercent(project.completion)}
          </span>
          {message && <span className="text-footnote text-[rgb(var(--brand-600))]">{saving ? '保存中...' : message}</span>}

          <div className="ml-auto flex items-center gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-full bg-[rgb(var(--brand-50))] px-4 text-caption font-semibold text-[rgb(var(--brand-600))]">
              <Bot className="h-4 w-4" />
              AI创建
            </button>
            {[Search, SlidersHorizontal, CircleHelp, MoreHorizontal].map((Icon, index) => (
              <button key={index} className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-tertiary">
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-[58px] items-end gap-8 overflow-x-auto px-7">
          {detailTabs.map((tab) => (
            <span
              key={tab}
              className={cn(
                'relative shrink-0 pb-4 text-caption text-ink-secondary',
                tab === '里程碑' && 'font-semibold text-[rgb(var(--brand-600))] after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-[rgb(var(--brand-500))]',
              )}
            >
              {tab}
            </span>
          ))}
        </div>
      </header>

      <section className="flex min-h-[64px] flex-wrap items-center gap-3 border-b border-border bg-[rgb(var(--surface-1))] px-7 py-3 text-footnote text-ink-tertiary">
        <select value={taskTypeFilter} onChange={(event) => setTaskTypeFilter(event.target.value)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
          <option>全部类型</option>
          {taskTypeOptions.map((type) => <option key={type}>{type}</option>)}
        </select>
        <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as StrategicTaskStatus | '全部状态')} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
          {['全部状态', '进行中', '未接受', '已取消', '已完成'].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select value={taskOverdueFilter} onChange={(event) => setTaskOverdueFilter(event.target.value as TaskOverdueFilter)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
          {['全部过期状态', '仅逾期', '未逾期'].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
          <option>全部人员</option>
          {taskOwnerOptions.map((owner) => <option key={owner}>{owner}</option>)}
        </select>
        <select value={taskSortMode} onChange={(event) => setTaskSortMode(event.target.value as TaskSortMode)} className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2">
          {['默认排序', '截止日期优先', '进度高到低', '逾期优先'].map((mode) => <option key={mode}>{mode}</option>)}
        </select>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            placeholder="搜索任务"
            className="h-8 w-40 rounded-lg border border-border bg-[rgb(var(--surface-1))] pl-8 pr-3 text-footnote text-ink-primary outline-none focus:ring-2 focus:ring-[rgb(var(--brand-200))]"
          />
        </label>
        <button
          type="button"
          onClick={() => setDetailViewMode((mode) => (mode === 'card' ? 'list' : 'card'))}
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-ink-secondary hover:bg-[rgb(var(--surface-2))]"
        >
          {detailViewMode === 'card' ? '列表视图' : '卡片视图'}
        </button>
        <span className="text-[11px] text-ink-tertiary">共 {filteredTaskRows.length} 项</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {bulkMode && (
            <>
              <span className="text-[11px] text-ink-tertiary">已选 {selectedTaskIds.size}</span>
              <button type="button" disabled={selectedTaskIds.size === 0} onClick={() => updateSelectedTaskStatus('已完成')} className="h-8 rounded-lg border border-border px-3 text-ink-secondary disabled:opacity-40">标记完成</button>
              <button type="button" disabled={selectedTaskIds.size === 0} onClick={() => updateSelectedTaskStatus('进行中')} className="h-8 rounded-lg border border-border px-3 text-ink-secondary disabled:opacity-40">标记进行中</button>
              <button type="button" disabled={selectedTaskIds.size === 0} onClick={requestDeleteSelectedTasks} className="h-8 rounded-lg border border-danger/30 px-3 text-danger disabled:opacity-40">删除所选</button>
            </>
          )}
          <button type="button" onClick={() => setShowTaskHelp(true)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 hover:bg-[rgb(var(--surface-2))]">
            <CircleHelp className="h-4 w-4" />
            示例说明
          </button>
          <button type="button" onClick={exportFilteredTasks} className="inline-flex h-8 items-center gap-2 rounded-full border border-border px-4 text-ink-secondary hover:bg-[rgb(var(--surface-2))]">
            <Download className="h-4 w-4" />
            导出
          </button>
          <button type="button" onClick={toggleBulkMode} className={cn('inline-flex h-8 items-center gap-2 rounded-full border px-4', bulkMode ? 'border-[rgb(var(--brand-500))] text-[rgb(var(--brand-600))]' : 'border-border text-ink-secondary')}>
            <Users className="h-4 w-4" />
            {bulkMode ? '退出批量' : '批量操作'}
          </button>
        </div>
      </section>

      {detailViewMode === 'card' ? (
        <section>
          <div className="sticky top-0 z-20 border-b border-border bg-[rgb(var(--surface-2))] px-6 py-2">
            <div
              aria-label="里程碑横向滚动条"
              ref={milestoneTopScrollerRef}
              className="overflow-x-scroll overflow-y-hidden"
              onScroll={() => syncMilestoneScroller('top')}
            >
              <div className="h-1" style={{ width: Math.max(milestoneScrollState.scrollWidth, 1) }} />
            </div>
          </div>
          <div
            ref={milestoneScrollerRef}
            className="snap-x snap-mandatory overflow-x-auto scroll-smooth px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={() => syncMilestoneScroller('content')}
          >
            <div className="flex min-w-max gap-3">
            {project.milestones.map((milestone) => {
              const visibleRows = visibleTasksByMilestoneId.get(milestone.id) ?? [];
              return (
              <div
                key={milestone.id}
                onClick={(event) => alignMilestoneColumn(event.currentTarget)}
                onFocus={(event) => alignMilestoneColumn(event.currentTarget)}
                className="w-[340px] shrink-0 snap-start scroll-ml-6"
              >
                <div className={cn('relative flex h-[74px] items-center gap-3 rounded-r-xl px-4', milestoneToneClass[milestone.tone])}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-[rgb(var(--brand-200))] bg-[rgb(var(--surface-1))] text-caption font-semibold text-[rgb(var(--brand-600))]">
                    {milestone.progress}%
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-caption font-semibold text-ink-primary">{milestone.title}</p>
                    <p className="mt-1 text-footnote text-ink-tertiary">
                      {milestone.owner}
                      <span className="mx-2">{milestone.dueDate}</span>
                    </p>
                  </div>
                  <div
                    data-milestone-menu
                    className="relative ml-auto"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label="里程碑操作"
                      title="里程碑操作"
                      onClick={() => setOpenMilestoneMenuId((current) => (current === milestone.id ? null : milestone.id))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-tertiary hover:bg-[rgb(var(--surface-1))] hover:text-[rgb(var(--brand-600))]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMilestoneMenuId === milestone.id && (
                      <div className="absolute right-0 top-9 z-30 w-28 overflow-hidden rounded-lg border border-border bg-[rgb(var(--surface-1))] py-1 text-footnote shadow-soft-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMilestoneMenuId(null);
                            setMilestoneModal(milestone);
                          }}
                          className="block w-full px-3 py-2 text-left text-ink-secondary hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--brand-600))]"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMilestoneMenuId(null);
                            setDeleteTarget({ type: 'milestone', milestoneId: milestone.id, title: milestone.title });
                          }}
                          className="block w-full px-3 py-2 text-left text-danger hover:bg-danger/10"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 min-h-[calc(100vh-278px)] rounded-t-xl bg-[rgb(var(--brand-50))]/55 p-4">
                  <button onClick={() => setTaskModal({ milestoneId: milestone.id })} className="mb-3 flex h-12 w-full items-center justify-center rounded-lg bg-[rgb(var(--surface-1))] text-caption font-medium text-[rgb(var(--brand-600))]">
                    <Plus className="h-4 w-4" />
                    创建任务
                  </button>
                  <div className="space-y-3">
                    {visibleRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-[rgb(var(--surface-1))]/70 px-3 py-6 text-center text-footnote text-ink-tertiary">无匹配任务</div>
                    ) : (
                      visibleRows.map((row, index) => (
                        <TaskCard
                          key={row.task.id}
                          task={row.task}
                          index={index}
                          bulkMode={bulkMode}
                          selected={selectedTaskIds.has(row.task.id)}
                          onToggleSelected={() => toggleSelectedTask(row.task.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
              );
            })}

            <div
              onClick={(event) => alignMilestoneColumn(event.currentTarget)}
              onFocus={(event) => alignMilestoneColumn(event.currentTarget)}
              className="w-[340px] shrink-0 snap-start scroll-ml-6"
            >
              <button onClick={() => setMilestoneModal(null)} className="flex h-[74px] w-full items-center justify-center rounded-r-xl bg-[rgb(var(--surface-3))] px-4 text-caption font-medium text-ink-tertiary">
                <Plus className="h-4 w-4" />
                创建里程碑
              </button>
            </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="px-6 py-4">
          <div className="overflow-x-auto rounded-2xl border border-border bg-[rgb(var(--surface-1))]">
            <table className="w-full min-w-[1320px] table-fixed text-footnote">
              <thead className="bg-[rgb(var(--surface-2))] text-left text-ink-tertiary">
                <tr>
                  {bulkMode && <th className="w-10 px-3 py-3" />}
                  <th className="w-[220px] px-3 py-3">里程碑</th>
                  <th className="w-[360px] px-3 py-3">任务</th>
                  <th className="w-[110px] px-3 py-3">状态</th>
                  <th className="w-[120px] px-3 py-3">负责人</th>
                  <th className="w-[170px] px-3 py-3">截止日期</th>
                  <th className="w-[90px] px-3 py-3">进度</th>
                  <th className="w-[360px] px-3 py-3">最新进展</th>
                </tr>
              </thead>
              <tbody>
                {filteredTaskRows.length === 0 ? (
                  <tr><td colSpan={bulkMode ? 8 : 7} className="px-3 py-10 text-center text-ink-tertiary">无匹配任务</td></tr>
                ) : pagedTaskRows.map((row) => (
                  <tr key={row.task.id} className="border-t border-border hover:bg-[rgb(var(--surface-2))]/60">
                    {bulkMode && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(row.task.id)}
                          onChange={() => toggleSelectedTask(row.task.id)}
                          className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-500))]"
                          aria-label={`选择任务 ${row.task.title}`}
                        />
                      </td>
                    )}
                    <td className="truncate px-3 py-3 text-ink-secondary">{row.milestoneTitle}</td>
                    <td className="px-3 py-3 text-ink-primary"><span className="mr-2 font-semibold text-[rgb(var(--brand-600))]">{row.task.priority}</span>{row.task.title}</td>
                    <td className="px-3 py-3"><span className={cn('rounded px-2 py-0.5', statusClass[row.task.status])}>{row.task.status}</span></td>
                    <td className="truncate px-3 py-3 text-ink-secondary">{row.task.owner}</td>
                    <td className="px-3 py-3 text-ink-secondary">{row.task.dueDate}</td>
                    <td className="px-3 py-3 text-ink-secondary">{row.task.progress}%</td>
                    <td className="truncate px-3 py-3 text-ink-tertiary">{row.task.latestProgress ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-footnote text-ink-secondary">
            <span>
              第 {currentListPage}/{listPageCount} 页 · 共 {filteredTaskRows.length} 项
            </span>
            <button
              type="button"
              disabled={currentListPage <= 1}
              onClick={() => setListPage((page) => Math.max(1, page - 1))}
              className="h-8 rounded-lg border border-border px-3 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={currentListPage >= listPageCount}
              onClick={() => setListPage((page) => Math.min(listPageCount, page + 1))}
              className="h-8 rounded-lg border border-border px-3 disabled:opacity-40"
            >
              下一页
            </button>
            <select
              value={listPageSize}
              onChange={(event) => {
                setListPageSize(Number(event.target.value));
                setListPage(1);
              }}
              className="h-8 rounded-lg border border-border bg-[rgb(var(--surface-1))] px-2"
            >
              {[10, 20, 50].map((size) => <option key={size} value={size}>{size} 条/页</option>)}
            </select>
          </div>
        </section>
      )}

      {milestoneModal !== undefined && (
        <MilestoneForm
          milestone={milestoneModal ?? undefined}
          saving={saving}
          onClose={() => setMilestoneModal(undefined)}
          onSubmit={upsertMilestone}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.type === 'milestone' ? '删除里程碑' : deleteTarget.type === 'tasks' ? '批量删除任务' : '删除任务'}
          description={
            deleteTarget.type === 'milestone'
              ? `确认删除里程碑「${deleteTarget.title}」？该里程碑下的任务也会一并移除。`
              : deleteTarget.type === 'tasks'
              ? `确认删除已选择的 ${deleteTarget.tasks.length} 个任务？`
              : `确认删除任务「${deleteTarget.title}」？`
          }
          saving={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteTarget}
        />
      )}
      {showTaskHelp && (
        <FixedModal
          title="任务示例说明"
          size="md"
          onClose={() => setShowTaskHelp(false)}
          footer={
            <button type="button" onClick={() => setShowTaskHelp(false)} className="h-9 rounded-lg bg-[rgb(var(--brand-500))] px-4 text-caption font-semibold text-white">
              知道了
            </button>
          }
        >
          <div className="space-y-3 text-caption leading-relaxed text-ink-secondary">
            <p>当前筛选和导出基于本项目全部里程碑下的任务数据。</p>
            <p>任务类型取任务优先级，状态取任务当前状态，是否过期按任务延期/逾期标记判断。</p>
            <p>导出会下载当前筛选结果；批量操作只作用于已勾选任务。</p>
          </div>
        </FixedModal>
      )}
      {taskModal && (
        <TaskForm
          task={taskModal.task}
          saving={saving}
          onClose={() => setTaskModal(null)}
          onSubmit={(task) => upsertTask(taskModal.milestoneId, task)}
        />
      )}
    </main>
  );
}
