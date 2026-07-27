'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, ExternalLink, FileText, Loader2, Save } from 'lucide-react';

interface PolicyPayload {
  policy: {
    id: string;
    title: string;
    contentMarkdown: string;
    source: 'database' | 'remote' | 'local' | 'empty';
    updatedAt?: string;
  };
}

const SOURCE_LABEL: Record<PolicyPayload['policy']['source'], string> = {
  database: '数据库',
  remote: '外部 Markdown 兜底',
  local: '本地内置文档',
  empty: '暂无内容',
};

function formatDate(value?: string): string {
  if (!value) return '尚未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function AdminLegalPage() {
  const [title, setTitle] = useState('隐私政策');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [source, setSource] = useState<PolicyPayload['policy']['source']>('empty');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/legal/privacy-policy', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as Partial<PolicyPayload> & { error?: string };
        if (!res.ok || !data.policy) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data.policy;
      })
      .then((policy) => {
        if (cancelled) return;
        setTitle(policy.title || '隐私政策');
        setContentMarkdown(policy.contentMarkdown || '');
        setSource(policy.source);
        setUpdatedAt(policy.updatedAt);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wordCount = useMemo(() => contentMarkdown.trim().length, [contentMarkdown]);

  async function save() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin/legal/privacy-policy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contentMarkdown }),
      });
      const data = (await res.json()) as Partial<PolicyPayload> & { error?: string };
      if (!res.ok || !data.policy) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTitle(data.policy.title);
      setContentMarkdown(data.policy.contentMarkdown);
      setSource('database');
      setUpdatedAt(data.policy.updatedAt);
      setStatus('saved');
      window.setTimeout(() => setStatus('ready'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-caption text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载隐私政策...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-footnote font-medium text-brand-600">
            <FileText className="h-4 w-4" />
            管理后台 / 法务文档
          </div>
          <h1 className="text-title-3 font-bold text-ink-primary">隐私政策</h1>
          <p className="mt-1 max-w-2xl text-caption text-muted-foreground">
            这里保存的内容会直接用于 Tandem 和搭子手抄 APP 的登录、注册、隐私政策入口。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/privacy"
            target="_blank"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-hairline bg-surface-1 px-4 text-caption font-medium text-ink-primary hover:bg-surface-2"
          >
            <ExternalLink className="h-4 w-4" />
            查看公开页
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={status === 'saving' || !contentMarkdown.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-caption font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {status === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === 'saved' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {status === 'saving' ? '保存中...' : status === 'saved' ? '已保存' : '保存并发布'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-caption text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="当前来源" value={SOURCE_LABEL[source]} />
        <SummaryTile label="最近保存" value={formatDate(updatedAt)} />
        <SummaryTile label="Markdown 字符数" value={String(wordCount)} />
      </section>

      <section className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
        <div className="rounded-lg border border-hairline bg-surface-1 p-4">
          <label className="mb-1 block text-footnote font-medium text-ink-secondary">标题</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mb-4 h-10 w-full rounded-md border border-hairline bg-white px-3 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <label className="mb-1 block text-footnote font-medium text-ink-secondary">正文 Markdown</label>
          <textarea
            value={contentMarkdown}
            onChange={(event) => setContentMarkdown(event.target.value)}
            className="h-[520px] w-full resize-none rounded-md border border-hairline bg-white px-3 py-2 font-mono text-[13px] leading-6 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="# 隐私政策&#10;&#10;请在这里编辑正式内容。"
          />
        </div>

        <div className="rounded-lg border border-hairline bg-surface-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-caption font-semibold text-ink-primary">发布预览</h2>
            <span className="rounded bg-surface-2 px-2 py-1 text-footnote text-muted-foreground">
              /privacy
            </span>
          </div>
          <article className="prose prose-slate max-w-none prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {contentMarkdown || '# 隐私政策\n\n请先填写正文内容。'}
            </ReactMarkdown>
          </article>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 px-4 py-3">
      <div className="text-footnote text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-caption font-semibold text-ink-primary">{value}</div>
    </div>
  );
}
