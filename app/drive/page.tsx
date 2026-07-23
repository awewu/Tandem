"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DriveShareDialog, type DriveShareItem } from "@/components/drive/drive-share-dialog";
import {
  Folder, File as FileIcon, HardDrive, Plus, Trash2, Upload, Download,
  Share2, Pencil, Scissors, ChevronRight, FolderInput,
} from "lucide-react";

interface DriveItem {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  ownerId: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  nodeRole?: string | null;
  permissions?: { read?: string[]; write?: string[] };
  childCount?: number;
  canDelete?: boolean;
  deleteDisabledReason?: string | null;
}

interface Crumb { id: string; name: string; }
interface DriveScope {
  rootFolderId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  hasDepartment: boolean;
  isAdmin: boolean;
}

function fmtSize(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DrivePage() {
  const { user } = useCurrentUser();
  const me = user?.id;
  const [parent, setParent] = useState<string | null>(null); // null = root
  const [items, setItems] = useState<DriveItem[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "我的工作云盘" }]);
  const [scope, setScope] = useState<DriveScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareTarget, setShareTarget] = useState<DriveShareItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<DriveItem | null>(null);
  const [moveParent, setMoveParent] = useState<string | null>(null);
  const [moveItems, setMoveItems] = useState<DriveItem[]>([]);
  const [moveCrumbs, setMoveCrumbs] = useState<Crumb[]>([{ id: "root", name: "我的工作云盘" }]);
  const [moveLoading, setMoveLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = parent ? `/api/drive?parentId=${encodeURIComponent(parent)}` : "/api/drive";
      const r = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const list: DriveItem[] = Array.isArray(j.files) ? j.files : [];
      list.sort((a, b) => (a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1));
      setItems(list);
      setScope(j.scope ?? null);
      const cr = await fetch(`/api/drive/breadcrumbs?folderId=${encodeURIComponent(parent ?? "root")}`, {
        credentials: "include", cache: "no-store",
      });
      if (cr.ok) {
        const cj = await cr.json();
        if (Array.isArray(cj.breadcrumbs) && cj.breadcrumbs.length > 0) setCrumbs(cj.breadcrumbs);
        if (cj.scope) setScope(cj.scope);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [parent]);

  useEffect(() => { void load(); }, [load]);

  const loadMoveFolder = useCallback(async (folderId: string | null) => {
    setMoveLoading(true);
    setError(null);
    try {
      const url = folderId ? `/api/drive?parentId=${encodeURIComponent(folderId)}` : "/api/drive";
      const r = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const folders = (Array.isArray(j.files) ? j.files : [])
        .filter((item: DriveItem) => item.isFolder && item.id !== moveTarget?.id)
        .sort((a: DriveItem, b: DriveItem) => a.name.localeCompare(b.name));
      setMoveItems(folders);
      const cr = await fetch(`/api/drive/breadcrumbs?folderId=${encodeURIComponent(folderId ?? "root")}`, {
        credentials: "include", cache: "no-store",
      });
      if (cr.ok) {
        const cj = await cr.json();
        if (Array.isArray(cj.breadcrumbs) && cj.breadcrumbs.length > 0) setMoveCrumbs(cj.breadcrumbs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载目标文件夹失败");
      setMoveItems([]);
    } finally {
      setMoveLoading(false);
    }
  }, [moveTarget?.id]);

  useEffect(() => {
    if (moveTarget) void loadMoveFolder(moveParent);
  }, [moveTarget, moveParent, loadMoveFolder]);

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    const r = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, isFolder: true, parentId: parent, storageKey: "" }),
    });
    if (!r.ok) { setError("新建文件夹失败（可能无写权限）"); return; }
    setNewFolder("");
    setShowNewFolder(false);
    void load();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const presign = await fetch("/api/drive/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "upload", fileName: file.name, contentType: file.type, parentId: parent }),
      });
      if (!presign.ok) {
        const j = await presign.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? j?.error ?? "对象存储未配置或无写权限");
      }
      const { uploadUrl, storageKey } = await presign.json();
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error(`上传失败 HTTP ${put.status}`);
      const meta = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, storageKey, size: file.size, mimeType: file.type || "application/octet-stream", parentId: parent, isFolder: false }),
      });
      if (!meta.ok) throw new Error("提交元数据失败");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function download(item: DriveItem) {
    try {
      const r = await fetch("/api/drive/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "download", fileId: item.id }),
      });
      if (!r.ok) { setError("下载失败（对象存储未配置或无权限）"); return; }
      const { url } = await r.json();
      window.open(url, "_blank");
    } catch {
      setError("下载失败");
    }
  }

  async function rename(item: DriveItem) {
    const name = window.prompt("重命名为：", item.name);
    if (!name || name.trim() === item.name) return;
    const r = await fetch(`/api/drive/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!r.ok) { setError("改名失败（无写权限）"); return; }
    void load();
  }

  async function remove(item: DriveItem) {
    if (!item.canDelete) {
      setError(item.deleteDisabledReason ?? "当前文件不可删除");
      return;
    }
    if (!window.confirm(`删除「${item.name}」？`)) return;
    const r = await fetch(`/api/drive/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error?.message ?? j?.error ?? "删除失败");
      return;
    }
    void load();
  }

  async function confirmMove() {
    if (!moveTarget) return;
    if (moveTarget.id === moveParent) {
      setError("不能移动到自身");
      return;
    }
    const r = await fetch(`/api/drive/${moveTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ parentId: moveParent }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error?.message ?? j?.error ?? "移动失败（无目标写权限）");
      return;
    }
    setMoveTarget(null);
    setMoveParent(null);
    void load();
  }

  function openFolder(item: DriveItem) {
    if (item.isFolder) setParent(item.id);
  }

  function navCrumb(c: Crumb) {
    setParent(c.id === "root" ? null : c.id);
  }

  function openMoveDialog(item: DriveItem) {
    setMoveTarget(item);
    setMoveParent(null);
    setMoveCrumbs([{ id: "root", name: "我的工作云盘" }]);
    setMoveItems([]);
  }

  const isOwner = (item: DriveItem) => item.ownerId === me;

  return (
    <div className="p-6 max-w-5xl mx-auto md:px-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-title-3 font-bold flex items-center gap-2">
            <HardDrive size={22} /> 我的工作云盘
          </h1>
          <div className="mt-1 text-footnote text-ink-tertiary">
            {!scope
              ? "正在确认当前组织范围"
              : scope.isAdmin
              ? "管理员视图：可查看全部组织文件"
              : scope.hasDepartment
              ? `当前部门：${scope.departmentName ?? "未命名部门"}，仅显示当前组织下的文件`
              : "当前账号未关联部门，暂不能访问组织云盘"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewFolder((v) => !v)}>
            <Plus size={15} className="mr-1" /> 新建文件夹
          </Button>
          <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} className="mr-1" /> {uploading ? "上传中…" : "上传文件"}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onUpload} aria-label="上传文件" />
        </div>
      </div>

      {/* 面包屑 */}
      <div className="flex items-center flex-wrap gap-1 text-caption text-muted-foreground mb-3">
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} />}
            <button
              className={i === crumbs.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"}
              onClick={() => navCrumb(c)}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {showNewFolder && (
        <div className="flex gap-2 mb-4">
          <Input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="文件夹名称" className="max-w-xs" />
          <Button size="sm" onClick={createFolder}>创建</Button>
          <Button size="sm" variant="outline" onClick={() => { setShowNewFolder(false); setNewFolder(""); }}>取消</Button>
        </div>
      )}

      {error && <div className="text-footnote text-danger mb-3">{error}</div>}

      {loading ? (
        <div className="text-ink-secondary py-8">加载中…</div>
      ) : (
        <div className="grid gap-1.5">
          {items.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-surface-2 transition group">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => openFolder(f)} disabled={!f.isFolder}>
                {f.isFolder ? <Folder size={19} className="text-warning shrink-0" /> : <FileIcon size={19} className="text-info shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-footnote text-ink-tertiary">
                    {new Date(f.updatedAt).toLocaleDateString()} {fmtSize(f.size)}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                {!f.isFolder && (
                  <button aria-label="下载" title="下载" onClick={() => download(f)} className="p-1.5 hover:bg-surface-3 rounded"><Download size={15} /></button>
                )}
                {isOwner(f) && (
                  <button aria-label="共享" title="共享" onClick={() => setShareTarget(f)} className="p-1.5 hover:bg-surface-3 rounded"><Share2 size={15} /></button>
                )}
                <button aria-label="改名" title="改名" onClick={() => rename(f)} className="p-1.5 hover:bg-surface-3 rounded"><Pencil size={15} /></button>
                <button aria-label="移动" title="移动" onClick={() => openMoveDialog(f)} className="p-1.5 hover:bg-surface-3 rounded"><Scissors size={15} /></button>
                <button
                  aria-label="删除"
                  title={f.canDelete ? "删除" : f.deleteDisabledReason ?? "不可删除"}
                  disabled={!f.canDelete}
                  onClick={() => remove(f)}
                  className="p-1.5 text-danger hover:bg-danger/5 rounded disabled:text-ink-tertiary disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-ink-tertiary py-12">
              {scope && !scope.hasDepartment ? "请先在组织架构中维护当前账号的部门归属" : "此文件夹为空"}
            </div>
          )}
        </div>
      )}

      <DriveShareDialog
        open={!!shareTarget}
        onOpenChange={(v) => { if (!v) setShareTarget(null); }}
        file={shareTarget}
        onSaved={load}
      />
      <Dialog open={!!moveTarget} onOpenChange={(v) => { if (!v) setMoveTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>移动「{moveTarget?.name}」</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-surface-2 p-3">
              <div className="text-footnote text-ink-tertiary mb-1">目标位置</div>
              <div className="flex items-center flex-wrap gap-1 text-caption">
                {moveCrumbs.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={13} />}
                    <button
                      className={i === moveCrumbs.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"}
                      onClick={() => setMoveParent(c.id === "root" ? null : c.id)}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              {moveLoading ? (
                <div className="p-4 text-ink-tertiary">加载中…</div>
              ) : moveItems.length === 0 ? (
                <div className="p-4 text-ink-tertiary">当前没有可选子文件夹</div>
              ) : (
                <div className="divide-y">
                  {moveItems.map((folder) => (
                    <button
                      key={folder.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                      onClick={() => setMoveParent(folder.id)}
                    >
                      <Folder size={17} className="text-warning shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>取消</Button>
            <Button onClick={confirmMove}>
              <FolderInput size={15} className="mr-1" />移动到这里
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
