'use client';

/**
 * /admin/comp — HR 薪酬定价治理台
 *
 * 真源 = comp_skill_def (能力定价表, HR 动态维护)。
 * 左: 岗族列表 (按职能板块分组)。右: 技能矩阵 (技能 × 等级 V + 定价) + 逐级 Σ定价。
 * 改价即时刷新带宽缓存 (refreshBandSkillWageCache) 并回显新逐级合计。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Coins, Layers, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOARD_LABEL: Record<string, string> = {
  HR: '人力', FIN: '财务', MFG: '生产', RND: '研发', MKT: '营销',
};

interface FamilyLite {
  id: string;
  board: string;
  name: string;
  jobClass: string;
  sequence: string;
  reachableLevels: string[];
}

interface MatrixSkill {
  id: string;
  name: string;
  skillWage: number;
  requiredAt: string[];
  source: string;
}

interface FamilySkillMatrix {
  family: FamilyLite | null;
  levels: string[];
  skills: MatrixSkill[];
  levelTotals: Record<string, number>;
}

export default function CompAdminPage() {
  const [families, setFamilies] = useState<FamilyLite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<FamilySkillMatrix | null>(null);
  const [loadingFam, setLoadingFam] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/comp/admin/families', { credentials: 'include', cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setFamilies(j.families ?? []);
        if (j.families?.[0]) setActiveId(j.families[0].id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingFam(false);
      }
    })();
  }, []);

  const loadMatrix = useCallback(async (familyId: string) => {
    setLoadingMatrix(true);
    try {
      const r = await fetch(`/api/comp/admin/skills?familyId=${encodeURIComponent(familyId)}`, {
        credentials: 'include', cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMatrix(j.matrix ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMatrix(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) void loadMatrix(activeId);
  }, [activeId, loadMatrix]);

  async function saveWage(skillId: string, wage: number) {
    setSavingId(skillId);
    try {
      const r = await fetch('/api/comp/admin/skills', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, skillWage: wage }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMatrix((m) => m ? {
        ...m,
        skills: m.skills.map((s) => s.id === skillId ? { ...s, skillWage: wage } : s),
        levelTotals: j.result?.levelTotals ?? m.levelTotals,
      } : m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const grouped = families.reduce<Record<string, FamilyLite[]>>((acc, f) => {
    (acc[f.board] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" />
          薪酬定价治理台
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          能力定价表（唯一真源）· 技能工资 = Σ 各等级必备技能定价 · 改价即时重算逐级合计
        </p>
      </header>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-caption text-danger">加载失败: {error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* 岗族列表 */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-caption">岗族 ({families.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            {loadingFam ? (
              <div className="flex items-center text-muted-foreground text-caption py-4">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
              </div>
            ) : (
              Object.entries(grouped).map(([board, fams]) => (
                <div key={board} className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                    {BOARD_LABEL[board] ?? board}
                  </div>
                  {fams.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveId(f.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded text-footnote flex items-center justify-between gap-1',
                        activeId === f.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surface-1 text-ink-secondary',
                      )}
                    >
                      <span className="truncate">{f.name}</span>
                      <Badge variant="outline" className="text-[8px] scale-90 shrink-0">{f.sequence}</Badge>
                    </button>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 技能矩阵 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                {matrix?.family?.name ?? '技能矩阵'}
                {matrix?.family && (
                  <Badge variant="outline" className="text-[9px] scale-90">{matrix.family.jobClass}类</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMatrix ? (
              <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载矩阵…
              </div>
            ) : !matrix || matrix.skills.length === 0 ? (
              <p className="text-center text-muted-foreground text-caption py-10">暂无技能</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-1.5 pr-2 min-w-[220px]">技能</th>
                      <th className="text-right font-medium py-1.5 px-2 w-20">定价(元)</th>
                      {matrix.levels.map((l) => (
                        <th key={l} className="text-center font-medium py-1.5 px-1 w-10">{l}</th>
                      ))}
                      <th className="text-center font-medium py-1.5 pl-2 w-16">来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.skills.map((s) => (
                      <tr key={s.id} className="border-b border-border/40 hover:bg-surface-1/50">
                        <td className="py-1 pr-2 text-ink-primary">{s.name}</td>
                        <td className="py-1 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              defaultValue={s.skillWage}
                              className="h-6 w-16 text-right text-[11px] px-1 tabular-nums"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const v = Number((e.target as HTMLInputElement).value);
                                  if (Number.isFinite(v) && v !== s.skillWage) void saveWage(s.id, v);
                                }
                              }}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v !== s.skillWage) void saveWage(s.id, v);
                              }}
                            />
                            {savingId === s.id && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                          </div>
                        </td>
                        {matrix.levels.map((l) => (
                          <td key={l} className="text-center py-1 px-1">
                            {s.requiredAt.includes(l) ? (
                              <Check className="w-3 h-3 text-success inline" />
                            ) : (
                              <span className="text-border">·</span>
                            )}
                          </td>
                        ))}
                        <td className="text-center py-1 pl-2">
                          <Badge variant="outline" className="text-[8px] scale-90">
                            {s.source === '市场定价' ? '市场' : '案例'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {/* 逐级 Σ定价 = 该等级技能工资 (真源) */}
                    <tr className="border-t-2 font-semibold text-primary bg-primary/5">
                      <td className="py-1.5 pr-2">技能工资 (Σ定价)</td>
                      <td className="py-1.5 px-2" />
                      {matrix.levels.map((l) => (
                        <td key={l} className="text-center py-1.5 px-1 tabular-nums text-[10px]">
                          {matrix.levelTotals[l]?.toLocaleString() ?? '—'}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground mt-2">
                  改价后回车/失焦即保存，底行「技能工资」实时重算。此值同步刷新带宽缓存，员工看板与结算即时生效。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
