import { describe, it, expect } from 'vitest';
import type { CompLevel } from '../../lib/types/comp';
import {
  deriveFamilies,
  reviewKeySet,
  isReviewNeeded,
  expectedWageByLevel,
  type RawSkill,
} from '../../lib/comp/seed-loader';

const A: CompLevel[] = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];
const skills: RawSkill[] = [
  { board: 'HR', family: 'HRBP', name: 's1', skillWage: 600, requiredAt: A, source: '案例佐证' },
  { board: 'HR', family: 'HRBP', name: 's3', skillWage: 700, requiredAt: ['L1A', 'L2', 'L3', 'L4', 'L5'], source: '案例佐证' },
  { board: 'FIN', family: '出纳', name: 'c1', skillWage: 100, requiredAt: ['L1'], source: '案例佐证' },
];

describe('seed-loader', () => {
  it('deriveFamilies: 天花板差异化 (HRBP→L5, 出纳→仅L1)', () => {
    const fams = deriveFamilies(skills);
    const hrbp = fams.find((f) => f.family === 'HRBP')!;
    const cashier = fams.find((f) => f.family === '出纳')!;
    expect(hrbp.reachableLevels).toEqual(['L1', 'L1A', 'L2', 'L3', 'L4', 'L5']);
    expect(cashier.reachableLevels).toEqual(['L1']);
  });

  it('reviewKeySet / isReviewNeeded: 冻结对账异常项', () => {
    const set = reviewKeySet([{ family: 'EHS', level: 'L1' }, { family: '设计', level: 'L3' }]);
    expect(isReviewNeeded(set, 'EHS', 'L1')).toBe(true);
    expect(isReviewNeeded(set, 'HRBP', 'L1')).toBe(false);
  });

  it('expectedWageByLevel: 仅返回有必备技能的等级', () => {
    const hrbpSkills = skills.filter((s) => s.family === 'HRBP');
    const w = expectedWageByLevel(hrbpSkills);
    expect(w.L1).toBe(600); // 仅 s1
    expect(w.L1A).toBe(1300); // s1+s3
  });
});
