/**
 * lib/ontology/propose-action.ts · 员工分身代行写动作: 提议 → 治理 → 否决窗 → 兑现 (ON-2 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 【宪法裁定 A · 2026-06-09 Owner: 中央 AI 纯参谋】
 *   中央 AI (CompanyBrain) **永不**作为 proposer 创建 ProxyAction —— 它是组织记忆的延伸/参谋,
 *   输出只是基线参考 (见 lib/persona/company-brain.ts doctrine: "不写 ProxyAction")。
 *   它的"建议"只在对话/3+1 选项里出现; 要落成写动作, **须员工本人或其已委托的分身**发起。
 *   本文件 proposeAction 因此只接受 **员工本人的分身** (self-delegation: persona.userId === onBehalfOfUserId),
 *   并在代码层硬拒中央 AI persona —— 把宪法从注释变成强制不变量。
 *
 * ON-1 的 executeAction 是"立即执行"(人工 owner 直调)。本层让**员工自己的分身** (已隐式委托)
 * **提议**一个写动作, 但不立即写 —— 而是:
 *   - 红区 → 拒绝 (永不代行);
 *   - 绿区 → 立即执行 (低风险, 仍写 ProxyAction 留痕);
 *   - 黄区 → 建 ProxyAction (awaiting_veto, 24h 否决窗), **暂不写**; 员工本人确认或窗口静默过 → 兑现真写。
 *
 * 这是"延迟执行 ProxyAction": 与既有 im_reply/email_draft (动作已发生, 否决窗仅事后撤销) 不同,
 * ontology_action 的真写发生在**否决窗之后** (materializeOntologyProxyAction)。
 * 故现有 reconcilePendingActions 对 ontology_action 跳过 (见 proxy-actions.ts),
 * 由 reconcileOntologyActionVetoWindows 专门兑现。窗口静默过 = 员工隐式批准 (因是其自己分身代行)。
 *
 * 闭环: 员工分身提议 → Govern(executeAction 闸) → 员工本人确认/24h →
 *       Writeback(executeAction approved) → Feedback(Decision Log)。
 *   (中央 AI 只参与"建议员工去做", 不参与本写链路。)
 */

import { deriveActionZone } from '@/lib/skill-gateway/derive-zone';
import { createProxyAction, confirmProxyAction } from '@/lib/persona/proxy-actions';
import { COMPANY_BRAIN_USER_ID, COMPANY_BRAIN_PERSONA_ID } from '@/lib/persona/company-brain';
import { getStore } from '@/lib/storage/repository';
import { audit } from '@/lib/audit/log';
import { actionRegistry, type ActionContext } from './action-types';
import { executeAction, type ExecuteActionResult } from './execute-action';

export interface ProposeActionInput {
  /** 要提议的 Action Type id, 如 'kr.checkin' */
  actionId: string;
  /** 动作入参 */
  input: unknown;
  /** 提议方 = **员工本人的分身** persona id (宪法 A: 中央 AI 不可作为 proposer) */
  proposerPersonaId: string;
  /** 动作以谁的名义执行 / 进谁的否决队列; 必须 === proposer 分身的所属员工 (self-delegation) */
  onBehalfOfUserId: string;
  tenantId: string;
  /** 提议理由 (写入 ProxyAction.body, 给被代行人看) */
  reason?: string;
  /** 委托级别 (derive-zone 越权升红判定) */
  delegationLevel?: ActionContext['delegationLevel'];
  /** 自定义否决窗口 (毫秒), 默认 24h */
  vetoWindowMs?: number;
}

export type ProposeResultStatus = 'rejected' | 'executed' | 'pending_veto';

export interface ProposeActionResult {
  status: ProposeResultStatus;
  zone: 'green' | 'yellow' | 'red';
  reasons: string[];
  /** status='executed' 时的执行结果 */
  execResult?: ExecuteActionResult;
  /** status='pending_veto' 时建立的 ProxyAction id */
  proxyActionId?: string;
}

/**
 * 提议一个写动作 (员工分身代行的入口)。
 * fail-closed: 红区拒绝; 黄区进否决窗不立即写; 仅绿区立即写。
 *
 * 宪法 A 守卫 (代码强制不变量): 仅接受员工本人的分身 (self-delegation);
 * 中央 AI persona 永远被拒 —— 中央 AI 是参谋, 不写 ProxyAction。
 */
