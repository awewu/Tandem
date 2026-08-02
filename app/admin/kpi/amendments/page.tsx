'use client';

/**
 * /admin/kpi/amendments · CEO/owner/admin 集中审批目标修订申请
 *
 * 列出指定周期内的 KPI target 修订申请; pending 状态下可直接批准/驳回。
 * 批准后若父级 target 与子级 target 和不一致, 会在响应中提示 cascadeWarning。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileEdit, Check, X as XIcon, AlertTriangle } from 'lucide-react';
import type { Kpi, KpiCycle, KpiSubject, KpiTargetAmendment, KpiTargetAmendmentStatus } from '@/lib/types/kpi';

type StatusFilter = KpiTargetAmendmentStatus | 'all';

interface EnrichedAmendment extends KpiTargetAmendment {
  kpiTitle?: string;
  subjectName?: string;
  requesterName?: string;
  cycleName?: string;
}

export default function KpiAmendmentsPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [amendments, setAmendments] = useState<KpiTargetAmendment[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [users, setUsers] = useState<{ id: string; name?: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [cascadeWarnings, setCascadeWarnings] = useState<Record<string, { parentTarget: number; childrenSum: number; deltaPct: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchJson = useCallback(async (url: string) => {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.json().catch(() => ({}))).error ?? '请求失败'}`);
    return res.json();
  }, []);

  const loadCycles = useCallback(async () => {
    const data = await fetchJson('/api/kpi/cycles');
    setCycles(data.cycles ?? []);
  }, [fetchJson]);

  const loadStaticData = useCallback(async () => {
    const [subData, userData] = await Promise.all([
      fetchJson('/api/kpi/subjects'),
      fetchJson('/api/org/users'),
    ]);
    setSubjects(subData.subjects ?? []);
    setUsers(userData.users ?? []);
  }, [fetchJson]);

  const loadAmendments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCycleId !== 'all') params.set('cycleId', selectedCycleId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await fetchJson(`/api/kpi/target-amendments?${params.toString()}`);
      setAmendments(data.amendments ?? []);

      // 拉取涉及周期的 KPI 用于标题回填
      const cycleIds = Array.from(new Set((data.amendments as KpiTargetAmendment[]).map((a) => a.cycleId)));
      const kpiList: Kpi[] = [];
      await Promise.all(
        cycleIds.map(async (cid) => {
          const kd = await fetchJson(`/api/kpi?cycleId=${encodeURIComponent(cid)}`);
          kpiList.push(...(kd.kpis ?? []));
        }),
      );
      setKpis(kpiList);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchJson, selectedCycleId, statusFilter]);

  useEffect(() => { loadCycles(); loadStaticData(); }, [loadCycles, loadStaticData]);
  useEffect(() => { loadAmendments(); }, [loadAmendments]);

  const enriched = useMemo<EnrichedAmendment[]>(() => {
    const kpiById = new Map(kpis.map((k) => [k.id, k]));
    const subById = new Map(subjects.map((s) => [s.id, s]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const cycleById = new Map(cycles.map((c) => [c.id, c]));

    return amendments.map((a) => ({
      ...a,
      kpiTitle: kpiById.get(a.kpiId)?.title,
      subjectName: subById.get(kpiById.get(a.kpiId)?.subjectId ?? '')?.name,
      requesterName: userById.get(a.requestedBy)?.name ?? userById.get(a.requestedBy)?.email,
      cycleName: cycleById.get(a.cycleId)?.name,
    }));
  }, [amendments, kpis, subjects, users, cycles]);

  const review = async (amendment: EnrichedAmendment, decision: 'approve' | 'reject') => {
    setBusyId(amendment.id);
    setError(null);
    try {
      const res = await fetch(`/api/kpi/target-amendments/${amendment.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNote: reviewNotes[amendment.id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '审批失败');

      if (data.cascadeWarning) {
        setCascadeWarnings((prev) => ({ ...prev, [amendment.id]: data.cascadeWarning }));
      }
      setReviewNotes((prev) => ({ ...prev, [amendment.id]: '' }));
      await loadAmendments();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (status: KpiTargetAmendmentStatus) => {
    if (status === 'pending') return <Badge variant="outline" className="text-[10px] text-warning border-warning/40 bg-warning/10">待审批</Badge>;
    if (status === 'approved') return <Badge variant="outline" className="text-[10px] text-success border-success/40 bg-success/10">已批准</Badge>;
    return <Badge variant="outline" className="text-[10px] text-danger border-danger/40 bg-danger/10">已驳回</Badge>;
  };

  const selectedCycleName = useMemo(() => {
    if (selectedCycleId === 'all') return '全部周期';
    return cycles.find((c) => c.id === selectedCycleId)?.name ?? selectedCycleId;
  }, [selectedCycleId, cycles]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-title-3 font-semibold flex items-center gap-2">
            <FileEdit className="h-5 w-5" /> KPI 目标修订审批
          </h1>
          <p className="text-[11px] text-muted-foreground">仅 owner/admin 可审批; 仅 active 周期允许修订</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[200px] h-8 text-[11px]">
              <SelectValue placeholder="选择周期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部周期</SelectItem>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-[11px]">
                  {c.name} ({c.fiscalYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList className="h-8">
              <TabsTrigger value="pending" className="text-[10px] px-2">待审批</TabsTrigger>
              <TabsTrigger value="approved" className="text-[10px] px-2">已批准</TabsTrigger>
              <TabsTrigger value="rejected" className="text-[10px] px-2">已驳回</TabsTrigger>
              <TabsTrigger value="all" className="text-[10px] px-2">全部</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-footnote font-bold">
            {selectedCycleName} · {statusFilter === 'all' ? '全部' : statusFilter === 'pending' ? '待审批' : statusFilter === 'approved' ? '已批准' : '已驳回'}申请
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground text-caption">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中…
            </div>
          ) : enriched.length === 0 ? (
            <div className="py-10 text-center text-[11px] text-muted-foreground">
              当前筛选条件下没有修订申请
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">周期 / KPI</th>
                    <th className="text-left py-2 font-medium">申请人</th>
                    <th className="text-right py-2 font-medium">目标值变更</th>
                    <th className="text-left py-2 font-medium">理由</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-right py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-ink-primary">{a.kpiTitle ?? a.kpiId}</div>
                        <div className="text-[10px] text-muted-foreground">{a.cycleName} {a.subjectName ? `· ${a.subjectName}` : ''}</div>
                      </td>
                      <td className="py-2 pr-2 text-ink-secondary">{a.requesterName ?? a.requestedBy}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {a.fromTargetValue.toLocaleString()} → {a.toTargetValue.toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 max-w-[220px]">
                        <div className="truncate" title={a.reason}>{a.reason}</div>
                        {a.reviewNote && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={`审批备注: ${a.reviewNote}`}>
                            备注: {a.reviewNote}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2">{statusBadge(a.status)}</td>
                      <td className="py-2 text-right">
                        {a.status === 'pending' ? (
                          <div className="space-y-2 text-right">
                            <Textarea
                              placeholder="审批备注 (可选)"
                              className="min-h-[44px] text-[10px]"
                              value={reviewNotes[a.id] ?? ''}
                              onChange={(e) => setReviewNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-[10px] bg-success hover:bg-success/90"
                                disabled={busyId === a.id}
                                onClick={() => review(a, 'approve')}
                              >
                                {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                批准
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-[10px]"
                                disabled={busyId === a.id}
                                onClick={() => review(a, 'reject')}
                              >
                                <XIcon className="h-3 w-3 mr-1" /> 驳回
                              </Button>
                            </div>
                            {cascadeWarnings[a.id] && (
                              <div className="text-[10px] text-warning text-right flex items-center justify-end gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                级联失衡: 父级 {cascadeWarnings[a.id].parentTarget.toLocaleString()}, 子级合计 {cascadeWarnings[a.id].childrenSum.toLocaleString()} (偏差 {cascadeWarnings[a.id].deltaPct}%)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {a.reviewedAt ? new Date(a.reviewedAt).toLocaleString() : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
