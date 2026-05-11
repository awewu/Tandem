/**
 * 1on1 store ↔ API sync (A2.3)
 *
 * 设计:
 *   - zustand 用 number ms epoch + 内嵌 actionItems[]
 *   - 后端用 ISO string + 拆开两个表
 *   - 此模块负责双向适配 + dual-write
 *
 * 调用方式:
 *   - loadFromApi(): 拉所有 (mine 范围) meeting + 每个的 action items, 转成 zustand shape
 *   - syncCreateMeeting(local): POST /api/1on1, body 带 local.id (server accept)
 *   - syncUpdateMeeting / syncDeleteMeeting / sync*ActionItem: 同理
 *
 *   所有 sync 都 fire-and-forget (不 await), 错误日志到 console.
 */

import type {
  OneOnOneMeeting as LocalMeeting,
  OneOnOneActionItem as LocalActionItem,
} from '@/lib/store';
import type {
  OneOnOneMeeting as ApiMeeting,
  OneOnOneActionItem as ApiActionItem,
} from '@/lib/types/one-on-one';

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

function isoToMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? undefined : t;
}

function msToIso(ms: number | undefined | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

export function meetingFromApi(api: ApiMeeting, items: ApiActionItem[]): LocalMeeting {
  return {
    id: api.id,
    managerId: api.managerId,
    reportId: api.reportId,
    cadence: api.cadence,
    scheduledAt: isoToMs(api.scheduledAt) ?? Date.now(),
    startedAt: isoToMs(api.startedAt),
    completedAt: isoToMs(api.completedAt),
    status: api.status,
    agendaManager: api.agendaManager ?? undefined,
    agendaReport: api.agendaReport ?? undefined,
    noteProgress: api.noteProgress ?? undefined,
    noteBlockers: api.noteBlockers ?? undefined,
    noteNextSteps: api.noteNextSteps ?? undefined,
    linkedKrIds: api.linkedKrIds ?? [],
    actionItems: items.map(actionItemFromApi),
    moodScore: api.moodScore ?? undefined,
    privateManagerNote: api.privateManagerNote ?? undefined,
    createdAt: isoToMs(api.createdAt) ?? Date.now(),
    updatedAt: isoToMs(api.updatedAt) ?? Date.now(),
  };
}

export function actionItemFromApi(api: ApiActionItem): LocalActionItem {
  return {
    id: api.id,
    text: api.text,
    assigneeId: api.assigneeId,
    dueDate: isoToMs(api.dueDate),
    done: api.done,
  };
}

function meetingToApi(local: LocalMeeting): Partial<ApiMeeting> & { id?: string } {
  return {
    id: local.id,
    managerId: local.managerId,
    reportId: local.reportId,
    cadence: local.cadence,
    scheduledAt: msToIso(local.scheduledAt) ?? new Date().toISOString(),
    startedAt: msToIso(local.startedAt),
    completedAt: msToIso(local.completedAt),
    status: local.status,
    agendaManager: local.agendaManager ?? null,
    agendaReport: local.agendaReport ?? null,
    noteProgress: local.noteProgress ?? null,
    noteBlockers: local.noteBlockers ?? null,
    noteNextSteps: local.noteNextSteps ?? null,
    linkedKrIds: local.linkedKrIds,
    moodScore: local.moodScore ?? null,
    privateManagerNote: local.privateManagerNote ?? null,
  };
}

// ---------------------------------------------------------------------------
// API operations (fire-and-forget; logs errors)
// ---------------------------------------------------------------------------

async function safeFetch(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'include',
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[1on1-sync] ${init?.method ?? 'GET'} ${url} -> ${res.status}`);
    }
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[1on1-sync] network err ${url}:`, err);
    return null;
  }
}

export async function loadAllFromApi(): Promise<LocalMeeting[]> {
  const res = await safeFetch('/api/1on1');
  if (!res || !res.ok) return [];
  const { meetings } = (await res.json()) as { meetings: ApiMeeting[] };
  // 拉每个的 action items (并发)
  const enriched = await Promise.all(
    meetings.map(async (m) => {
      const r2 = await safeFetch(`/api/1on1/${m.id}`);
      if (!r2 || !r2.ok) return meetingFromApi(m, []);
      const data = (await r2.json()) as { meeting: ApiMeeting; actionItems: ApiActionItem[] };
      return meetingFromApi(data.meeting, data.actionItems ?? []);
    }),
  );
  return enriched;
}

export function syncCreateMeeting(local: LocalMeeting): void {
  void safeFetch('/api/1on1', {
    method: 'POST',
    body: JSON.stringify(meetingToApi(local)),
  });
}

export function syncUpdateMeeting(id: string, patch: Partial<LocalMeeting>): void {
  // 转换 patch 字段
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'scheduledAt' || k === 'startedAt' || k === 'completedAt') {
      out[k] = msToIso(v as number | undefined | null);
    } else if (k === 'actionItems' || k === 'createdAt' || k === 'updatedAt') {
      // skip (managed by server / separate endpoints)
    } else if (v === undefined) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  void safeFetch(`/api/1on1/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(out),
  });
}

export function syncDeleteMeeting(id: string): void {
  void safeFetch(`/api/1on1/${id}`, { method: 'DELETE' });
}

export function syncAddActionItem(
  meetingId: string,
  itemId: string,
  text: string,
  assigneeId: string,
  dueDate: number | undefined,
): void {
  void safeFetch(`/api/1on1/${meetingId}/action-items`, {
    method: 'POST',
    body: JSON.stringify({
      id: itemId,
      text,
      assigneeId,
      dueDate: msToIso(dueDate),
    }),
  });
}

export function syncToggleActionItem(itemId: string, done: boolean): void {
  void safeFetch(`/api/1on1/action-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
}

export function syncDeleteActionItem(itemId: string): void {
  void safeFetch(`/api/1on1/action-items/${itemId}`, { method: 'DELETE' });
}
