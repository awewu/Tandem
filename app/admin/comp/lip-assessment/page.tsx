'use client';

/**
 * /admin/comp/lip-assessment — HR LIP 部门考核计算台
 *
 * 输入质量/效率达成率 → 自动算部门考核系数 → 预览 LIP 月度绩效奖金
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, Building2, Save, Loader2 } from 'lucide-react';

interface AssessmentResult {
  assessmentRate: number;
  coefficient: number;
  qualityBelow: boolean;
  efficiencyBelow: boolean;
  lipBonus: number;
}

interface SavedRecord {
  id: string;
  department: string;
  assessmentRate: number;
  coefficient: number;
  lipBonus: number;
  qualityBelow: boolean;
  efficiencyBelow: boolean;
  savedAt: string;
  savedBy: string;
}

export default function LipAssessmentPage() {
  const [department, setDepartment] = useState('');
  const [qualityRate, setQualityRate] = useState('0.90');
  const [efficiencyRate, setEfficiencyRate] = useState('0.85');
  const [departmentBase, setDepartmentBase] = useState('50000');
  const [personalCoefficient, setPersonalCoefficient] = useState('1.0');
  const [attendanceRate, setAttendanceRate] = useState('1.0');
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function calculate() {
    setError(null);
    const q = Number(qualityRate);
    const e = Number(efficiencyRate);
    const base = Number(departmentBase);
    const pc = Number(personalCoefficient);
    const ar = Number(attendanceRate);

    if (isNaN(q) || isNaN(e) || isNaN(base) || isNaN(pc) || isNaN(ar)) {
      setError('请输入有效数字');
      return;
    }

    const assessmentRate = q * 0.5 + e * 0.5;
    const coefficient = Math.min(1, assessmentRate);
    const safePersonal = Math.min(1.3, Math.max(0, pc));
    const safeAttendance = Math.max(0, Math.min(1, ar));
    const lipBonus = Math.round(base * coefficient * safePersonal * safeAttendance);

    setResult({
      assessmentRate,
      coefficient,
      qualityBelow: q < 1,
      efficiencyBelow: e < 1,
      lipBonus,
    });
  }

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await fetch('/api/comp/admin/lip-assessment', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setHistory(j.rows ?? []);
    } catch { /* noop */ } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function saveResult() {
    if (!result || !department) {
      setError('请先输入部门名称并计算');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      const r = await fetch('/api/comp/admin/lip-assessment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          qualityRate: Number(qualityRate),
          efficiencyRate: Number(efficiencyRate),
          departmentBase: Number(departmentBase),
          personalCoefficient: Number(personalCoefficient),
          attendanceRate: Number(attendanceRate),
          assessmentRate: result.assessmentRate,
          coefficient: result.coefficient,
          lipBonus: result.lipBonus,
          qualityBelow: result.qualityBelow,
          efficiencyBelow: result.efficiencyBelow,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setSaveMsg(`已保存: ${department} LIP 奖金 ${result.lipBonus.toLocaleString()} 元`);
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          LIP 部门考核
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          质量50% + 效率/服务50% → 部门系数(封顶100%) → LIP = 部门基数 × 部门系数 × 个人系数(≤1.3) × 出勤率
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          设计精神: 部门封顶 100% 防止部门整体刷分, 个人可上浮 1.3 激励头部员工。质量与效率等权, 不偏废。
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
      {saveMsg && <Card className="border-success/30 bg-success/5"><CardContent className="py-2 text-caption text-success">{saveMsg}</CardContent></Card>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">输入参数</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              部门名称
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="生产一车间" className="h-8 text-[12px]" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              质量达成率 (0~1)
              <Input type="number" step="0.01" min="0" max="1" value={qualityRate} onChange={(e) => setQualityRate(e.target.value)} className="h-8 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              效率/服务达成率 (0~1)
              <Input type="number" step="0.01" min="0" max="1" value={efficiencyRate} onChange={(e) => setEfficiencyRate(e.target.value)} className="h-8 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              部门奖金基数 (元)
              <Input type="number" step="100" min="0" value={departmentBase} onChange={(e) => setDepartmentBase(e.target.value)} className="h-8 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              个人系数 (≤1.3)
              <Input type="number" step="0.01" min="0" max="1.3" value={personalCoefficient} onChange={(e) => setPersonalCoefficient(e.target.value)} className="h-8 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              出勤率 (0~1)
              <Input type="number" step="0.01" min="0" max="1" value={attendanceRate} onChange={(e) => setAttendanceRate(e.target.value)} className="h-8 text-[12px] tabular-nums" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 text-[12px] gap-1" onClick={calculate}>
              <Calculator className="h-3 w-3" /> 计算
            </Button>
            {result && (
              <Button size="sm" variant="outline" className="h-8 text-[12px] gap-1" onClick={saveResult} disabled={saving || !department}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} 保存结果
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption">计算结果</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{(result.assessmentRate * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">综合达成率</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{(result.coefficient * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">部门系数</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums text-success">{result.lipBonus.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">LIP 奖金 (元)</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">
                  {result.qualityBelow ? '未达' : '达标'} / {result.efficiencyBelow ? '未达' : '达标'}
                </div>
                <div className="text-[10px] text-muted-foreground">质量 / 效率</div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              公式: {Number(departmentBase).toLocaleString()} × {(result.coefficient * 100).toFixed(0)}% × {personalCoefficient} × {attendanceRate} = {result.lipBonus.toLocaleString()} 元
            </div>
          </CardContent>
        </Card>
      )}
      {/* 历史记录 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">考核历史 ({history.length})</CardTitle></CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-6">暂无保存的考核记录</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">部门</th>
                  <th className="text-right font-medium py-1.5">综合达成</th>
                  <th className="text-right font-medium py-1.5">部门系数</th>
                  <th className="text-right font-medium py-1.5">LIP 奖金</th>
                  <th className="text-left font-medium py-1.5">保存时间</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-border/40">
                    <td className="py-1.5 font-medium">{h.department}</td>
                    <td className="text-right py-1.5 tabular-nums">{(h.assessmentRate * 100).toFixed(1)}%</td>
                    <td className="text-right py-1.5 tabular-nums">{(h.coefficient * 100).toFixed(0)}%</td>
                    <td className="text-right py-1.5 tabular-nums text-success font-medium">{h.lipBonus.toLocaleString()}</td>
                    <td className="py-1.5 text-muted-foreground tabular-nums">{new Date(h.savedAt).toLocaleString()}</td>
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
