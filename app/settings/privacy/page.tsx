'use client';

import { Download, UserMinus, ShieldAlert, Lock } from 'lucide-react';
import { useState } from 'react';

/**
 * /settings/privacy — §13 数据自助 (导出 + 离职匿名化申请)
 * Spec: docs/PRODUCT-DEFINITION.md §3.x · 4 项员工尊严铁律
 * Endpoints: GET /api/me/export · POST /api/admin/users/[id]/anonymize
 * Status: Live · 调用已实现的 API
 */
export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch('/api/me/export', { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tandem-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page-container section-y md:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-title-2 text-ink-primary">数据自助 · §13 员工尊严</h1>
          <p className="mt-2 text-body text-ink-secondary">
            宪章 §13 承诺: 数据归公司, 但 4 项员工尊严铁律不可绕过. 你随时可以行使下面的权利.
          </p>
        </header>

        {/* 导出 */}
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-brand-50 text-brand-600 p-3">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-headline text-ink-primary">导出我的全部数据</h2>
              <p className="mt-1 text-caption text-ink-secondary">
                下载 JSON 包: 个人资料 + Persona 进化 + 我发起的议事 + IM 消息 + Memory 提议 + 最近认证日志.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-caption font-medium shadow-soft-sm surface-interactive disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? '正在打包...' : '立即导出'}
              </button>
              {exportError && (
                <p className="mt-2 text-footnote text-danger">{exportError}</p>
              )}
            </div>
          </div>
        </div>

        {/* 匿名化 */}
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-warning/10 text-warning p-3">
              <UserMinus className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-headline text-ink-primary">离职匿名化申请</h2>
              <p className="mt-1 text-caption text-ink-secondary">
                离职时可申请匿名化: 邮箱/姓名脱敏 · Persona 学习停止 · 通讯示例清空 · 全 session 撤销.
                由 admin 在你离职日触发, 不可由你自己执行 (操作审计要求).
              </p>
              <p className="mt-3 text-footnote text-ink-tertiary">
                联系 HR 或直属上级提交申请.
              </p>
            </div>
          </div>
        </div>

        {/* 否决权 + 拒签 (说明性) */}
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-info/10 text-info p-3">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-headline text-ink-primary">否决权 + 拒绝代笔</h2>
              <ul className="mt-2 space-y-1.5 text-caption text-ink-secondary list-disc list-inside">
                <li>AI 代行任何决策, 24h 内你可随时否决撤回</li>
                <li>红区议题 (薪资 / 法律 / 投诉) — AI 永远拒绝代你写</li>
                <li>所有 AI 代行均带水印 isProxy=true, 在 IM 和议事室可见</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 链接到登录管理 */}
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-ink-tertiary/10 text-ink-secondary p-3">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-headline text-ink-primary">账号安全</h2>
              <p className="mt-1 text-caption text-ink-secondary">
                密码修改 · MFA TOTP · 会话管理 · 等保二级合规
              </p>
              <a
                href="/settings"
                className="mt-3 inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
              >
                前往账号设置 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
