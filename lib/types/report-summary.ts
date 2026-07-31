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
  visibility: 'private' | 'selected' | 'public';
  viewerIds: string[];
  status: 'published';
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}
