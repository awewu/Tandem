"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, Crown, Pencil, Eye, X, Plus, Globe, Lock, Search } from "lucide-react";

export interface DocPermissions {
  read?: string[];
  write?: string[];
  publicAccess?: boolean;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface Props {
  docId: string;
  ownerId: string;
  permissions: DocPermissions;
  /** 当前登录用户的真实 id (auth user.id) — 用于判断是否可管理 */
  currentUserId?: string;
  /** owner/admin 角色可管理任意文档权限 */
  isAdmin?: boolean;
  /** 持久化成功后回传最新 permissions */
  onChange: (next: DocPermissions) => void;
}

type Role = "read" | "write";

/**
 * 文档协作权限配置 (CRUD · 权限配置)
 *
 * - owner 始终拥有全部权限, 不可移除
 * - 可管理者 (owner / write 协作者): 增删协作者、切换读/写、开关公开访问
 * - 非管理者: 只读展示
 * - 全部变更走 PATCH /api/documents/[id]/permissions (服务端二次鉴权)
 */
export function DocumentPermissions({ docId, ownerId, permissions, currentUserId, isAdmin, onChange }: Props) {
  const read = useMemo(() => permissions.read ?? [], [permissions.read]);
  const write = useMemo(() => permissions.write ?? [], [permissions.write]);
  const publicAccess = !!permissions.publicAccess;

  const canManage =
    !!isAdmin || (!!currentUserId && (currentUserId === ownerId || write.includes(currentUserId)));

  // 协作者 = read ∪ write, 排除 owner
  const collaborators = useMemo(() => {
    const ids = new Set<string>([...read, ...write]);
    ids.delete(ownerId);
    return Array.from(ids).map((id) => ({ id, role: (write.includes(id) ? "write" : "read") as Role }));
  }, [read, write, ownerId]);

  // id -> {name,email} 解析 (展示用)
  const [directory, setDirectory] = useState<Record<string, OrgUser>>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/org/users", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data: { users?: OrgUser[] }) => {
        if (cancelled) return;
        const map: Record<string, OrgUser> = {};
        for (const u of data.users ?? []) map[u.id] = u;
        setDirectory(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const label = useCallback(
    (id: string) => {
      const u = directory[id];
      return u ? u.name || u.email : id;
    },
    [directory],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(
    async (next: DocPermissions) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/${docId}/permissions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            read: next.read ?? [],
            write: next.write ?? [],
            publicAccess: !!next.publicAccess,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error === "forbidden" ? "无权限修改协作设置" : data?.error ?? "保存失败");
          return false;
        }
        onChange(data.permissions ?? next);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "网络错误");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [docId, onChange],
  );

  const setRole = useCallback(
    (id: string, role: Role) => {
      const nextRead = new Set(read);
      const nextWrite = new Set(write);
      if (role === "write") {
        nextWrite.add(id);
        nextRead.add(id); // write 隐含 read
      } else {
        nextWrite.delete(id);
        nextRead.add(id);
      }
      void persist({ read: Array.from(nextRead), write: Array.from(nextWrite), publicAccess });
    },
    [read, write, publicAccess, persist],
  );

  const removeCollaborator = useCallback(
    (id: string) => {
      void persist({
        read: read.filter((x) => x !== id),
        write: write.filter((x) => x !== id),
        publicAccess,
      });
    },
    [read, write, publicAccess, persist],
  );

  const togglePublic = useCallback(() => {
    void persist({ read, write, publicAccess: !publicAccess });
  }, [read, write, publicAccess, persist]);

  const addCollaborator = useCallback(
    (id: string, role: Role) => {
      if (id === ownerId) return;
      const nextRead = new Set(read);
      const nextWrite = new Set(write);
      nextRead.add(id);
      if (role === "write") nextWrite.add(id);
      void persist({ read: Array.from(nextRead), write: Array.from(nextWrite), publicAccess });
    },
    [read, write, publicAccess, ownerId, persist],
  );

