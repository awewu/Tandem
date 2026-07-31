'use client';

/**
 * /memory/capture · 产出捕获层 (#17) · 我的待沉淀队列
 *
 * 列出 AI 从我与分身/中央 AI 协作产出中提炼的可复用知识候选。
 * 一键「采纳」→ 走宪章 §8.1 三级签批; 「忽略」→ 丢弃。
 */

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, Check, X, Loader2, Inbox, ArrowUpRight } from 'lucide-react';

interface Candidate {
  id: string;
  title: string;
  body: string;
  proposedType: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  suggestedLevel: 'team' | 'dept' | 'company';
  confidence: number;
  rationale?: string;
  source: string;
  dedupOfMemoryId?: string;
  createdAt: string;
}

const TYPE_LABEL: Record<Candidate['proposedType'], string> = {
  sop: '标准流程', case: '案例', redline: '红线', value: '价值观', lesson: '经验',
};
const LEVEL_LABEL: Record<Candidate['suggestedLevel'], string> = {
  team: '团队级', dept: '部门级', company: '公司级',
};

export default function CaptureQueuePage() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/memory/capture?status=pending', {
        credentials: 'include',
        cache: 'no-store',
      }).then((r) => r.json());
      setItems(res.items ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: 'accept' | 'dismiss') {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/memory/capture/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-caption text-tertiary mb-1">
          <Sparkles className="h-4 w-4 text-[rgb(var(--brand-500))]" />
          <span>产出捕获 · 待沉淀队列</span>
        </div>
        <h1 className="text-title-2 text-primary">把工作产出沉淀为组织记忆</h1>
        <p className="mt-1.5 text-caption text-secondary">
          AI 从你与分身/中央 AI 的协作中提炼可复用知识。采纳后走三级签批, 通过即成为组织记忆并反哺全员 AI。
        </p>
      </header>

      {err && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-caption text-danger">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-tertiary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载待沉淀候选…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-tertiary">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-caption">暂无待沉淀候选。多和分身协作产出方案/复盘, AI 会自动提炼到这里。</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              className="surface-card rounded-2xl p-4 shadow-soft-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-footnote text-tertiary mb-1">
                    <span className="pill-brand">{TYPE_LABEL[c.proposedType]}</span>
                    <span className="pill-neutral">{LEVEL_LABEL[c.suggestedLevel]}</span>
                    <span>置信 {(c.confidence * 100).toFixed(0)}%</span>
                    {c.dedupOfMemoryId && (
                      <span className="text-warning">· 疑似已有相似记忆</span>
                    )}
                  </div>
                  <h3 className="text-headline text-primary truncate">{c.title}</h3>
                </div>
              </div>
              <p className="text-caption text-secondary whitespace-pre-wrap leading-relaxed">{c.body}</p>
              {c.rationale && (
                <p className="text-footnote text-tertiary italic">复用价值: {c.rationale}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => void act(c.id, 'accept')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] px-3.5 py-1.5 text-caption font-medium text-white surface-interactive hover:bg-[rgb(var(--brand-600))] disabled:opacity-50"
                >
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  采纳 · 送签批
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => void act(c.id, 'dismiss')}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-caption text-tertiary surface-interactive hover:bg-[rgb(var(--surface-3))] disabled:opacity-50"
                  style={{ borderColor: 'rgb(var(--border-subtle))' }}
                >
                  <X className="h-3.5 w-3.5" /> 忽略
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
