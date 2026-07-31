/**
 * lib/taf/skills/assistant-skills.ts · 搭子「个人助理」技能组 (S1 执行肢体扩面 · 2026-07-29)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (DAZI-BEYOND-COWORK §五「装配执行肢体到搭子路径」 + Owner 需求②):
 *   旧状态: 搭子能查 OKR / 记忆 / 决议, 但不能帮员工理顺"工作安排 / 日程 / 会议同步" —
 *           日历服务 (CalendarService) / 会议 IM 提醒 (CalendarImReminderService) 已造好,
 *           但只能从各自 API 路由进, 搭子的 tool-loop 够不到 → 助理场景空缺。
 *
 *   本文件: 把日历/会议能力封成 5 个 skill, 让搭子的 tool-loop 能调:
 *     只读 (green · proxyAllowed):
 *       - assistant.schedule_summary : 今日/明日/本周日程概览 (含冲突标记)
 *       - assistant.find_time        : 按参会人日程找共同空档 (返回 Top 3 建议时间)
 *       - assistant.task_plan        : 聚合日程 + 本人 OKR 真值, 供 LLM 合成工作安排建议
 *     写 (yellow · proxyAllowed · registry 审计):
 *       - assistant.create_event     : 为员工创建日历事件 (调 CalendarService.createManaged)
 *       - assistant.meeting_sync     : 会议 IM 提醒 (调 CalendarImReminderService.remind)
 *
 * 诚实边界:
 *   - 全部 scoped 到 ctx.userId 本人: 读只读本人可见日历 / 本人 OKR; 写只写本人 owner 的事件。
 *   - find_time 读他人日历经 listSubscribedCalendar (强制订阅授权 + 仅忙/闲), 无授权则跳过并注明。
 *   - 时间解析交给调用方 LLM: skill 只收 ISO 8601 datetime, 不在 skill 内嵌套 LLM (避免不确定性)。
 *   - 写动作直执行 (个人生产力动作, 非组织治理), 由 skillRegistry 审计留痕; 不碰 proposeAction。
 *   - fail-soft: 服务异常返回 { ok:false }, 不抛 (registry 也兜底)。
 */

import type { Skill } from './registry';

// ---------------------------------------------------------------------------
// 时间辅助
// ---------------------------------------------------------------------------

type ScheduleRange = 'today' | 'tomorrow' | 'week';

function dayBounds(range: ScheduleRange, now: Date): { from: Date; to: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  if (range === 'week') {
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  // today
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// assistant.schedule_summary · 日程概览 (green)
// ---------------------------------------------------------------------------

export const AssistantScheduleSummarySkill: Skill<{ range?: ScheduleRange }, unknown> = {
  id: 'assistant.schedule_summary',
  description: '查看员工本人今日/明日/本周的日程安排 (含会议冲突标记), 用于"我今天有什么安排/本周有几个会"等',
  tags: ['日程', '安排', '日历', '会议', 'schedule', 'calendar', '今天', '本周'],
  zone: 'green',
  proxyAllowed: true,
  dataScope: { level: 'personal' },
  estimatedTokens: 300,
  schema: {
    type: 'function',
    function: {
      name: 'assistant_schedule_summary',
      description: '查本人日程时间线 (今日/明日/本周)',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'string',
            enum: ['today', 'tomorrow', 'week'],
            description: '时间范围, 默认 today',
          },
        },
      },
    },
  },
  async execute({ range = 'today' }, ctx) {
    const { createCalendarService } = await import('@/lib/calendar/service-factory');
    const svc = createCalendarService();
    const { from, to } = dayBounds(range, new Date());
    const events = await svc.listForUser(ctx.userId, ctx.tenantId, { from, to });
    const active = events.filter((e) => e.status !== 'cancelled');
    const timeline = active.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      start: fmtDateTime(e.startAt),
      end: fmtDateTime(e.endAt),
      location: e.location ?? e.meetingUrl ?? null,
      isOwner: e.ownerId === ctx.userId,
      hasConflict: e.hasConflict,
      attendeeCount: (e.attendees?.length ?? 0),
    }));
    return {
      ok: true,
      data: {
        range,
        count: timeline.length,
        conflicts: timeline.filter((t) => t.hasConflict).length,
        events: timeline,
      },
      tokensUsed: 100 + timeline.length * 20,
    };
  },
};

// ---------------------------------------------------------------------------
// assistant.find_time · 找共同空档 (green)
// ---------------------------------------------------------------------------

