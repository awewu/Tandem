export type DailyReportSourceSystem = 'innovation-studio';

export interface DailyReportEntry {
  externalEntryId: string;
  krId: string | null;
  checkInId?: string | null;
  projectCode: string;
  hours: number;
  workType: string;
  content: string;
}

export interface DailyReport {
  id: string;
  tenantId: string;
  authorId: string;
  sourceSystem: DailyReportSourceSystem;
  externalReportId: string;
  reportDate: string;
  entries: DailyReportEntry[];
  createdAt: string;
  updatedAt: string;
}
