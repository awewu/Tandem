'use client';

import React, { useEffect, useState } from 'react';
import { Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'manual' | 'agent-confirm' | 'agent-auto';

interface Props {
  channelId: string;
  initialMode?: Mode;
  initialExpiresAt?: string | null;
  onChanged?: (mode: Mode) => void;
}

const MODE_META: Record<Mode, { label: string; icon: React.ElementType; cls: string; desc: string }> = {
  manual: {
    label: '真人',
    icon: UserIcon,
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
    desc: '我亲自回复（@分身才触发 AI）',
  },
  'agent-confirm': {
    label: '草稿',
    icon: Bot,
    cls: 'bg-amber-50 text-amber-700 border-amber-300',
    desc: '分身先生草稿，我确认才发出',
  },
  'agent-auto': {
    label: '分身',
    icon: Bot,
    cls: 'bg-violet-50 text-violet-700 border-violet-400',
    desc: '分身全自动代答（受组织记忆约束）',
  },
};

export function AgentModeToggle({ channelId, initialMode = 'manual', onChanged }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // 切换频道时同步外部 initialMode
  useEffect(() => {
    setMode(initialMode);
  }, [channelId, initialMode]);

  async function switchMode(next: Mode, expiresInMinutes?: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/im/channels/${channelId}/agent-mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next, expiresInMinutes }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      setMode(next);
      onChanged?.(next);
    } catch (err) {
      console.error('switch agent-mode failed', err);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const Meta = MODE_META[mode];
  const Icon = Meta.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title={Meta.desc}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition',
          Meta.cls,
          busy && 'opacity-50 cursor-not-allowed',
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        {Meta.label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg z-50">
          <div className="p-2 space-y-1">
            {(Object.keys(MODE_META) as Mode[]).map((k) => {
              const M = MODE_META[k];
              const I = M.icon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => switchMode(k, k === 'agent-auto' ? 120 : undefined)}
                  className={cn(
                    'w-full flex items-start gap-2 px-2 py-2 text-left rounded text-xs hover:bg-slate-50 transition',
                    mode === k && 'bg-slate-100',
                  )}
                >
                  <I className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{M.label}</div>
                    <div className="text-slate-500 mt-0.5">{M.desc}</div>
                  </div>
                </button>
              );
            })}
            {mode === 'agent-auto' && (
              <div className="px-2 py-1 text-[11px] text-violet-700 border-t border-slate-100 mt-1 pt-2">
                ⏱ 默认 2h 后自动恢复真人模式
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
