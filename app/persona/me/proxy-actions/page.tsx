'use client';

/**
 * /persona/me/proxy-actions
 *
 * 拿捏闭环 ③ 代行 + ④ 反馈 的核心 UI:
 *   - 列出当前员工被 Persona 代行的所有动作
 *   - 24h 否决窗口内可点 "撤回" / "立即确认"
 *   - 状态可视化 (drafted / awaiting_veto / executed / vetoed / expired)
 *
 * 数据源: GET /api/persona/proxy-actions
 * 操作: POST /api/persona/proxy-actions/[id]/veto · /confirm
 */

import { useEffect, useMemo, useState, useCallback } from 'react';

interface ProxyAction {
  id: string;
  userId: string;
  personaId: string;
  kind: 'meeting_proxy' | 'communication' | 'im_reply' | 'decision_draft' | 'email_draft' | 'ontology_action';
  zone: 'green' | 'yellow' | 'red';
  status: 'drafted' | 'awaiting_veto' | 'executed' | 'vetoed' | 'expired';
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
  vetoUntil?: string;
  vetoedBy?: string;
  vetoedAt?: string;
  vetoReason?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  executedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const KIND_LABEL: Record<ProxyAction['kind'], string> = {
  meeting_proxy: '会议代参',
  communication: '沟通起草',
  im_reply: 'IM 自动回复',
  decision_draft: '决议起草',
  email_draft: '邮件起草',
  ontology_action: '数据更新代行',
};

const STATUS_BADGE: Record<ProxyAction['status'], { label: string; cls: string }> = {
  drafted: { label: '草稿待确认', cls: 'bg-info/10 text-info' },
  awaiting_veto: { label: '24h 否决窗口', cls: 'bg-warning/10 text-warning' },
  executed: { label: '已执行', cls: 'bg-emerald-100 text-emerald-800' },
  vetoed: { label: '已否决', cls: 'bg-rose-100 text-rose-800' },
  expired: { label: '已过期', cls: 'bg-surface-1 text-ink-primary' },
};

const ZONE_BADGE: Record<ProxyAction['zone'], { label: string; cls: string }> = {
  green: { label: '🟢 绿区', cls: 'text-emerald-700' },
  yellow: { label: '🟡 黄区', cls: 'text-warning' },
  red: { label: '🔴 红区', cls: 'text-rose-700' },
};

function timeRemaining(iso?: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '已过期';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours >= 1 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function ProxyActionsPage() {
  const [actions, setActions] = useState<ProxyAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProxyAction['status'] | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<Record<string, boolean>>({});
  const [feedbackOk, setFeedbackOk] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const url =
        filter === 'all'
          ? '/api/persona/proxy-actions?limit=100'
          : `/api/persona/proxy-actions?limit=100&status=${filter}`;
      const r = await fetch(url, { credentials: 'include' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? '加载失败');
      setActions(j.actions ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const c: Record<ProxyAction['status'] | 'all', number> = {
      all: actions.length,
      drafted: 0,
      awaiting_veto: 0,
      executed: 0,
      vetoed: 0,
      expired: 0,
    };
    for (const a of actions) c[a.status] += 1;
    return c;
  }, [actions]);

  async function veto(id: string) {
    const reason = window.prompt('否决理由 (可选, 用于审计)');
    if (reason === null) return; // 用户取消
    setBusyId(id);
    try {
      const r = await fetch(`/api/persona/proxy-actions/${id}/veto`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? '否决失败');
      await reload();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirm(id: string) {
    if (!window.confirm('确认立即执行该代行 (不再等待 24h 否决窗口)?')) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/persona/proxy-actions/${id}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? '确认失败');
      await reload();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  /** ④ 提交反馈 👍/👎 */
  async function submitFeedback(id: string, kind: 'thumbs_up' | 'thumbs_down') {
    setFeedbackBusy((prev) => ({ ...prev, [id]: true }));
    try {
      const r = await fetch(`/api/persona/proxy-actions/${id}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? '反馈提交失败');
      setFeedbackOk((prev) => ({ ...prev, [id]: true }));
      // 3秒后清除成功提示
      setTimeout(() => {
        setFeedbackOk((prev) => ({ ...prev, [id]: false }));
      }, 3000);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setFeedbackBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  const tabs: Array<ProxyAction['status'] | 'all'> = [
    'all',
    'drafted',
    'awaiting_veto',
    'executed',
    'vetoed',
    'expired',
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="text-title-3 font-bold tracking-tight">分身代行台账</h1>
        <p className="mt-1 text-caption text-ink-secondary">
          所有 Persona 替你做的事都在这里。24h 内可撤回，过期自动落定。红区永不进表。
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 border-b border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-2 text-caption transition ${
              filter === t
                ? 'border-b-2 border font-semibold text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t === 'all' ? '全部' : STATUS_BADGE[t].label}
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-1 px-1.5 text-footnote">
              {counts[t]}
            </span>
          </button>
        ))}
      </nav>

      {loading && <div className="py-8 text-center text-caption text-ink-secondary">加载中…</div>}
      {err && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-caption text-rose-700">
          错误: {err}
        </div>
      )}

      {!loading && !err && actions.length === 0 && (
        <div className="rounded-lg border border-dashed border bg-surface-1 px-6 py-12 text-center text-caption text-ink-secondary">
          暂无代行记录。当 Persona 替你回复 IM、起草沟通或参加会议时，此处会出现。
        </div>
      )}

      <ul className="space-y-3">
        {actions.map((a) => {
          const stb = STATUS_BADGE[a.status];
          const ztb = ZONE_BADGE[a.zone];
          const canVeto = a.status === 'drafted' || a.status === 'awaiting_veto';
          const canConfirm = a.status === 'drafted' || a.status === 'awaiting_veto';

          return (
            <li
              key={a.id}
              className="rounded-lg border border bg-white p-4 shadow-soft-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-footnote font-medium ${ztb.cls}`}>{ztb.label}</span>
                    <span className="text-footnote text-ink-tertiary">·</span>
                    <span className="text-footnote font-medium text-ink-secondary">{KIND_LABEL[a.kind]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-footnote ${stb.cls}`}>
                      {stb.label}
                    </span>
                    {canVeto && a.vetoUntil && (
                      <span className="text-footnote text-warning">
                        剩余 {timeRemaining(a.vetoUntil)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 font-medium text-ink-primary">{a.title}</h3>
                  {a.body && (
                    <p className="mt-1 line-clamp-2 text-caption text-ink-secondary">{a.body}</p>
                  )}
                  {a.vetoReason && (
                    <p className="mt-2 text-footnote text-rose-700">
                      否决理由: {a.vetoReason}
                    </p>
                  )}
                  <div className="mt-2 text-footnote text-ink-tertiary">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.refType && a.refId && (
                      <>
                        {' · '}
                        <span className="font-mono">
                          {a.refType}:{a.refId.slice(0, 12)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {(canVeto || canConfirm) && (
                  <div className="flex shrink-0 flex-col gap-2">
                    {canConfirm && (
                      <button
                        disabled={busyId === a.id}
                        onClick={() => confirm(a.id)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-footnote font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        立即确认
                      </button>
                    )}
                    {canVeto && (
                      <button
                        disabled={busyId === a.id}
                        onClick={() => veto(a.id)}
                        className="rounded-md border border-rose-300 px-3 py-1.5 text-footnote font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        否决
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ④ 反馈评分 - 对已执行的代行进行评价 */}
              {(a.status === 'executed' || a.status === 'vetoed' || a.status === 'expired') && (
                <div className="mt-3 flex items-center gap-3 border-t border pt-3">
                  <span className="text-footnote text-ink-secondary">本次代行质量:</span>
                  <div className="flex gap-2">
                    <button
                      disabled={feedbackBusy[a.id]}
                      onClick={() => submitFeedback(a.id, 'thumbs_up')}
                      className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-footnote text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      title="点赞 - 这次代行符合我的风格"
                    >
                      👍 有用
                    </button>
                    <button
                      disabled={feedbackBusy[a.id]}
                      onClick={() => submitFeedback(a.id, 'thumbs_down')}
                      className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-footnote text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      title="点踩 - 这次代行需要改进"
                    >
                      👎 需改进
                    </button>
                  </div>
                  {feedbackOk[a.id] && (
                    <span className="text-footnote text-emerald-600">✓ bossCaptureScore 已更新</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
