/**
 * /admin/usage · 使用 + AI 成本看板
 *
 * §SELF-USE-FIRST priority #2 + B-005
 *
 * 看到:
 *   - 7/30 天内总事件数 / 活跃用户 / LLM 调用次数 / 总成本
 *   - Top 10 事件 / Top 10 活跃用户 / 每日时序
 *   - LLM 各 provider 维度 (calls / tokens / cost / latency / fail rate)
 *   - LLM 各 scenario 维度 (谁烧钱多)
 *   - 最近失败原因
 */
'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  days: number;
  since: string;
  totals: {
    totalEvents: number;
    activeUsers: number;
    totalLlmCalls: number;
    totalCostMicroUsd: number;
    totalCostUsd: number;
  };
  usage: {
    topEvents: Array<{ eventName: string; cnt: number }>;
    topUsers: Array<{ userId: string; cnt: number }>;
    dailyEvents: Array<{ day: string; cnt: number }>;
  };
  llm: {
    byProvider: Array<{
      provider: string;
      calls: number;
      tokens_in: number;
      tokens_out: number;
      cost_micro_usd: number;
      avg_latency_ms: number;
      failures: number;
    }>;
    byScenario: Array<{ scenario: string; calls: number; total_tokens: number; cost_micro_usd: number }>;
    daily: Array<{ day: string; calls: number; cost_micro_usd: number }>;
    failures: Array<{ errorMessage: string; cnt: number }>;
  };
}

function fmtUsd(microUsd: number | string | null | undefined): string {
  const n = Number(microUsd ?? 0) / 10_000;
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 1) return '$' + n.toFixed(3);
  return '$' + n.toFixed(2);
}

function fmtNum(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString();
}

export default function UsagePage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/admin/usage?days=${days}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">使用 + AI 成本看板</h1>
          <p className="text-sm text-zinc-500 mt-1">
            §SELF-USE-FIRST 数据飞轮 · 同事真实使用 + LLM 成本中心可见
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm bg-white dark:bg-zinc-900"
        >
          <option value={1}>最近 1 天</option>
          <option value={7}>最近 7 天</option>
          <option value={30}>最近 30 天</option>
          <option value={90}>最近 90 天</option>
        </select>
      </div>

      {loading && <div className="text-sm text-zinc-500">加载中...</div>}
      {err && <div className="text-sm text-red-600">错误: {err}</div>}

      {data && (
        <>
          {/* 总览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="总事件数" value={fmtNum(data.totals.totalEvents)} />
            <KpiCard label="活跃用户" value={fmtNum(data.totals.activeUsers)} />
            <KpiCard label="LLM 调用次数" value={fmtNum(data.totals.totalLlmCalls)} />
            <KpiCard label="LLM 总成本 (估)" value={`$${data.totals.totalCostUsd.toFixed(2)}`} />
          </div>

          {/* 两栏: 使用 vs LLM */}
          <div className="grid md:grid-cols-2 gap-6">
            <Section title="Top 10 事件">
              <Table
                headers={['事件名', '次数']}
                rows={data.usage.topEvents.map((r) => [r.eventName, fmtNum(r.cnt)])}
              />
            </Section>
            <Section title="Top 10 活跃用户">
              <Table
                headers={['用户 ID', '事件数']}
                rows={data.usage.topUsers.map((r) => [r.userId, fmtNum(r.cnt)])}
              />
            </Section>
          </div>

          <Section title="LLM 各 Provider 维度">
            <Table
              headers={['Provider', '调用', 'Tokens In', 'Tokens Out', '成本估算', '平均延迟', '失败']}
              rows={data.llm.byProvider.map((r) => [
                r.provider,
                fmtNum(r.calls),
                fmtNum(r.tokens_in),
                fmtNum(r.tokens_out),
                fmtUsd(r.cost_micro_usd),
                `${fmtNum(r.avg_latency_ms)}ms`,
                fmtNum(r.failures),
              ])}
            />
          </Section>

          <Section title="LLM 各 Scenario 维度 (按成本降序)">
            <Table
              headers={['场景', '调用', 'Total Tokens', '成本估算']}
              rows={data.llm.byScenario.map((r) => [
                r.scenario,
                fmtNum(r.calls),
                fmtNum(r.total_tokens),
                fmtUsd(r.cost_micro_usd),
              ])}
            />
          </Section>

          {data.llm.failures.length > 0 && (
            <Section title="LLM 最近失败原因">
              <Table
                headers={['错误信息', '次数']}
                rows={data.llm.failures.map((r) => [r.errorMessage ?? '(unknown)', fmtNum(r.cnt)])}
              />
            </Section>
          )}

          <Section title={`每日事件趋势 (最近 ${days} 天)`}>
            <Table
              headers={['日期', '事件数', 'LLM 调用']}
              rows={data.usage.dailyEvents.map((r) => {
                const llm = data.llm.daily.find((d) => d.day === r.day);
                return [r.day, fmtNum(r.cnt), llm ? `${fmtNum(llm.calls)} (${fmtUsd(llm.cost_micro_usd)})` : '0'];
              })}
            />
          </Section>

          <div className="text-xs text-zinc-400 pt-4 border-t">
            <div>数据起始: {new Date(data.since).toLocaleString('zh-CN')}</div>
            <div>提示: 成本是按 lib/analytics/track.ts 内置 pricing 表估算, 真实账单以 provider 后台为准.</div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <div className="text-sm text-zinc-400">暂无数据</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 px-3 font-medium text-zinc-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="py-2 px-3 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
