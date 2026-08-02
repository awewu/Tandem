'use client';

/**
 * /admin/comp/reviews — 述职/九宫格评审管理
 *
 * 提交述职评审 (潜力×绩效 → 九宫格 → outcome 自动映射)。
 * 查询历史评审记录, 按员工/周期筛选。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Grid3x3, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewRow {
  id: string;
  employeeId: string;
  cycle: string;
  reviewType: string;
  okrPotentialScore: string | null;
  kpiPerformanceScore: string | null;
  nineBoxRow: number | null;
  nineBoxCol: number | null;
  selfScore: string | null;
  peerScore: string | null;
  managerScore: string | null;
  outcome: string | null;
}

const OUTCOME_CLS: Record<string, string> = {
  promote: 'bg-success/10 text-success border-success/30',
  hold: 'bg-info/10 text-info border-info/30',
  watch: 'bg-warning/10 text-warning border-warning/30',
  pip: 'bg-warning/10 text-warning border-warning/30',
  demote: 'bg-danger/10 text-danger border-danger/30',
};

const REVIEW_TYPE_LABEL: Record<string, string> = {
  quarterly_checkin: '季度述职',
  half_year: '半年评',
  annual: '年度评',
};

const NINE_BOX_LABELS: Record<string, string> = {
  '1,1': '低潜低绩', '1,2': '低潜中绩', '1,3': '低潜高绩',
  '2,1': '中潜低绩', '2,2': '中潜中绩', '2,3': '中潜高绩',
  '3,1': '高潜低绩', '3,2': '高潜中绩', '3,3': '高潜高绩',
};

export default function CompReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 表单
  const [employeeId, setEmployeeId] = useState('');
  const [cycle, setCycle] = useState('');
  const [reviewType, setReviewType] = useState('quarterly_checkin');
  const [okrScore, setOkrScore] = useState('');
  const [kpiScore, setKpiScore] = useState('');
  const [boxRow, setBoxRow] = useState('2');
  const [boxCol, setBoxCol] = useState('2');
  const [selfScore, setSelfScore] = useState('');
  const [peerScore, setPeerScore] = useState('');
  const [managerScore, setManagerScore] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/reviews', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!employeeId || !cycle) { setError('员工ID和周期必填'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/comp/admin/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          cycle,
          reviewType,
          okrPotentialScore: okrScore ? Number(okrScore) : undefined,
          kpiPerformanceScore: kpiScore ? Number(kpiScore) : undefined,
          nineBoxRow: Number(boxRow),
          nineBoxCol: Number(boxCol),
          selfScore: selfScore ? Number(selfScore) : undefined,
          peerScore: peerScore ? Number(peerScore) : undefined,
          managerScore: managerScore ? Number(managerScore) : undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setShowForm(false);
      setEmployeeId(''); setCycle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-[12px]';

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Grid3x3 className="h-6 w-6 text-primary" />
          述职 / 九宫格评审
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          潜力(row) × 绩效(col) → 九宫格 → outcome 自动映射 (promote/hold/watch/pip/demote)
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}

      {/* 九宫格图例 */}
      <Card>
        <CardContent className="py-3">
          <div className="grid grid-cols-4 gap-1 text-[10px] max-w-md">
            <div />
            <div className="text-center text-muted-foreground">低绩效</div>
            <div className="text-center text-muted-foreground">中绩效</div>
            <div className="text-center text-muted-foreground">高绩效</div>
            {[
              { r: 3, label: '高潜力' },
              { r: 2, label: '中潜力' },
              { r: 1, label: '低潜力' },
            ].map(({ r, label }) => (
              <div key={r} className="contents">
                <div className="text-right text-muted-foreground pr-1 flex items-center justify-end">{label}</div>
                {[1, 2, 3].map((c) => {
                  const key = `${r},${c}`;
                  const outcomes: Record<string, string> = {
                    '3,3': 'promote', '3,2': 'promote', '3,1': 'watch',
                    '2,3': 'hold', '2,2': 'hold', '2,1': 'pip',
                    '1,3': 'watch', '1,2': 'pip', '1,1': 'demote',
                  };
                  return (
                    <div key={c} className={cn('rounded text-center py-1 border', OUTCOME_CLS[outcomes[key]] ?? '')}>
                      {outcomes[key]}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 提交表单 */}
      {showForm ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption">提交评审</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                员工ID
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-8 w-40 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                周期
                <Input value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="2026-Q3" className="h-8 w-28 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                评审类型
                <select className={selCls} value={reviewType} onChange={(e) => setReviewType(e.target.value)}>
                  <option value="quarterly_checkin">季度述职</option>
                  <option value="half_year">半年评</option>
                  <option value="annual">年度评</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                潜力轴 (1-3)
                <select className={selCls} value={boxRow} onChange={(e) => setBoxRow(e.target.value)}>
                  <option value="1">1 低</option>
                  <option value="2">2 中</option>
                  <option value="3">3 高</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                绩效轴 (1-3)
                <select className={selCls} value={boxCol} onChange={(e) => setBoxCol(e.target.value)}>
                  <option value="1">1 低</option>
                  <option value="2">2 中</option>
                  <option value="3">3 高</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                OKR潜力分
                <Input type="number" step="0.1" value={okrScore} onChange={(e) => setOkrScore(e.target.value)} className="h-8 w-20 text-[12px] tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                KPI绩效分
                <Input type="number" step="0.1" value={kpiScore} onChange={(e) => setKpiScore(e.target.value)} className="h-8 w-20 text-[12px] tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                自评
                <Input type="number" step="0.1" value={selfScore} onChange={(e) => setSelfScore(e.target.value)} className="h-8 w-20 text-[12px] tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                同事评
                <Input type="number" step="0.1" value={peerScore} onChange={(e) => setPeerScore(e.target.value)} className="h-8 w-20 text-[12px] tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                主管评
                <Input type="number" step="0.1" value={managerScore} onChange={(e) => setManagerScore(e.target.value)} className="h-8 w-20 text-[12px] tabular-nums" />
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-[12px] gap-1" disabled={saving} onClick={submit}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} 保存评审
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" className="h-8 text-[12px] gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> 提交评审
        </Button>
      )}

      {/* 评审列表 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">评审记录 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无评审记录</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">员工</th>
                  <th className="text-left font-medium py-1.5">周期</th>
                  <th className="text-center font-medium py-1.5">类型</th>
                  <th className="text-center font-medium py-1.5">九宫格</th>
                  <th className="text-center font-medium py-1.5">潜力</th>
                  <th className="text-center font-medium py-1.5">绩效</th>
                  <th className="text-center font-medium py-1.5">结论</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5">{r.employeeId}</td>
                    <td className="py-1.5">{r.cycle}</td>
                    <td className="text-center py-1.5">{REVIEW_TYPE_LABEL[r.reviewType] ?? r.reviewType}</td>
                    <td className="text-center py-1.5">
                      {r.nineBoxRow && r.nineBoxCol ? NINE_BOX_LABELS[`${r.nineBoxRow},${r.nineBoxCol}`] : '—'}
                    </td>
                    <td className="text-center py-1.5 tabular-nums">{r.okrPotentialScore ?? '—'}</td>
                    <td className="text-center py-1.5 tabular-nums">{r.kpiPerformanceScore ?? '—'}</td>
                    <td className="text-center py-1.5">
                      {r.outcome && (
                        <Badge variant="outline" className={cn('text-[9px] scale-90', OUTCOME_CLS[r.outcome] ?? '')}>
                          {r.outcome}
                        </Badge>
                      )}
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
