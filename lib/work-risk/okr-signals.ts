import type { WorkRiskPerson, WorkRiskSignal } from './types';

export interface WorkRiskCycleInput {
  id: string;
  startDate: number | string;
  endDate: number | string;
  isActive?: boolean;
}

export interface WorkRiskObjectiveInput {
  id: string;
  title: string;
  cycleId: string;
  ownerId: string;
  status?: string;
  visibility?: string;
  progressOverride?: number | null;
  currentProgress?: number | null;
}

export interface WorkRiskKeyResultInput {
  id: string;
  objectiveId: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  weight?: number;
  type?: string;
  measureType?: string;
}

export interface WorkRiskInitiativeInput {
  id: string;
  title: string;
  ownerId: string;
  status?: string;
  dueDate?: number | string | null;
  priority?: string;
  keyResultId?: string;
  scope?: 'kr' | 'objective';
  scopeId?: string;
}

function severityForBand(band: 'on-track' | 'at-risk' | 'off-track'): 'high' | 'medium' | 'low' {
  if (band === 'off-track') return 'high';
  if (band === 'at-risk') return 'medium';
  return 'low';
}

function dateMs(value: number | string): number {
  return typeof value === 'number' ? value : new Date(value).getTime();
}

function isObjectiveActive(objective: WorkRiskObjectiveInput): boolean {
  return objective.status === 'active' || objective.status === undefined;
}

function canSeeOkrEvidence(viewerUserId: string, objective: WorkRiskObjectiveInput): boolean {
  if (objective.ownerId === viewerUserId) return true;
  return objective.visibility !== 'private';
}

function safeObjectiveTitle(viewerUserId: string, objective: WorkRiskObjectiveInput): string {
  return canSeeOkrEvidence(viewerUserId, objective) ? objective.title : '一个受限目标存在风险';
}

function personName(peopleById: Map<string, WorkRiskPerson>, userId: string): string {
  return peopleById.get(userId)?.name ?? userId;
}

function krProgress(kr: WorkRiskKeyResultInput): number {
  const type = kr.type ?? kr.measureType;
  if (type === 'binary') return kr.currentValue >= 1 ? 100 : 0;
  if (type === 'milestone') return Math.max(0, Math.min(100, Math.round(kr.currentValue)));
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((kr.currentValue - kr.startValue) / span) * 100)));
}

function objectiveProgress(objective: WorkRiskObjectiveInput, keyResults: WorkRiskKeyResultInput[]): number {
  if (objective.progressOverride != null) return objective.progressOverride <= 1 ? Math.round(objective.progressOverride * 100) : Math.round(objective.progressOverride);
  if (objective.currentProgress != null) return objective.currentProgress <= 1 ? Math.round(objective.currentProgress * 100) : Math.round(objective.currentProgress);
  const krs = keyResults.filter((k) => k.objectiveId === objective.id);
  if (krs.length === 0) return 0;
  const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0);
  if (totalWeight === 0) return 0;
  return Math.round(krs.reduce((sum, k) => sum + krProgress(k) * (k.weight || 1), 0) / totalWeight);
}

function scheduleRisk(input: {
  startDate: number | string;
  endDate: number | string;
  actualProgress: number;
  now: number;
}): { band: 'on-track' | 'at-risk' | 'off-track'; actualProgress: number; variance: number } {
  const startDate = dateMs(input.startDate);
  const endDate = dateMs(input.endDate);
  const span = endDate - startDate;
  const timeElapsedRatio = span <= 0 ? 1 : Math.max(0, Math.min(1, (input.now - startDate) / span));
  const expectedProgress = Math.round(timeElapsedRatio * 100);
  const actualProgress = Math.max(0, Math.min(100, Math.round(input.actualProgress)));
  const variance = expectedProgress - actualProgress;
  const band = timeElapsedRatio <= 0 ? 'on-track' : variance > 25 ? 'off-track' : variance > 10 ? 'at-risk' : 'on-track';
  return { band, actualProgress, variance };
}

