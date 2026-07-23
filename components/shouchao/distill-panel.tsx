'use client';

/**
 * 搭子手抄 · A2 个人蒸馏面板 (整理建议)
 *
 * 自包含: 拉取 /api/shouchao/distill, 触发扫描, 逐条应用/忽略。
 * 承 megaplan C3/C4: 建议默认 pending, 人确认才生效; 纯个人域, 只进本人分身。
 */

import { useCallback, useEffect, useState } from 'react';
import { X, Sparkles, Loader2, Check, Link2, FileText, Table as TableIcon } from 'lucide-react';

interface DistillCandidate {
  id: string;
  type: 'link' | 'summarize' | 'structure';
  suggestion: string;
  rationale: string;
}

const TYPE_META: Record<DistillCandidate['type'], { label: string; Icon: typeof Link2 }> = {
  link: { label: '建双链', Icon: Link2 },
  summarize: { label: '加摘要', Icon: FileText },
  structure: { label: '结构化', Icon: TableIcon },
};

export function DistillPanel({ onClose }: { onClose: () => void }) {
  const [candidates, setCandidates] = useState<DistillCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/shouchao/distill', { credentials: 'include', cache: 'no-store' });
      const d = r.ok ? await r.json() : { candidates: [] };
      setCandidates(d.candidates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function scan() {
    setScanning(true);
    try {
      await fetch('/api/shouchao/distill', { method: 'POST', credentials: 'include' });
      await load();
    } finally {
      setScanning(false);
    }
  }

  async function act(id: string, action: 'apply' | 'dismiss') {
    setBusyId(id);
    try {
      const r = await fetch(`/api/shouchao/distill/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (r.ok) setCandidates((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-surface-1 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-ink-primary">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <span className="text-callout font-semibold">整理建议</span>
            <span className="text-footnote text-ink-tertiary">· 仅整理你授权的笔记，不出个人范围</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-tertiary hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-ink-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center text-caption text-ink-tertiary">
              暂无建议。点下方「扫描」让 AI 分析你已授权的笔记。
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const { label, Icon } = TYPE_META[c.type];
                return (
                  <div key={c.id} className="rounded-lg border border-border bg-surface-1 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-brand-500" />
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-footnote font-medium text-brand-600">{label}</span>
                      <span className="text-footnote text-ink-tertiary">{c.rationale}</span>
                    </div>
                    <p className="text-caption text-ink-secondary">{c.suggestion}</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => act(c.id, 'dismiss')}
                        disabled={busyId === c.id}
                        className="rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 disabled:opacity-40"
                      >
                        忽略
                      </button>
                      <button
                        type="button"
                        onClick={() => act(c.id, 'apply')}
                        disabled={busyId === c.id}
                        className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 text-footnote font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                      >
                        {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        应用
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-footnote text-ink-tertiary">建议默认不生效，应用后才改动你的笔记</span>
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50/40 px-3 py-1.5 text-caption font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40 surface-interactive"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            扫描
          </button>
        </div>
      </div>
    </div>
  );
}
