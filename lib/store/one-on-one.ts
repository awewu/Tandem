/**
 * lib/store/one-on-one.ts · 1on1 UI layer (region 7)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为不变 (无 persist, dual-write API).
 * 服务端真值见 lib/types/one-on-one.ts.
 */

import { create } from 'zustand';

// #region 7 · OneOnOne (see lib/types/one-on-one.ts for server) ──────
export type OneOnOneCadence = 'weekly' | 'biweekly' | 'monthly' | 'adhoc';
export type OneOnOneStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface OneOnOneActionItem {
  id: string;
  text: string;
  assigneeId: string;     // 'manager' | 'report' | personId
  /** A3.1: 提升为 OKR Initiative 后回填的 Initiative ID. undefined = 未提升 */
  linkedInitiativeId?: string;
  dueDate?: number;
  done: boolean;
}

export interface OneOnOneMeeting {
  id: string;
  /** 主管 personId */
  managerId: string;
  /** 下级 personId */
  reportId: string;
  cadence: OneOnOneCadence;
  /** 计划开始时间 (ms) */
  scheduledAt: number;
  /** 实际开始时间 (ms), 未开始时 undefined */
  startedAt?: number;
  /** 完成时间 (ms) */
  completedAt?: number;
  status: OneOnOneStatus;
  /** 议程预设 (会前双方各自填) — 也叫 talking points */
  agendaManager?: string;  // 主管想聊的
  agendaReport?: string;   // 员工想聊的
  /** 会中 / 会后填的三段式 */
  noteProgress?: string;   // 进展
  noteBlockers?: string;   // 障碍
  noteNextSteps?: string;  // 下一步
  /** 挂的 KR ID 列表 (连 OKR) */
  linkedKrIds: string[];
  /** 结论性 action items */
  actionItems: OneOnOneActionItem[];
  /** 员工干劲评分 1-5 (可选, 隐私保护, 只主管可见) */
  moodScore?: number;
  /** 隐私: 是否主管可见 (主管和员工各自的 private note) */
  privateManagerNote?: string;
  createdAt: number;
  updatedAt: number;
}

interface OneOnOneStore {
  meetings: OneOnOneMeeting[];
  /** A2.3: 标记是否已从 API 加载过 (避免重复请求) */
  _hydrated: boolean;
  /** A2.3: 从后端拉全量 (mine 范围), 替换本地. 仅在浏览器调用. */
  loadFromApi: () => Promise<void>;
  addMeeting: (m: Omit<OneOnOneMeeting, 'id' | 'createdAt' | 'updatedAt' | 'actionItems' | 'linkedKrIds' | 'status'> & { status?: OneOnOneStatus; actionItems?: OneOnOneActionItem[]; linkedKrIds?: string[] }) => string;
  updateMeeting: (id: string, patch: Partial<OneOnOneMeeting>) => void;
  deleteMeeting: (id: string) => void;
  addActionItem: (meetingId: string, text: string, assigneeId: string, dueDate?: number) => void;
  toggleActionItem: (meetingId: string, itemId: string) => void;
  removeActionItem: (meetingId: string, itemId: string) => void;
  /**
   * A3.1: 把 ActionItem 提升为 OKR Initiative.
   * 1. POST /api/okr/initiatives { keyResultId, title: actionItem.text, dueDate, ownerId: assigneeId }
   * 2. 成功后 PATCH /api/1on1/action-items/[id] { linkedInitiativeId }
   * 3. 失败返回 false; 成功返回 initiativeId
   */
  promoteActionItem: (meetingId: string, itemId: string, keyResultId: string) => Promise<string | false>;
}

/**
 * A2.3 (2026-05-11): 切真后端
 *  - 删 persist 中间件 (D5: 接受 demo localStorage 数据丢弃)
 *  - 每个 mutation: 立即更新本地 + fire-and-forget POST/PATCH/DELETE
 *  - 服务端接受 client 生成的 id (Prisma `@default(cuid())` 但允许显式传)
 *  - loadFromApi: 页面 mount 时调一次, 后续操作维持本地 + 后台同步
 *  - 故意不 await 网络: UI 即时响应; 失败 console.warn
 */