export function buildOkrWorkRiskSignals(input: {
  viewerUserId: string;
  people: WorkRiskPerson[];
  cycles: WorkRiskCycleInput[];
  objectives: WorkRiskObjectiveInput[];
  keyResults: WorkRiskKeyResultInput[];
  initiatives: WorkRiskInitiativeInput[];
  now?: number;
}): WorkRiskSignal[] {
  const now = input.now ?? Date.now();
  const activeCycle = input.cycles.find((c) => c.isActive) ?? input.cycles[0];
  if (!activeCycle) return [];

  const visibleUserIds = new Set(input.people.map((p) => p.id));
  const peopleById = new Map(input.people.map((p) => [p.id, p]));
  const objectiveById = new Map(input.objectives.map((o) => [o.id, o]));
  const krById = new Map(input.keyResults.map((k) => [k.id, k]));
  const signals: WorkRiskSignal[] = [];

  for (const objective of input.objectives) {
    if (objective.cycleId !== activeCycle.id || !isObjectiveActive(objective)) continue;
    if (!visibleUserIds.has(objective.ownerId)) continue;
    const risk = scheduleRisk({
      startDate: activeCycle.startDate,
      endDate: activeCycle.endDate,
      actualProgress: objectiveProgress(objective, input.keyResults),
      now,
    });
    if (risk.band === 'on-track') continue;
    const evidenceVisible = canSeeOkrEvidence(input.viewerUserId, objective);
    const title = safeObjectiveTitle(input.viewerUserId, objective);
    signals.push({
      id: `okr:objective:${objective.id}`,
      source: 'okr',
      subjectUserId: objective.ownerId,
      subjectName: personName(peopleById, objective.ownerId),
      severity: severityForBand(risk.band),
      title,
      detail: evidenceVisible
        ? `实际进度 ${risk.actualProgress}%, 落后时间基准 ${risk.variance}%`
        : '目标详情受限, 仅纳入风险统计和责任人视图',
      href: evidenceVisible ? `/okr#obj-${objective.id}` : undefined,
      evidence: {
        visibility: evidenceVisible ? 'full' : 'restricted',
        label: evidenceVisible ? 'OKR 目标进度' : 'OKR 证据受限',
        href: evidenceVisible ? `/okr#obj-${objective.id}` : undefined,
      },
    });
  }

  for (const initiative of input.initiatives) {
    if (!visibleUserIds.has(initiative.ownerId)) continue;
    const dueDate = initiative.dueDate == null ? null : dateMs(initiative.dueDate);
    if (dueDate == null || dueDate >= now) continue;
    if (initiative.status === 'done' || initiative.status === 'cancelled') continue;

    const objective =
      initiative.scope === 'objective' && initiative.scopeId
        ? objectiveById.get(initiative.scopeId)
        : objectiveById.get(krById.get(initiative.scopeId ?? initiative.keyResultId ?? '')?.objectiveId ?? '');
    if (!objective || objective.cycleId !== activeCycle.id) continue;

    const evidenceVisible = canSeeOkrEvidence(input.viewerUserId, objective);
    signals.push({
      id: `okr:initiative:${initiative.id}`,
      source: 'okr',
      subjectUserId: initiative.ownerId,
      subjectName: personName(peopleById, initiative.ownerId),
      severity: initiative.priority === 'urgent' || initiative.priority === 'high' || initiative.priority == null ? 'high' : 'medium',
      title: evidenceVisible ? initiative.title : '一个受限行动项已逾期',
      detail: evidenceVisible
        ? `截止日期已过, 当前状态 ${initiative.status}`
        : '行动项详情受限, 仅纳入风险统计和责任人视图',
      href: evidenceVisible ? `/okr#obj-${objective.id}` : undefined,
      dueAt: new Date(dueDate).toISOString(),
      evidence: {
        visibility: evidenceVisible ? 'full' : 'restricted',
        label: evidenceVisible ? 'OKR 行动项' : 'OKR 行动项证据受限',
        href: evidenceVisible ? `/okr#obj-${objective.id}` : undefined,
      },
    });
  }

  return signals;
}
