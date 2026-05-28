'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChatStore, useAgentStore, useMemoryStore, useKnowledgeStore, PRESET_AGENTS } from '@/lib/store';
import { Send, Plus, Trash2, Bot, User, AlertCircle, Sparkles, Palette, Package, Target, Megaphone, Code, PenLine, BarChart3, Users, ThumbsUp, ThumbsDown, Star, Shield, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startChatStream, startLLMStream } from '@/lib/hermes-api';

const AGENT_ICONS: Record<string, React.ElementType> = {
  'agent-designer': Palette,
  'agent-pm': Package,
  'agent-strategy': Target,
  'agent-marketing': Megaphone,
  'agent-tech-lead': Code,
  'agent-writer': PenLine,
  'agent-data-analyst': BarChart3,
  'agent-hr': Users,
};

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  // Selector pattern: only subscribe to needed slices to avoid re-render on every token
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addConversation = useChatStore((s) => s.addConversation);
  const setActive = useChatStore((s) => s.setActive);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const { agents } = useAgentStore();
  const getBaselineSystemPrompt = useMemoryStore((s) => s.getBaselineSystemPrompt);
  const activeMemoryCount = useMemoryStore((s) =>
    s.memories.filter((m) => m.isActive && (m.priority === 'critical' || m.priority === 'high')).length
  );
  const addKnowledgeNode = useKnowledgeStore((s) => s.addNode);
  const knowledgeNodes = useKnowledgeStore((s) => s.nodes);
  const activeConv = conversations.find((c) => c.id === activeId);
  const [input, setInput] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const launchedAgentRef = useRef<string | null>(null);

  // Gemini Gems-style: ?agent=<id> 自动选中该 Agent 并创建新会话
  useEffect(() => {
    const agentParam = searchParams.get('agent');
    if (!agentParam || launchedAgentRef.current === agentParam) return;
    const agent = agents.find((a) => a.id === agentParam);
    if (!agent) return;
    launchedAgentRef.current = agentParam;
    setSelectedAgentId(agent.id);
    const id = crypto.randomUUID();
    addConversation({
      id,
      title: agent.name,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: agent.id,
    });
    setError(null);
    // 清掉 URL 参数，避免刷新时反复创建
    router.replace('/chat');
  }, [searchParams, agents, addConversation, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConv?.messages.length, isStreaming]);

  const handleNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    addConversation({
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      agentId: selectedAgentId || undefined,
    });
    setError(null);
  }, [addConversation, selectedAgentId]);

  /**
   * 执行单次 Agent 流式调用 — 已经把 user / assistant 占位 message 加入会话后调用本函数。
   * 返回完整输出文本（出错时返回空串，错误已写入 assistant message）。
   */
  const runAgentStream = async (
    convId: string,
    agent: typeof agents[number],
    messagesForApi: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    assistantMsgId: string,
    abort: AbortController,
  ): Promise<string> => {
    const useTeam = agent.provider?.type === 'team' && !!agent.provider.teamProvider;
    const useProxy = !useTeam && agent.provider?.type === 'openai-compatible' && !!agent.provider.baseURL;

    // 注入企业基线（active 且 critical/high 的 memory）+ Agent 自身 systemPrompt
    const baseline = getBaselineSystemPrompt();
    const composedSystemPrompt = [baseline, agent.systemPrompt].filter((s) => s && s.trim()).join('\n\n');

    const payload = useTeam
      ? {
          messages: messagesForApi,
          model: agent.model,
          systemPrompt: composedSystemPrompt,
          temperature: agent.temperature,
          teamProvider: agent.provider!.teamProvider,
        }
      : useProxy
      ? {
          messages: messagesForApi,
          model: agent.model,
          systemPrompt: composedSystemPrompt,
          temperature: agent.temperature,
          provider: {
            baseURL: agent.provider!.baseURL,
            apiKey: agent.provider!.apiKey,
            headers: agent.provider!.headers,
          },
        }
      : {
          messages: messagesForApi,
          model: agent.model,
          skills: agent.skills,
          agentId: agent.id,
          systemPrompt: composedSystemPrompt,
          temperature: agent.temperature,
        };

    let fullContent = '';
    const handleEvent = (obj: any) => {
      if (obj?.error) {
        setError(obj.error);
        updateMessage(convId, assistantMsgId, { content: fullContent + '\n[Error] ' + obj.error });
      }
      if (typeof obj?.content === 'string' && obj.content.length) {
        fullContent += obj.content;
        updateMessage(convId, assistantMsgId, { content: fullContent });
      }
    };

    try {
      const stream = (useTeam || useProxy)
        ? await startLLMStream(payload as any)
        : await startChatStream(payload as any);

      if (stream.mode === 'tauri') {
        // Listen to the global 'hermes-stream' Tauri event until { done: true } or abort.
        const { listen } = await import('@tauri-apps/api/event');
        await new Promise<void>(async (resolve) => {
          let unlisten: (() => void) | null = null;
          const finish = () => {
            try { unlisten?.(); } catch {}
            abort.signal.removeEventListener('abort', finish);
            resolve();
          };
          abort.signal.addEventListener('abort', finish, { once: true });
          unlisten = await listen<any>('hermes-stream', (ev) => {
            const obj = ev?.payload ?? {};
            handleEvent(obj);
            if (obj?.done) finish();
          });
        });
      } else {
        const res = stream.response;
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        const onAbort = () => { try { reader.cancel(); } catch {} };
        abort.signal.addEventListener('abort', onAbort, { once: true });
        try {
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (!value) continue;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.slice(6);
              if (jsonStr === '[DONE]') { done = true; break; }
              try {
                const obj = JSON.parse(jsonStr);
                handleEvent(obj);
                if (obj.done) done = true;
              } catch { /* malformed line */ }
            }
          }
        } finally {
          abort.signal.removeEventListener('abort', onAbort);
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== 'AbortError') {
        const msg = e?.message || 'Stream failed';
        setError(msg);
        updateMessage(convId, assistantMsgId, { content: '[Error] ' + msg });
      }
    }
    return fullContent;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    let convId = activeId;
    if (!convId) {
      convId = crypto.randomUUID();
      addConversation({
        id: convId,
        title: input.trim().slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agentId: selectedAgentId || undefined,
      });
    }

    const userContent = input.trim();
    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: userContent, createdAt: Date.now() };
    addMessage(convId, userMsg);
    setInput('');
    setError(null);

    const latestConv = useChatStore.getState().conversations.find((c) => c.id === convId);
    const messages = (latestConv?.messages ?? [userMsg]).slice(-10);

    const mainAgent = agents.find((a) => a.id === selectedAgentId);
    const mainAssistantId = crypto.randomUUID();
    addMessage(convId, { id: mainAssistantId, role: 'assistant', content: '', createdAt: Date.now(), agentId: mainAgent?.id });
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 没选 Agent → 走默认 Hermes（用一个最小占位 agent 对象）
      const startAgent = mainAgent ?? {
        id: '__default__', name: 'Default', model: '', skills: [], systemPrompt: '', temperature: 0.7,
      };
      let lastOutput = await runAgentStream(convId, startAgent, messages, mainAssistantId, abort);

      // 设置标题（首次对话）
      if (lastOutput.trim() && activeConv?.title === 'New Chat') {
        updateConversation(convId, { title: lastOutput.trim().slice(0, 30) });
      }

      // 轻量 Workflow：按 chainTo 顺序接力
      const chain = mainAgent?.chainTo ?? [];
      for (const nextId of chain) {
        if (abort.signal.aborted) break;
        const nextAgent = agents.find((a) => a.id === nextId);
        if (!nextAgent || !lastOutput.trim()) break;

        // 系统分隔符消息（UI 渲染为接力分隔条）
        addMessage(convId, {
          id: crypto.randomUUID(),
          role: 'system',
          content: `🔗 接力 → ${nextAgent.name}`,
          createdAt: Date.now(),
          agentId: nextAgent.id,
        });

        const nextAssistantId = crypto.randomUUID();
        addMessage(convId, { id: nextAssistantId, role: 'assistant', content: '', createdAt: Date.now(), agentId: nextAgent.id });

        // 接力上下文：把上游 Agent 的输出当作"用户输入"传给下游 Agent
        const chainMessages = [{ role: 'user' as const, content: lastOutput }];
        lastOutput = await runAgentStream(convId, nextAgent, chainMessages, nextAssistantId, abort);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /** 给 Assistant 消息打分；同样 rating 再点一次 = 取消 */
  const rateMessage = (msgId: string, rating: 'up' | 'down') => {
    if (!activeId) return;
    updateMessage(activeId, msgId, (m) => ({
      rating: m.rating === rating ? undefined : rating,
    }));
  };

  /** ⭐ 收藏到知识库 — 创建一个 best-practice 文件夹（如不存在），把消息存为 file 节点 */
  const saveToKnowledge = (msg: { id: string; content: string }) => {
    if (!msg.content.trim()) return;
    let bestPracticeFolderId = knowledgeNodes.find(
      (n) => n.type === 'folder' && n.name === 'Best Practice'
    )?.id;
    if (!bestPracticeFolderId) {
      bestPracticeFolderId = crypto.randomUUID();
      addKnowledgeNode({
        id: bestPracticeFolderId,
        name: 'Best Practice',
        type: 'folder',
        parentId: 'root',
        createdAt: Date.now(),
      });
    }
    const agent = agents.find((a) => a.id === activeConv?.agentId);
    const title = `${agent?.name ?? '通用'} · ${new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')}`;
    addKnowledgeNode({
      id: crypto.randomUUID(),
      name: title,
      type: 'file',
      parentId: bestPracticeFolderId,
      content: msg.content,
      createdAt: Date.now(),
    });
    // 同步标记已收藏
    if (activeId) updateMessage(activeId, msg.id, { starred: true });
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <Button onClick={handleNewChat} className="w-full" variant="outline">
            <Plus className="mr-2 h-4 w-4" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm',
                  activeId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                )}
              >
                <span className="truncate">{c.title || 'Untitled'}</span>
                <button
                  type="button"
                  aria-label="删除对话"
                  title="删除对话"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <div className="border-b px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Agent:</span>
          <Select
            value={selectedAgentId || '__none__'}
            onValueChange={(v) => setSelectedAgentId(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Default (no agent)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Default (no agent)</SelectItem>
              {/* 预设 Agent 分组 */}
              {agents.filter(a => PRESET_AGENTS.some(p => p.id === a.id)).length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    预设 Agent
                  </div>
                  {agents.filter(a => PRESET_AGENTS.some(p => p.id === a.id)).map((a) => {
                    const Icon = AGENT_ICONS[a.id] || Bot;
                    return (
                      <SelectItem key={a.id} value={a.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{a.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </>
              )}
              {/* 自定义 Agent 分组 */}
              {agents.filter(a => !PRESET_AGENTS.some(p => p.id === a.id)).length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium mt-1 flex items-center gap-1">
                    <span className="text-muted-foreground">●</span>
                    自定义
                  </div>
                  {agents.filter(a => !PRESET_AGENTS.some(p => p.id === a.id)).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 shrink-0" />
                        <span>{a.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          {activeMemoryCount > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
              title={`${activeMemoryCount} 条公司基线（critical/high）正在自动注入到每次对话`}
            >
              <Shield className="h-3 w-3" />
              基线 {activeMemoryCount} 条已注入
            </span>
          )}
        </div>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {activeConv?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
              <Bot className="h-10 w-10 opacity-20" />
              <p>Send a message to start chatting</p>
            </div>
          )}
          <div className="space-y-4 max-w-3xl mx-auto">
            {activeConv?.messages.map((m, idx) => {
              // 系统消息 = 接力分隔条
              if (m.role === 'system') {
                return (
                  <div key={m.id} className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border">
                      <Link2 className="h-3 w-3" />
                      {m.content}
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                );
              }
              const isLastAssistant =
                m.role === 'assistant' &&
                idx === (activeConv.messages.length - 1);
              const showFeedback =
                m.role === 'assistant' && !!m.content && !(isStreaming && isLastAssistant);
              const msgAgent = m.agentId ? agents.find((a) => a.id === m.agentId) : null;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex gap-3',
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    {m.role === 'assistant' && msgAgent && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        {msgAgent.name}
                      </span>
                    )}
                    <div
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm whitespace-pre-wrap',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border'
                      )}
                    >
                      {m.content || (isStreaming ? <span className="animate-pulse">Thinking...</span> : '')}
                    </div>
                    {showFeedback && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => rateMessage(m.id, 'up')}
                          title="赞同（标记为好答案，将用于沉淀 best practice）"
                          aria-label="赞同"
                          className={cn(
                            'p-1 rounded hover:bg-muted transition-colors',
                            m.rating === 'up' && 'text-emerald-600 bg-emerald-500/10'
                          )}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => rateMessage(m.id, 'down')}
                          title="不准确（用于改进）"
                          aria-label="不准确"
                          className={cn(
                            'p-1 rounded hover:bg-muted transition-colors',
                            m.rating === 'down' && 'text-rose-600 bg-rose-500/10'
                          )}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveToKnowledge(m)}
                          title={m.starred ? '已收藏到 Knowledge / Best Practice' : '⭐ 收藏到知识库（Best Practice）'}
                          aria-label="收藏到知识库"
                          disabled={m.starred}
                          className={cn(
                            'p-1 rounded hover:bg-muted transition-colors',
                            m.starred && 'text-amber-500 bg-amber-500/10 cursor-default'
                          )}
                        >
                          <Star className={cn('h-3.5 w-3.5', m.starred && 'fill-current')} />
                        </button>
                        {m.starred && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">
                            已存入 Knowledge › Best Practice
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
              className="flex-1"
            />
            <Button type="submit" disabled={isStreaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
