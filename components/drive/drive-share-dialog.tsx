'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { X } from 'lucide-react';

export interface DriveShareItem {
  id: string;
  name: string;
  permissions?: { read?: string[]; write?: string[] };
}

interface Dept {
  id: string;
  name: string;
}

type PrincipalKind = 'dept' | 'role' | 'user' | 'all';

/** 把 principal 字符串转成人类可读标签. */
function labelFor(p: string, depts: Dept[]): string {
  if (p === 'all') return '全公司';
  const [kind, ...rest] = p.split(':');
  const val = rest.join(':');
  if (kind === 'dept') return `部门 · ${depts.find((d) => d.id === val)?.name ?? val}`;
  if (kind === 'role') return `角色 · ${ROLE_LABELS[val as keyof typeof ROLE_LABELS] ?? val}`;
  if (kind === 'user') return `成员 · ${val}`;
  return p;
}

export function DriveShareDialog({
  open,
  onOpenChange,
  file,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: DriveShareItem | null;
  onSaved?: () => void;
}) {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [write, setWrite] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新增行草稿
  const [kind, setKind] = useState<PrincipalKind>('dept');
  const [deptVal, setDeptVal] = useState('');
  const [roleVal, setRoleVal] = useState('employee');
  const [userVal, setUserVal] = useState('');
  const [scope, setScope] = useState<'read' | 'readwrite'>('read');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRead(file?.permissions?.read ?? []);
    setWrite(file?.permissions?.write ?? []);
    fetch('/api/org/departments', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { depts: [] }))
      .then((j) => setDepts(Array.isArray(j.depts) ? j.depts : []))
      .catch(() => setDepts([]));
  }, [open, file]);

  const roleOptions = useMemo(() => Object.entries(ROLE_LABELS), []);

  function buildPrincipal(): string | null {
    if (kind === 'all') return 'all';
    if (kind === 'dept') return deptVal ? `dept:${deptVal}` : null;
    if (kind === 'role') return roleVal ? `role:${roleVal}` : null;
    if (kind === 'user') return userVal.trim() ? `user:${userVal.trim()}` : null;
    return null;
  }

  function addPrincipal() {
    const p = buildPrincipal();
    if (!p) return;
    setRead((prev) => (prev.includes(p) ? prev : [...prev, p]));
    if (scope === 'readwrite') setWrite((prev) => (prev.includes(p) ? prev : [...prev, p]));
    setUserVal('');
  }

  function removePrincipal(p: string) {
    setRead((prev) => prev.filter((x) => x !== p));
    setWrite((prev) => prev.filter((x) => x !== p));
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/drive/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: { read, write } }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? j?.error ?? `HTTP ${r.status}`);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>共享「{file?.name}」</DialogTitle>
          <DialogDescription>
            设置谁可以访问。可读=能看/下载；可读写=还能改名/移动/上传到此。owner 恒可读写。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="text-footnote text-muted-foreground">主体</label>
              <Select value={kind} onValueChange={(v) => setKind(v as PrincipalKind)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dept">部门</SelectItem>
                  <SelectItem value="role">角色</SelectItem>
                  <SelectItem value="user">指定人</SelectItem>
                  <SelectItem value="all">全公司</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === 'dept' && (
              <div className="flex-1 min-w-[8rem]">
                <label className="text-footnote text-muted-foreground">部门</label>
                <Select value={deptVal} onValueChange={setDeptVal}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="选择部门" /></SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === 'role' && (
              <div className="flex-1 min-w-[8rem]">
                <label className="text-footnote text-muted-foreground">角色</label>
                <Select value={roleVal} onValueChange={setRoleVal}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === 'user' && (
              <div className="flex-1 min-w-[8rem]">
                <label className="text-footnote text-muted-foreground">成员 userId/邮箱</label>
                <Input className="mt-1" value={userVal} onChange={(e) => setUserVal(e.target.value)} placeholder="user@corp.com" />
              </div>
            )}

            <div className="w-28">
              <label className="text-footnote text-muted-foreground">权限</label>
              <Select value={scope} onValueChange={(v) => setScope(v as 'read' | 'readwrite')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">可读</SelectItem>
                  <SelectItem value="readwrite">可读写</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={addPrincipal}>添加</Button>
          </div>

          <div>
            <div className="text-footnote font-medium text-muted-foreground mb-1">当前可访问</div>
            {read.length === 0 && <div className="text-footnote text-muted-foreground">仅 owner 可见</div>}
            <div className="flex flex-wrap gap-1.5">
              {read.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1">
                  {labelFor(p, depts)}
                  {write.includes(p) && <span className="text-[10px] text-emerald-600">·写</span>}
                  <button aria-label="移除" onClick={() => removePrincipal(p)} className="ml-0.5 hover:text-danger">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {error && <div className="text-footnote text-danger">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存共享'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
