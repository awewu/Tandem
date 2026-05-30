"use client";

import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/lib/hooks/use-current-user";
import { Folder, File, HardDrive, Plus, Trash2, MoveRight } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  type: "folder" | "file";
  parentId: string | null;
  ownerId: string;
  updatedAt: string;
}

export default function DrivePage() {
  const currentUserId = useCurrentUserId();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "file" as "folder" | "file" });

  useEffect(() => {
    fetch("/api/drive")
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files ?? []);
        setLoading(false);
      });
  }, []);

  async function createFile(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        ownerId: currentUserId,
        tenantId: "default",
        parentId: null,
      }),
    });
    const f = await res.json();
    setFiles((prev) => [f, ...prev]);
    setShowForm(false);
    setForm({ name: "", type: "file" });
  }

  async function deleteFile(id: string) {
    await fetch(`/api/drive/${id}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading) return <div className="p-8 text-gray-500">加载中...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive size={24} /> 云盘
        </h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <Plus size={16} /> 新建
        </button>
      </div>

      {showForm && (
        <form onSubmit={createFile} className="mb-6 p-4 border rounded-lg bg-gray-50 space-y-3">
          <input required placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2 border rounded" />
          <select aria-label="类型" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "folder" | "file" })} className="w-full p-2 border rounded">
            <option value="file">文件</option>
            <option value="folder">文件夹</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">创建</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
            {f.type === "folder" ? <Folder size={20} className="text-amber-500" /> : <File size={20} className="text-blue-500" />}
            <div className="flex-1">
              <div className="font-medium">{f.name}</div>
              <div className="text-xs text-gray-400">{new Date(f.updatedAt).toLocaleString()}</div>
            </div>
            <button aria-label="删除" onClick={() => deleteFile(f.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {files.length === 0 && (
          <div className="text-center text-gray-400 py-12">云盘为空，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
}
