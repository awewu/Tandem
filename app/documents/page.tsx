"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Lock, Sheet, Presentation, Upload, Brain, Trash2, Users } from "lucide-react";
import { parseDocument } from "@/lib/document-parser";

interface Document {
  id: string;
  title: string;
  type: "doc" | "sheet" | "slide";
  ownerId: string;
  updatedAt: string;
  isLocked: boolean;
  /** 服务端按鉴权上下文计算: 是否可删除 (owner/admin) */
  canDelete?: boolean;
}

const typeIcon = {
  doc: FileText,
  sheet: Sheet,
  slide: Presentation,
};

export default function DocumentsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const isAdmin = !!user?.roles?.some((r) => r === "owner" || r === "admin");
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [promoteOnUpload, setPromoteOnUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/documents", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.documents ?? []);
        setLoading(false);
      });
  }, []);

  async function deleteDoc(e: React.MouseEvent, doc: Document) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确认删除「${doc.title}」？此操作不可恢复。`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error === "Only owner can delete" ? "仅文档所有者可删除" : data?.error ?? "删除失败");
    }
  }

  async function createDoc(type: "doc" | "sheet" | "slide") {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: `新建${type === "doc" ? "文档" : type === "sheet" ? "表格" : "幻灯片"}`,
        content: "",
        type,
      }),
    });
    const doc = await res.json();
    setDocs((prev) => [doc, ...prev]);
  }

  /**
   * D-01: 上传文件 → parseDocument → POST /api/documents (type=doc, content=parsed)
   * D-04: 若 promoteOnUpload, 自动调 /api/documents/:id/promote-to-memory (team level)
   */
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    let okCount = 0;
    let failCount = 0;
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      setUploadStatus(`解析 ${file.name}...`);
      try {
        const parsed = await parseDocument(file);
        const meta = [
          parsed.format,
          parsed.pages != null ? `${parsed.pages}页` : null,
          parsed.sheets != null ? `${parsed.sheets}表` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const header = meta ? `<!-- 来源: 上传 · ${meta} -->\n\n` : "";
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: file.name,
            content: header + parsed.text,
            type: "doc",
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = (await res.json()) as Document & { id: string };
        setDocs((prev) => [doc, ...prev]);

        // D-04: 自动提议升级 Memory (复用 promoteDocumentToMemory)
        if (promoteOnUpload) {
          await fetch(`/api/documents/${doc.id}/promote-to-memory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposedType: "lesson", level: "team" }),
          }).catch(() => {
            // 失败不阻断上传 (fire-and-forget)
          });
        }
        okCount++;
      } catch (err) {
        failCount++;
        failures.push(`${file.name} (${err instanceof Error ? err.message : "未知"})`);
      }
    }
    if (failCount === 0) {
      setUploadStatus(
        `✅ 上传 ${okCount} 个文件成功${promoteOnUpload ? " · 已提议升级 Memory" : ""}`,
      );
    } else if (okCount > 0) {
      setUploadStatus(`⚠️ 成功 ${okCount}, 失败 ${failCount}: ${failures[0]}`);
    } else {
      setUploadStatus(`❌ 全部失败: ${failures[0]}`);
    }
    window.setTimeout(() => setUploadStatus(null), 6000);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) return <div className="p-8 text-ink-secondary">加载中...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto md:px-8">
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <h1 className="text-title-3 font-bold">文档协作</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-2 bg-ink-primary text-white rounded hover:opacity-90"
            title="上传 PDF/Word/Excel/PPT/文本, 自动解析 + 提议升级 Memory"
          >
            <Upload size={16} /> 上传
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            aria-label="上传文件"
          />
          <label className="flex items-center gap-1 px-2 py-1.5 text-caption text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={promoteOnUpload}
              onChange={(e) => setPromoteOnUpload(e.target.checked)}
              className="accent-brand-600"
            />
            <Brain size={14} /> 自动提议升级 Memory
          </label>
          <button onClick={() => createDoc("doc")} className="flex items-center gap-1 px-3 py-2 bg-brand-500 text-white rounded hover:bg-brand-600">
            <Plus size={16} /> 文档
          </button>
          <button onClick={() => createDoc("sheet")} className="flex items-center gap-1 px-3 py-2 bg-success text-white rounded hover:bg-success">
            <Plus size={16} /> 表格
          </button>
          <button onClick={() => createDoc("slide")} className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
            <Plus size={16} /> 幻灯片
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className="mb-4 px-3 py-2 text-caption text-ink-secondary bg-surface-2 rounded-md border border-hairline">
          {uploadStatus}
        </div>
      )}

      <div className="grid gap-3">
        {docs.map((doc) => {
          const Icon = typeIcon[doc.type];
          return (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="group flex items-center gap-3 p-4 border rounded-lg hover:shadow-soft transition"
            >
              <Icon size={20} className="text-ink-secondary" />
              <div className="flex-1">
                <div className="font-medium">{doc.title}</div>
                <div className="text-caption text-ink-tertiary">
                  {new Date(doc.updatedAt).toLocaleString()}
                </div>
              </div>
              {doc.isLocked && <Lock size={16} className="text-warning" />}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/documents/${doc.id}`); }}
                className="p-2 rounded hover:bg-surface-3 text-ink-tertiary"
                title="打开并管理协作权限"
                aria-label={`管理 ${doc.title} 的权限`}
              >
                <Users size={16} />
              </button>
              {(doc.canDelete ?? (isAdmin || doc.ownerId === user?.id)) && (
                <button
                  type="button"
                  onClick={(e) => deleteDoc(e, doc)}
                  className="p-2 rounded hover:bg-rose-50 text-rose-400"
                  title="删除文档"
                  aria-label={`删除 ${doc.title}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </Link>
          );
        })}
        {docs.length === 0 && (
          <div className="text-center text-ink-tertiary py-12">暂无文档，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
}
