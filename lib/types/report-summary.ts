import type { Confidence } from '@/lib/store';

export type ReportSummaryPeriodType = 'weekly' | 'monthly';

export interface ReportSummaryOkrRow {
  id: string;
  kind: 'objective' | 'kr';
  objectiveId: string;
  objectiveTitle: string;
  keyResultId?: string;
  keyResultTitle?: string;
  progress: number;
  confidence: Confidence;
  content: string;
  reportCount: number;
}

export interface KpiReviewSnapshot {
  kpiId: string;
  title: string;
  bscPerspective: string;
  scope: string;
  completion: number;
  color: string;
  monthDelta: number;
}

export interface KpiReviewBlock {
  totalKpis: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  byPerspective: Array<{
    perspective: string;
    label: string;
    count: number;
    avgCompletion: number;
  }>;
  items: KpiReviewSnapshot[];
}

export interface ReportSummary {
  id: string;
  tenantId: string;
  authorId: string;
  periodType: ReportSummaryPeriodType;
  periodKey: string;
  periodLabel: string;
  reportDate: string;
  sourceReportCount: number;
  okrRows: ReportSummaryOkrRow[];
  workSummary: string;
  okrProgress: string;
  achievements: string;
  blockers: string;
  nextPlan: string;
  supportNeeded: string;
  /** 月报专属: KPI 板块数据回顾 (BSC 四维度完成率 + 环比) */
  kpiReview?: KpiReviewBlock;
  /** 月报专属: 问题分析 (卡点归因 + 信心下滑 KR + KPI 未达根因) */
  problemAnalysis?: string;
  /** 月报专属: 未来规划 (下月重点行动 + KPI 达标路径) */
  futurePlan?: string;
  /** 月报专属: 结构化行动项清单 (负责人 + 截止日 + 优先级) */
  actionItems?: Array<{
    action: string;
    owner: string;
    deadline: string;
    priority: 'high' | 'medium' | 'low';
    relatedKpi?: string;
    relatedKr?: string;
  }>;
  visibility: 'private' | 'selected' | 'public';
  viewerIds: string[];
  status: 'published';
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}
