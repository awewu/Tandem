/**
 * 1on1 Meeting · 主管 ↔ 员工对话模块 (storage 层类型)
 *
 * 注意:
 *  - storage 层时间字段统一 ISO string (Prisma DateTime 序列化)
 *  - zustand 老类型 (`OneOnOneMeeting` 在 `lib/store.ts`) 用 number ms epoch,
 *    A2.3 切 API 时再统一; 此处先与 Prisma model 对齐.
 *  - User.id 直接当 managerId / reportId / assigneeId (D1 决策, 不再用 Person 概念)
 */

export type OneOnOneCadence = 'weekly' | 'biweekly' | 'monthly' | 'adhoc';
export type OneOnOneStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface OneOnOneMeeting {
  id: string;
  tenantId: string;
  managerId: string;
  reportId: string;
  cadence: OneOnOneCadence;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: OneOnOneStatus;
  agendaManager: string | null;
  agendaReport: string | null;
  noteProgress: string | null;
  noteBlockers: string | null;
  noteNextSteps: string | null;
  linkedKrIds: string[];
  /** 1-5, 仅主管可见 (API 层按 requester strip) */
  moodScore: number | null;
  /** 主管私密备注: API 层按 requester strip (员工读不到) */
  privateManagerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OneOnOneActionItem {
  id: string;
  meetingId: string;
  text: string;
  assigneeId: string;
  dueDate: string | null;
  done: boolean;
  /** A3.1 cross-link · 提升为 KR Initiative 后的引用 */
  linkedInitiativeId: string | null;
  createdAt: string;
  updatedAt: string;
}
