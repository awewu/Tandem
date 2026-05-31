'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MentionTextarea } from '@/components/documents/mention-picker';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  History,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { DecisionCard, DecisionOption } from '@/lib/types';

const HARD_LIMIT_SECONDS = 17 * 60;

// 宪章 §3 五步字面对齐: ALIGN → FRAME → DIVERGE → CONVERGE → COMMIT
const STEP_LABEL: Record<string, string> = {
  ALIGN: '1/5 · 校准 (锡定 KR + 同步信息)',
  FRAME: '2/5 · 界定 (问题陈述 + 决策类型)',
  DIVERGE: '3/5 · 发散 (3+1 选项 + 审议)',
  CONVERGE: '4/5 · 收敛 (选定 + 行动项)',
  COMMIT: '5/5 · 落地 (决议生效 + 24h 否决窗口)',
  ESCALATED: '⚠️ 已升级到决策人',
  VETOED: '❌ 被否决',
};

const OPTION_META: Record<
  string,
  { icon: typeof Sparkles; color: string; label: string }
> = {
  A: { icon: BookOpen, color: 'text-blue-600', label: 'A · SOP 直执行' },
  B: { icon: Sparkles, color: 'text-purple-600', label: 'B · AI 推演' },
  C: { icon: History, color: 'text-warning', label: 'C · 历史案例' },
  D: { icon: Lightbulb, color: 'text-emerald-600', label: 'D · 你的原创' },
};

interface RoomData {
  card: DecisionCard;
  room: { step: string; elapsedSeconds: number; escalated: boolean } | null;
}

