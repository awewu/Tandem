export type WorkRiskSource = 'okr' | 'calendar' | 'approval' | 'im';
export type WorkRiskSeverity = 'high' | 'medium' | 'low';
export type WorkRiskScope = 'self' | 'team' | 'organization';
export type WorkRiskEvidenceVisibility = 'full' | 'restricted';

export interface WorkRiskPerson {
  id: string;
  name: string;
  departmentId?: string | null;
  managerId?: string | null;
}

export interface WorkRiskEvidence {
  visibility: WorkRiskEvidenceVisibility;
  label: string;
  href?: string;
}

export interface WorkRiskSignal {
  id: string;
  source: WorkRiskSource;
  subjectUserId: string;
  subjectName: string;
  severity: WorkRiskSeverity;
  title: string;
  detail: string;
  href?: string;
  dueAt?: string | null;
  evidence: WorkRiskEvidence;
}

export interface WorkRiskSourceSummary {
  source: WorkRiskSource;
  label: string;
  signalCount: number;
  restrictedCount: number;
  enabled: boolean;
}

export interface WorkRiskBoard {
  viewerUserId: string;
  scope: WorkRiskScope;
  allowedScopes: WorkRiskScope[];
  visiblePeople: WorkRiskPerson[];
  generatedAt: string;
  summary: {
    peopleCount: number;
    signalCount: number;
    high: number;
    medium: number;
    low: number;
    restrictedEvidence: number;
  };
  sources: WorkRiskSourceSummary[];
  signals: WorkRiskSignal[];
}
