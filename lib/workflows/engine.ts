/**
 * Workflow Engine · "事半"板块的拉通基座
 *
 * 解决问题: OKR 进度更新 / KR 滞后 / 1on1 触发 / Calendar 议程 / IM 提醒 各自孤立,
 *           需要事件驱动的 orchestrator 把它们串起来.
 *
 * 设计:
 *   - 业务侧通过 emit(event, payload) 发事件
 *   - 这里维护 (eventType → trigger[]) 的注册表
 *   - 每个 trigger 是 (event) → action 的纯函数, 失败不影响主链
 *   - 同步触发 (V1 进程内) / 后续可换 Redis Streams 做跨进程
 *
 * 例:
 *   emit('okr.checkin.created', { krId, confidence: 'off-track' })
 *   → 触发: 1on1 议程添加 + Calendar 创建 1on1 提醒 + IM 通知主管
 */

import { logger } from '@/lib/infra/logger';

// ---------------------------------------------------------------------------
// Event types (业务侧 + 工作流侧约定)
// ---------------------------------------------------------------------------

export type WorkflowEvent =
  | { type: 'okr.objective.created'; payload: { objectiveId: string; ownerId: string } }
  | { type: 'okr.kr.created'; payload: { krId: string; ownerId: string; objectiveId: string } }
  | { type: 'okr.checkin.created'; payload: { krId: string; ownerId: string; confidence: 'on-track' | 'at-risk' | 'off-track'; comment?: string } }
  | { type: 'okr.kr.off_track'; payload: { krId: string; ownerId: string; managerId?: string } }
  | { type: 'okr.cycle.opened'; payload: { cycleId: string; quarter: string } }
  | { type: 'okr.cycle.closed'; payload: { cycleId: string; quarter: string } }
  | { type: 'okr.weekly_digest.due'; payload: { ownerId: string; weekISO: string } }
  | { type: 'okr.alignment.deviation'; payload: { objectiveId: string; parentObjectiveId: string; deviation: number } }
  | { type: 'one_on_one.scheduled'; payload: { meetingId: string; managerId: string; reportId: string; scheduledAt: string } }
  | { type: 'one_on_one.completed'; payload: { meetingId: string; managerId: string; reportId: string; outcomes: string[] } }
  | { type: 'one_on_one.missed'; payload: { meetingId: string; managerId: string; reportId: string } }
  | { type: 'calendar.event.created'; payload: { eventId: string; ownerId: string; attendees: string[] } }
  | { type: 'calendar.conflict.detected'; payload: { ownerId: string; eventIds: string[] } }
  | { type: 'memory.entry.promoted'; payload: { memoryId: string; level: 'team' | 'department' | 'company' } }
  | { type: 'memory.entry.referenced'; payload: { memoryId: string; byUserId: string; context: string } }
  | { type: 'review360.cycle.opened'; payload: { cycleId: string; targetUserId: string } }
  | { type: 'review360.cycle.closed'; payload: { cycleId: string; targetUserId: string; rating: number } }
  | { type: 'im.channel.created'; payload: { channelId: string; type: string; createdBy: string } }
  | { type: 'im.persona.blocked'; payload: { channelId: string; userId: string; reason: string } }
  | { type: 'skill.invoked'; payload: { skillId: string; userId: string; ok: boolean; durationMs: number } }
  | { type: 'auth.login.failed'; payload: { email: string; ip: string; attempts: number } }
  | { type: 'workflow.custom'; payload: Record<string, unknown> };

export type WorkflowEventType = WorkflowEvent['type'];

export interface WorkflowTrigger<T extends WorkflowEventType = WorkflowEventType> {
  /** 唯一 ID, 用于追踪 + 禁用 */
  id: string;
  /** 监听的事件类型 (单个 / 多个) */
  on: T | T[];
  /** 描述 (开发者可读) */
  description: string;
  /** 执行函数, 失败应自捕异常 */
  handler: (event: Extract<WorkflowEvent, { type: T }>) => Promise<void>;
  /** 启用/禁用, 用于灰度 */
  enabled: boolean;
}

class WorkflowEngine {
  private triggers: WorkflowTrigger[] = [];

  register<T extends WorkflowEventType>(trigger: WorkflowTrigger<T>): void {
    this.triggers.push(trigger as unknown as WorkflowTrigger);
    logger.info({ triggerId: trigger.id, on: trigger.on }, '[workflow] trigger registered');
  }

  list(): WorkflowTrigger[] {
    return [...this.triggers];
  }

  async emit(event: WorkflowEvent): Promise<void> {
    const matched = this.triggers.filter((t) => {
      if (!t.enabled) return false;
      const types = Array.isArray(t.on) ? t.on : [t.on];
      return types.includes(event.type);
    });
    if (matched.length === 0) return;
    logger.debug({ event: event.type, triggerCount: matched.length }, '[workflow] emit');
    // 并行执行所有触发器, 互不阻塞
    await Promise.all(
      matched.map(async (t) => {
        try {
          await t.handler(event as never);
        } catch (err) {
          logger.warn({ triggerId: t.id, event: event.type, err: (err as Error).message }, '[workflow] trigger failed');
        }
      }),
    );
  }
}

// 单例 (HMR-safe)
type GW = typeof globalThis & { __tandem_workflow__?: WorkflowEngine };
const _g = globalThis as GW;
export const workflowEngine: WorkflowEngine = _g.__tandem_workflow__ ?? new WorkflowEngine();
if (!_g.__tandem_workflow__) _g.__tandem_workflow__ = workflowEngine;

export function emit(event: WorkflowEvent): Promise<void> {
  return workflowEngine.emit(event);
}
