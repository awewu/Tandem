/**
 * tests/integration/persona-evolution-event-bus.integration.test.ts
 *
 * 集成测试: Persona stage 升级 → eventBus 广播
 *
 * 覆盖:
 *   - upgradeStage(personaId, 'auto') 成功 → emit persona.stage-upgraded (auto=true)
 *   - upgradeStage(personaId, 'user') 成功 → emit persona.stage-upgraded (auto=false)
 *   - 订阅者抛错不影响主流程 (错误隔离)
 *   - scanPersonaUpgrades 静默升 (newborn→apprentice) 通过 upgradeStage 也 emit
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '@/lib/events/bus';
import { scanPersonaUpgrades, upgradeStage } from '@/lib/persona/evolution';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import type { Persona } from '@/lib/types/persona';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function seedPersona(
  id: string,
  userId: string,
  overrides: Partial<Persona> = {},
): Promise<Persona> {
  const store = getStore();
  // 让 stageEnteredAt 足够老 (60 天前) 满足 newborn 的 minDays=14
  const oldDate = new Date(Date.now() - 60 * 86400_000).toISOString();
  const persona: Persona = {
    id,
    userId,
    schemaVersion: 'tandem.v1',
    stage: 'newborn',
    stageEnteredAt: oldDate,
    delegationLevel: 'observe_only',
    decisionHistory: {
      totalDecisions: 50, // 满足 newborn minDecisions=10
      selfMade: 30,
      aiAssisted: 20,
      vetoedByUser: 5,
      vetoRate: 0.1, // 满足 maxVetoRate=0.5
    },
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'analytical',
      preferredOptions: [],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 20,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    createdAt: oldDate,
    updatedAt: oldDate,
    learningActive: true,
    enabledSkills: [],
    ...overrides,
  };
  return store.personas.create(persona);
}

async function reset() {
  const store = getStore();
  for (const p of await store.personas.list()) await store.personas.delete(p.id);
  eventBus.__clearHandlers();
  eventBus.__reset();
}

describe('integration · persona evolution → eventBus 跨域广播', () => {
  beforeEach(async () => {
    await reset();
  });

  it('upgradeStage(auto) 成功 → emit persona.stage-upgraded (auto=true)', async () => {
    const seen: Array<{
      userId: string;
      personaId: string;
      fromStage: string;
      toStage: string;
      auto: boolean;
    }> = [];
    eventBus.on('persona.stage-upgraded', (p) => {
      seen.push({
        userId: p.userId,
        personaId: p.personaId,
        fromStage: p.fromStage,
        toStage: p.toStage,
        auto: p.auto,
      });
    });

    await seedPersona('p1', 'u1');
    const after = await upgradeStage('p1', 'auto');
    expect(after.stage).toBe('apprentice');

    expect(seen).toEqual([
      {
        userId: 'u1',
        personaId: 'p1',
        fromStage: 'newborn',
        toStage: 'apprentice',
        auto: true,
      },
    ]);
  });

  it('upgradeStage(user) 成功 → emit persona.stage-upgraded (auto=false)', async () => {
    const seen: Array<{ auto: boolean }> = [];
    eventBus.on('persona.stage-upgraded', (p) => {
      seen.push({ auto: p.auto });
    });

    await seedPersona('p2', 'u2');
    await upgradeStage('p2', 'user');

    expect(seen).toEqual([{ auto: false }]);
  });

  it('订阅者抛错不影响主流程 (错误隔离 · 端到端)', async () => {
    eventBus.on('persona.stage-upgraded', () => {
      throw new Error('subscriber boom');
    });

    await seedPersona('p3', 'u3');
    // 主流程不应该抛错
    const after = await upgradeStage('p3', 'auto');
    expect(after.stage).toBe('apprentice');
  });

  it('scanPersonaUpgrades 静默升 newborn→apprentice 也 emit', async () => {
    const seen: string[] = [];
    eventBus.on('persona.stage-upgraded', (p) => {
      seen.push(`${p.fromStage}→${p.toStage}`);
    });

    await seedPersona('p4', 'u4');
    const r = await scanPersonaUpgrades();
    expect(r.autoUpgraded).toBe(1);
    expect(seen).toEqual(['newborn→apprentice']);
  });

  it('30s 内同 personaId 重复升 (理论不会发生, 但去重保护)', async () => {
    const seen: string[] = [];
    eventBus.on('persona.stage-upgraded', (p) => {
      seen.push(p.personaId);
    });

    await seedPersona('p5', 'u5');
    await upgradeStage('p5', 'auto'); // newborn → apprentice

    // 调整 stageEnteredAt 让能再升一阶 (apprentice → assistant 需 minDays=60, minDecisions=50)
    const store = getStore();
    await store.personas.update('p5', {
      stageEnteredAt: new Date(Date.now() - 200 * 86400_000).toISOString(),
      decisionHistory: {
        totalDecisions: 100,
        selfMade: 60,
        aiAssisted: 40,
        vetoedByUser: 5,
        vetoRate: 0.05,
      },
    });

    await upgradeStage('p5', 'auto'); // apprentice → assistant

    // 两次不同 toStage, 不在 dedupe 窗口 (eventId 不同), 都应该 emit
    expect(seen).toEqual(['p5', 'p5']);
  });
});
