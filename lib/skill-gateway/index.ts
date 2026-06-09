/**
 * Skill Gateway · CompanyBrain 4 道闸 (P4 框架)
 *
 * MANIFESTO §19 立项铁律: 任何 AI 调企业数据/工具必经此网关.
 *
 * 4 道闸 (任何一道挡住 = 拦截 / 降级):
 *   ① Baseline-Guard       (现有 lib/memory/baseline-guard.ts)
 *   ② OKR Drift Detection  (现有 lib/governance/okr-drift.ts)
 *   ③ Data Scope           (P5 接 RBAC)
 *   ④ Action Scope         (P4 接 ProxyAction 三区)
 *
 * 设计原则:
 *   - 所有调用走 audit log (Steward 月度审计)
 *   - 任一闸阻断 → 立即返回拦截结果 + 通知治理委员会
 *   - SOFT_WARN 级别注入上下文继续, 不阻断
 *   - 默认 fail-open (闸故障不阻塞业务, 但记 warning)
 */

import { audit } from '../audit/log';
import { deriveActionZone } from './derive-zone';
import type { DelegationLevel } from '../types/persona';

export type GateVerdict = 'PASS' | 'SOFT_WARN' | 'HARD_BLOCK';

export interface SkillGatewayInput {
  /** 调用意图 (user prompt / intent description) */
  intent: string;
  /** 调用方 userId */
  actorUserId: string;
  /** 调用类型 (与 baseline-guard 对齐) */
  agentKind: 'autonomous' | 'skill' | 'persona';
  /** 调用工具名 (e.g. 'persona.brief', 'report.extract', 'tti.breakdown') */
  toolName: string;
  /** 关联 OKR ID (事半场景必填) */
  okrAnchorId?: string;
  /** 关联 KR ID */
  krAnchorId?: string;
  /** 涉及数据范围 */
  dataScope?: 'personal' | 'team' | 'department' | 'company';
  /** 涉及的目标用户 (跨用户数据访问判定; 等于 actor=本人放行, 不等需特权) */
  targetUserId?: string;
  /** 涉及动作类型 */
  actionScope?: 'read_only' | 'create_draft' | 'commit' | 'send_external';
  /** persona 委托级别 (C1: 用于"越权即升红"内容判定) */
  delegationLevel?: DelegationLevel;
}

export interface SkillGatewayResult {
  verdict: GateVerdict;
  /** 各闸的细节 */
  gates: {
    baseline: { verdict: GateVerdict; reasons: string[] };
    okrDrift: { verdict: GateVerdict; driftScore?: number };
    dataScope: { verdict: GateVerdict; level?: string; reason?: string };
    actionScope: { verdict: GateVerdict; zone?: 'green' | 'yellow' | 'red' };
  };
  /** 注入到 system prompt 的额外上下文 (SOFT_WARN 时) */
  contextToInject?: string;
  /** 拦截原因 (HARD_BLOCK 时) */
  blockReasons?: string[];
  /** audit checkId */
  checkId: string;
}

/**
 * 调用 4 道闸 + 返回综合裁决.
 *
 * P4 v0: 闸 ① ② 真接 (现有), 闸 ③ ④ stub (P5 完善).
 */
