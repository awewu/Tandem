'use client';

/**
 * /admin/kpi/manual-entry · KPI 通道 C 人工补录工作台
 *
 * CHARTER-KPI-TTI §2.1 通道 C: 财务/HR/内勤 (kpi.manual_entry) 补录 ERP 未覆盖的指标
 *
 * 铁律 (canManualEntry 二级守卫):
 *   - 即使有 kpi.manual_entry 权限, 也不能补录 assigneeId === self 的 KPI
 *   - 所有补录走 audit log (kpi.manual_entry 事件)
 *   - 周期必须 active
 *
 * UI 流程:
 *   1. 左栏: 当前周期可补录的 KPI 列表 (排除 self-assigned)
 *   2. 右栏: 选中 KPI 详情 + 补录表单 + 最近补录时间线
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import {
  RefreshCw,
  Pencil,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Activity,
  Coins,
  ShieldAlert,
  History,
} from 'lucide-react';
import type { Kpi, KpiCycle, KpiManualEntry, KpiSubject, KpiScope } from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_LABEL: Record<KpiScope, { label: string; color: string; icon: typeof Coins }> = {
  bonus: { label: '考核', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Coins },
  monitor: { label: '监控', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: Activity },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiManualEntryPage() {
  const me = useCurrentUserId();
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [entries, setEntries] = useState<KpiManualEntry[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toValue, setToValue] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rc, rs, rk] = await Promise.all([
        fetch('/api/kpi/cycles', { cache: 'no-store' }),
        fetch('/api/kpi/subjects?active=true', { cache: 'no-store' }),
        fetch('/api/kpi', { cache: 'no-store' }),
      ]);
      if (!rc.ok || !rs.ok || !rk.ok) throw new Error('load failed');
      const [jc, js, jk] = await Promise.all([rc.json(), rs.json(), rk.json()]);
      setCycles(jc.cycles ?? []);
      setSubjects(js.subjects ?? []);
      setKpis(jk.kpis ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async (kpiId: string) => {
    try {
      const r = await fetch(`/api/kpi/manual-entry?kpiId=${kpiId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setEntries(j.entries ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await loadCore();
    if (selectedKpiId) await loadEntries(selectedKpiId);
  }, [loadCore, loadEntries, selectedKpiId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeCycles = useMemo(() => cycles.filter((c) => c.status === 'active'), [cycles]);
  const activeCycleIds = useMemo(() => new Set(activeCycles.map((c) => c.id)), [activeCycles]);

  // 可补录候选: 周期 active + 非自己 assignee
  const eligibleKpis = useMemo(() => {
    return kpis
      .filter((k) => activeCycleIds.has(k.cycleId))
      .filter((k) => k.assigneeId !== me)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [kpis, activeCycleIds, me]);

  const subjectName = useCallback(
    (id: string) => subjects.find((s) => s.id === id)?.name ?? id,
    [subjects],
  );
  const subjectCode = useCallback(
    (id: string) => subjects.find((s) => s.id === id)?.code ?? '',
    [subjects],
  );
  const cycleName = useCallback(
    (id: string) => cycles.find((c) => c.id === id)?.name ?? id,
    [cycles],
  );

  const selected = useMemo(
    () => kpis.find((k) => k.id === selectedKpiId) ?? null,
    [kpis, selectedKpiId],
  );

  const selectedEntries = useMemo(
    () =>
      entries
        .filter((e) => e.kpiId === selectedKpiId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries, selectedKpiId],
  );

  useEffect(() => {
    if (selectedKpiId) void loadEntries(selectedKpiId);
  }, [selectedKpiId, loadEntries]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setToValue('');
    setReason('');
    setEvidenceUrl('');
    setSubmitError(null);
  };

  const onSelectKpi = (k: Kpi) => {
    setSelectedKpiId(k.id);
    resetForm();
    setSubmitOk(null);
    setToValue(k.currentValue?.toString() ?? '');
  };

  const submitEntry = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(null);
    try {
      const r = await fetch('/api/kpi/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpiId: selected.id,
          toValue: parseFloat(toValue),
          reason: reason.trim(),
          evidenceUrl: evidenceUrl || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setSubmitOk(`补录成功 · KPI 当前值更新为 ${j.kpi?.currentValue ?? toValue}`);
      resetForm();
      await loadCore();
      await loadEntries(selected.id);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Pencil className="h-6 w-6 text-primary" />
            KPI 人工补录 · 通道 C
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            财务 / HR / 内勤 (kpi.manual_entry) 补录 ERP 未覆盖的指标
            <span className="ml-2 text-footnote">CHARTER-KPI-TTI §2.1</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="py-3 text-caption text-warning flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>不可篡改铁律 (CHARTER §2.1)</strong>: 不能补录自己被考核的 KPI,
            所有补录留 audit log, 周期必须 active. 服务端二级校验拦截违规.
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* 左栏: 可补录 KPI 列表 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption">
              可补录 KPI ({eligibleKpis.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {eligibleKpis.length === 0 ? (
              <div className="p-4 text-caption text-muted-foreground">
                {activeCycles.length === 0
                  ? '没有 active 状态的周期, 请先去 /admin/kpi/setup 激活周期'
                  : '暂无可补录的 KPI (排除你本人作为 assignee 的)'}
              </div>
            ) : (
              <ul>
                {eligibleKpis.map((k) => {
                  const isSelected = k.id === selectedKpiId;
                  const sc = SCOPE_LABEL[k.scope];
                  return (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => onSelectKpi(k)}
                        className={`w-full text-left px-3 py-2.5 border-b last:border-0 transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-caption font-medium leading-tight">{k.title}</span>
                          <Badge variant="outline" className={`${sc.color} text-footnote flex-shrink-0`}>
                            {sc.label}
                          </Badge>
                        </div>
                        <div className="text-footnote text-muted-foreground mt-1 flex items-center gap-2">
                          <span className="font-mono">{subjectCode(k.subjectId)}</span>
                          <span>· {cycleName(k.cycleId)}</span>
                        </div>
                        <div className="text-footnote text-muted-foreground mt-0.5 font-mono">
                          assignee: {k.assigneeId}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 右栏: 详情 + 补录表单 + 历史 */}
        <div className="space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-caption text-muted-foreground">
                左栏选择一个 KPI 开始补录
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body">{selected.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-4 gap-3 text-caption">
                    <div>
                      <div className="text-footnote text-muted-foreground">科目</div>
                      <div className="font-mono text-footnote">{subjectCode(selected.subjectId)}</div>
                      <div>{subjectName(selected.subjectId)}</div>
                    </div>
                    <div>
                      <div className="text-footnote text-muted-foreground">承担人</div>
                      <div className="font-mono text-footnote">{selected.assigneeId}</div>
                    </div>
                    <div>
                      <div className="text-footnote text-muted-foreground">起始 / 目标</div>
                      <div className="tabular-nums">
                        {selected.startValue.toLocaleString()} →{' '}
                        <strong>{selected.targetValue.toLocaleString()}</strong>
                        {selected.unit && (
                          <span className="text-muted-foreground"> {selected.unit}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-footnote text-muted-foreground">当前实际</div>
                      <div className="tabular-nums text-headline font-semibold text-primary">
                        {(selected.currentValue ?? 0).toLocaleString()}
                        {selected.unit && (
                          <span className="text-caption text-muted-foreground ml-1">
                            {selected.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {selected.description && (
                    <p className="text-footnote text-muted-foreground border-t pt-2">
                      {selected.description}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 补录表单 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    新建补录
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      新数值 (toValue) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={toValue}
                      onChange={(e) => setToValue(e.target.value)}
                      placeholder="实际累计值"
                    />
                    <p className="text-footnote text-muted-foreground">
                      当前 KPI.currentValue: {(selected.currentValue ?? 0).toLocaleString()}{' '}
                      → 提交后将覆写为本数值, dataSource 标记为 manual
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      原因 (reason) <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="必填 · 为何 ERP 不能采集此数据 (如: 口径调研, 月度盘点 …)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>证据链接 (evidenceUrl)</Label>
                    <Input
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                      placeholder="可选 · 调研报告 PDF / 内部周报 / 凭证扫描件 URL"
                    />
                  </div>

                  {submitError && (
                    <div className="text-caption text-rose-600 bg-rose-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      {submitError}
                    </div>
                  )}
                  {submitOk && (
                    <div className="text-caption text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {submitOk}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetForm} disabled={submitting}>
                      重置
                    </Button>
                    <Button
                      onClick={() => void submitEntry()}
                      disabled={submitting || !toValue || !reason.trim()}
                    >
                      {submitting ? '提交中…' : '提交补录'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 历史时间线 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    <History className="h-4 w-4" />
                    补录历史 ({selectedEntries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedEntries.length === 0 ? (
                    <div className="p-4 text-caption text-muted-foreground">尚无补录记录</div>
                  ) : (
                    <ul className="divide-y">
                      {selectedEntries.slice(0, 20).map((e) => (
                        <li key={e.id} className="px-4 py-2.5 text-caption">
                          <div className="flex items-center justify-between gap-2">
                            <span className="tabular-nums">
                              <span className="text-muted-foreground">
                                {e.fromValue.toLocaleString()}
                              </span>{' '}
                              →{' '}
                              <strong>{e.toValue.toLocaleString()}</strong>
                              <span className="text-footnote text-muted-foreground ml-2">
                                Δ {(e.toValue - e.fromValue >= 0 ? '+' : '')}
                                {(e.toValue - e.fromValue).toLocaleString()}
                              </span>
                            </span>
                            <span className="text-footnote text-muted-foreground">
                              {new Date(e.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-footnote text-muted-foreground mt-1 flex items-center gap-3">
                            <Badge variant="outline" className="text-footnote">
                              {e.operatorRole}
                            </Badge>
                            <span className="font-mono">by {e.operatorId}</span>
                            {e.evidenceUrl && (
                              <a
                                href={e.evidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-primary"
                              >
                                证据
                              </a>
                            )}
                          </div>
                          {e.reason && (
                            <div className="text-footnote text-foreground/80 mt-1 italic">
                              &ldquo;{e.reason}&rdquo;
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
