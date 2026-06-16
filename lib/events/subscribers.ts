/**
 * lib/events/subscribers.ts
 *
 * 跨域事件订阅者注册中心 (架构锚点).
 *
 * ─────────────────────────────────────────────────────────
 * 纪律 (Owner 2026-05-30 立, 2026-05-31 验证):
 *   - 任何跨域副作用 (service A 影响 service B 的状态/UI/通知) 必须订阅本文件,
 *     不允许 service A 直接 import service B 然后 await
 *   - 单域内同步逻辑可保持直接调用 (event 只走域边界)
 *
 * 当前订阅者:
 *   - logger 镜像 (V1) — 5 个高频事件全部 logger.info, 让运维一眼看到跨域链路
 *   - 后续可加: notification 推送 / KPI 计数 / CompanyBrain 学习 / OKR drift 触发
 *
 * 测试: tests/unit/event-subscribers.test.ts (调用 registerCrossDomainSubscribers
 *       后, emit 任一事件 → logger 被调用一次)
 *
 * 调用方: lib/boot.ts (bootSync 末尾, 仅在进程启动时注册一次)
 */

import { eventBus } from './bus';
import { logger } from '@/lib/infra/logger';
import { track } from '@/lib/analytics/track';

let registered = false;

/**
 * 把 domain event 镜像到 UsageEvent 表, 让 /admin/usage 看板能看到跨域副作用流量.
 * fire-and-forget, 失败仅 warn (复用 track() 的 fire-and-forget 语义).
 */
function mirrorToUsage(eventName: string, userId: string | null, props: Record<string, unknown>): void {
  void track({ eventName, userId, props }).catch(() => {
    /* track 自己 try/catch, 这里冗余防御 */
  });
}

/**
 * 注册所有跨域订阅者. 幂等 (重复调用不会重复订阅).
 *
 * 在 bootSync 末尾调用. 测试场景如需重新注册, 调 __resetSubscribers().
 */
