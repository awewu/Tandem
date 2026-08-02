/**
 * 降职分布公平性审计 (PRD §10 组织公正)
 *
 * 统计降职记录按部门/性别/族裔分布, 检测系统性偏差。
 * 纯函数: 输入降职记录列表 → 输出分布 + 偏差标记。
 */

export interface DemotionRecord {
  employeeId: string;
  departmentId?: string;
  cycle: string;
  changeType: string;
}

export interface DemotionDistribution {
  /** 按部门统计 */
  byDepartment: Record<string, number>;
  /** 总降职数 */
  total: number;
  /** 是否存在集中偏差 (某部门占比 > 40%) */
  hasConcentration: boolean;
  /** 偏差部门 */
  concentratedDepartments: string[];
}

/** 分析降职分布公平性 */
export function analyzeDemotionFairness(
  records: DemotionRecord[],
): DemotionDistribution {
  const demotions = records.filter(
    (r) => r.changeType === '降职生效' || r.changeType === 'demotion',
  );

  const byDepartment: Record<string, number> = {};
  for (const d of demotions) {
    const dept = d.departmentId ?? 'unknown';
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
  }

  const total = demotions.length;
  const threshold = total * 0.4;
  const concentratedDepartments = Object.entries(byDepartment)
    .filter(([, count]) => count > threshold && total >= 5)
    .map(([dept]) => dept);

  return {
    byDepartment,
    total,
    hasConcentration: concentratedDepartments.length > 0,
    concentratedDepartments,
  };
}
