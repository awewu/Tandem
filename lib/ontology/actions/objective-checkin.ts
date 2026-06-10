/**
 * lib/ontology/actions/objective-checkin.ts · Action Type: Objective 进度 Check-in (ON-1 扩展 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 把原先散在 `app/api/okr/checkins/route.ts` (scope==='objective' 分支) 的目标级 check-in
 * 写逻辑声明式收编, 与 kr.checkin 对齐 (单一真值 + 副作用只声明一次):
 *   - submission criteria: Objective 存在 / 授权 (owner·collaborator·demo) / 未废弃 / 信心度合法。
 *   - 主写 (execute): 建 CheckIn(scope='objective') + 可选同步 Objective.confidence。
 *   - 声明式副作用: okr.rollup.propagate — 从该 Objective 沿父链向上重算 currentProgress + emit 事件。
 *
 * 与 kr.checkin 的差异: Objective 进度是 rollup 派生值 (不直接写 currentProgress), 故 check-in
 *   只同步 confidence + 记录三段式叙述, 进度由 propagateRollupFromObjective 重算 (绝不覆盖人工 override)。
 *
 * 装手: 经 proposeAction 提议时, declaredActionScope='commit' → 黄区 24h 否决窗 (与 kr.checkin 一致),
 *   委托级别不足 commit 则越权升红 (derive-zone)。
 */

import { getStore } from '@/lib/storage/repository';
import { eventBus } from '@/lib/events/bus';
import { propagateRollupFromObjective } from '@/lib/okr/rollup';
import type { CheckIn, Confidence } from '@/lib/types/okr-tti';
import type { ActionType } from '../action-types';

const VALID_CONFIDENCE: Confidence[] = ['on-track', 'at-risk', 'off-track'];

export interface ObjectiveCheckinInput {
  objectiveId: string;
  /** 信心度 (写回 Objective.confidence + checkIn.confidenceAfter) */
  confidenceAfter?: Confidence;
  confidenceBefore?: Confidence;
  progressBefore?: number;
  progressAfter?: number;
  achievements?: string | null;
  blockers?: string | null;
  nextSteps?: string | null;
  mood?: 'happy' | 'neutral' | 'sad' | null;
}

export interface ObjectiveCheckinResult {
  checkIn: CheckIn;
  objectiveId: string;
  confidenceBefore: Confidence | null;
  /** 若本次改了信心度则为新值, 否则 null */
  confidenceAfter: Confidence | null;
}

export const ObjectiveCheckinAction: ActionType<ObjectiveCheckinInput, ObjectiveCheckinResult> = {
  id: 'objective.checkin',
  objectType: 'Objective',
  label: 'Objective 进度 Check-in',
  declaredActionScope: 'commit',
  describeIntent: (i) => `OKR Check-in: 更新目标 ${i?.objectiveId ?? ''} 进度`,

  async validate(input, ctx) {
    if (!input || typeof input.objectiveId !== 'string' || !input.objectiveId) {
      return { ok: false, errors: ['objectiveId required'], code: 'invalid' };
    }
    const obj = await getStore().objectives.get(input.objectiveId);
    if (!obj) return { ok: false, errors: ['objective not found'], code: 'not_found' };

    // 授权 (与原 API 一致): owner / collaborator / demo
    const authorized =
      obj.ownerId === ctx.actorUserId ||
      (obj.collaboratorIds ?? []).includes(ctx.actorUserId) ||
      !!ctx.demo;
    if (!authorized) return { ok: false, errors: ['forbidden'], code: 'forbidden' };

    const errors: string[] = [];
    if (obj.status === 'abandoned') errors.push('目标已废弃, 不可 check-in');
    if (input.confidenceAfter !== undefined && !VALID_CONFIDENCE.includes(input.confidenceAfter)) {
      errors.push(`confidenceAfter 非法: ${input.confidenceAfter}`);
    }
    return errors.length ? { ok: false, errors, code: 'invalid' } : { ok: true, errors: [] };
  },

  async execute(input, ctx) {
    const store = getStore();
    const obj = await store.objectives.get(input.objectiveId);
    const confidenceBefore = (obj?.confidence ?? null) as Confidence | null;
    const now = new Date().toISOString();

    const checkIn = await store.checkIns.create({
      scope: 'objective',
      scopeId: input.objectiveId,
      authorId: ctx.actorUserId,
      progressBefore: typeof input.progressBefore === 'number' ? input.progressBefore : 0,
      progressAfter: typeof input.progressAfter === 'number' ? input.progressAfter : 0,
      confidenceBefore: input.confidenceBefore ?? confidenceBefore ?? 'on-track',
      confidenceAfter: input.confidenceAfter ?? confidenceBefore ?? 'on-track',
      achievements: input.achievements ?? null,
      blockers: input.blockers ?? null,
      nextSteps: input.nextSteps ?? null,
      mood: input.mood ?? null,
      createdAt: now,
    });

    let confidenceAfter: Confidence | null = null;
    if (typeof input.confidenceAfter === 'string') {
      await store.objectives.update(input.objectiveId, {
        confidence: input.confidenceAfter,
        updatedAt: now,
      });
      confidenceAfter = input.confidenceAfter;
    }

    return { checkIn, objectiveId: input.objectiveId, confidenceBefore, confidenceAfter };
  },

  sideEffects: [
    {
      // 真 rollup: 从该 Objective 沿父链向上重算 currentProgress + 每个被重算 O 发事件
      name: 'okr.rollup.propagate',
      async run(result) {
        const store = getStore();
        const rolledUp = await propagateRollupFromObjective(result.objectiveId, store);
        rolledUp.forEach((r, depth) => {
          if (!r.changed) return;
          void eventBus.emit(
            'okr.objective-rolled-up',
            {
              objectiveId: r.objectiveId,
              from: r.from,
              to: r.to,
              triggeredByObjectiveId: result.objectiveId,
              depth,
              timestamp: Date.now(),
            },
            `objective-rolled-up:${result.checkIn.id}:${r.objectiveId}`,
          );
        });
        return rolledUp;
      },
    },
  ],
};
