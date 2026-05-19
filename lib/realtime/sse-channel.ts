/**
 * §T12 实时协作: SSE 通道层
 *   - 无状态, 每个连接独立
 *   - 按 documentId / userId 广播
 */

const channels = new Map<string, Set<ReadableStreamDefaultController>>();

export function subscribe(channel: string, controller: ReadableStreamDefaultController) {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(controller);
}

export function unsubscribe(channel: string, controller: ReadableStreamDefaultController) {
  channels.get(channel)?.delete(controller);
}

export function broadcast(channel: string, data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const enc = new TextEncoder();
  channels.get(channel)?.forEach((ctrl) => {
    try { ctrl.enqueue(enc.encode(payload)); } catch { /* client closed */ }
  });
}

export function createSSEStream(channel: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      subscribe(channel, controller);
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));
    },
    cancel(controller) {
      unsubscribe(channel, controller);
    },
  });
}
