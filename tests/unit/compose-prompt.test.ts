/**
 * composePersonaSystemPrompt · 验证 v2 命名 bug 已修复
 *
 * 历史 bug: STAGE_LABELS 用错枚举 (apprentice/journeyman/competent/expert/master),
 *   与 PersonaStage (newborn/apprentice/assistant/deputy/partner) 只 1 个交集,
 *   导致 80% 时候 LLM 收到 raw 字符串 "newborn" 而不是中文标签.
 *
 * 修复后: 从 STAGE_META 派生 → "Lv.X 上手 (X/5)" 格式.
 */

import { describe, it, expect } from 'vitest';
import { composePersonaSystemPrompt } from '@/lib/persona/compose-prompt';
import type { Persona, PersonaStage } from '@/lib/types/persona';

function makePersona(stage: PersonaStage): Persona {
  return {
    id: 'p1',
    userId: 'u1',
    schemaVersion: 'tandem.v1',
    stage,
    stageEnteredAt: new Date().toISOString(),
    delegationLevel: 'report_only',
    decisionHistory: {
      totalDecisions: 0,
      selfMade: 0,
      aiAssisted: 0,
      vetoedByUser: 0,
      vetoRate: 0,
    },
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'direct',
      preferredOptions: ['SOP', 'reasoning'],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 60,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learningActive: false,
  };
}

describe('composePersonaSystemPrompt · v2 命名 (bug 修复)', () => {
  it.each<[PersonaStage, string]>([
    ['newborn', 'Lv.1 新手 (1/5)'],
    ['apprentice', 'Lv.2 上手 (2/5)'],
    ['assistant', 'Lv.3 熟手 (3/5)'],
    ['deputy', 'Lv.4 老手 (4/5)'],
    ['partner', 'Lv.5 拿手 (5/5)'],
  ])('stage=%s → 包含 "%s"', (stage, expectedLabel) => {
    const prompt = composePersonaSystemPrompt({ persona: makePersona(stage) });
    expect(prompt).toContain(expectedLabel);
  });

  it('不再泄露 raw enum 字符串作为阶段标签', () => {
    const prompt = composePersonaSystemPrompt({ persona: makePersona('assistant') });
    // 历史 bug: 会出现 "当前进化阶段: assistant" (raw enum)
    expect(prompt).not.toMatch(/进化阶段:\s*assistant/);
    expect(prompt).not.toMatch(/进化阶段:\s*newborn/);
  });

  it('单分身一致性: 不同 mode 不切 stage', () => {
    const persona = makePersona('deputy');
    const generic = composePersonaSystemPrompt({ persona });
    const design = composePersonaSystemPrompt({ persona, mode: 'design' });
    // 两份 prompt 都含 deputy 阶段标签
    expect(generic).toContain('Lv.4 老手');
    expect(design).toContain('Lv.4 老手');
  });
});
