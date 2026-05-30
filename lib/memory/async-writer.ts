/**
 * §Memory Async Writer · 异步写入队列
 *
 * 2026 Mem0 best practice: "Memory writes that block the response pipeline add latency
 * that the user feels. Make async_mode=True by default."
 *
 * 设计:
 *   - 主路径 (chat / brief / reflection) 调 enqueueMemoryWrite(entry) 立刻返回
 *   - 队列在 microtask + setInterval (200ms flush) 跑实际 store.memories.create
 *   - 失败重试: 指数退避 2s/4s/8s, 3 次后落 dead-letter (log warn)
 *   - 测试模式 (NODE_ENV=test): 同步 flush, 不并发 (避免 flaky)
 *
 * 不替代同步 API (有些路径仍需要 await create):
 *   - 当需要立刻读 id (如 promotion request) 时仍用 store.memories.create()
 *   - 这个模块只服务"写完就不管"的场景 (议事/IM/reflection 流水)
 */
import type { MemoryEntry } from '@/lib/types/memory';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

interface QueueItem {
  entry: MemoryEntry;
  retries: number;
  nextAttemptAt: number;
}

type WriterMode = 'async' | 'sync';

class MemoryAsyncWriter {
  private queue: QueueItem[] = [];
  private flushing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: WriterMode = process.env.NODE_ENV === 'test' ? 'sync' : 'async';
  private metrics = {
    enqueued: 0,
    flushed: 0,
    failed: 0,
    deadLetter: 0,
  };
  /** 内联 sink (测试用): 替代 store.memories.create, 验证 enqueue 被调 */
  private sink: ((entry: MemoryEntry) => Promise<void>) | null = null;

  /** 启动 background flush loop (生产路径自动启动一次) */
  start(intervalMs = 200): void {
    if (this.timer || this.mode === 'sync') return;
    this.timer = setInterval(() => { void this.flush(); }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** §测试用 · 注入 sink + 切到 sync. 跑完测试调 reset() */
  __testInject(opts: { sink: (entry: MemoryEntry) => Promise<void>; mode?: WriterMode }): void {
    this.sink = opts.sink;
    if (opts.mode) this.mode = opts.mode;
  }

  __testReset(): void {
    this.sink = null;
    this.mode = process.env.NODE_ENV === 'test' ? 'sync' : 'async';
    this.queue = [];
    this.metrics = { enqueued: 0, flushed: 0, failed: 0, deadLetter: 0 };
  }

  getMetrics() {
    return { ...this.metrics, queueLength: this.queue.length };
  }

  /** 公共入队 */
  async enqueue(entry: MemoryEntry): Promise<void> {
    this.metrics.enqueued++;
    this.queue.push({ entry, retries: 0, nextAttemptAt: Date.now() });
    if (this.mode === 'sync') {
      await this.flush();
    } else {
      this.start();
      // microtask: 短任务立即 flush, 不等 interval
      queueMicrotask(() => { void this.flush(); });
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;
    this.flushing = true;
    try {
      const now = Date.now();
      const ready: QueueItem[] = [];
      const rest: QueueItem[] = [];
      for (const item of this.queue) {
        if (item.nextAttemptAt <= now) ready.push(item);
        else rest.push(item);
      }
      this.queue = rest;
      // 顺序处理 (避免并发踩 KvStore 锁)
      for (const item of ready) {
        try {
          if (this.sink) {
            await this.sink(item.entry);
          } else {
            const store = getStore();
            await store.memories.create(item.entry);
          }
          this.metrics.flushed++;
        } catch (err) {
          item.retries++;
          if (item.retries >= 3) {
            this.metrics.deadLetter++;
            logger.warn(
              { id: item.entry.id, err: (err as Error).message, retries: item.retries },
              '[memory-async] dead-letter (3 retries exhausted)',
            );
          } else {
            this.metrics.failed++;
            // 指数退避: 2s → 4s → 8s
            item.nextAttemptAt = Date.now() + 2000 * Math.pow(2, item.retries - 1);
            this.queue.push(item);
            logger.warn(
              { id: item.entry.id, retries: item.retries, err: (err as Error).message },
              '[memory-async] retry',
            );
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /** 强制 drain 所有 ready items (测试 / shutdown 用) */
  async drainNow(maxRounds = 10): Promise<void> {
    for (let i = 0; i < maxRounds && this.queue.length > 0; i++) {
      await this.flush();
      if (this.queue.length > 0) {
        // 等过 backoff
        await new Promise((r) => setTimeout(r, 10));
      }
    }
  }
}

// SSR-safe singleton
const _g = globalThis as typeof globalThis & { __tandem_mem_async_writer__?: MemoryAsyncWriter };
function getWriter(): MemoryAsyncWriter {
  if (!_g.__tandem_mem_async_writer__) _g.__tandem_mem_async_writer__ = new MemoryAsyncWriter();
  return _g.__tandem_mem_async_writer__;
}

// 公开 API
export async function enqueueMemoryWrite(entry: MemoryEntry): Promise<void> {
  return getWriter().enqueue(entry);
}

export function memoryWriterMetrics() {
  return getWriter().getMetrics();
}

export function memoryWriter() {
  return getWriter();
}

export function drainMemoryWriter(maxRounds?: number): Promise<void> {
  return getWriter().drainNow(maxRounds);
}
