"use client";

import { useEffect, useState } from "react";
import { Bell, Check, X, MessageSquare, Calendar, FileText, HardDrive } from "lucide-react";
import { useCurrentUserId } from "@/lib/hooks/use-current-user";
import { PushSubscribeToggle } from "@/components/PushSubscribeToggle";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "document" | "calendar" | "drive" | "system";
  userId: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

const typeIcon = {
  document: FileText,
  calendar: Calendar,
  drive: HardDrive,
  system: MessageSquare,
};

export default function NotificationsPage() {
  const currentUserId = useCurrentUserId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/notifications?userId=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
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
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function dismiss(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <div className="p-8 text-gray-500">加载中...</div>;

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
                n.read ? "bg-white" : "bg-blue-50 border-blue-200"
              }`}
            >
              <Icon size={20} className="text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{n.title}</div>
                <div className="text-caption text-gray-500">{n.message}</div>
                <div className="text-footnote text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-1">
                {!n.read && (
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
          <div className="text-center text-gray-400 py-12">暂无消息</div>
        )}
      </div>
    </div>
  );
}
