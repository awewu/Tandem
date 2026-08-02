'use client';

/**
 * PMS · 报价定价洞察 (内部管理只读)
 *
 * 事后洞察: 全量已签发报价的跨报价同侪比较 → 破限价 / 异常低价预警清单 + 分产品价格区间。
 * 经销商自由报价不阻断, 异常在此显影供管理复盘 (management by exception)。
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Anomaly {
  quoteId: string;
  dealerOrgId: string;
  productKey: string;
  productLabel: string;
  unitPrice: number;
  peerMedian: number;
  peerCount: number;
  floor?: number;
  type: 'below_floor' | 'low_outlier';
  severity: 'warning' | 'critical';
  detail: string;
}
interface ProductStat {
  productKey: string;
  productLabel: string;
  count: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  floor?: number;
}
interface Report {
  generatedAt: string;
  quoteCount: number;
  productStats: ProductStat[];
  anomalies: Anomaly[];
}

const money = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const TYPE_LABEL: Record<string, string> = { below_floor: '破最低限价', low_outlier: '异常低价' };

export default function QuoteInsightsPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch('/api/pms/quote-insights', { credentials: 'include', cache: 'no-store' });
      if (r.status === 403) return setStatus('forbidden');
      if (!r.ok) {
        setErr((await r.json().catch(() => ({})))?.error || '加载失败');
        return setStatus('error');
      }
      setReport((await r.json()).report);
      setStatus('ok');
    } catch (e) {
      setErr((e as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <div className="p-8 text-slate-500">加载中…</div>;
  if (status === 'forbidden') return <div className="p-8 text-slate-500">定价洞察仅内部管理角色可见。</div>;
  if (status === 'error' || !report) return <div className="p-8 text-red-500">{err || '加载失败'}</div>;

  const critical = report.anomalies.filter((a) => a.severity === 'critical');
  const warning = report.anomalies.filter((a) => a.severity === 'warning');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">报价定价洞察</h1>
          <p className="mt-1 text-sm text-slate-500">
            全量已签发报价 {report.quoteCount} 份 · 事后同侪比较 — 经销商自由报价不阻断, 异常在此显影供管理复盘。
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          刷新
        </button>
      </div>

      {/* 概览 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="严重 (破限价/极低)" value={critical.length} tone="danger" />
        <StatCard label="警告 (低于同侪)" value={warning.length} tone="warning" />
        <StatCard label="纳入分析产品" value={report.productStats.length} tone="neutral" />
      </div>

      {/* 异常清单 */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">异常预警清单</div>
        {report.anomalies.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">未发现异常低价 — 定价健康</div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {report.anomalies.map((a, i) => (
              <li
                key={i}
                onClick={() => router.push(`/pms/quotes/${a.quoteId}`)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {a.productLabel}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${a.type === 'below_floor' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      {TYPE_LABEL[a.type]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{a.detail} · 经销商 {a.dealerOrgId} · 同侪 {a.peerCount} 份</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-slate-800">{money(a.unitPrice)}</div>
                  <div className="text-xs text-slate-400">中位 {money(a.peerMedian)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 分产品价格区间 */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">分产品价格区间</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-2">产品</th>
                <th className="px-4 py-2 text-right">报价份数</th>
                <th className="px-4 py-2 text-right">最低</th>
                <th className="px-4 py-2 text-right">中位</th>
                <th className="px-4 py-2 text-right">最高</th>
                <th className="px-4 py-2 text-right">限价</th>
              </tr>
            </thead>
            <tbody>
              {report.productStats.map((s) => (
                <tr key={s.productKey} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-800">{s.productLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{s.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{money(s.min)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800">{money(s.median)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{money(s.max)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-400">{s.floor != null ? money(s.floor) : '—'}</td>
                </tr>
              ))}
              {report.productStats.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">暂无可分析的报价数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'neutral' }) {
  const toneCls = tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
