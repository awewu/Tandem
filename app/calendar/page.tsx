"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Users } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees: string[];
  createdBy: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", start: "", end: "", location: "" });

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      });
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        createdBy: "demo-user",
        tenantId: "default",
        attendees: ["demo-user"],
      }),
    });
    const evt = await res.json();
    setEvents((prev) => [evt, ...prev]);
    setShowForm(false);
    setForm({ title: "", start: "", end: "", location: "" });
  }

  if (loading) return <div className="p-8 text-gray-500">加载中...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon size={24} /> 日程管理
        </h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <Plus size={16} /> 新建日程
        </button>
      </div>

      {showForm && (
        <form onSubmit={createEvent} className="mb-6 p-4 border rounded-lg bg-gray-50 space-y-3">
          <input required placeholder="日程标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-2 border rounded" />
          <div className="flex gap-3">
            <input aria-label="开始时间" required type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="flex-1 p-2 border rounded" />
            <input aria-label="结束时间" required type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="flex-1 p-2 border rounded" />
          </div>
          <input placeholder="地点 (可选)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full p-2 border rounded" />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">创建</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {events.map((evt) => (
          <div key={evt.id} className="p-4 border rounded-lg hover:shadow-md transition">
            <div className="font-medium text-lg">{evt.title}</div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock size={14} /> {new Date(evt.start).toLocaleString()} - {new Date(evt.end).toLocaleString()}</span>
              {evt.location && <span className="flex items-center gap-1"><MapPin size={14} /> {evt.location}</span>}
              <span className="flex items-center gap-1"><Users size={14} /> {evt.attendees.length} 人</span>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-center text-gray-400 py-12">暂无日程，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
}
