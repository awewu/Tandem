"use client";

import { useEffect, useState } from "react";
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

export default function NotificationsPage() {
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/notifications?userId=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        if (typeof data.unreadCount === "number") {
          window.dispatchEvent(new CustomEvent("tandem:notifications:unread", { detail: { unreadCount: data.unreadCount } }));
        }
        setLoading(false);
      });
  }, [currentUserId]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    window.dispatchEvent(new CustomEvent("tandem:notifications:unread", { detail: { unreadCount: Math.max(0, unreadCount - 1) } }));
  }

  async function dismiss(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    window.dispatchEvent(new CustomEvent("tandem:notifications:unread", { detail: { unreadCount: Math.max(0, unreadCount - (notifications.find((n) => n.id === id)?.readAt ? 0 : 1)) } }));
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (loading) return <div className="p-8 text-ink-secondary">加载中...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto md:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-title-3 font-bold flex items-center gap-2">
          <Bell size={24} /> 消息中心
          {unreadCount > 0 && (
            <span className="px-2 py-1 text-caption bg-danger text-white rounded-full">{unreadCount}</span>
          )}
        </h1>
      </div>

      <div className="mb-6">
        <PushSubscribeToggle />
      </div>

      <div className="space-y-2">
        {notifications.map((n) => {
          const Icon = typeIcon[n.type];
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 border rounded-lg transition ${
                n.readAt ? "bg-white" : "bg-info/10 border-info/30"
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
                  <button onClick={() => markRead(n.id)} className="p-2 text-success hover:bg-success/5 rounded" title="标记已读">
                    <Check size={16} />
                  </button>
                )}
                <button onClick={() => dismiss(n.id)} className="p-2 text-danger hover:bg-danger/5 rounded" title="删除">
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
    </div>
  );
}
