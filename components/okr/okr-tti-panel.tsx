'use client';

/**
 * OKR · TTI + 月度达成 面板
 *
 * 增量补丁 (2026-05-10) — 不修改 /okr 主页, 仅添加 1 个新 tab.
 * 解决用户反馈: "OKR 缺 TTI / Plan vs Actual / 月度达成分析".
 *
 * 数据源:
 *   - TTIs: /api/tandem-okr (服务端 Prisma; ownerId 过滤)
 *   - KRs: 通过 props 接收 (来自 zustand)
 *   - Plan: 按 cycle 时间 linear 计算
 *   - Actual: KR.currentValue (V1 当前值; M2 接 CheckIn 月度快照)
 *   - MoM: V2 上 (V1 不足月度历史)
 */

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { KeyResult } from '@/lib/store';

interface PrismaTti {
  id: string;
  ownerId: string;
  cycleId: string;
  title: string;
  successCriteria: string;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  completionRate: number;
  notes?: string;
}

interface ZustandCycle {
  id: string;
  name: string;
  startDate: number; // ms
  endDate: number;
  isActive: boolean;
}

interface Props {
  ownerId: string;
  cycle?: ZustandCycle;
  keyResults: KeyResult[];
}

export function OKRTtiPanel({ ownerId, cycle, keyResults }: Props) {
  const [ttis, setTtis] = useState<PrismaTti[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/tandem-okr?ownerId=${encodeURIComponent(ownerId)}`);
        const j = await r.json();
        if (cancelled) return;
        setTtis((j.ttis ?? []) as PrismaTti[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [ownerId]);

  return (
    <div className="space-y-4">
      {/* TTI 区 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles size={14} className="text-orange-500" />
            TTI · 成长软轨
          </h3>
          <span className="text-[11px] rounded bg-orange-50 px-2 py-0.5 text-orange-700 font-mono">
            §4 永不挂奖金 · 60-70% = 健康
          </span>
        </div>
        {loading ? (
          <div className="border rounded p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            加载 TTI...
          </div>
        ) : ttis.length === 0 ? (
          <div className="border rounded p-6 text-center text-xs text-muted-foreground">
            该负责人暂无 TTI · 在 Tandem 后端用 POST /api/tti 创建
          </div>
        ) : (
          <div className="space-y-2">
            {ttis.map((tti) => (
              <TtiRow key={tti.id} tti={tti} />
            ))}
          </div>
        )}
      </section>

      {/* KR Plan vs Actual 月度对比 */}
      <section>
        <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
          <Target size={14} className="text-emerald-500" />
          KR · Plan vs Actual (本周期)
        </h3>
        {!cycle ? (
          <div className="border rounded p-4 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <AlertCircle size={12} />
            未选择 cycle, 无法算 plan
          </div>
        ) : keyResults.length === 0 ? (
          <div className="border rounded p-4 text-xs text-muted-foreground">
            该 Objective 下暂无 KR
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">KR</th>
                  <th className="text-right px-3 py-2 font-medium">Plan</th>
                  <th className="text-right px-3 py-2 font-medium">Actual</th>
                  <th className="text-right px-3 py-2 font-medium">偏差%</th>
                  <th className="text-right px-3 py-2 font-medium">时间进度</th>
                </tr>
              </thead>
              <tbody>
                {keyResults.map((kr) => (
                  <KrRow key={kr.id} kr={kr} cycle={cycle} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* M2 月度对比表预告 */}
      <section className="border-2 border-dashed rounded p-4 text-xs">
        <p className="font-medium mb-1 inline-flex items-center gap-1.5">
          <TrendingUp size={12} className="text-blue-500" />
          月度对比 / 同比环比 (M2 上线)
        </p>
        <p className="text-muted-foreground">
          每月 plan / actual / 偏差% / MoM 环比 · 横向月份纵向 KR · 接 CheckIn 历史快照
        </p>
      </section>
    </div>
  );
}

function TtiRow({ tti }: { tti: PrismaTti }) {
  const rate = tti.completionRate;
  const isHealthy = rate >= 0.6 && rate <= 0.8;
  const isOverEasy = rate > 0.9;
  const tone = isHealthy
    ? 'border-emerald-300 bg-emerald-50/50'
    : isOverEasy
    ? 'border-amber-300 bg-amber-50/50'
    : rate >= 0.4
    ? 'border-orange-200 bg-orange-50/30'
    : 'border-red-200 bg-red-50/30';
  const note = isOverEasy
    ? '⚠ 设得过低 (过于轻松)'
    : isHealthy
    ? '✓ 健康'
    : rate >= 0.4
    ? '需要加力'
    : '严重低于目标';

  return (
    <div className={`border rounded p-3 space-y-2 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{tti.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {tti.successCriteria}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold tabular-nums">{Math.round(rate * 100)}%</div>
          <div className="text-[10px] text-muted-foreground">{note}</div>
        </div>
      </div>

      {/* 60-70% green band 进度条 */}
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/15"
          style={{ left: '60%', width: '20%' }}
        />
        <div
          className={`h-full transition-all ${
            isHealthy ? 'bg-emerald-500' : isOverEasy ? 'bg-amber-500' : 'bg-orange-400'
          }`}
          style={{ width: `${Math.min(100, rate * 100)}%` }}
        />
      </div>

      {tti.targetValue !== undefined && tti.currentValue !== undefined && (
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {fmt(tti.currentValue)}{tti.unit ?? ''} / {fmt(tti.targetValue)}{tti.unit ?? ''}
        </div>
      )}
    </div>
  );
}

function KrRow({ kr, cycle }: { kr: KeyResult; cycle: ZustandCycle }) {
  const start = kr.startValue ?? 0;
  const target = kr.targetValue ?? 0;
  const actual = kr.currentValue ?? 0;
  const range = target - start;

  const now = Date.now();
  const timeProgress = Math.max(
    0,
    Math.min(1, (now - cycle.startDate) / Math.max(1, cycle.endDate - cycle.startDate))
  );
  const plan = start + range * timeProgress;
  const variancePct = range !== 0 ? ((actual - plan) / Math.abs(range)) * 100 : 0;

  const ahead = variancePct > 5;
  const behind = variancePct < -5;
  const Icon = ahead ? TrendingUp : behind ? TrendingDown : Minus;
  const color = ahead
    ? 'text-emerald-600'
    : behind
    ? 'text-red-600'
    : 'text-muted-foreground';

  return (
    <tr className="border-t">
      <td className="px-3 py-2 align-top">
        <div className="font-medium truncate max-w-[280px]" title={kr.title}>
          {kr.title}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {fmt(start)} → {fmt(target)}{kr.unit ?? ''}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmt(plan)}{kr.unit ?? ''}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">
        {fmt(actual)}{kr.unit ?? ''}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums ${color}`}>
        <span className="inline-flex items-center gap-0.5 justify-end">
          <Icon size={11} />
          {variancePct >= 0 ? '+' : ''}
          {variancePct.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {Math.round(timeProgress * 100)}%
      </td>
    </tr>
  );
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (Math.abs(n) >= 10000) return n.toFixed(0);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(2);
}
