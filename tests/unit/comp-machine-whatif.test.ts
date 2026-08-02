import { describe, it, expect } from 'vitest';
import type { GradeBand, SkillDef, CompLevel } from '../../lib/types/comp';
import { runSequence, step, initGradeState, DEFAULT_GRADE_CONFIG } from '../../lib/comp/grade-machine';
import { simulate } from '../../lib/comp/what-if';

describe('grade-machine: PIP 合规链 (§6.2)', () => {
  it('连续2季未达 → 改进期 + PIP告知 (不直接降薪)', () => {
    const t = runSequence(['below', 'below']);
    expect(t.history[0].state).toBe('watch');
    expect(t.history[1].state).toBe('improvement');
    expect(t.acks).toEqual([{ atIndex: 1, ack: 'PIP告知' }]);
  });

  it('改进期内仍未达 → 降职生效 (书面确认)', () => {
    const t = runSequence(['below', 'below', 'below']);
    expect(t.final.state).toBe('demotion');
    expect(t.acks.map((a) => a.ack)).toEqual(['PIP告知', '降职生效']);
  });

  it('改进期内达标 → 恢复稳定, 无降职', () => {
    const t = runSequence(['below', 'below', 'meet']);
    expect(t.final.state).toBe('stable');
    expect(t.acks.map((a) => a.ack)).toEqual(['PIP告知']);
  });

  it('偶发一次未达 → 仅观察预警, 达标即恢复', () => {
    const t = runSequence(['below', 'meet']);
    expect(t.history[0].state).toBe('watch');
    expect(t.final.state).toBe('stable');
    expect(t.acks).toEqual([]);
  });

  it('阈值可配: belowToPip=3 时 2 季未达仍不触发 PIP', () => {
    const cfg = { ...DEFAULT_GRADE_CONFIG, belowToPip: 3, improvementQuarters: 1 };
    const t = runSequence(['below', 'below'], cfg);
    expect(t.final.state).toBe('watch');
    expect(t.acks).toEqual([]);
  });
});

// ---- What-if fixtures (取自薪酬总表 Ⅰ类) ----
const A: CompLevel[] = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];
function hrbpSkills(): SkillDef[] {
  const b = { tenantId: 'default', familyId: 'hrbp', source: '案例佐证' as const, matrixVersion: 'v1' };
  const mk = (id: string, w: number, r: CompLevel[]): SkillDef => ({ id, name: id, skillWage: w, requiredAt: r, ...b });
  return [
    mk('s1', 600, A), mk('s2', 600, A),
    mk('s3', 700, ['L1A', 'L2', 'L3', 'L4', 'L5']),
    mk('s4', 700, ['L2', 'L3', 'L4', 'L5']),
    mk('s5', 700, ['L3', 'L4', 'L5']), mk('s6', 800, ['L3', 'L4', 'L5']),
    mk('s7', 800, ['L4', 'L5']), mk('s8', 800, ['L4', 'L5']),
    mk('s9', 1500, ['L5']), mk('s10', 1500, ['L5']),
  ];
}
function band(level: CompLevel, base: number, skill: number, taskStd: number, gears: number[]): GradeBand {
  const g = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
  const taskGears = Object.fromEntries(g.map((k, i) => [k, gears[i]])) as GradeBand['taskGears'];
  const monthly = base + skill + taskStd;
  return {
    id: 'b_' + level, tenantId: 'default', jobClass: 'I', level, familyId: 'hrbp',
    education: '一般本科', experience: '', baseWage: base, skillWageCached: skill,
    taskRatio: taskStd / monthly, taskWageStd: taskStd, skillStep: 0, taskStep: 0, adjustStep: 0,
    taskGears, title: '', monthly, annual: monthly * 12,
    ratio: { base: base / monthly, skill: skill / monthly, task: taskStd / monthly }, matrixVersion: 'v1',
  };
}

describe('what-if: 收入试算 (§9, 前后端同源)', () => {
  const skills = hrbpSkills();
  const L3 = band('L3', 5600, 4100, 5300, [3500, 4100, 4700, 5300, 5900, 6500, 7100]);
  const L4 = band('L4', 6600, 5700, 7000, [4900, 5600, 6300, 7000, 7700, 8400, 9100]);
  const l3Certified = ['s1', 's2', 's3', 's4', 's5', 's6']; // L3 全认证 → 4100
  const l4Certified = [...l3Certified, 's7', 's8']; // L4 全认证 → 5700

  it('换任务档 A→D: 仅 task 变化 +1800', () => {
    const r = simulate({ fromBand: L3, fromGear: 'A', toGear: 'D', skills, certifiedBefore: l3Certified });
    expect(r.breakdown).toEqual({ base: 0, skill: 0, task: 1800 });
    expect(r.delta).toBe(1800);
  });

  it('升级 L3→L4 (补认证 s7,s8, 同 D 档): 15000 → 19300, +4300', () => {
    const r = simulate({
      fromBand: L3, toBand: L4, fromGear: 'D', toGear: 'D',
      skills, certifiedBefore: l3Certified, certifiedAfter: l4Certified,
    });
    expect(r.before).toBe(15000);
    expect(r.after).toBe(19300);
    expect(r.delta).toBe(4300);
    expect(r.breakdown).toEqual({ base: 1000, skill: 1600, task: 1700 });
  });

  it('认证一项技能 s5(700) 不升级: 仅 skill +700', () => {
    const r = simulate({
      fromBand: L3, fromGear: 'D', skills,
      certifiedBefore: ['s1', 's2', 's3', 's4', 's6'], // 缺 s5 → 3400
      certifiedAfter: ['s1', 's2', 's3', 's4', 's6', 's5'], // 补 s5 → 4100
    });
    expect(r.breakdown).toEqual({ base: 0, skill: 700, task: 0 });
  });
});