export async function proposeAction(p: ProposeActionInput): Promise<ProposeActionResult> {
  // 宪法 A: 中央 AI 永不可作为 proposer
  if (
    p.proposerPersonaId === COMPANY_BRAIN_PERSONA_ID ||
    p.onBehalfOfUserId === COMPANY_BRAIN_USER_ID
  ) {
    return {
      status: 'rejected',
      zone: 'green',
      reasons: ['中央 AI 是参谋, 不创建代行写动作 (宪法 A); 请在对话/3+1 里建议员工本人去做'],
    };
  }
  // proposer 必须是该员工本人已存在的分身 (self-delegation)
  const proposer = await getStore().personas.get(p.proposerPersonaId);
  if (!proposer || proposer.userId === COMPANY_BRAIN_USER_ID) {
    return { status: 'rejected', zone: 'green', reasons: ['proposer 分身不存在或为中央 AI, 不可代行'] };
  }
  if (proposer.userId !== p.onBehalfOfUserId) {
    return {
      status: 'rejected',
      zone: 'green',
      reasons: ['分身只能代其所属员工本人代行 (self-delegation), 不可替他人发起写动作'],
    };
  }

  const action = actionRegistry.get(p.actionId);
  if (!action) {
    return { status: 'rejected', zone: 'green', reasons: [`action ${p.actionId} 未注册`] };
  }

  const ctx: ActionContext = {
    actorUserId: p.onBehalfOfUserId,
    isProxy: true,
    tenantId: p.tenantId,
    delegationLevel: p.delegationLevel,
  };

  // 1. 先校验 (submission criteria); 不通过直接拒绝 (不进否决队列, 省噪音)
  const v = await action.validate(p.input as never, ctx);
  if (!v.ok) {
    return { status: 'rejected', zone: 'green', reasons: v.errors };
  }

  // 2. 判 zone (内容 + 委托级别)
  const zoneRes = deriveActionZone({
    intent: action.describeIntent(p.input as never),
    declaredActionScope: action.declaredActionScope,
    delegationLevel: p.delegationLevel,
  });
  const zone = zoneRes.zone;

  // 3. 红区 → 永不代行
  if (zone === 'red') {
    return { status: 'rejected', zone, reasons: ['红区动作不可代行, 须员工本人走流程', ...zoneRes.reasons] };
  }

  // 4. 绿区 → 立即执行 (approved 旁路; 仍写 ProxyAction 留痕 = executed)
  if (zone === 'green') {
    const execResult = await executeAction(p.actionId, p.input, { ...ctx, approved: true });
    await createProxyAction({
      userId: p.onBehalfOfUserId,
      personaId: p.proposerPersonaId,
      tenantId: p.tenantId,
      kind: 'ontology_action',
      zone: 'green',
      title: `[已执行] ${action.label}`,
      body: p.reason,
      refType: 'ontology_action',
      refId: p.actionId,
      metadata: { ontologyActionId: p.actionId, ontologyInput: p.input, execOk: execResult.ok },
    });
    return { status: execResult.ok ? 'executed' : 'rejected', zone, reasons: execResult.ok ? [] : (execResult.blocked?.reasons ?? ['执行失败']), execResult };
  }

  // 5. 黄区 → 建延迟执行 ProxyAction (awaiting_veto), 暂不写
  const pa = await createProxyAction({
    userId: p.onBehalfOfUserId,
    personaId: p.proposerPersonaId,
    tenantId: p.tenantId,
    kind: 'ontology_action',
    zone: 'yellow',
    title: `[待确认] ${action.label}`,
    body: p.reason,
    refType: 'ontology_action',
    refId: p.actionId,
    initialStatus: 'awaiting_veto',
    vetoWindowMs: p.vetoWindowMs,
    // 兑现所需: 动作 id + 入参 + 以谁名义执行
    metadata: { ontologyActionId: p.actionId, ontologyInput: p.input, onBehalfOfUserId: p.onBehalfOfUserId },
  });

  return { status: 'pending_veto', zone, reasons: zoneRes.reasons, proxyActionId: pa.id };
}

