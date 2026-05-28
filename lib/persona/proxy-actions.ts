/**
 * ProxyAction Service · 代行动作生命周期 (闭环单一入口)
 *
 * 拿捏闭环 ③ 代行 + ④ 反馈 的统一入口.
 * 所有 Persona 替员工做的事 (会议/沟通/IM/决议/邮件) 都必须经此服务记录.
 *
 * 提供:
 *   - createProxyAction()        : 起草/执行代行 (按 zone 决定状态)
 *   - vetoProxyAction()          : 员工/老板否决 (24h 窗口内)
 *   - confirmProxyAction()       : 员工显式确认, 跳过等待
 *   - expirePendingActions()     : 定时清理 drafted 超时
 *   - listMyProxyActions()       : 员工查看自己的代行历史
 *   - executeAwaitingActions()   : 定时把过期 awaiting_veto → executed
 *
 * §13 红区铁律: zone='red' 直接抛错, 永不进表.
 */

import { audit } from '../audit/log';
import { getStore } from '../storage/repository';
import type {
  ProxyAction,
  ProxyActionKind,
  ProxyActionStatus,
} from '../types/proxy-action';
import { DEFAULT_VETO_WINDOW_MS, isWithinVetoWindow } from '../types/proxy-action';
import type { Zone } from '../proxy/meeting-proxy';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateProxyActionInput {
  userId: string;
  personaId: string;
  tenantId: string;
  kind: ProxyActionKind;
  zone: Zone;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
  /** 自定义否决窗口 (毫秒), 默认 24h */
  vetoWindowMs?: number;
  /** 起草还是已执行: drafted=待员工确认 / awaiting_veto=已发出待否决 */
  initialStatus?: 'drafted' | 'awaiting_veto';
  metadata?: Record<string, unknown>;
}

