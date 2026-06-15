/**
 * Memory Promotion Flow · Material → Memory 升级签批流 (宪章 §8.1)
 *
 * 三级签批门:
 *   Lv1 团队级 (team)    : team_leader + steward            SLA  3 工作日
 *   Lv2 部门级 (dept)    : dept_leader + steward + kr_owner SLA  5 工作日
 *   Lv3 公司级 (company) : ceo + clevel + steward            SLA 14 工作日
 *
 * 逾期机制: SLA 过且未全签 → 自动 escalate +1 级 (Lv1→Lv2→Lv3→通知 CEO+治理委员会)
 *
 * 公示期: 标准 7 天 / 紧急通道 24 小时
 */

import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import { eventBus } from '../events/bus';
import type {
  MemoryEntry,
  MemoryPromotionRequest,
  MemorySigner,
  MemorySignerRole,
  PromotionLevel,
} from '../types/memory';
import {
  PROMOTION_REQUIRED_ROLES,
  PROMOTION_SLA_DAYS,
  PROMOTION_REVIEW_DAYS,
} from '../types/memory';

const EMERGENCY_REVIEW_DAYS = 1;

/** Lv1 → Lv2 → Lv3 升序 */
const LEVEL_ORDER: PromotionLevel[] = ['team', 'dept', 'company'];

// ---------------------------------------------------------------------------
// 提议 (任何员工 → 创建 promotion request)
// ---------------------------------------------------------------------------

export interface ProposeInput {
  materialId: string;
  proposedType: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  proposedTitle: string;
  proposedBody: string;
  proposerId: string;
  /**
   * 升级级别. 默认 'team' (最低门槛, 最快通过).
   * V1 早期数据未填 → 视为 'company' (向后兼容).
   */
  level?: PromotionLevel;
  isEmergencyTrack?: boolean;
}

export async function proposePromotion(input: ProposeInput): Promise<MemoryPromotionRequest> {
  const store = getStore();
  const level = input.level ?? 'team';
  const reviewDays = input.isEmergencyTrack ? EMERGENCY_REVIEW_DAYS : PROMOTION_REVIEW_DAYS[level];
  const slaDays = PROMOTION_SLA_DAYS[level];
  const now = Date.now();

  const req = await store.promotions.create({
    materialId: input.materialId,
    proposedType: input.proposedType,
    proposedTitle: input.proposedTitle,
    proposedBody: input.proposedBody,
    status: 'pending',
    level,
    signers: { history: [] },
    slaDeadline: new Date(now + slaDays * 86400_000).toISOString(),
    publicReviewUntil: new Date(now + reviewDays * 86400_000).toISOString(),
    isEmergencyTrack: input.isEmergencyTrack ?? false,
    createdBy: input.proposerId,
    createdAt: new Date(now).toISOString(),
    escalationHistory: [],
  });

  await audit('memory.promotion_proposed', input.proposerId, {
    targetId: req.id,
    targetType: 'memory_promotion',
    metadata: { materialId: input.materialId, level },
  });

  return req;
}

// ---------------------------------------------------------------------------
// 签字 (按 role + level 校验)
// ---------------------------------------------------------------------------

export type SignerRole = MemorySignerRole;

