'use client';

import { useOKRStore, type OKRActivity } from '@/lib/store';
import {
  Plus, Edit3, Trash2, MessageSquare, Award, BookOpen, RotateCcw,
  Archive, CheckCircle2, UserCheck, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  scope: 'objective' | 'kr';
  scopeId: string;
  /** 限制条数，默认全部 */
  limit?: number;
}

const ACTION_META: Record<OKRActivity['action'], { icon: any; cls: string }> = {
  'create':    { icon: Plus,         cls: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  'update':    { icon: Edit3,        cls: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  'delete':    { icon: Trash2,       cls: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  'check-in':  { icon: AlertCircle,  cls: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  'comment':   { icon: MessageSquare,cls: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  'reaction':  { icon: Award,        cls: 'text-pink-600 bg-pink-50 dark:bg-pink-950/30' },
  'score':     { icon: Award,        cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  'review':    { icon: BookOpen,     cls: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
  'reassign':  { icon: UserCheck,    cls: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30' },
  'complete':  { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  'archive':   { icon: Archive,      cls: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
  'reopen':    { icon: RotateCcw,    cls: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30' },
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
  const people = useOKRStore((s) => s.people);
  const list = limit ? activities.slice(0, limit) : activities;

  if (list.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
        还没有动态
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">活动 <span className="text-muted-foreground font-normal">· {activities.length}</span></div>
      <div className="space-y-1">
        {list.map((a) => {
          const meta = ACTION_META[a.action];
          const Icon = meta.icon;
          const actor = people.find((p) => p.id === a.actorId);
          return (
            <div key={a.id} className="flex items-start gap-2 text-xs py-1.5">
              <div className={cn('w-6 h-6 shrink-0 rounded-full flex items-center justify-center', meta.cls)}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{actor?.name || '系统'}</span>{' '}
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
