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

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [personalCreds, setPersonalCreds] = useState<PersonalCreds | null>(null);
  const [credsLoading, setCredsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({
    smtpHost: 'smtphz.qiye.163.com',
    smtpPort: '465',
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    imapHost: '',
    imapPort: '993',
    imapSecure: true,
    imapUser: '',
    imapPass: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showImapPass, setShowImapPass] = useState(false);

  useEffect(() => {
    fetch('/api/mail/status', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));

    fetch('/api/mail/credentials', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setPersonalCreds(data);
        if (data.configured && data.smtp) {
          setForm((prev) => ({
            ...prev,
            smtpHost: data.smtp.host,
            smtpPort: String(data.smtp.port),
            smtpSecure: data.smtp.secure,
            smtpUser: data.smtp.user,
            smtpPass: '',
            ...(data.imap ? {
              imapHost: data.imap.host,
              imapPort: String(data.imap.port),
              imapSecure: data.imap.secure,
              imapUser: data.imap.user,
              imapPass: '',
            } : {}),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCredsLoading(false));
  }, []);

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
      setPersonalCreds({
        configured: true,
        smtp: { host: form.smtpHost, port: Number(form.smtpPort), secure: form.smtpSecure, user: form.smtpUser },
        imap: form.imapHost ? { host: form.imapHost, port: Number(form.imapPort), secure: form.imapSecure, user: form.imapUser } : undefined,
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
      setForm((prev) => ({
        ...prev,
        smtpHost: '', smtpPort: '465', smtpSecure: true, smtpUser: '', smtpPass: '',
        imapHost: '', imapPort: '993', imapSecure: true, imapUser: '', imapPass: '',
      }));
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
            {/* SMTP 发件 */}
            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary uppercase tracking-wide">SMTP 发件（必填）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote text-ink-tertiary">SMTP 主机</label>
                  <input
                    className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    placeholder="smtp.qq.com"
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-footnote text-ink-tertiary">端口</label>
                    <input
                      className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                      placeholder="465"
                      value={form.smtpPort}
                      onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-caption text-ink-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.smtpSecure}
                        onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                        className="rounded border-border"
                      />
                      SSL
                    </label>
                  </div>
                </div>
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
            </div>

            {/* IMAP 收件 (可选) */}
            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary uppercase tracking-wide">IMAP 收件（可选，V2 后续启用）</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote text-ink-tertiary">IMAP 主机</label>
                  <input
                    className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    placeholder="imap.qq.com"
                    value={form.imapHost}
                    onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-footnote text-ink-tertiary">端口</label>
                    <input
                      className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                      placeholder="993"
                      value={form.imapPort}
                      onChange={(e) => setForm({ ...form, imapPort: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-caption text-ink-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.imapSecure}
                        onChange={(e) => setForm({ ...form, imapSecure: e.target.checked })}
                        className="rounded border-border"
                      />
                      SSL
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">IMAP 用户名</label>
                  <input
                    className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    placeholder="your@email.com"
                    value={form.imapUser}
                    onChange={(e) => setForm({ ...form, imapUser: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">IMAP 密码</label>
                  <div className="relative">
                    <input
                      className="w-full mt-1 rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 pr-10 text-caption"
                      type={showImapPass ? 'text' : 'password'}
                      placeholder={personalCreds?.configured ? '留空则不修改' : '邮箱密码或授权码'}
                      value={form.imapPass}
                      onChange={(e) => setForm({ ...form, imapPass: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
                      onClick={() => setShowImapPass(!showImapPass)}
                    >
                      {showImapPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.smtpHost || !form.smtpUser}
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-footnote font-medium text-ink-secondary hover:text-red-600 hover:border-red-200 disabled:opacity-50 surface-interactive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除凭据
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

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