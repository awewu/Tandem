'use client';

/**
 * /story-chain · 端到端故事链 provenance (Phase 4 · 点亮 · 2026-07-20)
 *
 * 选一个 KR, 一屏看清 议事决议 → 沉淀Material → 签批Memory → 分身/1on1 → Initiative → KR进度
 * 的完整因果链路。只读, 纯展示 Tandem 的核心叙事闭环 (讲清卖点)。
 *
 * CHARTER-UI-V1 合规: surface/ink tokens · text-{title/headline/body/caption/footnote} · semantic 色 · rounded-2xl · shadow-soft-*。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  GitBranch, Target, Rocket, ScrollText, FileText, Stamp, MessageSquare, Loader2, Link2,
} from 'lucide-react';

interface MemoryNode { id: string; title: string; type: string; status: string; ownershipLevel: string }
interface MaterialNode { id: string; title: string; type: string; memory: MemoryNode | null }
interface DecisionNode {
  id: string; title: string; state: string; selected?: string; anchoredDirectly: boolean;
  materials: MaterialNode[]; citedMemory: Array<{ id: string; title: string }>;
}
interface InitiativeNode {
  id: string; title: string; status: string;
  fromDecisionCardIds: string[]; fromActionItem: { id: string; meetingTitle?: string } | null;
}
interface CheckInNode {
  id: string; createdAt: string; progressAfter: number; confidenceAfter: string;
  achievements?: string | null; blockers?: string | null;
}
interface StoryChain {
  anchor: { krId: string; krTitle: string; progress: number; confidence: string; objectiveId?: string; objectiveTitle?: string };
  initiatives: InitiativeNode[];
  decisions: DecisionNode[];
  checkIns: CheckInNode[];
  stats: { initiativeCount: number; decisionCount: number; materialCount: number; memoryCount: number; checkInCount: number };
}
interface AnchorKr { krId: string; krTitle: string; objectiveTitle?: string; progress: number }

const OWNERSHIP_LABEL: Record<string, string> = {
  company: '公司级', department: '部门级', team: '团队级', personal: '个人',
};
const CONFIDENCE_CLASS: Record<string, string> = {
  'on-track': 'text-success', 'at-risk': 'text-warning', 'off-track': 'text-danger',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function AnchorPicker({
  anchors,
  selectedKr,
  onSelect,
}: {
  anchors: AnchorKr[];
  selectedKr: string;
  onSelect: (krId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = anchors.find((a) => a.krId === selectedKr);
  const filteredAnchors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return anchors;
    return anchors.filter((a) => {
      const haystack = `${a.krTitle} ${a.objectiveTitle ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [anchors, query]);

  return (
    <section className="mb-4 rounded-2xl border bg-surface-1 p-3 shadow-soft-sm">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-caption font-medium text-ink-primary">选择链路锚点</div>
          <div className="mt-0.5 truncate text-footnote text-ink-tertiary">
            {selected
              ? `${selected.krTitle}${selected.objectiveTitle ? ` · ${selected.objectiveTitle}` : ''}`
              : '先选择一个 KR 作为故事链起点'}
          </div>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="shrink-0 rounded-full border px-2.5 py-1 text-footnote text-ink-secondary hover:bg-surface-2"
          >
            清除
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="筛选 KR / Objective..."
        className="mb-2 w-full rounded-2xl border border-border bg-surface-2 px-3 py-2 text-caption text-ink-primary outline-none placeholder:text-ink-tertiary focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
      />

      {anchors.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface-2 px-3 py-4 text-center text-footnote text-ink-tertiary">
          暂无可用 KR
        </div>
      ) : filteredAnchors.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-surface-2 px-3 py-4 text-center text-footnote text-ink-tertiary">
          没有匹配的 KR
        </div>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {filteredAnchors.map((a) => {
            const active = a.krId === selectedKr;
            return (
              <button
                key={a.krId}
                type="button"
                onClick={() => onSelect(a.krId)}
                className={[
                  'flex w-full min-w-0 items-start gap-3 rounded-2xl border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-brand-300 bg-brand-50 text-brand-800'
                    : 'border-transparent bg-surface-2 text-ink-primary hover:border-brand-200 hover:bg-brand-50/40',
                ].join(' ')}
              >
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-caption font-medium leading-snug">
                    {a.krTitle}
                  </span>
                  {a.objectiveTitle && (
                    <span className="mt-0.5 block break-words text-footnote text-ink-tertiary">
                      O · {a.objectiveTitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-surface-1 px-2 py-0.5 text-footnote text-ink-secondary">
                  {pct(a.progress)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StoryChainPage() {
  const [anchors, setAnchors] = useState<AnchorKr[]>([]);
  const [selectedKr, setSelectedKr] = useState<string>('');
  const [chain, setChain] = useState<StoryChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/story-chain', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAnchors(Array.isArray(data.anchors) ? data.anchors : []);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedKr) {
      setChain(null);
      return;
    }
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/story-chain?krId=${encodeURIComponent(selectedKr)}`, {
          credentials: 'include', cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChain(data.chain ?? null);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKr]);

  return (
    <div className="mx-auto max-w-5xl min-w-0 overflow-x-hidden p-4 md:p-6">
      <header className="mb-4">
        <div className="flex min-w-0 items-start gap-2">
          <GitBranch className="mt-1 h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <h1 className="break-words text-title-2 text-ink-primary">
              故事链 · 端到端 provenance
            </h1>
          </div>
        </div>
        <p className="text-footnote text-ink-tertiary mt-1">
          选一个 KR, 一屏看清 议事决议 → 沉淀 Material → 签批 Memory → 1on1/分身 → Initiative → KR 进度 的完整因果链路。
        </p>
      </header>

      <AnchorPicker
        anchors={anchors}
        selectedKr={selectedKr}
        onSelect={setSelectedKr}
      />

      {err && <div className="rounded-2xl bg-danger/10 text-danger px-4 py-3 text-caption mb-4">加载失败: {err}</div>}
      {loading && (
        <div className="text-caption text-ink-tertiary flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> 组装链路中…
        </div>
      )}

      {!loading && chain && (
        <div className="min-w-0 space-y-3">
          {/* stats 概览 */}
          <div className="flex flex-wrap gap-2 text-footnote">
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.decisionCount} 决议</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.materialCount} Material</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.memoryCount} Memory</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.initiativeCount} Initiative</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.checkInCount} Check-in</span>
          </div>

          {/* 算: KR 锚点 */}
          <section className="min-w-0 rounded-2xl bg-surface-1 shadow-soft-sm p-4 border-l-4 border-brand-600">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-1">
              <Target className="w-4 h-4 text-brand-600" /> 算 · 目标与关键成果
            </div>
            {chain.anchor.objectiveTitle && (
              <p className="text-footnote text-ink-tertiary">O: {chain.anchor.objectiveTitle}</p>
            )}
            <p className="mt-0.5 break-words text-headline text-ink-primary">{chain.anchor.krTitle}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full bg-brand-600" style={{ width: pct(chain.anchor.progress) }} />
              </div>
              <span className={`text-caption ${CONFIDENCE_CLASS[chain.anchor.confidence] ?? 'text-ink-secondary'}`}>
                {pct(chain.anchor.progress)} · {chain.anchor.confidence}
              </span>
            </div>
            {chain.checkIns.length > 0 && (
              <div className="mt-3 space-y-1">
                {chain.checkIns.slice(0, 3).map((c) => (
                  <div key={c.id} className="text-footnote text-ink-tertiary flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" />
                    <span className="min-w-0 break-words">
                      {new Date(c.createdAt).toLocaleDateString()} · 进度 {pct(c.progressAfter)}
                      {c.achievements ? ` · ${c.achievements.slice(0, 30)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 执行: Initiatives */}
          <section className="min-w-0 rounded-2xl bg-surface-1 shadow-soft-sm p-4">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-2">
              <Rocket className="w-4 h-4 text-brand-600" /> 执行 · Initiative ({chain.initiatives.length})
            </div>
            {chain.initiatives.length === 0 ? (
              <p className="text-footnote text-ink-tertiary">暂无 Initiative 挂到此 KR。</p>
            ) : (
              <div className="space-y-2">
                {chain.initiatives.map((i) => (
                  <div key={i.id} className="min-w-0 rounded-2xl bg-surface-2 p-2.5">
                    <div className="flex min-w-0 items-center justify-between gap-2 flex-wrap">
                      <span className="min-w-0 break-words text-caption text-ink-primary">{i.title}</span>
                      <span className="text-footnote text-ink-tertiary">{i.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {i.fromActionItem && (
                        <span className="min-w-0 break-words text-footnote text-ink-tertiary flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> 源自 1on1{i.fromActionItem.meetingTitle ? ` · ${i.fromActionItem.meetingTitle}` : ''}
                        </span>
                      )}
                      {i.fromDecisionCardIds.length > 0 && (
                        <span className="min-w-0 break-words text-footnote text-ink-tertiary flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> 关联 {i.fromDecisionCardIds.length} 决议
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 议 + 沉: Decisions → Materials → Memory */}
          <section className="min-w-0 rounded-2xl bg-surface-1 shadow-soft-sm p-4">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-2">
              <ScrollText className="w-4 h-4 text-brand-600" /> 议 → 沉 · 决议 / Material / Memory ({chain.decisions.length})
            </div>
            {chain.decisions.length === 0 ? (
              <p className="text-footnote text-ink-tertiary">暂无关联决议 (此 KR 未被议事决议锚定, 也未被 Initiative 引用)。</p>
            ) : (
              <div className="space-y-3">
                {chain.decisions.map((d) => (
                  <div key={d.id} className="min-w-0 rounded-2xl bg-surface-2 p-3">
                    <div className="flex min-w-0 items-center justify-between gap-2 flex-wrap">
                      <a href={`/decisions/${d.id}`} className="min-w-0 break-words text-caption text-ink-primary hover:underline">{d.title}</a>
                      <span className="text-footnote text-ink-tertiary">
                        {d.state}{d.anchoredDirectly ? ' · 直接锚定' : ' · 经 Initiative'}
                      </span>
                    </div>
                    {(d.materials.length > 0 || d.citedMemory.length > 0) && (
                      <div className="mt-2 pl-3 border-l-2 border-ink-tertiary/15 space-y-1.5">
                        {d.materials.map((m) => (
                          <div key={m.id} className="min-w-0 text-footnote">
                            <span className="text-ink-secondary flex items-center gap-1 break-words">
                              <FileText className="w-3 h-3" /> {m.title} <span className="text-ink-tertiary">({m.type})</span>
                            </span>
                            {m.memory ? (
                              <span className="text-success flex items-center gap-1 pl-4 mt-0.5 break-words">
                                <Stamp className="w-3 h-3" /> 已签批 Memory: {m.memory.title}
                                <span className="text-ink-tertiary">· {OWNERSHIP_LABEL[m.memory.ownershipLevel] ?? m.memory.ownershipLevel} · {m.memory.type}</span>
                              </span>
                            ) : (
                              <span className="text-ink-tertiary pl-4 mt-0.5 block">未晋升为 Memory (仍是素材)</span>
                            )}
                          </div>
                        ))}
                        {d.citedMemory.map((m) => (
                          <div key={m.id} className="text-footnote text-ink-tertiary flex items-center gap-1 break-words">
                            <Stamp className="w-3 h-3" /> 引用 Memory: {m.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
