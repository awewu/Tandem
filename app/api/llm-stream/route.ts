/**
 * OpenAI 兼容协议代理端点 + Team Token 路由
 *
 * 两条路径:
 *   1. teamProvider 模式 (Team Token): 直接走服务端 TAF Router chatStream
 *      - 员工无需填 API key，公司 token 池统一供给
 *      - body: { teamProvider: 'claude-opus-4-5', messages, model, systemPrompt, temperature }
 *
 *   2. 个人代理模式 (Personal): 转发到 agent.provider.baseURL/chat/completions (已有逻辑)
 *      - body: { provider: { baseURL, apiKey? }, messages, model, systemPrompt, temperature }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProviderConfig {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages?: IncomingMessage[];
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  provider?: ProviderConfig;
  /** Team 模式: TAF router 注册的 provider 名 (如 'claude-opus-4-5') */
  teamProvider?: string;
}

/** 服务端根据 baseURL 自动注入 API key (前端不暴露 key) */
function resolveApiKey(baseURL: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  const url = baseURL.toLowerCase();
  if (url.includes('deepseek.com')) return process.env.DEEPSEEK_API_KEY ?? '';
  if (url.includes('moonshot.cn') || url.includes('kimi')) return process.env.KIMI_API_KEY ?? '';
  if (url.includes('dashscope') || url.includes('qwen')) return process.env.QWEN_API_KEY ?? '';
  if (url.includes('volces.com') || url.includes('doubao')) return process.env.DOUBAO_API_KEY ?? '';
  if (url.includes('openai.com')) return process.env.OPENAI_API_KEY ?? '';
  if (url.includes('bigmodel') || url.includes('zhipu')) return process.env.ZHIPU_API_KEY ?? '';
  if (url.includes('anthropic.com')) return process.env.ANTHROPIC_API_KEY ?? '';
  return '';
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { messages = [], model, systemPrompt, temperature, provider, teamProvider } = body;

  // ── Team Token 路径：走 TAF Router，key 完全服务端持有 ──────────────
  if (teamProvider) {
    return handleTeamStream({ teamProvider, messages, model, systemPrompt, temperature, signal: req.signal });
  }

  // ── Personal 路径：直接转发到用户指定的 baseURL ─────────────────────
  if (!provider?.baseURL) {
    return errorResponse('Missing provider.baseURL — 请在 Agent 配置里填写 LLM 代理 baseURL', 400);
  }
  if (!model) {
    return errorResponse('Missing model — 请在 Agent 配置里填写 model 名称', 400);
  }

  // 服务端注入 API key（安全：key 不经过前端）
  const resolvedKey = resolveApiKey(provider.baseURL, provider.apiKey);
  if (!resolvedKey) {
    return errorResponse(
      `未找到 ${provider.baseURL} 对应的 API key，请在服务端 .env.local 中配置`,
      401,
    );
  }

  // 拼装 OpenAI 协议 messages（systemPrompt 注入为第一条 system）
  const upstreamMessages: IncomingMessage[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    upstreamMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    if (m && typeof m.content === 'string') upstreamMessages.push({ role: m.role, content: m.content });
  }

  const upstreamUrl = provider.baseURL.replace(/\/+$/, '') + '/chat/completions';
  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(provider.headers ?? {}),
    Authorization: `Bearer ${resolvedKey}`,
  };

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: unknown) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    } catch {
      /* ignore */
    }
  };

  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      // 上游中断信号：客户端断了 -> 取消上游 fetch
      const upstreamAbort = new AbortController();
      const onAbort = () => {
        try {
          upstreamAbort.abort();
        } catch {
          /* ignore */
        }
        send(controller, { done: true });
        safeClose();
      };
      req.signal.addEventListener('abort', onAbort);

      let upstream: Response;
      try {
        upstream = await fetch(upstreamUrl, {
          method: 'POST',
          headers: upstreamHeaders,
          body: JSON.stringify({
            model,
            messages: upstreamMessages,
            temperature: typeof temperature === 'number' ? temperature : undefined,
            stream: true,
          }),
          signal: upstreamAbort.signal,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(controller, { error: `上游请求失败: ${msg}` });
        send(controller, { done: true });
        req.signal.removeEventListener('abort', onAbort);
        safeClose();
        return;
      }

      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '');
        send(controller, {
          error: `上游 ${upstream.status} ${upstream.statusText}: ${text.slice(0, 500)}`,
        });
        send(controller, { done: true });
        req.signal.removeEventListener('abort', onAbort);
        safeClose();
        return;
      }

      // 解析上游 SSE，转码为 { content } 块
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE 以 \n\n 分包
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of rawEvent.split('\n')) {
              const t = line.trim();
              if (!t.startsWith('data:')) continue;
              const payload = t.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                // OpenAI / 兼容: choices[0].delta.content
                const delta = json?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta.length) {
                  send(controller, { content: delta });
                }
                // 某些供应商在最后一帧给 finish_reason
                const finish = json?.choices?.[0]?.finish_reason;
                if (finish && finish !== 'null') {
                  // 让外层 done 控制
                }
              } catch {
                // 无法解析的行直接忽略（兼容厂商的心跳/注释）
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(controller, { error: `读取上游流失败: ${msg}` });
      }

      send(controller, { done: true });
      req.signal.removeEventListener('abort', onAbort);
      safeClose();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ---------------------------------------------------------------------------
// Team Token 路径 — 走 TAF Router chatStream (服务端持有 key)
// ---------------------------------------------------------------------------

interface TeamStreamParams {
  teamProvider: string;
  messages: IncomingMessage[];
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  signal: AbortSignal;
}

async function handleTeamStream(params: TeamStreamParams): Promise<Response> {
  const { teamProvider, messages, model, systemPrompt, temperature, signal } = params;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: unknown) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    } catch { /* ignore */ }
  };

  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };

      signal.addEventListener('abort', () => { send(controller, { done: true }); safeClose(); });

      try {
        // 动态 import 避免循环依赖，boot 保证 router 已初始化
        const { boot, getRouter } = await import('@/lib/boot');
        await boot();
        const router = getRouter();

        // 检查 teamProvider 是否已注册
        if (!router.listProviders().includes(teamProvider)) {
          send(controller, { error: `Team provider "${teamProvider}" 未注册，请管理员配置对应 API key` });
          send(controller, { done: true });
          safeClose();
          return;
        }

        const chatMessages: import('@/lib/taf/provider/types').ChatMessage[] = [];
        if (systemPrompt?.trim()) chatMessages.push({ role: 'system', content: systemPrompt });
        for (const m of messages) {
          if (m && typeof m.content === 'string') chatMessages.push({ role: m.role, content: m.content });
        }

        const stream = router.chatStream({
          messages: chatMessages,
          forceProvider: teamProvider,
          ...(model ? { } : {}),
          temperature: typeof temperature === 'number' ? temperature : undefined,
          scenario: 'agentic',
        });

        for await (const chunk of stream) {
          if (signal.aborted) break;
          const text = typeof chunk.delta?.content === 'string' ? chunk.delta.content : '';
          if (text) send(controller, { content: text });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(controller, { error: `Team AI 调用失败: ${msg}` });
      }

      send(controller, { done: true });
      safeClose();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function errorResponse(message: string, status: number): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
