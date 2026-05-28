'use client';

/**
 * /persona/training — 分身训练台
 *
 * 双栏布局:
 *   左侧: 养料来源仪表盘 (透明展示分身在学哪些真实数据；当前只读，opt-out 控制待下次)
 *   右侧: 对话训练 (SSE 流式 + 用户给"像我/不像我"反馈)
 *
 * 诚实标注:
 *   - 养料为空 → 显示「养料尚不足，建议先写日报或填 TTI」
 *   - LLM 失败 → destructive toast + 历史里写「⚠️ LLM 未响应」
 *   - V1 阶段反馈只更新统计字段，不真改 LLM 权重（"反向训练" 是 V2）
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';
import {
  Brain,
  Send,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  CheckSquare,
  AlertTriangle,
  Zap,
  Database,
  BookOpen,
  Target,
} from 'lucide-react';

interface TrainingContext {
  source: 'real' | 'empty';
  reason?: string;
  totals: { checkIns: number; ttis: number; memories: number };
  recentCheckIns: Array<{
    id: string;
    krTitle: string;
    achievements: string | null;
    blockers: string | null;
    nextSteps: string | null;
    mood: string | null;
    createdAt: string;
  }>;
  recentTtis: Array<{ id: string; title: string; ownerId: string; cycleId: string }>;
  memoryReferences: Array<{ id: string; type: string; title: string; body: string }>;
  styleProfile: {
    decisionSpeed?: string;
    riskAppetite?: number;
    communicationStyle?: string;
  } | null;
  stage: string | null;
  bossCaptureScore: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'llm' | 'fallback';
  model?: string;
  feedback?: 'like' | 'dislike' | null;
}

export default function PersonaTrainingPage() {
  const me = useCurrentUserId();
  const { toast } = useToast();

  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // 拉训练养料
  const loadCtx = useCallback(async () => {
    if (!me) return;
    setCtxLoading(true);
    try {
      const res = await fetch(`/api/persona/${encodeURIComponent(me)}/training-context`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TrainingContext;
      setCtx(json);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '养料加载失败',
        description: (e as Error).message,
      });
    } finally {
      setCtxLoading(false);
    }
  }, [me, toast]);

  useEffect(() => { void loadCtx(); }, [loadCtx]);

  // 发送一条训练对话
  const handleSend = async () => {
    const q = input.trim();
    if (!q || streaming || !ctx) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    // 把养料聚合为短摘要，传给 API（避免服务端再查一次）
    const contextPayload = {
      styleProfile: ctx.styleProfile,
      recentAchievements: ctx.recentCheckIns
        .map((c) => c.achievements)
        .filter((x): x is string => !!x?.trim()),
      recentBlockers: ctx.recentCheckIns
        .map((c) => c.blockers)
        .filter((x): x is string => !!x?.trim()),
      recentNextSteps: ctx.recentCheckIns
        .map((c) => c.nextSteps)
        .filter((x): x is string => !!x?.trim()),
      memoryTitles: ctx.memoryReferences.map((m) => m.title),
    };

    let accumulated = '';
    let source: 'llm' | 'fallback' = 'fallback';
    let model: string | undefined;
    let reason: string | undefined;

    try {
      const res = await fetch('/api/ai/persona-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ query: q, context: contextPayload }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as
                | { type: 'delta'; content: string }
                | { type: 'done'; source: 'llm' | 'fallback'; model?: string; reason?: string };
              if (ev.type === 'delta') {
                accumulated += ev.content;
                setStreamingText(accumulated);
              } else if (ev.type === 'done') {
                source = ev.source;
                model = ev.model;
                reason = ev.reason;
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (e) {
      reason = (e as Error).message;
    } finally {
      setStreaming(false);
    }

    // 写入最终消息：诚实标注 source
    if (accumulated.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: accumulated, source, model, feedback: null },
      ]);
    } else {
      const hint = `⚠️ LLM 未返回内容。原因: ${reason ?? 'unknown'}。请检查 /docs/AI-SETUP.md 配置 provider 后重试。`;
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: hint, source: 'fallback', reason, feedback: null },
      ]);
      toast({ variant: 'destructive', title: 'AI 未响应', description: reason ?? 'unknown' });
    }
    setStreamingText('');
  };

  // 用户给反馈：像我 / 不像我
  const handleFeedback = async (msgId: string, kind: 'like' | 'dislike') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: kind } : m)),
    );

    // 更新 persona 统计字段（不是真改 LLM 权重，仅记录信号）
    // 注意：这里假设 persona 已经存在；如果不存在 API 会返回 404，前端忽略
    if (!me) return;
    try {
      // 先拉当前 persona
      const r1 = await fetch(`/api/persona/${encodeURIComponent(me)}`);
      if (!r1.ok) return; // persona 不存在就跳过
      const j1 = await r1.json();
      const p = j1.persona;
      if (!p?.decisionHistory) return;

      const dh = p.decisionHistory;
      const patched = {
        decisionHistory: {
          ...dh,
          totalDecisions: (dh.totalDecisions ?? 0) + 1,
          vetoedByUser:
            kind === 'dislike' ? (dh.vetoedByUser ?? 0) + 1 : dh.vetoedByUser ?? 0,
          vetoRate:
            ((dh.vetoedByUser ?? 0) + (kind === 'dislike' ? 1 : 0)) /
            ((dh.totalDecisions ?? 0) + 1),
        },
      };
      await fetch(`/api/persona/${encodeURIComponent(me)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patched),
      });
    } catch {
      // 反馈失败不弹错——只是统计字段没更新
    }
  };

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          分身训练台
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          左侧透明展示分身从你哪些真实数据里学；右侧训练对话，标「像我 / 不像我」收集偏好信号。
        </p>
      </header>

      {/* V1 诚实标签 */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            V1 阶段：反馈仅更新 <code className="font-mono">persona.decisionHistory</code> 统计字段（vetoRate 等），
            <strong>不会真改 LLM 权重</strong>。真实的「反向训练 pipeline」在 V2 落地。
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左：养料来源仪表盘 */}
        <div className="lg:col-span-5 space-y-3">
          {ctxLoading ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : !ctx ? null : ctx.source === 'empty' ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center space-y-2">
                <Database className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-semibold">养料尚不足</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {ctx.reason}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 总览 */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    分身当前学习的真实数据
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadCtx()}
                      className="ml-auto h-6 w-6 p-0"
                      title="刷新"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="space-y-0.5">
                      <div className="text-lg font-bold tabular-nums text-slate-800">{ctx.totals.checkIns}</div>
                      <div className="text-[10px] text-muted-foreground">日报 check-in</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-lg font-bold tabular-nums text-slate-800">{ctx.totals.ttis}</div>
                      <div className="text-[10px] text-muted-foreground">TTI 填报</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-lg font-bold tabular-nums text-slate-800">{ctx.totals.memories}</div>
                      <div className="text-[10px] text-muted-foreground">个人 Memory</div>
                    </div>
                  </div>
                  {ctx.styleProfile && (
                    <div className="pt-2 border-t mt-2 text-[10px] text-muted-foreground space-y-0.5">
                      {ctx.styleProfile.decisionSpeed && (
                        <div>决策速度: <span className="font-mono">{ctx.styleProfile.decisionSpeed}</span></div>
                      )}
                      {typeof ctx.styleProfile.riskAppetite === 'number' && (
                        <div>风险偏好: <span className="font-mono">{ctx.styleProfile.riskAppetite.toFixed(2)}</span></div>
                      )}
                      {ctx.styleProfile.communicationStyle && (
                        <div>沟通风格: <span className="font-mono">{ctx.styleProfile.communicationStyle}</span></div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 最近 check-ins */}
              {ctx.recentCheckIns.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <div className="px-4 py-2 border-b text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <CheckSquare className="h-3 w-3 text-emerald-500" />
                      日报 check-in 养料（{ctx.recentCheckIns.length} 条）
                    </div>
                    <div className="divide-y max-h-[260px] overflow-y-auto">
                      {ctx.recentCheckIns.map((c) => (
                        <div key={c.id} className="px-4 py-2.5 text-[11px] space-y-1">
                          <div className="font-medium text-slate-800">{c.krTitle}</div>
                          {c.achievements && (
                            <p className="text-muted-foreground">
                              <span className="text-emerald-600 font-semibold mr-1">成果:</span>
                              {c.achievements}
                            </p>
                          )}
                          {c.blockers && (
                            <p className="text-muted-foreground">
                              <span className="text-amber-600 font-semibold mr-1">卡点:</span>
                              {c.blockers}
                            </p>
                          )}
                          {c.nextSteps && (
                            <p className="text-muted-foreground">
                              <span className="text-indigo-600 font-semibold mr-1">下一步:</span>
                              {c.nextSteps}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TTI */}
              {ctx.recentTtis.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <div className="px-4 py-2 border-b text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Target className="h-3 w-3 text-primary" />
                      TTI 填报养料（{ctx.recentTtis.length} 条）
                    </div>
                    <ul className="px-4 py-2 space-y-1 text-[11px] text-slate-700">
                      {ctx.recentTtis.map((t) => (
                        <li key={t.id} className="truncate">· {t.title}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Memory */}
              {ctx.memoryReferences.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <div className="px-4 py-2 border-b text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-indigo-500" />
                      个人 Memory 养料（{ctx.memoryReferences.length} 条）
                    </div>
                    <ul className="px-4 py-2 space-y-1 text-[11px] text-slate-700">
                      {ctx.memoryReferences.map((m) => (
                        <li key={m.id} className="truncate">
                          <Badge variant="outline" className="mr-1.5 text-[9px]">{m.type}</Badge>
                          {m.title}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                数据源 opt-out 控制即将上线（V1.1）。当前展示分身实际使用的真实养料，可在
                {' '}<a href="/settings/privacy" className="underline">/settings/privacy</a> 暂时关闭学习。
              </p>
            </>
          )}
        </div>

        {/* 右：训练对话 */}
        <div className="lg:col-span-7">
          <Card className="flex flex-col h-[640px]">
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-800">训练对话</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                场景: persona_dialogue
              </Badge>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && !streaming && (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>问你的分身一个问题，看它用你自己的口吻回答。</p>
                    <p className="mt-1 text-[10px]">例：「客户投诉 SLA 不达标，我该怎么回复？」</p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-start gap-2 text-xs',
                      m.role === 'user' ? 'justify-end' : '',
                    )}
                  >
                    {m.role === 'assistant' && (
                      <span className="p-1 rounded bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                        <Brain className="h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={cn(
                        'p-3 rounded-lg max-w-[80%] leading-relaxed',
                        m.role === 'user'
                          ? 'bg-slate-900 text-white font-medium'
                          : 'bg-slate-100 text-slate-800',
                      )}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/70">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px]',
                              m.source === 'llm'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200',
                            )}
                          >
                            {m.source === 'llm' ? `LLM · ${m.model ?? 'unknown'}` : '降级（未调 LLM）'}
                          </Badge>
                          {/* 反馈按钮 */}
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, 'like')}
                              disabled={m.feedback !== null && m.feedback !== undefined}
                              className={cn(
                                'p-1 rounded hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                                m.feedback === 'like' && 'bg-emerald-100 text-emerald-700',
                              )}
                              title="像我的风格"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, 'dislike')}
                              disabled={m.feedback !== null && m.feedback !== undefined}
                              className={cn(
                                'p-1 rounded hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                                m.feedback === 'dislike' && 'bg-rose-100 text-rose-700',
                              )}
                              title="不像我"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {streaming && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="p-1 rounded bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                      <Brain className="h-3 w-3 animate-pulse" />
                    </span>
                    <div className="p-3 rounded-lg max-w-[80%] bg-slate-100 text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {streamingText || '正在等待 LLM 首个 token…'}
                      <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="问你的分身一个问题…"
                className="h-9 text-xs"
                disabled={streaming || ctx?.source === 'empty'}
              />
              <Button
                onClick={handleSend}
                disabled={streaming || !input.trim() || ctx?.source === 'empty'}
                size="sm"
                className="h-9"
              >
                {streaming ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
