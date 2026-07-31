'use client';

/**
 * 目标自动生成引擎 · Setup 页内嵌面板
 *
 * 只在 draft 周期展示: 拉取上一财年真实 actual, 按增长率生成建议,
 * HR 可对单条建议"采纳"(预填新建 KPI 表单, 由调用方决定如何落地创建)。
 * 纯建议展示, 不自动写入任何 Kpi 记录 (见 lib/kpi/target-suggestion-engine.ts)。
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TriangleAlert, Check } from 'lucide-react';
import type { KpiSubject } from '@/lib/types/kpi';

export interface TargetSuggestionRow {
  priorKpiId: string;
  priorParentKpiId?: string;
  subjectId: string;
  subjectCode: string;
  assigneeId: string;
  level: string;
  priorActual: number;
  priorTitle?: string;
  priorMeasureType?: string;
  priorUnit?: string;
  priorWeight?: number;
  priorScope?: string;
  priorDepartmentId?: string;
  growthRateUsed: number;
  suggestedTarget: number;
  alreadySet: boolean;
  cascadeWarning: {
    parentSubjectCode: string;
    parentSuggestedTarget: number;
    childrenSuggestedSum: number;
    deltaPct: number;
  } | null;
}

interface Props {
  cycleId: string;
  subjects: KpiSubject[];
  assigneeName: (id: string) => string;
  /** 采纳一条建议: 由调用方决定如何预填 / 落地 (通常打开新建 KPI 对话框) */
  onAdopt: (row: TargetSuggestionRow) => void;
}

export function TargetSuggestionPanel({ cycleId, subjects, assigneeName, onAdopt }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [defaultGrowthRate, setDefaultGrowthRate] = useState('0');
  const [rateByCode, setRateByCode] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TargetSuggestionRow[]>([]);
  const [priorFiscalYear, setPriorFiscalYear] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const growthRateByCode: Record<string, number> = {};
      for (const [code, v] of Object.entries(rateByCode)) {
        const n = parseFloat(v);
        if (!Number.isNaN(n)) growthRateByCode[code] = n;
      }
      const res = await fetch('/api/kpi/target-suggestions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId,
          growthRateByCode,
          defaultGrowthRate: parseFloat(defaultGrowthRate) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '生成失败'); return; }
      setSuggestions(data.suggestions ?? []);
      setPriorFiscalYear(data.priorFiscalYear ?? null);
      setNote(data.note ?? null);
    } finally {
      setLoading(false);
    }
  };

  const subjectCodesInUse = Array.from(new Set(suggestions.map((s) => s.subjectCode))).sort();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            目标自动生成引擎 (基于上一财年真实数据)
          </span>
          <Button size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? '收起' : '展开生成'}
          </Button>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <p className="text-footnote text-muted-foreground">
            建议 = 上一财年真实 actual × (1 + 增长率)。查不到历史基准的科目不会给出建议, 需 HR 手工设定。
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-footnote text-muted-foreground">默认增长率 (如 0.1 = 10%)</label>
              <Input
                type="number"
                step="0.01"
                value={defaultGrowthRate}
                onChange={(e) => setDefaultGrowthRate(e.target.value)}
                className="h-8 w-32 text-caption"
              />
            </div>
            <Button size="sm" onClick={generate} disabled={loading}>
              {loading ? '生成中…' : '生成建议'}
            </Button>
          </div>

          {subjectCodesInUse.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-footnote text-muted-foreground">按科目覆盖增长率 (留空用默认值, 改完点"生成建议"重新计算)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {subjectCodesInUse.map((code) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <span className="text-footnote font-mono text-muted-foreground w-24 truncate" title={code}>{code}</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="默认"
                      value={rateByCode[code] ?? ''}
                      onChange={(e) => setRateByCode((s) => ({ ...s, [code]: e.target.value }))}
                      className="h-7 text-footnote"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-footnote text-danger">{error}</p>}
          {note && <p className="text-footnote text-warning bg-warning/5 border border-warning/20 rounded-md px-3 py-2">{note}</p>}

          {suggestions.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-footnote text-muted-foreground mb-2">
                对比 FY{priorFiscalYear} 真实数据, 共 {suggestions.length} 条建议
              </p>
              <table className="w-full text-caption">
                <thead className="border-b bg-muted/40 text-footnote uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">科目</th>
                    <th className="px-3 py-2 text-left font-medium">承担人</th>
                    <th className="px-3 py-2 text-right font-medium">上年实际</th>
                    <th className="px-3 py-2 text-right font-medium">增长率</th>
                    <th className="px-3 py-2 text-right font-medium">建议目标</th>
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.priorKpiId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-mono text-muted-foreground">{s.subjectCode}</span>
                        {s.cascadeWarning && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-warning" title={`子级建议之和 ${s.cascadeWarning.childrenSuggestedSum} 偏离父级建议 ${s.cascadeWarning.deltaPct}%`}>
                            <TriangleAlert className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-footnote text-muted-foreground">{assigneeName(s.assigneeId)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.priorActual.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(s.growthRateUsed * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{s.suggestedTarget.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        {s.alreadySet ? (
                          <Badge variant="outline" className="text-footnote">
                            <Check className="h-3 w-3 mr-1" /> 已设定
                          </Badge>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onAdopt(s)}>
                            采纳
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
