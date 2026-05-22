/**
 * /admin/organization · 真员工组织管理
 *
 * 与 /organization (三省六部 Agent 工作组可视化, 项目机制 fixture) 区分:
 * - /organization      → 项目协作 metaphor (frozen §9.2, 保持 fixture)
 * - /admin/organization → HR/Admin 看真员工 (本页, 真接 /api/org/users)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, RefreshCw, AlertCircle, Building2, ShieldCheck } from 'lucide-react';

interface OrgUser {
  id: string;
  email: string;
  name: string;
  departmentId: string | null;
  roles: string[];
}

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  champion: { label: 'Champion', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  steward: { label: 'Steward', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  manager: { label: '主管', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  hr: { label: 'HR', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  employee: { label: '员工', color: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
};

export default function AdminOrganizationPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/org/users', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setUsers((j.users ?? []) as OrgUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // 部门列表 (从 users 推导)
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.departmentId) set.add(u.departmentId);
    return Array.from(set).sort();
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && !u.roles.includes(roleFilter)) return false;
      if (deptFilter !== 'all' && u.departmentId !== deptFilter) return false;
      if (q) {
        const lc = q.toLowerCase();
        if (!u.name.toLowerCase().includes(lc) && !u.email.toLowerCase().includes(lc)) return false;
      }
      return true;
    });
  }, [users, q, roleFilter, deptFilter]);

  // 部门聚合
  const byDept = useMemo(() => {
    const m = new Map<string, OrgUser[]>();
    for (const u of filtered) {
      const k = u.departmentId ?? '(未分配)';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(u);
    }
    return Array.from(m.entries()).sort();
  }, [filtered]);

  return (
    <div className="page-container py-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            员工组织 · 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            真员工列表 · 部门 · 角色 · 数据来源: <span className="font-mono text-xs">/api/org/users</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {/* 工具条 */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索姓名 / 邮箱"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="部门" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground tabular-nums ml-auto">
            {filtered.length} / {users.length} 人
          </div>
        </CardContent>
      </Card>

      {/* 错误 */}
      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 按部门分组列表 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : byDept.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            没有符合条件的员工
          </CardContent>
        </Card>
      ) : (
        byDept.map(([dept, list]) => (
          <Card key={dept}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {dept}
                <span className="text-sm text-muted-foreground font-normal">({list.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">姓名</th>
                    <th className="px-4 py-2 text-left font-medium">邮箱</th>
                    <th className="px-4 py-2 text-left font-medium">角色</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{u.name}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{u.email || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            u.roles.map((r) => {
                              const meta = ROLE_LABEL[r] ?? { label: r, color: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
                              return (
                                <Badge key={r} variant="outline" className={`${meta.color} text-[10px] gap-0.5`}>
                                  {(r === 'admin' || r === 'champion') && <ShieldCheck className="h-2.5 w-2.5" />}
                                  {meta.label}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}

      <footer className="text-xs text-muted-foreground border-t pt-4">
        关于&ldquo;项目协作三省六部&rdquo;可视化 (Agent 工作组), 见{' '}
        <a href="/organization" className="text-primary hover:underline">/organization</a>.
      </footer>
    </div>
  );
}
