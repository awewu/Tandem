/**
 * /admin/organization - 企业 HR 组织管理
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Network, Building2, Users, Search, RefreshCw, AlertCircle,
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, Upload, Download,
  ShieldCheck, X, KeyRound, UserX, UserCheck,
} from 'lucide-react';

interface HrDept {
  id: string; name: string; parentId: string | null; headId: string | null;
  description: string; order: number; tenantId: string; createdAt: string; updatedAt: string;
}
interface OrgUser {
  id: string; email: string; name: string; roles: string[]; disabled?: boolean;
  departmentId?: string | null; departmentName?: string | null; jobTitle?: string | null; managerId?: string | null;
  employeeId?: string | null; hireDate?: string | null; workLocation?: string | null; phone?: string | null;
}
interface BulkResult { row: number; email: string; ok: boolean; code?: string; error?: string; registerUrl?: string }
interface ImportResult { row: number; email: string; ok: boolean; action?: string; error?: string }
interface RoleDefinition {
  key: string; name: string; description: string; kind: 'internal' | 'external';
  permissions: string[]; system: boolean; enabled: boolean; sortOrder: number;
}
interface PermissionOption { key: string; label: string; description: string }

const NONE_VALUE = '__none__';

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Admin',    color: 'bg-danger/5 text-danger border-danger/30' },
  champion: { label: '推广大使', color: 'bg-brand-50 text-brand-700 border-brand-200' },
  steward:  { label: 'Steward',  color: 'bg-warning/5 text-warning border-warning/20' },
  manager:  { label: '主管',     color: 'bg-info/10 text-info border-info/30' },
  hr:       { label: 'HR',       color: 'bg-success/10 text-success border-success/30' },
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
  return parts.join(' / ') || id;
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
  open, onClose, onSave, user, depts, users, roleDefinitions,
}: {
  open: boolean; onClose: () => void;
  onSave: (patch: Partial<OrgUser>) => Promise<void>;
  user: OrgUser | null; depts: HrDept[]; users: OrgUser[]; roleDefinitions: RoleDefinition[];
}) {
  const [form, setForm] = useState<Partial<OrgUser>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const managerPickerRef = useRef<HTMLDivElement | null>(null);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  useEffect(() => {
    if (open && user) {
      setForm({ name: user.name ?? '', departmentId: user.departmentId ?? NONE_VALUE, jobTitle: user.jobTitle ?? '', managerId: user.managerId ?? NONE_VALUE, employeeId: user.employeeId ?? '', hireDate: user.hireDate ?? '', workLocation: user.workLocation ?? '', phone: user.phone ?? '' });
      setRoles(user.roles ?? []);
    }
  }, [open, user]);
  const set = (k: keyof OrgUser, v: string) => setForm((p) => ({ ...p, [k]: v === NONE_VALUE ? null : (v || null) }));
  const isOwner = (user?.roles ?? []).includes('owner');
  const managerCandidates = useMemo(
    () => users.filter((u) => u.id !== user?.id && !u.disabled),
    [user?.id, users],
  );
  const managerLabel = useMemo(() => {
    const managerId = form.managerId;
    if (!managerId || managerId === NONE_VALUE) return '无';
    return managerCandidates.find((u) => u.id === managerId)?.name ?? '未知人员';
  }, [form.managerId, managerCandidates]);
  const managerItems = useMemo(
    (): Array<{ value: string; label: string; hint?: string }> => [
      { value: NONE_VALUE, label: '无' },
      ...managerCandidates.map((u) => ({
        value: u.id,
        label: u.name,
        hint: [u.departmentName, u.jobTitle].filter(Boolean).join(' · '),
      })),
    ],
    [managerCandidates],
  );
  const filteredManagerItems = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q || q === managerLabel.toLowerCase()) return managerItems;
    return managerItems.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      (item.hint ?? '').toLowerCase().includes(q),
    );
  }, [managerItems, managerLabel, managerSearch]);

  useEffect(() => {
    if (!managerPickerOpen) setManagerSearch(managerLabel);
  }, [managerLabel, managerPickerOpen]);

  useEffect(() => {
    if (!managerPickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (managerPickerRef.current?.contains(target)) return;
      setManagerPickerOpen(false);
      setManagerSearch(managerLabel);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [managerLabel, managerPickerOpen]);

  function chooseManager(value: string) {
    set('managerId', value);
    setManagerPickerOpen(false);
  }

  const toggleRole = (r: string) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  async function submit() {
    const nextName = (form.name ?? '').trim();
    if (!nextName) return;
    setSaving(true);
    try {
      // owner 锁定: 始终保留原 owner 位, 只提交非空角色集 (至少 employee 兜底).
      const base = roles.filter((r) => r !== 'owner');
      const merged = isOwner ? ['owner', ...base] : base;
      const finalRoles = merged.length > 0 ? Array.from(new Set(merged)) : ['employee'];
      await onSave({ ...form, name: nextName, roles: finalRoles });
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
            <label className="text-caption font-medium mb-1 block">姓名</label>
            <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="请输入姓名" />
          </div>
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
            <div ref={managerPickerRef} className="relative">
              <Input
                value={managerPickerOpen ? managerSearch : managerLabel}
                onChange={(e) => {
                  setManagerSearch(e.target.value);
                  setManagerPickerOpen(true);
                }}
                onFocus={() => {
                  setManagerSearch('');
                  setManagerPickerOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setManagerPickerOpen(false);
                    return;
                  }
                  if (e.key === 'Enter' && filteredManagerItems[0]) {
                    e.preventDefault();
                    chooseManager(filteredManagerItems[0].value);
                  }
                }}
                placeholder="输入姓名搜索"
                className="pr-8"
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {managerPickerOpen && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-soft-lg">
                  {filteredManagerItems.length === 0 ? (
                    <div className="px-3 py-2 text-caption text-muted-foreground">没有匹配的上级</div>
                  ) : (
                    filteredManagerItems.map((item) => {
                      const active = (form.managerId ?? NONE_VALUE) === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => chooseManager(item.value)}
                          className={`block w-full px-3 py-2 text-left text-caption ${
                            active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          }`}
                        >
                          <span className="block">{item.label}</span>
                          {item.hint && <span className="block text-footnote text-muted-foreground">{item.hint}</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
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
          <div className="col-span-2">
            <label className="text-caption font-medium mb-1 block">角色</label>
            <div className="flex flex-wrap gap-1.5">
              {isOwner && (
                <Badge variant="outline" className="bg-warning/5 text-warning border-warning gap-1">
                  <ShieldCheck className="h-3 w-3" />{roleDefinitions.find((role) => role.key === 'owner')?.name ?? '公司主'}（锁定）
                </Badge>
              )}
              {roleDefinitions.filter((role) => role.enabled && role.key !== 'owner').map((role) => {
                const active = roles.includes(role.key);
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => toggleRole(role.key)}
                    className={`px-2 py-1 rounded-md border text-caption transition-colors ${active ? 'bg-primary/10 border-primary/40 text-primary font-medium' : 'bg-surface-1 border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
            <p className="text-footnote text-muted-foreground mt-1.5">点击切换角色；可多选。未选任何角色时默认为员工。</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={saving || !(form.name ?? '').trim()}>{saving ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleManagerDialog({
  open, onClose, roles, permissionCatalog, onChanged,
}: {
  open: boolean; onClose: () => void; roles: RoleDefinition[];
  permissionCatalog: PermissionOption[]; onChanged: () => Promise<void>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RoleDefinition>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = roles.find((role) => role.key === selectedKey) ?? null;

  const edit = useCallback((role: RoleDefinition | null) => {
    setSelectedKey(role?.key ?? null);
    setForm(role ? { ...role, permissions: [...role.permissions] } : {
      key: '', name: '', description: '', kind: 'internal', permissions: [], enabled: true,
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const current = roles.find((role) => role.key === selectedKey);
    edit(current ?? roles[0] ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function togglePermission(key: string) {
    setForm((previous) => {
      const permissions = previous.permissions ?? [];
      return { ...previous, permissions: permissions.includes(key) ? permissions.filter((item) => item !== key) : [...permissions, key] };
    });
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const isNew = !selected;
      const url = isNew ? '/api/admin/roles' : `/api/admin/roles/${encodeURIComponent(selected.key)}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await assertOk(res);
      await onChanged();
      if (isNew) {
        const body = await res.json().catch(() => null);
        setSelectedKey(body?.role?.key ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!selected || !confirm(`删除角色「${selected.name}」？`)) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(selected.key)}`, { method: 'DELETE' });
      await assertOk(res);
      await onChanged();
      edit(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败');
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>角色与权限</DialogTitle></DialogHeader>
        <div className="grid min-h-[460px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-md border">
          <div className="border-r bg-muted/20 p-2">
            <Button variant="outline" size="sm" className="mb-2 w-full" onClick={() => edit(null)}>
              <Plus className="mr-1 h-4 w-4" />新建角色
            </Button>
            <div className="space-y-1 overflow-y-auto">
              {roles.map((role) => (
                <button key={role.key} type="button" onClick={() => edit(role)}
                  className={`w-full rounded px-2 py-2 text-left text-caption ${selectedKey === role.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                  <span className="block font-medium">{role.name}</span>
                  <span className="block truncate text-footnote text-muted-foreground">{role.key}{role.enabled ? '' : ' · 已停用'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-medium">角色名称</label>
                <Input value={form.name ?? ''} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="例如：内网审核员" />
              </div>
              <div>
                <label className="mb-1 block text-caption font-medium">角色编码</label>
                <Input value={form.key ?? ''} disabled={!!selected} onChange={(event) => setForm((value) => ({ ...value, key: event.target.value }))} placeholder="例如：intranet_reviewer" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-caption font-medium">说明</label>
                <Input value={form.description ?? ''} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="说明这个角色负责什么" />
              </div>
              <div>
                <label className="mb-1 block text-caption font-medium">人员类型</label>
                <Input value={form.kind === 'external' ? '外部协作者' : '内部人员'} disabled />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-caption">
                <input type="checkbox" checked={form.enabled !== false} disabled={selected?.key === 'owner'} onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.checked }))} />
                启用角色
              </label>
            </div>
            <div>
              <div className="mb-2 text-caption font-medium">权限</div>
              <div className="grid grid-cols-2 gap-2">
                {permissionCatalog.map((permission) => (
                  <label key={permission.key} className="flex min-h-[58px] items-start gap-2 rounded border p-2.5 hover:bg-muted/30">
                    <input className="mt-0.5" type="checkbox" checked={(form.permissions ?? []).includes(permission.key)} onChange={() => togglePermission(permission.key)} />
                    <span><span className="block text-caption font-medium">{permission.label}</span><span className="block text-footnote text-muted-foreground">{permission.description}</span></span>
                  </label>
                ))}
              </div>
            </div>
            {error && <div className="text-caption text-danger">{error}</div>}
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>{selected && !selected.system && <Button variant="outline" onClick={remove} disabled={saving}><Trash2 className="mr-1 h-4 w-4" />删除</Button>}</div>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>关闭</Button><Button onClick={save} disabled={saving || !form.name || !form.key}>{saving ? '保存中...' : '保存'}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 重置密码弹窗
function PasswordDialog({
  open, onClose, onSave, user,
}: {
  open: boolean; onClose: () => void;
  onSave: (newPassword: string) => Promise<void>;
  user: OrgUser | null;
}) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setPwd(''); setConfirm(''); setShow(false); setErr(null); }
  }, [open]);
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const tooShort = pwd.length > 0 && pwd.length < 10;
  async function submit() {
    setErr(null);
    if (pwd !== confirm) { setErr('两次输入的密码不一致'); return; }
    setSaving(true);
    try {
      await onSave(pwd);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置失败');
    } finally {
      setSaving(false);
    }
  }
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>重置密码 · {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-footnote text-muted-foreground">
            将为 <span className="font-mono">{user.email}</span> 设置新密码，保存后该员工所有会话将被强制登出。
            请通过安全渠道告知其新密码。
          </p>
          <div>
            <label className="text-caption font-medium mb-1 block">新密码 *</label>
            <Input type={show ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder="至少 10 位，含大小写字母、数字、特殊字符" autoComplete="new-password" />
            {tooShort && <p className="text-footnote text-danger mt-1">密码至少 10 位</p>}
          </div>
          <div>
            <label className="text-caption font-medium mb-1 block">确认新密码 *</label>
            <Input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="再次输入" autoComplete="new-password" />
            {mismatch && <p className="text-footnote text-danger mt-1">两次输入不一致</p>}
          </div>
          <label className="flex items-center gap-2 text-caption text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />显示密码
          </label>
          {err && (
            <div className="flex items-center gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
              <AlertCircle className="h-4 w-4" />{err}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={saving || pwd.length < 10 || pwd !== confirm}>
            {saving ? '保存中...' : '重置密码'}
          </Button>
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
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
          selected
            ? 'bg-primary/12 text-primary ring-1 ring-primary/30 shadow-soft-sm'
            : 'hover:bg-muted/40'
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelectDept(dept.id)}
      >
        <button onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }} className={`shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          {children.length > 0 ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5 inline-block" />}
        </button>
        <Building2 className={`h-3.5 w-3.5 shrink-0 ${selected || depth === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-caption flex-1 truncate ${selected || depth === 0 ? 'font-semibold' : 'font-medium'}`}>{dept.name}</span>
        {head && <span className="text-footnote text-muted-foreground hidden group-hover:inline truncate max-w-[80px]">{head.name}</span>}
        <Badge variant={selected ? 'default' : 'secondary'} className="h-4 px-1 text-[10px] tabular-nums shrink-0">{total}</Badge>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button title="新增子部门" className="p-0.5 rounded hover:bg-muted" onClick={() => onAddChild(dept.id)}><Plus className="h-3 w-3" /></button>
          <button title="编辑" className="p-0.5 rounded hover:bg-muted" onClick={() => onEdit(dept)}><Pencil className="h-3 w-3" /></button>
          <button title="删除" className="p-0.5 rounded hover:bg-danger/10 text-danger" onClick={() => onDelete(dept)}><Trash2 className="h-3 w-3" /></button>
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
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  // dept dialog
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; initial?: HrDept | null; preParent?: string | null }>({ open: false });
  // user dialog
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: OrgUser | null }>({ open: false, user: null });
  // password reset dialog
  const [pwdDialog, setPwdDialog] = useState<{ open: boolean; user: OrgUser | null }>({ open: false, user: null });
  // contact import
  const [importOpen, setImportOpen] = useState(false);
  // bulk invite
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  const loadRoles = useCallback(async () => {
    const response = await fetch('/api/admin/roles', { cache: 'no-store' });
    await assertOk(response);
    const body = await response.json();
    setRoleDefinitions(body.roles ?? []);
    setPermissionCatalog(body.permissionCatalog ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dr, ur, rr] = await Promise.all([
        fetch('/api/org/departments', { cache: 'no-store' }),
        fetch('/api/org/users', { cache: 'no-store' }),
        fetch('/api/admin/roles', { cache: 'no-store' }),
      ]);
      if (!dr.ok || !ur.ok || !rr.ok) throw new Error('加载失败');
      const [dj, uj, rj] = await Promise.all([dr.json(), ur.json(), rr.json()]);
      setDepts(dj.depts ?? []);
      setUsers(uj.users ?? []);
      setRoleDefinitions(rj.roles ?? []);
      setPermissionCatalog(rj.permissionCatalog ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const childrenMap = useMemo(() => buildDeptChildren(depts), [depts]);
  const roleByKey = useMemo(() => new Map(roleDefinitions.map((role) => [role.key, role])), [roleDefinitions]);
  const rootDepts = childrenMap.get(null) ?? [];

  const filteredUsers = useMemo(() => {
    const lc = q.toLowerCase();
    const selectedDeptIds = selectedDeptId ? collectDeptSubtreeIds(selectedDeptId, childrenMap) : null;
    return users.filter((u) => {
      if (roleFilter !== 'all' && !u.roles.includes(roleFilter)) return false;
      if (selectedDeptIds && (!u.departmentId || !selectedDeptIds.has(u.departmentId))) return false;
      if (lc && !u.name.toLowerCase().includes(lc) && !u.email.toLowerCase().includes(lc) && !(u.jobTitle ?? '').toLowerCase().includes(lc) && !(u.employeeId ?? '').toLowerCase().includes(lc) && !(u.departmentName ?? '').toLowerCase().includes(lc)) return false;
      return true;
    });
  }, [users, q, roleFilter, selectedDeptId, childrenMap]);

  useEffect(() => {
    setPage(1);
  }, [q, roleFilter, selectedDeptId, pageSize, users.length]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredUsers.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filteredUsers.length);
  const pagedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage, pageSize]);

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

  async function toggleDisabled(u: OrgUser) {
    const next = !u.disabled;
    if (!confirm(next ? `禁用「${u.name}」？该账号将无法登录，且现有会话被登出。` : `恢复「${u.name}」的登录权限？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/org/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled: next }) });
      await assertOk(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  }

  async function resetPassword(newPassword: string) {
    if (!pwdDialog.user) return;
    const res = await fetch(`/api/org/users/${pwdDialog.user.id}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) });
    await assertOk(res);
  }

  return (
    <div className="w-full max-w-none px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
      <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="shrink-0">
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            组织架构管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">部门树 / 员工归属 / 汇报关系 / HR 数据维护</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex-nowrap">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜索姓名/邮箱/职务" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 pl-8" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[120px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              {roleDefinitions.map((role) => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="shrink-0 text-footnote text-muted-foreground tabular-nums">
            {filteredUsers.length} / {users.length} 人
            {selectedDeptId && <> / {depts.find((d) => d.id === selectedDeptId)?.name}</>}
          </span>
          <Button className="shrink-0" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />导入通讯录
          </Button>
          <Button className="shrink-0" variant="outline" size="sm" onClick={() => setBulkOpen((p) => !p)}>
            <Upload className="h-4 w-4 mr-1" />批量邀请
          </Button>
          <Button className="shrink-0" variant="outline" size="sm" onClick={() => setRolesOpen(true)}>
            <ShieldCheck className="h-4 w-4 mr-1" />角色权限
          </Button>
          <Button className="shrink-0" size="sm" onClick={() => setDeptDialog({ open: true, initial: null })}>
            <Plus className="h-4 w-4 mr-1" />新建部门
          </Button>
          <Button className="shrink-0" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-caption text-danger bg-danger/5 border border-danger/30 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <div className="flex flex-col items-start gap-3 lg:flex-row">
        {/* 左侧：部门树 */}
        <div className="w-full shrink-0 lg:w-56">
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
        <div className="min-w-0 w-full flex-1">
          {/* 员工表格 */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[980px] text-caption">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap w-[220px]">姓名</th>
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap w-[180px]">职务</th>
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap w-[140px]">部门</th>
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap hidden md:table-cell">直属上级</th>
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap hidden lg:table-cell">工号</th>
                  <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap min-w-[120px]">角色</th>
                  <th className="sticky right-0 z-20 w-32 border-l bg-muted px-3 py-1.5 text-right font-medium whitespace-nowrap shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.18)]">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">加载中...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">暂无数据</td></tr>
                ) : pagedUsers.map((u) => {
                  const manager = users.find((m) => m.id === u.managerId);
                  return (
                    <tr key={u.id} className={`group border-t hover:bg-muted/20 transition-colors ${u.disabled ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-1 w-[220px]">
                        <div className="font-medium leading-4 flex items-center gap-1.5">
                          <span className="truncate">{u.name}</span>
                          {u.disabled && (
                            <Badge variant="outline" className="bg-danger/5 text-danger border-danger/30 text-[10px] h-4 px-1 shrink-0">已禁用</Badge>
                          )}
                        </div>
                        <div className="text-footnote leading-4 text-muted-foreground font-mono truncate max-w-[200px]">{u.email}</div>
                      </td>
                      <td className="px-3 py-1 text-muted-foreground w-[180px]">
                        <div className="truncate max-w-[180px]">{u.jobTitle || '-'}</div>
                      </td>
                      <td className="px-3 py-1 text-muted-foreground w-[140px]">
                        <div className="truncate max-w-[140px]">{u.departmentName ?? deptPath(u.departmentId, depts)}</div>
                      </td>
                      <td className="px-3 py-1 text-muted-foreground hidden md:table-cell">
                        {manager?.name || '-'}
                      </td>
                      <td className="px-3 py-1 text-muted-foreground font-mono text-footnote hidden lg:table-cell">
                        {u.employeeId || '-'}
                      </td>
                      <td className="px-3 py-1 min-w-[120px]">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((r) => {
                            const builtIn = ROLE_LABEL[r];
                            const m = builtIn ?? { label: roleByKey.get(r)?.name ?? r, color: 'bg-surface-1 text-ink-primary border' };
                            return (
                              <Badge key={r} variant="outline" className={`${m.color} text-[10px] gap-0.5 h-4 px-1`}>
                                {(r === 'admin' || r === 'champion') && <ShieldCheck className="h-2.5 w-2.5" />}
                                {m.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="sticky right-0 z-10 border-l bg-background px-2 py-1 whitespace-nowrap shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.18)] group-hover:bg-muted">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            className="shrink-0 p-1.5 rounded-md border border-transparent hover:bg-muted hover:border-border text-muted-foreground hover:text-foreground"
                            title="编辑员工信息"
                            onClick={() => setUserDialog({ open: true, user: u })}
                          ><Pencil className="h-4 w-4" /></button>
                          <button
                            className="shrink-0 p-1.5 rounded-md border border-transparent hover:bg-muted hover:border-border text-muted-foreground hover:text-foreground"
                            title="重置密码"
                            onClick={() => setPwdDialog({ open: true, user: u })}
                          ><KeyRound className="h-4 w-4" /></button>
                          {u.disabled ? (
                            <button
                              className="shrink-0 p-1.5 rounded-md border border-success/30 text-success hover:bg-success/10"
                              title="恢复账号"
                              onClick={() => toggleDisabled(u)}
                            ><UserCheck className="h-4 w-4" /></button>
                          ) : (
                            <button
                              className="shrink-0 p-1.5 rounded-md border border-danger/30 text-danger hover:bg-danger/5"
                              title="禁用账号"
                              onClick={() => toggleDisabled(u)}
                            ><UserX className="h-4 w-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-footnote text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>条</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {pageStart}-{pageEnd} / {filteredUsers.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  上一页
                </Button>
                <span className="min-w-[56px] text-center tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
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
        roleDefinitions={roleDefinitions}
      />
      <RoleManagerDialog
        open={rolesOpen}
        onClose={() => setRolesOpen(false)}
        roles={roleDefinitions}
        permissionCatalog={permissionCatalog}
        onChanged={loadRoles}
      />
      <PasswordDialog
        open={pwdDialog.open}
        onClose={() => setPwdDialog({ open: false, user: null })}
        onSave={resetPassword}
        user={pwdDialog.user}
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
            <div className="flex items-center gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
              <AlertCircle className="h-4 w-4" />{err}
            </div>
          )}
          {summary && (
            <div className="flex flex-wrap items-center gap-2 text-caption">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">成功 {summary.ok}</Badge>
              {summary.failed > 0 && <Badge variant="outline" className="bg-danger/5 text-danger border-danger/30">失败 {summary.failed}</Badge>}
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
      {err && <div className="mt-2 text-footnote text-danger flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</div>}
      {summary && (
        <div className="mt-2 flex items-center gap-2 text-footnote">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">成功 {summary.ok}</Badge>
          {summary.failed > 0 && <Badge variant="outline" className="bg-danger/5 text-danger border-danger/30">失败 {summary.failed}</Badge>}
          <span className="text-muted-foreground">共 {summary.total} 行 / {summary.dryRun ? '试运行' : '已生成'}</span>
        </div>
      )}
    </div>
  );
}