export function registerCrossDomainSubscribers(): void {
  if (registered) return;
  registered = true;

  // ── Convergence ──────────────────────────────────────────────
  eventBus.on('convergence.committed', (p) => {
    logger.info(
      {
        cardId: p.cardId,
        primaryKrId: p.primaryKrId,
        decidedBy: p.decidedBy,
        anchorType: p.okrAnchor.type,
        domain: 'convergence→x-domain',
      },
      '[event] convergence.committed',
    );
    mirrorToUsage('event.convergence.committed', p.decidedBy, {
      cardId: p.cardId,
      primaryKrId: p.primaryKrId,
      anchorType: p.okrAnchor.type,
    });
  });

  eventBus.on('convergence.escalated', (p) => {
    logger.warn(
      {
        cardId: p.cardId,
        reason: p.reason,
        elapsedSeconds: p.elapsedSeconds,
        domain: 'convergence→x-domain',
      },
      '[event] convergence.escalated',
    );
    mirrorToUsage('event.convergence.escalated', null, {
      cardId: p.cardId,
      reason: p.reason,
      elapsedSeconds: p.elapsedSeconds,
    });
  });

  // ── Memory ───────────────────────────────────────────────────
  eventBus.on('memory.upgraded', (p) => {
    logger.info(
      {
        memoryId: p.memoryId,
        promotionId: p.promotionId,
        toLevel: p.toLevel,
        approvedBy: p.approvedBy,
        domain: 'memory→x-domain',
      },
      '[event] memory.upgraded',
    );
    mirrorToUsage('event.memory.upgraded', p.approvedBy, {
      memoryId: p.memoryId,
      promotionId: p.promotionId,
      toLevel: p.toLevel,
    });
  });

  eventBus.on('memory.promotion-sla-overdue', (p) => {
    logger.warn(
      {
        promotionId: p.promotionId,
        fromLevel: p.fromLevel,
        toLevel: p.toLevel,
        notifiedGovernance: p.notifiedGovernance,
        domain: 'memory→governance',
      },
      '[event] memory.promotion-sla-overdue',
    );
  });

  eventBus.on('memory.downgrade-proposed', (p) => {
    logger.info(
      {
        memoryId: p.memoryId,
        referenceRate: p.referenceRate,
        domain: 'memory→steward',
      },
      '[event] memory.downgrade-proposed',
    );
  });

  // ── Persona ──────────────────────────────────────────────────
  eventBus.on('persona.stage-upgraded', (p) => {
    logger.info(
      {
        userId: p.userId,
        personaId: p.personaId,
        fromStage: p.fromStage,
        toStage: p.toStage,
        auto: p.auto,
        domain: 'persona→notification',
      },
      '[event] persona.stage-upgraded',
    );
    mirrorToUsage('event.persona.stage-upgraded', p.userId, {
      personaId: p.personaId,
      fromStage: p.fromStage,
      toStage: p.toStage,
      auto: p.auto,
    });
  });

  // ── OKR ──────────────────────────────────────────────────────
  eventBus.on('okr.kr-progressed', (p) => {
    logger.info(
      {
        krId: p.krId,
        from: p.from,
        to: p.to,
        by: p.by,
        source: p.source,
        domain: 'okr→drift-detector',
      },
      '[event] okr.kr-progressed',
    );
    mirrorToUsage('event.okr.kr-progressed', p.by, {
      krId: p.krId,
      delta: p.to - p.from,
      source: p.source,
    });

    // OKR & IM Synergy: If check-in happens outside of IM (e.g., in OKR dashboard),
    // automatically notify the member's department channel.
    if (p.source !== 'check-in') {
      void (async () => {
        try {
          const { getStore } = await import('@/lib/boot');
          const { sendMessage } = await import('@/lib/im/service');
          const store = getStore();
          
          const kr = await store.keyResults.get(p.krId);
          if (!kr) return;
          
          const user = await store.auth.users.findById(p.by);
          if (!user || !user.departmentId) return;
          
          // Find any department or team channels for this department
          const channels = await store.imChannels.list();
          const targetCh = channels.find(
            (c) =>
              (c.type === 'department' || c.type === 'team') &&
              c.departmentId === user.departmentId
          );
          
          if (targetCh) {
            await sendMessage({
              channelId: targetCh.id,
              senderId: 'system',
              senderKind: 'system',
              body: `📢 **部门 OKR 动态**：成员 **${user.name}** 更新了指标 **「${kr.title}」** 的进度：${p.from} ➔ ${p.to} ${kr.unit || ''}`,
            });
          }
        } catch (err) {
          logger.warn({ error: (err as Error).message }, '[subscribers] okr.kr-progressed cross-domain message failed');
        }
      })();
    }
  });

  eventBus.on('okr.drift-detected', (p) => {
    logger.warn(
      {
        actorId: p.actorId,
        targetId: p.targetId,
        targetType: p.targetType,
        source: p.source,
        alignmentScore: p.alignmentScore,
        domain: 'okr→companybrain',
      },
      '[event] okr.drift-detected',
    );

    // OKR & IM Synergy: Send private IM warning to user's direct DM when drift is detected
    void (async () => {
      try {
        const { getStore } = await import('@/lib/boot');
        const { sendMessage, getOrCreateDm } = await import('@/lib/im/service');
        const store = getStore();

        const actor = await store.auth.users.findById(p.actorId);
        if (!actor) return;

        // If alignment score is bad, send warning DM to the actor (or manager if available)
        if (p.alignmentScore < 0.5) {
          // Send to actor's DM as a system message warning
          const dm = await getOrCreateDm('system', p.actorId);
          await sendMessage({
            channelId: dm.id,
            senderId: 'system',
            senderKind: 'system',
            body: `⚠️ **Tandem AI 偏离警告**：你在进行「${p.source}」时偏离了当前 OKR 基准（对齐得分：${p.alignmentScore}，低于阈值 0.5）。请注意聚焦核心目标。`,
          });
        }
      } catch (err) {
        logger.warn({ error: (err as Error).message }, '[subscribers] okr.drift-detected DM notification failed');
      }
    })();
  });

  // B-025: OKR 周期切换 → Persona enabledSkills 重对齐
  eventBus.on('okr.cycle-activated', (p) => {
    logger.info(
      { cycleId: p.cycleId, tenantId: p.tenantId, activatedBy: p.activatedBy },
      '[event] okr.cycle-activated',
    );
    mirrorToUsage('event.okr.cycle-activated', p.activatedBy, {
      cycleId: p.cycleId,
      previousCycleId: p.previousCycleId,
    });
    void (async () => {
      try {
        const { realignPersonaToOkr } = await import('@/lib/persona/strategy-engine');
        const result = await realignPersonaToOkr(p.tenantId);
        logger.info(result, '[B-025] persona realign complete after cycle activation');
      } catch (err) {
        logger.warn({ error: (err as Error).message }, '[subscribers] realignPersonaToOkr failed');
      }
    })();
  });

  // B2 真 rollup: Objective 进度被向上重算 (替代旧"只打日志不传播"假闭环).
  eventBus.on('okr.objective-rolled-up', (p) => {
    logger.info(
      {
        objectiveId: p.objectiveId,
        from: p.from,
        to: p.to,
        delta: p.to - p.from,
        depth: p.depth,
        triggeredByKrId: p.triggeredByKrId,
        domain: 'okr→rollup',
      },
      '[event] okr.objective-rolled-up',
    );
    mirrorToUsage('event.okr.objective-rolled-up', null, {
      objectiveId: p.objectiveId,
      delta: p.to - p.from,
      depth: p.depth,
    });
    // B-015 Palantir #2: OKR 真值变更 → 立即清 Drift 基线 cache (事件驱动, 替代纯 TTL)
    void import('@/lib/governance/okr-drift').then(({ invalidateOkrDriftCache }) => {
      invalidateOkrDriftCache();
    }).catch(() => { /* fail-soft */ });
  });

  eventBus.on('audit.event-emitted', (p) => {
    logger.debug(
      { eventName: p.eventName, eventId: p.eventId },
      '[event] audit.event-emitted',
    );
  });

  logger.info(
    { count: 10 },
    '[events] cross-domain subscribers registered',
  );
}

/**
 * 测试专用: 重置注册标志 (允许下次 register 重新订阅).
 * 注意: 这不会清除已订阅的 handlers, 需配合 eventBus.__clearHandlers() 用.
 */
export function __resetSubscribers(): void {
  registered = false;
}

/**
 * 调试用: 当前是否已注册.
 */
export function __isRegistered(): boolean {
  return registered;
}
