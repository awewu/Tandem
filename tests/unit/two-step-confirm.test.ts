/**
 * Plan-Act Two-Step Confirm 单测
 *
 * 覆盖:
 *   1. createActionPlan 字段约束 (intent/sideEffects 上下限)
 *   2. isExpired 过期检测
 *   3. confirmPlan 仅 decisionMaker 能确认 (反 AI 代签)
 *   4. confirmPlan 状态非 pending 拒绝
 *   5. confirmPlan 过期 → status=expired
 *   6. rejectPlan 必须有 reason
 *   7. executePlan 仅 confirmed 才能执行
 *   8. executePlan 成功/失败/异常路径
 *   9. requiresTwoStepConfirm 当前全部 write 都要 confirm
 *   10. formatPlanForUser 输出格式
 */

import { describe, it, expect } from 'vitest';
import {
  createActionPlan,
  isExpired,
  confirmPlan,
  rejectPlan,
  executePlan,
  requiresTwoStepConfirm,
  formatPlanForUser,
  DEFAULT_PLAN_TTL_MS,
} from '@/lib/persona/two-step-confirm';

const baseInput = {
  initiatedBy: 'persona_boss_ai',
  decisionMakerUserId: 'u_alice',
  intent: '更新 Q3 KR 1.2 目标值',
  sideEffects: [
    {
      kind: 'okr.update' as const,
      description: 'update Q3 KR 1.2 target 100 → 105',
      rollbackHint: '24h 内可在审计链 revert',
    },
  ],
};

// ---------------------------------------------------------------------------
// 1. createActionPlan
// ---------------------------------------------------------------------------

describe('createActionPlan', () => {
  it('合法输入 → pending Plan, 默认 TTL 5min', () => {
    const before = Date.now();
    const p = createActionPlan(baseInput);
    const after = Date.now();
    expect(p.status).toBe('pending');
    expect(p.planId).toMatch(/^plan_/);
    expect(p.intent).toBe('更新 Q3 KR 1.2 目标值');
    expect(p.sideEffects).toHaveLength(1);
    const expiresAtMs = new Date(p.expiresAt).getTime();
    const proposedAtMs = new Date(p.proposedAt).getTime();
    expect(expiresAtMs - proposedAtMs).toBe(DEFAULT_PLAN_TTL_MS);
    expect(proposedAtMs).toBeGreaterThanOrEqual(before);
    expect(proposedAtMs).toBeLessThanOrEqual(after);
  });

  it('空 intent → throw', () => {
    expect(() => createActionPlan({ ...baseInput, intent: '' })).toThrow(/intent 不能为空/);
  });

  it('intent > 100 字 → throw', () => {
    expect(() => createActionPlan({ ...baseInput, intent: 'x'.repeat(101) })).toThrow(/100/);
  });

  it('sideEffects 空 → throw', () => {
    expect(() => createActionPlan({ ...baseInput, sideEffects: [] })).toThrow(/sideEffects 不能为空/);
  });

  it('sideEffects > 20 → throw', () => {
    expect(() =>
      createActionPlan({
        ...baseInput,
        sideEffects: Array.from({ length: 21 }, () => ({
          kind: 'okr.update' as const,
          description: 'x',
        })),
      }),
    ).toThrow(/20/);
  });

  it('自定义 TTL → 生效', () => {
    const p = createActionPlan({ ...baseInput, ttlMs: 60_000 });
    const diff = new Date(p.expiresAt).getTime() - new Date(p.proposedAt).getTime();
    expect(diff).toBe(60_000);
  });

  it('sideEffects 是 deep copy (调用方修改原数组不影响 plan)', () => {
    const se = [{ kind: 'okr.update' as const, description: 'orig' }];
    const p = createActionPlan({ ...baseInput, sideEffects: se });
    se[0].description = 'mutated';
    expect(p.sideEffects[0].description).toBe('orig');
  });
});

// ---------------------------------------------------------------------------
// 2. isExpired
// ---------------------------------------------------------------------------

