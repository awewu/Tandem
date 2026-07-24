"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DriveShareDialog, type DriveShareItem } from "@/components/drive/drive-share-dialog";
import {
  Folder, File as FileIcon, HardDrive, Plus, Trash2, Upload, Download,
  Share2, Pencil, Scissors, ChevronRight, FolderInput,
  ChevronDown, Building2,
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
  ownerName?: string;
}

interface Crumb { id: string; name: string; }
interface DeptTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
  peopleCount: number;
  children: DeptTreeNode[];
}
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
  const [deptTree, setDeptTree] = useState<DeptTreeNode[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [showingDeptPeople, setShowingDeptPeople] = useState(false);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(() => new Set());
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
  const loadedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    setError(null);
    try {
      const orgUrl = parent
        ? `/api/drive/org-tree?folderId=${encodeURIComponent(parent)}`
        : "/api/drive/org-tree";
      const orgRes = await fetch(orgUrl, { credentials: "include", cache: "no-store" });
      if (orgRes.ok) {
        const org = await orgRes.json();
        if (Array.isArray(org.tree)) setDeptTree(org.tree);
        if (org.scope) setScope(org.scope);
        if (org.selectedIsDept) {
          const people: DriveItem[] = Array.isArray(org.people) ? org.people : [];
          people.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
          setItems(people);
          setSelectedDeptId(org.selectedDeptId ?? null);
          setSelectedDeptName(org.selectedDeptName ?? null);
          setShowingDeptPeople(true);
          if (Array.isArray(org.breadcrumbs) && org.breadcrumbs.length > 0) setCrumbs(org.breadcrumbs);
          return;
        }
      }

      const url = parent ? `/api/drive?parentId=${encodeURIComponent(parent)}` : "/api/drive";
      const r = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const list: DriveItem[] = Array.isArray(j.files) ? j.files : [];
      list.sort((a, b) => (a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1));
      setItems(list);
      setScope(j.scope ?? null);
      setShowingDeptPeople(false);
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
      loadedRef.current = true;
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
    const targetParent = showingDeptPeople ? selectedDeptId : parent;
    const r = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, isFolder: true, parentId: targetParent, storageKey: "" }),
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
    const targetParent = showingDeptPeople ? selectedDeptId : parent;
    setUploading(true);
    setError(null);
    try {
      const presign = await fetch("/api/drive/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "upload", fileName: file.name, contentType: file.type, parentId: targetParent }),
      });
      if (!presign.ok) {
        const j = await presign.json().catch(() => ({}));
        const message = j?.error?.message ?? j?.error ?? "对象存储未配置或无写权限";
        if (String(message).includes("object storage not configured")) {
          const form = new FormData();
          form.append("file", file);
          if (targetParent) form.append("parentId", targetParent);
          const localUpload = await fetch("/api/drive/upload", {
            method: "POST",
            credentials: "include",
            body: form,
          });
          if (!localUpload.ok) {
            const localJson = await localUpload.json().catch(() => ({}));
            throw new Error(localJson?.error?.message ?? localJson?.error ?? "上传失败");
          }
          void load();
          return;
        }
        throw new Error(message);
      }
      const { uploadUrl, storageKey } = await presign.json();
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error(`上传失败 HTTP ${put.status}`);
      const meta = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, storageKey, size: file.size, mimeType: file.type || "application/octet-stream", parentId: targetParent, isFolder: false }),
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

  function toggleDept(id: string) {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderDeptNode(node: DeptTreeNode, depth = 0): ReactNode {
    const selected = selectedDeptId === node.id;
    const hasChildren = node.children.length > 0;
    const expanded = expandedDeptIds.has(node.id);
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            setSelectedDeptId(node.id);
            setSelectedDeptName(node.name);
            setShowingDeptPeople(true);
            setParent(node.id);
          }}
          className={`flex w-full items-center gap-1.5 border-l-2 px-2 py-1.5 text-left transition-colors ${
            selected
              ? "border-brand-500 bg-brand-50/60 text-brand-700"
              : "border-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          }`}
          style={{ paddingLeft: depth * 14 + 8 }}
        >
          {hasChildren ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                toggleDept(node.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleDept(node.id);
                }
              }}
              className="shrink-0 rounded p-0.5 text-ink-tertiary hover:bg-surface-3"
              title={expanded ? "收起" : "展开"}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Folder size={15} className={`shrink-0 ${selected ? "text-brand-600" : "text-warning"}`} />
          <span className="min-w-0 flex-1 truncate text-caption font-medium">{node.name}</span>
          <span className="shrink-0 px-1 text-[10px] tabular-nums text-ink-tertiary">
            {node.peopleCount}
          </span>
        </button>
        {expanded && node.children.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child) => renderDeptNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto max-w-7xl md:px-8">
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

      {loading && deptTree.length === 0 ? (
        <div className="text-ink-secondary py-8">加载中…</div>
      ) : (
        <div className="grid min-h-[28rem] overflow-hidden border bg-surface-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="border-r bg-surface-1">
            <div className="flex h-10 items-center justify-between border-b px-3">
              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-secondary">
                <Building2 size={15} /> 部门
              </span>
              <span className="text-footnote text-ink-tertiary">{deptTree.length}</span>
            </div>
            <div className="max-h-[calc(100vh-16rem)] overflow-auto py-1">
              {deptTree.length === 0 ? (
                <div className="py-8 text-center text-footnote text-ink-tertiary">暂无部门文件夹</div>
              ) : (
                deptTree.map((node) => renderDeptNode(node))
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="flex h-10 items-center justify-between border-b px-3">
              <div className="min-w-0 truncate text-caption font-medium text-ink-primary">
                {showingDeptPeople ? `${selectedDeptName ?? "部门"} · 人员文件夹` : "文件列表"}
              </div>
              <span className="text-footnote text-ink-tertiary">{items.length} 项</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full table-fixed text-caption">
                <thead className="bg-surface-2 text-footnote text-ink-tertiary">
                  <tr className="border-b">
                    <th className="w-[48%] px-3 py-2 text-left font-medium">名称</th>
                    <th className="w-[18%] px-3 py-2 text-left font-medium">修改时间</th>
                    <th className="w-[14%] px-3 py-2 text-left font-medium">类型</th>
                    <th className="w-[10%] px-3 py-2 text-left font-medium">大小</th>
                    <th className="w-[10%] px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f.id} className="group border-b hover:bg-surface-2/70">
                      <td className="px-3 py-2">
                        <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => openFolder(f)} disabled={!f.isFolder}>
                          {f.isFolder ? <Folder size={17} className="shrink-0 text-warning" /> : <FileIcon size={17} className="shrink-0 text-info" />}
                          <span className="truncate font-medium text-ink-primary">{f.ownerName ?? f.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-ink-tertiary">{new Date(f.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-3 py-2 text-ink-tertiary">{f.isFolder ? "文件夹" : f.mimeType || "文件"}</td>
                      <td className="px-3 py-2 text-ink-tertiary">{f.isFolder ? "—" : fmtSize(f.size)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="text-center text-ink-tertiary py-16">
                  {scope && !scope.hasDepartment
                    ? "请先在组织架构中维护当前账号的部门归属"
                    : showingDeptPeople
                    ? "当前部门暂无直属人员文件夹"
                    : "此文件夹为空"}
                </div>
              )}
              {loading && <div className="border-t px-3 py-2 text-footnote text-ink-tertiary">正在更新...</div>}
              </div>
          </section>
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
