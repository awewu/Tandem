'use client';

/**
 * /story-chain · 端到端故事链 provenance (Phase 4 · 点亮 · 2026-07-20)
 *
 * 选一个 KR, 一屏看清 议事决议 → 沉淀Material → 签批Memory → 分身/1on1 → Initiative → KR进度
 * 的完整因果链路。只读, 纯展示 Tandem 的核心叙事闭环 (讲清卖点)。
 *
 * CHARTER-UI-V1 合规: surface/ink tokens · text-{title/headline/body/caption/footnote} · semantic 色 · rounded-2xl · shadow-soft-*。
 */

import { useEffect, useState } from 'react';
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
    if (!selectedKr) return;
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <header className="mb-4">
        <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-600" />
          故事链 · 端到端 provenance
        </h1>
        <p className="text-footnote text-ink-tertiary mt-1">
          选一个 KR, 一屏看清 议事决议 → 沉淀 Material → 签批 Memory → 1on1/分身 → Initiative → KR 进度 的完整因果链路。
        </p>
      </header>

      <select
        value={selectedKr}
        onChange={(e) => setSelectedKr(e.target.value)}
        className="w-full rounded-2xl bg-surface-1 shadow-soft-sm px-3 py-2 text-body text-ink-primary mb-4"
      >
        <option value="">— 选择一个 KR 作为链路锚点 —</option>
        {anchors.map((a) => (
          <option key={a.krId} value={a.krId}>
            {a.krTitle} {a.objectiveTitle ? `· ${a.objectiveTitle}` : ''} ({pct(a.progress)})
          </option>
        ))}
      </select>

      {err && <div className="rounded-2xl bg-danger/10 text-danger px-4 py-3 text-caption mb-4">加载失败: {err}</div>}
      {loading && (
        <div className="text-caption text-ink-tertiary flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> 组装链路中…
        </div>
      )}

      {!loading && chain && (
        <div className="space-y-3">
          {/* stats 概览 */}
          <div className="flex flex-wrap gap-2 text-footnote">
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.decisionCount} 决议</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.materialCount} Material</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.memoryCount} Memory</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.initiativeCount} Initiative</span>
            <span className="rounded-2xl bg-surface-2 px-2.5 py-1 text-ink-secondary">{chain.stats.checkInCount} Check-in</span>
          </div>

          {/* 算: KR 锚点 */}
          <section className="rounded-2xl bg-surface-1 shadow-soft-sm p-4 border-l-4 border-brand-600">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-1">
              <Target className="w-4 h-4 text-brand-600" /> 算 · 目标与关键成果
            </div>
            {chain.anchor.objectiveTitle && (
              <p className="text-footnote text-ink-tertiary">O: {chain.anchor.objectiveTitle}</p>
            )}
            <p className="text-headline text-ink-primary mt-0.5">{chain.anchor.krTitle}</p>
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
                    {new Date(c.createdAt).toLocaleDateString()} · 进度 {pct(c.progressAfter)}
                    {c.achievements ? ` · ${c.achievements.slice(0, 30)}` : ''}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 执行: Initiatives */}
          <section className="rounded-2xl bg-surface-1 shadow-soft-sm p-4">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-2">
              <Rocket className="w-4 h-4 text-brand-600" /> 执行 · Initiative ({chain.initiatives.length})
            </div>
            {chain.initiatives.length === 0 ? (
              <p className="text-footnote text-ink-tertiary">暂无 Initiative 挂到此 KR。</p>
            ) : (
              <div className="space-y-2">
                {chain.initiatives.map((i) => (
                  <div key={i.id} className="rounded-2xl bg-surface-2 p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-caption text-ink-primary">{i.title}</span>
                      <span className="text-footnote text-ink-tertiary">{i.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {i.fromActionItem && (
                        <span className="text-footnote text-ink-tertiary flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> 源自 1on1{i.fromActionItem.meetingTitle ? ` · ${i.fromActionItem.meetingTitle}` : ''}
                        </span>
                      )}
                      {i.fromDecisionCardIds.length > 0 && (
                        <span className="text-footnote text-ink-tertiary flex items-center gap-1">
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
          <section className="rounded-2xl bg-surface-1 shadow-soft-sm p-4">
            <div className="flex items-center gap-2 text-caption text-ink-tertiary mb-2">
              <ScrollText className="w-4 h-4 text-brand-600" /> 议 → 沉 · 决议 / Material / Memory ({chain.decisions.length})
            </div>
            {chain.decisions.length === 0 ? (
              <p className="text-footnote text-ink-tertiary">暂无关联决议 (此 KR 未被议事决议锚定, 也未被 Initiative 引用)。</p>
            ) : (
              <div className="space-y-3">
                {chain.decisions.map((d) => (
                  <div key={d.id} className="rounded-2xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <a href={`/decisions/${d.id}`} className="text-caption text-ink-primary hover:underline">{d.title}</a>
                      <span className="text-footnote text-ink-tertiary">
                        {d.state}{d.anchoredDirectly ? ' · 直接锚定' : ' · 经 Initiative'}
                      </span>
                    </div>
                    {(d.materials.length > 0 || d.citedMemory.length > 0) && (
                      <div className="mt-2 pl-3 border-l-2 border-ink-tertiary/15 space-y-1.5">
                        {d.materials.map((m) => (
                          <div key={m.id} className="text-footnote">
                            <span className="text-ink-secondary flex items-center gap-1">
                              <FileText className="w-3 h-3" /> {m.title} <span className="text-ink-tertiary">({m.type})</span>
                            </span>
                            {m.memory ? (
                              <span className="text-success flex items-center gap-1 pl-4 mt-0.5">
                                <Stamp className="w-3 h-3" /> 已签批 Memory: {m.memory.title}
                                <span className="text-ink-tertiary">· {OWNERSHIP_LABEL[m.memory.ownershipLevel] ?? m.memory.ownershipLevel} · {m.memory.type}</span>
                              </span>
                            ) : (
                              <span className="text-ink-tertiary pl-4 mt-0.5 block">未晋升为 Memory (仍是素材)</span>
                            )}
                          </div>
                        ))}
                        {d.citedMemory.map((m) => (
                          <div key={m.id} className="text-footnote text-ink-tertiary flex items-center gap-1">
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
