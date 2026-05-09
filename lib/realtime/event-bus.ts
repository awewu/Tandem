/**
 * Event Bus · 实时通信
 *
 * V1: SSE (Server-Sent Events) - 单向 server → client, 简单足够议事室
 * V2: WebSocket / EMQX - 双向, 支持高并发IM
 *
 * 用途:
 *   - 议事室多人协作 (新评论 / 选项变更 / 状态变更)
 *   - Persona 升级通知
 *   - 系统通知
 */

type EventListener = (event: BusEvent) => void;

export interface BusEvent {
  type: string;
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

class EventBus {
  private channels = new Map<string, Set<EventListener>>();

  subscribe(channel: string, listener: EventListener): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(listener);
    return () => this.channels.get(channel)?.delete(listener);
  }

  publish(event: Omit<BusEvent, 'timestamp'>): void {
    const full: BusEvent = { ...event, timestamp: new Date().toISOString() };
    const listeners = this.channels.get(event.channel);
    if (listeners) {
      Array.from(listeners).forEach((l) => {
        try {
          l(full);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[event-bus] listener error:', err);
        }
      });
    }
    // also publish to wildcard channel
    const wildcard = this.channels.get('*');
    if (wildcard) {
      Array.from(wildcard).forEach((l) => {
        try {
          l(full);
        } catch {
          /* noop */
        }
      });
    }
  }

  hasListeners(channel: string): boolean {
    return (this.channels.get(channel)?.size ?? 0) > 0;
  }
}

let _bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_bus) _bus = new EventBus();
  return _bus;
}

// ---------------------------------------------------------------------------
// SSE helpers (Next.js Edge route)
// ---------------------------------------------------------------------------

export function makeSSEStream(channel: string): ReadableStream {
  const encoder = new TextEncoder();
  const bus = getEventBus();

  return new ReadableStream({
    start(controller) {
      const send = (event: BusEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Initial connect message
      send({
        type: 'connected',
        channel,
        payload: { channel },
        timestamp: new Date().toISOString(),
      });

      const unsubscribe = bus.subscribe(channel, send);

      // Heartbeat 每 30s 防止代理超时
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      // Cleanup on close — 通过 AbortController 在 route handler 中处理
    },
  });
}
