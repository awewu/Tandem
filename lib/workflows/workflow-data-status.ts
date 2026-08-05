import type { WorkflowInstance, WorkflowRuntimeStatus } from '@/lib/types/workflow';

export type WorkflowDataStatus = WorkflowRuntimeStatus | 'returned';

type WorkflowStatusSource = Pick<WorkflowInstance, 'status' | 'history'>;

const APPROVAL_PROGRESS_ACTIONS = new Set([
  'task_returned',
  'task_approved',
  'admin_approved',
]);

export function getWorkflowDataStatus(instance: WorkflowStatusSource): WorkflowDataStatus {
  if (instance.status !== 'running') return instance.status;

  const latestApprovalAction = [...(instance.history || [])]
    .reverse()
    .find((item) => APPROVAL_PROGRESS_ACTIONS.has(item.action));

  return latestApprovalAction?.action === 'task_returned' ? 'returned' : 'running';
}
