/**
 * baseline-guard 单元测试
 *
 * 覆盖核心场景:
 *   - PASS: 无相关记忆
 *   - SOFT_WARN: team/dept 级别命中, 注入 contextToInject
 *   - HARD_BLOCK: company 级 + 高相似度
 *   - 可见性过滤: 跨用户的 personal memory 不可见
 *   - autonomous + dept/company 命中 → requireHumanConfirm
 *   - contextToInject 含正确的基线提示前缀
 *
 * §T15 §宪章14 - "组织记忆是员工 Agent 的方向盘, 不是建议"
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { checkBaseline } from '../../lib/memory/baseline-guard';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import type { MemoryEntry, MemoryOwnershipLevel } from '../../lib/types/memory';

beforeAll(() => {
  setStore(createInMemoryStore());
});

const ACTOR = 'user_alice';
const ACTOR_DEPT = 'dept_engineering';

async function reset() {
  const store = getStore();
  const all = await store.memories.list();
  for (const m of all) await store.memories.delete(m.id);
}

async function seedMemory(p: {
  id: string;
  title: string;
  body: string;
  ownershipLevel: MemoryOwnershipLevel;
  ownerUserId?: string;
  ownerDepartmentId?: string;
  type?: MemoryEntry['type'];
}): Promise<void> {
  const store = getStore();
  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: p.id,
    type: p.type ?? 'sop',
    title: p.title,
    body: p.body,
    status: 'active',
    signers: [],
    referenceCount: 0,
    ownershipLevel: p.ownershipLevel,
    ownerUserId: p.ownerUserId,
    ownerDepartmentId: p.ownerDepartmentId,
    createdAt: now,
    updatedAt: now,
  };
  await store.memories.create(entry);
}

describe('baseline-guard', () => {
  beforeEach(reset);

  it('PASS when no relevant memories exist', async () => {
    const guard = await checkBaseline({
      intent: 'completely unrelated task xyz',
      actorUserId: ACTOR,
      agentKind: 'skill',
    });
    expect(guard.verdict).toBe('PASS');
    expect(guard.hits).toHaveLength(0);
    expect(guard.contextToInject).toBe('');
  });

  it('SOFT_WARN when team-level memory matches actor department', async () => {
    await seedMemory({
      id: 'm-team-1',
      title: '客户投诉响应标准',
      body: '紧急客户投诉必须 1 小时内电话回访 24 小时内书面方案',
      ownershipLevel: 'team',
      ownerDepartmentId: ACTOR_DEPT,
    });
    const guard = await checkBaseline({
      intent: '紧急客户投诉处理 1 小时',
      actorUserId: ACTOR,
      actorDepartmentId: ACTOR_DEPT,
      agentKind: 'persona',
    });
    expect(guard.verdict).toBe('SOFT_WARN');
    expect(guard.hits.length).toBeGreaterThan(0);
    expect(guard.contextToInject).toContain('客户投诉响应标准');
  });

  it('HARD_BLOCK when company-level memory matches with high similarity', async () => {
    // 让 intent 跟 memory 字符高度重合, 触发 jaccard ≥ 0.45 (HARD_BLOCK 阈值)
    await seedMemory({
      id: 'm-redline',
      title: '客户数据出境',
      body: '客户数据出境严禁',
      ownershipLevel: 'company',
      type: 'redline',
    });
    const guard = await checkBaseline({
      intent: '客户数据出境',
      actorUserId: ACTOR,
      agentKind: 'autonomous',
    });
    expect(guard.verdict).toBe('HARD_BLOCK');
    expect(guard.highestHitLevel).toBe('company');
    expect(guard.reasons.join(' ')).toContain('公司级记忆');
  });

  it('visibility filter: personal memory of another user is NOT visible', async () => {
    await seedMemory({
      id: 'm-bob-personal',
      title: 'Bob 私人笔记 关于这个项目',
      body: 'Bob 私下的想法和评估, 仅供 Bob 个人参考',
      ownershipLevel: 'personal',
      ownerUserId: 'user_bob',
    });
    const guard = await checkBaseline({
      intent: 'Bob 私人笔记 关于这个项目',
      actorUserId: ACTOR, // alice, not bob
      agentKind: 'skill',
    });
    // Alice 不应该看到 Bob 的 personal memory, 即使 intent 完全匹配
    expect(guard.hits.some((h) => h.memoryId === 'm-bob-personal')).toBe(false);
  });

  it('autonomous + department-level hit → requireHumanConfirm = true', async () => {
    await seedMemory({
      id: 'm-dept-proc',
      title: '部门 OKR 提交流程',
      body: 'OKR 提交必须先经部门会议讨论 三人以上同意才上报',
      ownershipLevel: 'department',
      ownerDepartmentId: ACTOR_DEPT,
    });
    const guard = await checkBaseline({
      intent: '自动 OKR 提交流程 三人讨论',
      actorUserId: ACTOR,
      actorDepartmentId: ACTOR_DEPT,
      agentKind: 'autonomous',
    });
    // SOFT_WARN (因为不是 company 级) + 需人工确认 (因为 autonomous + dept)
    expect(guard.verdict).toBe('SOFT_WARN');
    expect(guard.requireHumanConfirm).toBe(true);
  });

  it('contextToInject has the baseline prefix when not PASS', async () => {
    await seedMemory({
      id: 'm-cr',
      title: '团队代码评审规范',
      body: '所有 PR 必须至少一人评审 CI 全过才能合并 严禁直接 push main',
      ownershipLevel: 'team',
      ownerDepartmentId: ACTOR_DEPT,
    });
    const guard = await checkBaseline({
      intent: 'PR 代码评审规范 CI 全过',
      actorUserId: ACTOR,
      actorDepartmentId: ACTOR_DEPT,
      agentKind: 'skill',
    });
    expect(guard.verdict).toBe('SOFT_WARN');
    expect(guard.contextToInject).toContain('【组织记忆基线 · 必须遵守】');
    expect(guard.contextToInject).toContain('代码评审规范');
  });

  it('company memory visible to everyone regardless of department', async () => {
    await seedMemory({
      id: 'm-co-value',
      title: '公司价值观 客户第一',
      body: '客户第一 是公司核心价值观 任何决策都需要先问客户怎么看',
      ownershipLevel: 'company',
      type: 'value',
    });
    const guard = await checkBaseline({
      intent: '客户第一 价值观 决策',
      actorUserId: 'user_random_dept', // 完全不同的部门
      actorDepartmentId: 'dept_marketing',
      agentKind: 'persona',
    });
    expect(guard.hits.some((h) => h.memoryId === 'm-co-value')).toBe(true);
  });

  it('checkId is unique and starts with bg_', async () => {
    const g1 = await checkBaseline({
      intent: 'test 1',
      actorUserId: ACTOR,
      agentKind: 'skill',
    });
    const g2 = await checkBaseline({
      intent: 'test 2',
      actorUserId: ACTOR,
      agentKind: 'skill',
    });
    expect(g1.checkId).toMatch(/^bg_/);
    expect(g2.checkId).toMatch(/^bg_/);
    expect(g1.checkId).not.toBe(g2.checkId);
  });
});
