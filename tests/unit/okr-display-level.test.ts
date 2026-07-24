import { describe, expect, it } from 'vitest';
import { getOkrDisplayLevel, getOkrDisplayLevelLabel } from '@/lib/okr/display-level';

describe('OKR display level', () => {
  it('keeps imported department objectives separate from system objectives', () => {
    expect(getOkrDisplayLevel({ level: 'team', tags: ['部门', '营销部'] })).toBe('department');
    expect(getOkrDisplayLevel({ level: 'team', tags: ['体系', '营销体系'] })).toBe('system');
  });

  it('labels all imported OKR source levels', () => {
    expect(getOkrDisplayLevelLabel(getOkrDisplayLevel({ level: 'company', tags: ['公司'] }))).toBe('公司级');
    expect(getOkrDisplayLevelLabel(getOkrDisplayLevel({ level: 'team', tags: ['体系'] }))).toBe('体系级');
    expect(getOkrDisplayLevelLabel(getOkrDisplayLevel({ level: 'team', tags: ['部门'] }))).toBe('部门级');
    expect(getOkrDisplayLevelLabel(getOkrDisplayLevel({ level: 'individual', tags: ['个人'] }))).toBe('个人级');
  });
});
