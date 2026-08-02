/**
 * PMS · 经销商价值门户 (§3.21)
 * 面向经销商的自服务价值视图: 撞单申诉进度 · 健康分自查 · 返利可视。
 * 数据经 /api/pms/dealer-value 按本人/本 org 严格隔离。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gavel, HeartPulse, Coins, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface AppealProgress {
  step: number;
  total: number;
  label: string;
  done: boolean;
  outcome?: 'approved' | 'rejected';
}
interface DealerValue {
  orgId: string | null;
  appeals: {
    total: number;
    active: number;
    items: Array<{
      id: string;
      duplicateCheckId: string;
      reason: string;
      status: string;
      progress: AppealProgress;
      arbitrationReason?: string;
      createdAt: string;
      arbitratedAt?: string;
    }>;
  };
  health: {
    latest: { period: string; totalScore: number; rank: string; dimensions: Record<string, number> } | null;
    deltaFromPrev: number | null;
    weakest: { key: string; score: number } | null;
    history: Array<{ period: string; totalScore: number; rank: string }>;
  };
  rebates: {
    pendingAmount: number;
    settledAmount: number;
    accrualCount: number;
    activePolicies: number;
    items: Array<{ id: string; policyId: string; period: string; salesAmount: number; rebateAmount: number; status: string; settledAt?: string }>;
  };
}

const DIM_LABELS: Record<string, string> = { compliance: '合规', performance: '业绩', service: '服务', cooperation: '协作' };
const RANK_STYLE: Record<string, string> = {
  A: 'bg-success/10 text-success border-success/30',
  B: 'bg-info/10 text-info border-info/30',
  C: 'bg-warning/10 text-warning border-warning/30',
  D: 'bg-danger/10 text-danger border-danger/30',
};

function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PmsMyValuePage() {
  const [data, setData] = useState<DealerValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/pms/dealer-value', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error((await res.json()).error || '加载失败');
        const j = await res.json();
        setData(j.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto md:max-w-4xl p-6 flex items-center justify-center text-muted-foreground text-caption py-20">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载我的价值面板…
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto md:max-w-4xl p-6">
        <Card className="border-danger/30 bg-danger/5"><CardContent className="py-3 text-caption text-danger">{error}</CardContent></Card>
      </div>
    );
  }
  if (!data) return null;

  const h = data.health.latest;

  return (
    <div className="container mx-auto md:max-w-4xl p-6 space-y-4 max-w-4xl">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight">我的价值</h1>
        <p className="text-caption text-muted-foreground mt-1">
          撞单申诉进度 · 健康分自查 · 返利可视 —— 你的经营透明度看板
        </p>
      </header>

      {/* 撞单申诉进度 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Gavel className="h-4 w-4 text-primary" /> 撞单申诉进度</span>
            <span className="text-[10px] text-muted-foreground">进行中 {data.appeals.active} / 共 {data.appeals.total}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.appeals.items.length === 0 ? (
            <p className="text-center text-muted-foreground text-[11px] py-4">暂无申诉记录</p>
          ) : (
            data.appeals.items.map((a) => (
              <div key={a.id} className="rounded-md border border-border/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ink-primary truncate max-w-[60%]" title={a.reason}>{a.reason}</span>
                  <Badge
                    variant="outline"
                    className={
                      'text-[9px] scale-90 flex items-center gap-0.5 ' +
                      (a.progress.outcome === 'approved'
                        ? 'bg-success/10 text-success border-success/30'
                        : a.progress.outcome === 'rejected'
                        ? 'bg-danger/10 text-danger border-danger/30'
                        : 'bg-warning/10 text-warning border-warning/30')
                    }
                  >
                    {a.progress.done
                      ? (a.progress.outcome === 'approved' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />)
                      : <Clock className="h-2.5 w-2.5" />}
                    {a.progress.label}
                  </Badge>
                </div>
                {/* 进度条 step/total */}
                <div className="flex gap-1">
                  {Array.from({ length: a.progress.total }).map((_, i) => (
                    <div
                      key={i}
                      className={
                        'h-1 flex-1 rounded-full ' +
                        (i < a.progress.step
                          ? a.progress.outcome === 'rejected' ? 'bg-danger/60' : 'bg-primary/60'
                          : 'bg-surface-2')
                      }
                    />
                  ))}
                </div>
                {a.arbitrationReason && (
                  <p className="text-[10px] text-muted-foreground">仲裁说明: {a.arbitrationReason}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 健康分自查 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center gap-1.5"><HeartPulse className="h-4 w-4 text-primary" /> 健康分自查</CardTitle>
        </CardHeader>
        <CardContent>
          {!h ? (
            <p className="text-center text-muted-foreground text-[11px] py-4">暂无健康分记录</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-title-1 font-bold tabular-nums text-primary">{h.totalScore}</span>
                <Badge variant="outline" className={'text-[10px] ' + (RANK_STYLE[h.rank] ?? '')}>等级 {h.rank}</Badge>
                <span className="text-[10px] text-muted-foreground">{h.period}</span>
                {data.health.deltaFromPrev != null && data.health.deltaFromPrev !== 0 && (
                  <span className={'text-[10px] tabular-nums ' + (data.health.deltaFromPrev > 0 ? 'text-success' : 'text-danger')}>
                    环比 {data.health.deltaFromPrev > 0 ? '+' : ''}{data.health.deltaFromPrev}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(h.dimensions).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-md bg-surface-1 px-2 py-1">
                    <span className="text-[10px] text-muted-foreground">{DIM_LABELS[k] ?? k}</span>
                    <span className="text-[11px] tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              {data.health.weakest && (
                <p className="text-[10px] text-warning">
                  短板提示: 「{DIM_LABELS[data.health.weakest.key] ?? data.health.weakest.key}」得分 {data.health.weakest.score}，建议优先改善。
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 返利可视 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Coins className="h-4 w-4 text-primary" /> 返利可视</span>
            <span className="text-[10px] text-muted-foreground">在册政策 {data.rebates.activePolicies}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-warning/5 border border-warning/20 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">待结算返利</div>
              <div className="text-headline font-bold tabular-nums text-warning">¥{fmtMoney(data.rebates.pendingAmount)}</div>
            </div>
            <div className="rounded-md bg-success/5 border border-success/20 px-3 py-2">
              <div className="text-[10px] text-muted-foreground">已结算返利</div>
              <div className="text-headline font-bold tabular-nums text-success">¥{fmtMoney(data.rebates.settledAmount)}</div>
            </div>
          </div>
          {data.rebates.items.length === 0 ? (
            <p className="text-center text-muted-foreground text-[11px] py-2">暂无返利计提</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1">周期</th>
                  <th className="text-right font-medium py-1">销售额</th>
                  <th className="text-right font-medium py-1">返利</th>
                  <th className="text-center font-medium py-1">状态</th>
                </tr>
              </thead>
              <tbody>
                {data.rebates.items.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1 tabular-nums">{r.period}</td>
                    <td className="text-right py-1 tabular-nums">¥{fmtMoney(r.salesAmount)}</td>
                    <td className="text-right py-1 tabular-nums text-primary">¥{fmtMoney(r.rebateAmount)}</td>
                    <td className="text-center py-1">
                      <Badge variant="outline" className={'text-[9px] scale-90 ' + (r.status === 'settled' ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30')}>
                        {r.status === 'settled' ? '已结算' : '待结算'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
