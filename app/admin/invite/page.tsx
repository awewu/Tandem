'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Copy, Check } from 'lucide-react';

interface InviteSummary {
  id: string;
  email?: string | null;
  presetRoles: string[];
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  redeemedAt?: string | null;
}

export default function AdminInvitePage() {
  const [list, setList] = useState<InviteSummary[]>([]);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState('employee');
  const [validHours, setValidHours] = useState(168);
  const [maxUses, setMaxUses] = useState(1);
  const [lastCode, setLastCode] = useState('');
  const [copied, setCopied] = useState(false);

  async function fetchList() {
    const res = await fetch('/api/auth/invite');
    if (res.ok) {
      const data = await res.json();
      setList(data.invites ?? []);
    }
  }

  useEffect(() => {
    void fetchList();
  }, []);

  async function create() {
    const res = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email || undefined,
        presetRoles: roles.split(',').map((r) => r.trim()).filter(Boolean),
        validHours,
        maxUses,
      }),
    });
    if (!res.ok) {
      alert('创建失败 (需 admin / manager / owner 权限)');
      return;
    }
    const data = await res.json();
    setLastCode(data.code);
    setEmail('');
    setCopied(false);
    void fetchList();
  }

  async function copy() {
    await navigator.clipboard.writeText(lastCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container mx-auto max-w-3xl space-y-4 p-6 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            邀请码管理 · 自研身份系统
          </CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">
            Tandem 默认关闭公开注册. 通过邀请码控制谁能加入你的团队.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">绑定邮箱 (可选)</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="不填则任何邮箱可领"
                className="w-full rounded border p-1.5 text-caption"
              />
            </div>
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">预设角色 (逗号分隔)</p>
              <input
                type="text"
                value={roles}
                onChange={(e) => setRoles(e.target.value)}
                placeholder="employee, manager"
                className="w-full rounded border p-1.5 text-caption"
              />
            </div>
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">有效期 (小时)</p>
              <input
                type="number"
                value={validHours}
                onChange={(e) => setValidHours(Number(e.target.value))}
                className="w-full rounded border p-1.5 text-caption"
              />
            </div>
            <div>
              <p className="mb-1 text-footnote text-muted-foreground">最大使用次数</p>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full rounded border p-1.5 text-caption"
              />
            </div>
          </div>

          <Button onClick={create}>生成邀请码</Button>

          {lastCode && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3">
              <p className="mb-1 text-footnote text-emerald-700">
                ⚠️ 此邀请码仅显示一次, 请立即复制并发给受邀者:
              </p>
              <div className="flex items-center gap-2 rounded bg-white p-2">
                <code className="flex-1 text-headline font-bold tracking-widest">{lastCode}</code>
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-footnote text-emerald-700">
                注册链接: {' '}
                <code className="text-[10px]">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/register?invite={lastCode}
                </code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body">已发出的邀请</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-caption text-muted-foreground">尚无邀请记录</p>
          ) : (
            <table className="w-full text-caption">
              <thead className="text-footnote text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">邮箱</th>
                  <th className="text-left">角色</th>
                  <th>使用</th>
                  <th>过期</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="py-1.5">{i.email ?? <span className="text-muted-foreground">任意</span>}</td>
                    <td>
                      {i.presetRoles.map((r) => (
                        <Badge key={r} variant="outline" className="mr-1 text-[10px]">
                          {r}
                        </Badge>
                      ))}
                    </td>
                    <td className="text-center">
                      {i.usedCount}/{i.maxUses}
                    </td>
                    <td className="text-footnote text-muted-foreground">
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
