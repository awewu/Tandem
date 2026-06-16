/**
 * §G5 · deriveSigningAuthority 单测
 *
 * 验证:
 *   1. 门下省 agents → team_leader / dept_leader
 *   2. 中书省 agents (company 级) → ceo + clevel
 *   3. steward 表命中 → steward
 *   4. 无匹配 → legacy fallback (demo-user 全角色; 普通用户 [])
 *   5. template 为 null → legacy fallback
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { deriveSigningAuthority } from '@/lib/governance/signing-authority';
import type { GovernanceTemplate } from '@/lib/types/governance';

const TEMPLATE_REVIEW_ONLY: GovernanceTemplate = {
  id: 'default',
  projectId: 'default',
  tenantId: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  departments: [
    {
      id: 'menxia',
      name: '门下省',
      pillar: 'review',
      ministries: [
        { id: 'm1', name: '审议司', tag: 'review', description: '', agents: ['user-review'] },
      ],
    },
  ],
};

const TEMPLATE_FULL: GovernanceTemplate = {
  id: 'default',
  projectId: 'default',
  tenantId: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  departments: [
    {
      id: 'menxia',
      name: '门下省',
      pillar: 'review',
      ministries: [
        { id: 'm1', name: '审议司', tag: 'review', description: '', agents: ['user-review'] },
      ],
    },
    {
      id: 'zhongshu',
      name: '中书省',
      pillar: 'decision',
      ministries: [
        { id: 'm2', name: '决策司', tag: 'decision', description: '', agents: ['user-ceo'] },
      ],
    },
  ],
};

beforeAll(() => {
  setStore(createInMemoryStore());
});

describe('deriveSigningAuthority', () => {
  it('门下省 agent + team 级 → team_leader', async () => {
    const r = await deriveSigningAuthority({
      userId: 'user-review',
      level: 'team',
      template: TEMPLATE_REVIEW_ONLY,
    });
    expect(r.fromLegacy).toBe(false);
    expect(r.roles).toContain('team_leader');
    expect(r.roles).not.toContain('dept_leader');
  });

  it('门下省 agent + dept 级 → dept_leader', async () => {
    const r = await deriveSigningAuthority({
      userId: 'user-review',
      level: 'dept',
      template: TEMPLATE_REVIEW_ONLY,
    });
    expect(r.fromLegacy).toBe(false);
    expect(r.roles).toContain('dept_leader');
    expect(r.roles).not.toContain('team_leader');
  });

  it('中书省 agent + company 级 → ceo + clevel', async () => {
    const r = await deriveSigningAuthority({
      userId: 'user-ceo',
      level: 'company',
      template: TEMPLATE_FULL,
    });
    expect(r.fromLegacy).toBe(false);
    expect(r.roles).toContain('ceo');
    expect(r.roles).toContain('clevel');
  });

  it('中书省 agent + team 级 → 无 decision 角色', async () => {
    const r = await deriveSigningAuthority({
      userId: 'user-ceo',
      level: 'team',
      template: TEMPLATE_FULL,
    });
    expect(r.roles).not.toContain('ceo');
    expect(r.roles).not.toContain('clevel');
  });

  it('template=null + 普通用户 → legacy fallback 返回空', async () => {
    const r = await deriveSigningAuthority({
      userId: 'random-user-xyz',
      level: 'dept',
      template: null,
    });
    expect(r.fromLegacy).toBe(true);
    expect(r.roles).toHaveLength(0);
  });

  it('template=null + demo-user → legacy fallback 返回全角色', async () => {
    const r = await deriveSigningAuthority({
      userId: 'demo-user',
      level: 'team',
      template: null,
    });
    expect(r.fromLegacy).toBe(true);
    expect(r.roles).toContain('team_leader');
    expect(r.roles).toContain('ceo');
    expect(r.roles).toContain('steward');
  });
});
