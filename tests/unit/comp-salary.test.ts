import { describe, it, expect } from 'vitest';
import type { SkillDef, GradeBand, CompLevel } from '../../lib/types/comp';
import {
  skillWageForLevel,
  employeeSkillWage,
  nextLevelGap,
  reconcileSkillWage,
} from '../../lib/comp/skill-wage';
import {
  composeMonthly,
  deriveAnnual,
  structureRatio,
  composeEmployeeMonthly,
  taskWageForGear,
} from '../../lib/comp/salary';

// HRBP 技能库 (取自 docs/各职能岗位技能工资对应表.xlsx)
function hrbpSkills(): SkillDef[] {
  const base = { tenantId: 'default', familyId: 'hrbp', source: '案例佐证' as const, matrixVersion: 'v1' };
  const A: CompLevel[] = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];
  const mk = (id: string, name: string, skillWage: number, requiredAt: CompLevel[]): SkillDef =>
    ({ id, name, skillWage, requiredAt, ...base });
  return [
    mk('s1', '制定人才画像', 600, A),
    mk('s2', '实施培训项目', 600, A),
    mk('s3', '独立处理劳动纠纷', 700, ['L1A', 'L2', 'L3', 'L4', 'L5']),
    mk('s4', '绩效闭环管理', 700, ['L2', 'L3', 'L4', 'L5']),
    mk('s5', '制定人才发展计划', 700, ['L3', 'L4', 'L5']),
    mk('s6', '独立牵头人才盘点', 800, ['L3', 'L4', 'L5']),
    mk('s7', '独立牵头完成组织诊断', 800, ['L4', 'L5']),
    mk('s8', '设计绩效激励', 800, ['L4', 'L5']),
    mk('s9', '独立牵头完成组织设计', 1500, ['L5']),
    mk('s10', '战略解码', 1500, ['L5']),
  ];
}

describe('skill-wage: 技能工资 = Σ 该层级必备技能定价 (§4.1 咬合)', () => {
  const skills = hrbpSkills();
  // 合计行 (薪酬总表技能工资列): L1=1200 L1A=1900 L2=2600 L3=4100 L4=5700 L5=8700
  const expected: Record<CompLevel, number> = {
    L1: 1200, L1A: 1900, L2: 2600, L3: 4100, L4: 5700, L5: 8700,
  };
  it.each(Object.entries(expected))('%s 合计 = %d', (level, sum) => {
    expect(skillWageForLevel(skills, level as CompLevel)).toBe(sum);
  });

  it('员工实得技能工资 = 仅已认证的必备技能之和', () => {
    // L3 员工只认证了 s1,s2,s3 → 600+600+700 = 1900 (未达 L3 标准 4100)
    expect(employeeSkillWage(skills, 'L3', ['s1', 's2', 's3'])).toBe(1900);
    // 全部 L3 必备认证 → 4100
    expect(employeeSkillWage(skills, 'L3', ['s1', 's2', 's3', 's4', 's5', 's6'])).toBe(4100);
  });

  it('下一级缺口: L3→L4 需补 s7,s8', () => {
    const gap = nextLevelGap(skills, 'L4', ['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(gap.map((s) => s.id).sort()).toEqual(['s7', 's8']);
  });

  it('对账: 带宽表技能工资与 Σ定价一致则 ok, 否则标异常', () => {
    expect(reconcileSkillWage(skills, 'L3', 4100).ok).toBe(true);
    const bad = reconcileSkillWage(skills, 'L3', 4000);
    expect(bad.ok).toBe(false);
    expect(bad.diff).toBe(-100);
  });
});

describe('salary: 月薪 = 基本 + 技能 + 任务 (Ⅰ类L3 = 15000)', () => {
  // 薪酬总表 Ⅰ类L3: 基本5600 + 技能4100 + 任务5300 = 15000, 年薪 180000
  it('composeMonthly + deriveAnnual', () => {
    const c = composeMonthly(5600, 4100, 5300);
    expect(c.monthly).toBe(15000);
    expect(deriveAnnual(c.monthly)).toBe(180000);
  });

  it('structureRatio 三段占比之和 = 1', () => {
    const r = structureRatio(composeMonthly(5600, 4100, 5300));
    expect(r.base + r.skill + r.task).toBeCloseTo(1, 10);
    expect(r.base).toBeCloseTo(5600 / 15000, 10);
  });

  it('任务档 A-G 取值 + 员工月薪合成(技能工资按实得覆盖)', () => {
    const band: GradeBand = {
      id: 'b1', tenantId: 'default', jobClass: 'I', level: 'L3', familyId: 'hrbp',
      education: '一般本科', experience: '5年（含）-10年',
      baseWage: 5600, skillWageCached: 4100, taskRatio: 0.3533, taskWageStd: 5300,
      skillStep: 1500, taskStep: 1700, adjustStep: 600,
      taskGears: { A: 3500, B: 4100, C: 4700, D: 5300, E: 5900, F: 6500, G: 7100 },
      title: '中级工程师', monthly: 15000, annual: 180000,
      ratio: { base: 5600 / 15000, skill: 4100 / 15000, task: 5300 / 15000 },
      matrixVersion: 'v1',
    };
    expect(taskWageForGear(band, 'D')).toBe(5300);
    expect(taskWageForGear(band, 'A')).toBe(3500);
    // 员工只认证到 1900 技能工资, 承接 A 档任务 → 5600+1900+3500 = 11000
    expect(composeEmployeeMonthly(band, 'A', 1900).monthly).toBe(11000);
    // 不覆盖 → 用带宽标准技能工资 4100, D 档 → 5600+4100+5300 = 15000
    expect(composeEmployeeMonthly(band, 'D').monthly).toBe(15000);
  });
});
