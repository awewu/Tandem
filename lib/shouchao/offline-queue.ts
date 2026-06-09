/**
 * 搭子手抄 · 离线捕获队列 (客户端)
 *
 * 笔记类 app 的手机端刚需: 断网也能随手记. 离线时把笔记落 localStorage 队列,
 * 恢复网络后通过 /api/shouchao/sync (push) 一次性回传, 服务端按 LWW 合并.
 *
 * 仅在浏览器运行 (localStorage). SSR/无 window 时所有函数安全空操作.
 */

import type { ShouchaoNote } from '../types/shouchao';

const QUEUE_KEY = 'shouchao.offline.queue.v1';

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** 客户端生成本地 id (服务端把未知 id 视为新建). */
export function localNoteId(): string {
  return `sc_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readQueue(): ShouchaoNote[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as ShouchaoNote[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(notes: ShouchaoNote[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(notes));
  } catch {
    /* 配额满 / 隐私模式 — 忽略, 不阻断捕获 */
  }
}

/** 入队一条离线笔记. 返回入队后的笔记 (含本地 id/时间戳). */
export function enqueue(partial: Partial<ShouchaoNote>): ShouchaoNote {
  const ts = new Date().toISOString();
  const note: ShouchaoNote = {
    id: partial.id ?? localNoteId(),
    ownerId: partial.ownerId ?? 'local',
    tenantId: partial.tenantId ?? 'local',
    title: partial.title ?? '未命名笔记',
    content: partial.content ?? '',
    tags: partial.tags ?? [],
    sourceUrl: partial.sourceUrl,
    summary: partial.summary,
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
  };
  writeQueue([...readQueue(), note]);
  return note;
}

export function queueSize(): number {
  return readQueue().length;
}

/**
 * 冲洗队列: 把全部离线笔记 push 到服务端, 成功后清空队列, 返回服务端权威笔记.
 * 任一步失败 → 保留队列, 返回 null (下次再试).
 */
export async function flushQueue(): Promise<ShouchaoNote[] | null> {
  const queued = readQueue();
  if (queued.length === 0) return [];
  try {
    const r = await fetch('/api/shouchao/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: queued }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { notes?: ShouchaoNote[] };
    writeQueue([]); // 成功才清空
    return d.notes ?? [];
  } catch {
    return null; // 仍离线, 保留队列
  }
}
