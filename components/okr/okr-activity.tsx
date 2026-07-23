'use client';

import { useOKRStore, type OKRActivity } from '@/lib/store';
import {
  Plus, Edit3, Trash2, MessageSquare, Award, BookOpen, RotateCcw,
  Archive, CheckCircle2, UserCheck, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';

interface Props {
  scope: 'objective' | 'kr';
  scopeId: string;
  /** 限制条数，默认全部 */
  limit?: number;
}

const ACTION_META: Record<OKRActivity['action'], { icon: any; cls: string }> = {
  'create':    { icon: Plus,         cls: 'text-success bg-success/5 dark:bg-success/30' },
  'update':    { icon: Edit3,        cls: 'text-info bg-info/10 dark:bg-info/40' },
  'delete':    { icon: Trash2,       cls: 'text-danger bg-danger/5 dark:bg-danger/30' },
  'check-in':  { icon: AlertCircle,  cls: 'text-warning bg-warning/10 dark:bg-warning/40' },
  'comment':   { icon: MessageSquare,cls: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30' },
  'reaction':  { icon: Award,        cls: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30' },
  'score':     { icon: Award,        cls: 'text-warning bg-warning/5 dark:bg-warning/30' },
  'review':    { icon: BookOpen,     cls: 'text-info bg-info/10 dark:bg-info/40' },
  'reassign':  { icon: UserCheck,    cls: 'text-info bg-info/10 dark:bg-info/40' },
  'complete':  { icon: CheckCircle2, cls: 'text-success bg-success/10 dark:bg-success/40' },
  'archive':   { icon: Archive,      cls: 'text-ink-secondary bg-surface-2 dark:bg-ink-primary/30' },
  'reopen':    { icon: RotateCcw,    cls: 'text-warning bg-warning/10 dark:bg-warning/35' },
};

function timeAgo(t: number): string {
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

export function OKRActivityFeed({ scope, scopeId, limit }: Props) {
  const activities = useOKRStore((s) => s.getActivities(scope, scopeId));
  const { nameOf } = useOwnerDirectory();
  const list = limit ? activities.slice(0, limit) : activities;

  if (list.length === 0) {
    return (
      <div className="text-footnote text-muted-foreground text-center py-4 border border-dashed rounded">
        还没有动态
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-caption font-medium">活动 <span className="text-muted-foreground font-normal">· {activities.length}</span></div>
      <div className="space-y-1">
        {list.map((a) => {
          const meta = ACTION_META[a.action];
          const Icon = meta.icon;
          return (
            <div key={a.id} className="flex items-start gap-2 text-footnote py-1.5">
              <div className={cn('w-6 h-6 shrink-0 rounded-full flex items-center justify-center', meta.cls)}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-caption">
                  <span className="font-medium">{nameOf(a.actorId)}</span>{' '}
                  <span className="text-muted-foreground">{a.summary}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {timeAgo(a.createdAt)} · {a.scope === 'kr' ? 'KR' : a.scope === 'objective' ? '目标' : a.scope}
                </div>
                {a.changes && Object.keys(a.changes).length > 0 && Object.keys(a.changes).length <= 3 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                    {Object.entries(a.changes).slice(0, 3).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{k}</span>: {String(v.from ?? '∅')} → {String(v.to ?? '∅')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
