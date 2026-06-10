'use client';

/**
 * 月度经营回顾 (对标 WorkBoard Business Review)
 *
 * 经营层 (owner/admin/manager/steward) 入口: 一键生成本月 / 上月 / 自定义窗口 pre-read,
 * 内嵌 Markdown 渲染, 顶部按钮支持复制 Markdown / 切换窗口.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReviewSummary {
  activeObjectives: number;
  onTrack: number;
  atRisk: number;
  behind: number;
  overallProgressPct: number;
}

interface Review {
  id: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  cycleTitle?: string;
  summary: ReviewSummary;
  okrHealth: { proposalCount: number; proposals: unknown[] };
  decisions: {
    total: number;
    byOutcome: { adopted: number; overruled: number; modified: number; pending: number };
  };
  suggestedTopics: Array<{ title: string; reason: string; severity: 'high' | 'medium' | 'low' }>;
  markdown: string;
}

const WINDOW_OPTIONS = [
  { label: '近 7 天', days: 7 },
  { label: '近 30 天 (默认)', days: 30 },
  { label: '近 90 天 (季度)', days: 90 },
];

export default function BusinessReviewPage() {
  const [days, setDays] = useState(30);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/business-review/monthly?windowDays=${days}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        return r.json();
      })
      .then((j) => {
        if (active) setReview(j);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [days]);

  async function copyMarkdown() {
    if (!review) return;
    try {
      await navigator.clipboard.writeText(review.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('复制失败, 请手动选中下面文本');
    }
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-4 px-4 py-6 md:px-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-title-3 font-bold">月度经营回顾</h1>
          <p className="text-caption text-muted-foreground">
            中央 AI 参谋自动生成, 全部基于 OKR/决议真值. advisory only — 请人工审视再讨论.
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.days}
              type="button"
              onClick={() => setDays(w.days)}
              className={`rounded-md px-3 py-1.5 text-caption transition ${
                days === w.days
                  ? 'bg-warning text-warning-foreground'
                  : 'border border-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">生成中...</CardContent></Card>
      )}

      {error && (
        <Card><CardContent className="py-8 text-center text-destructive">{error}</CardContent></Card>
      )}

      {review && !loading && (
        <>
          {/* 顶部指标卡 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="进行中目标" value={review.summary.activeObjectives} />
            <Metric label="✓ on-track" value={review.summary.onTrack} tone="success" />
            <Metric label="⚠ at-risk" value={review.summary.atRisk} tone="warning" />
            <Metric label="✗ behind" value={review.summary.behind} tone="danger" />
            <Metric label="加权平均" value={`${review.summary.overallProgressPct}%`} />
          </div>

          {/* 议事概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-caption">议事活动 (近 {days} 天)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-caption">
                <span>共 <strong>{review.decisions.total}</strong></span>
                <span>采纳 {review.decisions.byOutcome.adopted}</span>
                <span>否决 {review.decisions.byOutcome.overruled}</span>
                <span>pending {review.decisions.byOutcome.pending}</span>
              </div>
            </CardContent>
          </Card>

          {/* 建议议题 */}
          {review.suggestedTopics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-caption">本月建议讨论议题</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {review.suggestedTopics.map((t, i) => {
                    const flag = t.severity === 'high' ? '🔴' : t.severity === 'medium' ? '🟡' : '🟢';
                    return (
                      <li key={i} className="border-l-2 border-warning pl-3">
                        <p className="font-medium">{flag} {t.title}</p>
                        <p className="text-caption text-muted-foreground">{t.reason}</p>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Markdown 完整版 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-caption">完整 Markdown 报告</CardTitle>
              <button
                type="button"
                onClick={copyMarkdown}
                className="rounded-md border border-muted px-3 py-1 text-caption hover:bg-muted"
              >
                {copied ? '已复制 ✓' : '复制 Markdown'}
              </button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-caption">
                {review.markdown}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function Metric({
  label, value, tone,
}: { label: string; value: string | number; tone?: 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className={`text-title-3 font-bold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
