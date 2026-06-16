'use client';

import { useState } from 'react';
import { Smile } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👀', '🙏', '🔥'];

interface Props {
  messageId: string;
  reactions?: Record<string, string[]>;
  currentUserId: string;
  onChanged?: (next: Record<string, string[]>) => void;
}

export function MessageReactions({ messageId, reactions = {}, currentUserId, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-full border border-dashed border-hairline bg-surface-2 px-1.5 py-0.5 text-ink-tertiary hover:bg-surface-3"
          title="加表情"
        >
          <Smile className="h-3 w-3" />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-0.5 rounded-md border border-hairline bg-surface-2 p-1 shadow-soft-lg">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                disabled={busy}
                className="h-7 w-7 rounded hover:bg-surface-3 text-body"
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
