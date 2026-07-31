import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Folder,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { strategicProjects, type StrategicProjectRisk } from '@/lib/strategic-projects/sample-data';
import { cn } from '@/lib/utils';

const pageTabs = ['项目概览', '项目里程碑', '进度追踪', '甘特图', '人力排期'];

const riskClass: Record<StrategicProjectRisk, string> = {
  normal: 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]',
  attention: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/10 text-danger',
};

const progressClass = (completion: number) => {
  if (completion === 0) return 'bg-[rgb(var(--brand-50))] text-ink-secondary';
  if (completion >= 60) return 'bg-danger/20 text-ink-primary';
  if (completion >= 40) return 'bg-warning/25 text-ink-primary';
  return 'bg-danger/20 text-ink-primary';
};

function Avatar({ name, index }: { name: string; index: number }) {
  const tones = [
    'bg-[rgb(var(--brand-500))]',
    'bg-success',
    'bg-info',
    'bg-warning',
    'bg-ink-secondary',
  ];

  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white', tones[index % tones.length])}>
      {name.slice(0, 1)}
    </span>
  );
}

export default function StrategicProjectsPage() {
  return (
    <main className="min-h-full bg-[rgb(var(--surface-2))] text-ink-primary">
      <div className="flex gap-4 px-4 py-5">
        <aside className="hidden w-[204px] shrink-0 rounded-2xl bg-[rgb(var(--surface-1))] p-3 shadow-soft-sm md:block">
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
          <header className="flex min-h-[122px] flex-col justify-between border-b border-border px-6 pt-4">
            <div className="flex items-center gap-3">
              <ArrowLeft className="h-6 w-6 text-ink-primary" />
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
                <Folder className="h-5 w-5 fill-current" />
              </div>
              <h1 className="text-title-3 font-semibold">V项目</h1>
              <div className="ml-auto flex items-center gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
                  <Plus className="h-5 w-5" />
                </button>
                {strategicProjects.slice(0, 5).map((project, index) => (
                  <Avatar key={project.id} name={project.owner} index={index} />
                ))}
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--brand-500))] text-caption font-semibold text-white">12</span>
                <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-tertiary">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink-tertiary">
                  <Settings2 className="h-4 w-4" />
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
              <button className="inline-flex items-center gap-1">
                状态
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button className="inline-flex items-center gap-1">
                负责人
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <label className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>搜索</span>
              </label>
              <div className="ml-auto flex gap-3">
                <button className="inline-flex h-8 items-center gap-1 rounded-full border border-[rgb(var(--brand-300))] px-4 text-[rgb(var(--brand-600))]">
                  <Plus className="h-4 w-4" />
                  添加子项目集
                </button>
                <button className="inline-flex h-8 items-center gap-1 rounded-full bg-[rgb(var(--brand-500))] px-4 font-semibold text-white">
                  <Plus className="h-4 w-4" />
                  添加项目
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] border-collapse text-caption">
                  <thead className="bg-[rgb(var(--surface-2))] text-left text-footnote font-medium text-ink-tertiary">
                    <tr>
                      {['名称', '状态', '风险等级', '负责人', '完成度', '任务数', '过期任务数', '开始日期', '截止日期', '项目目标'].map((column) => (
                        <th key={column} className="border-b border-r border-border px-4 py-3 last:border-r-0">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategicProjects.map((project, index) => (
                      <tr key={project.id} className="h-[46px] hover:bg-[rgb(var(--brand-50))]/45">
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <Link href={`/strategic-projects/${project.id}`} className="flex items-center gap-2 font-medium text-ink-secondary hover:text-[rgb(var(--brand-600))]">
                            <FileText className="h-4 w-4 text-ink-tertiary" />
                            {project.name}
                          </Link>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className="rounded-full bg-[rgb(var(--brand-50))] px-3 py-1 text-ink-secondary">
                            {project.status}
                          </span>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className={cn('inline-flex min-w-[84px] justify-center rounded-full px-3 py-1', riskClass[project.risk])}>
                            {project.riskLabel}
                          </span>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0">
                          <span className="inline-flex items-center gap-2">
                            <Avatar name={project.owner} index={index} />
                            {project.owner}
                          </span>
                        </td>
                        <td className="border-b border-r border-border px-2 last:border-r-0">
                          <div className={cn('relative h-9 overflow-hidden rounded-lg text-center leading-9', progressClass(project.completion))}>
                            {project.completion > 0 && (
                              <span
                                className={cn('absolute inset-y-0 left-0', project.completion >= 40 ? 'bg-danger/60' : 'bg-[rgb(var(--brand-300))]')}
                                style={{ width: `${project.completion}%` }}
                              />
                            )}
                            <span className="relative">{project.completionText}</span>
                          </div>
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0 text-ink-secondary">
                          {project.tasksText}
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0 text-danger">
                          {project.overdueTasks > 0 ? project.overdueTasks : ''}
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0 text-ink-secondary">
                          {project.startDate}
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0 text-ink-secondary">
                          {project.dueDate}
                        </td>
                        <td className="border-b border-r border-border px-4 last:border-r-0 text-ink-secondary">
                          {project.objective}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 text-caption text-ink-secondary">
              <span>共 9 条</span>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-tertiary">‹</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--brand-500))] text-[rgb(var(--brand-600))]">1</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-tertiary">›</button>
              <button className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3">
                20 条/页
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
