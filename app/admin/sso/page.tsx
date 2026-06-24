/**
 * /admin/sso — SSO (OIDC) 接入方管理
 *
 * Tandem 作为企业级 OpenID Connect 提供方 (IdP)。本页注册/管理其他项目作为接入方,
 * 它们通过授权码流程登录, 并按 scope 获取 Tandem 的组织结构 (部门/角色/汇报线)。
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  KeyRound, Plus, RefreshCw, AlertCircle, Copy, Check, Trash2, Power, ShieldCheck, Globe, Link2,
} from 'lucide-react';

interface ClientView {
  id: string;
  name: string;
  description?: string;
  type: 'confidential' | 'public';
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedScopes: string[];
  grantTypes: string[];
  skipConsent: boolean;
  disabled: boolean;
  hasSecret: boolean;
  createdAt: string;
}

const ALL_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'roles', 'org'];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="inline-flex items-center gap-1 text-footnote text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CreateDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: (secret: string | null, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'confidential' | 'public'>('confidential');
  const [redirectUris, setRedirectUris] = useState('');
  const [scopes, setScopes] = useState<string[]>(['openid', 'profile', 'email', 'roles', 'org']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(''); setDescription(''); setType('confidential'); setRedirectUris('');
      setScopes(['openid', 'profile', 'email', 'roles', 'org']); setError(null);
    }
  }, [open]);

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit() {
    setError(null);
    const uris = redirectUris.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!name.trim() || uris.length === 0) {
      setError('名称与至少一个回调地址必填');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/oidc/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description, type, redirectUris: uris, allowedScopes: scopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '创建失败');
      onCreated(data.clientSecret ?? null, name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>注册 SSO 接入方</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="flex items-center gap-2 text-caption text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              <AlertCircle className="h-4 w-4" />{error}
            </div>
          )}
          <div>
            <label className="text-caption font-medium mb-1 block">应用名称 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如: 报销系统 / 客户门户" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">类型</label>
            <div className="flex gap-2">
              <Button type="button" variant={type === 'confidential' ? 'default' : 'outline'} size="sm" onClick={() => setType('confidential')}>
                服务端应用 (有 secret)
              </Button>
              <Button type="button" variant={type === 'public' ? 'default' : 'outline'} size="sm" onClick={() => setType('public')}>
                SPA / 移动端 (PKCE)
              </Button>
            </div>
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">回调地址 (redirect_uri, 每行一个) *</label>
            <textarea
              className="w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-caption font-mono"
              value={redirectUris}
              onChange={(e) => setRedirectUris(e.target.value)}
              placeholder={'https://app.example.com/api/auth/callback/tandem'}
            />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">授权范围 (scope)</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => s !== 'openid' && toggleScope(s)}
                  className={`px-2 py-0.5 rounded text-footnote border ${
                    scopes.includes(s) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-1 text-muted-foreground'
                  } ${s === 'openid' ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-footnote text-muted-foreground mt-1">org = 部门/汇报线; roles = Tandem 角色; openid 必选。</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSsoPage() {
  const [clients, setClients] = useState<ClientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [secretReveal, setSecretReveal] = useState<{ name: string; secret: string } | null>(null);
  const [issuer, setIssuer] = useState('');

  useEffect(() => {
    setIssuer(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/oidc/clients', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `加载失败 (${res.status})`);
      }
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const discoveryUrl = useMemo(() => `${issuer}/.well-known/openid-configuration`, [issuer]);

  async function toggleDisabled(c: ClientView) {
    await fetch(`/api/oidc/clients/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ disabled: !c.disabled }),
    });
    await load();
  }

  async function rotate(c: ClientView) {
    if (!confirm(`重置「${c.name}」的 client_secret？旧 secret 立即失效。`)) return;
    const res = await fetch(`/api/oidc/clients/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'rotate_secret' }),
    });
    const data = await res.json();
    if (res.ok) setSecretReveal({ name: c.name, secret: data.clientSecret });
    await load();
  }

  async function remove(c: ClientView) {
    if (!confirm(`删除接入方「${c.name}」？该应用将无法再通过 SSO 登录。`)) return;
    await fetch(`/api/oidc/clients/${c.id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  }

  return (
    <div className="page-container py-8 md:py-10">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            SSO 单点登录 (OIDC)
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Tandem 作为企业身份提供方 (IdP)。其他项目接入后用统一账号登录, 并按授权获取组织结构 (部门/角色/汇报线)。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />注册接入方
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Discovery 端点提示 */}
      <Card className="mb-5">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-caption">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium shrink-0">发现端点</span>
            <code className="font-mono text-footnote bg-surface-1 px-2 py-0.5 rounded truncate">{discoveryUrl}</code>
            <CopyButton value={discoveryUrl} />
          </div>
          <p className="text-footnote text-muted-foreground mt-1.5">
            接入方用任意 OIDC 客户端库填入此地址即可自动发现 authorize / token / userinfo / jwks。
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-caption text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-10 text-center text-caption text-muted-foreground">加载中...</div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center text-caption text-muted-foreground border rounded-lg">
            暂无接入方。点击「注册接入方」添加第一个对接项目。
          </div>
        ) : clients.map((c) => (
          <Card key={c.id} className={c.disabled ? 'opacity-60' : ''}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {c.type === 'confidential' ? '服务端' : 'PKCE'}
                    </Badge>
                    {c.skipConsent && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" />受信
                      </Badge>
                    )}
                    {c.disabled && <Badge variant="outline" className="text-[10px] h-4 px-1 text-rose-600 border-rose-200">已停用</Badge>}
                  </div>
                  {c.description && <p className="text-caption text-muted-foreground mt-0.5">{c.description}</p>}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-footnote">
                      <span className="text-muted-foreground shrink-0">client_id</span>
                      <code className="font-mono bg-surface-1 px-1.5 py-0.5 rounded truncate">{c.id}</code>
                      <CopyButton value={c.id} />
                    </div>
                    <div className="flex items-start gap-2 text-footnote">
                      <Link2 className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-muted-foreground font-mono break-all">{c.redirectUris.join(', ')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.allowedScopes.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-surface-1 text-footnote text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.type === 'confidential' && (
                    <Button variant="outline" size="sm" onClick={() => rotate(c)} title="重置 secret">
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => toggleDisabled(c)} title={c.disabled ? '启用' : '停用'}>
                    <Power className={`h-3.5 w-3.5 ${c.disabled ? 'text-emerald-600' : 'text-rose-600'}`} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => remove(c)} title="删除">
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(secret, name) => { if (secret) setSecretReveal({ name, secret }); void load(); }}
      />

      {/* secret 一次性展示 */}
      <Dialog open={!!secretReveal} onOpenChange={(v) => !v && setSecretReveal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>client_secret · 仅显示一次</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-caption text-muted-foreground">
              请立即复制并妥善保存「{secretReveal?.name}」的 secret，关闭后无法再次查看。
            </p>
            <div className="flex items-center gap-2 bg-surface-1 border rounded px-3 py-2">
              <code className="font-mono text-footnote break-all flex-1">{secretReveal?.secret}</code>
              {secretReveal && <CopyButton value={secretReveal.secret} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecretReveal(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
