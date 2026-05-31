'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenInner />
    </Suspense>
  );
}

function ForbiddenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const from = search.get('from') ?? '';

  return (
    <main className="min-h-screen flex items-center justify-center bg-[rgb(var(--surface-1))] px-4 md:px-6">
      <div className="surface-card rounded-3xl shadow-soft-lg max-w-md w-full p-6 md:p-8 text-center space-y-4 md:space-y-5">
        <div className="mx-auto h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-[rgb(var(--brand-50))] flex items-center justify-center">
          <ShieldOff className="h-6 w-6 md:h-7 md:w-7 text-[rgb(var(--brand-600))]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-title-3 md:text-title-2 text-primary">无权进入该板块</h1>
          <p className="text-body text-secondary">
            你当前的身份没有访问该路径的权限。
          </p>
          {from && (
            <p className="text-caption text-tertiary break-all">
              尝试访问: <code className="font-mono">{from}</code>
            </p>
          )}
          <p className="text-caption text-tertiary pt-2">
            外部协作者默认不可进入「事半」板块 (OKR / 绩效 / 复盘 / 一对一 / 360)。
            <br />
            如需访问, 请联系企业管理员调整角色或重新发邀请。
          </p>
        </div>

        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-border px-4 py-2 text-caption text-ink-secondary hover:bg-surface-2 hover:text-ink-primary inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回上一页
          </button>
          <Link
            href="/"
            className="rheem-btn-pill text-caption"
          >
            回到首页
          </Link>
        </div>
      </div>
    </main>
  );
}
