'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Sparkles,
  ArrowRight,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  KR_BINDING_REASON_MIN_LENGTH,
  validateOkrAnchor,
  type DecisionCard,
} from '@/lib/types/decision-card';

interface KeyResult {
  id: string;
  title: string;
  ownerId: string;
  riskStatus: 'on_track' | 'at_risk' | 'off_track';
}

interface ObjectiveWithKrs {
  id: string;
  title: string;
  level: string;
  keyResults: KeyResult[];
}

/**
 * /convergence — 议事室列表 + 发起新议事
 * Q2 KR 软绑定: 默认必选, escape hatch 需填理由 (≥10 字符)
 */
export default function ConvergencePage() {
  const router = useRouter();

  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveWithKrs[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [krMode, setKrMode] = useState<'select' | 'escape'>('select');
  const [primaryKrId, setPrimaryKrId] = useState('');
  const [noKrReason, setNoKrReason] = useState('');

  useEffect(() => {
    void Promise.all([refreshList(), loadOkrTree()]);
  }, []);

  async function refreshList() {
    setLoading(true);
    try {
      const r = await fetch('/api/convergence');
      const j = await r.json();
      setCards(j.cards ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function loadOkrTree() {
    try {
      const r = await fetch('/api/tandem-okr');
      const j = await r.json();
      setObjectives(j.objectives ?? []);
    } catch {
      /* ignore */
    }
  }

  // Form validation: same rule as server, mirror for instant UX
  const krValidation = validateOkrAnchor({
    primaryKrId: krMode === 'select' ? primaryKrId : null,
    noKrReason: krMode === 'escape' ? noKrReason : null,
  });

  const formValid = title.trim().length > 0 && krValidation.ok;

  async function createRoom() {
    if (!formValid) return;
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        ownerId: 'demo-user',
      };
      if (krMode === 'select') body.primaryKrId = primaryKrId;
      else body.noKrReason = noKrReason;

      const res = await fetch('/api/convergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push(`/convergence/${json.cardId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="page-container py-10 space-y-8">
        {/* Header */}
        <header className="animate-fade-in-up">
          <p className="text-caption text-ink-tertiary inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            议事室
          </p>
          <h1 className="mt-1 text-title-2 text-ink-primary">17 分钟达成共识</h1>
          <p className="mt-1 text-body text-ink-secondary">
            3+1 框架: A SOP · B AI 推演 · C 历史案例 · D 你的原创 (必填)
          </p>
        </header>

        {/* Create form */}
        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-headline text-ink-primary">发起新议事</h2>

          <div className="space-y-1.5">
            <label className="text-caption text-ink-secondary">议题标题</label>
            <input
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-fast"
              placeholder="例: 客户投诉应对方案 · 是否提前 V1 GA 6 周"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-caption text-ink-secondary">背景说明 (可选, 帮 AI 检索 SOP/案例)</label>
            <textarea
              className="w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2 text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-fast"
              rows={3}
              placeholder="说说背景, 让 AI 找到相关 SOP / 历史案例..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
            />
          </div>

          {/* KR binding (Q2) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-caption text-ink-secondary inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                关联 KR
                <span className="text-footnote text-ink-tertiary">(Q2 软绑定)</span>
              </label>
              <div className="flex items-center gap-1 rounded-md bg-surface-3 p-0.5 text-footnote">
                <button
                  type="button"
                  onClick={() => setKrMode('select')}
                  disabled={creating}
                  className={
                    krMode === 'select'
                      ? 'rounded-sm bg-surface-1 px-2.5 py-1 font-medium text-ink-primary shadow-soft-xs'
                      : 'px-2.5 py-1 text-ink-secondary hover:text-ink-primary surface-interactive'
                  }
                >
                  挂 KR (推荐)
                </button>
                <button
                  type="button"
                  onClick={() => setKrMode('escape')}
                  disabled={creating}
                  className={
                    krMode === 'escape'
                      ? 'rounded-sm bg-surface-1 px-2.5 py-1 font-medium text-ink-primary shadow-soft-xs'
                      : 'px-2.5 py-1 text-ink-secondary hover:text-ink-primary surface-interactive'
                  }
                >
                  无关 KR (填理由)
                </button>
              </div>
            </div>

            {krMode === 'select' ? (
              objectives.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-caption text-ink-tertiary">
                  暂无 KR 可选 · 先去 <Link href="/okr" className="text-brand-600 underline">/okr</Link> 创建, 或切到「无关 KR」
                </p>
              ) : (
                <select
                  aria-label="选择关联的 Key Result"
                  className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  value={primaryKrId}
                  onChange={(e) => setPrimaryKrId(e.target.value)}
                  disabled={creating}
                >
                  <option value="">— 选择 KR —</option>
                  {objectives.map((obj) => (
                    <optgroup key={obj.id} label={`${obj.level === 'company' ? '🏢' : obj.level === 'team' ? '👥' : '👤'}  ${obj.title}`}>
                      {obj.keyResults.map((kr) => (
                        <option key={kr.id} value={kr.id}>
                          {kr.riskStatus === 'on_track' ? '🟢' : kr.riskStatus === 'at_risk' ? '🟡' : '🔴'} {kr.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )
            ) : (
              <>
                <textarea
                  className="w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2 text-body outline-none focus:border-warning focus:ring-2 focus:ring-warning/20 transition-colors duration-fast"
                  rows={2}
                  placeholder={`不挂 KR 的理由 (≥ ${KR_BINDING_REASON_MIN_LENGTH} 字符)... 反"占位理由"`}
                  value={noKrReason}
                  onChange={(e) => setNoKrReason(e.target.value)}
                  disabled={creating}
                />
                <p className="flex items-center gap-2 text-footnote text-ink-tertiary">
                  <AlertCircle className="h-3 w-3 text-warning" />
                  逃生通道理由会写入审计 · 老板/Steward 可定期复盘
                  <span className="ml-auto tabular-nums">{noKrReason.trim().length} / ≥{KR_BINDING_REASON_MIN_LENGTH}</span>
                </p>
              </>
            )}

            {!krValidation.ok && (krMode === 'select' ? primaryKrId : noKrReason).length > 0 && (
              <p className="text-footnote text-danger">{krValidation.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-caption text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={createRoom}
              disabled={creating || !formValid}
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 disabled:bg-ink-tertiary disabled:cursor-not-allowed text-white px-4 py-2 text-caption font-semibold shadow-soft-sm surface-interactive transition-colors duration-fast"
            >
              {creating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI 生成 3+1 选项中...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  发起议事 (17 min)
                </>
              )}
            </button>
          </div>
        </section>

        {/* List */}
        <section className="space-y-3">
          <h2 className="text-headline text-ink-primary">最近议事</h2>
          <div className="card-elevated overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-caption text-ink-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中...
              </div>
            ) : cards.length === 0 ? (
              <div className="p-12 text-center text-caption text-ink-tertiary">
                还没有议事记录, 上方发起一个吧
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cards.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/convergence/${c.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors duration-fast"
                    >
                      <DecisionStateIcon state={c.convergenceState} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body text-ink-primary">{c.title}</p>
                        <p className="mt-0.5 inline-flex items-center gap-2 text-footnote text-ink-tertiary">
                          {c.primaryKrId ? (
                            <span className="inline-flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              KR 关联
                            </span>
                          ) : c.noKrReason ? (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertCircle className="h-3 w-3" />
                              逃生通道
                            </span>
                          ) : (
                            <span className="text-ink-tertiary">未绑 KR (legacy)</span>
                          )}
                          <span>·</span>
                          <span>{formatDate(c.createdAt)}</span>
                          {c.elapsedSeconds > 0 && (
                            <>
                              <span>·</span>
                              <span>用时 {Math.floor(c.elapsedSeconds / 60)}:{(c.elapsedSeconds % 60).toString().padStart(2,'0')}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-ink-tertiary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DecisionStateIcon({ state }: { state: string }) {
  const map: Record<string, { icon: React.ReactNode; tone: string }> = {
    COMMIT:       { icon: <CheckCircle2 className="h-4 w-4" />, tone: 'text-success bg-success/10' },
    ESCALATED:    { icon: <AlertCircle className="h-4 w-4" />,  tone: 'text-warning bg-warning/10' },
    VETOED:       { icon: <XCircle className="h-4 w-4" />,      tone: 'text-danger bg-danger/10' },
    DELIBERATION: { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    CONVERGE:     { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    DIVERGE:      { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
  };
  const m = map[state] ?? { icon: <Clock className="h-4 w-4" />, tone: 'text-ink-tertiary bg-surface-3' };
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.tone}`}>
      {m.icon}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