export const useOneOnOneStore = create<OneOnOneStore>()((set, get) => ({
  meetings: [],
  _hydrated: false,
  loadFromApi: async () => {
    if (typeof window === 'undefined') return;
    const { loadAllFromApi } = await import('@/lib/api/one-on-one-sync');
    const meetings = await loadAllFromApi();
    set({ meetings, _hydrated: true });
  },
  addMeeting: (m) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const meeting: OneOnOneMeeting = {
      id,
      actionItems: [],
      linkedKrIds: [],
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
      ...m,
    } as OneOnOneMeeting;
    set((s) => ({ meetings: [...s.meetings, meeting] }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncCreateMeeting(meeting),
      );
    }
    return id;
  },
  updateMeeting: (id, patch) => {
    set((s) => ({
      meetings: s.meetings.map((x) =>
        x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x,
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncUpdateMeeting(id, patch),
      );
    }
  },
  deleteMeeting: (id) => {
    set((s) => ({ meetings: s.meetings.filter((x) => x.id !== id) }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncDeleteMeeting(id),
      );
    }
  },
  addActionItem: (meetingId, text, assigneeId, dueDate) => {
    const itemId = crypto.randomUUID();
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id !== meetingId
          ? m
          : {
              ...m,
              actionItems: [
                ...m.actionItems,
                { id: itemId, text, assigneeId, dueDate, done: false },
              ],
              updatedAt: Date.now(),
            },
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncAddActionItem(meetingId, itemId, text, assigneeId, dueDate),
      );
    }
  },
  toggleActionItem: (meetingId, itemId) => {
    let nextDone = false;
    set((s) => ({
      meetings: s.meetings.map((m) => {
        if (m.id !== meetingId) return m;
        return {
          ...m,
          actionItems: m.actionItems.map((a) => {
            if (a.id !== itemId) return a;
            nextDone = !a.done;
            return { ...a, done: nextDone };
          }),
          updatedAt: Date.now(),
        };
      }),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncToggleActionItem(itemId, nextDone),
      );
    }
    // get(): silence lint about unused get; useful for future extensions
    void get;
  },
  removeActionItem: (meetingId, itemId) => {
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id !== meetingId
          ? m
          : {
              ...m,
              actionItems: m.actionItems.filter((a) => a.id !== itemId),
              updatedAt: Date.now(),
            },
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncDeleteActionItem(itemId),
      );
    }
  },
  promoteActionItem: async (meetingId, itemId, keyResultId) => {
    if (typeof window === 'undefined') return false;
    const meeting = get().meetings.find((m) => m.id === meetingId);
    const item = meeting?.actionItems.find((a) => a.id === itemId);
    if (!meeting || !item) {
      // eslint-disable-next-line no-console
      console.warn('[promoteActionItem] meeting/item not found', meetingId, itemId);
      return false;
    }
    if (item.linkedInitiativeId) return item.linkedInitiativeId; // 幂等
    try {
      // 1. 建 Initiative
      const res = await fetch('/api/okr/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyResultId,
          title: item.text,
          ownerId: item.assigneeId !== 'manager' && item.assigneeId !== 'report' ? item.assigneeId : undefined,
          dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : undefined,
          status: 'planned',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // eslint-disable-next-line no-console
        console.warn('[promoteActionItem] initiative create failed', res.status, err);
        return false;
      }
      const { initiative } = await res.json();
      const initiativeId = initiative.id as string;
      // 2. 本地立即标记
      set((s) => ({
        meetings: s.meetings.map((m) =>
          m.id !== meetingId
            ? m
            : {
                ...m,
                actionItems: m.actionItems.map((a) =>
                  a.id === itemId ? { ...a, linkedInitiativeId: initiativeId } : a,
                ),
                updatedAt: Date.now(),
              },
        ),
      }));
      // 3. fire-and-forget PATCH 把 linkedInitiativeId 回填到 ActionItem 表
      void fetch(`/api/1on1/action-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedInitiativeId: initiativeId }),
      });
      return initiativeId;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[promoteActionItem] failed', err);
      return false;
    }
  },
}));
// #endregion
