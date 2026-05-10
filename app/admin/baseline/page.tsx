import { ShieldCheck, Sparkles } from 'lucide-react';

/**
 * /admin/baseline — 公司基线 (Baseline) 配置
 * Spec: docs/PRODUCT-DEFINITION.md §3.4 (Baseline 中央 AI 强注入)
 * Status: Placeholder · M2 上线
 */
export default function BaselinePage() {
  return (
    <div className="page-container section-y">
      <div className="max-w-2xl mx-auto card-elevated p-12 text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 mb-6">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-title-2 text-ink-primary">Baseline 配置</h1>
        <p className="mt-3 text-body text-ink-secondary">
          公司价值观 / 红线 / 战略 OKR 等「宪法级」内容 · 中央 AI 拦截器强注入到所有个人 Persona 调用
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-caption text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5" />
          M2 上线
        </div>
      </div>
    </div>
  );
}
