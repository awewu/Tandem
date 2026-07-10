'use client';

import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👀', '🙏', '🔥'];

interface Props {
  messageId: string;
  reactions?: Record<string, string[]>;
  currentUserId: string;
  onChanged?: (next: Record<string, string[]>) => void;
  /** 弹层展开方向: 右对齐消息传 'right' 避免弹层溢出被裁 */
  align?: 'left' | 'right';
  /** 弹层开合变化: 父级据此隐藏 hover 浮条, 避免与表情条冲突 */
  onOpenChange?: (open: boolean) => void;
}

export function MessageReactions({ messageId, reactions = {}, currentUserId, onChanged, align = 'left', onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: { reactions?: Record<string, string[]> } };
        onChanged?.(data.message.reactions ?? {});
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={busy}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition ${
              mine ? 'border-warning/30 bg-warning/5 text-warning' : 'border-hairline bg-surface-2 text-ink-secondary hover:bg-surface-3'
            }`}
            title={users.join(', ')}
          >
            <span>{emoji}</span>
            <span className="font-medium">{users.length}</span>
          </button>
        );
      })}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-full border border-dashed border-hairline bg-surface-2 px-1.5 py-0.5 text-ink-tertiary hover:bg-surface-3"
          title="加表情"
        >
          <Smile className="h-3 w-3" />
        </button>
        {open && (
          <div
            className={`absolute bottom-full mb-2 z-50 flex w-max gap-0.5 rounded-full border border-hairline bg-surface-1 px-1 py-0.5 shadow-soft-lg ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                disabled={busy}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none transition hover:scale-110 hover:bg-surface-3"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
