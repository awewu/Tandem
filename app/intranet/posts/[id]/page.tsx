'use client';

/**
 * /intranet/posts/[id] — 公司动态详情 (真 IntranetPost CMS).
 *
 * 读 GET /api/intranet/posts/[id]; 强制已读 (mandatoryRead) 文章显示
 * "我已知晓" 回执按钮 → POST .../read 写入 readBy.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Megaphone, FileLock, PartyPopper, Gift, Calendar, User, Loader2, CheckCircle2 } from 'lucide-react';
import type { IntranetPost } from '@/lib/types/intranet-post';
import { TYPE_TO_CATEGORY, CATEGORY_LABEL, fmtPublishDate, type IntranetCategory } from '@/lib/intranet/post-view';

const CAT_META: Record<
  IntranetCategory,
  { tone: string; icon: typeof Megaphone }
> = {
  announcement: { tone: 'bg-brand-50 text-brand-700',     icon: Megaphone },
  milestone:    { tone: 'bg-success/10 text-success',     icon: PartyPopper },
  policy:       { tone: 'bg-warning/10 text-warning',     icon: FileLock },
  welfare:      { tone: 'bg-info/10 text-info',           icon: Gift },
};

export default function IntranetPostPage() {
  const { id } = useParams() as { id: string };
  const [post, setPost] = useState<IntranetPost | null>(null);
  const [read, setRead] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    fetch(`/api/intranet/posts/${id}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        setPost(j.post as IntranetPost);
        setRead(Boolean(j.read));
        setStatus('ok');
      })
      .catch(() => setStatus('notfound'));
  }, [id]);

  async function ackRead() {
    if (acking) return;
    setAcking(true);
    try {
      const r = await fetch(`/api/intranet/posts/${id}/read`, { method: 'POST', credentials: 'include' });
      if (r.ok) setRead(true);
    } finally {
      setAcking(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="page-container py-10 max-w-3xl">
        <BackToIntranet />
        <div className="card-elevated mt-6 p-12 flex items-center justify-center text-ink-tertiary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载中…
        </div>
      </div>
    );
  }

  if (status === 'notfound' || !post) {
    return (
      <div className="page-container py-10 max-w-3xl md:py-10">
        <BackToIntranet />
        <div className="card-elevated mt-6 p-12 text-center">
          <p className="text-headline text-ink-primary">条目不存在或已下架</p>
          <p className="mt-2 text-caption text-ink-tertiary">
            id <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded">{id}</code> 未匹配已发布内容.
          </p>
        </div>
      </div>
    );
  }

  const cat = TYPE_TO_CATEGORY[post.type];
  const meta = CAT_META[cat];
  const Icon = meta.icon;

  return (
    <div className="page-container py-10 max-w-3xl">
      <BackToIntranet />

      <article className="mt-6 card-elevated p-8 space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
              <Icon className="h-3 w-3" />
              {CATEGORY_LABEL[cat]}
            </span>
            {post.mandatoryRead && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700">
                强制已读
              </span>
            )}
          </div>
          <h1 className="text-title-1 text-ink-primary leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-footnote text-ink-tertiary">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtPublishDate(post.publishedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.publishedBy}
            </span>
          </div>
        </header>

        <div className="border-t border-border pt-6">
          <p className="text-body text-ink-primary leading-relaxed whitespace-pre-wrap">
            {post.body}
          </p>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-footnote text-ink-tertiary">#{t}</span>
            ))}
          </div>
        )}

        {post.mandatoryRead && (
          <div className="border-t border-border pt-4">
            {read ? (
              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> 你已确认知晓本条政策
              </span>
            ) : (
              <button
                type="button"
                onClick={ackRead}
                disabled={acking}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-caption font-medium text-white hover:bg-rose-700 disabled:opacity-50 surface-interactive"
              >
                <CheckCircle2 className="h-4 w-4" /> {acking ? '提交中…' : '我已知晓'}
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

function BackToIntranet() {
  return (
    <Link
      href="/intranet"
      className="inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      返回公司动态
    </Link>
  );
}
