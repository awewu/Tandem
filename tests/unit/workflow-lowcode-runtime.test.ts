import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore, type AuthUser } from '@/lib/storage/repository';
import {
  adminTerminateWorkflowInstance,
  adminTransferWorkflowTask,
  completeWorkflowTask,
  getWorkflowConfig,
  getWorkflowRuntimeSnapshot,
  startWorkflowInstance,
  upsertWorkflowTemplate,
  type WorkflowActor,
} from '@/lib/workflows/lowcode-runtime';

const requester: WorkflowActor = {
  id: 'u-requester',
  email: 'requester@tandem.local',
  name: '申请人',
  tenantId: 'tenant-a',
  roles: ['member'],
};

const admin: WorkflowActor = {
  id: 'u-admin',
  email: 'admin@tandem.local',
  name: '管理员',
  tenantId: 'tenant-a',
  roles: ['admin'],
};

const tenantBRequester: WorkflowActor = {
  ...requester,
  id: 'u-tenant-b',
  email: 'tenant-b@tandem.local',
  tenantId: 'tenant-b',
};

function user(actor: WorkflowActor, roles = actor.roles): AuthUser {
  return {
    id: actor.id,
    email: actor.email,
    name: actor.name ?? actor.email,
    roles,
    tenantId: actor.tenantId,
  };
}

beforeEach(async () => {
  setStore(createInMemoryStore());
  await getStore().auth.users.create(user(requester));
  await getStore().auth.users.create(user(admin, ['admin']));
  await getStore().auth.users.create(user(tenantBRequester));
});

