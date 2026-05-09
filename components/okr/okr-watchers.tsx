'use client';

import { useOKRStore } from '@/lib/store';
import { Eye, Users, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Props {
  scope: 'objective' | 'kr';
  scopeId: string;
}

export function OKRWatchers({ scope, scopeId }: Props) {
  const obj = useOKRStore((s) => scope === 'objective' ? s.objectives.find((o) => o.id === scopeId) : null);
  const kr = useOKRStore((s) => scope === 'kr' ? s.keyResults.find((k) => k.id === scopeId) : null);
  const people = useOKRStore((s) => s.people);
  const currentUserId = useOKRStore((s) => s.currentUserId);
  const toggleWatcher = useOKRStore((s) => s.toggleWatcher);
  const toggleCollaborator = useOKRStore((s) => s.toggleCollaborator);

  const [pickWatcher, setPickWatcher] = useState(false);
  const [pickCollab, setPickCollab] = useState(false);

  const entity = obj || kr;
  if (!entity) return null;

  const watchers = entity.watchers || [];
  const collaborators = entity.collaborators || [];
  const isWatching = watchers.includes(currentUserId);

  return (
    <div className="space-y-3 text-xs">
      {/* 我关注 */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Eye size={13} /> 关注此{scope === 'objective' ? '目标' : 'KR'}
        </span>
        <button
          onClick={() => toggleWatcher(scope, scopeId, currentUserId)}
          className={cn(
            'text-xs px-2.5 py-1 rounded border transition',
            isWatching
              ? 'bg-primary text-primary-foreground border-primary'
              : 'hover:bg-muted',
          )}
        >
          {isWatching ? '已关注' : '关注'}
        </button>
      </div>

      {/* 关注者列表 */}
      {watchers.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1">关注者 · {watchers.length}</div>
          <div className="flex flex-wrap gap-1">
            {watchers.map((id) => {
              const p = people.find((x) => x.id === id);
              if (!p) return null;
              return (
                <span key={id} className="px-1.5 py-0.5 rounded bg-muted text-xs flex items-center gap-1" title={p.name}>
                  <span className="w-4 h-4 rounded-full bg-background flex items-center justify-center text-[9px]">
                    {p.name.slice(0, 1)}
                  </span>
                  {p.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 协作者 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Users size={13} /> 协作者 · {collaborators.length}
          </span>
          <button onClick={() => setPickCollab(!pickCollab)} className="hover:text-foreground" title="添加协作者">
            <Plus size={13} />
          </button>
        </div>
        {pickCollab && (
          <div className="border rounded p-1.5 mb-1 flex flex-wrap gap-1">
            {people.filter((p) => !collaborators.includes(p.id)).map((p) => (
              <button
                key={p.id}
                onClick={() => { toggleCollaborator(scope, scopeId, p.id); setPickCollab(false); }}
                className="text-xs px-2 py-0.5 rounded hover:bg-muted"
              >
                + {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {collaborators.map((id) => {
            const p = people.find((x) => x.id === id);
            if (!p) return null;
            return (
              <span key={id} className="group px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 text-xs flex items-center gap-1">
                {p.name}
                <button
                  onClick={() => toggleCollaborator(scope, scopeId, id)}
                  className="opacity-50 group-hover:opacity-100 hover:text-red-600"
                  title="移除"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
