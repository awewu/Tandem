"use client";

import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/lib/hooks/use-current-user";
import Link from "next/link";
import { FileText, Plus, Lock, Sheet, Presentation } from "lucide-react";

interface Document {
  id: string;
  title: string;
  type: "doc" | "sheet" | "slide";
  ownerId: string;
  updatedAt: string;
  isLocked: boolean;
}

const typeIcon = {
  doc: FileText,
  sheet: Sheet,
  slide: Presentation,
};

export default function DocumentsPage() {
  const currentUserId = useCurrentUserId();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.documents ?? []);
        setLoading(false);
      });
  }, []);

  async function createDoc(type: "doc" | "sheet" | "slide") {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `新建${type === "doc" ? "文档" : type === "sheet" ? "表格" : "幻灯片"}`,
        content: "",
        type,
        ownerId: currentUserId,
        tenantId: "default",
      }),
    });
    const doc = await res.json();
    setDocs((prev) => [doc, ...prev]);
  }

  if (loading) return <div className="p-8 text-gray-500">加载中...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">文档协作</h1>
        <div className="flex gap-2">
          <button onClick={() => createDoc("doc")} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <Plus size={16} /> 文档
          </button>
          <button onClick={() => createDoc("sheet")} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            <Plus size={16} /> 表格
          </button>
          <button onClick={() => createDoc("slide")} className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            <Plus size={16} /> 幻灯片
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {docs.map((doc) => {
          const Icon = typeIcon[doc.type];
          return (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="flex items-center gap-3 p-4 border rounded-lg hover:shadow-md transition"
            >
              <Icon size={20} className="text-gray-500" />
              <div className="flex-1">
                <div className="font-medium">{doc.title}</div>
                <div className="text-sm text-gray-400">
                  {new Date(doc.updatedAt).toLocaleString()}
                </div>
              </div>
              {doc.isLocked && <Lock size={16} className="text-amber-500" />}
            </Link>
          );
        })}
        {docs.length === 0 && (
          <div className="text-center text-gray-400 py-12">暂无文档，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
}