export async function runSkillGateway(input: SkillGatewayInput): Promise<SkillGatewayResult> {
  const checkId = `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // ① Baseline-Guard (真接现有)
  const baseline = await checkBaseline_(input);

  // ② OKR Drift Detection (真接现有)
  const okrDrift = await checkOkrDrift_(input);

  // ③ Data Scope (已升级：真接角色权限校验, MANIFESTO §19.3)
  const dataScope = await checkDataScope_(input);

  // ④ Action Scope (P4 v0: 红/黄/绿区简化判断, P5 接 ProxyAction)
  const actionScope = checkActionScope_(input);

  // 综合裁决: 任一 HARD_BLOCK = HARD_BLOCK; 任一 SOFT_WARN = SOFT_WARN
  const allVerdicts = [baseline.verdict, okrDrift.verdict, dataScope.verdict, actionScope.verdict];
  let finalVerdict: GateVerdict = 'PASS';
  if (allVerdicts.includes('HARD_BLOCK')) finalVerdict = 'HARD_BLOCK';
  else if (allVerdicts.includes('SOFT_WARN')) finalVerdict = 'SOFT_WARN';

  const blockReasons: string[] = [];
  if (baseline.verdict === 'HARD_BLOCK') blockReasons.push(...baseline.reasons);
  if (dataScope.verdict === 'HARD_BLOCK' && dataScope.reason) blockReasons.push(dataScope.reason);
  if (actionScope.zone === 'red') blockReasons.push(`Action zone=red 严禁代行 (MANIFESTO §9.2)`);

  // Audit (Steward 月度审计入口)
  try {
    await audit('skill_gateway.checked', input.actorUserId, {
      targetType: 'skill_gateway_check',
      targetId: checkId,
      metadata: {
        toolName: input.toolName,
        verdict: finalVerdict,
        baseline: baseline.verdict,
        okrDrift: okrDrift.verdict,
        dataScope: dataScope.verdict,
        actionScope: actionScope.verdict,
        actionZone: actionScope.zone,
        blockReasons,
        intent: input.intent.slice(0, 200),
      },
    });
  } catch {
    /* audit 失败不阻塞 */
  }

  return {
    verdict: finalVerdict,
    gates: { baseline, okrDrift, dataScope, actionScope },
    contextToInject: baseline.contextToInject,
    blockReasons: blockReasons.length ? blockReasons : undefined,
    checkId,
  };
}

// ---------------------------------------------------------------------------
// 闸 ① Baseline-Guard 包装
// ---------------------------------------------------------------------------

async function checkBaseline_(input: SkillGatewayInput): Promise<{
  verdict: GateVerdict;
  reasons: string[];
  contextToInject?: string;
}> {
  try {
    const { checkBaseline } = await import('../memory/baseline-guard');
    const guard = await checkBaseline({
      intent: input.intent,
      actorUserId: input.actorUserId,
      agentKind: input.agentKind,
      toolName: input.toolName,
    });
    return {
      verdict: guard.verdict as GateVerdict,
      reasons: guard.reasons,
      contextToInject: guard.contextToInject,
    };
  } catch (err) {
    return { verdict: 'PASS', reasons: [`baseline-guard 调用失败 (fail-open): ${(err as Error).message}`] };
  }
}

// ---------------------------------------------------------------------------
// 闸 ② OKR Drift 包装
// ---------------------------------------------------------------------------

async function checkOkrDrift_(input: SkillGatewayInput): Promise<{
  verdict: GateVerdict;
  driftScore?: number;
}> {
  try {
    const { checkOkrDrift } = await import('../governance/okr-drift');
    // OkrDriftInput.source 是快限定 enum, 未知场景走 'manual'
    const knownSources = ['im_persona_reply', 'company_brain_reply', 'decision_card', 'proxy_action', 'manual'] as const;
    type DriftSrc = typeof knownSources[number];
    const driftSource: DriftSrc = (knownSources as readonly string[]).includes(input.toolName)
      ? (input.toolName as DriftSrc)
      : 'manual';

    const drift = await checkOkrDrift({
      intent: input.intent,
      actorUserId: input.actorUserId,
      source: driftSource,
    });
    // checkOkrDrift 返回 OkrDriftVerdict: 'ALIGNED' | 'DRIFT_SUSPECTED' | 'NO_OKR'
    const verdict: GateVerdict =
      drift.verdict === 'DRIFT_SUSPECTED' ? 'SOFT_WARN' : 'PASS';
    return { verdict, driftScore: drift.alignmentScore };
  } catch {
    return { verdict: 'PASS' };
  }
}

// ---------------------------------------------------------------------------
// 闸 ③ Data Scope (P4 v0 stub)
// ---------------------------------------------------------------------------

async function checkDataScope_(input: SkillGatewayInput): Promise<{
  verdict: GateVerdict;
  level?: string;
  reason?: string;
}> {
  // 落地真实 RBAC 数据边界 (MANIFESTO §19.3), 判定逻辑统一收敛到 lib/auth/data-scope.ts:
  //   - 本人 personal/team 或未指定目标 → PASS
  //   - 访问他人 personal/team → 需特权角色, 否则 HARD_BLOCK
  //   - department/company → 需特权角色, 否则 HARD_BLOCK; 有权则 SOFT_WARN (敏感, 留痕注意)
  const scope = input.dataScope ?? 'personal';
  try {
    const { getStore } = await import('../storage/repository');
    const { checkDataScope } = await import('../auth/data-scope');
    const store = getStore();
    const user = await store.auth.users.findById(input.actorUserId);
    const roles: string[] = user?.roles ?? [];
    const result = checkDataScope({
      actorUserId: input.actorUserId,
      actorRoles: roles,
      level: scope,
      targetUserId: input.targetUserId,
    });
    if (!result.allowed) {
      return { verdict: 'HARD_BLOCK', level: scope, reason: result.reason };
    }
    // 部门/公司级即便放行也升 SOFT_WARN (敏感数据访问留痕提示)
    if (scope === 'company' || scope === 'department') {
      return { verdict: 'SOFT_WARN', level: scope };
    }
    return { verdict: 'PASS', level: scope };
  } catch {
    // 用户查不到 / store 故障 → fail-open 但只对个人级; 公司/部门级保守拦截
    if (scope === 'company' || scope === 'department') {
      return { verdict: 'SOFT_WARN', level: scope };
    }
    return { verdict: 'PASS', level: scope };
  }
}

// ---------------------------------------------------------------------------
// 闸 ④ Action Scope (MANIFESTO §9 三区 · C1 内容判定升级)
//
// 不再只信 caller 声明的 actionScope, 而是 deriveActionZone() 按
// 内容 + 委托级别判定 (组织主权)。声明只作下限参考。
// ---------------------------------------------------------------------------

function checkActionScope_(input: SkillGatewayInput): {
  verdict: GateVerdict;
  zone?: 'green' | 'yellow' | 'red';
} {
  const derived = deriveActionZone({
    intent: input.intent,
    declaredActionScope: input.actionScope,
    delegationLevel: input.delegationLevel,
  });
  // 红区: 对外发送 / 红线内容 / persona 越权 → 严禁代行
  if (derived.zone === 'red') {
    return { verdict: 'HARD_BLOCK', zone: 'red' };
  }
  // 黄区: 改企业数据 / 对外承诺 → 需签批 (不阻断, 注入告警)
  if (derived.zone === 'yellow') {
    return { verdict: 'SOFT_WARN', zone: 'yellow' };
  }
  // 绿区: read_only / create_draft 且内容无高敏
  return { verdict: 'PASS', zone: 'green' };
}
