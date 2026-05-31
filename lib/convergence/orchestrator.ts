/**
 * Convergence Orchestrator · 议事室应用服务
 *
 * 职责:
 *   - 包装 state-machine (纯 FSM) + I/O 副作用
 *   - 创建 / 加载 / 保存 议事室会话
 *   - 触发 DecisionEngine 生成 3+1 选项
 *   - 调用 audit log
 *   - 持久化 DecisionCard
 */

import {
  type ConvergenceEvent,
  type ConvergenceRoomState,
  type StepResult,
  createInitialState,
  detectStall,
  stepToConvergenceState,
  transition,
} from './state-machine';
import { DecisionEngine, type DecisionContext } from './decision-engine';
import { StoreBackedMemoryRetriever } from '../memory/retriever';
import { TandemRouter } from '../taf/router';
import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import { eventBus } from '../events/bus';
import type { DecisionCard } from '../types/decision-card';

// ---------------------------------------------------------------------------
// 内存中的 active rooms (V1 简化, V2 移到 Redis / KV)
// ---------------------------------------------------------------------------

const activeRooms = new Map<string, ConvergenceRoomState>();

export interface StartConvergenceInput {
  title: string;
  description: string;
  ownerId: string;
  /** 多租户隔离: 必传, 默认 'default' */
  tenantId?: string;
  /** Q2 KR 软绑定: 主 KR (默认路径) */
  primaryKrId?: string;
  /** Q2 escape hatch: 未选 KR 时必填理由 (≥ 10 字符) */
  noKrReason?: string;
  relatedKr?: string[];
  relatedTti?: string[];
  materialRefs?: string[];
}

export class ConvergenceOrchestrator {
  constructor(
    private readonly router: TandemRouter,
    private readonly retriever = new StoreBackedMemoryRetriever()
  ) {}

  // ---------------------------------------------------------------------------
  // 启动议事室
  // ---------------------------------------------------------------------------

  async start(input: StartConvergenceInput): Promise<{ cardId: string; state: ConvergenceRoomState }> {
    const store = getStore();
    const now = Date.now();
    const cardId = generateId('dc');

    // 1. 创建 DecisionCard (DIVERGE 状态)
    //    Q2: primaryKrId / noKrReason 不变量 由 API 层 validateOkrAnchor() 守门.
    //    到这里 可信任 那对双胞胎 恰一个非空.
    const card: DecisionCard = {
      id: cardId,
      schemaVersion: 'tandem.v1',
      title: input.title,
      decisionClass: 'simple',
      convergenceState: 'DIVERGE',
      elapsedSeconds: 0,
      primaryKrId: input.primaryKrId,
      noKrReason: input.noKrReason,
      relatedKr: input.relatedKr,
      relatedTti: input.relatedTti,
      materialRefs: input.materialRefs,
      options: [],
      actionItems: [],
      createdBy: input.ownerId,
      createdAt: new Date(now).toISOString(),
      tenantId: input.tenantId ?? 'default',
      watermark: { isProxy: false },
    };
    await store.decisionCards.create(card);

    // 2. 创建议事室状态
    let state = createInitialState(cardId, now);
    activeRooms.set(cardId, state);

    // 3. 触发 START 事件
    const r1 = transition(state, { type: 'START', cardId, userId: input.ownerId, at: now });
    state = r1.state;

    // 4. ALIGN → FRAME (锡定 KR + 拉取材料)
    const r2 = transition(state, {
      type: 'ALIGN_DONE',
      materialRefs: input.materialRefs ?? [],
      relatedKr: input.relatedKr,
      relatedTti: input.relatedTti,
      at: Date.now(),
    });
    state = r2.state;

    // 5. FRAME → DIVERGE (问题陈述 + 决策类型识别)
    // V1 简化: 设为 'simple' 默认. V2 由 LLM/主持人设定.
    const r2b = transition(state, {
      type: 'FRAMED',
      problemStatement: input.description || input.title,
      decisionClass: 'simple',
      at: Date.now(),
    });
    state = r2b.state;

    // 6. 生成 3+1 选项 (DIVERGE 阶段内)
    const engine = new DecisionEngine(this.router, this.retriever);
    const ctx: DecisionContext = {
      cardId,
      title: input.title,
      description: input.description,
      relatedKrTitles: [], // TODO: hydrate from store
      materialDigests: [],
      actorUserId: input.ownerId, // §T15 baseline-guard 校验所需
    };
    const gen = await engine.generateOptions(ctx);

    const r3 = transition(state, {
      type: 'OPTIONS_GENERATED',
      options: gen.options,
      at: Date.now(),
    });
    state = r3.state;

    // 6. 落库 + 审计
    activeRooms.set(cardId, state);
    await store.decisionCards.update(cardId, {
      convergenceState: stepToConvergenceState(state.step),
      options: gen.options,
    });
    await audit('convergence.start', input.ownerId, { targetId: cardId, targetType: 'decision_card' });

    return { cardId, state };
  }

