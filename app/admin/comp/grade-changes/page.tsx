'use client';

/**
 * /admin/comp/grade-changes — 职级变更签批流
 *
 * 发起变更 (知悉/PIP告知/降职生效/职级晋升/任务承接) → 签批/拒签 → 申诉管理。
 * 已签 + 晋升/降职自动应用 employeeGrade.currentLevel + baseWageSnapshot。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, GitBranch, Plus, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradeChangeRow {
  id: string;
  employeeId: string;
  nodeId: string;
  cycle: string;
  changeType: string;
  fromGrade: string | null;
  toGrade: string | null;
  signatureState: string;
  signedAt: string | null;
  appealState: string;
}

const SIG_CLS: Record<string, string> = {
  '待签': 'bg-warning/10 text-warning border-warning/30',
  '已签': 'bg-success/10 text-success border-success/30',
  '拒签': 'bg-danger/10 text-danger border-danger/30',
};

const APPEAL_CLS: Record<string, string> = {
  none: '',
  open: 'bg-warning/10 text-warning border-warning/30',
  resolved: 'bg-success/10 text-success border-success/30',
};

const CHANGE_TYPES = ['知悉', 'PIP告知', '降职生效', '职级晋升', '任务承接'];
const LEVELS = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];

export default function CompGradeChangesPage() {
  const [rows, setRows] = useState<GradeChangeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 表单
  const [employeeId, setEmployeeId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [cycle, setCycle] = useState('');
  const [changeType, setChangeType] = useState('职级晋升');
  const [fromGrade, setFromGrade] = useState('L2');
  const [toGrade, setToGrade] = useState('L3');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/grade-changes', { credentials: 'include', cache: 'no-store' });
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
    if (!employeeId || !nodeId || !cycle) { setError('员工ID、节点ID、周期必填'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/comp/admin/grade-changes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId, nodeId, cycle, changeType,
          fromGrade: changeType === '知悉' || changeType === 'PIP告知' ? undefined : fromGrade,
          toGrade: changeType === '知悉' || changeType === 'PIP告知' ? undefined : toGrade,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setShowForm(false);
      setEmployeeId(''); setNodeId(''); setCycle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sign(id: string, action: 'sign' | 'reject') {
    try {
      const r = await fetch('/api/comp/admin/grade-changes', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: id, action }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function appeal(id: string, action: 'appeal_open' | 'appeal_resolve') {
    try {
      const r = await fetch('/api/comp/admin/grade-changes', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: id, action }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-[12px]';
  const needsGrade = changeType === '降职生效' || changeType === '职级晋升';

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          职级变更签批
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          知悉/PIP/降职/晋升/承接 · 待签→已签/拒签 · 申诉管理 · 已签晋升自动应用
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}

      {showForm ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption">发起变更</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                员工ID
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-8 w-40 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                节点ID
                <Input value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="如: node_001" className="h-8 w-32 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                周期
                <Input value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="2026-Q3" className="h-8 w-28 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                变更类型
                <select className={selCls} value={changeType} onChange={(e) => setChangeType(e.target.value)}>
                  {CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {needsGrade && (
                <>
                  <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    原层级
                    <select className={selCls} value={fromGrade} onChange={(e) => setFromGrade(e.target.value)}>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    目标层级
                    <select className={selCls} value={toGrade} onChange={(e) => setToGrade(e.target.value)}>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-[12px] gap-1" disabled={saving} onClick={submit}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} 发起变更
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" className="h-8 text-[12px] gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> 发起变更
        </Button>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">变更记录 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无变更记录</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">员工</th>
                  <th className="text-left font-medium py-1.5">周期</th>
                  <th className="text-center font-medium py-1.5">类型</th>
                  <th className="text-center font-medium py-1.5">原层级</th>
                  <th className="text-center font-medium py-1.5">目标层级</th>
                  <th className="text-center font-medium py-1.5">签批</th>
                  <th className="text-center font-medium py-1.5">申诉</th>
                  <th className="text-center font-medium py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5">{r.employeeId}</td>
                    <td className="py-1.5">{r.cycle}</td>
                    <td className="text-center py-1.5">{r.changeType}</td>
                    <td className="text-center py-1.5">{r.fromGrade ?? '—'}</td>
                    <td className="text-center py-1.5 font-medium text-primary">{r.toGrade ?? '—'}</td>
                    <td className="text-center py-1.5">
                      <Badge variant="outline" className={cn('text-[9px] scale-90', SIG_CLS[r.signatureState] ?? '')}>
                        {r.signatureState}
                      </Badge>
                    </td>
                    <td className="text-center py-1.5">
                      {r.appealState !== 'none' && (
                        <Badge variant="outline" className={cn('text-[9px] scale-90', APPEAL_CLS[r.appealState] ?? '')}>
                          {r.appealState === 'open' && <AlertCircle className="w-2.5 h-2.5 mr-0.5 inline" />}
                          {r.appealState}
                        </Badge>
                      )}
                    </td>
                    <td className="text-center py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        {r.signatureState === '待签' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-success" onClick={() => sign(r.id, 'sign')}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-danger" onClick={() => sign(r.id, 'reject')}>
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {r.signatureState === '已签' && r.appealState === 'none' && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-warning" onClick={() => appeal(r.id, 'appeal_open')}>
                            申诉
                          </Button>
                        )}
                        {r.appealState === 'open' && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-success" onClick={() => appeal(r.id, 'appeal_resolve')}>
                            了结
                          </Button>
                        )}
                      </div>
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
