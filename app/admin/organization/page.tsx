/**
 * /admin/organization · 员工部门 (HR 部门线 · 真员工数据)
 *
 * 三套相关页面的边界 (2026-05-30 重整 · docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md):
 *   - /admin/organization          → 本页. HR/Admin 管理真员工 (User.departmentId, 走 /api/org/users)
 *   - /governance/three-departments → 三省六部项目治理协同模板 (跨部门协同, fixture)
 *   - /agents                      → AI Agent 工作组 (与人无关)
 *
 * 一句话: 部门 = 「人归属哪里」; 三省六部 = 「事如何流转」; Agent = AI 干活的单元.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, RefreshCw, AlertCircle, Building2, ShieldCheck, Upload, Download } from 'lucide-react';

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
  steward: { label: 'Steward', color: 'bg-warning/5 text-warning border-warning/20' },
  manager: { label: '主管', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  hr: { label: 'HR', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  employee: { label: '员工', color: 'bg-surface-1 text-ink-primary border' },
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
    <div className="page-container py-8 space-y-6 md:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            员工组织 · 管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            真员工列表 · 部门 · 角色 · 数据来源: <span className="font-mono text-footnote">/api/org/users</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {/* 通讯录批量导入 (pilot Day 1) */}
      <BulkInviteCard onSuccess={() => void load()} />

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
          <div className="text-footnote text-muted-foreground tabular-nums ml-auto">
            {filtered.length} / {users.length} 人
          </div>
        </CardContent>
      </Card>

      {/* 错误 */}
      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 按部门分组列表 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-caption text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : byDept.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-caption text-muted-foreground">
            没有符合条件的员工
          </CardContent>
        </Card>
      ) : (
        byDept.map(([dept, list]) => (
          <Card key={dept}>
            <CardHeader className="pb-2">
              <CardTitle className="text-body flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {dept}
                <span className="text-caption text-muted-foreground font-normal">({list.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-caption">
                <thead className="border-b bg-muted/40 text-footnote uppercase tracking-wide text-muted-foreground">
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
                      <td className="px-4 py-2.5 text-footnote text-muted-foreground font-mono">{u.email || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-footnote text-muted-foreground">—</span>
                          ) : (
                            u.roles.map((r) => {
                              const meta = ROLE_LABEL[r] ?? { label: r, color: 'bg-surface-1 text-ink-primary border' };
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

      <footer className="text-footnote text-muted-foreground border-t pt-4">
        关于&ldquo;项目协作三省六部&rdquo;可视化 (Agent 工作组), 见{' '}
        <a href="/organization" className="text-primary hover:underline">/organization</a>.
      </footer>
    </div>
  );
}

interface BulkResult {
  row: number;
  email: string;
  ok: boolean;
  code?: string;
  error?: string;
  registerUrl?: string;
}

function BulkInviteCard({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; ok: number; failed: number; dryRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (dryRun) fd.append('dryRun', '1');
      const r = await fetch('/api/admin/users/bulk-invite', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
        return;
      }
      setResults(j.results);
      setSummary(j.summary);
      if (!dryRun && onSuccess) onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  function downloadResults() {
    if (!results) return;
    const lines = [
      'row,email,ok,code,registerUrl,error',
      ...results.map((r) =>
        [r.row, r.email, r.ok, r.code ?? '', r.registerUrl ?? '', r.error ?? ''].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-invite-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-warning/20 bg-warning/5/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-body flex items-center gap-2">
          <Upload className="h-4 w-4" />
          通讯录批量邀请 · pilot Day 1
        </CardTitle>
        <p className="text-footnote text-muted-foreground mt-1">
          上传 CSV 或 Excel (列: <span className="font-mono">email,name,department,roles</span>) ·
          每行生成 7 天单次邀请码 · 单批 ≤ 500 行 ·
          下载 CSV 模板:{' '}
          <a href="/api/admin/users/bulk-invite/template" className="text-warning underline">下载模板</a>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-footnote"
          />
          <Button size="sm" variant="outline" disabled={!file || busy} onClick={() => void upload(true)}>
            {busy ? '校验中…' : '试运行 (dry-run)'}
          </Button>
          <Button size="sm" disabled={!file || busy} onClick={() => void upload(false)}>
            {busy ? '生成中…' : '正式生成邀请码'}
          </Button>
          {results && (
            <Button size="sm" variant="ghost" onClick={downloadResults}>
              <Download className="h-3.5 w-3.5 mr-1" />
              下载结果 CSV
            </Button>
          )}
        </div>

        {error && (
          <div className="text-footnote text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {summary && (
          <div className="text-footnote flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              成功 {summary.ok}
            </Badge>
            {summary.failed > 0 && (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                失败 {summary.failed}
              </Badge>
            )}
            <span className="text-muted-foreground">
              共 {summary.total} 行 · {summary.dryRun ? '试运行 (未写入)' : '已生成邀请码'}
            </span>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="max-h-64 overflow-auto border rounded">
            <table className="w-full text-footnote">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">邮箱</th>
                  <th className="px-2 py-1.5 text-left font-medium">状态</th>
                  <th className="px-2 py-1.5 text-left font-medium">邀请码 / 错误</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 100).map((r) => (
                  <tr key={r.row} className="border-t">
                    <td className="px-2 py-1 font-mono text-muted-foreground">{r.row}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className="px-2 py-1">
                      {r.ok ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                          ✗
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground truncate max-w-md">
                      {r.code ?? r.error ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length > 100 && (
              <div className="text-[10px] text-muted-foreground p-2 text-center border-t">
                仅显示前 100 行 · 完整列表请下载 CSV
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
