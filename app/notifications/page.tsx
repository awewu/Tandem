"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, MessageSquare, Calendar, FileText } from "lucide-react";
import { useCurrentUserId } from "@/lib/hooks/use-current-user";
import { PushSubscribeToggle } from "@/components/PushSubscribeToggle";

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  type: "mention" | "system" | "reminder" | "approval";
  userId: string;
  readAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

const typeIcon = {
  mention: MessageSquare,
  system: MessageSquare,
  reminder: Calendar,
  approval: FileText,
};

const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (targetPage = page) => {
    if (!currentUserId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/notifications?${params}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? "消息加载失败");
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
      setPage(typeof data.page === "number" ? data.page : targetPage);
      const nextUnreadCount = typeof data.unreadCount === "number" ? data.unreadCount : 0;
      setUnreadCount(nextUnreadCount);
      window.dispatchEvent(new CustomEvent("tandem:notifications:unread", { detail: { unreadCount: nextUnreadCount } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "消息加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, page]);

  useEffect(() => {
    void loadNotifications(1);
  }, [currentUserId]);

  async function markRead(id: string) {
    setActionId(id);
    setError("");
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) throw new Error("标记已读失败");
      await loadNotifications(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "标记已读失败");
    } finally {
      setActionId(null);
    }
  }

  async function dismiss(id: string) {
    setActionId(id);
    setError("");
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      if (!res.ok) throw new Error("删除通知失败");
      await loadNotifications(notifications.length === 1 && page > 1 ? page - 1 : page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除通知失败");
    } finally {
      setActionId(null);
    }
  }

  async function markAllRead() {
    if (bulkBusy || unreadCount <= 0) return;
    setBulkBusy(true);
    setError("");
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? "批量标记已读失败");
      await loadNotifications(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量标记已读失败");
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-ink-secondary">加载中...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto md:px-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-title-3 font-bold flex items-center gap-2">
            <Bell size={24} /> 消息中心
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-caption bg-danger text-white rounded-full">{unreadCount}</span>
            )}
          </h1>
          <div className="mt-1 text-caption text-ink-tertiary">
            共 {total} 条通知，{unreadCount} 条未读
          </div>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={bulkBusy || unreadCount <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 px-3 py-2 text-caption font-medium text-success transition hover:bg-success/5 disabled:cursor-not-allowed disabled:opacity-40"
          title="将所有未读通知设置为已读"
        >
          <Check size={15} />
          {bulkBusy ? "处理中..." : "全部已读"}
        </button>
      </div>

      <div className="mb-6">
        <PushSubscribeToggle />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => {
          const Icon = typeIcon[n.type];
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 border rounded-lg transition ${
                n.readAt ? "bg-surface-1" : "bg-info/10 border-info/30"
              }`}
            >
              <Icon size={20} className="text-ink-secondary mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{n.title}</div>
                <div className="text-caption text-ink-secondary">{n.body}</div>
                <div className="text-footnote text-ink-tertiary mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-1">
                {typeof n.data?.url === "string" && (
                  <button onClick={() => router.push(n.data?.url as string)} className="px-2 py-1 text-caption text-info hover:bg-info/5 rounded" title="查看来源">
                    查看
                  </button>
                )}
                {!n.readAt && (
                  <button onClick={() => markRead(n.id)} disabled={actionId === n.id} className="p-2 text-success hover:bg-success/5 rounded disabled:opacity-50" title="标记已读">
                    <Check size={16} />
                  </button>
                )}
                <button onClick={() => dismiss(n.id)} disabled={actionId === n.id} className="p-2 text-danger hover:bg-danger/5 rounded disabled:opacity-50" title="删除">
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && (
          <div className="text-center text-ink-tertiary py-12">暂无消息</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between rounded-lg border bg-surface-1 px-4 py-3 text-caption text-ink-secondary">
          <button
            type="button"
            className="rounded px-3 py-1.5 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => loadNotifications(page - 1)}
          >
            上一页
          </button>
          <span>
            第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条
          </span>
          <button
            type="button"
            className="rounded px-3 py-1.5 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => loadNotifications(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
