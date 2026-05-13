/**
 * Unified SSE (Server-Sent Events) reader.
 *
 * Handles both simple `data:` streams (chat / BYOK) and named `event:` streams
 * (workflows / convergence). Consumes a fetch Response body and yields parsed
 * events as an async generator.
 *
 * Usage:
 *   for await (const ev of readSSE(response)) {
 *     console.log(ev.event ?? 'message', ev.data);
 *   }
 */

export interface SSEEvent {
  /** Event name (e.g. 'node:start', 'done'). Defaults to 'message' for simple streams. */
  event: string;
  /** Parsed JSON payload, or raw string if JSON parsing failed. */
  data: unknown;
  /** Raw data string before JSON parsing. */
  raw: string;
}

/**
 * Parse an SSE stream from a fetch Response.
 *
 * Supports:
 *   - `data: {...}\n\n`  (simple stream)
 *   - `event: foo\ndata: {...}\n\n`  (named event stream)
 *   - Multiple data lines per event (concatenated)
 */
export async function* readSSE(response: Response): AsyncGenerator<SSEEvent, void, unknown> {
  if (!response.body) {
    throw new Error('SSE response has no readable body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = block.split('\n');
        let eventName = 'message';
        let dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
          // ignore 'id:', 'retry:', comments, empty lines
        }

        const raw = dataLines.join('\n');
        if (!raw) continue;

        // Skip OpenAI-style [DONE] sentinel
        if (raw === '[DONE]') continue;

        let data: unknown = raw;
        try {
          data = JSON.parse(raw);
        } catch {
          /* leave as raw string */
        }

        yield { event: eventName, data, raw };
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Higher-level helper: consume an SSE stream with callbacks.
 *
 * Returns a cleanup function that cancels the reader.
 */
export function consumeSSE(
  response: Response,
  handlers: {
    onEvent?: (event: string, data: unknown, raw: string) => void;
    onError?: (err: Error) => void;
    onDone?: () => void;
  },
  signal?: AbortSignal
): () => void {
  let cancelled = false;
  const abort = () => {
    cancelled = true;
  };

  (async () => {
    try {
      for await (const ev of readSSE(response)) {
        if (cancelled) break;
        if (signal?.aborted) break;
        handlers.onEvent?.(ev.event, ev.data, ev.raw);
      }
      if (!cancelled && !signal?.aborted) {
        handlers.onDone?.();
      }
    } catch (err) {
      if (!cancelled && !signal?.aborted) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return abort;
}
