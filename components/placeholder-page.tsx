/**
 * PlaceholderPage · P0 IA 落位用的通用 stub 页组件
 *
 * 用途: 三柱体系新增的 nav 入口需要"点开不 404"; 后续各 Phase 落地时
 * 各自的 page.tsx 会替换为真实组件.
 *
 * 不是为了好看, 是为了**让 IA 重排能立刻发布**, 给员工传达三柱清晰边界.
 */

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export interface PlaceholderPageProps {
  /** 主图标, lucide-react 组件 */
  icon: LucideIcon;
  /** 页面主标题 */
  title: string;
  /** 副标题 (一句话定位, 可含 emoji) */
  subtitle?: string;
  /** 来源/关联模块 (例: "拿捏 · 学习中心") */
  pillar?: string;
  /** 当前 Phase 标签 (例: "P2 MVP · 即将上线") */
  phase?: string;
  /** 关键能力点 (3-5 条) */
  features?: string[];
  /** 关联文档路径 (相对 /docs/, 不含 .md) */
  relatedDoc?: string;
  /** 可选: 跳转到现有功能的 fallback 入口 */
  fallback?: { label: string; href: string };
}

export function PlaceholderPage({
  icon: Icon,
  title,
  subtitle,
  pillar,
  phase = 'P0 IA 占位 · 实施中',
  features,
  relatedDoc,
  fallback,
}: PlaceholderPageProps) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 p-10">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1">
            {pillar && (
              <p className="mb-1 text-footnote font-medium uppercase tracking-wider text-slate-500">
                {pillar}
              </p>
            )}
            <h1 className="text-title-3 font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning">
              <Sparkles className="h-3 w-3" />
              {phase}
            </p>
          </div>
        </div>

        {features && features.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="mb-3 text-caption font-semibold text-slate-900">即将提供的能力</h2>
            <ul className="space-y-2 text-caption text-slate-700">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 text-caption">
          {fallback && (
            <Link
              href={fallback.href}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
            >
              {fallback.label}
            </Link>
          )}
          {relatedDoc && (
            <span className="text-footnote text-slate-500">
              设计稿: <code className="rounded bg-slate-100 px-1.5 py-0.5">docs/{relatedDoc}.md</code>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
