/**
 * /privacy · 公开访问的隐私政策渲染页
 *
 * 数据来自 docs/PRIVACY-POLICY.md (single source of truth).
 * 不需登录, 注册流程可直接 link 到这里.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static';
export const revalidate = 3600; // 每小时重生 (政策文件有更新就生效)

async function loadPrivacyPolicy(): Promise<string> {
  const filePath = path.join(process.cwd(), 'docs', 'PRIVACY-POLICY.md');
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '# 隐私政策\n\n隐私政策文件暂不可读, 请联系管理员.';
  }
}

export default async function PrivacyPage() {
  const md = await loadPrivacyPolicy();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10">
      <article className="mx-auto max-w-3xl px-6 py-8 prose prose-slate prose-sm md:prose-base">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </main>
  );
}
