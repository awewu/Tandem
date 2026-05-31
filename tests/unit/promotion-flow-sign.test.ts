/**
 * Memory Promotion Flow · sign / reject / escalate 独立单测
 * (4 件不变量之 #4 · Memory 4 层 + 三级签批 SLA)
 *
 * 覆盖:
 *   1. propose: 三级 SLA + publicReviewUntil (标准 7 天 / 紧急 1 天)
 *   2. sign Lv1 team: team_leader + steward 双签
 *   3. sign Lv2 dept: dept_leader + steward + kr_owner 三签
 *   4. sign Lv3 company: ceo + clevel + steward 三签
 *   5. publicReviewUntil 未到 + allSigned → 仍 pending (公示期未结束)
 *   6. business_leader 兼容 → 等价 dept_leader
 *   7. 角色不在要求列表 → throw
 *   8. 已 approved/rejected 不能再签 → throw
 *   9. Steward 互斥校验 (conflict-of-interest → throw)
 *   10. reject → status=rejected
 *   11. escalateOverduePromotions: Lv1→Lv2 + escalationHistory + audit
 *   12. Lv3 SLA 过 → 不再升, notifyGovernance + 计数
 *   13. 未逾期 → 不动
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  proposePromotion,
  sign,
  reject,
  escalateOverduePromotions,
} from '@/lib/memory/promotion-flow';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { Steward } from '@/lib/types/memory';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function reset() {
  const store = getStore();
  for (const p of await store.promotions.list()) await store.promotions.delete(p.id);
  for (const m of await store.materials.list()) await store.materials.delete(m.id);
  for (const m of await store.memories.list()) await store.memories.delete(m.id);
}

async function seedSteward(userId: string, conflictWith: string[] = []): Promise<void> {
  const store = getStore();
  const s: Steward = {
    userId,
    appointedAt: new Date().toISOString(),
    appointedBy: 'ceo',
    conflictWith: conflictWith as never,
    isActive: true,
  } as Steward;
  await store.stewards.set(s);
}

async function seedMaterial(id: string): Promise<void> {
  const store = getStore();
  await store.materials.create({
    id,
    title: 'Test Material',
    sourceType: 'manual',
    extractedFrom: { type: 'manual', id: 'm1' },
    body: '材料正文',
    createdBy: 'u_alice',
    createdAt: new Date().toISOString(),
  } as never);
}

beforeEach(async () => {
  await reset();
  await seedSteward('u_steward', []);
  await seedMaterial('mat_1');
});

// ---------------------------------------------------------------------------
// 1. propose
// ---------------------------------------------------------------------------

describe('proposePromotion · SLA + publicReview', () => {
  it('Lv1 team 默认 → SLA 3 天 / publicReview 7 天', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'SOP-客户投诉',
      proposedBody: '内容',
      proposerId: 'u_alice',
      level: 'team',
    });
    expect(req.level).toBe('team');
    expect(req.status).toBe('pending');
    const slaDays = (new Date(req.slaDeadline!).getTime() - Date.now()) / 86400_000;
    expect(slaDays).toBeGreaterThan(2.9);
    expect(slaDays).toBeLessThan(3.1);
    expect(req.isEmergencyTrack).toBe(false);
  });

  it('Lv3 company → SLA 14 天', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'redline',
      proposedTitle: 'Redline-合规',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'company',
    });
    const slaDays = (new Date(req.slaDeadline!).getTime() - Date.now()) / 86400_000;
    expect(slaDays).toBeGreaterThan(13.9);
    expect(slaDays).toBeLessThan(14.1);
  });

  it('emergencyTrack=true → publicReview 1 天 (24h)', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
      isEmergencyTrack: true,
    });
    const days = (new Date(req.publicReviewUntil!).getTime() - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(0.9);
    expect(days).toBeLessThan(1.1);
    expect(req.isEmergencyTrack).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2-4. sign 三级
// ---------------------------------------------------------------------------

describe('sign · Lv1 team', () => {
  it('team_leader + steward 双签 + publicReview 已过 → approved + 物化 memory', async () => {
    // 公示期已过: 用过期 publicReviewUntil
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'SOP-1',
      proposedBody: '正文',
      proposerId: 'u_alice',
      level: 'team',
    });
    // 手动把 publicReviewUntil 改成过去
    await store.promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    await sign(req.id, 'u_team_lead', 'team_leader');
    const after2 = await sign(req.id, 'u_steward', 'steward');

    expect(after2.status).toBe('approved');
    expect(after2.signers.teamLeader?.userId).toBe('u_team_lead');
    expect(after2.signers.steward?.userId).toBe('u_steward');

    // 物化 memory 入库
    const memos = await store.memories.list();
    expect(memos.length).toBe(1);
    expect(memos[0].title).toBe('SOP-1');
    expect(memos[0].sourceMaterialId).toBe('mat_1');
  });

  it('单签 (仅 team_leader) → 仍 pending', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    const after = await sign(req.id, 'u_team_lead', 'team_leader');
    expect(after.status).toBe('pending');
    expect(after.signers.history?.length).toBe(1);
  });
});

describe('sign · Lv2 dept', () => {
  it('需要 dept_leader + steward + kr_owner 三签', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'case',
      proposedTitle: 'C2',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'dept',
    });
    await store.promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    await sign(req.id, 'u_dept', 'dept_leader');
    let after = await sign(req.id, 'u_steward', 'steward');
    expect(after.status).toBe('pending'); // 还缺 kr_owner
    after = await sign(req.id, 'u_kr', 'kr_owner');
    expect(after.status).toBe('approved');
  });

  it('business_leader 等价 dept_leader (向后兼容)', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'case',
      proposedTitle: 'C',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'dept',
    });
    await store.promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    const after = await sign(req.id, 'u_biz', 'business_leader');
    expect(after.signers.businessLeader?.userId).toBe('u_biz');
    expect(after.signers.deptLeader?.userId).toBe('u_biz'); // 写入 deptLeader 槽
  });
});

describe('sign · Lv3 company', () => {
  it('需要 ceo + clevel + steward 三签', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'redline',
      proposedTitle: 'R',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'company',
    });
    await store.promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    await sign(req.id, 'u_ceo', 'ceo');
    await sign(req.id, 'u_clevel', 'clevel');
    const after = await sign(req.id, 'u_steward', 'steward');
    expect(after.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// 5. publicReview 未到不能批准
// ---------------------------------------------------------------------------

describe('publicReview 公示期', () => {
  it('全签字但 publicReviewUntil 未到 → 仍 pending', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    // 默认 publicReviewUntil = 7 天后, 不动
    await sign(req.id, 'u_team_lead', 'team_leader');
    const after = await sign(req.id, 'u_steward', 'steward');
    expect(after.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// 6/7/8. 错误路径
// ---------------------------------------------------------------------------

describe('sign 错误路径', () => {
  it('角色不在要求列表 → throw (例: Lv1 team 不要求 ceo)', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    await expect(sign(req.id, 'u_ceo', 'ceo')).rejects.toThrow(/not required for level 'team'/);
  });

  it('已 rejected 的 promotion 再签 → throw', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    await reject(req.id, 'u_steward', '理由');
    await expect(sign(req.id, 'u_team_lead', 'team_leader')).rejects.toThrow(/not in pending/);
  });

  it('Steward 不存在 → throw', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    await expect(sign(req.id, 'u_not_steward', 'steward')).rejects.toThrow(/not a Steward/);
  });

  it('Steward 与 proposer 利益冲突 → throw', async () => {
    await seedSteward('u_conflict_steward', ['u_alice']);
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    await expect(sign(req.id, 'u_conflict_steward', 'steward')).rejects.toThrow(
      /conflict-of-interest/,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. reject
// ---------------------------------------------------------------------------

describe('reject', () => {
  it('reject → status=rejected + finalDecisionAt 写入', async () => {
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    const after = await reject(req.id, 'u_steward', '内容不准确');
    expect(after.status).toBe('rejected');
    expect(after.finalDecisionAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 11-13. escalate
// ---------------------------------------------------------------------------

describe('escalateOverduePromotions', () => {
  it('Lv1 逾期 → 升 Lv2 + escalationHistory + 重置 SLA 为 5 天', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    // 把 SLA 推到过去
    await store.promotions.update(req.id, {
      slaDeadline: new Date(Date.now() - 86400_000).toISOString(),
    });

    const r = await escalateOverduePromotions();
    expect(r.scanned).toBe(1);
    expect(r.escalated).toBe(1);
    expect(r.notifiedGovernance).toBe(0);

    const updated = await store.promotions.get(req.id);
    expect(updated!.level).toBe('dept');
    expect(updated!.escalationHistory).toHaveLength(1);
    expect(updated!.escalationHistory![0]).toMatchObject({
      fromLevel: 'team',
      toLevel: 'dept',
      reason: 'sla_overdue',
    });
    // 新 SLA 应该是约 5 天后
    const newSlaDays = (new Date(updated!.slaDeadline!).getTime() - Date.now()) / 86400_000;
    expect(newSlaDays).toBeGreaterThan(4.9);
    expect(newSlaDays).toBeLessThan(5.1);
  });

  it('Lv3 逾期 → 不再升级, 通知治理委员会 (notifyGovernance++)', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'redline',
      proposedTitle: 'R',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'company',
    });
    await store.promotions.update(req.id, {
      slaDeadline: new Date(Date.now() - 86400_000).toISOString(),
    });

    const r = await escalateOverduePromotions();
    expect(r.scanned).toBe(1);
    expect(r.escalated).toBe(0);
    expect(r.notifiedGovernance).toBe(1);

    // level 不动
    const updated = await store.promotions.get(req.id);
    expect(updated!.level).toBe('company');
  });

  it('未逾期 → 不动 (scanned=0)', async () => {
    await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    const r = await escalateOverduePromotions();
    expect(r.scanned).toBe(0);
    expect(r.escalated).toBe(0);
    expect(r.notifiedGovernance).toBe(0);
  });

  it('approved 状态的不参与 escalate (过滤)', async () => {
    const store = getStore();
    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: 'X',
      proposerId: 'u_alice',
      level: 'team',
    });
    await store.promotions.update(req.id, {
      status: 'approved',
      slaDeadline: new Date(Date.now() - 86400_000).toISOString(),
    });
    const r = await escalateOverduePromotions();
    expect(r.scanned).toBe(0);
  });
});
