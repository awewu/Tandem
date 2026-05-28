"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Lock, Unlock, Save, Users } from "lucide-react";
import { CollabTextarea } from "@/components/documents/collab-textarea";

interface DocumentDetail {
  id: string;
  title: string;
  content: string;
  type: string;
  ownerId: string;
  isLocked: boolean;
  permissions: Record<string, string>;
  updatedAt: string;
}

export default function DocumentEditorPage() {
  const { id } = useParams() as { id: string };
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDoc(data);
        setTitle(data.title);
        setContent(data.content);
      });
  }, [id]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setSaving(false);
  }, [id, title, content]);

  // P3-12: 协同编辑下每 30s 静默 auto-save (CollabTextarea 已通过 Yjs 实时同步,
  // 但服务器重启 / 单人离线时仍需要落库). dirty=true 才发请求.
  useEffect(() => {
    if (!doc) return;
    const t = setInterval(() => {
      if (saving) return;
      if (title === doc.title && content === doc.content) return;
      void fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      }).then(() => {
        setDoc((d) => (d ? { ...d, title, content, updatedAt: new Date().toISOString() } : d));
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [id, title, content, doc, saving]);

  const toggleLock = useCallback(async () => {
    await fetch(`/api/documents/${id}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !doc?.isLocked }),
    });
    setDoc((d) => (d ? { ...d, isLocked: !d.isLocked } : d));
  }, [id, doc]);

  if (!doc) return <div className="p-8 text-gray-500">加载中...</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <input
          aria-label="文档标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-xl font-bold border-none outline-none"
        />
        <div className="flex items-center gap-2">
          <button onClick={toggleLock} className="p-2 rounded hover:bg-gray-100" title={doc.isLocked ? "解锁" : "锁定"}>
            {doc.isLocked ? <Lock size={18} className="text-amber-500" /> : <Unlock size={18} />}
          </button>
          <button onClick={save} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <Save size={16} /> {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6">
          <CollabTextarea
            docId={id}
            userName={doc.ownerId}
            fallback={content}
            onLocalChange={setContent}
          />
        </div>

        <div className="w-64 border-l p-4 bg-gray-50 overflow-auto">
          <h3 className="font-medium mb-3 flex items-center gap-1">
            <Users size={16} /> 协作权限
          </h3>
          <div className="space-y-2 text-sm">
            {Object.entries(doc.permissions).map(([uid, role]) => (
              <div key={uid} className="flex justify-between p-2 bg-white rounded border">
                <span>{uid}</span>
                <span className="text-gray-500">{role}</span>
              </div>
            ))}
            {Object.keys(doc.permissions).length === 0 && (
              <div className="text-gray-400">暂无协作者</div>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-400">
            最后更新: {new Date(doc.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
