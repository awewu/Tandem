/**
 * OpenAI 兼容协议代理端点。
 *
 * 把客户端发来的 messages 直接转发到 agent.provider.baseURL/chat/completions（stream=true），
 * 然后把上游 SSE 转码成本应用统一的 { content } / { error } / { done } 格式。
 *
 * 这样每个 Agent 都能配置不同的 LLM 服务商（OpenAI、DeepSeek、Moonshot、Ollama 等），
 * 互不干扰。
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
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { messages = [], model, systemPrompt, temperature, provider } = body;

  if (!provider?.baseURL) {
    return errorResponse('Missing provider.baseURL — 请在 Agent 配置里填写 LLM 代理 baseURL', 400);
  }
  if (!model) {
    return errorResponse('Missing model — 请在 Agent 配置里填写 model 名称', 400);
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
  };
  if (provider.apiKey) {
    upstreamHeaders.Authorization = `Bearer ${provider.apiKey}`;
  }

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
