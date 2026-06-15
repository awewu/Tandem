/**
 * lib/ontology/actions/kr-checkin.ts · 首个 Action Type: KR 进度 Check-in (ON-1 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 把原先散在 `app/api/okr/checkins/route.ts` 的 KR check-in 写逻辑 + 副作用**声明式收编**:
 *   - submission criteria: KR 存在 / 授权 (owner·coOwner·demo) / 未废弃 / 数值与信心度合法。
 *   - 主写 (execute): 建 CheckIn + 同步 KR.currentValue/confidence。
 *   - 声明式副作用:
 *       ① okr.rollup.propagate — propagateRollupFromKr 向上传播 + emit objective-rolled-up (幂等键)
 *       ② okr.kr-progressed.emit — 跨域事件 (drift/analytics/company-brain 订阅, 幂等键)
 *
 * 根治 Issue 4 类耦合: IM/日历/OKR 页/中央 AI 都调 executeAction('kr.checkin', ...),
 *   副作用只声明一次, 不再各处手抄。IM 广播是 UI 层可选副作用, 不进核心动作 (保持与现 API 行为一致)。
 */

import { getStore } from '@/lib/storage/repository';
import { eventBus } from '@/lib/events/bus';
import { propagateRollupFromKr } from '@/lib/okr/rollup';
import type { CheckIn, Confidence } from '@/lib/types/okr-tti';
import type { ActionType } from '../action-types';

const VALID_CONFIDENCE: Confidence[] = ['on-track', 'at-risk', 'off-track'];

export interface KrCheckinInput {
  krId: string;
  /** 最新进度数值 (写回 KR.currentValue); 缺省则不改数值 */
  currentValue?: number;
  /** 信心度 (写回 KR.confidence + checkIn.confidenceAfter) */
  confidenceAfter?: Confidence;
  confidenceBefore?: Confidence;
  progressBefore?: number;
  progressAfter?: number;
  achievements?: string | null;
  blockers?: string | null;
  nextSteps?: string | null;
  mood?: 'happy' | 'neutral' | 'sad' | null;
}

export interface KrCheckinResult {
  checkIn: CheckIn;
  krId: string;
  currentValueBefore: number;
  /** 若本次改了数值则为新值, 否则 null */
  currentValueAfter: number | null;
}

export const KrCheckinAction: ActionType<KrCheckinInput, KrCheckinResult> = {
  id: 'kr.checkin',
  objectType: 'KeyResult',
  label: 'KR 进度 Check-in',
  declaredActionScope: 'commit',
  describeIntent: (i) => `OKR Check-in: 更新关键结果 ${i?.krId ?? ''} 进度`,

  async validate(input, ctx) {
    if (!input || typeof input.krId !== 'string' || !input.krId) {
      return { ok: false, errors: ['krId required'], code: 'invalid' };
    }
    const kr = await getStore().keyResults.get(input.krId);
    if (!kr) return { ok: false, errors: ['kr not found'], code: 'not_found' };

    // 授权 (与原 API 一致): owner / coOwner / demo
    const authorized =
      kr.ownerId === ctx.actorUserId ||
      (kr.coOwnerIds ?? []).includes(ctx.actorUserId) ||
      !!ctx.demo;
    if (!authorized) return { ok: false, errors: ['forbidden'], code: 'forbidden' };

    // submission criteria (业务前置, 超出原 API 的纯类型校验)
    const errors: string[] = [];
    if (kr.status === 'abandoned') errors.push('KR 已废弃, 不可 check-in');
    if (input.currentValue !== undefined && !Number.isFinite(input.currentValue)) {
      errors.push('currentValue 必须是有限数值');
    }
    if (input.confidenceAfter !== undefined && !VALID_CONFIDENCE.includes(input.confidenceAfter)) {
      errors.push(`confidenceAfter 非法: ${input.confidenceAfter}`);
    }
    return errors.length ? { ok: false, errors, code: 'invalid' } : { ok: true, errors: [] };
  },

  async execute(input, ctx) {
    const store = getStore();
    const kr = await store.keyResults.get(input.krId);
    const currentValueBefore = kr?.currentValue ?? 0;
    const now = new Date().toISOString();

    const checkIn = await store.checkIns.create({
      scope: 'kr',
      scopeId: input.krId,
      authorId: ctx.actorUserId,
      progressBefore: typeof input.progressBefore === 'number' ? input.progressBefore : 0,
      progressAfter: typeof input.progressAfter === 'number' ? input.progressAfter : 0,
      confidenceBefore: input.confidenceBefore ?? 'on-track',
      confidenceAfter: input.confidenceAfter ?? 'on-track',
      achievements: input.achievements ?? null,
      blockers: input.blockers ?? null,
      nextSteps: input.nextSteps ?? null,
      mood: input.mood ?? null,
      // P0-B: check-in 继承父 KR 的租户, 保证多租户读隔离.
      tenantId: kr?.tenantId ?? 'default',
      createdAt: now,
    });

    let currentValueAfter: number | null = null;
    if (typeof input.currentValue === 'number' || typeof input.confidenceAfter === 'string') {
      const patch: Record<string, unknown> = { updatedAt: now };
      if (typeof input.currentValue === 'number') {
        patch.currentValue = input.currentValue;
        currentValueAfter = input.currentValue;
      }
      if (typeof input.confidenceAfter === 'string') patch.confidence = input.confidenceAfter;
      await store.keyResults.update(input.krId, patch);
    }

    return { checkIn, krId: input.krId, currentValueBefore, currentValueAfter };
  },

  sideEffects: [
    {
      // ① B2 真 rollup: KR → Objective → 父O 向上传播 + 每个被重算 O 发事件
      name: 'okr.rollup.propagate',
      async run(result) {
        const store = getStore();
        const rolledUp = await propagateRollupFromKr(result.krId, store);
        rolledUp.forEach((r, depth) => {
          if (!r.changed) return;
          void eventBus.emit(
            'okr.objective-rolled-up',
            {
              objectiveId: r.objectiveId,
              from: r.from,
              to: r.to,
              triggeredByKrId: result.krId,
              depth,
              timestamp: Date.now(),
            },
            `objective-rolled-up:${result.checkIn.id}:${r.objectiveId}`,
          );
        });
        return rolledUp; // lineage: 哪些 Objective 从 from→to 被重算
      },
    },
    {
      // ② 跨域事件: drift detector / analytics / company-brain 订阅
      name: 'okr.kr-progressed.emit',
      async run(result, ctx) {
        await eventBus.emit(
          'okr.kr-progressed',
          {
            krId: result.krId,
            from: result.checkIn.progressBefore,
            to: result.checkIn.progressAfter,
            by: ctx.actorUserId,
            source: 'check-in',
            timestamp: Date.now(),
          },
          `kr-progressed:${result.checkIn.id}`,
        );
      },
    },
  ],
};
