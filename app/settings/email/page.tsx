'use client';

/**
 * /settings/email · 邮箱配置
 *
 * V1 范围只读: 显示当前 SMTP 出站状态 (env-driven)
 * V2:          用户级凭据表单 (SMTP 发件 + IMAP 收件), 加密存储
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
  Save,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MailStatus {
  configured: boolean;
  effective: { mode: 'personal' | 'global'; host: string; port: number; fromAddress: string } | null;
  personal: { host: string; port: number; user: string } | null;
  global: { host: string | null; port: number; fromAddress: string | null } | null;
  inbound: { configured: boolean; note?: string };
}

interface PersonalCreds {
  configured: boolean;
  smtp?: { host: string; port: number; secure: boolean; user: string };
  imap?: { host: string; port: number; secure: boolean; user: string };
  updatedAt?: string;
}

interface MailConfig {
  smtpHost: string;
  imapHost: string;
  smtpPort: number;
  imapPort: number;
  smtpSecure: boolean;
  imapSecure: boolean;
  isAdmin: boolean;
}

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [personalCreds, setPersonalCreds] = useState<PersonalCreds | null>(null);
  const [config, setConfig] = useState<MailConfig | null>(null);
  const [credsLoading, setCredsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({
    smtpUser: '',
    smtpPass: '',
    imapUser: '',
    imapPass: '',
  });
  const [showPass, setShowPass] = useState(false);

  // 管理员全局端口配置
  const [portForm, setPortForm] = useState({ smtpPort: '', imapPort: '' });
  const [portSaving, setPortSaving] = useState(false);

  useEffect(() => {
    fetch('/api/mail/status', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));

    fetch('/api/mail/config', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: MailConfig) => {
        setConfig(data);
        setPortForm({ smtpPort: String(data.smtpPort), imapPort: String(data.imapPort) });
      })
      .catch(() => {});

    fetch('/api/mail/credentials', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setPersonalCreds(data);
        if (data.configured && data.smtp) {
          setForm((prev) => ({
            ...prev,
            smtpUser: data.smtp.user,
            smtpPass: '',
            imapUser: data.imap?.user ?? '',
            imapPass: '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCredsLoading(false));
  }, []);

  async function handleSavePorts() {
    setPortSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mail/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(portForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: data.error ?? '端口保存失败' });
        return;
      }
      setConfig(data);
      setPortForm({ smtpPort: String(data.smtpPort), imapPort: String(data.imapPort) });
      setFeedback({ ok: true, msg: '全局端口配置已保存' });
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setPortSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mail/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: data.error ?? '保存失败' });
        return;
      }
      setFeedback({ ok: true, msg: '个人邮箱凭据已保存' });
      const imapUser = form.imapUser || form.smtpUser;
      setPersonalCreds({
        configured: true,
        smtp: config ? { host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, user: form.smtpUser } : undefined,
        imap: config ? { host: config.imapHost, port: config.imapPort, secure: config.imapSecure, user: imapUser } : undefined,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('确定要删除个人邮箱凭据吗？删除后将使用全局 SMTP 发件。')) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mail/credentials', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        setFeedback({ ok: false, msg: '删除失败' });
        return;
      }
      setFeedback({ ok: true, msg: '个人邮箱凭据已删除' });
      setPersonalCreds({ configured: false });
      setForm({ smtpUser: '', smtpPass: '', imapUser: '', imapPass: '' });
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

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
          绑定个人邮箱后，发件将以你的邮箱身份发送
        </p>
      </header>

      {feedback && (
        <div className={`rounded-md p-3 text-caption ${feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-warning/5 text-warning'}`}>
          {feedback.msg}
        </div>
      )}

      {/* 个人邮箱绑定 (V2) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline text-ink-primary flex items-center gap-2">
                <AtSign className="h-4 w-4" />
                个人邮箱绑定
              </h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                绑定后发件将使用你的个人邮箱，而非全局 SMTP
              </p>
            </div>
            {credsLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-footnote text-ink-tertiary">
                加载中...
              </span>
            ) : personalCreds?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-footnote font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已绑定 · {personalCreds.smtp?.user}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-footnote text-ink-tertiary">
                未绑定
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* 协议配置 (系统固定, 收发一并展示) */}
            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary uppercase tracking-wide">协议配置（系统固定）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote text-ink-tertiary">SMTP 发件主机</label>
                  <div className="w-full mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-caption text-ink-secondary">
                    {config?.smtpHost ?? 'smtphz.qiye.163.com'}
                  </div>
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">SMTP 端口 / SSL</label>
                  <div className="w-full mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-caption text-ink-secondary">
                    {config?.smtpPort ?? 465} · SSL 已启用
                  </div>
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">IMAP 收件主机</label>
                  <div className="w-full mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-caption text-ink-secondary">
                    {config?.imapHost ?? 'imaphz.qiye.163.com'}
                  </div>
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">IMAP 端口 / SSL</label>
                  <div className="w-full mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-caption text-ink-secondary">
                    {config?.imapPort ?? 993} · SSL 已启用
                  </div>
                </div>
              </div>
            </div>

            {/* 账号凭据 (收发共用一组) */}
            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary uppercase tracking-wide">账号凭据（收发共用）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote text-ink-tertiary">邮箱地址</label>
                  <input
                    className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    placeholder="your@email.com"
                    value={form.smtpUser}
                    onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">密码 / 授权码</label>
                  <div className="relative">
                    <input
                      className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 pr-10 text-caption"
                      type={showPass ? 'text' : 'password'}
                      placeholder={personalCreds?.configured ? '留空则不修改' : '邮箱密码或授权码'}
                      value={form.smtpPass}
                      onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-footnote text-ink-tertiary">同一账号同时用于 SMTP 发件与 IMAP 收件。</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.smtpUser}
                className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-600))] px-4 py-2 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-700))] disabled:opacity-50 disabled:cursor-not-allowed surface-interactive"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? '保存中...' : '保存凭据'}
              </button>
              {personalCreds?.configured && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-footnote font-medium text-ink-secondary hover:text-danger hover:border-danger disabled:opacity-50 surface-interactive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除凭据
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 全局端口配置 (管理员可改) */}
      {config?.isAdmin && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="text-headline text-ink-primary flex items-center gap-2">
                <Server className="h-4 w-4" />
                全局端口配置（管理员）
              </h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                主机固定为 {config.smtpHost} / {config.imapHost}，SSL 始终启用。此处仅调整全局端口，对所有用户生效。
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-footnote text-ink-tertiary">SMTP 端口</label>
                <input
                  className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                  type="number"
                  min={1}
                  max={65535}
                  placeholder="465"
                  value={portForm.smtpPort}
                  onChange={(e) => setPortForm({ ...portForm, smtpPort: e.target.value })}
                />
              </div>
              <div>
                <label className="text-footnote text-ink-tertiary">IMAP 端口</label>
                <input
                  className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                  type="number"
                  min={1}
                  max={65535}
                  placeholder="993"
                  value={portForm.imapPort}
                  onChange={(e) => setPortForm({ ...portForm, imapPort: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSavePorts}
                disabled={portSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-600))] px-4 py-2 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-700))] disabled:opacity-50 disabled:cursor-not-allowed surface-interactive"
              >
                <Save className="h-3.5 w-3.5" />
                {portSaving ? '保存中...' : '保存端口配置'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 全局 SMTP 状态 (只读) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline text-ink-primary flex items-center gap-2">
                <Server className="h-4 w-4" />
                全局 SMTP (系统级)
              </h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                管理员配置的系统级发件，未绑定个人邮箱时使用
              </p>
            </div>
            {status === null ? null : status.global?.host ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-footnote font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已配置
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning">
                <AlertCircle className="h-3.5 w-3.5" />
                未配置
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadField icon={Server} label="主机 / 端口" value={
              status?.global?.host
                ? `${status.global.host}:${status.global.port}`
                : '—'
            } />
            <ReadField icon={AtSign} label="发件地址" value={status?.global?.fromAddress ?? '—'} />
          </div>
        </CardContent>
      </Card>

      {/* 收件 IMAP (V2 后续) */}
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