interface Interval {
  start: number;
  end: number;
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const SLOT_STEP_MIN = 30;

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/** 在 [rangeStart, rangeEnd] 内, 每天工作时段扫描 >= durationMin 的空档。 */
function findFreeSlots(
  busy: Interval[],
  rangeStart: Date,
  rangeEnd: Date,
  durationMin: number,
  preference: 'morning' | 'afternoon' | 'any',
  limit: number,
): Array<{ startAt: string; endAt: string }> {
  const durationMs = durationMin * 60_000;
  const stepMs = SLOT_STEP_MIN * 60_000;
  const results: Array<{ startAt: string; endAt: string }> = [];
  const day = new Date(rangeStart);
  day.setHours(0, 0, 0, 0);

  while (day.getTime() <= rangeEnd.getTime() && results.length < limit) {
    const workStart = new Date(day);
    workStart.setHours(WORK_START_HOUR, 0, 0, 0);
    const workEnd = new Date(day);
    workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    let cursor = Math.max(workStart.getTime(), rangeStart.getTime());
    const dayEnd = Math.min(workEnd.getTime(), rangeEnd.getTime());

    while (cursor + durationMs <= dayEnd && results.length < limit) {
      const candidate: Interval = { start: cursor, end: cursor + durationMs };
      const hour = new Date(cursor).getHours();
      const prefOk =
        preference === 'any' ||
        (preference === 'morning' && hour < 12) ||
        (preference === 'afternoon' && hour >= 13);
      const clash = busy.some((b) => overlaps(candidate, b));
      if (prefOk && !clash) {
        results.push({
          startAt: new Date(candidate.start).toISOString(),
          endAt: new Date(candidate.end).toISOString(),
        });
        cursor += durationMs; // 命中后跳过整段, 避免相邻重复建议
      } else {
        cursor += stepMs;
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return results;
}

export const AssistantFindTimeSkill: Skill<
  {
    durationMin: number;
    participantIds?: string[];
    rangeStart?: string;
    rangeEnd?: string;
    preference?: 'morning' | 'afternoon' | 'any';
  },
  unknown
> = {
  id: 'assistant.find_time',
  description: '根据本人 (及可选参会人) 日程找共同空档, 返回 Top 3 建议时间, 用于"帮我找和 X 都有空的 1 小时"',
  tags: ['找时间', '空档', '约会议', '排期', 'find time', 'availability', '共同空闲'],
  zone: 'green',
  proxyAllowed: true,
  dataScope: { level: 'personal' },
  estimatedTokens: 400,
  schema: {
    type: 'function',
    function: {
      name: 'assistant_find_time',
      description: '找本人及参会人的共同空档 (工作时段 09:00-18:00), 返回建议时间',
      parameters: {
        type: 'object',
        properties: {
          durationMin: { type: 'number', description: '需要的时长 (分钟)' },
          participantIds: {
            type: 'array',
            items: { type: 'string' },
            description: '其他参会人的用户 ID (需已订阅其日历才可见忙闲; 未授权者自动跳过)',
          },
          rangeStart: { type: 'string', description: '搜索起始 ISO 时间 (缺省=现在)' },
          rangeEnd: { type: 'string', description: '搜索结束 ISO 时间 (缺省=7 天后)' },
          preference: {
            type: 'string',
            enum: ['morning', 'afternoon', 'any'],
            description: '时段偏好, 默认 any',
          },
        },
        required: ['durationMin'],
      },
    },
  },
  async execute({ durationMin, participantIds = [], rangeStart, rangeEnd, preference = 'any' }, ctx) {
    if (!durationMin || durationMin <= 0) {
      return { ok: false, error: 'durationMin 必须为正数', tokensUsed: 30 };
    }
    const now = new Date();
    const start = rangeStart ? new Date(rangeStart) : now;
    const end = rangeEnd ? new Date(rangeEnd) : new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false, error: 'rangeStart/rangeEnd 无效', tokensUsed: 30 };
    }

    const { createCalendarService } = await import('@/lib/calendar/service-factory');
    const svc = createCalendarService();
    const busy: Interval[] = [];
    const unavailable: string[] = [];

    // 本人日程
    const own = await svc.listForUser(ctx.userId, ctx.tenantId, { from: start, to: end });
    for (const e of own) {
      if (e.status === 'cancelled') continue;
      busy.push({ start: new Date(e.startAt).getTime(), end: new Date(e.endAt).getTime() });
    }

    // 参会人日程 (经订阅授权; 无授权跳过并注明)
    for (const pid of participantIds) {
      if (pid === ctx.userId) continue;
      try {
        const sub = await svc.listSubscribedCalendar(ctx.userId, pid, ctx.tenantId, { from: start, to: end });
        for (const e of sub) {
          if (e.status === 'cancelled') continue;
          busy.push({ start: new Date(e.startAt).getTime(), end: new Date(e.endAt).getTime() });
        }
      } catch {
        unavailable.push(pid);
      }
    }

    const slots = findFreeSlots(busy, start, end, durationMin, preference, 3);
    return {
      ok: true,
      data: {
        durationMin,
        suggestions: slots.map((s) => ({
          ...s,
          label: `${fmtDateTime(s.startAt)} - ${fmtDateTime(s.endAt)}`,
        })),
        checkedParticipants: participantIds.filter((p) => !unavailable.includes(p)),
        unavailableParticipants: unavailable,
        note:
          unavailable.length > 0
            ? '部分参会人未授权日历查看, 建议时间仅基于可见忙闲, 敲定前请与其确认。'
            : undefined,
      },
      tokensUsed: 150 + slots.length * 20,
    };
  },
};

// ---------------------------------------------------------------------------
// assistant.task_plan · 工作安排聚合 (green)
// ---------------------------------------------------------------------------

export const AssistantTaskPlanSkill: Skill<{ range?: 'today' | 'week' }, unknown> = {
  id: 'assistant.task_plan',
  description: '聚合本人日程 + 当前 OKR 真值进度, 供合成今日/本周工作安排建议, 用于"帮我安排今天的节奏/理一下本周重点"',
  tags: ['工作安排', '规划', '今天做什么', '节奏', '优先级', 'plan', 'todo', '梳理'],
  zone: 'green',
  proxyAllowed: true,
  dataScope: { level: 'personal' },
  estimatedTokens: 500,
  schema: {
    type: 'function',
    function: {
      name: 'assistant_task_plan',
      description: '拉取本人日程 + OKR 真值, 返回结构化数据供合成工作安排建议',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'string',
            enum: ['today', 'week'],
            description: '规划范围, 默认 today',
          },
        },
      },
    },
  },
  async execute({ range = 'today' }, ctx) {
    const now = new Date();
    const { from, to } = dayBounds(range === 'week' ? 'week' : 'today', now);

    const { createCalendarService } = await import('@/lib/calendar/service-factory');
    const svc = createCalendarService();
    const events = (await svc.listForUser(ctx.userId, ctx.tenantId, { from, to }))
      .filter((e) => e.status !== 'cancelled')
      .map((e) => ({
        title: e.title,
        start: fmtDateTime(e.startAt),
        end: fmtDateTime(e.endAt),
        hasConflict: e.hasConflict,
      }));

    const { getStore } = await import('@/lib/storage/repository');
    const { computeKRProgress, effectiveObjectiveProgress } = await import('@/lib/types/okr-tti');
    const store = getStore();
    const objs = (await store.objectives.list()).filter(
      (o) => o.ownerId === ctx.userId && o.status === 'active',
    );
    const allKrs = await store.keyResults.list();
    const okr = objs.map((o) => {
      const krs = allKrs.filter((kr) => kr.objectiveId === o.id && kr.status === 'active');
      return {
        objective: o.title,
        progressPct: Math.round(effectiveObjectiveProgress(o) * 100),
        confidence: o.confidence,
        keyResults: krs.map((kr) => ({
          title: kr.title,
          progressPct: Math.round(computeKRProgress(kr) * 100),
          confidence: kr.confidence,
          atRisk: kr.confidence !== 'on-track',
        })),
      };
    });

    return {
      ok: true,
      data: {
        range,
        schedule: { count: events.length, events },
        okr: {
          objectiveCount: okr.length,
          atRiskKrCount: okr.reduce((n, o) => n + o.keyResults.filter((k) => k.atRisk).length, 0),
          objectives: okr,
        },
      },
      tokensUsed: 200 + events.length * 15 + okr.length * 30,
    };
  },
};

