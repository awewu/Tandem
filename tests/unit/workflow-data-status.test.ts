import { describe, expect, it } from 'vitest';
import type { WorkflowHistoryItem, WorkflowRuntimeStatus } from '@/lib/types/workflow';
import { getWorkflowDataStatus } from '@/lib/workflows/workflow-data-status';

function workflow(status: WorkflowRuntimeStatus, actions: string[] = []) {
  const history: WorkflowHistoryItem[] = actions.map((action, index) => ({
    action,
    at: `2026-08-05T00:00:0${index}.000Z`,
    by: 'approver@rhenext.com',
  }));
  return { status, history };
}

describe('workflow data status', () => {
  it.each(['completed', 'rejected', 'revoked', 'cancelled'] as const)(
    'keeps the terminal status %s',
    (status) => {
      expect(getWorkflowDataStatus(workflow(status, ['task_returned']))).toBe(status);
    },
  );

  it('shows a running instance as returned when return is its latest approval action', () => {
    expect(getWorkflowDataStatus(workflow('running', ['start', 'task_returned']))).toBe('returned');
    expect(getWorkflowDataStatus(workflow('running', ['task_returned', 'admin_transfer']))).toBe('returned');
  });

  it('shows a returned instance as running after approval continues', () => {
    expect(getWorkflowDataStatus(workflow('running', ['task_returned', 'task_approved']))).toBe('running');
  });
});
