'use client';

/**
 * /admin/comp/peer-assignments — HR 他评评议人指派台
 *
 * 半自选(员工提名2人) + 半指派(上级/HR指派2人) = 4人评议组。
 * 评议人提交评分 → 去极值聚合。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Send } from 'lucide-react';

interface PeerScoreResult {
  peerScore: number;
  effectiveCount: number;
  droppedHigh: number | null;
  droppedLow: number | null;
  rawScores: number[];
}

export default function PeerAssignmentsPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [cycle, setCycle] = useState('2026-Q3');
  const [scoreInput, setScoreInput] = useState('');
  const [scoreResult, setScoreResult] = useState<PeerScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadScore = useCallback(async () => {
    if (!employeeId || !cycle) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/comp/me/peer-scores?employeeId=${encodeURIComponent(employeeId)}&cycle=${encodeURIComponent(cycle)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setScoreResult(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [employeeId, cycle]);

  useEffect(() => {
    if (employeeId && cycle) void loadScore();
  }, [loadScore]);

  async function submitScore(score: string) {
    if (!employeeId || !cycle || !score) return;
    setSubmitting(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch('/api/comp/me/peer-scores', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          cycle,
          score: Number(score),
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setMsg('评分已提交');
      await loadScore();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          他评管理
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          4 位评议人各 10% (Sigma=40%) · 半自选半指派 · 去极值聚合 (去掉最高最低)
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          公平性设计: 去极值防人情分 (最高最低丢弃) · 半自选半指派防圈子互捧 · 4人足够分散又不至于噪音过大
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
      {msg && <Card className="border-success/30 bg-success/5"><CardContent className="py-2 text-caption text-success">{msg}</CardContent></Card>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">查询条件</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              被评员工 ID
              <Input
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="admin@tandem.local"
                className="h-8 w-48 text-[12px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              周期
              <Input
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                placeholder="2026-Q3"
                className="h-8 w-28 text-[12px]"
              />
            </label>
            <Button size="sm" className="h-8 text-[12px]" onClick={loadScore} disabled={loading || !employeeId}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '查询'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {scoreResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption">他评聚合结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{(scoreResult.peerScore * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">去极值均值</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{scoreResult.effectiveCount}</div>
                <div className="text-[10px] text-muted-foreground">有效评议人数</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums text-danger">
                  {scoreResult.droppedHigh != null ? (scoreResult.droppedHigh * 100).toFixed(0) + '%' : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">去掉最高</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums text-info">
                  {scoreResult.droppedLow != null ? (scoreResult.droppedLow * 100).toFixed(0) + '%' : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">去掉最低</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scoreResult.rawScores.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px] tabular-nums">
                  评议人{i + 1}: {(s * 100).toFixed(0)}%
                </Badge>
              ))}
              {scoreResult.rawScores.length === 0 && (
                <span className="text-caption text-muted-foreground">暂无评分记录</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">提交评分 (作为评议人)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              评分 (0~1)
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="0.80"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                className="h-8 w-24 text-[12px] tabular-nums"
              />
            </label>
            <Button
              size="sm"
              className="h-8 text-[12px] gap-1"
              disabled={submitting || !employeeId || !cycle || !scoreInput}
              onClick={() => void submitScore(scoreInput)}
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              提交评分
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
