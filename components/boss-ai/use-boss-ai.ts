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

export type BossAiFeedbackOutcome = 'pending' | 'adopted' | 'modified' | 'overruled';

export interface BossAiMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  /** Stream 期间的临时标识, 完成后置 false */
  streaming?: boolean;
  /** 首字节前的进度提示 (正在查公司数据…); 有 content 后清空 */
  status?: string;
  /** §CA-13 设施: 服务端 recordDecision 后的 decision.id, 客户端拿它去 POST /api/company-brain/feedback. */
  decisionId?: string;
  /** 本地 cache 的反馈状态, UI 高亮当前 outcome. 仅 assistant 消息有意义. */
  feedbackOutcome?: BossAiFeedbackOutcome;
  /** 反馈提交中 (防重复点击). */
  feedbackSubmitting?: boolean;
}

/** 深链时由外部组件 askAbout 写入, drawer 消费后清空 */
export interface PendingPrompt {
  text: string;
  /** 父任务上下文 (注入到 service 端 currentTask anchor) */
  task?: string;
  /** 写入后自动发送 (false 时仅 prefill 让用户编辑) */
  autoSend?: boolean;
}

interface BossAiState {
  open: boolean;
  sessionId: string;
  messages: BossAiMessage[];
  /** stream pending */
  streaming: boolean;
  error: string | null;
  /** §深链 pending prompt (drawer 打开时消费) */
  pendingPrompt: PendingPrompt | null;
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
    pendingPrompt: null,
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
  private state: BossAiState = { open: false, sessionId: '', messages: [], streaming: false, error: null, pendingPrompt: null };
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

  /**
   * §深链 · 让外部组件 (议事卡 / OKR 卡 / Action item 卡) 一键打开 BossAI
   * 并预填一段提问. 同时可携带 currentTask 让服务端注入上下文锚.
   *
   * @example
   *   askAbout('这个议题该锚到哪个 OKR?', { task: '议事: 北区是否加大投入' })
   */
  askAbout(prompt: string, context?: { task?: string; autoSend?: boolean }) {
    this.state = {
      ...this.state,
      open: true,
      error: null,
      pendingPrompt: { text: prompt, task: context?.task, autoSend: context?.autoSend ?? false },
    };
    this.emit();
  }

  /** drawer 消费完 pending prompt 后调 (清空避免重复触发) */
  consumePendingPrompt(): PendingPrompt | null {
    const pending = this.state.pendingPrompt;
    if (!pending) return null;
    this.state = { ...this.state, pendingPrompt: null };
    this.emit();
    return pending;
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

  setAssistantStatus(status: string) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    msgs[msgs.length - 1] = { ...last, status };
    this.state = { ...this.state, messages: msgs };
    this.emit();
  }

  appendAssistantDelta(delta: string) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    msgs[msgs.length - 1] = { ...last, content: last.content + delta, status: undefined };
    this.state = { ...this.state, messages: msgs };
    this.emit();
  }

  endAssistantMessage(error?: string, decisionId?: string) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      msgs[msgs.length - 1] = {
        ...last,
        streaming: false,
        decisionId: decisionId ?? last.decisionId,
        feedbackOutcome: decisionId ? 'pending' : last.feedbackOutcome,
      };
    }
    this.state = { ...this.state, messages: msgs, streaming: false, error: error ?? null };
    this.persist();
    this.emit();
  }

  // §CA-13 闭环: 提交反馈 → POST /api/company-brain/feedback → 本地 cache outcome.
  //   fail-soft: 网络错误不招引全局 error 状态 (只在 message 级别提示, 不能冲掉上一次成功的回答).
  async submitFeedback(messageCreatedAt: number, outcome: BossAiFeedbackOutcome): Promise<boolean> {
    const idx = this.state.messages.findIndex((m) => m.createdAt === messageCreatedAt && m.role === 'assistant');
    if (idx < 0) return false;
    const target = this.state.messages[idx];
    if (!target.decisionId || target.feedbackSubmitting) return false;

    // 乐观提交: 先标记 submitting (UI 锁住按钮)
    const msgsOpt = this.state.messages.slice();
    msgsOpt[idx] = { ...target, feedbackSubmitting: true };
    this.state = { ...this.state, messages: msgsOpt };
    this.emit();

    try {
      const res = await fetch('/api/company-brain/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decisionId: target.decisionId, outcome }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const msgsOk = this.state.messages.slice();
      const cur = msgsOk[idx];
      if (cur) msgsOk[idx] = { ...cur, feedbackOutcome: outcome, feedbackSubmitting: false };
      this.state = { ...this.state, messages: msgsOk };
      this.persist();
      this.emit();
      return true;
    } catch {
      // 回滚 submitting 标记, outcome 保持原状
      const msgsErr = this.state.messages.slice();
      const cur = msgsErr[idx];
      if (cur) msgsErr[idx] = { ...cur, feedbackSubmitting: false };
      this.state = { ...this.state, messages: msgsErr };
      this.emit();
      return false;
    }
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
              const json = JSON.parse(payload) as { content?: string; done?: boolean; error?: string; status?: string; decisionId?: string };
              if (typeof json.status === 'string') store.setAssistantStatus(json.status);
              if (typeof json.content === 'string') store.appendAssistantDelta(json.content);
              if (json.error) lastError = json.error;
              if (json.done) {
                store.endAssistantMessage(lastError, typeof json.decisionId === 'string' ? json.decisionId : undefined);
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

  const askAbout = useCallback(
    (prompt: string, context?: { task?: string; autoSend?: boolean }) => store.askAbout(prompt, context),
    [store],
  );
  const consumePendingPrompt = useCallback(() => store.consumePendingPrompt(), [store]);
  const submitFeedback = useCallback(
    (messageCreatedAt: number, outcome: BossAiFeedbackOutcome) => store.submitFeedback(messageCreatedAt, outcome),
    [store],
  );

  return useMemo(() => ({
    isOpen: state.open,
    sessionId: state.sessionId,
    messages: state.messages,
    streaming: state.streaming,
    error: state.error,
    pendingPrompt: state.pendingPrompt,
    open: () => store.open(),
    close: () => store.close(),
    toggle: () => store.toggle(),
    newSession: () => store.newSession(),
    send,
    askAbout,
    consumePendingPrompt,
    submitFeedback,
  }), [state, store, send, askAbout, consumePendingPrompt, submitFeedback]);
}
