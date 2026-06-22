"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lock, Unlock, Save, Brain, Sparkles, ArrowRight, ScanSearch, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { CollabTextarea } from "@/components/documents/collab-textarea";
import { DocumentPermissions, type DocPermissions } from "@/components/documents/document-permissions";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

interface DocumentDetail {
  id: string;
  title: string;
  content: string;
  type: string;
  ownerId: string;
  isLocked: boolean;
  permissions: DocPermissions;
  updatedAt: string;
  /** 服务端按鉴权上下文计算 */
  canManage?: boolean;
  canDelete?: boolean;
  /** DOC-2 (charter §四): 已发起的 Memory 升级 promotion id */
  spawnedPromotionId?: string;
  /** DOC-4 (charter §四): 已发起的议事 Decision Card id */
  spawnedDecisionCardId?: string;
}

export default function DocumentEditorPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useCurrentUser();
  const isAdmin = !!user?.roles?.some((r) => r === "owner" || r === "admin");
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  // DOC-2 / DOC-4 行内反馈状态
  const [busy, setBusy] = useState<null | 'promote' | 'spawn' | 'review'>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // DOC-3 (charter §四 · 2026-06-09): AI 评审结果. null=未评审, 评审完显示侧边面板.
  interface DocReview {
    documentId: string;
    generatedAt: string;
    summary: string;
    clarityScore: number;
    clarityFeedback: string;
    missingPoints: string[];
    risks: string[];
    suggestedActions: Array<'promote_to_memory' | 'send_to_decision' | 'revise' | 'archive'>;
    rationale: string;
    llmRan: boolean;
  }
  const [review, setReview] = useState<DocReview | null>(null);

  /** DOC-3: 让中央 AI 评审本文档. 不改文档/不自动 promote (advisory, 宪法 A). */
  const runReview = useCallback(async () => {
    if (!doc || busy) return;
    setBusy('review');
    setActionMsg(null);
    try {
      const res = await fetch(`/api/documents/${id}/review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data?.error ?? 'AI 评审失败');
        return;
      }
      setReview(data as DocReview);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : '网络错误');
    } finally {
      setBusy(null);
    }
  }, [id, doc, busy]);

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

  const deleteDoc = useCallback(async () => {
    if (!doc) return;
    if (!window.confirm(`确认删除文档「${doc.title}」？此操作不可恢复。`)) return;
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      router.push("/documents");
    } else {
      const data = await res.json().catch(() => ({}));
      setActionMsg(data?.error ?? "删除失败");
    }
  }, [id, doc, router]);

  const toggleLock = useCallback(async () => {
    await fetch(`/api/documents/${id}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !doc?.isLocked }),
    });
    setDoc((d) => (d ? { ...d, isLocked: !d.isLocked } : d));
  }, [id, doc]);

  if (!doc) return <div className="p-8 text-ink-secondary md:px-8">加载中...</div>;

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
          {/* DOC-3: AI 评审 — 中央 AI 出参谋意见, 不改文档 (charter §四 飞书做不到 #3) */}
          <button
            type="button"
            onClick={runReview}
            disabled={busy === 'review'}
            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-300/80 transition hover:bg-sky-50 disabled:opacity-40"
            title="让中央 AI 评审清晰度/缺漏/风险/建议下一步 (不改文档, 仅参谋)"
          >
            <ScanSearch className="h-3 w-3" />
            {busy === 'review' ? 'AI 评审中...' : review ? '重新评审' : 'AI 评审'}
          </button>
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
          <button onClick={toggleLock} className="p-2 rounded hover:bg-surface-3" title={doc.isLocked ? "解锁" : "锁定"}>
            {doc.isLocked ? <Lock size={18} className="text-warning" /> : <Unlock size={18} />}
          </button>
          <button onClick={save} className="flex items-center gap-1 px-3 py-2 bg-brand-500 text-white rounded hover:bg-brand-600">
            <Save size={16} /> {saving ? "保存中..." : "保存"}
          </button>
          {(doc.canDelete ?? (isAdmin || user?.id === doc.ownerId)) && (
            <button
              onClick={deleteDoc}
              className="p-2 rounded hover:bg-rose-50 text-rose-500"
              title="删除文档"
            >
              <Trash2 size={18} />
            </button>
          )}
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

        <div className="w-80 border-l p-4 bg-surface-2 overflow-auto space-y-4">
          {/* DOC-3 评审结果 — 仅 advisory, 不替员工决定下一步 (宪法 A) */}
          {review && (
            <div className="rounded-md border border-sky-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-caption flex items-center gap-1 text-sky-700">
                  <ScanSearch size={14} /> AI 评审
                </h3>
                <span className="text-[10px] text-ink-tertiary">
                  清晰度 {review.clarityScore}/5
                </span>
              </div>
              {!review.llmRan && (
                <div className="text-[10px] text-warning bg-warning/5 border border-warning/20 rounded px-2 py-1 flex items-start gap-1">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  评审降级: LLM 未响应, 仅模板回复. 建议人工通读.
                </div>
              )}
              {review.summary && (
                <p className="text-[11px] text-ink-secondary leading-relaxed">{review.summary}</p>
              )}
              {review.clarityFeedback && (
                <p className="text-[11px] text-ink-secondary italic">{review.clarityFeedback}</p>
              )}
              {review.missingPoints.length > 0 && (
                <div>
                  <div className="text-[10px] text-ink-secondary mb-0.5">缺漏点</div>
                  <ul className="text-[11px] space-y-0.5">
                    {review.missingPoints.map((p, i) => (
                      <li key={i} className="text-ink-secondary">· {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.risks.length > 0 && (
                <div>
                  <div className="text-[10px] text-rose-600 mb-0.5 flex items-center gap-1">
                    <AlertTriangle size={10} /> 风险
                  </div>
                  <ul className="text-[11px] space-y-0.5">
                    {review.risks.map((r, i) => (
                      <li key={i} className="text-rose-700">· {r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.suggestedActions.length > 0 && (
                <div>
                  <div className="text-[10px] text-emerald-600 mb-1 flex items-center gap-1">
                    <CheckCircle2 size={10} /> 建议下一步 (人工决定)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {review.suggestedActions.map((a) => (
                      <span
                        key={a}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {ACTION_LABEL[a]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {review.rationale && (
                <p className="text-[10px] text-ink-secondary leading-relaxed pt-1 border-t">
                  {review.rationale}
                </p>
              )}
              <p className="text-[9px] text-ink-tertiary italic pt-1">
                参谋建议, 不替你决定. 评审本身已记入 CA-13 飞轮, 可在 admin/company-brain 看板反馈.
              </p>
            </div>
          )}

          <div>
            <DocumentPermissions
              docId={id}
              ownerId={doc.ownerId}
              permissions={doc.permissions ?? {}}
              currentUserId={user?.id}
              isAdmin={doc.canManage ?? isAdmin}
              onChange={(perms) => setDoc((d) => (d ? { ...d, permissions: perms } : d))}
            />
            <div className="mt-4 text-footnote text-ink-tertiary">
              最后更新: {new Date(doc.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<'promote_to_memory' | 'send_to_decision' | 'revise' | 'archive', string> = {
  promote_to_memory: '沉淀为 Memory',
  send_to_decision: '进议事室',
  revise: '修订',
  archive: '存档',
};
