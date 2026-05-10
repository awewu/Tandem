'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Search,
  Lightbulb,
  Play,
  BookOpen,
  Bot,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

/**
 * /skills — 员工 Skills 学习 + 调用阵地 (Q3, 2026-05-10)
 *
 * 区别于 /admin/tandem-skills (admin 后台 · 注册/配置/权限):
 *   /skills 是员工面 — 浏览可用 Skills · 学习 · 调用 · 看历史
 *
 * 拿捏模块 §4.3 P3.3 持续训练材料挂接的可视化入口.
 * 员工每学一个 Skill, Persona 也学到 (DecisionHistory ingest).
 */

interface Skill {
  id: string;
  description: string;
  tags: string[];
  zone: 'green' | 'yellow' | 'red';
  proxyAllowed: boolean;
  estimatedTokens: number;
}

type ZoneFilter = 'all' | 'green' | 'yellow' | 'red';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('all');
  const [selected, setSelected] = useState<Skill | null>(null);

  useEffect(() => {
    void loadSkills();
  }, []);

  async function loadSkills() {
    setLoading(true);
    try {
      const r = await fetch('/api/tandem-skills?limit=100');
      const j = await r.json();
      setSkills(j.skills ?? []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [skills, zoneFilter, query]);

  const counts = useMemo(() => {
    const c = { all: skills.length, green: 0, yellow: 0, red: 0 };
    for (const s of skills) c[s.zone]++;
    return c;
  }, [skills]);

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="page-container py-10 space-y-6">
        {/* Header */}
        <header className="animate-fade-in-up">
          <p className="text-caption text-ink-tertiary inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            拿捏 · Skills 学习与调用
          </p>
          <h1 className="mt-1 text-title-2 text-ink-primary">
            标准智能体 Skills 库
          </h1>
          <p className="mt-1 text-body text-ink-secondary">
            员工学习 + 调用阵地 · 每学一个 Skill, 你的 Persona 也学到 ·
            红区禁止 AI 代行 (反 §1 欺诈)
          </p>
        </header>

        {/* Filter bar */}
        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-ink-tertiary" />
            <input
              className="flex-1 bg-transparent text-body outline-none placeholder:text-ink-tertiary"
              placeholder="搜索 (例: 议事 · 知识 · KR · 红线)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-caption">
            <ZoneFilterButton
              active={zoneFilter === 'all'}
              onClick={() => setZoneFilter('all')}
              tone="neutral"
              count={counts.all}
            >
              全部
            </ZoneFilterButton>
            <ZoneFilterButton
              active={zoneFilter === 'green'}
              onClick={() => setZoneFilter('green')}
              tone="green"
              count={counts.green}
            >
              🟢 绿区 (可代行)
            </ZoneFilterButton>
            <ZoneFilterButton
              active={zoneFilter === 'yellow'}
              onClick={() => setZoneFilter('yellow')}
              tone="yellow"
              count={counts.yellow}
            >
              🟡 黄区 (需 consent)
            </ZoneFilterButton>
            <ZoneFilterButton
              active={zoneFilter === 'red'}
              onClick={() => setZoneFilter('red')}
              tone="red"
              count={counts.red}
            >
              🔴 红区 (禁 AI)
            </ZoneFilterButton>
          </div>
        </div>

        {/* Skills grid */}
        {loading ? (
          <div className="card-elevated flex items-center justify-center gap-2 p-12 text-caption text-ink-tertiary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载 Skills...
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <p className="text-body text-ink-secondary">没找到匹配的 Skill</p>
            <p className="mt-1 text-caption text-ink-tertiary">换个关键词或切换分区</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SkillCard key={s.id} skill={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        )}

        {/* M2 来 · Learning hub teaser */}
        <div className="card-elevated p-6 mt-6 border-2 border-dashed border-border opacity-70">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-brand-50 text-brand-600 p-2">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-headline text-ink-primary">学习模式 (M2 上线)</h3>
              <p className="mt-1 text-caption text-ink-secondary">
                每个 Skill 配教程 + 案例 + Q&A · 通关记录 · 错题集 ·
                AI 根据你的 KR/AP 智能推荐 Skill
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer (modal-lite) */}
      {selected && <SkillDetailDrawer skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ──────────── Sub-components ────────────

function ZoneFilterButton({
  active,
  onClick,
  tone,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: 'neutral' | 'green' | 'yellow' | 'red';
  count: number;
  children: React.ReactNode;
}) {
  const toneMap = {
    neutral: active ? 'bg-ink-primary text-white' : 'bg-surface-3 text-ink-secondary',
    green:   active ? 'bg-success text-white'    : 'bg-success/10 text-success',
    yellow:  active ? 'bg-warning text-white'    : 'bg-warning/10 text-warning',
    red:     active ? 'bg-danger text-white'     : 'bg-danger/10 text-danger',
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 font-medium surface-interactive ${toneMap[tone]}`}
    >
      {children} <span className="ml-1 text-footnote opacity-80">{count}</span>
    </button>
  );
}

function SkillCard({ skill, onClick }: { skill: Skill; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block surface-interactive text-left">
      <div className="card-elevated p-5 h-full">
        <div className="flex items-start justify-between mb-2">
          <code className="text-caption font-mono text-ink-secondary bg-surface-3 rounded px-1.5 py-0.5">
            {skill.id}
          </code>
          <ZoneBadge zone={skill.zone} />
        </div>
        <p className="text-body text-ink-primary leading-snug line-clamp-2">{skill.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded bg-surface-3 px-1.5 py-0.5 text-footnote text-ink-secondary"
            >
              #{t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-footnote text-ink-tertiary">
          <span className="inline-flex items-center gap-1">
            <Bot className="h-3 w-3" />
            AI 代行: {skill.proxyAllowed ? '✓' : '✗'}
          </span>
          <span>~{skill.estimatedTokens} tokens</span>
        </div>
      </div>
    </button>
  );
}

function ZoneBadge({ zone }: { zone: Skill['zone'] }) {
  const map = {
    green:  { icon: ShieldCheck, label: '绿区', tone: 'bg-success/10 text-success' },
    yellow: { icon: Shield,      label: '黄区', tone: 'bg-warning/10 text-warning' },
    red:    { icon: ShieldAlert, label: '红区', tone: 'bg-danger/10 text-danger' },
  };
  const m = map[zone];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-footnote font-medium ${m.tone}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function SkillDetailDrawer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  async function runDemo() {
    setRunning(true);
    setOutput(null);
    try {
      const r = await fetch('/api/tandem-skills/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          skillId: skill.id,
          args: {},
          isProxy: false,
          userId: 'demo-user',
        }),
      });
      const j = await r.json();
      setOutput(JSON.stringify(j, null, 2));
    } catch (e) {
      setOutput(`Error: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-ink-primary/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="card-elevated w-full max-w-2xl max-h-[85vh] overflow-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <code className="text-caption font-mono text-ink-secondary">{skill.id}</code>
            <h2 className="mt-1 text-title-3 text-ink-primary">{skill.description}</h2>
          </div>
          <ZoneBadge zone={skill.zone} />
        </div>

        <div>
          <p className="text-footnote font-semibold text-ink-tertiary uppercase tracking-wider mb-1.5">
            标签
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-surface-3 px-2 py-0.5 text-caption text-ink-secondary"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface-2 p-3">
            <p className="text-footnote text-ink-tertiary">AI 代行</p>
            <p className="mt-1 text-body inline-flex items-center gap-1.5">
              {skill.proxyAllowed ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-danger" />
              )}
              {skill.proxyAllowed ? '允许' : '禁止'}
            </p>
          </div>
          <div className="rounded-md bg-surface-2 p-3">
            <p className="text-footnote text-ink-tertiary">预算估计</p>
            <p className="mt-1 text-body">~{skill.estimatedTokens} tokens</p>
          </div>
        </div>

        <div className="rounded-md border-2 border-dashed border-border bg-surface-2/50 p-3">
          <p className="text-caption text-ink-secondary inline-flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-warning" />
            <strong>学习模式 (M2)</strong>: 教程 + 案例 + Q&A 即将上线.
            现在可以试调一次.
          </p>
        </div>

        {output && (
          <div className="space-y-1">
            <p className="text-footnote font-semibold text-ink-tertiary uppercase tracking-wider">
              输出
            </p>
            <pre className="rounded-md bg-ink-primary/95 text-success p-3 text-footnote font-mono overflow-auto max-h-64">
              {output}
            </pre>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-surface-1 px-4 py-2 text-caption text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            关闭
          </button>
          <button
            onClick={runDemo}
            disabled={running || skill.zone === 'red'}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:bg-ink-tertiary disabled:cursor-not-allowed text-white px-4 py-2 text-caption font-semibold shadow-soft-sm surface-interactive"
            title={skill.zone === 'red' ? '红区不可调用' : '试调一次'}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                调用中...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                试调一次
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