export async function sign(
  promotionId: string,
  signerId: string,
  role: SignerRole,
  comment?: string
): Promise<MemoryPromotionRequest> {
  const store = getStore();
  const req = await store.promotions.get(promotionId);
  if (!req) throw new Error(`Promotion ${promotionId} not found`);
  if (req.status !== 'pending') {
    throw new Error(`Promotion ${promotionId} not in pending status (current: ${req.status})`);
  }

  const level = req.level ?? 'company';
  const requiredRoles = PROMOTION_REQUIRED_ROLES[level];

  // 兼容: 旧 V1 数据用 business_leader, 等价于 dept_leader
  const normalizedRole: MemorySignerRole = role === 'business_leader' ? 'dept_leader' : role;

  // normalizedRole already maps 'business_leader' → 'dept_leader' (line 107),
  // so the role-required check below is sufficient (dead-code branch removed).
  if (!requiredRoles.includes(normalizedRole)) {
    throw new Error(`Role '${role}' not required for level '${level}'. Required: ${requiredRoles.join(', ')}`);
  }

  // Steward 互斥校验
  if (normalizedRole === 'steward') {
    const steward = await store.stewards.get(signerId);
    if (!steward) throw new Error(`User ${signerId} is not a Steward`);
    if (steward.conflictWith.includes(req.createdBy as never)) {
      throw new Error(`Steward ${signerId} has conflict-of-interest with proposer`);
    }
  }

  const signer: MemorySigner = {
    userId: signerId,
    role: normalizedRole,
    signedAt: new Date().toISOString(),
    comment,
  };

  // 写入对应 key (兼容 V1 + V2)
  const newSigners = { ...req.signers };
  switch (normalizedRole) {
    case 'team_leader':
      newSigners.teamLeader = signer;
      break;
    case 'dept_leader':
      newSigners.deptLeader = signer;
      newSigners.businessLeader = signer; // 兼容
      break;
    case 'kr_owner':
      newSigners.krOwner = signer;
      break;
    case 'ceo':
      newSigners.ceo = signer;
      break;
    case 'clevel':
      newSigners.clevel = signer;
      break;
    case 'steward':
      newSigners.steward = signer;
      break;
  }
  newSigners.history = [...(newSigners.history ?? []), signer];

  // 检查是否所有要求角色已签
  const allSigned = isAllRolesSigned(newSigners, requiredRoles);
  const reviewExpired =
    !!req.publicReviewUntil && new Date(req.publicReviewUntil).getTime() < Date.now();

  // Type explicit so 'approved' is assignable (req.status was narrowed to 'pending' above).
  let status: MemoryPromotionRequest['status'] = req.status;
  if (allSigned && reviewExpired) {
    status = 'approved';
  }

  const updated = await store.promotions.update(promotionId, {
    signers: newSigners,
    status,
  });

  await audit('memory.promotion_signed', signerId, {
    targetId: promotionId,
    targetType: 'memory_promotion',
    metadata: { role: normalizedRole, level },
  });

  if (status === 'approved') {
    await materializePromotion(updated);
  }

  return updated;
}

function isAllRolesSigned(
  signers: MemoryPromotionRequest['signers'],
  required: MemorySignerRole[]
): boolean {
  for (const r of required) {
    const present =
      (r === 'team_leader' && !!signers.teamLeader) ||
      (r === 'dept_leader' && (!!signers.deptLeader || !!signers.businessLeader)) ||
      (r === 'kr_owner' && !!signers.krOwner) ||
      (r === 'ceo' && !!signers.ceo) ||
      (r === 'clevel' && !!signers.clevel) ||
      (r === 'steward' && !!signers.steward);
    if (!present) return false;
  }
  return true;
}

