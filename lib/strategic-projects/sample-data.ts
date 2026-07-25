import officialProjects from './official-data.json';

export type StrategicProjectRisk = 'normal' | 'attention' | 'overdue';
export type StrategicProjectStatus = '进行中' | '未开始' | '已完成';
export type StrategicTaskStatus = '进行中' | '未接受' | '已取消' | '已完成';
export type StrategicMilestoneTone = 'blue' | 'yellow' | 'neutral';

export interface StrategicTask {
  id: string;
  title: string;
  priority: string;
  status: StrategicTaskStatus;
  rawStatus?: string;
  owner: string;
  ownerDepartment?: string;
  participants?: string;
  startDate?: string;
  dueDate: string;
  completedAt?: string;
  progress: number;
  latestProgress?: string;
  description?: string;
  overdueText?: string;
}

export interface StrategicMilestone {
  id: string;
  title: string;
  owner: string;
  ownerDepartment?: string;
  dueDate: string;
  progress: number;
  tone: StrategicMilestoneTone;
  tasks: StrategicTask[];
}

export interface StrategicProject {
  id: string;
  name: string;
  status: StrategicProjectStatus;
  rawStatus?: string;
  risk: StrategicProjectRisk;
  riskLabel: string;
  owner: string;
  ownerDepartment?: string;
  completion: number;
  completionText: string;
  completedTasks: number;
  totalTasks: number;
  tasksText: string;
  overdueTasks: number;
  startDate: string;
  dueDate: string;
  objective: string;
  progressChip: string;
  participants?: string;
  sourceFile?: string;
  exportInfo?: string;
  milestones: StrategicMilestone[];
}

export const strategicProjects = officialProjects as unknown as StrategicProject[];

export function findStrategicProject(id: string) {
  return strategicProjects.find((project) => project.id === id);
}
