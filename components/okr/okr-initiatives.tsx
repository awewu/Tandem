'use client';

import { useState } from 'react';
import { useOKRStore, type Initiative } from '@/lib/store';
import { Plus, Trash2, Check, Circle, AlertTriangle, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  scope: 'kr' | 'objective';
  scopeId: string;
}

const STATUS_OPTIONS: { v: Initiative['status']; label: string; cls: string; icon: any }[] = [
  { v: 'todo', label: '待办', cls: 'text-muted-foreground', icon: Circle },
  { v: 'in-progress', label: '进行中', cls: 'text-blue-600', icon: Clock },
  { v: 'done', label: '已完成', cls: 'text-success', icon: Check },
  { v: 'blocked', label: '阻塞', cls: 'text-danger', icon: AlertTriangle },
  { v: 'cancelled', label: '取消', cls: 'text-muted-foreground line-through', icon: X },
];

const PRIORITY_OPTIONS: { v: Initiative['priority']; label: string; cls: string }[] = [
  { v: 'low', label: '低', cls: 'bg-gray-100 text-gray-700' },
  { v: 'medium', label: '中', cls: 'bg-blue-100 text-blue-700' },
  { v: 'high', label: '高', cls: 'bg-orange-100 text-orange-700' },
  { v: 'urgent', label: '紧急', cls: 'bg-danger/10 text-danger' },
];

export function OKRInitiatives({ scope, scopeId }: Props) {
  const initiatives = useOKRStore((s) => s.initiatives.filter((i) => i.scope === scope && i.scopeId === scopeId));
  const people = useOKRStore((s) => s.people);
  const currentUserId = useOKRStore((s) => s.currentUserId);
  const addInitiative = useOKRStore((s) => s.addInitiative);
  const updateInitiative = useOKRStore((s) => s.updateInitiative);
  const deleteInitiative = useOKRStore((s) => s.deleteInitiative);

  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPriority, setDraftPriority] = useState<Initiative['priority']>('medium');

  const submit = () => {
    if (!draftTitle.trim()) return;
    addInitiative({
      scope, scopeId,
      title: draftTitle.trim(),
      ownerId: currentUserId,
      status: 'todo',
      priority: draftPriority,
      tags: [],
    });
    setDraftTitle('');
    setDraftPriority('medium');
    setAdding(false);
  };

  const sorted = [...initiatives].sort((a, b) => {
    const sOrder = { 'todo': 0, 'in-progress': 1, 'blocked': 2, 'done': 3, 'cancelled': 4 };
    return sOrder[a.status] - sOrder[b.status] || a.createdAt - b.createdAt;
  });

  const doneCount = initiatives.filter((i) => i.status === 'done').length;
  const totalCount = initiatives.filter((i) => i.status !== 'cancelled').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-caption font-medium">
          行动项 {totalCount > 0 && (
            <span className="text-muted-foreground font-normal">
              · {doneCount}/{totalCount} 完成
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-footnote flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground"
            title="新增行动项"
          >
            <Plus size={12} /> 新增
          </button>
        )}
      </div>

      {adding && (
        <div className="border rounded p-2 space-y-2 bg-muted/30">
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="行动项标题（如：搭建客户健康度评分模型）"
            className="w-full text-caption bg-background border rounded px-2 py-1"
          />
          <div className="flex items-center gap-2">
            <select
              value={draftPriority}
              onChange={(e) => setDraftPriority(e.target.value as any)}
              className="text-footnote border rounded px-2 py-1 bg-background"
              title="优先级"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            <button onClick={submit} className="text-footnote px-2 py-1 rounded bg-primary text-primary-foreground">添加</button>
            <button onClick={() => { setAdding(false); setDraftTitle(''); }} className="text-footnote px-2 py-1 rounded hover:bg-muted">取消</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding && (
        <div className="text-footnote text-muted-foreground text-center py-4 border border-dashed rounded">
          还没有行动项 · KR 是衡量结果，行动项是为达成 KR 而做的具体动作
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((init) => {
          const owner = people.find((p) => p.id === init.ownerId);
          const status = STATUS_OPTIONS.find((s) => s.v === init.status)!;
          const priority = PRIORITY_OPTIONS.find((p) => p.v === init.priority)!;
          const StatusIcon = status.icon;
          const overdue = init.dueDate && init.dueDate < Date.now() && init.status !== 'done' && init.status !== 'cancelled';
          return (
            <div
              key={init.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded border text-caption group',
                init.status === 'done' && 'opacity-60',
                init.status === 'blocked' && 'border-danger/20 bg-danger/5/50 dark:bg-danger/20',
              )}
            >
              <button
                onClick={() => {
                  const order = STATUS_OPTIONS.map((s) => s.v);
                  const next = order[(order.indexOf(init.status) + 1) % order.length];
                  updateInitiative(init.id, { status: next });
                }}
                title={`点击切换状态（当前：${status.label}）`}
                className={cn('shrink-0', status.cls)}
              >
                <StatusIcon size={16} />
              </button>
              <input
                value={init.title}
                onChange={(e) => updateInitiative(init.id, { title: e.target.value })}
                className={cn(
                  'flex-1 bg-transparent border-0 outline-none text-caption',
                  init.status === 'done' && 'line-through',
                )}
              />
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded shrink-0', priority.cls)}>
                {priority.label}
              </span>
              {overdue && <span className="text-[10px] text-danger shrink-0">逾期</span>}
              {owner && (
                <span className="text-[10px] text-muted-foreground shrink-0" title={owner.name}>
                  {owner.name.slice(0, 1)}
                </span>
              )}
              <button
                onClick={() => deleteInitiative(init.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger shrink-0"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
