/**
 * 360 评估 · storage 层类型
 *
 * 多源反馈: 自评 + 上级 + 平级 + 下级 + 跨部门
 * 周期化: 季度/年度发起一轮 → 选评估对象/评估人 → 收集 → 聚合
 * 隐私: peers 默认匿名 (UI 不暴露 raterId), 主管/下级实名可选
 *
 * 注意: A2.1b D6 决策 — Submission.raterId 不建索引, API 按 anonymizePeers strip.
 */

export type Review360RaterType = 'self' | 'manager' | 'peer' | 'report' | 'cross';
export type Review360CycleStatus = 'draft' | 'active' | 'closed';

export interface Review360Question {
  id: string;
  /** 维度 (业绩/协作/创新...) */
  dimension: string;
  /** 题干 */
  prompt: string;
  /** 是否要求评分 (1-5) */
  rated: boolean;
  /** 是否要求文字回答 */
  qualitative: boolean;
}

export interface Review360Cycle {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: Review360CycleStatus;
  /** Prisma 存 Json, 此处直接 typed */
  questions: Review360Question[];
  anonymizePeers: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review360Answer {
  questionId: string;
  /** 1-5 */
  score?: number;
  text?: string;
}

export interface Review360Submission {
  id: string;
  cycleId: string;
  /** 被评估人 User.id */
  subjectId: string;
  /** 评估人 User.id — UI 在 anonymizePeers=true 时不暴露给 subject */
  raterId: string;
  raterType: Review360RaterType;
  answers: Review360Answer[];
  strengths: string;
  improvements: string;
  /** 1-5 */
  overallScore: number | null;
  submittedAt: string;
}

export interface Review360Assignment {
  id: string;
  cycleId: string;
  subjectId: string;
  raterId: string;
  raterType: Review360RaterType;
  submitted: boolean;
  submittedAt: string | null;
  createdAt: string;
}