describe('low-code workflow runtime', () => {
  it('exposes default form, workflow model and business binding per tenant', async () => {
    const config = await getWorkflowConfig('tenant-a');

    expect(config.forms.map((item) => item.id)).toContain('wf-form-general-approval');
    expect(config.workflows.map((item) => item.id)).toContain('wf-template-general-approval');
    expect(config.businessWorkflowBindings.map((item) => item.id)).toContain('wf-binding-general-approval-submit');
  });

  it('starts a workflow, creates an assignee task, and completes the instance', async () => {
    const started = await startWorkflowInstance({
      workflowTemplateId: 'wf-template-general-approval',
      title: '采购审批',
      formData: { title: '采购审批', type: '采购', reason: '采购热水器配件' },
    }, requester);

    expect(started.instance.status).toBe('running');
    expect(started.task?.assigneeEmail).toBe(admin.email);

    const completed = await completeWorkflowTask({
      taskId: started.task!.id,
      decision: 'approved',
      comment: '同意',
    }, admin);

    expect(completed.instance.status).toBe('completed');
    expect((await getStore().workflowTaskForms.list({ tenantId: 'tenant-a' })).map((item) => item.taskId)).toContain(started.task!.id);
  });

  it('enforces required start form fields before creating runtime records', async () => {
    await expect(startWorkflowInstance({
      workflowTemplateId: 'wf-template-general-approval',
      title: '缺字段审批',
      formData: { title: '缺字段审批' },
    }, requester)).rejects.toThrow(/请填写必填字段/);

    expect(await getStore().workflowInstances.list({ tenantId: 'tenant-a' })).toHaveLength(0);
    expect(await getStore().workflowTasks.list({ tenantId: 'tenant-a' })).toHaveLength(0);
  });

  it('scopes runtime snapshots to the actor tenant and participation', async () => {
    const tenantA = await startWorkflowInstance({
      workflowTemplateId: 'wf-template-general-approval',
      title: 'A 租户审批',
      formData: { title: 'A 租户审批', type: '其他', reason: 'A' },
    }, requester);
    const tenantB = await startWorkflowInstance({
      workflowTemplateId: 'wf-template-general-approval',
      title: 'B 租户审批',
      formData: { title: 'B 租户审批', type: '其他', reason: 'B' },
    }, tenantBRequester);

    const aSnapshot = await getWorkflowRuntimeSnapshot(requester);
    expect(aSnapshot.instances.map((item) => item.id)).toContain(tenantA.instance.id);
    expect(aSnapshot.instances.map((item) => item.id)).not.toContain(tenantB.instance.id);
  });

  it('allows workflow admins to transfer a task and terminate abnormal instances', async () => {
    await getStore().auth.users.create({
      id: 'u-reviewer',
      email: 'reviewer@tandem.local',
      name: '审批人',
      tenantId: 'tenant-a',
      roles: ['member'],
    });
    const workflow = await upsertWorkflowTemplate({
      code: 'custom_admin_transfer',
      name: '转办测试流程',
      status: 'published',
      launchMode: 'manual',
      assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    }, admin);
    const started = await startWorkflowInstance({
      workflowTemplateId: workflow.id,
      title: '需要转办的审批',
    }, requester);

    const transferred = await adminTransferWorkflowTask({
      taskId: started.task!.id,
      assigneeId: 'reviewer@tandem.local',
      reason: '原审批人休假',
    }, admin);
    expect(transferred.task.assigneeEmail).toBe('reviewer@tandem.local');

    const terminated = await adminTerminateWorkflowInstance({
      id: started.instance.id,
      reason: '测试异常终止',
    }, admin);
    expect(terminated.instance.status).toBe('cancelled');
  });

  it('preserves PLM-style node editor settings when saving a workflow model', async () => {
    const operationPermissions = {
      complete: true,
      refuse: true,
      back: true,
      transfer: false,
      delegate: false,
      addMulti: true,
      minusMulti: false,
    };
    const saved = await upsertWorkflowTemplate({
      code: 'plm_node_editor_settings',
      name: '节点配置保存测试',
      status: 'draft',
      launchMode: 'manual',
      nodes: [
        { id: 'start', label: '发起', type: 'start' },
        {
          id: 'approve',
          label: '技术审批',
          type: 'approval',
          multiApprovalMode: 'joint',
          multiApprovalPercent: 80,
          emptyAssigneeAction: 'assign',
          emptyAssigneeValue: 'u-admin',
          formPermissions: [{ fieldId: 'reason', readonly: true, required: false, hidden: false }],
          operationPermissions,
          taskListeners: [{ event: 'complete', implementation: 'workflow.audit' }],
        },
        { id: 'end', label: '结束', type: 'end' },
      ],
      assigneeRules: [{ nodeId: 'approve', mode: 'user', value: 'u-admin' }],
    }, admin);

    expect(saved.nodes[1]).toMatchObject({
      multiApprovalMode: 'joint',
      multiApprovalPercent: 80,
      emptyAssigneeAction: 'assign',
      operationPermissions,
      taskListeners: [{ event: 'complete', implementation: 'workflow.audit' }],
    });
  });

  it('enforces node operation permissions in the workflow runtime', async () => {
    const workflow = await upsertWorkflowTemplate({
      code: 'operation_permission_runtime',
      name: '操作权限运行测试',
      status: 'published',
      launchMode: 'manual',
      nodes: [
        { id: 'start', label: '发起', type: 'start' },
        {
          id: 'approve',
          label: '审批',
          type: 'approval',
          operationPermissions: {
            complete: true,
            refuse: false,
            back: false,
            transfer: false,
            delegate: false,
            addMulti: false,
            minusMulti: false,
          },
        },
        { id: 'end', label: '结束', type: 'end' },
      ],
      assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    }, admin);
    const started = await startWorkflowInstance({ workflowTemplateId: workflow.id, title: '禁止驳回的流程' }, requester);

    await expect(completeWorkflowTask({ taskId: started.task!.id, decision: 'rejected', comment: '尝试驳回' }, admin)).rejects.toThrow(/未开放此审批操作/);
    expect((await getStore().workflowTasks.get(started.task!.id))?.status).toBe('open');
  });
});
