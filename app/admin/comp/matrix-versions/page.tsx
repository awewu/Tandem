'use client';

/**
 * /admin/comp/matrix-versions — HR 矩阵版本发布台
 *
 * 列出版本 (draft/published/archived) · 创建新版本 · 发布 (旧 published 自动归档)
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, GitBranch, Upload, FileEdit, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface MatrixVersion {
  id: string;
  version: string;
  effectiveFrom: string;
  publishedBy: string | null;
  changelog: string | null;
  status: string;
}

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-warning/10 text-warning border-warning/30',
  published: 'bg-success/10 text-success border-success/30',
  archived: 'bg-muted/10 text-muted-foreground border-muted/30',
};

export default function MatrixVersionsPage() {
  const [rows, setRows] = useState<MatrixVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [newChangelog, setNewChangelog] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/matrix-versions', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(status: 'draft' | 'published') {
    if (!newVersion) return;
    setError(null);
    setMsg(null);
    try {
      const r = await fetch('/api/comp/admin/matrix-versions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: newVersion, changelog: newChangelog, status }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setMsg(status === 'published' ? `版本 ${newVersion} 已发布` : `版本 ${newVersion} 已创建为草稿`);
      setNewVersion('');
      setNewChangelog('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // --- 发布确认弹窗 ---
  const [publishPending, setPublishPending] = useState(false);
  const hasPublished = rows.some((r) => r.status === 'published');

  function confirmPublish() {
    setPublishPending(false);
    void create('published');
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          矩阵版本发布
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          技能矩阵版本管理 · 发布时旧 published 自动归档 · 认证锁定版本
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
      {msg && <Card className="border-success/30 bg-success/5"><CardContent className="py-2 text-caption text-success">{msg}</CardContent></Card>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">新建版本</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              版本号
              <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="v2.0" className="h-8 w-28 text-[12px]" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground flex-1 min-w-[200px]">
              变更日志
              <Input value={newChangelog} onChange={(e) => setNewChangelog(e.target.value)} placeholder="新增3项技能, 调整L3定价" className="h-8 text-[12px]" />
            </label>
            <Button size="sm" variant="outline" className="h-8 text-[12px] gap-1" onClick={() => create('draft')} disabled={!newVersion}>
              <FileEdit className="h-3 w-3" /> 存草稿
            </Button>
            <Button size="sm" className="h-8 text-[12px] gap-1" onClick={() => setPublishPending(true)} disabled={!newVersion}>
              <Upload className="h-3 w-3" /> 发布
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">版本列表 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无版本记录</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">版本</th>
                  <th className="text-left font-medium py-1.5">状态</th>
                  <th className="text-left font-medium py-1.5">生效时间</th>
                  <th className="text-left font-medium py-1.5">发布人</th>
                  <th className="text-left font-medium py-1.5">变更日志</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5 font-medium">{r.version}</td>
                    <td className="py-1.5">
                      <Badge variant="outline" className={cn('text-[9px] scale-90', STATUS_CLS[r.status] ?? '')}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-muted-foreground tabular-nums">{new Date(r.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-1.5 text-muted-foreground">{r.publishedBy ?? '—'}</td>
                    <td className="py-1.5 max-w-[300px] truncate text-muted-foreground">{r.changelog ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {/* 发布确认弹窗 */}
      <Dialog open={publishPending} onOpenChange={(open) => !open && setPublishPending(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              确认发布版本 {newVersion}
            </DialogTitle>
            <DialogDescription>
              {hasPublished ? (
                <>发布后，当前已发布版本将自动归档，此操作不可逆。</>
              ) : (
                <>将发布版本 {newVersion} 为当前生效版本，此操作不可逆。</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPublishPending(false)}>取消</Button>
            <Button size="sm" className="gap-1" onClick={confirmPublish}>
              <Upload className="h-3 w-3" /> 确认发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
