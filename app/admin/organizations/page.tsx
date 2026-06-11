'use client';

/**
 * /admin/organizations · 上下游组织管理 (Owner/Admin)
 *
 * 企业微信式供应链模型: 上游本部 (anchor) 建/邀/停用下游组织 (经销商/供应商/门店/个体).
 *   - 建组织   → POST /api/admin/organizations
 *   - 发邀请码 → POST /api/admin/organizations/:id/invite (码绑定 orgId + membershipType)
 *   - 停用     → POST /api/admin/organizations/:id/suspend
 * 被邀请人用邀请码走 /register?invite=CODE 注册, 即权威归属该下游组织.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Ticket, Ban, Copy, Check, Loader2 } from 'lucide-react';

type OrgType = 'downstream' | 'individual';
type OrgCategory = 'dealer' | 'supplier' | 'store' | 'contractor' | 'partner';
type OrgStatus = 'active' | 'suspended';

interface Org {
  id: string;
  name: string;
  type: OrgType | 'anchor';
  category?: OrgCategory;
  status: OrgStatus;
  createdAt: string;
}

const CATEGORY_LABEL: Record<OrgCategory, string> = {
  dealer: '经销商',
  supplier: '供应商',
  store: '门店 / 加盟商',
  contractor: '承包商 / 乙方',
  partner: '合作伙伴',
};

const TYPE_LABEL: Record<OrgType, string> = {
  downstream: '下游企业',
  individual: '个人下游',
};

const CATEGORIES: OrgCategory[] = ['dealer', 'supplier', 'store', 'contractor', 'partner'];

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 建组织表单
  const [name, setName] = useState('');
  const [type, setType] = useState<OrgType>('downstream');
  const [category, setCategory] = useState<OrgCategory>('dealer');
  const [creating, setCreating] = useState(false);

  // 邀请 / 复制
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const [lastCodeOrg, setLastCodeOrg] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/organizations');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '加载失败');
      setOrgs(data.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrgs();
  }, [fetchOrgs]);

  async function createOrg() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, category: type === 'downstream' ? category : undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '创建失败');
      setName('');
      await fetchOrgs();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function invite(orgId: string) {
    setInviting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '邀请失败');
      setLastCode(data.inviteCode);
      setLastCodeOrg(orgId);
      setInviteEmail('');
      setInviteFor(null);
      setCopied(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function suspend(orgId: string) {
    if (!confirm('确认停用该下游组织? 停用后不能再邀请新成员.')) return;
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/suspend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '停用失败');
      await fetchOrgs();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(lastCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container mx-auto max-w-3xl space-y-4 p-6 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            上下游组织 · 供应链伙伴
          </CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">
            企业微信式上下游模型: 上游本部建立下游组织 (经销商 / 供应商 / 门店 / 个体), 发邀请码让其成员注册归属。
            下游成员只见上下游工作台, 看不到上游内部组织。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <p className="mb-1 text-footnote text-muted-foreground">组织名称</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如: 华东经销商A"
                className="w-full rounded border p-1.5 text-caption"
              />
            </div>
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">类型</p>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrgType)}
                className="w-full rounded border p-1.5 text-caption"
              >
                <option value="downstream">下游企业</option>
                <option value="individual">个人下游</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">分类</p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as OrgCategory)}
                disabled={type === 'individual'}
                className="w-full rounded border p-1.5 text-caption disabled:opacity-50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={createOrg} disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            新建下游组织
          </Button>

          {lastCode && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3">
              <p className="mb-1 text-footnote text-emerald-700">
                ⚠️ 此邀请码仅显示一次, 请立即复制并发给下游成员:
              </p>
              <div className="flex items-center gap-2 rounded bg-white p-2">
                <code className="flex-1 text-headline font-bold tracking-widest">{lastCode}</code>
                <Button size="sm" variant="outline" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-footnote text-emerald-700">
                注册链接:{' '}
                <code className="text-[10px]">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/register?invite={lastCode}
                </code>
                {lastCodeOrg && (
                  <span className="ml-1">→ 归属「{orgs.find((o) => o.id === lastCodeOrg)?.name ?? lastCodeOrg}」</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body">已建下游组织</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 text-caption text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </p>
          ) : error ? (
            <p className="text-caption text-rose-600">加载失败: {error}</p>
          ) : orgs.length === 0 ? (
            <p className="text-caption text-muted-foreground">尚无下游组织, 用上方表单新建。</p>
          ) : (
            <div className="space-y-2">
              {orgs.map((o) => (
                <div key={o.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {o.type === 'anchor' ? '本部' : TYPE_LABEL[o.type]}
                      </Badge>
                      {o.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {CATEGORY_LABEL[o.category]}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          o.status === 'active'
                            ? 'border-emerald-300 text-emerald-700 text-[10px]'
                            : 'border-rose-300 text-rose-700 text-[10px]'
                        }
                      >
                        {o.status === 'active' ? '启用中' : '已停用'}
                      </Badge>
                    </div>
                    {o.status === 'active' && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInviteFor(inviteFor === o.id ? null : o.id);
                            setInviteEmail('');
                          }}
                        >
                          <Ticket className="mr-1 h-3.5 w-3.5" />
                          邀请成员
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void suspend(o.id)}>
                          <Ban className="mr-1 h-3.5 w-3.5 text-rose-500" />
                          停用
                        </Button>
                      </div>
                    )}
                  </div>

                  {inviteFor === o.id && (
                    <div className="mt-2 flex flex-wrap items-end gap-2 border-t pt-2">
                      <div className="flex-1 min-w-[180px]">
                        <p className="mb-1 text-footnote text-muted-foreground">绑定邮箱 (可选)</p>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="不填则任意邮箱可领"
                          className="w-full rounded border p-1.5 text-caption"
                        />
                      </div>
                      <Button size="sm" onClick={() => void invite(o.id)} disabled={inviting}>
                        {inviting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Ticket className="mr-1 h-3.5 w-3.5" />}
                        生成邀请码
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
