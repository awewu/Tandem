'use client';

/**
 * /settings/email · 邮箱配置
 *
 * V1 范围只读: 显示当前 SMTP 出站状态 (env-driven)
 * V2 计划:     用户级凭据表单 (IMAP+SMTP 双向), 加密存储 -> credential-vault
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Server,
  AtSign,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MailStatus {
  configured: boolean;
  outbound: { host: string | null; port: number | null; fromAddress: string | null };
  inbound: { configured: boolean; note?: string };
}

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  useEffect(() => {
    fetch('/api/mail/status', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <div className="page-container py-8 space-y-6">
      <header>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-caption text-ink-tertiary hover:text-ink-primary mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回设置
        </Link>
        <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
          <Mail className="h-6 w-6 text-[rgb(var(--brand-600))]" />
          邮箱配置
        </h1>
        <p className="mt-1 text-caption text-ink-tertiary">
          系统级出站 SMTP · 由管理员通过环境变量配置
        </p>
      </header>

      {/* Outbound status */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline text-ink-primary">出站 SMTP</h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                用于发送通知 / 邀请 / 系统邮件
              </p>
            </div>
            {status === null ? null : status.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-footnote font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-footnote font-medium text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                未配置
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadField icon={Server} label="主机 / 端口" value={
              status?.outbound.host
                ? `${status.outbound.host}:${status.outbound.port}`
                : '—'
            } />
            <ReadField icon={AtSign} label="发件地址" value={status?.outbound.fromAddress ?? '—'} />
          </div>

          {!status?.configured && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-caption text-amber-800 space-y-2">
              <p className="font-semibold">如何启用</p>
              <p>请管理员在 <code className="px-1 py-0.5 bg-amber-100 rounded">.env.local</code> 中设置以下变量后重启服务:</p>
              <pre className="text-footnote bg-white border border-amber-200 rounded p-2 overflow-x-auto">{`SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=noreply@your-domain.com
SMTP_PASS=<app-password>
SMTP_FROM=Tandem <noreply@your-domain.com>`}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inbound (V2 placeholder) */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline text-ink-primary flex items-center gap-2">
                <Lock className="h-4 w-4 text-ink-tertiary" />
                收件 IMAP (V2)
              </h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                通用 IMAP 收件 + 用户级账号. 加密存储于 credential-vault.
              </p>
            </div>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-footnote text-ink-tertiary font-mono">
              规划中
            </span>
          </div>
          <p className="text-caption text-ink-secondary">
            将支持: Gmail OAuth · Outlook OAuth · 任意 IMAP/SMTP 自托管邮箱.
            邮件入档为 ORIGIN 不可篡改 · @ 触发分身回信草稿.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-footnote text-ink-tertiary">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-caption font-mono text-ink-primary truncate">{value}</div>
    </div>
  );
}
