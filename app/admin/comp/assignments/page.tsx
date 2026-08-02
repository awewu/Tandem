'use client';

/**
 * /admin/comp/assignments — HR 员工职级分配
 *
 * 给员工定 岗族 × 岗类 × 层级 × 任务档 → comp_employee_grade。
 * baseWageSnapshot 自带宽取值; 保存后员工看板即显示完整三段。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, UserCog, Check } from 'lucide-react';

interface FamilyLite {
  id: string;
  board: string;
  name: string;
  jobClass: string;
  reachableLevels: string[];
}
interface AssignableEmployee { id: string; name: string; email: string; hasGrade: boolean }
interface GradeRow {
  employeeId: string; name: string; email: string;
  familyName: string; jobClass: string; currentLevel: string; taskGear: string; baseWageSnapshot: number;
}

const BOARD_LABEL: Record<string, string> = { HR: '人力', FIN: '财务', MFG: '生产', RND: '研发', MKT: '营销' };
const GEARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const JOB_CLASSES = ['I', 'II', 'III'];
const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-[12px]';

export default function CompAssignmentsPage() {
  const [families, setFamilies] = useState<FamilyLite[]>([]);
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [jobClass, setJobClass] = useState('I');
  const [level, setLevel] = useState('L1');
  const [taskGear, setTaskGear] = useState('D');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [fr, ar] = await Promise.all([
        fetch('/api/comp/admin/families', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/comp/admin/assignments', { credentials: 'include', cache: 'no-store' }),
      ]);
      const fj = await fr.json();
      const aj = await ar.json();
      setFamilies(fj.families ?? []);
      setEmployees(aj.employees ?? []);
      setGrades(aj.grades ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const selectedFamily = families.find((f) => f.id === familyId);
  const levelOptions = selectedFamily?.reachableLevels ?? ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];

  async function submit() {
    if (!employeeId || !familyId) { setErr('请选择员工与岗族'); return; }
    setSaving(true); setErr(null); setMsg(null);
    try {
      const r = await fetch('/api/comp/admin/assignments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, familyId, jobClass, level, taskGear }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? '保存失败'); return; }
      setMsg(`已定级 · 基本工资 ${j.result?.baseWageSnapshot?.toLocaleString() ?? '?'}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          员工职级分配
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          定 岗族 × 岗类 × 层级 × 任务档 · 基本工资按带宽自动取值 · 保存后员工看板即显示三段
        </p>
      </header>

      {err && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{err}</CardContent></Card>}

      {/* 分配表单 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">分配 / 调整</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              员工
              <select className={selCls + ' min-w-[180px]'} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">选择员工…</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} {u.hasGrade ? '· 已定级' : ''}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              岗族
              <select className={selCls + ' min-w-[160px]'} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
                <option value="">选择岗族…</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>{BOARD_LABEL[f.board] ?? f.board} · {f.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              岗类
              <select className={selCls} value={jobClass} onChange={(e) => setJobClass(e.target.value)}>
                {JOB_CLASSES.map((c) => <option key={c} value={c}>{c}类</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              层级
              <select className={selCls} value={level} onChange={(e) => setLevel(e.target.value)}>
                {levelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              任务档
              <select className={selCls} value={taskGear} onChange={(e) => setTaskGear(e.target.value)}>
                {GEARS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <Button size="sm" className="h-8 text-[12px] gap-1" disabled={saving} onClick={submit}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} 保存
            </Button>
          </div>
          {msg && <p className="text-[11px] text-success">{msg}</p>}
        </CardContent>
      </Card>

      {/* 当前定级列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption">当前定级 ({grades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center text-muted-foreground text-caption py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : grades.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-6">暂无员工定级</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">员工</th>
                  <th className="text-left font-medium py-1.5">岗族</th>
                  <th className="text-center font-medium py-1.5">岗类</th>
                  <th className="text-center font-medium py-1.5">层级</th>
                  <th className="text-center font-medium py-1.5">任务档</th>
                  <th className="text-right font-medium py-1.5">基本工资</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.employeeId} className="border-b border-border/40">
                    <td className="py-1.5">{g.name}</td>
                    <td className="py-1.5">{g.familyName}</td>
                    <td className="text-center py-1.5"><Badge variant="outline" className="text-[9px] scale-90">{g.jobClass}</Badge></td>
                    <td className="text-center py-1.5">{g.currentLevel}</td>
                    <td className="text-center py-1.5">{g.taskGear}</td>
                    <td className="text-right py-1.5 tabular-nums">{g.baseWageSnapshot.toLocaleString()}</td>
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
