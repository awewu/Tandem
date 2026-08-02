/**
 * LIP 部门考核计算 (PRD §8)
 *
 * 部门考核 = 质量50% + 效率/服务50%
 * 达成→全额, 未达→对应维度扣减/归零, 封顶 100% (部门层不设超额上浮)。
 * 纯函数。
 */

export interface DepartmentAssessmentInput {
  /** 质量达成率 0~1 */
  qualityRate: number;
  /** 效率/服务达成率 0~1 */
  efficiencyRate: number;
  /** 质量权重 (默认 0.5) */
  qualityWeight?: number;
  /** 效率权重 (默认 0.5) */
  efficiencyWeight?: number;
}

export interface DepartmentAssessmentResult {
  /** 综合考核达成率 0~1 */
  assessmentRate: number;
  /** 部门奖金基数系数 (0~1, 封顶 1) */
  coefficient: number;
  /** 是否质量维度未达 */
  qualityBelow: boolean;
  /** 是否效率维度未达 */
  efficiencyBelow: boolean;
}

/** 计算部门考核达成 → 奖金基数系数 */
export function calculateDepartmentAssessment(
  input: DepartmentAssessmentInput,
): DepartmentAssessmentResult {
  const qw = input.qualityWeight ?? 0.5;
  const ew = input.efficiencyWeight ?? 0.5;
  const q = Math.max(0, Math.min(1, input.qualityRate));
  const e = Math.max(0, Math.min(1, input.efficiencyRate));

  const assessmentRate = q * qw + e * ew;
  const coefficient = Math.min(1, assessmentRate);

  return {
    assessmentRate,
    coefficient,
    qualityBelow: q < 1,
    efficiencyBelow: e < 1,
  };
}

/** LIP 月度绩效奖金 = 部门基数 × 部门考核系数 × 个人系数(0~1.3) × 出勤率 */
export function calculateLipBonus(
  departmentBase: number,
  deptCoefficient: number,
  personalCoefficient: number,
  attendanceRate: number,
): number {
  const safePersonal = Math.min(1.3, Math.max(0, personalCoefficient));
  const safeAttendance = Math.max(0, Math.min(1, attendanceRate));
  return Math.round(departmentBase * deptCoefficient * safePersonal * safeAttendance);
}
