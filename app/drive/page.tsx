"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DriveShareDialog, type DriveShareItem } from "@/components/drive/drive-share-dialog";
import {
  Folder, File as FileIcon, HardDrive, Plus, Trash2, Upload, Download,
  Share2, Pencil, Scissors, ClipboardPaste, ChevronRight, X,
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
}

interface Crumb { id: string; name: string; }

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clipboard, setClipboard] = useState<DriveItem | null>(null);
  const [shareTarget, setShareTarget] = useState<DriveShareItem | null>(null);
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
      const cr = await fetch(`/api/drive/breadcrumbs?folderId=${encodeURIComponent(parent ?? "root")}`, {
        credentials: "include", cache: "no-store",
      });
      if (cr.ok) {
        const cj = await cr.json();
        if (Array.isArray(cj.breadcrumbs) && cj.breadcrumbs.length > 0) setCrumbs(cj.breadcrumbs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [parent]);

  useEffect(() => { void load(); }, [load]);

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
    if (!window.confirm(`删除「${item.name}」？`)) return;
    const r = await fetch(`/api/drive/${item.id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) { setError("删除失败（无写权限）"); return; }
    void load();
  }

  async function pasteHere() {
    if (!clipboard) return;
    const r = await fetch(`/api/drive/${clipboard.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ parentId: parent }),
    });
    if (!r.ok) { setError("移动失败（无目标写权限）"); return; }
    setClipboard(null);
    void load();
  }

  function openFolder(item: DriveItem) {
    if (item.isFolder) setParent(item.id);
  }

  function navCrumb(c: Crumb) {
    setParent(c.id === "root" ? null : c.id);
  }

  const isOwner = (item: DriveItem) => item.ownerId === me;

  return (
    <div className="p-6 max-w-5xl mx-auto md:px-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-title-3 font-bold flex items-center gap-2">
          <HardDrive size={22} /> 我的工作云盘
        </h1>
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

      {clipboard && (
        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-md bg-info/10 border border-info/20 text-caption">
          <span>移动「{clipboard.name}」到当前文件夹？</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={pasteHere}><ClipboardPaste size={14} className="mr-1" />粘贴到此</Button>
            <Button size="sm" variant="ghost" onClick={() => setClipboard(null)}><X size={14} /></Button>
          </div>
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
                    {f.nodeRole && <span className="ml-1 text-info">· {f.nodeRole}</span>}
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
                <button aria-label="移动" title="移动" onClick={() => setClipboard(f)} className="p-1.5 hover:bg-surface-3 rounded"><Scissors size={15} /></button>
                <button aria-label="删除" title="删除" onClick={() => remove(f)} className="p-1.5 text-danger hover:bg-danger/5 rounded"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-ink-tertiary py-12">此文件夹为空</div>
          )}
        </div>
      )}

      <DriveShareDialog
        open={!!shareTarget}
        onOpenChange={(v) => { if (!v) setShareTarget(null); }}
        file={shareTarget}
        onSaved={load}
      />
    </div>
  );
}
