import type { Approval } from '@/lib/types/approval';
import type { WorkRiskPerson, WorkRiskSignal } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function personName(peopleById: Map<string, WorkRiskPerson>, userId: string): string {
  return peopleById.get(userId)?.name ?? userId;
}

function ageDays(createdAt: string, now: number): number {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now - created) / DAY_MS));
}

function canSeeApprovalEvidence(viewerUserId: string, approval: Approval): boolean {
  return approval.requester === viewerUserId || approval.approver === viewerUserId;
}

function severityForAge(days: number): 'high' | 'medium' | 'low' {
  if (days >= 3) return 'high';
  if (days >= 1) return 'medium';
  return 'low';
}

export function buildApprovalWorkRiskSignals(input: {
  viewerUserId: string;
  people: WorkRiskPerson[];
  approvals: Approval[];
  now?: number;
}): WorkRiskSignal[] {
  const now = input.now ?? Date.now();
  const visibleUserIds = new Set(input.people.map((p) => p.id));
  const peopleById = new Map(input.people.map((p) => [p.id, p]));
  const signals: WorkRiskSignal[] = [];

  for (const approval of input.approvals) {
    if (approval.status !== 'pending') continue;
    const days = ageDays(approval.createdAt, now);
    const evidenceVisible = canSeeApprovalEvidence(input.viewerUserId, approval);

    if (visibleUserIds.has(approval.approver)) {
      signals.push({
        id: `approval:approver:${approval.id}`,
        source: 'approval',
        subjectUserId: approval.approver,
        subjectName: personName(peopleById, approval.approver),
        severity: severityForAge(days),
        title: evidenceVisible ? `待审批: ${approval.title}` : '一条流程审批待处理',
        detail: evidenceVisible
          ? `${approval.type} · 已等待 ${days} 天`
          : `审批详情受限, 已等待 ${days} 天`,
        href: evidenceVisible ? `/approvals?id=${approval.id}` : undefined,
        evidence: {
          visibility: evidenceVisible ? 'full' : 'restricted',
          label: evidenceVisible ? '流程审批单' : '审批证据受限',
          href: evidenceVisible ? `/approvals?id=${approval.id}` : undefined,
        },
      });
    }

    if (visibleUserIds.has(approval.requester) && approval.requester !== approval.approver && days >= 1) {
      signals.push({
        id: `approval:requester:${approval.id}`,
        source: 'approval',
        subjectUserId: approval.requester,
        subjectName: personName(peopleById, approval.requester),
        severity: severityForAge(days),
        title: evidenceVisible ? `发起的审批卡住: ${approval.title}` : '一条发起的审批仍在等待',
        detail: evidenceVisible
          ? `审批人 ${personName(peopleById, approval.approver)} · 已等待 ${days} 天`
          : `审批详情受限, 已等待 ${days} 天`,
        href: evidenceVisible ? `/approvals?id=${approval.id}` : undefined,
        evidence: {
          visibility: evidenceVisible ? 'full' : 'restricted',
          label: evidenceVisible ? '流程审批单' : '审批证据受限',
          href: evidenceVisible ? `/approvals?id=${approval.id}` : undefined,
        },
      });
    }
  }

  return signals;
}
