'use client';

import { useState } from 'react';
import { useOKRStore } from '@/lib/store';
import { OKR_TEMPLATES, TEMPLATE_CATEGORIES, type OKRTemplate } from '@/lib/okr/templates';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  cycleId: string;
  onClose: () => void;
  onApplied?: (objectiveId: string) => void;
}

export function OKRTemplatePicker({ open, cycleId, onClose, onApplied }: Props) {
  const addObjective = useOKRStore((s) => s.addObjective);
  const addKeyResult = useOKRStore((s) => s.addKeyResult);
  const addInitiative = useOKRStore((s) => s.addInitiative);
  const currentUserId = useOKRStore((s) => s.currentUserId);

  const [filter, setFilter] = useState<OKRTemplate['category'] | 'all'>('all');
  const [search, setSearch] = useState('');

  if (!open) return null;

  const visible = OKR_TEMPLATES.filter((t) => {
    if (filter !== 'all' && t.category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.tags.some((tg) => tg.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const apply = (tpl: OKRTemplate) => {
    const obj = addObjective({
      title: tpl.title,
      description: tpl.description,
      cycleId,
      ownerId: currentUserId,
      parentId: null,
      weight: 100,
      status: 'active',
      confidence: 'on-track',
      visibility: 'public',
      tags: tpl.tags,
      progressOverride: null,
    });
    for (const kr of tpl.keyResults) {
      const newKR = addKeyResult({
        objectiveId: obj.id,
        title: kr.title,
        ownerId: currentUserId,
        type: kr.type,
        startValue: kr.startValue,
        currentValue: kr.startValue,
        targetValue: kr.targetValue,
        unit: kr.unit,
        weight: kr.weight,
        confidence: 'on-track',
        status: 'active',
        tags: [],
      });
      if (kr.initiatives) {
        for (const initTitle of kr.initiatives) {
          addInitiative({
            scope: 'kr', scopeId: newKR.id,
            title: initTitle,
            ownerId: currentUserId,
            status: 'todo',
            priority: 'medium',
            tags: [],
          });
        }
      }
    }
    onApplied?.(obj.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-soft-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-warning" />
            <h2 className="text-headline font-semibold">OKR 模板库</h2>
            <span className="text-footnote text-muted-foreground">· {OKR_TEMPLATES.length} 个内置模板</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" title="关闭"><X size={18} /></button>
        </div>

        <div className="px-4 pt-3 pb-2 flex flex-col gap-2 border-b">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索：留存 / ARR / NPS / DORA …"
            className="w-full text-caption border rounded px-3 py-1.5 bg-background"
          />
          <div className="flex flex-wrap gap-1">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterChip>
            {TEMPLATE_CATEGORIES.map((c) => (
              <FilterChip key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
                {c.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((tpl) => (
            <div key={tpl.id} className="border rounded-lg p-3 hover:border-primary/50 hover:shadow-soft-sm transition flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-caption font-semibold">{tpl.title}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted shrink-0">
                  {TEMPLATE_CATEGORIES.find((c) => c.value === tpl.category)?.label}
                </span>
              </div>
              <div className="text-footnote text-muted-foreground line-clamp-2 mb-2">{tpl.description}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {tpl.tags.map((tg) => (
                  <span key={tg} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40">
                    {tg}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5 mb-3 flex-1">
                {tpl.keyResults.slice(0, 3).map((kr, i) => (
                  <div key={i} className="truncate">· {kr.title}</div>
                ))}
                {tpl.keyResults.length > 3 && <div className="text-[10px]">+ {tpl.keyResults.length - 3} 个 KR</div>}
              </div>
              {tpl.source && (
                <div className="text-[10px] text-muted-foreground italic mb-2">{tpl.source}</div>
              )}
              <button
                onClick={() => apply(tpl)}
                className="text-footnote px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                使用此模板
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="col-span-full text-center text-caption text-muted-foreground py-8">
              没有符合条件的模板
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-footnote px-2.5 py-1 rounded-full border transition',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-transparent hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}
