'use client';

/**
 * /admin/governance/okr-drift · OKR 主航道偏离看板 (B-015)
 *
 * 灵魂层第 2 条 "整体能力提升 + 约束聚焦" 度量入口.
 *
 * 治理委员会月审用:
 *   - 总 drift 次数
 *   - 按来源分桶 (CompanyBrain / Persona Reply / ProxyAction / DecisionCard)
 *   - 日趋势
 *   - 明细列表 (含 intent 预览 + Top3 OKR 命中)
 *
 * 校准目标: ALIGNED_THRESHOLD (lib/governance/okr-drift.ts) 应根据真实 drift
 * 数据调整, 让"明显偏离主航道"的真实信号被捕获, 同时避免误伤辅助性话题.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Target } from 'lucide-react';

interface Hit {
  objectiveTitle?: string;
  keyResultTitle?: string;
  similarity?: number;
}
interface DriftEntry {
  id: string;
  timestamp: string;
  actorId: string;
  targetId?: string;
  targetType?: string;
  source?: string;
  alignmentScore?: number;
  okrCount?: number;
  topHits?: Hit[];
  intentPreview?: string;
}
interface ApiResp {
  total: number;
  avgAlignmentScore: number;
  bySource: Record<string, number>;
  dailyTrend: Array<{ date: string; count: number }>;
  entries: DriftEntry[];
}

const SOURCE_LABEL: Record<string, string> = {
  im_persona_reply: 'Persona 回复',
  company_brain_reply: 'CompanyBrain',
  proxy_action: '代行 ProxyAction',
  decision_card: '议事室',
  manual: '手动检测',
};

export default function OkrDriftAdminPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/governance/okr-drift?limit=500', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResp;
        setData(json);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载 OKR Drift 看板...
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8 text-rose-700">
        <AlertTriangle className="inline h-5 w-5" /> 加载失败: {err}
      </div>
    );
  }

  if (!data) return null;

  const maxDayCount = Math.max(1, ...data.dailyTrend.map((d) => d.count));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* 头部 */}
      <header className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 p-6 ring-1 ring-amber-200/80">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
            <Target className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-amber-900">
              🎯 OKR 主航道偏离 · 治理看板
            </h1>
            <p className="mt-1 text-[12.5px] text-amber-800/80">
              §B-015 (OKR-DRIVEN §三第2条) · 灵魂层第 2 条 整体能力提升 + 约束聚焦.
              <br />
              检测对象: CompanyBrain 答复 / Persona 代行 / 议事议题 vs 公司层 active Objective + KR 的语义对齐度.
            </p>
            <p className="mt-1.5 text-[11px] text-amber-700/70">
              判定逻辑: <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[11px]">lib/governance/okr-drift.ts</code> · 阈值
              <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[11px]">ALIGNED_THRESHOLD=0.28</code> (embedding) /
              <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[11px]">0.15</code> (jaccard 兜底)
            </p>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="DRIFT 总数" value={data.total.toString()} hint="近期累计" tone="amber" />
        <Kpi label="平均对齐分" value={data.avgAlignmentScore.toFixed(3)} hint="< 阈值 → drift" tone="rose" />
        <Kpi
          label="来源数"
          value={Object.keys(data.bySource).length.toString()}
          hint={Object.entries(data.bySource).map(([k, v]) => `${SOURCE_LABEL[k] ?? k} ${v}`).join(' · ') || '—'}
          tone="indigo"
        />
      </section>

      {/* 双栏: 按来源 + 日趋势 */}
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-3 text-sm font-bold text-slate-800">按来源分桶</h2>
          {Object.keys(data.bySource).length === 0 ? (
            <p className="text-[12px] text-slate-400">暂无 drift 数据</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(data.bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([src, count]) => {
                  const total = Object.values(data.bySource).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <li key={src}>
                      <div className="flex justify-between text-[12px]">
                        <span className="font-medium text-slate-700">{SOURCE_LABEL[src] ?? src}</span>
                        <span className="text-slate-500">
                          {count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-3 text-sm font-bold text-slate-800">日趋势</h2>
          {data.dailyTrend.length === 0 ? (
            <p className="text-[12px] text-slate-400">暂无 drift 数据</p>
          ) : (
            <>
              <div className="flex h-24 items-end gap-[3px]">
                {data.dailyTrend.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t bg-amber-400"
                    style={{ height: `${Math.max(6, (d.count / maxDayCount) * 100)}%` }}
                    title={`${d.date} · ${d.count} drift`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>{data.dailyTrend[0]?.date}</span>
                <span>{data.dailyTrend[data.dailyTrend.length - 1]?.date}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* 明细 */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          Drift 明细 ({data.entries.length})
        </h2>
        {data.entries.length === 0 ? (
          <div className="rounded-md bg-emerald-50 p-4 text-[12.5px] text-emerald-800">
            ✅ 尚无 OKR drift 记录. 这可能意味着:
            <ul className="ml-4 mt-1 list-disc">
              <li>所有 Persona / CompanyBrain 输出都对齐了公司 OKR (好);</li>
              <li>或者 B-015 检测刚启用, 还没积累数据 (等待 1-7 天);</li>
              <li>或者公司还没有 active 公司层 Objective (去 /okr 设置).</li>
            </ul>
          </div>
        ) : (
          <ul className="divide-y">
            {data.entries.map((e) => (
              <li key={e.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-700">
                        {SOURCE_LABEL[e.source ?? ''] ?? e.source ?? '?'}
                      </span>
                      <span>·</span>
                      <span>{new Date(e.timestamp).toLocaleString('zh-CN')}</span>
                      <span>·</span>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        actor {e.actorId}
                      </span>
                      <span>·</span>
                      <span className="text-rose-600">
                        分 {(e.alignmentScore ?? 0).toFixed(3)} / {e.okrCount ?? 0} OKR
                      </span>
                    </div>
                    {e.intentPreview && (
                      <p className="mt-1 text-[12.5px] italic text-slate-700">
                        “{e.intentPreview}”
                      </p>
                    )}
                    {e.topHits && e.topHits.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.topHits.slice(0, 3).map((h, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600"
                          >
                            {h.keyResultTitle ?? h.objectiveTitle} ·{' '}
                            <span className="font-mono">{(h.similarity ?? 0).toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="pt-2 text-center text-[10.5px] text-slate-400">
        §B-015 (OKR-DRIVEN-ARCHITECTURE.md · §三第2条) · 灵魂层第 2 条 整体能力提升 + 约束聚焦
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'amber' | 'rose' | 'indigo';
}) {
  const c = {
    amber: 'bg-amber-50/50 text-amber-900 ring-amber-200',
    rose: 'bg-rose-50/50 text-rose-900 ring-rose-200',
    indigo: 'bg-indigo-50/50 text-indigo-900 ring-indigo-200',
  }[tone];
  return (
    <div className={`rounded-xl p-4 ring-1 ${c}`}>
      <div className="text-[10.5px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 truncate text-[10.5px] opacity-60" title={hint}>
        {hint}
      </div>
    </div>
  );
}
