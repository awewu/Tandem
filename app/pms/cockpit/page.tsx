/**
 * PMS · 老板驾驶舱 (销售 + 财务视角 · 异常即时暴露)
 * 顶部问题清单 (按严重度红/黄/灰排序, 可点击直达) + 销售/财务 KPI + 项目阶段漏斗。
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gauge, AlertTriangle, AlertCircle, Info, TrendingUp, Wallet, Trophy, XCircle, FileWarning, RefreshCw } from 'lucide-react';

interface Exception {
  id: string; severity: 'critical' | 'warning' | 'info'; category: 'sales' | 'finance';
  type: string; title: string; detail: string; amount?: number; href?: string;
}
interface FunnelRow { stage: string; label: string; count: number; value: number }
interface DimRow { key: string; count: number; pipeline: number; won: number; wonCount: number; lostCount: number; winRate: number }
interface DimAnalysis { dimension: string; label: string; rows: DimRow[] }
type Scope = 'company' | 'mine' | 'org';
interface Cockpit {
  generatedAt: string;
  scope: Scope;
  exceptions: Exception[];
  counts: { critical: number; warning: number; info: number };
  sales: { activeProjects: number; totalPipeline: number; wonAmount: number; winRate: number; lostCount: number; lostValue: number };
  finance: { pendingContracts: number; pendingContractAmount: number; targetGaps: number };
  projectFunnel: FunnelRow[];
  dimensions: DimAnalysis[];
}

const money = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN');

const SEV_STYLE: Record<string, { cls: string; icon: JSX.Element; label: string }> = {
  critical: { cls: 'border-danger/40 bg-danger/5', icon: <AlertCircle className="w-4 h-4 text-danger" />, label: '严重' },
  warning: { cls: 'border-warning/40 bg-warning/5', icon: <AlertTriangle className="w-4 h-4 text-warning" />, label: '警告' },
  info: { cls: 'border-border bg-surface-2', icon: <Info className="w-4 h-4 text-ink-tertiary" />, label: '提示' },
};

// CHARTER-UI-V2 §2.2: 每类预警的“下一步动作” (动词开头)
const NEXT_ACTION: Record<string, string> = {
  stalled_project: '立即安排回访, 推进到下一阶段',
  tender_deadline: '组织标书评审, 确保按时提交',
  spec_at_risk: '联系设计方, 推动备选位升级为设计基准',
  chain_gap: '补齐缺失的关键决策人触点',
  target_gap: '制定补差计划, 聚焦高胜率管道',
  contract_pending: '催办审批, 释放挂单金额',
  dim_concentration: '拓展新客户, 降低单一客户依赖',
  dim_winrate: '复盘该维度打法, 调整策略',
};

function nextActionOf(type: string): string {
  return NEXT_ACTION[type] ?? '查看详情并处理';
}

export default function PmsCockpitPage() {
  const router = useRouter();
  const [data, setData] = useState<Cockpit | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sales' | 'finance'>('all');

  const load = useCallback(async () => {
    try {
      setStatus('loading');
      const res = await fetch('/api/pms/cockpit', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const json = await res.json();
      setData(json.cockpit);
      setStatus('ok');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" /></div>;
  }
  if (status === 'error' || !data) {
    return <div className="container mx-auto max-w-3xl p-6"><Card className="border-danger/30"><CardContent className="p-6 text-danger">{err}</CardContent></Card></div>;
  }

  const showFinance = data.scope !== 'mine';
  const exceptions = data.exceptions.filter((e) => filter === 'all' || e.category === filter);
  const maxFunnel = Math.max(1, ...data.projectFunnel.map((f) => f.count));
  const SCOPE_META: Record<Scope, { title: string; sub: string }> = {
    company: { title: '老板驾驶舱', sub: '全公司 · 销售+财务视角 — 问题即时暴露 (management by exception)' },
    mine: { title: '我的项目预警', sub: '仅我负责的项目 — 停滞/招标/spec风险/决策链缺口即时提醒' },
    org: { title: '经销商驾驶舱', sub: '本经销商范围 · 销售+财务视角 — 问题即时暴露' },
  };
  const meta = SCOPE_META[data.scope];

  // CHARTER-UI-V2 §2.1: 结论先行 — 找出最重要的一件事
  const topException =
    data.exceptions.find((e) => e.severity === 'critical') ??
    data.exceptions.find((e) => e.severity === 'warning') ??
    null;

  return (
    <div className="container mx-auto md:max-w-5xl p-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Gauge className="w-6 h-6 text-brand-500" /> {meta.title}
          </h1>
          <p className="text-body text-ink-secondary mt-1">{meta.sub}</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> 刷新</Button>
      </div>

      {/* CHARTER-UI-V2 §2.1 结论横幅 (BLUF) */}
      {topException ? (
        <div
          className={`mb-6 rounded-2xl border p-5 ${topException.severity === 'critical' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5'} ${topException.href ? 'cursor-pointer hover:shadow-soft-sm' : ''}`}
          onClick={() => topException.href && router.push(topException.href)}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{SEV_STYLE[topException.severity].icon}</span>
            <div className="min-w-0">
              <p className={`text-caption font-medium ${topException.severity === 'critical' ? 'text-danger' : 'text-warning'}`}>
                {data.counts.critical > 0 ? `${data.counts.critical} 个严重问题待处理` : `${data.counts.warning} 个问题需关注`}
                {' · 最紧急：'}
              </p>
              <p className="text-headline font-semibold text-ink-primary mt-1">{topException.title}</p>
              <p className="text-caption text-ink-secondary mt-1">{topException.detail}</p>
              <p className="text-caption text-brand-500 font-medium mt-2">→ 下一步：{nextActionOf(topException.type)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-success/30 bg-success/5 p-5">
          <p className="text-headline font-semibold text-ink-primary">✓ 暂无紧急问题，一切正常</p>
          <p className="text-caption text-ink-secondary mt-1">
            加权管道 {money(data.sales.totalPipeline)} · 赢单率 {data.sales.winRate}% · 活跃项目 {data.sales.activeProjects} 个。保持推进。
          </p>
        </div>
      )}

      {/* 异常概览计数 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-4">
          <p className="text-caption text-ink-tertiary">严重</p>
          <p className="text-title-lg font-bold text-danger mt-1">{data.counts.critical}</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="text-caption text-ink-tertiary">警告</p>
          <p className="text-title-lg font-bold text-warning mt-1">{data.counts.warning}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="text-caption text-ink-tertiary">提示</p>
          <p className="text-title-lg font-bold text-ink-primary mt-1">{data.counts.info}</p>
        </div>
      </div>

      {/* 问题清单 */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-brand-500" /> 待处理问题 ({exceptions.length})</CardTitle>
          <div className="flex items-center gap-1">
            {(['all', 'sales', ...(showFinance ? ['finance' as const] : [])] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className={filter === f ? 'bg-brand-500 hover:bg-brand-600 h-7' : 'h-7'} onClick={() => setFilter(f)}>
                {f === 'all' ? '全部' : f === 'sales' ? '销售' : '财务'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {exceptions.length === 0 ? (
            <p className="text-caption text-ink-tertiary py-4 text-center">当前无待处理问题 — 一切正常</p>
          ) : (
            <div className="grid gap-2">
              {exceptions.map((e) => {
                const s = SEV_STYLE[e.severity];
                return (
                  <div key={e.id} className={`flex items-start justify-between gap-3 rounded-md border p-3 ${s.cls} ${e.href ? 'cursor-pointer hover:shadow-soft-sm' : ''}`}
                    onClick={() => e.href && router.push(e.href)}>
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 shrink-0">{s.icon}</span>
                      <div className="min-w-0">
                        <p className="text-caption font-medium text-ink-primary">{e.title}</p>
                        <p className="text-caption text-ink-tertiary mt-0.5">{e.detail}</p>
                        <p className="text-caption text-brand-500 mt-1">→ {nextActionOf(e.type)}</p>
                      </div>
                    </div>
                    <span className="text-caption rounded px-1.5 py-0.5 bg-surface-1 text-ink-secondary shrink-0">{e.category === 'sales' ? '销售' : '财务'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 销售 KPI */}
      <h2 className="text-headline font-semibold text-ink-primary mb-3">销售视角</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi icon={<TrendingUp className="w-5 h-5" />} label="活跃项目" value={String(data.sales.activeProjects)} />
        <Kpi icon={<Wallet className="w-5 h-5" />} label="加权管道" value={money(data.sales.totalPipeline)} />
        <Kpi icon={<Trophy className="w-5 h-5" />} label="赢单率" value={`${data.sales.winRate}%`} sub={`赢单额 ${money(data.sales.wonAmount)}`} />
        <Kpi icon={<XCircle className="w-5 h-5" />} label="丢标" value={String(data.sales.lostCount)} sub={money(data.sales.lostValue)} accent="danger" />
      </div>

      {/* 财务 KPI (个人"我的"视角不含公司财务) */}
      {showFinance && (
        <>
          <h2 className="text-headline font-semibold text-ink-primary mb-3">财务视角</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Kpi icon={<FileWarning className="w-5 h-5" />} label="合同待审批" value={String(data.finance.pendingContracts)} sub={money(data.finance.pendingContractAmount)} accent={data.finance.pendingContracts > 0 ? 'warning' : undefined} />
            <Kpi icon={<AlertTriangle className="w-5 h-5" />} label="业绩缺口目标" value={String(data.finance.targetGaps)} accent={data.finance.targetGaps > 0 ? 'warning' : undefined} />
            <Kpi icon={<Wallet className="w-5 h-5" />} label="赢单金额" value={money(data.sales.wonAmount)} />
          </div>
        </>
      )}

      {/* 项目阶段漏斗 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">工程项目阶段漏斗</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.projectFunnel.every((f) => f.count === 0) ? (
            <p className="text-caption text-ink-tertiary">暂无项目数据</p>
          ) : data.projectFunnel.map((f) => (
            <div key={f.stage}>
              <div className="flex justify-between text-caption text-ink-secondary mb-1">
                <span>{f.label}</span>
                <span>{f.count} 个 · {money(f.value)}</span>
              </div>
              <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
            </div>
          ))}
          {(data.sales.lostCount > 0) && (
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-caption text-danger">
                <span>丢标流失</span>
                <span>{data.sales.lostCount} 个 · {money(data.sales.lostValue)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data.dimensions.length > 0 && <DimensionSection dimensions={data.dimensions} />}
    </div>
  );
}

function DimensionSection({ dimensions }: { dimensions: DimAnalysis[] }) {
  const [active, setActive] = useState(dimensions[0]?.dimension ?? '');
  const dim = dimensions.find((d) => d.dimension === active) ?? dimensions[0];
  if (!dim) return null;
  const maxPipe = Math.max(1, ...dim.rows.map((r) => r.pipeline));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">多维分析预警</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          {dimensions.map((d) => (
            <button
              key={d.dimension}
              onClick={() => setActive(d.dimension)}
              className={`px-3 py-1 rounded-full text-caption transition-colors ${
                d.dimension === (dim.dimension)
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {dim.rows.length === 0 ? (
          <p className="text-caption text-ink-tertiary">暂无{dim.label}维度数据</p>
        ) : dim.rows.map((r) => (
          <div key={r.key}>
            <div className="flex justify-between text-caption text-ink-secondary mb-1">
              <span className="truncate max-w-[55%]" title={r.key}>{r.key}</span>
              <span>
                {money(r.pipeline)} 管道 · 赢单率 <span className={r.winRate >= 0.5 ? 'text-success' : r.winRate === 0 && r.lostCount > 0 ? 'text-danger' : 'text-ink-secondary'}>{Math.round(r.winRate * 100)}%</span>
              </span>
            </div>
            <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(r.pipeline / maxPipe) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: JSX.Element; label: string; value: string; sub?: string; accent?: 'danger' | 'warning' }) {
  const valueCls = accent === 'danger' ? 'text-danger' : accent === 'warning' ? 'text-warning' : 'text-ink-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-ink-tertiary mb-2">{icon}<span className="text-caption">{label}</span></div>
        <p className={`text-title-lg font-bold ${valueCls}`}>{value}</p>
        {sub && <p className="text-caption text-ink-tertiary mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
