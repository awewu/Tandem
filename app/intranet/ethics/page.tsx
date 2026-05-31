'use client';

/**
 * /intranet/ethics — 廉洁举报 stub.
 * 不可追溯的匿名通道占位. V1 仅 UI; M3 接加密通道 + Steward 工作流.
 */

import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Lock, Mail } from 'lucide-react';

export default function EthicsPage() {
  return (
    <div className="page-container py-10 max-w-3xl space-y-8 md:py-10">
      <Link
        href="/intranet"
        className="inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回公司动态
      </Link>

      <header className="space-y-2">
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">ETHICS</p>
        <h1 className="text-title-1 text-ink-primary inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-warning/10 text-warning">
            <ShieldAlert className="h-4 w-4" />
          </span>
          廉洁举报
        </h1>
        <p className="text-body text-ink-secondary">
          不可追溯通道 · Steward 接收 · 平均 72h 内回执 · 反报复保护条款
        </p>
      </header>

      <section className="card-elevated p-5 border-l-4 border-l-warning bg-warning/5">
        <h2 className="text-headline text-ink-primary inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-warning" />
          隐私保证
        </h2>
        <ul className="mt-3 space-y-1.5 text-caption text-ink-secondary list-disc pl-5">
          <li>投递记录加密存储 · 仅 Steward 可解密</li>
          <li>不记录 IP / User-Agent / 时间戳精度仅到天</li>
          <li>禁止任何下游对投递人进行画像或追溯</li>
          <li>反报复条款: 一旦发现报复行为, 涉事方记入红线档案</li>
        </ul>
      </section>

      <section className="card-elevated p-5 space-y-4">
        <h2 className="text-headline text-ink-primary">投递通道</h2>
        <p className="text-caption text-ink-secondary">
          V1 阶段为占位 UI. M3 接入加密通道后启用真实投递.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-footnote text-ink-tertiary mb-1.5 block">类别</span>
            <select
              disabled
              className="w-full rounded-md border border-border bg-surface-2/50 px-3 py-2 text-caption text-ink-primary disabled:cursor-not-allowed"
            >
              <option>合规违规</option>
              <option>财务舞弊</option>
              <option>骚扰 / 歧视</option>
              <option>利益冲突</option>
              <option>其他</option>
            </select>
          </label>
          <label className="block">
            <span className="text-footnote text-ink-tertiary mb-1.5 block">详情</span>
            <textarea
              rows={5}
              disabled
              placeholder="V1 占位 · M3 接通后可使用 ..."
              className="w-full rounded-md border border-border bg-surface-2/50 p-3 text-caption text-ink-primary placeholder:text-ink-tertiary disabled:cursor-not-allowed"
            />
          </label>
          <button
            type="button"
            disabled
            className="rheem-btn-pill w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            投递 (V1 占位)
          </button>
        </div>
      </section>

      <section className="card-elevated p-4 bg-surface-2/40">
        <p className="text-caption text-ink-secondary inline-flex items-center gap-2">
          <Mail className="h-4 w-4 text-ink-tertiary shrink-0" />
          应急离线通道:{' '}
          <code className="font-mono text-[12px] bg-white px-1.5 py-0.5 rounded">
            ethics@&lt;your-tenant&gt;
          </code>{' '}
          (V1 暂未配置)
        </p>
      </section>

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · M3 接 EthicsCase 表 + Steward 工作流 + 加密邮件通道后启用.
      </p>
    </div>
  );
}