// ---------------------------------------------------------------------------
// assistant.create_event · 创建日历事件 (yellow · 直执行 · registry 审计)
// ---------------------------------------------------------------------------

export const AssistantCreateEventSkill: Skill<
  {
    title: string;
    startAt: string;
    endAt: string;
    attendeeEmails?: string[];
    reminderMinutes?: number;
    location?: string;
    meetingUrl?: string;
    description?: string;
  },
  unknown
> = {
  id: 'assistant.create_event',
  description: '为员工在本人日历创建事件 (会议/日程). 时间须传 ISO 8601, 由你根据自然语言换算好. 用于"帮我约周二下午 3 点开会"',
  tags: ['创建日程', '约会议', '安排', '加日程', 'create event', 'schedule'],
  zone: 'yellow',
  proxyAllowed: true,
  dataScope: { level: 'personal' },
  estimatedTokens: 300,
  schema: {
    type: 'function',
    function: {
      name: 'assistant_create_event',
      description: '创建本人日历事件. startAt/endAt 必须是 ISO 8601 (含时区或本地时间); 不要传自然语言, 你需先自行换算。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '事件标题' },
          startAt: { type: 'string', description: '开始时间 ISO 8601, 如 2026-07-30T15:00:00' },
          endAt: { type: 'string', description: '结束时间 ISO 8601 (须晚于 startAt)' },
          attendeeEmails: {
            type: 'array',
            items: { type: 'string' },
            description: '参会人邮箱 (可选, 系统内成员会收到日程通知)',
          },
          reminderMinutes: { type: 'number', description: '提前提醒分钟 (可选, 如 15)' },
          location: { type: 'string', description: '地点 (可选)' },
          meetingUrl: { type: 'string', description: '线上会议链接 (可选)' },
          description: { type: 'string', description: '备注 (可选)' },
        },
        required: ['title', 'startAt', 'endAt'],
      },
    },
  },
  async execute({ title, startAt, endAt, attendeeEmails, reminderMinutes, location, meetingUrl, description }, ctx) {
    if (!title?.trim()) return { ok: false, error: '标题必填', tokensUsed: 30 };
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, error: 'startAt/endAt 须为有效 ISO 8601 时间', tokensUsed: 30 };
    }
    if (end <= start) return { ok: false, error: 'endAt 必须晚于 startAt', tokensUsed: 30 };

    const { getStore } = await import('@/lib/storage/repository');
    const owner = await getStore().auth.users.findById(ctx.userId);
    if (!owner) return { ok: false, error: '未找到本人用户信息', tokensUsed: 30 };

    try {
      const { createCalendarService } = await import('@/lib/calendar/service-factory');
      const svc = createCalendarService(ctx.userId);
      const events = await svc.createManaged({
        title: title.trim(),
        description,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        ownerId: ctx.userId,
        ownerEmail: owner.email,
        ownerName: owner.name ?? owner.email,
        attendeeEmails: attendeeEmails ?? [],
        reminderMinutes: reminderMinutes ?? null,
        location,
        meetingUrl,
        tenantId: ctx.tenantId,
      });
      const created = events[0];
      return {
        ok: true,
        data: {
          eventId: created?.id,
          title: created?.title,
          startAt: created?.startAt,
          endAt: created?.endAt,
          label: created ? `${fmtDateTime(created.startAt)} - ${fmtDateTime(created.endAt)}` : undefined,
          warnings: svc.getDeliveryWarnings(),
        },
        tokensUsed: 150,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message ?? '创建日程失败', tokensUsed: 50 };
    }
  },
};

