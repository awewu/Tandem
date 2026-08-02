/**
 * /privacy · 公开访问的隐私政策渲染页
 *
 * 优先读取管理后台保存到数据库的 Markdown 文档.
 * 不需登录, 注册流程可直接 link 到这里.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { boot } from '@/lib/boot';
import { getEffectivePrivacyPolicy } from '@/lib/legal/privacy-policy';
import { PrivacyPrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  await boot();
  const policy = await getEffectivePrivacyPolicy();
  const updatedAt = policy.updatedAt
    ? new Date(policy.updatedAt).toLocaleString('zh-CN', { hour12: false })
    : null;

  return (
    <main className="min-h-screen bg-surface-2 px-3 py-4 print:bg-white print:p-0 sm:px-6 sm:py-8">
      <div className="mx-auto mb-4 flex w-full max-w-[920px] items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="truncate text-headline font-bold text-ink-primary">{policy.title}</h1>
          <p className="mt-0.5 text-footnote text-ink-tertiary">
            {updatedAt ? `最近更新: ${updatedAt}` : '公开政策文档'}
          </p>
        </div>
        <PrivacyPrintButton />
      </div>

      <article className="mx-auto min-h-[calc(100dvh-96px)] w-full max-w-[920px] rounded-md bg-surface-1 px-5 py-7 shadow-soft-lg print:min-h-0 print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none sm:px-10 sm:py-10">
        <div className="prose prose-slate max-w-none prose-sm prose-headings:text-ink-primary prose-p:text-ink-secondary prose-table:text-caption md:prose-base">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{policy.contentMarkdown}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
