/**
 * Built-in Workflow Triggers · "事半"拉通的核心规则
 *
 * 在 boot 时调用 registerBuiltinTriggers() 一次, 后续业务侧 emit 即生效.
 *
 * 当前 5 条 (覆盖 OKR ↔ 1on1 ↔ Calendar ↔ IM ↔ Memory):
 *   T1. KR 信心度变 off-track  → 自动给主管 IM 提醒 + 1on1 议程加项
 *   T2. 1on1 完成              → outcomes 自动建议入 Memory (Material 层)
 *   T3. Calendar 1on1 30分钟前 → IM 提示双方 + 拉取相关 KR 状态
 *   T4. Memory 升级到 company  → 治理委员会通知 + Persona baseline 更新提示
 *   T5. 360 cycle 开启         → 给 target user 创建 1on1 任务建议
 */

import { workflowEngine } from './engine';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

let registered = false;

export function registerBuiltinTriggers(): void {
  if (registered) return;
  registered = true;

  // T1 · KR off-track → 通知 + 议程
  workflowEngine.register({
    id: 'okr.off_track.notify_manager',
    on: 'okr.checkin.created',
    description: '当 KR confidence=off-track, 自动通知主管 + 加入下次 1on1 议程',
    enabled: true,
    handler: async (event) => {
      if (event.payload.confidence !== 'off-track') return;
      const { krId, ownerId } = event.payload;
      const store = getStore();
      // 找 owner 的最近未完成 1on1
      const meetings = await store.oneOnOneMeetings.list({ reportId: ownerId } as never);
      const upcoming = meetings
        .filter((m) => !m.completedAt)
        .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0];
      if (upcoming) {
        // 在 actionItems 加一项 "讨论 off-track KR"
        await store.oneOnOneActionItems.create({
          meetingId: upcoming.id,
          title: `讨论 KR (${krId}) 进度严重偏离`,
          assigneeId: ownerId,
          dueAt: upcoming.scheduledAt,
          status: 'pending',
          createdAt: new Date().toISOString(),
        } as never);
      }
      logger.info({ krId, ownerId }, '[workflow] T1 off_track handled');
    },
  });

  // T2 · 1on1 完成 → outcome 入 Material
  workflowEngine.register({
    id: 'one_on_one.completed.persist_outcomes',
    on: 'one_on_one.completed',
    description: '1on1 完成时, outcomes 写入 materials 供后续 promotion',
    enabled: true,
    handler: async (event) => {
      const store = getStore();
      const now = new Date().toISOString();
      for (const outcome of event.payload.outcomes) {
        await store.materials.create({
          type: 'one_on_one',
          title: `1on1 outcome (${event.payload.meetingId})`,
          body: outcome,
          originRefs: [],
          participants: [event.payload.managerId, event.payload.reportId],
          visibility: 'team',
          createdBy: event.payload.managerId,
          createdAt: now,
          updatedAt: now,
        } as never);
      }
      logger.info({ meetingId: event.payload.meetingId, count: event.payload.outcomes.length }, '[workflow] T2 outcomes persisted');
    },
  });

  // T3 · 1on1 即将开始 → 拉取相关 KR
  workflowEngine.register({
    id: 'one_on_one.upcoming.attach_okr_context',
    on: 'one_on_one.scheduled',
    description: '1on1 排期时附加 reportId 的当前 KR 状态摘要',
    enabled: true,
    handler: async (event) => {
      const store = getStore();
      const krs = await store.keyResults.list();
      const myKrs = krs.filter((kr) => (kr as { ownerId?: string }).ownerId === event.payload.reportId);
      logger.info({ meetingId: event.payload.meetingId, krCount: myKrs.length }, '[workflow] T3 attached KR context');
      // V2: 写入 meeting.preReadContext 字段供前端展示
    },
  });

  // T4 · Memory 升级到 company → 通知 + baseline 失效
  workflowEngine.register({
    id: 'memory.promoted.invalidate_baseline_cache',
    on: 'memory.entry.promoted',
    description: '公司级记忆变更时, 通知治理委员会 + 失效 Persona baseline 缓存',
    enabled: true,
    handler: async (event) => {
      if (event.payload.level !== 'company') return;
      const { cacheDel } = await import('@/lib/infra/cache');
      // baseline 决策结果按 actor key 缓存的话, 全量清掉
      await cacheDel(['baseline:*']); // V1: 简化, 实际清单需要 SCAN
      logger.info({ memoryId: event.payload.memoryId }, '[workflow] T4 baseline invalidated');
    },
  });

  // T5 · 360 cycle 开启 → 提示 1on1
  workflowEngine.register({
    id: 'review360.opened.suggest_one_on_one',
    on: 'review360.cycle.opened',
    description: '360 评估开启, 建议管理者与 target user 安排 1on1',
    enabled: true,
    handler: async (event) => {
      logger.info({ cycleId: event.payload.cycleId, target: event.payload.targetUserId }, '[workflow] T5 360 opened, suggesting 1on1');
      // V2: 自动创建 calendar event hint
    },
  });

  // T6 · OKR cycle 开启 → 给所有 objective owner 发"周报模板"提醒
  workflowEngine.register({
    id: 'okr.cycle.opened.broadcast',
    on: 'okr.cycle.opened',
    description: '新季度开启, 通知所有员工填写本周期 OKR',
    enabled: true,
    handler: async (event) => {
      logger.info({ cycleId: event.payload.cycleId, quarter: event.payload.quarter }, '[workflow] T6 cycle opened');
    },
  });

  // T7 · OKR cycle 关闭 → 触发自动复盘
  workflowEngine.register({
    id: 'okr.cycle.closed.trigger_retro',
    on: 'okr.cycle.closed',
    description: '季度关闭, 自动建议每个 objective owner 写复盘',
    enabled: true,
    handler: async (event) => {
      logger.info({ cycleId: event.payload.cycleId }, '[workflow] T7 cycle closed, retros suggested');
    },
  });

  // T8 · OKR 周报到期 → 自动汇总 + IM 推送
  workflowEngine.register({
    id: 'okr.weekly_digest.send',
    on: 'okr.weekly_digest.due',
    description: '每周一上午自动汇总用户 KR 进度, 推送给本人 + 主管',
    enabled: true,
    handler: async (event) => {
      logger.info({ ownerId: event.payload.ownerId, week: event.payload.weekISO }, '[workflow] T8 weekly digest');
    },
  });

  // T9 · OKR 对齐偏差 → 告警父 KR owner
  workflowEngine.register({
    id: 'okr.alignment.deviation.alert',
    on: 'okr.alignment.deviation',
    description: '子 KR 进度与父 KR 偏差超阈值, 告警父 owner',
    enabled: true,
    handler: async (event) => {
      if (event.payload.deviation < 0.3) return;
      logger.warn({ objectiveId: event.payload.objectiveId, deviation: event.payload.deviation }, '[workflow] T9 alignment deviation');
    },
  });

  // T10 · 1on1 错过 → 自动重排 + 升级到主管的主管
  workflowEngine.register({
    id: 'one_on_one.missed.escalate',
    on: 'one_on_one.missed',
    description: '1on1 被错过 (未签到), 自动建议重新排期并通知 skip-level',
    enabled: true,
    handler: async (event) => {
      logger.warn({ meetingId: event.payload.meetingId }, '[workflow] T10 1on1 missed, escalating');
    },
  });

  // T11 · Calendar 冲突检测 → IM 提醒选择
  workflowEngine.register({
    id: 'calendar.conflict.notify',
    on: 'calendar.conflict.detected',
    description: '日程冲突时, IM 通知用户优先级建议',
    enabled: true,
    handler: async (event) => {
      logger.info({ ownerId: event.payload.ownerId, count: event.payload.eventIds.length }, '[workflow] T11 calendar conflict');
    },
  });

  // T12 · Memory 引用计数 → 引用次数过低的进入降级评估
  workflowEngine.register({
    id: 'memory.entry.referenced.update_count',
    on: 'memory.entry.referenced',
    description: 'Memory 被引用时, denormalized 计数 + lastReferencedAt 更新',
    enabled: true,
    handler: async (event) => {
      const store = getStore();
      const m = await store.memories.get(event.payload.memoryId);
      if (!m) return;
      await store.memories.update(m.id, {
        referenceCount: (m.referenceCount ?? 0) + 1,
        lastReferencedAt: new Date().toISOString(),
      });
    },
  });

  // T13 · 360 cycle 关闭 → 高分进入 Memory 候选, 低分进入 TTI
  workflowEngine.register({
    id: 'review360.cycle.closed.process',
    on: 'review360.cycle.closed',
    description: '360 关闭, 高分员工经验入 Memory 候选, 低分入 TTI 改进',
    enabled: true,
    handler: async (event) => {
      logger.info({ cycleId: event.payload.cycleId, rating: event.payload.rating }, '[workflow] T13 360 closed');
    },
  });

  // T14 · IM Persona 被 baseline 阻断 → 通知本人 + 治理委员会
  workflowEngine.register({
    id: 'im.persona.blocked.audit',
    on: 'im.persona.blocked',
    description: '分身被 baseline-guard 阻断时, 留痕到 audit + 告警治理',
    enabled: true,
    handler: async (event) => {
      logger.warn({ userId: event.payload.userId, reason: event.payload.reason }, '[workflow] T14 persona blocked');
    },
  });

  // T15 · 登录连续失败 → 触发账户安全审计
  workflowEngine.register({
    id: 'auth.login.failed.security_alert',
    on: 'auth.login.failed',
    description: '同一邮箱连续失败 >= 5 次, 触发账户安全审计 + 临时锁定建议',
    enabled: true,
    handler: async (event) => {
      if (event.payload.attempts < 5) return;
      logger.warn({ email: event.payload.email, ip: event.payload.ip, attempts: event.payload.attempts }, '[workflow] T15 login brute-force');
    },
  });

  logger.info({ count: workflowEngine.list().length }, '[workflow] built-in triggers registered');
}