async function materializePromotion(req: MemoryPromotionRequest): Promise<MemoryEntry> {
  const store = getStore();
  const allSigners: MemorySigner[] = req.signers.history ?? [];

  // 闭环关键: 按签批 level 写 ownershipLevel, 否则 company-brain (只注入
  // ownershipLevel==='company') + canViewMemory 永远读不到批准的企业 Memory.
  // PromotionLevel 'dept' → MemoryOwnershipLevel 'department'; 'team'/'company' 直通.
  const level = req.level ?? 'company';
  const ownershipLevel: MemoryEntry['ownershipLevel'] =
    level === 'dept' ? 'department' : level;

  const entry = await store.memories.create({
    type: req.proposedType,
    title: req.proposedTitle,
    body: req.proposedBody,
    status: 'active',
    ownershipLevel,
    sourceMaterialId: req.materialId,
    signers: allSigners,
    referenceCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  await audit('memory.promotion_approved', 'system', {
    targetId: entry.id,
    targetType: 'memory',
    metadata: { promotionId: req.id, level: req.level ?? 'company' },
  });

  // 跨域事件广播: Persona / OKR cascade / Notification 可订阅
  try {
    const lastSigner =
      (req.signers.history ?? []).slice(-1)[0]?.userId ?? 'system';
    await eventBus.emit(
      'memory.upgraded',
      {
        memoryId: entry.id,
        promotionId: req.id,
        toLevel: req.level ?? 'company',
        approvedBy: lastSigner,
        timestamp: Date.now(),
      },
      `memory-upgraded:${entry.id}`,
    );
  } catch {
    /* event 广播错误不阫主流程 (bus 已隔离) */
  }

  // 工作流编排: 喂 workflowEngine 'memory.entry.promoted' → 唤醒 T4
  //   (company 级记忆变更 → 失效 Persona baseline 缓存 + 通知治理). 此前无人 emit → T4 死线.
  try {
    const { emit } = await import('../workflows/engine');
    await emit({
      type: 'memory.entry.promoted',
      payload: { memoryId: entry.id, level: ownershipLevel },
    });
  } catch {
    /* workflow emit 失败不阻塞 */
  }

  return entry;
}

export async function reject(promotionId: string, signerId: string, reason: string): Promise<MemoryPromotionRequest> {
  const store = getStore();
  const updated = await store.promotions.update(promotionId, {
    status: 'rejected',
    finalDecisionAt: new Date().toISOString(),
  });
  await audit('memory.promotion_rejected', signerId, {
    targetId: promotionId,
    targetType: 'memory_promotion',
    metadata: { reason },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// 公示期满兜底物化 (全签 + 公示期过 → 生效)
//
// 必要性: materializePromotion 只在 sign() 当下触发. 若所有签字都在公示期内完成,
//   之后再无 sign 事件, 提议会一直卡在 pending. 本扫描在公示期满后把"已全签待公示"
//   的提议物化生效. 与 escalateOverduePromotions 配对, boot 中本函数先跑:
//   全签的先物化生效, 再轮到升级扫描 → 永不会把"按时签完只是在等公示"的提议误升级.
//   (公示期 ≤ SLA 保证: 全签时公示期必早于 SLA 到期.)
// ---------------------------------------------------------------------------

export interface FinalizeResult {
  scanned: number;
  materialized: number;
}

export async function finalizeApprovedPromotions(): Promise<FinalizeResult> {
  const store = getStore();
  const now = Date.now();
  const pending = (await store.promotions.list()).filter((p) => p.status === 'pending');

  let materialized = 0;
  for (const req of pending) {
    const level = req.level ?? 'company';
    const requiredRoles = PROMOTION_REQUIRED_ROLES[level];
    const allSigned = isAllRolesSigned(req.signers, requiredRoles);
    const reviewExpired =
      !!req.publicReviewUntil && new Date(req.publicReviewUntil).getTime() < now;
    if (!allSigned || !reviewExpired) continue;

    const updated = await store.promotions.update(req.id, {
      status: 'approved',
      finalDecisionAt: new Date(now).toISOString(),
    });
    await materializePromotion(updated);
    materialized++;
  }

  return { scanned: pending.length, materialized };
}

// ---------------------------------------------------------------------------
// SLA 逾期自动 escalate (宪章 §8.1: 逾期 +1 级)
// ---------------------------------------------------------------------------

export interface EscalationResult {
  scanned: number;
  escalated: number;
  notifiedGovernance: number;
}

export async function escalateOverduePromotions(): Promise<EscalationResult> {
  const store = getStore();
  const now = Date.now();
  const all = await store.promotions.list();
  const overdue = all.filter(
    (p) =>
      p.status === 'pending' &&
      p.slaDeadline &&
      new Date(p.slaDeadline).getTime() < now
  );

  let escalated = 0;
  let notified = 0;

  for (const req of overdue) {
    const fromLevel = req.level ?? 'team';
    const idx = LEVEL_ORDER.indexOf(fromLevel);

    if (idx >= LEVEL_ORDER.length - 1) {
      // 已是 Lv3, 通知 CEO + 治理委员会
      await audit('memory.promotion_overdue_lv3', 'system', {
        targetId: req.id,
        targetType: 'memory_promotion',
        metadata: { reason: 'level_3_sla_breach', proposer: req.createdBy },
      });
      try {
        await eventBus.emit(
          'memory.promotion-sla-overdue',
          {
            promotionId: req.id,
            fromLevel,
            toLevel: fromLevel,
            notifiedGovernance: true,
            timestamp: now,
          },
          `promo-sla:${req.id}:lv3`,
        );
      } catch { /* isolated */ }
      notified++;
      continue;
    }

    const toLevel = LEVEL_ORDER[idx + 1];
    const newSlaDeadline = new Date(now + PROMOTION_SLA_DAYS[toLevel] * 86400_000).toISOString();
    await store.promotions.update(req.id, {
      level: toLevel,
      slaDeadline: newSlaDeadline,
      escalationHistory: [
        ...(req.escalationHistory ?? []),
        {
          fromLevel,
          toLevel,
          at: new Date(now).toISOString(),
          reason: 'sla_overdue',
        },
      ],
    });

    await audit('memory.promotion_escalated', 'system', {
      targetId: req.id,
      targetType: 'memory_promotion',
      metadata: { fromLevel, toLevel, reason: 'sla_overdue' },
    });
    try {
      await eventBus.emit(
        'memory.promotion-sla-overdue',
        {
          promotionId: req.id,
          fromLevel,
          toLevel,
          notifiedGovernance: false,
          timestamp: now,
        },
        `promo-sla:${req.id}:${toLevel}`,
      );
    } catch { /* isolated */ }
    escalated++;
  }

  return { scanned: overdue.length, escalated, notifiedGovernance: notified };
}