export function ConvergenceRoom({ cardId, currentUserId }: { cardId: string; currentUserId: string }) {
  const [data, setData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [novelInsight, setNovelInsight] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/convergence/${cardId}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = (await res.json()) as RoomData;
      setData(json);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 5000);
    return () => clearInterval(t);
  }, [fetchData]);

  const sendEvent = useCallback(
    async (event: Record<string, unknown>) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/convergence/${cardId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err?.error ?? 'event failed');
        }
        await fetchData();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [cardId, fetchData]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载议事室…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-6 text-danger">
        <AlertTriangle className="mb-2 h-5 w-5" />
        加载失败: {error ?? '未知错误'}
      </div>
    );
  }

  const { card, room } = data;
  const elapsed = room?.elapsedSeconds ?? card.elapsedSeconds;
  const progressPct = Math.min(100, (elapsed / HARD_LIMIT_SECONDS) * 100);
  const remaining = Math.max(0, HARD_LIMIT_SECONDS - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const step = room?.step ?? convergenceStateToStep(card.convergenceState);
  const isCommitted = step === 'COMMIT' || card.convergenceState === 'COMMIT';
  const isEscalated = step === 'ESCALATED' || card.convergenceState === 'ESCALATED';
  const isVetoed = step === 'VETOED' || card.convergenceState === 'VETOED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-headline">{card.title}</CardTitle>
              <div className="mt-1 text-caption text-muted-foreground">
                {STEP_LABEL[step] ?? step}
              </div>
            </div>
            <TimerBadge minutes={minutes} seconds={seconds} elapsed={elapsed} />
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPct} className={progressPct > 80 ? 'bg-danger/10' : ''} />
          <div className="mt-2 flex justify-between text-footnote text-muted-foreground">
            <span>已用 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
            <span>硬上限 17:00</span>
          </div>
        </CardContent>
      </Card>

      {/* Status banners */}
      {isEscalated && (
        <BannerCard tone="warn" icon={AlertTriangle} title="议事室已升级">
          可能原因: 17 分钟硬上限或 5 分钟卡顿. 已通知主管或转入异步决议.
        </BannerCard>
      )}
      {isVetoed && (
        <BannerCard tone="error" icon={XCircle} title="决议已被员工否决">
          24 小时窗口内行使了否决权 (MANIFESTO 第十条).
        </BannerCard>
      )}
      {isCommitted && card.vetoWindowEnds && (
        <BannerCard tone="success" icon={CheckCircle2} title={`决议已生效 (24h 否决窗口至 ${formatTime(card.vetoWindowEnds)})`}>
          员工本人可在窗口内行使否决权.
        </BannerCard>
      )}

      {/* Options */}
      {card.options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-body">3+1 决策选项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {card.options.map((opt) => (
              <OptionRow
                key={opt.id}
                option={opt}
                selected={card.selected === opt.id}
                disabled={actionLoading || isCommitted || isEscalated || isVetoed}
                onPick={() =>
                  sendEvent({
                    type: 'PICK_OPTION',
                    userId: currentUserId,
                    option: opt.id,
                  })
                }
                novelInsight={novelInsight}
                onNovelInsightChange={setNovelInsight}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {!isCommitted && !isEscalated && !isVetoed && card.selected && (
        <div className="flex justify-end gap-2">
          <Button
            disabled={actionLoading}
            onClick={() => sendEvent({ type: 'COMMIT', userId: currentUserId })}
          >
            提交决议 (生效)
          </Button>
        </div>
      )}

      {isCommitted && !isVetoed && card.vetoWindowEnds && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={actionLoading}
            onClick={() =>
              sendEvent({
                type: 'VETO',
                userId: currentUserId,
                reason: '员工撤回',
              })
            }
          >
            行使 24h 否决权
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimerBadge({ minutes, seconds, elapsed }: { minutes: number; seconds: number; elapsed: number }) {
  const danger = elapsed >= HARD_LIMIT_SECONDS - 60;
  const warn = elapsed >= HARD_LIMIT_SECONDS / 2;
  return (
    <div
      className={`flex items-center gap-1 rounded-full px-3 py-1 text-caption font-mono ${
        danger
          ? 'bg-danger/10 text-danger'
          : warn
          ? 'bg-warning/10 text-warning'
          : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      <Clock className="h-4 w-4" />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}

function OptionRow({
  option,
  selected,
  disabled,
  onPick,
  novelInsight,
  onNovelInsightChange,
}: {
  option: DecisionOption;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
  novelInsight: string;
  onNovelInsightChange: (v: string) => void;
}) {
  const meta = OPTION_META[option.id];
  const Icon = meta.icon;
  const isD = option.id === 'D';
  const dEmpty = isD && !novelInsight.trim();

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        selected ? 'border-blue-500 bg-blue-50/50 shadow-soft-sm' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${meta.color}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{meta.label}</h4>
            <ConfidencePill confidence={option.confidence} risk={option.risk} />
          </div>
          {!isD && (
            <p className="mt-1 text-caption text-muted-foreground whitespace-pre-wrap">
              {option.description}
            </p>
          )}
          {isD && (
            <MentionTextarea
              value={novelInsight}
              onChange={onNovelInsightChange}
              disabled={disabled}
              rows={3}
              placeholder="请填写原创方案 (此选项必须人填, AI 不可代写) · 输入 @ 可引用文档"
              className="mt-2 w-full rounded border p-2 text-caption"
            />
          )}
          {option.reasoning && !isD && (
            <details className="mt-2 text-footnote text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">查看推理依据</summary>
              <p className="mt-1 whitespace-pre-wrap">{option.reasoning}</p>
            </details>
          )}
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant={selected ? 'default' : 'outline'}
              disabled={disabled || dEmpty}
              onClick={onPick}
            >
              {selected ? '✓ 已选' : '选定此方案'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidencePill({ confidence, risk }: { confidence: number; risk: string }) {
  const pct = Math.round(confidence * 100);
  const riskColor =
    risk === 'low'
      ? 'bg-emerald-100 text-emerald-700'
      : risk === 'medium'
      ? 'bg-warning/10 text-warning'
      : 'bg-danger/10 text-danger';
  return (
    <div className="flex gap-1 text-footnote">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
        信心 {pct}%
      </span>
      <span className={`rounded-full px-2 py-0.5 ${riskColor}`}>风险 {risk}</span>
    </div>
  );
}

function BannerCard({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'success' | 'warn' | 'error';
  icon: typeof CheckCircle2;
  title: string;
  children: React.ReactNode;
}) {
  const colorMap = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warn: 'border-warning/20 bg-warning/5 text-warning',
    error: 'border-danger/20 bg-danger/5 text-danger',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[tone]}`}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-1 text-caption">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convergenceStateToStep(s: string): string {
  // 外部 ConvergenceState → 内部 Step (默认选区间内较后的那个 step)
  const map: Record<string, string> = {
    DIVERGE: 'DIVERGE',
    CONVERGE: 'CONVERGE',
    COMMIT: 'COMMIT',
    ESCALATED: 'ESCALATED',
    VETOED: 'VETOED',
  };
  return map[s] ?? s;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

