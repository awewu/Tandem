"use client";

import { useEffect, useState } from "react";
import { Video, Plus, Users, CalendarDays, Copy } from "lucide-react";
import { useCurrentUserId } from "@/lib/hooks/use-current-user";

interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
  nextBooking?: { title: string; start: string; end: string };
}

export default function MeetingsPage() {
  const currentUserId = useCurrentUserId();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinId, setJoinId] = useState("");

  useEffect(() => {
    fetch("/api/meetings/rooms")
      .then((r) => r.json())
      .then((data) => { setRooms(data.rooms ?? []); setLoading(false); });
  }, []);

  async function bookRoom(id: string) {
    const title = window.prompt("会议主题:");
    if (!title) return;
    await fetch("/api/meetings/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, title, userId: currentUserId, start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() }),
    });
    alert("已预订");
  }

  function copyJoinUrl(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/meetings/${id}`);
    alert("会议链接已复制");
  }

  if (loading) return <div className="p-8 text-ink-secondary">加载中...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-title-3 font-bold flex items-center gap-2"><Video size={24} /> 会议室</h1>
        <div className="flex gap-2">
          <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="输入会议号加入" className="p-2 border rounded-lg text-caption w-48" />
          <button onClick={() => { if (joinId) window.open(`/meetings/${joinId}`, "_blank"); }} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-caption hover:bg-brand-600">加入</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="p-5 border rounded-2xl hover:shadow-soft-lg transition">
            <div className="flex items-start justify-between mb-3">
              <div className="font-semibold text-headline">{room.name}</div>
              <span className={`text-footnote px-2 py-1 rounded-full ${room.status === "available" ? "bg-success/10 text-success" : room.status === "occupied" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                {room.status === "available" ? "空闲" : room.status === "occupied" ? "占用中" : "已预订"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-caption text-ink-secondary mb-4"><Users size={14} /> 容纳 {room.capacity} 人</div>
            {room.nextBooking && (
              <div className="text-caption text-ink-secondary mb-3 p-2 bg-surface-2 rounded"><CalendarDays size={14} className="inline mr-1" />{room.nextBooking.title}<br/>{new Date(room.nextBooking.start).toLocaleString()} - {new Date(room.nextBooking.end).toLocaleTimeString()}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => bookRoom(room.id)} className="flex-1 px-3 py-2 bg-brand-500 text-white rounded-lg text-caption hover:bg-brand-600">立即预订</button>
              <button onClick={() => copyJoinUrl(room.id)} className="p-2 border rounded-lg hover:bg-surface-2" title="复制会议链接"><Copy size={16} /></button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <div className="col-span-full text-center text-ink-tertiary py-12">暂无会议室</div>}
      </div>
    </div>
  );
}
