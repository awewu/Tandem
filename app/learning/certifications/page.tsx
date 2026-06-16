'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollText, CheckCircle2, AlertTriangle, Clock3, ArrowLeft, Loader2 } from 'lucide-react';
import type { Certification } from '@/lib/learning/types';

interface CertWithLesson extends Certification {
  lessonTitle?: string;
}

export default function CertificationsPage() {
  const [certs, setCerts] = useState<CertWithLesson[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/learning/certifications', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const list: CertWithLesson[] = j.certifications ?? [];
        setCerts(list);
        setStatus(list.length === 0 ? 'empty' : 'ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  const now = Date.now();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 space-y-5">
      <Link href="/learning" className="inline-flex items-center gap-1 text-caption text-ink-secondary hover:text-ink-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回学习中心
      </Link>

      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <ScrollText className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          我的认证
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
          已获得的能力凭证 · 时效跟踪
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载认证…
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> 加载失败，请刷新重试
        </div>
      )}

      {status === 'empty' && (
        <div className="surface-card p-10 text-center space-y-2">
          <ScrollText className="mx-auto h-10 w-10 text-ink-tertiary" />
          <p className="text-caption text-ink-secondary">暂无认证记录</p>
          <p className="text-footnote text-ink-tertiary">完成必修课程后将自动颁发认证</p>
          <Link href="/learning" className="mt-2 inline-block text-caption text-brand-500 underline">
            前往学习中心
          </Link>
        </div>
      )}

      {status === 'ok' && (
        <div className="space-y-3">
          {certs.map((cert) => {
            const expired = cert.expiresAt && new Date(cert.expiresAt).getTime() < now;
            const nearExpiry = cert.expiresAt && !expired &&
              new Date(cert.expiresAt).getTime() - now < 7 * 86400 * 1000;
            return (
              <div key={cert.id} className="surface-card flex items-start gap-4 p-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${expired ? 'bg-danger/10' : 'bg-success/10'}`}>
                  {expired
                    ? <AlertTriangle className="h-4 w-4 text-danger" />
                    : <CheckCircle2 className="h-5 w-5 text-success" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium text-ink-primary truncate">
                    {cert.lessonTitle ?? cert.lessonId}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-footnote text-ink-tertiary">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      获得于 {new Date(cert.earnedAt).toLocaleDateString('zh-CN')}
                    </span>
                    {cert.expiresAt && (
                      <span className={`flex items-center gap-1 ${expired ? 'text-danger' : nearExpiry ? 'text-warning' : ''}`}>
                        <Clock3 className="h-3 w-3" />
                        {expired ? '已过期' : `有效至 ${new Date(cert.expiresAt).toLocaleDateString('zh-CN')}`}
                      </span>
                    )}
                    {!cert.expiresAt && (
                      <span className="text-success">长期有效</span>
                    )}
                  </div>
                </div>
                {expired && (
                  <Link href="/learning/compliance" className="shrink-0 rounded-md bg-danger px-3 py-1.5 text-footnote font-medium text-white hover:opacity-80">
                    续修
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