export async function createProxyAction(input: CreateProxyActionInput): Promise<ProxyAction> {
  if (input.zone === 'red') {
    throw new Error('红区永远不允许 ProxyAction (§13 必须人本)');
  }

  const now = new Date();
  const requested: 'drafted' | 'awaiting_veto' = input.initialStatus ?? 'awaiting_veto';
  // green 区不需要否决窗口, 直接 executed; 其它按 24h 默认
  const isGreen = input.zone === 'green';
  const finalStatus: ProxyActionStatus = isGreen ? 'executed' : requested;
  const vetoWindow = isGreen ? 0 : input.vetoWindowMs ?? DEFAULT_VETO_WINDOW_MS;
  const vetoUntil = isGreen ? undefined : new Date(now.getTime() + vetoWindow).toISOString();

  const store = getStore();
  const action = await store.proxyActions.create({
    userId: input.userId,
    personaId: input.personaId,
    tenantId: input.tenantId,
    kind: input.kind,
    zone: input.zone,
    status: finalStatus,
    title: input.title,
    body: input.body,
    refType: input.refType,
    refId: input.refId,
    vetoUntil,
    executedAt: isGreen ? now.toISOString() : undefined,
    metadata: input.metadata,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as never);

  await audit(
    requested === 'drafted' ? 'persona.proxy_drafted' : 'persona.proxy_action',
    input.userId,
    {
      targetId: action.id,
      targetType: `proxy_action:${input.kind}`,
      tenantId: input.tenantId,
      metadata: { zone: input.zone, title: input.title, refType: input.refType, refId: input.refId },
    }
  );

  // §B-015 OKR Drift Detection: ProxyAction 是 Persona 的实际副作用, 偏离 OKR 风险更高
  // best-effort, 不阻断 (V1.5 仅写 audit, 治理委员会月审看 drift)
  try {
    const { checkOkrDrift, auditOkrDriftIfNeeded } = await import('../governance/okr-drift');
    const driftInput = {
      intent: `${input.title}\n${input.body ?? ''}`,
      actorUserId: input.userId,
      source: 'proxy_action' as const,
      refId: action.id,
      tenantId: input.tenantId,
    };
    const drift = await checkOkrDrift(driftInput);
    await auditOkrDriftIfNeeded(drift, driftInput);
  } catch {
    /* drift 检测失败不影响 ProxyAction 创建 */
  }

  return action;
}

// ---------------------------------------------------------------------------
// Veto / Confirm
// ---------------------------------------------------------------------------

export async function vetoProxyAction(
  actionId: string,
  vetoedBy: string,
  reason?: string
): Promise<ProxyAction> {
  const store = getStore();
  const cur = await store.proxyActions.get(actionId);
  if (!cur) throw new Error('ProxyAction not found');
  if (cur.status === 'vetoed') return cur;
  if (cur.status === 'executed') {
    throw new Error('该代行已执行落定, 无法再否决 (24h 窗口已过)');
  }

  const now = new Date().toISOString();
  const updated = await store.proxyActions.update(actionId, {
    status: 'vetoed',
    vetoedBy,
    vetoedAt: now,
    vetoReason: reason,
    updatedAt: now,
  } as never);

  await audit('persona.proxy_vetoed', vetoedBy, {
    targetId: actionId,
    targetType: `proxy_action:${cur.kind}`,
    tenantId: cur.tenantId,
    metadata: { reason, originalUserId: cur.userId },
  });

  return updated;
}

export async function confirmProxyAction(
  actionId: string,
  confirmedBy: string
): Promise<ProxyAction> {
  const store = getStore();
  const cur = await store.proxyActions.get(actionId);
  if (!cur) throw new Error('ProxyAction not found');
  if (cur.status === 'executed') return cur;
  if (cur.status === 'vetoed' || cur.status === 'expired') {
    throw new Error(`无法确认状态为 ${cur.status} 的代行`);
  }

  const now = new Date().toISOString();
  const updated = await store.proxyActions.update(actionId, {
    status: 'executed',
    confirmedBy,
    confirmedAt: now,
    executedAt: now,
    updatedAt: now,
  } as never);

  await audit('persona.proxy_executed', confirmedBy, {
    targetId: actionId,
    targetType: `proxy_action:${cur.kind}`,
    tenantId: cur.tenantId,
    metadata: { confirmedExplicit: true },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Expire (cron / on-demand)
// ---------------------------------------------------------------------------

/** 把所有 awaiting_veto 且 vetoUntil 已过的 → executed (默认), drafted 超时 → expired. */
export async function reconcilePendingActions(): Promise<{
  executed: number;
  expired: number;
}> {
  const store = getStore();
  const all = await store.proxyActions.list();
  const now = Date.now();
  let executed = 0;
  let expired = 0;

  for (const a of all) {
    if (a.status === 'awaiting_veto' && a.vetoUntil && new Date(a.vetoUntil).getTime() <= now) {
      await store.proxyActions.update(a.id, {
        status: 'executed',
        executedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as never);
      await audit('persona.proxy_executed', 'system', {
        targetId: a.id,
        targetType: `proxy_action:${a.kind}`,
        tenantId: a.tenantId,
        metadata: { auto: true, reason: 'veto_window_passed' },
      });
      executed += 1;
    } else if (
      a.status === 'drafted' &&
      a.vetoUntil &&
      new Date(a.vetoUntil).getTime() <= now
    ) {
      await store.proxyActions.update(a.id, {
        status: 'expired',
        updatedAt: new Date().toISOString(),
      } as never);
      await audit('persona.proxy_expired', 'system', {
        targetId: a.id,
        targetType: `proxy_action:${a.kind}`,
        tenantId: a.tenantId,
        metadata: { auto: true, reason: 'draft_unconfirmed' },
      });
      expired += 1;
    }
  }

  return { executed, expired };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProxyActionsForUser(
  userId: string,
  tenantId: string,
  opts?: { status?: ProxyActionStatus; limit?: number }
): Promise<ProxyAction[]> {
  const store = getStore();
  const all = await store.proxyActions.list();
  const filtered = all
    .filter((a) => a.userId === userId && a.tenantId === tenantId)
    .filter((a) => (opts?.status ? a.status === opts.status : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return opts?.limit ? filtered.slice(0, opts.limit) : filtered;
}

export { isWithinVetoWindow };