  // ---------------------------------------------------------------------------
  // 处理任意事件
  // ---------------------------------------------------------------------------

  async dispatch(cardId: string, event: ConvergenceEvent): Promise<StepResult> {
    let state = activeRooms.get(cardId);
    if (!state) {
      // 尝试从 store 重建 (V1 简化: 基于 DecisionCard 重建初始状态)
      const card = await getStore().decisionCards.get(cardId);
      if (!card) throw new Error(`Convergence room ${cardId} not found`);
      state = createInitialState(cardId, Date.now() - card.elapsedSeconds * 1000);
      activeRooms.set(cardId, state);
    }

    const result = transition(state, event);
    activeRooms.set(cardId, result.state);

    // 执行命令 (副作用)
    for (const cmd of result.commands) {
      await this.executeCommand(cmd);
    }

    // 同步 DecisionCard.convergenceState
    await getStore().decisionCards.update(cardId, {
      convergenceState: stepToConvergenceState(result.state.step),
      elapsedSeconds: result.state.elapsedSeconds,
    });

    // 记录关键审计
    if (event.type === 'PICK_OPTION') {
      await audit('convergence.option_picked', event.userId, {
        targetId: cardId,
        targetType: 'decision_card',
        metadata: { option: event.option },
      });
    } else if (event.type === 'COMMIT') {
      await audit('convergence.commit', event.userId, {
        targetId: cardId,
        targetType: 'decision_card',
      });
      
      // 飞轮成功率回写 (Reference Count): 累加所选选项引用的 Memory 的引用计数 (闭环)
      try {
        const card = await getStore().decisionCards.get(cardId);
        if (card && card.selected) {
          const selectedOpt = card.options.find((o) => o.id === card.selected);
          if (selectedOpt && selectedOpt.citedMemory && selectedOpt.citedMemory.length > 0) {
            const store = getStore();
            for (const memId of selectedOpt.citedMemory) {
              const mem = await store.memories.get(memId);
              if (mem) {
                const count = (mem.referenceCount ?? 0) + 1;
                await store.memories.update(memId, { referenceCount: count });
                // 审计修改
                await audit('memory.entry_revised', 'system', {
                  targetId: memId,
                  targetType: 'memory',
                  metadata: { action: 'reference_count_increment', referenceCount: count, cardId },
                });
              }
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[orchestrator] referenceCount increment failed:', err);
      }

      // Persona 学习钩子: 决议成交后更新 decisionHistory + styleProfile
      try {
        const { ingestDecisionCard } = await import('../persona/learning-collector');
        const card = await getStore().decisionCards.get(cardId);
        if (card) await ingestDecisionCard(card);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[orchestrator] persona learning failed:', err);
      }
      // 事件总线广播 (跨域订阅者可问): material-service / memory / okr-progress
      try {
        const card = await getStore().decisionCards.get(cardId);
        await eventBus.emit(
          'convergence.committed',
          {
            cardId,
            primaryKrId: card?.primaryKrId,
            decidedBy: event.userId,
            okrAnchor: card?.primaryKrId
              ? { type: 'kr', id: card.primaryKrId }
              : card?.noKrReason
              ? { type: 'none', reason: card.noKrReason }
              : { type: 'none' },
            timestamp: Date.now(),
          },
          `committed:${cardId}`,
        );
      } catch {
        /* event 广播错误不阫主流程 (bus 已隔离) */
      }
    } else if (event.type === 'VETO') {
      await audit('convergence.veto', event.userId, {
        targetId: cardId,
        targetType: 'decision_card',
        metadata: { reason: event.reason },
      });
      // Persona 学习钩子: 否决也是信号
      try {
        const { ingestDecisionCard } = await import('../persona/learning-collector');
        const card = await getStore().decisionCards.get(cardId);
        if (card) await ingestDecisionCard(card);
      } catch {
        /* ignore */
      }
    } else if (event.type === 'ESCALATE') {
      await audit('convergence.escalate', 'system', {
        targetId: cardId,
        targetType: 'decision_card',
        metadata: { reason: event.reason },
      });
      // 事件总线广播 (跨域订阅者可问): governance / notification / persona
      try {
        await eventBus.emit(
          'convergence.escalated',
          {
            cardId,
            reason: event.reason === 'hard_time_limit' ? 'time-limit' : 'manual',
            elapsedSeconds: result.state.elapsedSeconds,
            timestamp: Date.now(),
          },
          `escalated:${cardId}`,
        );
      } catch {
        /* event 广播错误不阫主流程 (bus 已隔离) */
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // 卡顿检测 (定时任务每分钟跑)
  // ---------------------------------------------------------------------------

  async checkStalls(): Promise<void> {
    const { detectSignals, publishSignals } = await import('./stall-detector');
    const { HARD_TIME_LIMIT_SECONDS } = await import('../types/decision-card');
    const { isFinalStep } = await import('./state-machine');
    const now = Date.now();
    const entries = Array.from(activeRooms.entries());
    for (const [cardId, state] of entries) {
      if (isFinalStep(state.step)) continue;

      // 1. 发信号 (UI 警示 + 审计)
      const signals = detectSignals(state, now);
      if (signals.length > 0) await publishSignals(signals);

      // 2. 硬上限闭环: 17min 超时 → 真触发 ESCALATE
      const elapsedSec = Math.floor((now - state.startedAt) / 1000);
      if (elapsedSec >= HARD_TIME_LIMIT_SECONDS) {
        await this.dispatch(cardId, {
          type: 'ESCALATE',
          reason: 'hard_time_limit',
          at: now,
        });
        continue;
      }

      // 3. 软预算 / 5min 卡顿 → 暂不自动升级, 仅 stall 信号 (UI 提示)
      // V2: 5min 卡顿 → 暴露分歧根源 + 再 1 轮
      if (detectStall(state, now)) {
        // 仅审计, 不自动 ESCALATE (避免误伤)
        // 需主持人主动点 ESCALATE 按钮
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 加载会话状态 (供 GET API)
  // ---------------------------------------------------------------------------

  async getRoomState(cardId: string): Promise<ConvergenceRoomState | null> {
    return activeRooms.get(cardId) ?? null;
  }

  async getDecisionCard(cardId: string): Promise<DecisionCard | null> {
    return getStore().decisionCards.get(cardId);
  }

  // ---------------------------------------------------------------------------
  // 命令执行
  // ---------------------------------------------------------------------------

  private async executeCommand(cmd: import('./state-machine').Command): Promise<void> {
    switch (cmd.type) {
      case 'EMIT_DECISION_CARD':
        await getStore().decisionCards.update(cmd.cardId, cmd.partial);
        break;
      case 'PERSIST_STATE':
        // active rooms 已在上层更新
        break;
      case 'NOTIFY_PARTICIPANTS':
        // V2: 通过 IM 推送, V1 仅 console
        // eslint-disable-next-line no-console
        console.info('[convergence:notify]', cmd.cardId, cmd.message);
        break;
      case 'GATHER_CONTEXT':
      case 'FRAME_PROBLEM':
      case 'GENERATE_OPTIONS':
        // 由 start() 流程主动驱动, 命令仅作日志
        break;
      case 'TRIGGER_ESCALATION':
        // V2: 通知主管 / 触发议事室紧急升级
        // eslint-disable-next-line no-console
        console.warn('[convergence:escalate]', cmd.cardId, cmd.reason);
        break;
      case 'START_VETO_WINDOW':
        await getStore().decisionCards.update(cmd.cardId, {
          vetoWindowEnds: new Date(cmd.expiresAt).toISOString(),
        });
        break;
    }
  }
}
