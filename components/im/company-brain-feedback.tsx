'use client';

/**
 * §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · CompanyBrain Decision 反馈按钮组
 *
 * 用法: <CompanyBrainFeedbackButtons messageId={msg.id} />
 *   - 只在 senderKind='persona' 且 aiTraceId 以 'imtrace_cb_' 开头的消息悬浮工具栏里渲染
 *   - mount 时调 /api/company-brain/by-message/[messageId] 反查 decisionId
 *   - 3 个按钮 (采纳 / 修改 / 推翻) 点击后 POST /api/company-brain/feedback
 *   - 已反馈状态高亮当前 outcome
 *
 * 灵魂层第 6 条 (闭环互动相互赋能) UI 落地.
 */

import { useEffect, useState } from 'react';
import { ThumbsUp, Pencil, ThumbsDown, Loader2 } from 'lucide-react';

type Outcome = 'pending' | 'adopted' | 'modified' | 'overruled' | 'ignored';

interface DecisionLite {
  id: string;
  context: string;
  outcome: Outcome;
  feedbackBy?: string;
  feedbackAt?: string;
  brainVersion: number;
  createdAt: string;
}

export function CompanyBrainFeedbackButtons({ messageId }: { messageId: string }) {
  const [decision, setDecision] = useState<DecisionLite | null>(null);
  const [loading, setLoading] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // mount 时 lookup decision
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/company-brain/by-message/${messageId}`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError(`lookup ${res.status}`);
          return;
        }
        const json = (await res.json()) as { found: boolean; decision: DecisionLite };
        if (json.found) setDecision(json.decision);
        else setNotFound(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  async function submit(outcome: Exclude<Outcome, 'pending'>) {
    if (!decision || loading) return;
    setLoading(outcome);
    setError(null);
    try {
      const res = await fetch('/api/company-brain/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decisionId: decision.id, outcome }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { decision: { feedback: { outcome: Outcome; feedbackBy?: string; feedbackAt?: string } } };
      // 更新本地 state
      setDecision({
        ...decision,
        outcome: j.decision.feedback.outcome,
        feedbackBy: j.decision.feedback.feedbackBy,
        feedbackAt: j.decision.feedback.feedbackAt,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  // 还没加载 decision (或 404 没记录到) → 不渲染. 避免视觉噪音.
  if (notFound || error || !decision) return null;

  const outcome = decision.outcome;
  const settled = outcome !== 'pending';

  return (
    <div
      className="flex items-center gap-1"
      title={
        settled
          ? `${outcomeLabel(outcome)} · 反馈人 ${decision.feedbackBy ?? '—'}`
          : '对中央 AI 的建议给反馈 → 进入月度反思 (CA-13)'
      }
    >
      <FeedbackBtn
        icon={<ThumbsUp className="h-3 w-3" />}
        label="采纳"
        active={outcome === 'adopted'}
        muted={settled && outcome !== 'adopted'}
        loading={loading === 'adopted'}
        onClick={() => submit('adopted')}
        color="emerald"
      />
      <FeedbackBtn
        icon={<Pencil className="h-3 w-3" />}
        label="修改"
        active={outcome === 'modified'}
        muted={settled && outcome !== 'modified'}
        loading={loading === 'modified'}
        onClick={() => submit('modified')}
        color="amber"
      />
      <FeedbackBtn
        icon={<ThumbsDown className="h-3 w-3" />}
        label="推翻"
        active={outcome === 'overruled'}
        muted={settled && outcome !== 'overruled'}
        loading={loading === 'overruled'}
        onClick={() => submit('overruled')}
        color="rose"
      />
    </div>
  );
}

function outcomeLabel(o: Outcome): string {
  switch (o) {
    case 'adopted':
      return '已采纳';
    case 'modified':
      return '已修改';
    case 'overruled':
      return '已推翻';
    case 'ignored':
      return '已忽略';
    default:
      return '待反馈';
  }
}

interface BtnProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  muted: boolean;
  loading: boolean;
  onClick: () => void;
  color: 'emerald' | 'amber' | 'rose';
}

function FeedbackBtn({ icon, label, active, muted, loading, onClick, color }: BtnProps) {
  const colorClass = active
    ? color === 'emerald'
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-400/80'
      : color === 'amber'
      ? 'bg-warning/10 text-warning ring-warning/50/80'
      : 'bg-rose-100 text-rose-800 ring-rose-400/80'
    : color === 'emerald'
    ? 'text-emerald-700 ring-emerald-300/80 hover:bg-emerald-50'
    : color === 'amber'
    ? 'text-warning ring-warning/30/80 hover:bg-warning/5'
    : 'text-rose-700 ring-rose-300/80 hover:bg-rose-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || muted}
      className={`flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold shadow-soft ring-1 transition hover:shadow-soft-lg disabled:cursor-not-allowed ${
        muted ? 'opacity-30' : ''
      } ${colorClass}`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      {label}
    </button>
  );
}
