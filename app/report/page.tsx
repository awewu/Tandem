import { Clock, Sparkles } from 'lucide-react';

/**
 * /report — 5 分钟极简日报 ↔ OKR 双向闭环
 * Spec: docs/PRODUCT-DEFINITION.md §3.1.3
 * Status: Placeholder · M2 上线 (week 5-8)
 */
export default function ReportPage() {
  return (
    <div className="page-container section-y">
      <div className="max-w-2xl mx-auto card-elevated p-12 text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 text-brand-600 mb-6">
          <Clock className="h-8 w-8" />
        </div>
        <h1 className="text-title-2 text-ink-primary">5 分钟极简日报</h1>
        <p className="mt-3 text-body text-ink-secondary">
          AI 预填 80% 内容 · AP 反向强推 · 5 分钟硬上限 · 自动算 KR 进度 (反虚报)
        </p>
        <div className="mt-8 inline-flex items-center gap-2 text-caption text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5" />
          M2 上线 · 第 5-8 周
        </div>
      </div>
    </div>
  );
}
