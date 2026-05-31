/**
 * B-027 价值观锚 (Persona Constitution) 单测
 *
 * 覆盖:
 *   - addRule / archiveRule / loadActiveRules CRUD
 *   - MAX_ACTIVE_RULES 上限强制
 *   - 文本校验 (空 / 超长)
 *   - getConstitutionPromptSegment 输出格式
 *   - composePersonaSystemPrompt 硬前置位置
 *   - 归档幂等性
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  addRule,
  archiveRule,
  loadActiveRules,
  loadConstitution,
  getConstitutionPromptSegment,
} from '@/lib/persona/constitution';
import { getAuditLog } from '@/lib/audit/log';
import { composePersonaSystemPrompt } from '@/lib/persona/compose-prompt';
import { MAX_ACTIVE_RULES, MAX_RULE_TEXT_LENGTH } from '@/lib/types/persona-constitution';
import type { Persona } from '@/lib/types/persona';

beforeAll(() => setStore(createInMemoryStore()));
beforeEach(() => setStore(createInMemoryStore()));

const USER = 'user_alice';
const ACTOR = USER; // 多数情况员工本人加

const PERSONA_FIXTURE: Persona = {
  id: 'persona_a',
  userId: USER,
  schemaVersion: 'tandem.v1',
  stage: 'apprentice',
  stageEnteredAt: new Date('2026-04-01').toISOString(),
  delegationLevel: 'report_only',
  decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
  styleProfile: {
    decisionSpeed: 'medium',
    riskAppetite: 0.5,
    communicationStyle: 'analytical',
    preferredOptions: [],
    communicationExamples: [],
  },
  growthAreas: [],
  bossCaptureScore: 0,
  dataOwnership: {
    companyOwnsData: true,
    anonymizationPending: false,
    employeeCanExportOrigins: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  learningActive: true,
};

describe('B-027 · addRule', () => {
  it('从空开始添加 1 条规则, 落库可读', async () => {
    const result = await addRule({ userId: USER, text: '不在没有合同的情况下打折', addedBy: ACTOR });
    expect(result.id).toBe(USER);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].text).toBe('不在没有合同的情况下打折');
    expect(result.rules[0].addedBy).toBe(ACTOR);

    const loaded = await loadActiveRules(USER);
    expect(loaded).toHaveLength(1);
  });

  it('追加第二条规则保留前者', async () => {
    await addRule({ userId: USER, text: '规则 1', addedBy: ACTOR });
    await addRule({ userId: USER, text: '规则 2', addedBy: ACTOR });
    const active = await loadActiveRules(USER);
    expect(active.map((r) => r.text)).toEqual(['规则 1', '规则 2']);
  });

  it('达到 MAX_ACTIVE_RULES 后再加抛错', async () => {
    for (let i = 0; i < MAX_ACTIVE_RULES; i++) {
      await addRule({ userId: USER, text: `规则 ${i}`, addedBy: ACTOR });
    }
    await expect(
      addRule({ userId: USER, text: '溢出条', addedBy: ACTOR }),
    ).rejects.toThrow(/已达 active 规则上限/);
  });

  it('空文本拒绝', async () => {
    await expect(addRule({ userId: USER, text: '   ', addedBy: ACTOR })).rejects.toThrow(/不能为空/);
  });

  it('超长文本拒绝', async () => {
    const tooLong = 'x'.repeat(MAX_RULE_TEXT_LENGTH + 1);
    await expect(addRule({ userId: USER, text: tooLong, addedBy: ACTOR })).rejects.toThrow(/超长/);
  });

  it('归档后能再加新规则 (上限只算 active)', async () => {
    const cs: string[] = [];
    for (let i = 0; i < MAX_ACTIVE_RULES; i++) {
      const u = await addRule({ userId: USER, text: `规则 ${i}`, addedBy: ACTOR });
      cs.push(u.rules[i].id);
    }
    await archiveRule({ userId: USER, ruleId: cs[0], archivedBy: ACTOR, reason: '不再适用' });
    // 现在 active = 9, 应能再加 1
    const after = await addRule({ userId: USER, text: '新规则', addedBy: ACTOR });
    const active = after.rules.filter((r) => !r.archivedAt);
    expect(active).toHaveLength(MAX_ACTIVE_RULES);
  });
});

describe('B-027 · archiveRule', () => {
  it('归档后 loadActiveRules 不返回该条', async () => {
    const r = await addRule({ userId: USER, text: '规则 X', addedBy: ACTOR });
    await archiveRule({ userId: USER, ruleId: r.rules[0].id, archivedBy: ACTOR });
    const active = await loadActiveRules(USER);
    expect(active).toHaveLength(0);
    // 但 raw constitution 仍保留 (可审计)
    const raw = await loadConstitution(USER);
    expect(raw?.rules).toHaveLength(1);
    expect(raw?.rules[0].archivedAt).toBeDefined();
  });

  it('归档不存在的 ruleId 抛错', async () => {
    await addRule({ userId: USER, text: '某条', addedBy: ACTOR });
    await expect(
      archiveRule({ userId: USER, ruleId: 'nonexistent', archivedBy: ACTOR }),
    ).rejects.toThrow(/不存在/);
  });

  it('对不存在 constitution 归档抛错', async () => {
    await expect(
      archiveRule({ userId: 'no_user', ruleId: 'foo', archivedBy: ACTOR }),
    ).rejects.toThrow(/不存在/);
  });

  it('重复归档幂等 (不报错, 不重置时间)', async () => {
    const r = await addRule({ userId: USER, text: '规则', addedBy: ACTOR });
    const first = await archiveRule({ userId: USER, ruleId: r.rules[0].id, archivedBy: ACTOR });
    const firstArchivedAt = first.rules[0].archivedAt;
    const second = await archiveRule({ userId: USER, ruleId: r.rules[0].id, archivedBy: ACTOR });
    expect(second.rules[0].archivedAt).toBe(firstArchivedAt);
  });
});

describe('B-027 · getConstitutionPromptSegment', () => {
  it('空数组返回空字符串', () => {
    expect(getConstitutionPromptSegment([])).toBe('');
  });

  it('全归档返回空字符串', () => {
    const seg = getConstitutionPromptSegment([
      {
        id: 'r1',
        text: '已归档',
        addedAt: '2026-01-01',
        addedBy: ACTOR,
        archivedAt: '2026-02-01',
      },
    ]);
    expect(seg).toBe('');
  });

  it('active 规则按编号渲染, 含强语气标题', () => {
    const seg = getConstitutionPromptSegment([
      { id: 'r1', text: '不打折', addedAt: '2026-01-01', addedBy: ACTOR },
      { id: 'r2', text: '不口头承诺', addedAt: '2026-01-02', addedBy: ACTOR },
    ]);
    expect(seg).toContain('## 不可妥协原则');
    expect(seg).toContain('立即重答');
    expect(seg).toContain('1. 不打折');
    expect(seg).toContain('2. 不口头承诺');
  });

  it('混合 active + archived 只渲染 active', () => {
    const seg = getConstitutionPromptSegment([
      { id: 'r1', text: 'active 规则', addedAt: '2026-01-01', addedBy: ACTOR },
      { id: 'r2', text: '已归档规则', addedAt: '2026-01-02', addedBy: ACTOR, archivedAt: '2026-02-01' },
    ]);
    expect(seg).toContain('active 规则');
    expect(seg).not.toContain('已归档规则');
  });
});

describe('B-027 · composePersonaSystemPrompt 硬前置', () => {
  it('constitutionRules 段在 [底座] 之前 (硬前置)', () => {
    const prompt = composePersonaSystemPrompt({
      persona: PERSONA_FIXTURE,
      constitutionRules: [
        { id: 'r1', text: '永不打折', addedAt: '2026-01-01', addedBy: ACTOR },
      ],
    });
    const constIdx = prompt.indexOf('## 不可妥协原则');
    const baseIdx = prompt.indexOf('Tandem 主分身');
    expect(constIdx).toBeGreaterThanOrEqual(0);
    expect(baseIdx).toBeGreaterThan(constIdx);
  });

  it('未传 constitutionRules 时 prompt 不含原则段', () => {
    const prompt = composePersonaSystemPrompt({ persona: PERSONA_FIXTURE });
    expect(prompt).not.toContain('## 不可妥协原则');
    // 但底座仍在
    expect(prompt).toContain('Tandem 主分身');
  });

  it('constitutionRules 全归档时不污染 prompt', () => {
    const prompt = composePersonaSystemPrompt({
      persona: PERSONA_FIXTURE,
      constitutionRules: [
        {
          id: 'r1',
          text: '已归档',
          addedAt: '2026-01-01',
          addedBy: ACTOR,
          archivedAt: '2026-02-01',
        },
      ],
    });
    expect(prompt).not.toContain('## 不可妥协原则');
    expect(prompt).not.toContain('已归档');
  });
});

describe('B-027 · audit 留痕', () => {
  it('addRule + archiveRule 都写入 audit log', async () => {
    const r = await addRule({ userId: USER, text: '某规则', addedBy: ACTOR });
    await archiveRule({ userId: USER, ruleId: r.rules[0].id, archivedBy: ACTOR, reason: '过时' });

    const log = getAuditLog();
    const logs = await log.list({ targetId: USER });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('persona.constitution.rule_added');
    expect(actions).toContain('persona.constitution.rule_archived');
  });
});
