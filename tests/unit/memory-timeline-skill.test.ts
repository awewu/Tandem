/**
 * memory.timeline skill 接线测试 (Path A: 让 MAGMA-lite 时间/因果链对中央 AI LIVE)。
 *
 * 覆盖: 注册进 skillRegistry (id/schema/绿区/代行) · 感知工具集含 memory.timeline ·
 *       execute 端到端 (seed 组织记忆 → 返回时间线 + 因果边 + 摘要)。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills/registry';
import { registerBuiltinSkills } from '@/lib/taf/skills/builtin';
import { PERCEPTION_TOOLSET, accessiblePerceptionToolset } from '@/lib/persona/company-brain-perception';

const ctx = { userId: 'u1', isProxy: false, tenantId: 'default' as const };

beforeEach(() => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  registerBuiltinSkills();
});

describe('memory.timeline skill 接线', () => {
  it('已注册, 绿区, 代行允许, schema 名 memory_timeline', () => {
    const s = skillRegistry.get('memory.timeline');
    expect(s).toBeDefined();
    expect(s!.zone).toBe('green');
    expect(s!.proxyAllowed).toBe(true);
    expect(s!.schema.function.name).toBe('memory_timeline');
  });

  it('已加入中央 AI 感知工具集且可访问 (marking=internal)', () => {
    expect(PERCEPTION_TOOLSET).toContain('memory.timeline');
    expect(accessiblePerceptionToolset()).toContain('memory.timeline');
  });

  it('execute: seed 组织记忆 → 返回时间线 + 因果边 + 摘要', async () => {
    const store = getStore();
    await store.memories.create({
      id: 'm1', type: 'case', title: 'KR-7 立项', body: '围绕 KR-7 启动',
      status: 'active', ownershipLevel: 'company', referenceCount: 0,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    } as never);
    await store.memories.create({
      id: 'm2', type: 'case', title: 'KR-7 复盘', body: 'KR-7 中期复盘',
      status: 'active', ownershipLevel: 'company', referenceCount: 0,
      createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
    } as never);

    const res = await skillRegistry.execute('memory.timeline', { entityId: 'KR-7' }, ctx);
    expect(res.ok).toBe(true);
    const data = res.data as {
      entityId: string;
      summary: string;
      events: Array<{ id: string; order: number }>;
      causalLinks: Array<{ fromId: string; toId: string; kind: string }>;
    };
    expect(data.events.map((e) => e.id)).toEqual(['m1', 'm2']);
    expect(data.causalLinks.some((l) => l.kind === 'temporal_next' && l.fromId === 'm1' && l.toId === 'm2')).toBe(true);
    expect(data.summary).toMatch(/KR-7/);
  });

  it('execute: 无匹配实体 → 空事件, 仍 ok', async () => {
    const res = await skillRegistry.execute('memory.timeline', { entityId: 'KR-999' }, ctx);
    expect(res.ok).toBe(true);
    expect((res.data as { events: unknown[] }).events).toHaveLength(0);
  });
});
