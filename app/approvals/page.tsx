"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Check, X, Clock, ChevronRight } from "lucide-react";

interface Approval {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  requester: string;
  approver: string;
  createdAt: string;
  type: "leave" | "expense" | "project" | "other";
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/approvals")
      .then((r) => r.json())
      .then((data) => { setItems(data.approvals ?? []); setLoading(false); });
  }, []);

  async function action(id: string, status: "approved" | "rejected") {
    await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  }

  const filtered = items.filter((i) => filter === "all" || i.status === filter);

  if (loading) return <div className="p-8 text-ink-secondary">加载中...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto md:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-title-3 font-bold flex items-center gap-2"><ClipboardCheck size={24} /> 审批流</h1>
        <div className="flex gap-1 bg-surface-3 rounded-lg p-1">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md text-caption font-medium transition ${filter === f ? "bg-white shadow-soft-sm" : "text-ink-secondary"}`}>
              {f === "all" ? "全部" : f === "pending" ? "待审批" : f === "approved" ? "已通过" : "已驳回"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-soft transition">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.status === "approved" ? "bg-success/10 text-success" : item.status === "rejected" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
              {item.status === "approved" ? <Check size={20} /> : item.status === "rejected" ? <X size={20} /> : <Clock size={20} />}
            </div>
            <div className="flex-1">
              <div className="font-medium">{item.title}</div>
              <div className="text-caption text-ink-secondary">{item.requester} → {item.approver} · {new Date(item.createdAt).toLocaleString()}</div>
            </div>
            <span className="text-footnote px-2 py-1 rounded-full bg-surface-3">{item.type === "leave" ? "请假" : item.type === "expense" ? "报销" : item.type === "project" ? "立项" : "其他"}</span>
            {item.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => action(item.id, "approved")} className="px-3 py-1.5 bg-success text-white rounded text-caption hover:bg-success">通过</button>
                <button onClick={() => action(item.id, "rejected")} className="px-3 py-1.5 bg-danger text-white rounded text-caption hover:bg-danger">驳回</button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-ink-tertiary py-12">暂无审批</div>}
      </div>
    </div>
  );
}
