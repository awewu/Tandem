/**
 * GEO 受治理动作引擎（Foundry Ontology「动词/kinetics」的轻量本地实现）
 *
 * 借鉴 Palantir Foundry Action 的**工程机制**（学思想、不共享 Tandem 代码、只覆盖 GEO 主线）：
 *   Action = 参数 + validate(前置校验) + execute(主写) + zone(治理闸) + 审计
 *
 * 为什么要它（宪章 §2 因果链的架构缺口）：
 *   Nexus 的 GEO 是 52 个散落端点，AI 无法"像人一样调动作"。把 GEO 主线的
 *   generateContent / runExperiment / verifyLift 收敛成**受治理的 Action**后：
 *     · 人和 AI Agent 走同一套「校验→闸→执行→审计」，不再各写各的；
 *     · AI 代行(isProxy)的写动作默认拦在核准前（对齐宪章 §12 draft→approved）；
 *     · 这是通往 AgenticGEO「自主调动作优化」的第一块地基。
 *
 * 边界：只治理"会改变对外可见内容/发布状态"的写动作；纯读/探测不入此引擎。
 */

export type GeoActionZone = 'green' | 'yellow' | 'red';

export interface GeoActionContext {
  actorUserId: string;
  tenantId: string;
  /** 是否 AI 代行（persona/自主 agent 触发，非用户直接点） */
  isProxy: boolean;
  /** 已过人工核准/否决窗（仅由核准路径设置；黄区代行经此放行，红区永不） */
  approved?: boolean;
  role?: string;
}

export interface GeoActionValidation {
  ok: boolean;
  errors: string[];
  code?: 'not_found' | 'forbidden' | 'invalid';
}

export interface GeoActionType<TInput = unknown, TResult = unknown> {
  id: string;                       // 如 'geo.generate-content'
  objectType: string;              // 锚到概念对象：CopyAsset / GeoExperiment
  label: string;
  /** 动作固有风险区：green=可自动 / yellow=代行需核准 / red=永不自动 */
  zone: GeoActionZone;
  validate: (input: TInput, ctx: GeoActionContext) => Promise<GeoActionValidation> | GeoActionValidation;
  execute: (input: TInput, ctx: GeoActionContext) => Promise<TResult>;
}

export interface GeoActionResult<TResult = unknown> {
  ok: boolean;
  data?: TResult;
  blocked?: { stage: 'validate' | 'gate'; code?: string; reasons: string[] };
  zone: GeoActionZone;
  checkId: string;
}

class GeoActionRegistry {
  private actions = new Map<string, GeoActionType>();
  register<I, R>(a: GeoActionType<I, R>): void { this.actions.set(a.id, a as unknown as GeoActionType); }
  get(id: string): GeoActionType | undefined { return this.actions.get(id); }
  has(id: string): boolean { return this.actions.has(id); }
  list(): GeoActionType[] { return Array.from(this.actions.values()); }
}

// 单例挂 globalThis，防热重载重复注册
const _g = globalThis as typeof globalThis & { __nexus_geo_action_registry__?: GeoActionRegistry };
if (!_g.__nexus_geo_action_registry__) _g.__nexus_geo_action_registry__ = new GeoActionRegistry();
export const geoActionRegistry: GeoActionRegistry = _g.__nexus_geo_action_registry__;

const genId = () => `geoact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 统一执行器：校验 → 治理闸 → 主写 → 审计。
 * @param audit 审计回调（由 service 注入，落 Nexus AuditLogEntity，带 RLS 上下文）
 */
export async function executeGeoAction<TResult = unknown>(
  actionId: string,
  input: unknown,
  ctx: GeoActionContext,
  audit: (event: string, meta: Record<string, unknown>) => Promise<void>,
): Promise<GeoActionResult<TResult>> {
  const checkId = genId();
  const action = geoActionRegistry.get(actionId);
  if (!action) {
    return { ok: false, blocked: { stage: 'validate', code: 'not_found', reasons: [`action ${actionId} 未注册`] }, zone: 'green', checkId };
  }

  // ① 前置校验（submission criteria）
  const v = await action.validate(input, ctx);
  if (!v.ok) {
    await audit('geo.action_blocked', { actionId, stage: 'validate', code: v.code, reasons: v.errors, isProxy: ctx.isProxy, checkId });
    return { ok: false, blocked: { stage: 'validate', code: v.code, reasons: v.errors }, zone: action.zone, checkId };
  }

  // ② 治理闸：红区永不自动；AI 代行黄区+ 未核准即拦（对齐宪章 §12）
  if (action.zone === 'red' || (ctx.isProxy && action.zone !== 'green' && !ctx.approved)) {
    const reasons = [
      action.zone === 'red'
        ? '红区动作不可自动执行，须人工走流程'
        : 'AI 代行的黄区动作暂拦，须经人工核准（draft→approved）后放行',
    ];
    await audit('geo.action_blocked', { actionId, stage: 'gate', zone: action.zone, isProxy: ctx.isProxy, reasons, checkId });
    return { ok: false, blocked: { stage: 'gate', reasons }, zone: action.zone, checkId };
  }

  // ③ 主写 + 审计（成功）
  const result = await action.execute(input, ctx);
  await audit('geo.action_executed', { actionId, objectType: action.objectType, zone: action.zone, isProxy: ctx.isProxy, approved: !!ctx.approved, checkId });
  return { ok: true, data: result as TResult, zone: action.zone, checkId };
}
