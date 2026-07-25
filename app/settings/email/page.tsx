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
  Pencil,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  History,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

interface PersonalCreds {
  configured: boolean;
  smtp?: { host: string; port: number; secure: boolean; user: string };
  imap?: { host: string; port: number; secure: boolean; user: string };
  updatedAt?: string;
  verifiedAt?: string;
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

type EmailProvider = 'netease' | 'qq' | 'custom';

interface GlobalEmailConfig {
  id: string;
  name: string;
  provider: EmailProvider;
  domains: string[];
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  enabled: boolean;
  isDefault: boolean;
  hasPassword: boolean;
}

interface GlobalEmailForm {
  name: string;
  provider: EmailProvider;
  domains: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  enabled: boolean;
  isDefault: boolean;
}

const PROVIDER_PRESETS: Record<Exclude<EmailProvider, 'custom'>, Pick<GlobalEmailForm, 'name' | 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'imapHost' | 'imapPort' | 'imapSecure'>> = {
  netease: {
    name: '网易企业邮箱',
    smtpHost: 'smtphz.qiye.163.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imaphz.qiye.163.com',
    imapPort: '993',
    imapSecure: true,
  },
  qq: {
    name: 'QQ 邮箱',
    smtpHost: 'smtp.qq.com',
    smtpPort: '465',
    smtpSecure: true,
    imapHost: 'imap.qq.com',
    imapPort: '993',
    imapSecure: true,
  },
};

const NETEASE_LOGIN_URL = 'https://mail.qiye.163.com/static/login/';
const NETEASE_HISTORY_RANGE_HELP_URL = 'https://office.163.com/helpCenter/mail/d/1967411071057756161.html';
const NETEASE_PASSWORD_RESET_HELP_URL = 'https://qy.163.com/help/c56f84.html';

function newGlobalEmailForm(): GlobalEmailForm {
  return {
    provider: 'netease',
    domains: '',
    smtpUser: '',
    smtpPass: '',
    enabled: true,
    isDefault: false,
    ...PROVIDER_PRESETS.netease,
  };
}

function responseErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

export default function EmailSettingsPage() {
  const { user } = useCurrentUser();
  const [personalCreds, setPersonalCreds] = useState<PersonalCreds | null>(null);
  const [config, setConfig] = useState<MailConfig | null>(null);
  const [credsLoading, setCredsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ verifiedAt: string; calendarAutoSyncEnabled: boolean } | null>(null);

  const [form, setForm] = useState({
    smtpUser: '',
    smtpPass: '',
    imapUser: '',
    imapPass: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [globalConfigs, setGlobalConfigs] = useState<GlobalEmailConfig[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalEditorOpen, setGlobalEditorOpen] = useState(false);
  const [editingGlobalId, setEditingGlobalId] = useState<string | null>(null);
  const [globalForm, setGlobalForm] = useState<GlobalEmailForm>(newGlobalEmailForm);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [showGlobalPass, setShowGlobalPass] = useState(false);

  useEffect(() => {
    setPersonalCreds(null);
    setCredsLoading(true);
    setFeedback(null);
    setVerifyResult(null);
    setForm({ smtpUser: '', smtpPass: '', imapUser: '', imapPass: '' });

    fetch('/api/mail/config', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data: MailConfig) => setConfig(data))
      .catch(() => {});

    void refreshGlobalConfigs();

    fetch('/api/mail/credentials', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setPersonalCreds(data);
        if (data.configured && data.smtp) {
          setForm({
            smtpUser: data.smtp.user,
            smtpPass: '',
            imapUser: data.imap?.user ?? '',
            imapPass: '',
          });
        } else {
          setForm({ smtpUser: '', smtpPass: '', imapUser: '', imapPass: '' });
        }
      })
      .catch(() => {})
      .finally(() => setCredsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refreshGlobalConfigs() {
    try {
      const res = await fetch('/api/mail/global-configs', { credentials: 'include', cache: 'no-store' });
      if (res.status === 403) return;
      const data = await res.json();
      if (res.ok) setGlobalConfigs(data.configs ?? []);
    } catch {
      setGlobalConfigs([]);
    } finally {
      setGlobalLoading(false);
    }
  }

  function openNewGlobalConfig() {
    setEditingGlobalId(null);
    setGlobalForm({ ...newGlobalEmailForm(), isDefault: globalConfigs.length === 0 });
    setShowGlobalPass(false);
    setGlobalEditorOpen(true);
  }

  function openEditGlobalConfig(item: GlobalEmailConfig) {
    setEditingGlobalId(item.id);
    setGlobalForm({
      name: item.name,
      provider: item.provider,
      domains: item.domains.join(', '),
      smtpHost: item.smtpHost,
      smtpPort: String(item.smtpPort),
      smtpSecure: item.smtpSecure,
      smtpUser: item.smtpUser,
      smtpPass: '',
      imapHost: item.imapHost,
      imapPort: String(item.imapPort),
      imapSecure: item.imapSecure,
      enabled: item.enabled,
      isDefault: item.isDefault,
    });
    setShowGlobalPass(false);
    setGlobalEditorOpen(true);
  }

  function applyProviderPreset(provider: EmailProvider) {
    setGlobalForm((current) => provider === 'custom'
      ? { ...current, provider }
      : { ...current, provider, ...PROVIDER_PRESETS[provider] });
  }

  async function handleSaveGlobal(e: React.FormEvent) {
    e.preventDefault();
    setGlobalSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(editingGlobalId
        ? `/api/mail/global-configs/${editingGlobalId}`
        : '/api/mail/global-configs', {
        method: editingGlobalId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...globalForm,
          domains: globalForm.domains.split(/[,，;；\s]+/).filter(Boolean),
          smtpPort: Number(globalForm.smtpPort),
          imapPort: Number(globalForm.imapPort),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: responseErrorMessage(data, '全局邮箱配置保存失败') });
        return;
      }
      setGlobalEditorOpen(false);
      setFeedback({ ok: true, msg: editingGlobalId ? '全局邮箱配置已更新' : '全局邮箱配置已创建' });
      await refreshGlobalConfigs();
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setGlobalSaving(false);
    }
  }

  async function handleDeleteGlobal(item: GlobalEmailConfig) {
    if (!confirm(`确定要删除“${item.name}”吗？`)) return;
    setFeedback(null);
    try {
      const res = await fetch(`/api/mail/global-configs/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: responseErrorMessage(data, '全局邮箱配置删除失败') });
        return;
      }
      setFeedback({ ok: true, msg: '全局邮箱配置已删除' });
      await refreshGlobalConfigs();
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
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
        setFeedback({ ok: false, msg: responseErrorMessage(data, '保存失败') });
        return;
      }
      setFeedback({ ok: true, msg: '个人邮箱账号已验证并保存' });
      const imapUser = form.imapUser || form.smtpUser;
      setPersonalCreds({
        configured: true,
        smtp: config ? { host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, user: form.smtpUser } : undefined,
        imap: config ? { host: config.imapHost, port: config.imapPort, secure: config.imapSecure, user: imapUser } : undefined,
        updatedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
      });
      setForm((current) => ({ ...current, smtpPass: '', imapPass: '' }));
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setFeedback(null);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/mail/credentials/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: responseErrorMessage(data, '邮箱登录验证失败') });
        return;
      }
      setVerifyResult({
        verifiedAt: typeof data.verifiedAt === 'string' ? data.verifiedAt : new Date().toISOString(),
        calendarAutoSyncEnabled: data.calendarAutoSyncEnabled === true,
      });
      setFeedback({ ok: true, msg: '邮箱登录验证通过，IMAP 收件和 SMTP 发件均可用。' });
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message });
    } finally {
      setVerifying(false);
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
          绑定当前登录用户自己的公司邮箱，用于收信、发信和网易日程同步
        </p>
      </header>

      {feedback && (
        <div className={`rounded-md p-3 text-caption ${feedback.ok ? 'bg-success/10 text-success' : 'bg-warning/5 text-warning'}`}>
          {feedback.msg}
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-2">
              <h2 className="text-headline text-ink-primary">为什么这里要填账号和密码？</h2>
              <p className="text-caption leading-relaxed text-ink-secondary">
                收件箱和网易日程同步都需要系统代你连接公司邮箱服务，所以必须绑定当前登录用户自己的邮箱地址和邮箱密码。保存后用于 IMAP 收信、SMTP 发信和 CalDAV 日程同步。
              </p>
              <p className="text-footnote leading-relaxed text-ink-tertiary">
                切换账号后这里会按当前账号单独读取配置；未配置的账号应显示空白。按当前公司邮箱策略，先填写平时登录网易企业邮箱使用的账号和密码。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-headline text-ink-primary">邮箱登录验证</h2>
                <p className="mt-1 text-caption leading-relaxed text-ink-secondary">
                  验证当前账号能否通过网易企业邮箱的 IMAP 收件和 SMTP 发件服务。
                </p>
              </div>
            </div>
            <div className="mt-auto space-y-3">
              {verifyResult && (
                <p className="rounded-md bg-success/10 px-3 py-2 text-footnote text-success">
                  最近验证通过：{new Date(verifyResult.verifiedAt).toLocaleString('zh-CN')}
                  {verifyResult.calendarAutoSyncEnabled ? ' · 网易日程后台自动同步已开启' : ''}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={verifying || credsLoading || (!form.smtpUser && !personalCreds?.configured)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-50 surface-interactive"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                {verifying ? '验证中...' : '验证邮箱登录'}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-headline text-ink-primary">历史邮件同步范围</h2>
                <p className="mt-1 text-caption leading-relaxed text-ink-secondary">
                  网易企业邮箱默认只给客户端同步近 30 天邮件。需要稳定查询历史邮件时，请在网易网页端把客户端收取范围设置为全部或指定起始时间。
                </p>
              </div>
            </div>
            <a
              href={NETEASE_HISTORY_RANGE_HELP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
            >
              查看网易说明
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-headline text-ink-primary">找回密码引导</h2>
                <p className="mt-1 text-caption leading-relaxed text-ink-secondary">
                  已开启自助重置时，可在网易登录页点“忘记密码”。未开启时，需要联系企业邮箱管理员重置，管理员账号通常是 admin@公司域名。
                </p>
              </div>
            </div>
            <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <a
                href={NETEASE_LOGIN_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
              >
                去网易登录页
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={NETEASE_PASSWORD_RESET_HELP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
              >
                查看找回说明
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-footnote font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {personalCreds.verifiedAt ? '已验证' : '已绑定'} · {personalCreds.smtp?.user}
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
              <div className="space-y-2">
                <p className="text-footnote text-ink-tertiary">
                  同一账号同时用于 SMTP 发件与 IMAP 收件。系统会先验证账号和密码/授权码，验证通过后才保存。
                </p>
                <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-footnote leading-relaxed text-ink-secondary">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p>
                      忘记授权码时，请先到网易企业邮箱网页端按提示重新生成客户端授权码；如果忘记邮箱登录密码，请联系企业邮箱管理员重置。完成后再回到这里验证并保存。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={verifying || !form.smtpUser}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-50 surface-interactive"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                {verifying ? '验证中...' : '仅验证登录'}
              </button>
              <button
                type="submit"
                disabled={saving || !form.smtpUser}
                className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-600))] px-4 py-2 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-700))] disabled:opacity-50 disabled:cursor-not-allowed surface-interactive"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? '验证中...' : '验证并保存'}
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

      {/* 租户级全局邮箱配置 (管理员 CRUD) */}
      {config?.isAdmin && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-headline text-ink-primary flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  全局邮箱配置
                </h2>
                <p className="mt-0.5 text-caption text-ink-tertiary">
                  按发件人邮箱域名匹配；未匹配时使用默认配置
                </p>
              </div>
              <button
                type="button"
                onClick={openNewGlobalConfig}
                className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-600))] px-3 py-2 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-700))] surface-interactive"
              >
                <Plus className="h-3.5 w-3.5" />
                新建配置
              </button>
            </div>

            {globalLoading ? (
              <div className="rounded-md border border-border bg-surface-2 px-4 py-5 text-center text-caption text-ink-tertiary">
                加载中...
              </div>
            ) : globalConfigs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-caption text-ink-tertiary">
                暂无全局邮箱配置
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {globalConfigs.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-caption font-semibold text-ink-primary">{item.name}</span>
                        {item.isDefault && (
                          <span className="rounded-sm bg-[rgb(var(--brand-50))] px-1.5 py-0.5 text-footnote font-medium text-[rgb(var(--brand-700))]">
                            默认
                          </span>
                        )}
                        <span className={`rounded-sm px-1.5 py-0.5 text-footnote ${item.enabled ? 'bg-success/10 text-success' : 'bg-surface-2 text-ink-tertiary'}`}>
                          {item.enabled ? '已启用' : '已停用'}
                        </span>
                      </div>
                      <p className="break-all text-footnote text-ink-secondary">
                        {item.smtpUser} · {item.smtpHost}:{item.smtpPort}
                      </p>
                      <p className="break-words text-footnote text-ink-tertiary">
                        域名：{item.domains.length > 0 ? item.domains.join('、') : '未指定（仅作为默认回退）'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditGlobalConfig(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary"
                        title="编辑配置"
                        aria-label={`编辑 ${item.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteGlobal(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-danger/5 hover:text-danger"
                        title="删除配置"
                        aria-label={`删除 ${item.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 个人邮箱状态 (只读) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline text-ink-primary flex items-center gap-2">
                <Server className="h-4 w-4" />
                当前账号邮箱状态
              </h2>
              <p className="mt-0.5 text-caption text-ink-tertiary">
                这里只展示当前登录用户自己的邮箱绑定状态
              </p>
            </div>
            {credsLoading ? null : personalCreds?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-footnote font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已绑定
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning">
                <AlertCircle className="h-3.5 w-3.5" />
                未绑定
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadField icon={Server} label="收发主机" value={
              personalCreds?.configured
                ? `${personalCreds.smtp?.host ?? config?.smtpHost ?? 'smtphz.qiye.163.com'} / ${personalCreds.imap?.host ?? config?.imapHost ?? 'imaphz.qiye.163.com'}`
                : '未绑定个人邮箱'
            } />
            <ReadField icon={AtSign} label="邮箱地址" value={personalCreds?.smtp?.user ?? '未绑定个人邮箱'} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={globalEditorOpen} onOpenChange={setGlobalEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGlobalId ? '编辑全局邮箱配置' : '新建全局邮箱配置'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveGlobal} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-footnote text-ink-tertiary">配置名称</label>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                  value={globalForm.name}
                  onChange={(e) => setGlobalForm({ ...globalForm, name: e.target.value })}
                  placeholder="例如：网易企业邮箱"
                />
              </div>
              <div>
                <label className="text-footnote text-ink-tertiary">服务商</label>
                <Select value={globalForm.provider} onValueChange={(value) => applyProviderPreset(value as EmailProvider)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="netease">网易企业邮箱</SelectItem>
                    <SelectItem value="qq">QQ 邮箱</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-footnote text-ink-tertiary">匹配邮箱域名</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                value={globalForm.domains}
                onChange={(e) => setGlobalForm({ ...globalForm, domains: e.target.value })}
                placeholder="rhenext.com, rheem.com"
              />
              <p className="mt-1 text-footnote text-ink-tertiary">多个域名使用逗号或空格分隔，同一域名只能分配给一个已启用配置。</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary">SMTP 发件</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div>
                  <label className="text-footnote text-ink-tertiary">主机</label>
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    value={globalForm.smtpHost}
                    onChange={(e) => setGlobalForm({ ...globalForm, smtpHost: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">端口</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={65535}
                    className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    value={globalForm.smtpPort}
                    onChange={(e) => setGlobalForm({ ...globalForm, smtpPort: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-footnote text-ink-tertiary">发件账号</label>
                  <input
                    required
                    type="email"
                    className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    value={globalForm.smtpUser}
                    onChange={(e) => setGlobalForm({ ...globalForm, smtpUser: e.target.value })}
                    placeholder="mailer@example.com"
                  />
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">密码 / 授权码</label>
                  <div className="relative">
                    <input
                      required={!editingGlobalId}
                      type={showGlobalPass ? 'text' : 'password'}
                      className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 pr-10 text-caption"
                      value={globalForm.smtpPass}
                      onChange={(e) => setGlobalForm({ ...globalForm, smtpPass: e.target.value })}
                      placeholder={editingGlobalId ? '留空则不修改' : '邮箱密码或授权码'}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
                      onClick={() => setShowGlobalPass(!showGlobalPass)}
                      aria-label={showGlobalPass ? '隐藏密码' : '显示密码'}
                    >
                      {showGlobalPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-caption text-ink-secondary">
                SMTP 使用 SSL/TLS
                <Switch
                  checked={globalForm.smtpSecure}
                  onCheckedChange={(checked) => setGlobalForm({ ...globalForm, smtpSecure: checked })}
                />
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="text-footnote font-semibold text-ink-secondary">IMAP 收件</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div>
                  <label className="text-footnote text-ink-tertiary">主机</label>
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    value={globalForm.imapHost}
                    onChange={(e) => setGlobalForm({ ...globalForm, imapHost: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-footnote text-ink-tertiary">端口</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={65535}
                    className="mt-1 w-full rounded-md border border-border bg-[rgb(var(--surface-2))] px-3 py-2 text-caption"
                    value={globalForm.imapPort}
                    onChange={(e) => setGlobalForm({ ...globalForm, imapPort: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-caption text-ink-secondary">
                IMAP 使用 SSL/TLS
                <Switch
                  checked={globalForm.imapSecure}
                  onCheckedChange={(checked) => setGlobalForm({ ...globalForm, imapSecure: checked })}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-caption text-ink-secondary">
                启用配置
                <Switch
                  checked={globalForm.enabled}
                  onCheckedChange={(checked) => setGlobalForm({
                    ...globalForm,
                    enabled: checked,
                    isDefault: checked ? globalForm.isDefault : false,
                  })}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-caption text-ink-secondary">
                设为默认
                <Switch
                  checked={globalForm.isDefault}
                  disabled={!globalForm.enabled}
                  onCheckedChange={(checked) => setGlobalForm({ ...globalForm, isDefault: checked })}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGlobalEditorOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-footnote font-medium text-ink-secondary hover:bg-surface-2"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={globalSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-600))] px-4 py-2 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-700))] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {globalSaving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
