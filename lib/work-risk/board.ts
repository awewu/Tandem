import type { WorkRiskBoard, WorkRiskPerson, WorkRiskScope, WorkRiskSignal, WorkRiskSource } from './types';
import { buildApprovalWorkRiskSignals } from './approval-signals';
import { buildCalendarWorkRiskSignals } from './calendar-signals';
import { buildImWorkRiskSignals, type WorkRiskImChannelInput, type WorkRiskImMessageInput } from './im-signals';
import {
  buildOkrWorkRiskSignals,
  type WorkRiskCycleInput,
  type WorkRiskInitiativeInput,
  type WorkRiskKeyResultInput,
  type WorkRiskObjectiveInput,
} from './okr-signals';

const SOURCE_LABELS: Record<WorkRiskSource, string> = {
  okr: 'OKR / KR / 行动项',
  calendar: '日程',
  approval: '流程审批',
  im: 'IM 工作安排',
};

const SOURCE_ORDER: WorkRiskSource[] = ['okr', 'calendar', 'approval', 'im'];
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function buildWorkRiskBoard(input: {
  viewerUserId: string;
  scope: WorkRiskScope;
  allowedScopes: WorkRiskScope[];
  people: WorkRiskPerson[];
  cycles: WorkRiskCycleInput[];
  objectives: WorkRiskObjectiveInput[];
  keyResults: WorkRiskKeyResultInput[];
  initiatives: WorkRiskInitiativeInput[];
  approvals?: Parameters<typeof buildApprovalWorkRiskSignals>[0]['approvals'];
  calendarEvents?: Parameters<typeof buildCalendarWorkRiskSignals>[0]['events'];
  imChannels?: WorkRiskImChannelInput[];
  imMessages?: WorkRiskImMessageInput[];
  now?: number;
}): WorkRiskBoard {
  const generatedAt = new Date(input.now ?? Date.now()).toISOString();
  const okrSignals = buildOkrWorkRiskSignals({
    viewerUserId: input.viewerUserId,
    people: input.people,
    cycles: input.cycles,
    objectives: input.objectives,
    keyResults: input.keyResults,
    initiatives: input.initiatives,
    now: input.now,
  });
  const approvalSignals = buildApprovalWorkRiskSignals({
    viewerUserId: input.viewerUserId,
    people: input.people,
    approvals: input.approvals ?? [],
    now: input.now,
  });
  const calendarSignals = buildCalendarWorkRiskSignals({
    viewerUserId: input.viewerUserId,
    people: input.people,
    events: input.calendarEvents ?? [],
    now: input.now,
  });
  const imSignals = buildImWorkRiskSignals({
    viewerUserId: input.viewerUserId,
    people: input.people,
    channels: input.imChannels ?? [],
    messages: input.imMessages ?? [],
  });

  const signals = [...okrSignals, ...calendarSignals, ...approvalSignals, ...imSignals].sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    return a.subjectName.localeCompare(b.subjectName, 'zh-CN');
  });

  const sourceCounts = new Map<WorkRiskSource, WorkRiskSignal[]>();
  for (const source of SOURCE_ORDER) sourceCounts.set(source, []);
  for (const signal of signals) {
    sourceCounts.get(signal.source)?.push(signal);
  }

  const restrictedEvidence = signals.filter((s) => s.evidence.visibility === 'restricted').length;
  return {
    viewerUserId: input.viewerUserId,
    scope: input.scope,
    allowedScopes: input.allowedScopes,
    visiblePeople: input.people,
    generatedAt,
    summary: {
      peopleCount: input.people.length,
      signalCount: signals.length,
      high: signals.filter((s) => s.severity === 'high').length,
      medium: signals.filter((s) => s.severity === 'medium').length,
      low: signals.filter((s) => s.severity === 'low').length,
      restrictedEvidence,
    },
    sources: SOURCE_ORDER.map((source) => {
      const items = sourceCounts.get(source) ?? [];
      return {
        source,
        label: SOURCE_LABELS[source],
        signalCount: items.length,
        restrictedCount: items.filter((s) => s.evidence.visibility === 'restricted').length,
        enabled: true,
      };
    }),
    signals,
  };
}