// ---------------------------------------------------------------------------
// assistant.meeting_sync · 会议 IM 提醒 (yellow · 直执行 · registry 审计)
// ---------------------------------------------------------------------------

export const AssistantMeetingSyncSkill: Skill<{ eventId: string }, unknown> = {
  id: 'assistant.meeting_sync',
  description: '为已有会议向参会人发送 IM 群提醒 (自动建/复用会议群). 用于"提醒一下明天会议的参会人"',
  tags: ['会议提醒', '通知参会人', '会议同步', 'meeting reminder', 'im'],
  zone: 'yellow',
  proxyAllowed: true,
  dataScope: { level: 'personal' },
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'assistant_meeting_sync',
      description: '向某会议事件的参会人发送 IM 群提醒 (先用 assistant_schedule_summary 拿到 eventId)',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: '目标会议事件 ID' },
        },
        required: ['eventId'],
      },
    },
  },
  async execute({ eventId }, ctx) {
    if (!eventId?.trim()) return { ok: false, error: 'eventId 必填', tokensUsed: 30 };
    try {
      const { createAppContext } = await import('@/lib/repositories/app-context-factory');
      const { CalendarImReminderService } = await import('@/lib/services/calendar-im-reminder-service');
      const svc = new CalendarImReminderService(createAppContext());
      const result = await svc.remind(eventId.trim(), ctx.userId, ctx.tenantId);
      return {
        ok: true,
        data: {
          eventTitle: result.event.title,
          channelId: result.channel.id,
          channelName: result.channel.name,
          reused: result.reused,
          memberCount: result.channel.memberIds.length,
        },
        tokensUsed: 120,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message ?? '会议提醒失败', tokensUsed: 50 };
    }
  },
};

// ---------------------------------------------------------------------------
// 白名单导出
// ---------------------------------------------------------------------------

/** 助理只读技能 (供感知/规划 tool-loop)。 */
export const ASSISTANT_READ_SKILL_IDS = [
  AssistantScheduleSummarySkill.id,
  AssistantFindTimeSkill.id,
  AssistantTaskPlanSkill.id,
] as const;

/** 助理写技能 (创建日程 / 会议提醒, 直执行 + registry 审计)。 */
export const ASSISTANT_WRITE_SKILL_IDS = [
  AssistantCreateEventSkill.id,
  AssistantMeetingSyncSkill.id,
] as const;

/** 全部助理技能白名单 (供 personaAssistantPass 的 tool-loop 使用)。 */
export const ASSISTANT_SKILL_IDS = [
  ...ASSISTANT_READ_SKILL_IDS,
  ...ASSISTANT_WRITE_SKILL_IDS,
] as const;
