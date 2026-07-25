export type OkrDisplayLevel = 'company' | 'system' | 'department' | 'individual';

export interface OkrDisplayLevelSource {
  level: 'company' | 'team' | 'individual' | string;
  tags?: string[];
}

export function getOkrDisplayLevel(objective: OkrDisplayLevelSource): OkrDisplayLevel {
  if (objective.level === 'company') return 'company';
  if (objective.level === 'individual') return 'individual';

  const sourceType = objective.tags?.find((tag) => ['公司', '体系', '部门', '团队', '个人'].includes(tag));
  if (sourceType === '部门') return 'department';
  if (sourceType === '公司') return 'company';
  if (sourceType === '个人') return 'individual';
  return 'system';
}

export function getOkrDisplayLevelLabel(level: OkrDisplayLevel): string {
  if (level === 'company') return '公司级';
  if (level === 'department') return '部门级';
  if (level === 'individual') return '个人级';
  return '体系级';
}
