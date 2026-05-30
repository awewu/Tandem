/**
 * useBossAi · 客户端 hook
 *
 * 职责:
 * 1. 状态: 抽屉开关 / 消息历史 / 流式 streaming 状态 / 错误
 * 2. 历史持久化: localStorage (per browser, 用户级)
 * 3. 调 /api/boss-ai/stream 拉 SSE
 * 4. sessionId: 每次打开生成 uuid, 关掉清空
 *
 * 不依赖 React Context, 用 useSyncExternalStore 让任何挂载点都能 subscribe.
 */
'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

export interface BossAiMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  /** Stream 期间的临时标识, 完成后置 false */
  streaming?: boolean;
}

interface BossAiState {
  open: boolean;
  sessionId: string;
  messages: BossAiMessage[];
  /** stream pending */
  streaming: boolean;
  error: string | null;
}

const LS_KEY = 'tandem.bossAi.v1';

function makeSessionId(): string {
  return `boss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadInitial(): BossAiState {
  const fallback: BossAiState = {
    open: false,
    sessionId: makeSessionId(),
    messages: [],
    streaming: false,
    error: null,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BossAiState>;
    return {
      ...fallback,
      ...parsed,
      open: false, // 永不持久化打开状态
      streaming: false,
      error: null,
      sessionId: parsed.sessionId ?? fallback.sessionId,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────────────
// 全局 store (单例, 无 Context 也能跨组件)
// ──────────────────────────────────────────────────────────────────
type Listener = () => void;

class BossAiStore {
  private state: BossAiState = { open: false, sessionId: '', messages: [], streaming: false, error: null };
  private listeners = new Set<Listener>();
  private hydrated = false;

  hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    this.state = loadInitial();
  }

  getState(): BossAiState {
    return this.state;
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          sessionId: this.state.sessionId,
          messages: this.state.messages.slice(-50), // 最多存 50 条
        }),
      );
    } catch { /* quota */ }
  }

  open() {
    this.state = { ...this.state, open: true, error: null };
    this.emit();
    // §SELF-USE-FIRST 埋点 (fire-and-forget)
    if (typeof window !== 'undefined') {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'boss_ai.opened',
          props: {
            sessionId: this.state.sessionId,
            messageCount: this.state.messages.length,
            path: typeof location !== 'undefined' ? location.pathname : null,
          },
        }),
        keepalive: true,
      }).catch(() => { /* ignore */ });
    }
  }

  close() {
    this.state = { ...this.state, open: false };
    this.emit();
  }

  toggle() {
    this.state.open ? this.close() : this.open();
  }

  newSession() {
    this.state = { ...this.state, sessionId: makeSessionId(), messages: [], error: null };
    this.persist();
    this.emit();
  }

  pushUserMessage(content: string) {
    this.state = {
      ...this.state,
      messages: [...this.state.messages, { role: 'user', content, createdAt: Date.now() }],
      error: null,
    };
    this.persist();
    this.emit();
  }

  startAssistantMessage() {
    this.state = {
      ...this.state,
      messages: [...this.state.messages, { role: 'assistant', content: '', createdAt: Date.now(), streaming: true }],
      streaming: true,
    };
    this.emit();
  }

  appendAssistantDelta(delta: string) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    msgs[msgs.length - 1] = { ...last, content: last.content + delta };
    this.state = { ...this.state, messages: msgs };
    this.emit();
  }

  endAssistantMessage(error?: string) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, streaming: false };
    }
    this.state = { ...this.state, messages: msgs, streaming: false, error: error ?? null };
    this.persist();
    this.emit();
  }
}

// SSR-safe singleton
const _g = globalThis as typeof globalThis & { __tandem_boss_ai_store__?: BossAiStore };
function getStore(): BossAiStore {
  if (!_g.__tandem_boss_ai_store__) _g.__tandem_boss_ai_store__ = new BossAiStore();
  return _g.__tandem_boss_ai_store__;
}

// ──────────────────────────────────────────────────────────────────
// React hook
// ──────────────────────────────────────────────────────────────────
export function useBossAi() {
  const store = getStore();
  // Hydrate on first client render
  useEffect(() => { store.hydrate(); }, [store]);

  const state = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => store.getState(),
  );

  const send = useCallback(async (text: string, opts?: { currentPath?: string; currentTask?: string }) => {
    const content = text.trim();
    if (!content || state.streaming) return;
    store.pushUserMessage(content);
    store.startAssistantMessage();

    const messagesForApi = store.getState().messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.streaming))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/boss-ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          sessionId: state.sessionId,
          currentPath: opts?.currentPath,
          currentTask: opts?.currentTask,
        }),
      });
      if (!res.ok || !res.body) {
        store.endAssistantMessage(`HTTP ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastError: string | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of event.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload) continue;
            try {
              const json = JSON.parse(payload) as { content?: string; done?: boolean; error?: string };
              if (typeof json.content === 'string') store.appendAssistantDelta(json.content);
              if (json.error) lastError = json.error;
              if (json.done) {
                store.endAssistantMessage(lastError);
                return;
              }
            } catch { /* ignore */ }
          }
        }
      }
      store.endAssistantMessage(lastError);
    } catch (err) {
      store.endAssistantMessage((err as Error).message);
    }
  }, [store, state.streaming, state.sessionId]);

  return useMemo(() => ({
    isOpen: state.open,
    sessionId: state.sessionId,
    messages: state.messages,
    streaming: state.streaming,
    error: state.error,
    open: () => store.open(),
    close: () => store.close(),
    toggle: () => store.toggle(),
    newSession: () => store.newSession(),
    send,
  }), [state, store, send]);
}
