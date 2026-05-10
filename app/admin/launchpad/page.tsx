import { LayoutGrid, Sparkles } from 'lucide-react';

/**
 * /admin/launchpad — Launchpad 跳板入口配置 (ERP/CRM/通讯/学习卡片)
 * Spec: docs/PRODUCT-DEFINITION.md §3.7
 * Status: Placeholder · M2 上线
 */
export default function LaunchpadAdminPage() {
  return (
    <div className="page-container section-y">
      <div className="max-w-2xl mx-auto card-elevated p-12 text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 mb-6">
          <LayoutGrid className="h-8 w-8" />
        </div>
        <h1 className="text-title-2 text-ink-primary">Launchpad 跳板配置</h1>
        <p className="mt-3 text-body text-ink-secondary">
          3 分类: 业务系统 (ERP/CRM) / 通讯 / 学习 · 卡片式 + SSO 一键 + 部门权限 + AI 今日推荐
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-caption text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5" />
          M2 上线
        </div>
      </div>
    </div>
  );
}
