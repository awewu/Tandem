/**
 * Streaming infrastructure — unifies Tauri events and Web SSE into a single
 * callback-based consumption model.
 *
 * All callers should use the high-level exports from `lib/hermes-api.ts`
 * (`streamChat`, `streamWorkflow`) rather than importing this file directly.
 */

import { readSSE } from './sse';

/**
 * Subscribe to a Tauri event with automatic cleanup on abort.
 */
export async function subscribeTauriEvent<T = unknown>(
  eventName: string,
  handler: (payload: T) => void,
  signal?: AbortSignal
): Promise<() => void> {
  const mod = await import('@tauri-apps/api/event').catch(() => null);
  if (!mod || typeof mod.listen !== 'function') {
    throw new Error('@tauri-apps/api/event not available');
  }

  let unlisten: (() => void) | null = null;

  const cleanup = () => {
    try {
      unlisten?.();
    } catch {
      /* ignore */
    }
    unlisten = null;
  };

  if (signal) {
    signal.addEventListener('abort', cleanup, { once: true });
  }

  unlisten = await mod.listen<T>(eventName, (ev) => {
    handler(ev.payload);
  });

  return cleanup;
}

export interface ChatStreamHandlers {
  onContent: (chunk: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

export interface WorkflowStreamHandlers {
  onEvent: (event: string, data: Record<string, unknown>) => void;
  onDone: (ok: boolean, payload?: Record<string, unknown>) => void;
}

/**
 * Consume a web SSE chat stream (from /api/stream or /api/llm-stream).
 *
 * Expects events shaped as `{ content } | { error } | { done }`.
 */
export async function consumeWebChatStream(
  response: Response,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  for await (const ev of readSSE(response)) {
    if (signal?.aborted) break;

    const data = ev.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') continue;

    if (typeof data.content === 'string') {
      handlers.onContent(data.content);
    }
    if (typeof data.error === 'string') {
      handlers.onError(data.error);
    }
    if (data.done === true) {
      handlers.onDone();
      break;
    }
  }
}

/**
 * Consume a Tauri chat stream (global 'hermes-stream' events).
 */
export async function consumeTauriChatStream(
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    if (signal?.aborted) {
      finish();
      return;
    }

    signal?.addEventListener('abort', finish, { once: true });

    subscribeTauriEvent<Record<string, unknown>>('hermes-stream', (payload) => {
      if (finished) return;

      if (typeof payload.content === 'string') {
        handlers.onContent(payload.content);
      }
      if (typeof payload.error === 'string') {
        handlers.onError(payload.error);
      }
      if (payload.done === true) {
        finish();
      }
    }, signal).catch(() => {
      handlers.onError('Failed to subscribe to Tauri event');
      finish();
    });
  });
}

/**
 * Consume a web SSE workflow stream (from /api/workflows/run).
 *
 * Expects named events: `event: node:start\ndata: {...}` etc.
 */
export async function consumeWebWorkflowStream(
  response: Response,
  handlers: WorkflowStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  for await (const ev of readSSE(response)) {
    if (signal?.aborted) break;

    const data = (ev.data ?? {}) as Record<string, unknown>;

    if (ev.event === 'done') {
      const ok = data.ok === true;
      handlers.onDone(ok, data);
      break;
    }

    handlers.onEvent(ev.event, data);
  }
}

/**
 * Consume a Tauri workflow stream (per-runId events `workflow:<runId>`).
 */
export async function consumeTauriWorkflowStream(
  runId: string,
  handlers: WorkflowStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    if (signal?.aborted) {
      finish();
      return;
    }

    signal?.addEventListener('abort', finish, { once: true });

    const eventName = `workflow:${runId}`;
    subscribeTauriEvent<Record<string, unknown>>(eventName, (payload) => {
      if (finished) return;

      const event = String(payload.event ?? 'message');
      const data = (payload.data ?? payload) as Record<string, unknown>;

      if (event === 'done') {
        const ok = data.ok === true || payload.ok === true;
        handlers.onDone(ok, payload as Record<string, unknown>);
        finish();
        return;
      }

      handlers.onEvent(event, data);
    }, signal).catch(() => {
      handlers.onEvent('error', { message: 'Failed to subscribe to Tauri workflow event' });
      handlers.onDone(false, { error: 'subscription failed' });
      finish();
    });
  });
}
