import { describe, it, expect } from 'vitest';
import {
  canPersonaUseSkill,
  STAGE_TO_DEFAULT_SKILLS,
} from '@/lib/types/persona';

describe('Persona enabledSkills · stage-locked unlock', () => {
  it('newborn unlocks nothing', () => {
    expect(STAGE_TO_DEFAULT_SKILLS.newborn).toEqual([]);
    expect(canPersonaUseSkill({ stage: 'newborn' }, 'tti-coaching')).toBe(false);
  });

  it('apprentice unlocks only tti-coaching', () => {
    expect(canPersonaUseSkill({ stage: 'apprentice' }, 'tti-coaching')).toBe(true);
    expect(canPersonaUseSkill({ stage: 'apprentice' }, 'kpi-bonus')).toBe(false);
  });

  it('deputy unlocks 4 skills incl. kpi-bonus', () => {
    expect(canPersonaUseSkill({ stage: 'deputy' }, 'kpi-bonus')).toBe(true);
    expect(canPersonaUseSkill({ stage: 'deputy' }, 'audit-verify')).toBe(false);
  });

  it('partner unlocks audit-verify (highest tier)', () => {
    expect(canPersonaUseSkill({ stage: 'partner' }, 'audit-verify')).toBe(true);
  });

  it('explicit enabledSkills overrides stage default', () => {
    // 一个 newborn 因为某种原因被 admin 开了 tti-coaching 的特许
    expect(
      canPersonaUseSkill(
        { stage: 'newborn', enabledSkills: ['tti-coaching'] },
        'tti-coaching',
      ),
    ).toBe(true);
  });

  it('partner does not get unknown skills (closed list)', () => {
    expect(canPersonaUseSkill({ stage: 'partner' }, 'unknown-skill')).toBe(false);
  });
});
