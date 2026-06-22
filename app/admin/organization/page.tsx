/**
 * /admin/organization - 企业 HR 组织管理
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Network, Building2, Users, Search, RefreshCw, AlertCircle,
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, Upload, Download,
  ShieldCheck, X,
} from 'lucide-react';

interface HrDept {
  id: string; name: string; parentId: string | null; headId: string | null;
  description: string; order: number; tenantId: string; createdAt: string; updatedAt: string;
}
interface OrgUser {
  id: string; email: string; name: string; roles: string[];
  departmentId?: string | null; jobTitle?: string | null; managerId?: string | null;
  employeeId?: string | null; hireDate?: string | null; workLocation?: string | null; phone?: string | null;
}
interface BulkResult { row: number; email: string; ok: boolean; code?: string; error?: string; registerUrl?: string }
interface ImportResult { row: number; email: string; ok: boolean; action?: string; error?: string }

const NONE_VALUE = '__none__';

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Admin',    color: 'bg-rose-50 text-rose-700 border-rose-200' },
  champion: { label: 'Champion', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  steward:  { label: 'Steward',  color: 'bg-warning/5 text-warning border-warning/20' },
  manager:  { label: '主管',     color: 'bg-sky-50 text-sky-700 border-sky-200' },
  hr:       { label: 'HR',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  employee: { label: '员工',     color: 'bg-surface-1 text-ink-primary border' },
};

function buildDeptChildren(depts: HrDept[]): Map<string | null, HrDept[]> {
  const map = new Map<string | null, HrDept[]>();
  for (const d of depts) {
    const k = d.parentId;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(d);
  }
  for (const arr of Array.from(map.values())) arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return map;
}

function deptPath(id: string | null | undefined, depts: HrDept[]): string {
  if (!id) return '-';
  const map = new Map(depts.map((d) => [d.id, d]));
  const parts: string[] = [];
  let cur = map.get(id);
  while (cur) { parts.unshift(cur.name); cur = cur.parentId ? map.get(cur.parentId) : undefined; }
  return parts.join(' / ') || '-';
}

function collectDeptSubtreeIds(rootId: string, childrenMap: Map<string | null, HrDept[]>): Set<string> {
  const ids = new Set<string>();
  const visit = (id: string) => {
    ids.add(id);
    for (const child of childrenMap.get(id) ?? []) visit(child.id);
  };
  visit(rootId);
  return ids;
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? `HTTP ${res.status}`);
}

// 部门编辑弹窗
function DeptDialog({
  open, onClose, onSave, depts, initial,
}: {
  open: boolean; onClose: () => void;
  onSave: (d: Partial<HrDept>) => Promise<void>;
  depts: HrDept[]; initial?: HrDept | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? NONE_VALUE);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setName(initial?.name ?? ''); setParentId(initial?.parentId ?? NONE_VALUE); setDescription(initial?.description ?? ''); }
  }, [open, initial]);
  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), parentId: parentId === NONE_VALUE ? null : parentId, description });
      onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? '编辑部门' : '新建部门'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-caption font-medium mb-1 block">部门名称 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如: 销售大区 / 生产部" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">上级部门</label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder="顶级部门 (无上级)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>顶级部门 (无上级)</SelectItem>
                {depts.filter((d) => d.id !== initial?.id).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{deptPath(d.id, depts)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 员工编辑弹窗
function UserDialog({
  open, onClose, onSave, user, depts, users,
}: {
  open: boolean; onClose: () => void;
  onSave: (patch: Partial<OrgUser>) => Promise<void>;
  user: OrgUser | null; depts: HrDept[]; users: OrgUser[];
}) {
  const [form, setForm] = useState<Partial<OrgUser>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && user) setForm({ departmentId: user.departmentId ?? NONE_VALUE, jobTitle: user.jobTitle ?? '', managerId: user.managerId ?? NONE_VALUE, employeeId: user.employeeId ?? '', hireDate: user.hireDate ?? '', workLocation: user.workLocation ?? '', phone: user.phone ?? '' });
  }, [open, user]);
  const set = (k: keyof OrgUser, v: string) => setForm((p) => ({ ...p, [k]: v === NONE_VALUE ? null : (v || null) }));
  async function submit() {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>编辑员工 · {user.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <label className="text-caption font-medium mb-1 block">所属部门</label>
            <Select value={form.departmentId ?? NONE_VALUE} onValueChange={(v) => set('departmentId', v)}>
              <SelectTrigger><SelectValue placeholder="未分配" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>未分配</SelectItem>
                {depts.map((d) => <SelectItem key={d.id} value={d.id}>{deptPath(d.id, depts)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">职务/岗位</label>
            <Input value={form.jobTitle ?? ''} onChange={(e) => set('jobTitle', e.target.value)} placeholder="例如: 销售经理" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">直属上级</label>
            <Select value={form.managerId ?? NONE_VALUE} onValueChange={(v) => set('managerId', v)}>
              <SelectTrigger><SelectValue placeholder="无" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>无</SelectItem>
                {users.filter((u) => u.id !== user.id).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">工号</label>
            <Input value={form.employeeId ?? ''} onChange={(e) => set('employeeId', e.target.value)} placeholder="可选" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">入职日期</label>
            <Input type="date" value={form.hireDate ?? ''} onChange={(e) => set('hireDate', e.target.value)} />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">工作地点</label>
            <Input value={form.workLocation ?? ''} onChange={(e) => set('workLocation', e.target.value)} placeholder="例如: 上海" />
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">手机</label>
            <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="可选" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 部门树节点
function DeptNode({
  dept, childrenMap, users, allDepts, depth,
  onEdit, onDelete, onAddChild, onSelectDept, selectedDeptId,
}: {
  dept: HrDept; childrenMap: Map<string | null, HrDept[]>;
  users: OrgUser[]; allDepts: HrDept[]; depth: number;
  onEdit: (d: HrDept) => void; onDelete: (d: HrDept) => void;
  onAddChild: (parentId: string) => void; onSelectDept: (id: string) => void;
  selectedDeptId: string | null;
}) {
  const [open, setOpen] = useState(depth === 0);
  const children = childrenMap.get(dept.id) ?? [];
  const members = users.filter((u) => u.departmentId === dept.id);
  const head = users.find((u) => u.id === dept.headId);
  const total = members.length + children.reduce((s, c) => s + (users.filter((u) => u.departmentId === c.id).length), 0);
  const selected = selectedDeptId === dept.id;
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${selected ? 'bg-primary/8' : 'hover:bg-muted/40'}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelectDept(dept.id)}
      >
        <button onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }} className="shrink-0 text-muted-foreground hover:text-foreground">
          {children.length > 0 ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5 inline-block" />}
        </button>
        <Building2 className={`h-3.5 w-3.5 shrink-0 ${depth === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-caption flex-1 truncate ${depth === 0 ? 'font-semibold' : 'font-medium'}`}>{dept.name}</span>
        {head && <span className="text-footnote text-muted-foreground hidden group-hover:inline truncate max-w-[80px]">{head.name}</span>}
        <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums shrink-0">{total}</Badge>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button title="新增子部门" className="p-0.5 rounded hover:bg-muted" onClick={() => onAddChild(dept.id)}><Plus className="h-3 w-3" /></button>
          <button title="编辑" className="p-0.5 rounded hover:bg-muted" onClick={() => onEdit(dept)}><Pencil className="h-3 w-3" /></button>
          <button title="删除" className="p-0.5 rounded hover:bg-rose-100 text-rose-600" onClick={() => onDelete(dept)}><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      {open && children.map((c) => (
        <DeptNode key={c.id} dept={c} childrenMap={childrenMap} users={users} allDepts={allDepts}
          depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild}
          onSelectDept={onSelectDept} selectedDeptId={selectedDeptId} />
      ))}
    </div>
  );
}

// 主页面
export default function AdminOrganizationPage() {
  const [depts, setDepts] = useState<HrDept[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  // dept dialog
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; initial?: HrDept | null; preParent?: string | null }>({ open: false });
  // user dialog
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: OrgUser | null }>({ open: false, user: null });
  // contact import
  const [importOpen, setImportOpen] = useState(false);
  // bulk invite
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dr, ur] = await Promise.all([
        fetch('/api/org/departments', { cache: 'no-store' }),
        fetch('/api/org/users', { cache: 'no-store' }),
      ]);
      if (!dr.ok || !ur.ok) throw new Error('加载失败');
      const [dj, uj] = await Promise.all([dr.json(), ur.json()]);
      setDepts(dj.depts ?? []);
      setUsers(uj.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const childrenMap = useMemo(() => buildDeptChildren(depts), [depts]);
  const rootDepts = childrenMap.get(null) ?? [];

  const filteredUsers = useMemo(() => {
    const lc = q.toLowerCase();
    const selectedDeptIds = selectedDeptId ? collectDeptSubtreeIds(selectedDeptId, childrenMap) : null;
    return users.filter((u) => {
      if (roleFilter !== 'all' && !u.roles.includes(roleFilter)) return false;
      if (selectedDeptIds && (!u.departmentId || !selectedDeptIds.has(u.departmentId))) return false;
      if (lc && !u.name.toLowerCase().includes(lc) && !u.email.toLowerCase().includes(lc) && !(u.jobTitle ?? '').toLowerCase().includes(lc)) return false;
      return true;
    });
  }, [users, q, roleFilter, selectedDeptId, childrenMap]);

  // dept CRUD
  async function saveDept(patch: Partial<HrDept>) {
    const { initial, preParent } = deptDialog;
    setError(null);
    if (initial) {
      const res = await fetch(`/api/org/departments/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      await assertOk(res);
    } else {
      const res = await fetch('/api/org/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, parentId: preParent ?? null }) });
      await assertOk(res);
    }
    await load();
  }

  async function deleteDept(d: HrDept) {
    if (!confirm(`删除部门「${d.name}」及其所有子部门？这些部门的成员将变为未分配。`)) return;
    setError(null);
    const res = await fetch(`/api/org/departments/${d.id}`, { method: 'DELETE' });
    await assertOk(res);
    if (selectedDeptId && collectDeptSubtreeIds(d.id, childrenMap).has(selectedDeptId)) setSelectedDeptId(null);
    await load();
  }

  // user CRUD
  async function saveUser(patch: Partial<OrgUser>) {
    if (!userDialog.user) return;
    setError(null);
    const res = await fetch(`/api/org/users/${userDialog.user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    await assertOk(res);
    await load();
  }

  return (
    <div className="page-container py-8 md:py-10">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            组织架构管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">部门树 / 员工归属 / 汇报关系 / HR 数据维护</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />导入通讯录
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen((p) => !p)}>
            <Upload className="h-4 w-4 mr-1" />批量邀请
          </Button>
          <Button size="sm" onClick={() => setDeptDialog({ open: true, initial: null })}>
            <Plus className="h-4 w-4 mr-1" />新建部门
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-caption text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* 左侧：部门树 */}
        <div className="w-72 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption font-medium text-muted-foreground">部门 ({depts.length})</span>
            {selectedDeptId && (
              <button className="text-footnote text-primary hover:underline" onClick={() => setSelectedDeptId(null)}>
                <X className="h-3 w-3 inline mr-0.5" />清除筛选
              </button>
            )}
          </div>
          <div className="border rounded-lg bg-background py-1 min-h-[120px]">
            {loading ? (
              <div className="py-8 text-center text-caption text-muted-foreground">加载中...</div>
            ) : rootDepts.length === 0 ? (
              <div className="py-8 text-center text-caption text-muted-foreground">
                暂无部门，点击“新建部门”开始
              </div>
            ) : rootDepts.map((d) => (
              <DeptNode key={d.id} dept={d} childrenMap={childrenMap} users={users}
                allDepts={depts} depth={0}
                onEdit={(dep) => setDeptDialog({ open: true, initial: dep })}
                onDelete={deleteDept}
                onAddChild={(pid) => setDeptDialog({ open: true, initial: null, preParent: pid })}
                onSelectDept={setSelectedDeptId}
                selectedDeptId={selectedDeptId}
              />
            ))}
          </div>
        </div>

        {/* 右侧：员工列表 */}
        <div className="flex-1 min-w-0">
          {/* 宸ュ叿鏉?*/}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="搜索姓名/邮箱/职务" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-footnote text-muted-foreground tabular-nums ml-auto">
              {filteredUsers.length} / {users.length} 人
              {selectedDeptId && <> / {depts.find((d) => d.id === selectedDeptId)?.name}</>}
            </span>
          </div>

          {/* 员工表格 */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-caption">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-3 py-2 text-left font-medium">姓名</th>
                  <th className="px-3 py-2 text-left font-medium">职务</th>
                  <th className="px-3 py-2 text-left font-medium">部门</th>
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell">直属上级</th>
                  <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">工号</th>
                  <th className="px-3 py-2 text-left font-medium">角色</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">加载中...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">暂无数据</td></tr>
                ) : filteredUsers.map((u) => {
                  const manager = users.find((m) => m.id === u.managerId);
                  return (
                    <tr key={u.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-footnote text-muted-foreground font-mono">{u.email}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{u.jobTitle || '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">
                        {deptPath(u.departmentId, depts)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                        {manager?.name || '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-footnote hidden lg:table-cell">
                        {u.employeeId || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((r) => {
                            const m = ROLE_LABEL[r] ?? { label: r, color: 'bg-surface-1 text-ink-primary border' };
                            return (
                              <Badge key={r} variant="outline" className={`${m.color} text-[10px] gap-0.5 h-4 px-1`}>
                                {(r === 'admin' || r === 'champion') && <ShieldCheck className="h-2.5 w-2.5" />}
                                {m.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="编辑员工信息"
                          onClick={() => setUserDialog({ open: true, user: u })}
                        ><Pencil className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 批量邀请 */}
      {bulkOpen && <BulkInviteCard onSuccess={load} />}

      {/* 弹窗 */}
      <ImportContactsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={load}
      />
      <DeptDialog
        open={deptDialog.open}
        onClose={() => setDeptDialog({ open: false })}
        onSave={saveDept}
        depts={depts}
        initial={deptDialog.initial}
      />
      <UserDialog
        open={userDialog.open}
        onClose={() => setUserDialog({ open: false, user: null })}
        onSave={saveUser}
        user={userDialog.user}
        depts={depts}
        users={users}
      />
    </div>
  );
}

// 通讯录导入弹窗
function ImportContactsDialog({
  open, onClose, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; ok: number; failed: number; dryRun: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setBusy(false);
      setResults(null);
      setSummary(null);
      setErr(null);
    }
  }, [open]);

  async function upload(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (dryRun) fd.append('dryRun', '1');
      const res = await fetch('/api/org/users/import', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setResults(body.results);
      setSummary(body.summary);
      if (!dryRun) onSuccess?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  function downloadResults() {
    if (!results) return;
    const lines = [
      'row,email,ok,action,error',
      ...results.map((r) => [r.row, r.email, r.ok, r.action ?? '', r.error ?? ''].join(',')),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `contact-import-${Date.now()}.csv`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>导入通讯录</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded border bg-muted/20 p-3 text-footnote text-muted-foreground">
            <div>支持 CSV / Excel，按邮箱匹配已有员工账号并更新部门、职务、直属上级、工号、入职日期、工作地点、手机和角色。</div>
            <a href="/api/org/users/import/template" className="text-primary underline mt-1 inline-block">下载导入模板</a>
          </div>
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {err && (
            <div className="flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-caption text-rose-700">
              <AlertCircle className="h-4 w-4" />{err}
            </div>
          )}
          {summary && (
            <div className="flex flex-wrap items-center gap-2 text-caption">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">成功 {summary.ok}</Badge>
              {summary.failed > 0 && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">失败 {summary.failed}</Badge>}
              <span className="text-muted-foreground">共 {summary.total} 行 / {summary.dryRun ? '试运行' : '已导入'}</span>
              {results && <Button size="sm" variant="ghost" onClick={downloadResults}><Download className="h-3.5 w-3.5 mr-1" />下载结果</Button>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button variant="outline" disabled={!file || busy} onClick={() => void upload(true)}>
            {busy ? '校验中...' : '试运行'}
          </Button>
          <Button disabled={!file || busy} onClick={() => void upload(false)}>
            {busy ? '导入中...' : '正式导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 批量邀请组件
function BulkInviteCard({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; ok: number; failed: number; dryRun: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(dryRun: boolean) {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (dryRun) fd.append('dryRun', '1');
      const r = await fetch('/api/admin/users/bulk-invite', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(j.error ?? `HTTP ${r.status}`); return; }
      setResults(j.results); setSummary(j.summary);
      if (!dryRun && onSuccess) onSuccess();
    } catch (e) { setErr(e instanceof Error ? e.message : '上传失败'); }
    finally { setBusy(false); }
  }

  function downloadResults() {
    if (!results) return;
    const lines = ['row,email,ok,code,registerUrl,error', ...results.map((r) => [r.row, r.email, r.ok, r.code ?? '', r.registerUrl ?? '', r.error ?? ''].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `bulk-invite-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="mt-4 border rounded-lg p-4 bg-warning/5 border-warning/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption font-medium flex items-center gap-2"><Upload className="h-4 w-4" />通讯录批量邀请</span>
        <a href="/api/admin/users/bulk-invite/template" className="text-footnote text-warning underline">下载模板</a>
      </div>
      <p className="text-footnote text-muted-foreground mb-3">CSV/Excel，列：email, name, department, roles / 每行生成邀请码 / 单批不超过 500 行</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-footnote" />
        <Button size="sm" variant="outline" disabled={!file || busy} onClick={() => void upload(true)}>{busy ? '校验中...' : '试运行'}</Button>
        <Button size="sm" disabled={!file || busy} onClick={() => void upload(false)}>{busy ? '生成中...' : '正式生成'}</Button>
        {results && <Button size="sm" variant="ghost" onClick={downloadResults}><Download className="h-3.5 w-3.5 mr-1" />下载结果</Button>}
      </div>
      {err && <div className="mt-2 text-footnote text-rose-700 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</div>}
      {summary && (
        <div className="mt-2 flex items-center gap-2 text-footnote">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">成功 {summary.ok}</Badge>
          {summary.failed > 0 && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">失败 {summary.failed}</Badge>}
          <span className="text-muted-foreground">共 {summary.total} 行 / {summary.dryRun ? '试运行' : '已生成'}</span>
        </div>
      )}
    </div>
  );
}
