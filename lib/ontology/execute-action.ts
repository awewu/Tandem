/**
 * lib/ontology/execute-action.ts · 统一动作执行引擎 (ON-1 · 2026-06-09)
 *
 * 一条受治理写动作的唯一执行路径 (镜像 governedChat 的"唯一出口"哲学):
 *   ① 校验 (submission criteria) → ② 动作闸 (derive-zone 内容+委托) →
 *   ③ 主写 (execute) → ④ 声明式副作用 (各自幂等 + fail-soft) → ⑤ 审计
 *
 * fail-closed 铁律:
 *   - 红区永不自动执行 (无论 isProxy);
 *   - AI 代行 (isProxy) 黄区+ 暂拦 → 等 ON-2 接 24h 否决窗 (ProxyAction)。
 *   - 主写 (execute) 抛错 = 服务端错误, 记审计后向上抛 (调用方决定 HTTP)。
 *   - 副作用抛错 = fail-soft, 不回滚主写, 记入 sideEffects[].error。
 */

import { deriveActionZone } from '@/lib/skill-gateway/derive-zone';
import { audit } from '@/lib/audit/log';
import { actionRegistry, type ActionContext, type ActionZone, type SideEffectOutcome } from './action-types';

export interface ExecuteActionResult<TResult = unknown> {
  ok: boolean;
  blocked?: { stage: 'validate' | 'gate'; code?: string; reasons: string[] };
  result?: TResult;
  sideEffects: SideEffectOutcome[];
  zone: ActionZone;
  checkId: string;
}

function genId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function executeAction<TResult = unknown>(
  actionId: string,
  input: unknown,
  ctx: ActionContext,
): Promise<ExecuteActionResult<TResult>> {
  const checkId = genId();
  const action = actionRegistry.get(actionId);
  if (!action) {
    return {
      ok: false,
      blocked: { stage: 'validate', code: 'not_found', reasons: [`action ${actionId} 未注册`] },
      sideEffects: [],
      zone: 'green',
      checkId,
    };
  }

  // ── ① 校验 (submission criteria) ────────────────────────────────────
  const v = await action.validate(input, ctx);
  if (!v.ok) {
    await audit('ontology.action_blocked', ctx.actorUserId, {
      targetId: actionId,
      targetType: 'ontology_action',
      tenantId: ctx.tenantId,
      metadata: { stage: 'validate', code: v.code, reasons: v.errors, isProxy: ctx.isProxy, checkId },
    });
    return { ok: false, blocked: { stage: 'validate', code: v.code, reasons: v.errors }, sideEffects: [], zone: 'green', checkId };
  }

  // ── ② 动作闸 (derive-zone: 内容 + 委托级别, 组织主权) ─────────────────
  const zoneRes = deriveActionZone({
    intent: action.describeIntent(input as never),
    declaredActionScope: action.declaredActionScope,
    delegationLevel: ctx.delegationLevel,
  });
  const zone = zoneRes.zone;
  // 红区永不自动执行 (无论是否 approved); AI 代行黄区+ 暂拦, 除非已过审批/否决窗 (ctx.approved)
  if (zone === 'red' || (ctx.isProxy && zone !== 'green' && !ctx.approved)) {
    const reasons = [
      zone === 'red'
        ? '红区动作不可自动执行, 须员工本人走流程'
        : 'AI 代行 yellow+ 动作暂拦, 须经 ON-2 提议 + 24h 否决窗 (proposeAction)',
      ...zoneRes.reasons,
    ];
    await audit('ontology.action_blocked', ctx.actorUserId, {
      targetId: actionId,
      targetType: 'ontology_action',
      tenantId: ctx.tenantId,
      metadata: { stage: 'gate', zone, isProxy: ctx.isProxy, reasons, checkId },
    });
    return { ok: false, blocked: { stage: 'gate', reasons }, sideEffects: [], zone, checkId };
  }

  // ── ③ 主写 (核心 edit) ──────────────────────────────────────────────
  let result: TResult;
  try {
    result = (await action.execute(input as never, ctx)) as TResult;
  } catch (err) {
    await audit('ontology.action_blocked', ctx.actorUserId, {
      targetId: actionId,
      targetType: 'ontology_action',
      tenantId: ctx.tenantId,
      metadata: { stage: 'execute_failed', zone, error: (err as Error).message, checkId },
    });
    throw err; // 主写失败 = 服务端错误, 交调用方处理 (HTTP 500 等)
  }

  // ── ④ 声明式副作用 (各自幂等 + fail-soft, 不回滚主写) ─────────────────
  const sideEffects: SideEffectOutcome[] = [];
  for (const se of action.sideEffects) {
    try {
      const data = await se.run(result, ctx);
      sideEffects.push({ name: se.name, ok: true, data });
    } catch (err) {
      sideEffects.push({ name: se.name, ok: false, error: (err as Error).message });
    }
  }

  // ── ⑤ 审计 ──────────────────────────────────────────────────────────
  await audit('ontology.action_executed', ctx.actorUserId, {
    targetId: actionId,
    targetType: 'ontology_action',
    tenantId: ctx.tenantId,
    metadata: {
      zone,
      isProxy: ctx.isProxy,
      sideEffects: sideEffects.map((s) => ({ name: s.name, ok: s.ok })),
      checkId,
    },
  });

  return { ok: true, result, sideEffects, zone, checkId };
}