describe('isExpired', () => {
  it('未过期 → false', () => {
    const p = createActionPlan(baseInput);
    expect(isExpired(p)).toBe(false);
  });

  it('过期 → true', () => {
    const p = createActionPlan(baseInput);
    const futureMs = Date.now() + DEFAULT_PLAN_TTL_MS + 1000;
    expect(isExpired(p, futureMs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3-5. confirmPlan
// ---------------------------------------------------------------------------

describe('confirmPlan', () => {
  it('decisionMaker 确认 → status=confirmed', () => {
    const p = createActionPlan(baseInput);
    const confirmed = confirmPlan(p, 'u_alice');
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedBy).toBe('u_alice');
    expect(confirmed.confirmedAt).toBeTruthy();
  });

  it('非 decisionMaker 确认 → throw (反 AI 代签)', () => {
    const p = createActionPlan(baseInput);
    expect(() => confirmPlan(p, 'u_bob')).toThrow(/decisionMakerUserId/);
    // 关键: AI Persona ID 也不能代签
    expect(() => confirmPlan(p, 'persona_boss_ai')).toThrow(/decisionMakerUserId/);
  });

  it('已 confirmed 的 Plan 再 confirm → throw', () => {
    const p = createActionPlan(baseInput);
    const c = confirmPlan(p, 'u_alice');
    expect(() => confirmPlan(c, 'u_alice')).toThrow(/状态 confirmed/);
  });

  it('已 rejected 的 Plan 再 confirm → throw', () => {
    const p = createActionPlan(baseInput);
    const r = rejectPlan(p, 'u_alice', '不需要改');
    expect(() => confirmPlan(r, 'u_alice')).toThrow(/状态 rejected/);
  });

  it('过期 Plan confirm → status=expired (不抛错, 但拒绝执行)', () => {
    const p = createActionPlan(baseInput);
    const futureMs = Date.now() + DEFAULT_PLAN_TTL_MS + 1000;
    const result = confirmPlan(p, 'u_alice', futureMs);
    expect(result.status).toBe('expired');
    expect(result.confirmedBy).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. rejectPlan
// ---------------------------------------------------------------------------

describe('rejectPlan', () => {
  it('decisionMaker 拒绝 + reason → status=rejected', () => {
    const p = createActionPlan(baseInput);
    const r = rejectPlan(p, 'u_alice', '目标设错了');
    expect(r.status).toBe('rejected');
    expect(r.rejectedBy).toBe('u_alice');
    expect(r.rejectionReason).toBe('目标设错了');
  });

  it('空 reason → throw', () => {
    const p = createActionPlan(baseInput);
    expect(() => rejectPlan(p, 'u_alice', '')).toThrow(/reason 不能为空/);
  });

  it('非 decisionMaker → throw', () => {
    const p = createActionPlan(baseInput);
    expect(() => rejectPlan(p, 'u_bob', '理由')).toThrow(/decisionMakerUserId/);
  });
});

// ---------------------------------------------------------------------------
// 7-8. executePlan
// ---------------------------------------------------------------------------

describe('executePlan', () => {
  it('非 confirmed 不能执行 → throw', async () => {
    const p = createActionPlan(baseInput);
    await expect(executePlan(p, async () => ({ ok: true }))).rejects.toThrow(/confirmed/);
  });

  it('confirmed → executor 返回 ok=true → status=executed', async () => {
    const p = confirmPlan(createActionPlan(baseInput), 'u_alice');
    const result = await executePlan(p, async () => ({ ok: true, data: { rows: 1 } }));
    expect(result.status).toBe('executed');
    expect(result.executionResult?.ok).toBe(true);
    expect(result.executionResult?.data).toEqual({ rows: 1 });
  });

  it('confirmed → executor 返回 ok=false → status=failed', async () => {
    const p = confirmPlan(createActionPlan(baseInput), 'u_alice');
    const result = await executePlan(p, async () => ({ ok: false, error: '权限不足' }));
    expect(result.status).toBe('failed');
    expect(result.executionResult?.error).toBe('权限不足');
  });

  it('confirmed → executor throw → 捕获为 failed', async () => {
    const p = confirmPlan(createActionPlan(baseInput), 'u_alice');
    const result = await executePlan(p, async () => {
      throw new Error('网络断开');
    });
    expect(result.status).toBe('failed');
    expect(result.executionResult?.error).toBe('网络断开');
  });
});

// ---------------------------------------------------------------------------
// 9. requiresTwoStepConfirm
// ---------------------------------------------------------------------------

describe('requiresTwoStepConfirm', () => {
  it('所有写操作都需要 confirm (当前实现)', () => {
    expect(requiresTwoStepConfirm('okr.create')).toBe(true);
    expect(requiresTwoStepConfirm('okr.update')).toBe(true);
    expect(requiresTwoStepConfirm('memory.sign')).toBe(true);
    expect(requiresTwoStepConfirm('email.send')).toBe(true);
    expect(requiresTwoStepConfirm('persona.proxy_action')).toBe(true);
    expect(requiresTwoStepConfirm('other.write')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. formatPlanForUser
// ---------------------------------------------------------------------------

describe('formatPlanForUser', () => {
  it('输出包含 planId / intent / sideEffects / 过期时间 / rollback hint', () => {
    const p = createActionPlan(baseInput);
    const md = formatPlanForUser(p);
    expect(md).toMatch(/行动计划/);
    expect(md).toMatch(/plan_/);
    expect(md).toMatch(/Q3 KR 1.2/);
    expect(md).toMatch(/okr\.update/);
    expect(md).toMatch(/24h 内可在审计链 revert/);
    expect(md).toMatch(/过期时间/);
    expect(md).toMatch(/确认执行/);
  });

  it('多个 sideEffects 都有序号', () => {
    const p = createActionPlan({
      ...baseInput,
      sideEffects: [
        { kind: 'okr.update', description: '改 KR 1' },
        { kind: 'email.send', description: '发邮件给 leader' },
        { kind: 'notification.send', description: '通知团队' },
      ],
    });
    const md = formatPlanForUser(p);
    expect(md).toMatch(/1\. `okr\.update`/);
    expect(md).toMatch(/2\. `email\.send`/);
    expect(md).toMatch(/3\. `notification\.send`/);
  });
});