/**
 * 兑现一个 ontology_action ProxyAction 的真写 (人工确认 / 否决窗静默过期 调用)。
 * 用 ctx.approved=true 旁路 isProxy-yellow 闸 (审批即授权), 红区仍永不放行。
 */
export async function materializeOntologyProxyAction(
  proxyAction: {
    id: string;
    kind: string;
    tenantId: string;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<ExecuteActionResult | null> {
  if (proxyAction.kind !== 'ontology_action') return null;
  const meta = proxyAction.metadata ?? {};
  const actionId = meta.ontologyActionId as string | undefined;
  const input = meta.ontologyInput;
  const onBehalfOfUserId = meta.onBehalfOfUserId as string | undefined;
  if (!actionId || !onBehalfOfUserId) return null;

  return executeAction(actionId, input, {
    actorUserId: onBehalfOfUserId,
    isProxy: true,
    approved: true,
    tenantId: proxyAction.tenantId,
  });
}

export interface ConfirmAndMaterializeResult {
  ok: boolean;
  reason?: string;
  execResult?: ExecuteActionResult;
}

/**
 * 人工确认一个 ontology_action 提议 → 兑现真写 → 标记 ProxyAction executed。
 * 非 ontology_action 则只走普通 confirmProxyAction (不写)。
 */
export async function confirmAndMaterialize(
  proxyActionId: string,
  confirmedBy: string,
): Promise<ConfirmAndMaterializeResult> {
  const store = getStore();
  const pa = await store.proxyActions.get(proxyActionId);
  if (!pa) return { ok: false, reason: 'ProxyAction not found' };
  if (pa.status === 'vetoed' || pa.status === 'expired') {
    return { ok: false, reason: `无法确认状态为 ${pa.status} 的代行` };
  }
  if (pa.kind !== 'ontology_action') {
    await confirmProxyAction(proxyActionId, confirmedBy);
    return { ok: true };
  }
  // 已执行的幂等返回 (防重复兑现真写)
  if (pa.status === 'executed') return { ok: true };

  const execResult = await materializeOntologyProxyAction(pa);
  if (!execResult) return { ok: false, reason: '缺少 ontology 动作元数据, 无法兑现' };
  if (!execResult.ok) {
    return { ok: false, reason: execResult.blocked?.reasons.join('; ') ?? '兑现执行被拦', execResult };
  }
  await confirmProxyAction(proxyActionId, confirmedBy);
  return { ok: true, execResult };
}

/**
 * 兑现所有"否决窗已静默通过"的 ontology_action 提议 (cron / on-demand)。
 * 窗口过 = 隐式批准 (MANIFESTO 24h 否决窗哲学) → 真跑 executeAction → 标记 executed。
 * 兑现失败的保留 awaiting_veto (下轮重试), 不误标 executed。
 *
 * 注: 暂未挂 cron (无自动行为变更); 接 cron 即让 AI 提议在静默 24h 后自动落地。
 */
export async function reconcileOntologyActionVetoWindows(): Promise<{
  materialized: number;
  failed: number;
}> {
  const store = getStore();
  const all = await store.proxyActions.list();
  const now = Date.now();
  let materialized = 0;
  let failed = 0;

  for (const a of all) {
    if (a.kind !== 'ontology_action') continue;
    if (a.status !== 'awaiting_veto') continue;
    if (!a.vetoUntil || new Date(a.vetoUntil).getTime() > now) continue;

    let ok = false;
    try {
      const execResult = await materializeOntologyProxyAction(a);
      ok = !!execResult?.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      failed += 1;
      continue; // 保留 awaiting_veto, 下轮重试 (不误标 executed)
    }
    const ts = new Date().toISOString();
    await store.proxyActions.update(a.id, { status: 'executed', executedAt: ts, updatedAt: ts } as never);
    await audit('persona.proxy_executed', 'system', {
      targetId: a.id,
      targetType: 'proxy_action:ontology_action',
      tenantId: a.tenantId,
      metadata: { auto: true, reason: 'veto_window_passed', materialized: true },
    });
    materialized += 1;
  }

  return { materialized, failed };
}