  return (
    <div>
      <h3 className="font-medium mb-3 flex items-center gap-1">
        <Users size={16} /> 协作权限
      </h3>

      {/* 公开访问 */}
      <button
        type="button"
        onClick={togglePublic}
        disabled={!canManage || busy}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded border text-caption transition ${
          publicAccess
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-hairline bg-white text-ink-secondary"
        } ${!canManage ? "opacity-60 cursor-default" : "hover:bg-surface-3"}`}
        title={canManage ? "切换：同租户所有人可读" : "仅管理者可修改"}
      >
        {publicAccess ? <Globe size={14} /> : <Lock size={14} />}
        <span className="flex-1 text-left">
          {publicAccess ? "公开 · 同租户所有人可读" : "私有 · 仅协作者可见"}
        </span>
      </button>

      {/* owner */}
      <div className="mt-3 space-y-1.5 text-caption">
        <div className="flex items-center justify-between p-2 bg-white rounded border">
          <span className="flex items-center gap-1.5 truncate">
            <Crown size={13} className="text-amber-500 shrink-0" />
            <span className="truncate">{label(ownerId)}</span>
          </span>
          <span className="text-ink-tertiary shrink-0">所有者</span>
        </div>

        {collaborators.map(({ id, role }) => (
          <div key={id} className="flex items-center justify-between p-2 bg-white rounded border gap-2">
            <span className="flex items-center gap-1.5 truncate flex-1">
              {role === "write" ? (
                <Pencil size={13} className="text-emerald-600 shrink-0" />
              ) : (
                <Eye size={13} className="text-ink-tertiary shrink-0" />
              )}
              <span className="truncate">{label(id)}</span>
            </span>
            {canManage ? (
              <div className="flex items-center gap-1 shrink-0">
                <select
                  aria-label={`${label(id)} 权限`}
                  value={role}
                  disabled={busy}
                  onChange={(e) => setRole(id, e.target.value as Role)}
                  className="text-[11px] border border-hairline rounded px-1 py-0.5 bg-white"
                >
                  <option value="read">可阅读</option>
                  <option value="write">可编辑</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeCollaborator(id)}
                  disabled={busy}
                  className="p-1 rounded hover:bg-rose-50 text-rose-500"
                  title="移除协作者"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <span className="text-ink-tertiary shrink-0">{role === "write" ? "可编辑" : "可阅读"}</span>
            )}
          </div>
        ))}

        {collaborators.length === 0 && (
          <div className="text-ink-tertiary py-1">暂无其他协作者</div>
        )}
      </div>

      {canManage && (
        <AddCollaborator
          ownerId={ownerId}
          existingIds={collaborators.map((c) => c.id)}
          onAdd={addCollaborator}
          busy={busy}
        />
      )}

      {error && <div className="mt-2 text-[11px] text-rose-600">{error}</div>}
    </div>
  );
}

function AddCollaborator({
  ownerId,
  existingIds,
  onAdd,
  busy,
}: {
  ownerId: string;
  existingIds: string[];
  onAdd: (id: string, role: Role) => void;
  busy: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OrgUser[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("read");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/org/users?q=${encodeURIComponent(term)}`, {
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((data: { users?: OrgUser[] }) => {
          const exclude = new Set([ownerId, ...existingIds]);
          setResults((data.users ?? []).filter((u) => !exclude.has(u.id)).slice(0, 8));
          setOpen(true);
        })
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q, ownerId, existingIds]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative mt-3">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="搜索成员加为协作者…"
            aria-label="搜索协作者"
            className="w-full pl-7 pr-2 py-1.5 text-caption border border-hairline rounded bg-white outline-none focus:border-brand-400"
          />
        </div>
        <select
          aria-label="新增协作者权限"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="text-[11px] border border-hairline rounded px-1 py-1.5 bg-white"
        >
          <option value="read">可阅读</option>
          <option value="write">可编辑</option>
        </select>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-hairline rounded-md shadow-soft max-h-56 overflow-auto">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => {
                onAdd(u.id, role);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-caption text-left hover:bg-surface-3"
            >
              <span className="truncate">
                <span className="font-medium">{u.name || u.email}</span>
                {u.name && u.email && (
                  <span className="text-ink-tertiary ml-1 text-[11px]">{u.email}</span>
                )}
              </span>
              <Plus size={13} className="text-brand-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
