import { Megaphone, Sparkles } from 'lucide-react';

/**
 * /admin/intranet — Intranet 内容管理 (公告/政策/大事记/福利)
 * Spec: docs/PRODUCT-DEFINITION.md §3.6
 * Status: Placeholder · M3 上线
 */
export default function IntranetAdminPage() {
  return (
    <div className="page-container section-y">
      <div className="max-w-2xl mx-auto card-elevated p-12 text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 mb-6">
          <Megaphone className="h-8 w-8" />
        </div>
        <h1 className="text-title-2 text-ink-primary">Intranet 内容管理</h1>
        <p className="mt-3 text-body text-ink-secondary">
          4 类内容: 公告 / 政策 / 大事记 / 福利 · 政策强制已读 + AI 摘要 + 版本管理 · CEO 周记 + 匿名意见箱
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-caption text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5" />
          M3 上线
        </div>
      </div>
    </div>
  );
}
