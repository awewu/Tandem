'use client';

/**
 * PMS · 报价单列表 + 新建
 *
 * 新建需绑定一条持保护期的报备 (opportunityId)。列表按经销商可见范围返回。
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote } from '@/lib/types/pms';

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  issued: '已签发',
  accepted: '已接受',
  superseded: '已被替代',
  expired: '已过期',
  revoked: '已作废',
};

function money(n: number): string {
  return `¥${(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

export default function QuotesListPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [oppId, setOppId] = useState('');
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch('/api/pms/quotes?limit=100', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return setStatus('error');
      const d = await r.json();
      setQuotes(d.quotes ?? []);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    // 从商机详情跳转带入 ?opp=<id>&customer=<name> 预填新建表单
    try {
      const sp = new URLSearchParams(window.location.search);
      const opp = sp.get('opp');
      const customer = sp.get('customer');
      if (opp) setOppId(opp);
      if (customer) setCustomerName(customer);
    } catch {
      /* SSR 安全: window 不可用时忽略 */
    }
  }, [load]);

  async function create() {
    if (!oppId.trim() || !title.trim()) {
      setErr('请填写报备 ID 和方案标题');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/pms/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunityId: oppId.trim(), title: title.trim(), customerName: customerName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '创建失败');
      router.push(`/pms/quotes/${d.quote.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-headline font-semibold text-ink-primary">官方报价单</h1>
      <p className="mb-5 text-caption text-ink-tertiary">
        绑定报备生成官方背书报价 → 签发获唯一验真码 → 客户扫码验真, 恶意低价失效。
      </p>

      {/* 新建 */}
      <div className="mb-6 rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 text-caption font-semibold text-ink-primary">新建报价</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={oppId} onChange={(e) => setOppId(e.target.value)} placeholder="报备 ID (opportunityId)" className="rounded-lg border border-border px-3 py-2 text-caption" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="方案标题" className="rounded-lg border border-border px-3 py-2 text-caption" />
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="客户名 (可空, 默认取报备)" className="rounded-lg border border-border px-3 py-2 text-caption" />
        </div>
        {err && <div className="mt-2 text-caption text-danger">{err}</div>}
        <button onClick={create} disabled={busy} className="mt-3 rounded-lg bg-info/80 px-4 py-2 text-caption font-medium text-white hover:bg-info/70 disabled:opacity-50">
          {busy ? '创建中…' : '创建并编辑'}
        </button>
      </div>

      {/* 列表 */}
      {status === 'loading' && <div className="text-ink-tertiary">加载中…</div>}
      {status === 'error' && <div className="text-danger">加载失败</div>}
      {status === 'ok' && (
        <div className="rounded-2xl border border-border bg-white">
          {quotes.length === 0 ? (
            <div className="p-8 text-center text-caption text-ink-tertiary">暂无报价单</div>
          ) : (
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border text-left text-footnote text-ink-tertiary">
                  <th className="px-4 py-2">标题</th>
                  <th className="px-4 py-2">客户</th>
                  <th className="px-4 py-2 text-right">总价</th>
                  <th className="px-4 py-2">版本</th>
                  <th className="px-4 py-2">状态</th>
                  <th className="px-4 py-2">验真码</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="cursor-pointer border-b border-border hover:bg-surface-2" onClick={() => router.push(`/pms/quotes/${q.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-ink-primary">{q.title}</td>
                    <td className="px-4 py-2.5 text-ink-secondary">{q.customerName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-secondary">{money(q.totals.total)}</td>
                    <td className="px-4 py-2.5 text-ink-tertiary">v{q.version}</td>
                    <td className="px-4 py-2.5 text-ink-secondary">{STATUS_LABEL[q.status] ?? q.status}</td>
                    <td className="px-4 py-2.5 font-mono text-footnote text-ink-tertiary">{q.verifyCode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
