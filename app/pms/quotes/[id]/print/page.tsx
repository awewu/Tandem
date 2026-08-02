'use client';

/**
 * PMS · 报价单可打印/导出文档 (VI 排版 + 分项 BOQ 表 + 验真二维码)
 *
 * 打印隔离: @media print 只显 .print-doc, 隐藏 AppShell chrome。
 * 导出 PDF = 浏览器原生"打印 → 另存为 PDF"。
 * 已签发单显验真码 + 二维码 (客户零登录验真, 不露价页在 /verify)。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { recomputeQuote } from '@/lib/pms/quote-calc';
import type { Quote, QuoteCostType } from '@/lib/types/pms';

const COST_TYPE_LABEL: Record<QuoteCostType, string> = {
  equipment: '设备',
  material: '辅材',
  installation: '安装',
  freight: '运输',
  tax: '税费',
  service: '服务',
  other: '其他',
};
const COST_TYPES = Object.keys(COST_TYPE_LABEL) as QuoteCostType[];

function money(n: number): string {
  return `¥${(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  issued: '已签发',
  accepted: '已接受',
  superseded: '已被替代',
  expired: '已过期',
  revoked: '已作废',
};

export default function QuotePrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [dealerName, setDealerName] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch(`/api/pms/quotes/${id}`, { credentials: 'include', cache: 'no-store' });
      if (r.status === 404) return setStatus('notfound');
      if (!r.ok) return setStatus('error');
      const { quote: q } = await r.json();
      setQuote(q);
      setStatus('ok');
      // 验真码存在 → 从公开验真接口拿授权经销商名 + 生成二维码
      if (q?.verifyCode) {
        fetch(`/api/pms/quotes/verify/${q.verifyCode}`, { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((d) => { if (d?.authorizedDealerName) setDealerName(d.authorizedDealerName); })
          .catch(() => { /* 不阻断文档渲染 */ });
      }
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!quote?.verifyCode) return;
    const full = typeof window !== 'undefined' ? `${window.location.origin}/verify/${quote.verifyCode}` : `/verify/${quote.verifyCode}`;
    let alive = true;
    import('qrcode')
      .then((m) => {
        const toDataURL = (m as { toDataURL?: typeof import('qrcode').toDataURL }).toDataURL
          ?? (m as { default: typeof import('qrcode') }).default.toDataURL;
        return toDataURL(full, { width: 132, margin: 1, errorCorrectionLevel: 'M' });
      })
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { /* QR 失败仍显文本码 */ });
    return () => { alive = false; };
  }, [quote?.verifyCode]);

  const computed = useMemo(() => recomputeQuote(quote?.systems ?? []), [quote?.systems]);
  const totals = computed.totals;

  if (status === 'loading') return <div className="p-8 text-ink-tertiary">加载中…</div>;
  if (status === 'notfound') return <div className="p-8 text-ink-tertiary">报价不存在或无权限</div>;
  if (status === 'error' || !quote) return <div className="p-8 text-danger">加载失败</div>;

  return (
    <div className="min-h-screen bg-surface-3 py-4 md:py-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-doc, .print-doc * { visibility: visible !important; }
          .print-doc { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      {/* 工具条 (不打印) */}
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <button onClick={() => router.push(`/pms/quotes/${id}`)} className="rounded-lg border border-border bg-white px-3 py-2 text-caption text-ink-secondary hover:bg-surface-2">
          ← 返回编辑
        </button>
        <button onClick={() => window.print()} className="rounded-lg bg-info/80 px-4 py-2 text-caption font-medium text-white hover:bg-info/70">
          打印 / 导出 PDF
        </button>
      </div>

      {/* 文档主体 */}
      <div className="print-doc mx-auto max-w-[820px] bg-white px-10 py-8 text-ink-primary shadow-soft-sm">
        {/* 抬头 */}
        <div className="flex items-start justify-between border-b-2 border-border pb-4">
          <div>
            <div className="text-title-3 font-bold tracking-tight">{quote.title}</div>
            <div className="mt-1 text-caption text-ink-tertiary">
              报价单号 {quote.id.slice(0, 12).toUpperCase()} · 版本 v{quote.version} · {STATUS_LABEL[quote.status] ?? quote.status}
            </div>
          </div>
          <div className="text-right text-footnote text-ink-tertiary">
            <div>生成日期 {new Date().toLocaleDateString('zh-CN')}</div>
            {quote.validUntil && <div className="mt-0.5">有效期至 {quote.validUntil.slice(0, 10)}</div>}
          </div>
        </div>

        {/* 客户 / 授权 双栏 */}
        <div className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 text-footnote font-semibold uppercase tracking-wide text-ink-tertiary">客户</div>
            <div className="text-caption font-medium text-ink-primary">{quote.customerName}</div>
            {quote.customerContact && <div className="mt-0.5 text-caption text-ink-secondary">{quote.customerContact}</div>}
            {quote.scenario && <div className="mt-0.5 text-caption text-ink-secondary">应用场景: {quote.scenario}</div>}
          </div>
          <div className="text-right">
            <div className="mb-1 text-footnote font-semibold uppercase tracking-wide text-ink-tertiary">授权供应</div>
            <div className="text-caption font-medium text-ink-primary">{dealerName || '授权经销商'}</div>
            {quote.verifyCode && quote.status === 'issued' ? (
              <div className="mt-2 flex items-center justify-end gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-ink-tertiary">扫码验真 (官方背书)</div>
                  <div className="font-mono text-caption font-bold tracking-wider text-ink-primary">{quote.verifyCode}</div>
                </div>
                {qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="验真二维码" className="h-20 w-20 rounded border border-border" />
                )}
              </div>
            ) : (
              <div className="mt-1 text-footnote text-ink-tertiary">（草稿 · 签发后生成验真码）</div>
            )}
          </div>
        </div>

        {/* 系统 + 明细 */}
        <div className="mt-6 space-y-5">
          {computed.systems.map((sys, si) => (
            <div key={sys.id}>
              <div className="flex items-baseline justify-between border-b border-border pb-1">
                <div className="text-caption font-semibold text-ink-primary">{si + 1}. {sys.name}</div>
                <div className="text-caption text-ink-secondary">小计 {money(sys.subtotal)}</div>
              </div>
              {sys.description && <div className="mt-1 text-footnote text-ink-tertiary">{sys.description}</div>}
              <table className="mt-2 w-full border-collapse text-footnote">
                <thead>
                  <tr className="border-b border-border text-left text-ink-tertiary">
                    <th className="py-1.5 pr-2 font-medium">类型</th>
                    <th className="py-1.5 pr-2 font-medium">型号 / 项目</th>
                    <th className="py-1.5 pr-2 font-medium">规格</th>
                    <th className="py-1.5 pr-2 text-center font-medium">单位</th>
                    <th className="py-1.5 pr-2 text-right font-medium">数量</th>
                    <th className="py-1.5 pr-2 text-right font-medium">单价</th>
                    <th className="py-1.5 text-right font-medium">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {sys.items.map((it) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="py-1.5 pr-2 text-ink-tertiary">{COST_TYPE_LABEL[it.costType]}</td>
                      <td className="py-1.5 pr-2 text-ink-primary">{it.model || '—'}</td>
                      <td className="py-1.5 pr-2 text-ink-secondary">{it.specification || '—'}</td>
                      <td className="py-1.5 pr-2 text-center text-ink-secondary">{it.unit || '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-ink-secondary">{it.quantity}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-ink-secondary">{money(it.unitPrice)}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium text-ink-primary">{money(it.amount)}</td>
                    </tr>
                  ))}
                  {sys.items.length === 0 && (
                    <tr><td colSpan={7} className="py-2 text-center text-ink-tertiary">无明细</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* 分项汇总 + 总价 */}
        <div className="mt-6 border-t-2 border-border pt-3">
          <div className="grid grid-cols-4 gap-x-6 gap-y-1 text-footnote">
            {COST_TYPES.filter((c) => totals[c] > 0).map((c) => (
              <div key={c} className="flex justify-between">
                <span className="text-ink-tertiary">{COST_TYPE_LABEL[c]}</span>
                <span className="tabular-nums text-ink-secondary">{money(totals[c])}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-end gap-4">
            <span className="text-caption text-ink-tertiary">方案总价 ({quote.currency})</span>
            <span className="text-title-3 font-bold tabular-nums text-ink-primary">{money(totals.total)}</span>
          </div>
        </div>

        {/* 商务条款 */}
        {quote.terms && (quote.terms.included || quote.terms.excluded || quote.terms.warranty || quote.terms.payment || quote.terms.note) && (
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-2 text-caption font-semibold text-ink-primary">商务条款</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-footnote text-ink-secondary">
              {quote.terms.included && <TermLine label="含项" value={quote.terms.included} />}
              {quote.terms.excluded && <TermLine label="不含项" value={quote.terms.excluded} />}
              {quote.terms.warranty && <TermLine label="质保/售后" value={quote.terms.warranty} />}
              {quote.terms.payment && <TermLine label="付款方式" value={quote.terms.payment} />}
              {quote.terms.note && <TermLine label="其他说明" value={quote.terms.note} />}
            </div>
          </div>
        )}

        {/* 页脚 */}
        <div className="mt-8 border-t border-border pt-3 text-center text-[10px] text-ink-tertiary">
          {quote.verifyCode && quote.status === 'issued'
            ? '本报价单由厂家系统签发, 客户可扫码或访问验真链接核验真伪与授权经销商 (仅显真伪, 不露价)。'
            : '本文档为报价草稿, 未经正式签发, 不构成官方背书。'}
        </div>
      </div>
    </div>
  );
}

function TermLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-ink-tertiary">{label}: </span>
      <span className="whitespace-pre-wrap text-ink-secondary">{value}</span>
    </div>
  );
}
