'use client';

/**
 * 搭子手抄 · A1 从笔记 AI 导入数据库 (草稿 + 人工确认)
 *
 * 流程: 选笔记 → 调 /extract 出草稿行 → 预览(可勾选) → 确认 → 父组件批量落库。
 * 承 megaplan C3: 确认前绝不写库; 用户可取消, 零副作用。
 */

import { useEffect, useState } from 'react';
import { X, Sparkles, Loader2, Check } from 'lucide-react';
import type { ShouchaoProperty, ShouchaoCellValue } from '@/lib/types/shouchao-db';

interface DraftRow {
  cells: Record<string, ShouchaoCellValue>;
}
interface NoteLite {
  id: string;
  title: string;
  updatedAt: string;
}

interface DatabaseImportProps {
  databaseId: string;
  properties: ShouchaoProperty[];
  onClose: () => void;
  onConfirm: (rows: DraftRow[]) => Promise<void>;
}

type Phase = 'select' | 'extracting' | 'preview' | 'saving';

function cellText(v: ShouchaoCellValue): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? '✓' : '';
  return String(v);
}

export function DatabaseImport({ databaseId, properties, onClose, onConfirm }: DatabaseImportProps) {
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<Phase>('select');
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [keep, setKeep] = useState<Set<number>>(() => new Set());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/shouchao/notes', { credentials: 'include', cache: 'no-store' });
        const d = r.ok ? await r.json() : { notes: [] };
        if (alive) setNotes((d.notes ?? []).map((n: NoteLite) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleNote = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function runExtract() {
    if (selected.size === 0) return;
    setPhase('extracting');
    setErr(null);
    try {
      const r = await fetch(`/api/shouchao/databases/${databaseId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteIds: Array.from(selected) }),
      });
      if (r.status === 503) {
        setErr('未配置 AI 模型，无法抽取。请联系管理员配置 LLM。');
        setPhase('select');
        return;
      }
      if (!r.ok) {
        setErr('抽取失败，请重试。');
        setPhase('select');
        return;
      }
      const d = await r.json();
      const rows: DraftRow[] = d.draftRows ?? [];
      setDraftRows(rows);
      setKeep(new Set(rows.map((_, i) => i)));
      setPhase('preview');
    } catch {
      setErr('抽取失败，请重试。');
      setPhase('select');
    }
  }

  async function confirmImport() {
    const rows = draftRows.filter((_, i) => keep.has(i));
    if (rows.length === 0) return;
    setPhase('saving');
    try {
      await onConfirm(rows);
      onClose();
    } catch {
      setErr('保存失败，请重试。');
      setPhase('preview');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-surface-1 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-ink-primary">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <span className="text-callout font-semibold">从笔记 AI 导入</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-tertiary hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && <div className="mx-4 mt-3 rounded-md bg-danger-50 px-3 py-2 text-caption text-danger">{err}</div>}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {phase === 'select' && (
            <>
              <p className="mb-2 text-caption text-ink-tertiary">选择要抽取的笔记（AI 会按当前表格的列结构化）：</p>
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-ink-tertiary"><Loader2 className="h-4 w-4 animate-spin" /> 加载笔记…</div>
              ) : notes.length === 0 ? (
                <p className="py-6 text-center text-caption text-ink-tertiary">还没有笔记。</p>
              ) : (
                <div className="space-y-1">
                  {notes.map((n) => (
                    <label key={n.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                      <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleNote(n.id)} className="h-4 w-4 accent-brand-500" />
                      <span className="truncate text-caption text-ink-secondary">{n.title || '未命名'}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

          {phase === 'extracting' && (
            <div className="flex flex-col items-center gap-3 py-10 text-ink-tertiary">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <span className="text-caption">AI 正在抽取 {selected.size} 条笔记…</span>
            </div>
          )}

          {(phase === 'preview' || phase === 'saving') && (
            <>
              <p className="mb-2 text-caption text-ink-tertiary">
                抽取出 {draftRows.length} 行草稿，勾选要导入的行（确认前不会写入）：
              </p>
              {draftRows.length === 0 ? (
                <p className="py-6 text-center text-caption text-ink-tertiary">没有可结构化的内容。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-caption">
                    <thead>
                      <tr>
                        <th className="border border-border bg-surface-2/50 px-2 py-1"> </th>
                        {properties.map((p) => (
                          <th key={p.id} className="border border-border bg-surface-2/50 px-2 py-1 text-left text-footnote font-semibold text-ink-secondary">
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftRows.map((row, i) => (
                        <tr key={i} className={keep.has(i) ? '' : 'opacity-40'}>
                          <td className="border border-border px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={keep.has(i)}
                              onChange={() =>
                                setKeep((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                              className="h-4 w-4 accent-brand-500"
                            />
                          </td>
                          {properties.map((p) => (
                            <td key={p.id} className="border border-border px-2 py-1 text-ink-primary">
                              {cellText(row.cells[p.id] ?? null)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          {phase === 'select' && (
            <button
              type="button"
              onClick={runExtract}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-caption font-semibold text-white hover:bg-brand-600 disabled:opacity-40 surface-interactive"
            >
              <Sparkles className="h-3.5 w-3.5" /> 抽取 {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          )}
          {(phase === 'preview' || phase === 'saving') && (
            <button
              type="button"
              onClick={confirmImport}
              disabled={phase === 'saving' || keep.size === 0}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-caption font-semibold text-white hover:bg-brand-600 disabled:opacity-40 surface-interactive"
            >
              {phase === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              确认导入 {keep.size > 0 ? `(${keep.size})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
