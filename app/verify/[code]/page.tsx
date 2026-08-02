'use client';

/**
 * 报价单公开验真页 (零登录)
 *
 * 客户扫码/输码 → 查真伪 + 授权经销商 (不露价)。
 * 恶意低价的报价在此"查无此报价"或授权方≠转发方 → 当场失效。
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface VerifyView {
  valid: boolean;
  status: string;
  quoteTitle?: string;
  customerName?: string;
  authorizedDealerName?: string;
  issuedAt?: string;
  validUntil?: string;
  verifyCode: string;
  message?: string;
}

const STATUS_LABEL: Record<string, string> = {
  issued: '有效',
  expired: '已过期',
  revoked: '已作废',
  superseded: '已有新版',
  draft: '未签发',
  accepted: '客户已接受',
};

function fmt(dt?: string): string {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('zh-CN');
  } catch {
    return dt;
  }
}

export default function QuoteVerifyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code as string) || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [view, setView] = useState<VerifyView | null>(null);
  const [input, setInput] = useState(code);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/pms/quotes/verify/${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setView(data);
        setState('ok');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const valid = view?.valid === true;

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col items-center px-4 py-6 md:py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-headline font-semibold text-ink-primary">报价单验真</div>
          <div className="text-footnote text-ink-tertiary mt-1">瑞合瑞德 · 官方背书报价查验</div>
        </div>

        {/* 验真码手动查询 */}
        <form
          className="flex gap-2 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            const c = input.trim().toUpperCase();
            if (c) router.push(`/verify/${encodeURIComponent(c)}`);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入验真码 XXXX-XXXX-XXXX"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-caption tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-info"
          />
          <button type="submit" className="rounded-lg bg-info/80 px-4 py-2 text-caption font-medium text-white hover:bg-info/70">
            查验
          </button>
        </form>

        {state === 'loading' && (
          <div className="rounded-2xl bg-white p-8 text-center text-ink-tertiary shadow-soft-sm">查验中…</div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl bg-white p-8 text-center text-ink-tertiary shadow-soft-sm">网络异常, 请稍后重试</div>
        )}

        {state === 'ok' && view && (
          <div className="rounded-2xl bg-white p-6 shadow-soft-sm">
            {/* 真伪大标识 */}
            <div className="flex flex-col items-center py-4">
              <div
                className={
                  'flex h-16 w-16 items-center justify-center rounded-full text-title-2 ' +
                  (valid ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger')
                }
              >
                {valid ? '✓' : '✕'}
              </div>
              <div className={'mt-3 text-headline font-bold ' + (valid ? 'text-success' : 'text-danger')}>
                {valid ? '公司官方报价 · 真实有效' : '非有效官方报价'}
              </div>
              {view.message && <div className="mt-1 text-caption text-ink-tertiary">{view.message}</div>}
              {!valid && (
                <div className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-footnote text-warning">
                  提示: 请仅以公司系统签发的官方报价为准; 系统外转发的报价不具备公司背书。
                </div>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-100 border-t border-border text-caption">
              <Row label="授权经销商" value={view.authorizedDealerName || '—'} strong />
              <Row label="状态" value={STATUS_LABEL[view.status] || view.status} />
              <Row label="报价名称" value={view.quoteTitle || '—'} />
              <Row label="客户" value={view.customerName || '—'} />
              <Row label="签发日期" value={fmt(view.issuedAt)} />
              <Row label="有效期至" value={fmt(view.validUntil)} />
              <Row label="验真码" value={view.verifyCode} />
            </div>

            <div className="mt-5 text-center text-[11px] text-ink-tertiary">
              本页仅查验真实性与授权关系, 具体报价内容以经销商提供的报价单为准。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-ink-tertiary">{label}</span>
      <span className={strong ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}>{value}</span>
    </div>
  );
}
