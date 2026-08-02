'use client';

/**
 * /admin/comp/demotion-audit — HR 降职分布公平性审计
 *
 * 可视化降职记录按部门分布, 检测系统性偏差 (某部门 >40% 标记)。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemotionDistribution {
  byDepartment: Record<string, number>;
  total: number;
  hasConcentration: boolean;
  concentratedDepartments: string[];
}

export default function DemotionAuditPage() {
  const [data, setData] = useState<DemotionDistribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/demotion-audit', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const entries = data ? Object.entries(data.byDepartment).sort((a, b) => b[1] - a[1]) : [];
  const maxCount = entries.length > 0 ? entries[0][1] : 1;

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          降职公平性审计
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          降职分布按部门统计 · 某部门占比 &gt;40% (且总数≥5) 自动标记偏差
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          制度意义: 降职不是惩罚工具，而是绩效闭环的自然结果。分布偏差告警防止&quot;某部门被针对性降职&quot;的系统性偏见。
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}

      {data?.hasConcentration && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <span className="text-caption text-danger">
              检测到集中偏差: {data.concentratedDepartments.join(', ')} 部门降职占比超过 40%
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center justify-between">
            <span>降职分布 ({data?.total ?? 0} 条)</span>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={load} disabled={loading}>刷新</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : !data || data.total === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无降职记录</p>
          ) : (
            <div className="space-y-2">
              {entries.map(([dept, count]) => {
                const pct = (count / data.total) * 100;
                const isConcentrated = data.concentratedDepartments.includes(dept);
                return (
                  <div key={dept} className="flex items-center gap-3">
                    <div className="w-32 text-[11px] truncate text-muted-foreground">{dept}</div>
                    <div className="flex-1 h-6 bg-surface-1 rounded relative overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded transition-all',
                          isConcentrated ? 'bg-danger/60' : 'bg-primary/40',
                        )}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2 text-[10px] tabular-nums">
                        {count} ({pct.toFixed(0)}%)
                      </div>
                    </div>
                    {isConcentrated && (
                      <Badge variant="outline" className="text-[9px] text-danger border-danger/30">偏差</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
