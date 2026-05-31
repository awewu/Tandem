"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lock, Unlock, Save, Users, Brain, Sparkles, ArrowRight } from "lucide-react";
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
  /** DOC-2 (charter §四): 已发起的 Memory 升级 promotion id */
  spawnedPromotionId?: string;
  /** DOC-4 (charter §四): 已发起的议事 Decision Card id */
  spawnedDecisionCardId?: string;
}

export default function DocumentEditorPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  // DOC-2 / DOC-4 行内反馈状态
  const [busy, setBusy] = useState<null | 'promote' | 'spawn'>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  /** DOC-2: 把当前文档升级为团队 Memory (走宪章 §8.1 三级签批) */
  const promoteToMemory = useCallback(async () => {
    if (!doc || busy) return;
    if (doc.spawnedPromotionId) {
      router.push(`/memories?promotionId=${doc.spawnedPromotionId}`);
      return;
    }
    setBusy('promote');
    setActionMsg(null);
    try {
      const res = await fetch(`/api/documents/${id}/promote-to-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedType: 'lesson', level: 'team' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data?.error ?? '升级失败');
        return;
      }
      setDoc((d) => (d ? { ...d, spawnedPromotionId: data.promotionId } : d));
      router.push(`/memories?promotionId=${data.promotionId}`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : '网络错误');
    } finally {
      setBusy(null);
    }
  }, [doc, id, busy, router]);

  /** DOC-4 v0: 把当前文档作为议题发起议事 (URL 信号, /convergence 自查 fromDocId) */
  const spawnConvergence = useCallback(() => {
    if (!doc || busy) return;
    if (doc.spawnedDecisionCardId) {
      router.push(`/convergence?id=${doc.spawnedDecisionCardId}`);
      return;
    }
    const params = new URLSearchParams({
      fromDocId: doc.id,
      fromDocTitle: doc.title,
    });
    router.push(`/convergence?${params.toString()}`);
  }, [doc, busy, router]);

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

  if (!doc) return <div className="p-8 text-gray-500 md:px-8">加载中...</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <input
          aria-label="文档标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-headline font-bold border-none outline-none"
        />
        <div className="flex items-center gap-2">
          {/* DOC-4: 由此发起议事 — 把文档作为议题进议事室 (charter §四 飞书做不到 #2) */}
          <button
            type="button"
            onClick={spawnConvergence}
            disabled={busy === 'spawn'}
            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-warning ring-1 ring-warning/30/80 transition hover:bg-warning/5 disabled:opacity-40"
            title={
              doc.spawnedDecisionCardId
                ? '本文档已发起议事, 点击查看决议'
                : '把本文档作为议题进议事室 (Tandem 差异化 — 飞书云文档没有)'
            }
          >
            <Sparkles className="h-3 w-3" />
            {doc.spawnedDecisionCardId ? '查看议事' : '发起议事'}
            <ArrowRight className="h-3 w-3" />
          </button>
          {/* DOC-2: 升级为 Memory — 走宪章 §8.1 三级签批 (charter §四 飞书做不到 #1) */}
          <button
            type="button"
            onClick={promoteToMemory}
            disabled={busy === 'promote'}
            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-300/80 transition hover:bg-violet-50 disabled:opacity-40"
            title={
              doc.spawnedPromotionId
                ? '本文档已发起 Memory 升级, 点击查看签批进度'
                : '把本文档沉淀为团队 Memory, 走三级签批 (Tandem 差异化 — 4 层 Memory 飞书没有)'
            }
          >
            <Brain className="h-3 w-3" />
            {busy === 'promote'
              ? '升级中...'
              : doc.spawnedPromotionId
              ? '查看升级'
              : '升级 Memory'}
          </button>
          <button onClick={toggleLock} className="p-2 rounded hover:bg-gray-100" title={doc.isLocked ? "解锁" : "锁定"}>
            {doc.isLocked ? <Lock size={18} className="text-warning" /> : <Unlock size={18} />}
          </button>
          <button onClick={save} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <Save size={16} /> {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      {actionMsg && (
        <div className="px-4 py-1.5 text-[11px] text-rose-700 bg-rose-50 border-b border-rose-200">
          {actionMsg}
        </div>
      )}
      {/* DOC-2 反链 chip — 已发起的 promotion / decision card 的状态条 */}
      {(doc.spawnedPromotionId || doc.spawnedDecisionCardId) && (
        <div className="px-4 py-1.5 text-[11px] flex items-center gap-2 bg-warning/5/40 border-b border-warning/10">
          <span className="text-ink-tertiary">本文档已派生:</span>
          {doc.spawnedDecisionCardId && (
            <Link
              href={`/convergence?id=${doc.spawnedDecisionCardId}`}
              className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/5 px-2 py-0.5 font-medium text-warning hover:bg-warning/10"
            >
              <Sparkles className="h-2.5 w-2.5" />
              议事 / Decision Card
            </Link>
          )}
          {doc.spawnedPromotionId && (
            <Link
              href={`/memories?promotionId=${doc.spawnedPromotionId}`}
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700 hover:bg-violet-100"
            >
              <Brain className="h-2.5 w-2.5" />
              Memory 升级签批
            </Link>
          )}
        </div>
      )}

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
          <div className="space-y-2 text-caption">
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
          <div className="mt-4 text-footnote text-gray-400">
            最后更新: {new Date(doc.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
