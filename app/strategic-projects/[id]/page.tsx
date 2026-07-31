import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Download,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  findStrategicProject,
  strategicProjects,
  type StrategicMilestone,
  type StrategicTask,
  type StrategicTaskStatus,
} from '@/lib/strategic-projects/sample-data';
import { cn } from '@/lib/utils';

const detailTabs = ['任务', '里程碑', '看板', '甘特图', '人力排期', '流程图', '统计', '动态', '文件', '概览', '外部协作'];

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

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-secondary text-[10px] font-semibold text-white', className)}>
      {name.slice(0, 1)}
    </span>
  );
}

function MilestoneHeader({ milestone }: { milestone: StrategicMilestone }) {
  return (
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
      <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-ink-primary" />
    </div>
  );
}

function TaskCard({ task, index }: { task: StrategicTask; index: number }) {
  const avatarTone = ['bg-[rgb(var(--brand-500))]', 'bg-success', 'bg-warning', 'bg-info', 'bg-ink-primary'];

  return (
    <article className="rounded-lg bg-[rgb(var(--surface-1))] p-4 shadow-soft-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-footnote font-medium', statusClass[task.status])}>
          {task.status === '进行中' ? '⌛ ' : task.status === '已完成' ? '✓ ' : task.status === '已取消' ? '× ' : '▷ '}
          {task.status}
        </span>
        <Avatar name={task.owner} className={avatarTone[index % avatarTone.length]} />
      </div>
      <h3 className="min-h-[44px] text-caption leading-relaxed text-ink-primary">
        <span className={cn('mr-2 font-semibold', task.priority === 'P2' ? 'text-warning' : 'text-[rgb(var(--brand-600))]')}>{task.priority}</span>
        {task.title}
      </h3>
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

export function generateStaticParams() {
  return strategicProjects.map((project) => ({ id: project.id }));
}

export default async function StrategicProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await params;
  const project = findStrategicProject(resolved.id);
  if (!project) notFound();

  return (
    <main className="min-h-full bg-[rgb(var(--surface-2))] text-ink-primary">
      <header className="border-b border-border bg-[rgb(var(--surface-1))] shadow-soft-sm">
        <div className="flex h-[78px] items-center gap-3 px-4 sm:px-7">
          <Link href="/strategic-projects" className="text-ink-secondary hover:text-ink-primary">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <Folder className="h-6 w-6 fill-current text-[rgb(var(--brand-600))]" />
          <h1 className="text-title-3 font-semibold">{project.name}</h1>
          <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-footnote font-semibold', project.completion >= 40 ? 'bg-warning/20 text-warning' : 'bg-danger/10 text-danger')}>
            <span className="h-3 w-3 rounded-full border-2 border-current" />
            {project.progressChip}
          </span>

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
              {tab === '流程图' && <sup className="ml-1 rounded-full bg-danger/10 px-1 text-[9px] text-danger">new</sup>}
            </span>
          ))}
          <Plus className="mb-4 h-4 w-4 shrink-0 text-ink-tertiary" />
          <Settings2 className="mb-4 h-4 w-4 shrink-0 text-ink-tertiary" />
        </div>
      </header>

      <section className="flex h-[64px] items-center gap-5 border-b border-border bg-[rgb(var(--surface-1))] px-7 text-footnote text-ink-tertiary">
        {['任务类型', '全部状态', '是否过期', '人员', '默认排序'].map((filter) => (
          <button key={filter} className="inline-flex shrink-0 items-center gap-1">
            {filter}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="inline-flex items-center gap-2">
          <Search className="h-4 w-4" />
          搜索
        </span>
        <span>卡片视图</span>
        <div className="ml-auto flex items-center gap-3">
          <button className="inline-flex items-center gap-1">
            <CircleHelp className="h-4 w-4" />
            示例说明
          </button>
          <button className="inline-flex h-8 items-center gap-2 rounded-full border border-border px-4 text-ink-secondary">
            <Download className="h-4 w-4" />
            导出
          </button>
          <button className="inline-flex h-8 items-center gap-2 rounded-full border border-border px-4 text-ink-secondary">
            <Users className="h-4 w-4" />
            批量操作
          </button>
        </div>
      </section>

      <section className="overflow-x-auto px-6 py-4">
        <div className="flex min-w-max gap-3">
          {project.milestones.map((milestone) => (
            <div key={milestone.id} className="w-[340px] shrink-0">
              <MilestoneHeader milestone={milestone} />
              <div className="mt-3 min-h-[calc(100vh-278px)] rounded-t-xl bg-[rgb(var(--brand-50))]/55 p-4">
                <button className="mb-3 flex h-12 w-full items-center justify-center rounded-lg bg-[rgb(var(--surface-1))] text-caption font-medium text-[rgb(var(--brand-600))]">
                  <Plus className="h-4 w-4" />
                  创建任务
                </button>
                <div className="space-y-3">
                  {milestone.tasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="w-[340px] shrink-0">
            <div className="flex h-[74px] items-center justify-center rounded-r-xl bg-[rgb(var(--surface-3))] px-4 text-caption font-medium text-ink-tertiary">
              <Plus className="h-4 w-4" />
              创建里程碑
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
