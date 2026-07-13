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

/** §思考轨迹 · 后端流来的一步真实工作 (查知识库 / 联网 / 多步推理 / 核对 OKR …) */
export interface BossAiTraceStep {
  /** 稳定 key, 用于 upsert (同 phase 覆盖) */
  phase: string;
  label: string;
  detail?: string;
  /** 真实调用的工具 (已转中文标签) */
  tools?: string[];
  /** §引用 chips · 联网来源 (title + url), 前端渲染为可点击链接 */
  sources?: Array<{ title: string; url: string }>;
  ts: number;
}

export interface BossAiMessage {
  role: 'user' | 'assistant';
  content: string;
  /** §多模态 · 用户随消息附的图片 (data:image base64 或 http(s) url). 仅 user 消息有意义. */
  images?: string[];
  createdAt: number;
  /** Stream 期间的临时标识, 完成后置 false */
  streaming?: boolean;
  /** 首字节前的进度提示 (正在查公司数据…); 有 content 后清空 */
  status?: string;
  /** §思考轨迹 · 累积的工作步骤 (Gemini 式可见思考). 仅 assistant 消息有意义. */
  steps?: BossAiTraceStep[];
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

interface AiChatConfig {
  /** localStorage 持久化 key (每个 target 独立线程) */
  lsKey: string;
  /** SSE 流式端点 (中央 AI / 分身) */
  streamEndpoint: string;
  /** sessionId 前缀 */
  sessionPrefix: string;
  /** 反馈回传端点 (仅中央 AI 有决策飞轮; 分身无) */
  feedbackEndpoint?: string;
}

const COMPANY_CONFIG: AiChatConfig = {
  lsKey: 'tandem.bossAi.v1',
  streamEndpoint: '/api/boss-ai/stream',
  sessionPrefix: 'boss',
  feedbackEndpoint: '/api/company-brain/feedback',
};

const PERSONA_CONFIG: AiChatConfig = {
  lsKey: 'tandem.personaChat.v1',
  streamEndpoint: '/api/persona/stream',
  sessionPrefix: 'persona',
};

function makeSessionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadInitial(cfg: AiChatConfig): BossAiState {
  const fallback: BossAiState = {
    open: false,
    sessionId: makeSessionId(cfg.sessionPrefix),
    messages: [],
    streaming: false,
    error: null,
    pendingPrompt: null,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(cfg.lsKey);
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

class AiChatStore {
  private state: BossAiState = { open: false, sessionId: '', messages: [], streaming: false, error: null, pendingPrompt: null };
  private listeners = new Set<Listener>();
  private hydrated = false;
  /** 当前流式请求的中止器 (用于"停止生成"); 非 React state, stop() 直接够得到. */
  private abortController: AbortController | null = null;

  constructor(private cfg: AiChatConfig) {}

  /** 该 store 对应的流式端点 (中央 AI / 分身). */
  get streamEndpoint(): string { return this.cfg.streamEndpoint; }

  setAbort(c: AbortController | null) {
    this.abortController = c;
  }

  /** 停止当前流式生成: 中止 fetch, 保留已生成的部分内容. */
  stop() {
    if (!this.state.streaming) return;
    this.abortController?.abort();
    this.abortController = null;
  }

  /** 移除末尾的 assistant 消息 (重新生成时用; 让末位回到 user). */
  removeLastAssistant() {
    const msgs = this.state.messages.slice();
    while (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    this.state = { ...this.state, messages: msgs, error: null };
    this.persist();
    this.emit();
  }

  hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    this.state = loadInitial(this.cfg);
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
        this.cfg.lsKey,
        JSON.stringify({
          sessionId: this.state.sessionId,
          // 最多存 50 条; 剥掉 data:image base64 (体积大易爆 quota), 仅保留 http(s) 图.
          messages: this.state.messages.slice(-50).map((m) => {
            if (!m.images || m.images.length === 0) return m;
            const kept = m.images.filter((u) => u.startsWith('http'));
            return kept.length > 0 ? { ...m, images: kept } : { ...m, images: undefined };
          }),
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
    this.state = { ...this.state, sessionId: makeSessionId(this.cfg.sessionPrefix), messages: [], error: null };
    this.persist();
    this.emit();
  }

  pushUserMessage(content: string, images?: string[]) {
    const imgs = images && images.length > 0 ? images : undefined;
    this.state = {
      ...this.state,
      messages: [...this.state.messages, { role: 'user', content, images: imgs, createdAt: Date.now() }],
      error: null,
    };
    this.persist();
    this.emit();
  }

  /** §编辑重发 · 改写某条 user 消息内容并截断其后所有消息 (准备重跑). 返回是否命中. */
  truncateAndEditUser(createdAt: number, newText: string): boolean {
    const idx = this.state.messages.findIndex((m) => m.createdAt === createdAt && m.role === 'user');
    if (idx < 0) return false;
    const kept = this.state.messages.slice(0, idx);
    const edited: BossAiMessage = { ...this.state.messages[idx], content: newText };
    this.state = { ...this.state, messages: [...kept, edited], error: null };
    this.persist();
    this.emit();
    return true;
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

  appendAssistantStep(step: BossAiTraceStep) {
    const msgs = this.state.messages.slice();
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    // upsert by phase: 同一阶段重复发只保留最新
    const prev = last.steps ?? [];
    const idx = prev.findIndex((s) => s.phase === step.phase);
    const steps = idx >= 0
      ? prev.map((s, i) => (i === idx ? step : s))
      : [...prev, step];
    msgs[msgs.length - 1] = { ...last, steps };
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
    if (!this.cfg.feedbackEndpoint || !target.decisionId || target.feedbackSubmitting) return false;

    // 乐观提交: 先标记 submitting (UI 锁住按钮)
    const msgsOpt = this.state.messages.slice();
    msgsOpt[idx] = { ...target, feedbackSubmitting: true };
    this.state = { ...this.state, messages: msgsOpt };
    this.emit();

    try {
      const res = await fetch(this.cfg.feedbackEndpoint, {
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

// SSR-safe singletons (per config, keyed by lsKey)
const _g = globalThis as typeof globalThis & { __tandem_ai_chat_stores__?: Map<string, AiChatStore> };
function getStore(cfg: AiChatConfig): AiChatStore {
  if (!_g.__tandem_ai_chat_stores__) _g.__tandem_ai_chat_stores__ = new Map();
  const map = _g.__tandem_ai_chat_stores__;
  let s = map.get(cfg.lsKey);
  if (!s) { s = new AiChatStore(cfg); map.set(cfg.lsKey, s); }
  return s;
}

// ──────────────────────────────────────────────────────────────────
// React hook
// ──────────────────────────────────────────────────────────────────
function useAiChat(cfg: AiChatConfig) {
  const store = getStore(cfg);
  // Hydrate on first client render
  useEffect(() => { store.hydrate(); }, [store]);

  const state = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => store.getState(),
  );

  // 公共流式核心: 假定末位已是 user 消息, 起一个 assistant 消息并消费 SSE.
  // send / regenerate 共用; 支持 AbortController 停止生成 (保留已生成部分).
  const runStream = useCallback(async (opts?: { currentPath?: string; currentTask?: string }) => {
    store.startAssistantMessage();
    const controller = new AbortController();
    store.setAbort(controller);

    const convo = store.getState().messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.streaming));
    const messagesForApi = convo.map((m) => ({ role: m.role, content: m.content }));
    // §多模态 · 取最新一条 user 消息的图片随请求发出.
    const lastUser = [...convo].reverse().find((m) => m.role === 'user');
    const images = lastUser?.images;

    try {
      const res = await fetch(store.streamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: messagesForApi,
          sessionId: store.getState().sessionId,
          currentPath: opts?.currentPath,
          currentTask: opts?.currentTask,
          images,
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
              const json = JSON.parse(payload) as { content?: string; done?: boolean; error?: string; status?: string; decisionId?: string; step?: BossAiTraceStep };
              if (json.step && typeof json.step.phase === 'string') store.appendAssistantStep(json.step);
              if (typeof json.status === 'string') store.setAssistantStatus(json.status);
              if (typeof json.content === 'string') store.appendAssistantDelta(json.content);
              if (json.error) lastError = json.error;
              if (json.done) {
                store.endAssistantMessage(lastError, typeof json.decisionId === 'string' ? json.decisionId : undefined);
                store.setAbort(null);
                return;
              }
            } catch { /* ignore */ }
          }
        }
      }
      store.endAssistantMessage(lastError);
    } catch (err) {
      // 用户主动停止 (AbortError): 不当作错误, 保留已生成内容.
      const aborted = (err as Error).name === 'AbortError';
      if (aborted) {
        const last = store.getState().messages.at(-1);
        // 还没出任何字就被停 → 丢掉空 assistant 气泡, 否则保留部分内容.
        if (last && last.role === 'assistant' && last.content.trim().length === 0) {
          store.removeLastAssistant();
        } else {
          store.endAssistantMessage(undefined);
        }
      } else {
        store.endAssistantMessage((err as Error).message);
      }
    } finally {
      store.setAbort(null);
    }
  }, [store]);

  const send = useCallback(async (text: string, opts?: { currentPath?: string; currentTask?: string; images?: string[] }) => {
    const content = text.trim();
    const images = opts?.images;
    // 允许"只发图不发字"; 但至少要有其一.
    if ((!content && (!images || images.length === 0)) || store.getState().streaming) return;
    store.pushUserMessage(content, images);
    await runStream(opts);
  }, [store, runStream]);

  // 编辑重发: 改写某条历史 user 提问, 截断其后, 用新内容重跑.
  const editAndResend = useCallback(async (createdAt: number, newText: string, opts?: { currentPath?: string }) => {
    const content = newText.trim();
    if (!content || store.getState().streaming) return;
    if (!store.truncateAndEditUser(createdAt, content)) return;
    await runStream(opts);
  }, [store, runStream]);

  // 重新生成: 丢弃末尾 assistant, 用同一个 user 提问再跑一次.
  const regenerate = useCallback(async (opts?: { currentPath?: string; currentTask?: string }) => {
    if (store.getState().streaming) return;
    const msgs = store.getState().messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    store.removeLastAssistant();
    await runStream(opts);
  }, [store, runStream]);

  const stop = useCallback(() => store.stop(), [store]);

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
    regenerate,
    editAndResend,
    stop,
    askAbout,
    consumePendingPrompt,
    submitFeedback,
  }), [state, store, send, regenerate, editAndResend, stop, askAbout, consumePendingPrompt, submitFeedback]);
}

/** 中央 AI (CompanyBrain) 会话 · 与右下 FAB 抽屉共享同一线程. */
export function useBossAi() {
  return useAiChat(COMPANY_CONFIG);
}

/** 我的分身 (Persona) 会话 · 搭子工作台专用, 独立线程. 走 /api/persona/stream (governed). */
export function usePersonaChat() {
  return useAiChat(PERSONA_CONFIG);
}
