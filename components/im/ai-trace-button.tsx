'use client';

/**
 * §IM-7 (CHARTER-FOUR-PILLARS) · AI 回复透明化
 *
 * 用法: <AiTraceButton messageId={msg.id} />
 *   - 只在 senderKind='persona' 的 IM 消息悬浮工具栏里渲染
 *   - 点击 → 调 /api/im/messages/:id/ai-trace → 弹 popover 显示 trace
 *
 * 飞书 / 钉钉的 AI 回复是黑盒. Tandem 把每次 AI 调用变可见
 * (provider / model / tokens / 成本 / 延迟 / scenario / success).
 *
 * 未来扩展: 召回了哪些 Memory (待 baseline-guard hits 持久化), prompt 全文 (privacy).
 */

import { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface TraceData {
  provider?: string;
  model?: string;
  scenario?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  costMicroUsd?: number;
  costUsd?: number;
  success?: boolean;
  errorMessage?: string | null;
  createdAt?: string;
}

interface ApiResp {
  messageId: string;
  aiTraceId?: string;
  senderId?: string;
  trace?: TraceData | null;
  warning?: string;
  reason?: string;
  error?: string;
}

function fmtCost(usd?: number): string {
  if (usd === undefined || usd === null) return '—';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function AiTraceButton({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/ai-trace`, {
        credentials: 'include',
      });
      const json = (await res.json()) as ApiResp;
      if (!res.ok && !json.warning) {
        throw new Error(json.error ?? json.reason ?? `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-soft ring-1 ring-indigo-300/80 transition hover:bg-indigo-50 hover:shadow-soft-lg"
        title="AI 回复透明化 (Tandem 差异化 — 飞书 AI 是黑盒)"
      >
        <Search className="h-3 w-3" />
        trace
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-[420px] max-w-[92vw] rounded-2xl bg-surface-2 p-5 shadow-2xl ring-1 ring-hairline"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-1 text-caption font-semibold text-ink-primary">
              AI 回复 trace · §IM-7
            </h3>
            <p className="mb-4 text-[11px] text-ink-secondary">
              Tandem 把每次 AI 调用变可见. 飞书做不到的.
            </p>

            {loading && (
              <div className="flex items-center gap-2 py-6 text-caption text-ink-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载 trace...
              </div>
            )}

            {err && (
              <div className="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                ⚠️ {err}
              </div>
            )}

            {data && !loading && (
              <div className="space-y-2.5 text-[12.5px]">
                {data.warning && (
                  <div className="rounded-md bg-warning/5 px-3 py-2 text-[11.5px] text-warning">
                    ⚠️ {data.warning}
                    {data.reason ? <div className="mt-1 text-[10.5px] opacity-70">{data.reason}</div> : null}
                  </div>
                )}

                {data.trace ? (
                  <dl className="grid grid-cols-[6.5em_1fr] gap-x-3 gap-y-1.5 tabular-nums">
                    <dt className="text-ink-secondary">Provider</dt>
                    <dd className="font-medium text-ink-primary">{data.trace.provider}</dd>

                    <dt className="text-ink-secondary">Model</dt>
                    <dd className="font-mono text-[11.5px] text-ink-primary">{data.trace.model}</dd>

                    <dt className="text-ink-secondary">Scenario</dt>
                    <dd className="font-mono text-[11.5px] text-ink-primary">{data.trace.scenario}</dd>

                    <dt className="text-ink-secondary">Tokens</dt>
                    <dd className="text-ink-primary">
                      <span className="text-ink-secondary">in</span> {data.trace.tokensIn?.toLocaleString() ?? 0}
                      {' · '}
                      <span className="text-ink-secondary">out</span> {data.trace.tokensOut?.toLocaleString() ?? 0}
                    </dd>

                    <dt className="text-ink-secondary">延迟</dt>
                    <dd className="text-ink-primary">{data.trace.latencyMs?.toLocaleString() ?? 0} ms</dd>

                    <dt className="text-ink-secondary">成本估算</dt>
                    <dd className="text-emerald-700">{fmtCost(data.trace.costUsd)}</dd>

                    <dt className="text-ink-secondary">状态</dt>
                    <dd className={data.trace.success ? 'text-emerald-700' : 'text-rose-700'}>
                      {data.trace.success ? '✓ 成功' : `✗ 失败 ${data.trace.errorMessage ?? ''}`}
                    </dd>

                    <dt className="text-ink-secondary">时间</dt>
                    <dd className="font-mono text-[11px] text-ink-secondary">
                      {data.trace.createdAt ? new Date(data.trace.createdAt).toLocaleString('zh-CN') : '—'}
                    </dd>
                  </dl>
                ) : (
                  <div className="rounded-md bg-surface-3 px-3 py-2 text-[11.5px] text-ink-secondary">
                    没找到对应的 LlmUsageLog (可能 PG 未连/migration 0003 未应用/调用时未传 requestId).
                  </div>
                )}

                {data.aiTraceId && (
                  <div className="border-t border-hairline pt-2 text-[10.5px] text-ink-tertiary">
                    aiTraceId: <span className="font-mono">{data.aiTraceId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
