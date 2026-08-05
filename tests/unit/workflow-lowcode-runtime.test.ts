import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore, type AuthUser } from '@/lib/storage/repository';
import {
  adminTerminateWorkflowInstance,
  adminTransferWorkflowTask,
  completeWorkflowTask,
  getWorkflowConfig,
  getWorkflowRuntimeSnapshot,
  setWorkflowConfigStatus,
  startWorkflowInstance,
  upsertWorkflowForm,
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

  it('treats a required attachment field as filled only after a file is uploaded', async () => {
    const form = await upsertWorkflowForm({
      code: 'attachment-form',
      name: '附件审批表',
      status: 'published',
      fields: [{ id: 'files', label: '附件', type: 'attachment', required: true }],
    }, admin);
    const workflow = await upsertWorkflowTemplate({
      code: 'attachment-workflow',
      name: '附件审批',
      status: 'published',
      launchMode: 'manual',
      nodeForms: [{ nodeId: 'start', formTemplateIds: [form.id], required: true }],
      assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    }, admin);

    await expect(startWorkflowInstance({
      workflowTemplateId: workflow.id,
      formTemplateId: form.id,
      formData: { files: [] },
    }, requester)).rejects.toThrow(/请填写必填字段：附件/);

    const started = await startWorkflowInstance({
      workflowTemplateId: workflow.id,
      formTemplateId: form.id,
      formData: {
        files: [{
          id: 'wf-att-test',
          name: '采购清单.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: '/api/workflows/attachments/wf-att-test',
        }],
      },
    }, requester);
    expect(started.instance.formData?.files).toEqual([expect.objectContaining({ name: '采购清单.pdf' })]);
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

  it('resolves real launch-preview people for the initiator and approval nodes', async () => {
    const snapshot = await getWorkflowRuntimeSnapshot({ ...requester, name: requester.email });
    const preview = snapshot.launchPreviews.find((item) => item.workflowTemplateId === 'wf-template-general-approval');

    expect(preview?.initiator).toMatchObject({
      id: requester.id,
      name: requester.name,
      email: requester.email,
    });
    expect(preview?.approvalNodes).toEqual([
      expect.objectContaining({
        nodeId: 'approve',
        people: [expect.objectContaining({ name: admin.name, email: admin.email })],
      }),
    ]);
  });

  it('resolves the initiator manager instead of falling back to an administrator', async () => {
    const manager = await getStore().auth.users.create({
      id: 'manager-source',
      email: 'manager@tandem.local',
      name: '直属上级',
      tenantId: 'tenant-a',
      roles: ['member'],
    });
    const employee = await getStore().auth.users.create({
      id: 'employee-source',
      email: 'employee@tandem.local',
      name: '员工',
      tenantId: 'tenant-a',
      roles: ['member'],
      managerId: manager.id,
    });
    const workflow = await upsertWorkflowTemplate({
      code: 'manager_approval',
      name: '直属上级审批',
      status: 'published',
      launchMode: 'manual',
      nodes: [
        { id: 'start', label: '发起', type: 'start' },
        { id: 'approve', label: '直属上级审批', type: 'approval', leaderLevel: 1 },
        { id: 'end', label: '结束', type: 'end' },
      ],
      assigneeRules: [{ nodeId: 'approve', mode: 'leader' }],
    }, admin);
    const employeeActor: WorkflowActor = { id: employee.id, email: employee.email, name: employee.name, tenantId: 'tenant-a', roles: ['member'] };

    const snapshot = await getWorkflowRuntimeSnapshot(employeeActor);
    const preview = snapshot.launchPreviews.find((item) => item.workflowTemplateId === workflow.id);
    expect(preview?.approvalNodes[0].people).toEqual([expect.objectContaining({ email: manager.email, name: manager.name })]);

    const started = await startWorkflowInstance({ workflowTemplateId: workflow.id }, employeeActor);
    expect(started.task?.assigneeEmail).toBe(manager.email);
  });

  it('runs all members of a system role through joint approval', async () => {
    const reviewerA = await getStore().auth.users.create({ id: 'buyer-a', email: 'buyer-a@tandem.local', name: '采购审批甲', tenantId: 'tenant-a', roles: ['buyer'] });
    const reviewerB = await getStore().auth.users.create({ id: 'buyer-b', email: 'buyer-b@tandem.local', name: '采购审批乙', tenantId: 'tenant-a', roles: ['buyer'] });
    const workflow = await upsertWorkflowTemplate({
      code: 'buyer_joint_approval',
      name: '采购角色会签',
      status: 'published',
      launchMode: 'manual',
      nodes: [
        { id: 'start', label: '发起', type: 'start' },
        { id: 'approve', label: '采购审批', type: 'approval', multiApprovalMode: 'joint', multiApprovalPercent: 100 },
        { id: 'end', label: '结束', type: 'end' },
      ],
      assigneeRules: [{ nodeId: 'approve', mode: 'role', value: 'buyer' }],
    }, admin);
    const started = await startWorkflowInstance({ workflowTemplateId: workflow.id }, requester);
    expect(started.tasks).toHaveLength(2);
    expect(started.tasks.every((task) => task.status === 'open')).toBe(true);

    const first = await completeWorkflowTask(
      { taskId: started.tasks.find((task) => task.assigneeEmail === reviewerA.email)!.id, decision: 'approved' },
      { id: reviewerA.id, email: reviewerA.email, name: reviewerA.name, tenantId: 'tenant-a', roles: ['buyer'] },
    );
    expect(first.instance.status).toBe('running');

    const second = await completeWorkflowTask(
      { taskId: started.tasks.find((task) => task.assigneeEmail === reviewerB.email)!.id, decision: 'approved' },
      { id: reviewerB.id, email: reviewerB.email, name: reviewerB.name, tenantId: 'tenant-a', roles: ['buyer'] },
    );
    expect(second.instance.status).toBe('completed');
  });

  it('runs all members of a system role in sequence when configured for sequential approval', async () => {
    const reviewerA = await getStore().auth.users.create({ id: 'sequence-a', email: 'sequence-a@tandem.local', name: '顺序审批甲', tenantId: 'tenant-a', roles: ['sequence_reviewer'] });
    const reviewerB = await getStore().auth.users.create({ id: 'sequence-b', email: 'sequence-b@tandem.local', name: '顺序审批乙', tenantId: 'tenant-a', roles: ['sequence_reviewer'] });
    const workflow = await upsertWorkflowTemplate({
      code: 'role_sequential_approval',
      name: '角色依次审批',
      status: 'published',
      launchMode: 'manual',
      nodes: [
        { id: 'start', label: '发起', type: 'start' },
        { id: 'approve', label: '角色审批', type: 'approval', multiApprovalMode: 'sequential' },
        { id: 'end', label: '结束', type: 'end' },
      ],
      assigneeRules: [{ nodeId: 'approve', mode: 'role', value: 'sequence_reviewer' }],
    }, admin);

    const started = await startWorkflowInstance({ workflowTemplateId: workflow.id }, requester);
    expect(started.tasks.map((task) => task.status)).toEqual(['open', 'queued']);

    const first = await completeWorkflowTask(
      { taskId: started.tasks[0].id, decision: 'approved' },
      { id: reviewerA.id, email: reviewerA.email, name: reviewerA.name, tenantId: 'tenant-a', roles: reviewerA.roles ?? [] },
    );
    expect(first.instance.status).toBe('running');
    expect((await getStore().workflowTasks.get(started.tasks[1].id))?.status).toBe('open');

    const second = await completeWorkflowTask(
      { taskId: started.tasks[1].id, decision: 'approved' },
      { id: reviewerB.id, email: reviewerB.email, name: reviewerB.name, tenantId: 'tenant-a', roles: reviewerB.roles ?? [] },
    );
    expect(second.instance.status).toBe('completed');
  });

  it('publishes the bound start form when publishing a workflow model', async () => {
    const form = await upsertWorkflowForm({ code: 'purchase-start', name: '采购发起表', status: 'draft', fields: [{ id: 'title', label: '标题', type: 'text', required: true }] }, admin);
    const workflow = await upsertWorkflowTemplate({
      code: 'manual-purchase',
      name: '采购申请',
      status: 'draft',
      launchMode: 'manual',
      nodeForms: [{ nodeId: 'start', formTemplateIds: [form.id], required: true }],
      assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    }, admin);

    await setWorkflowConfigStatus('workflow', workflow.id, 'published', admin);
    expect((await getWorkflowConfig('tenant-a')).forms.find((item) => item.id === form.id)?.status).toBe('published');
  });

  it('keeps legacy manual workflows launchable when their bound form is still draft', async () => {
    const form = await upsertWorkflowForm({ code: 'legacy-purchase-form', name: '采购申请表', status: 'draft', fields: [{ id: 'title', label: '采购标题', type: 'text', required: true }] }, admin);
    const workflow = await upsertWorkflowTemplate({
      code: 'legacy-manual-purchase',
      name: '采购申请',
      status: 'published',
      launchMode: 'manual',
      nodeForms: [{ nodeId: 'start', formTemplateIds: [form.id], required: true }],
      assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    }, admin);

    const snapshot = await getWorkflowRuntimeSnapshot(requester);
    expect(snapshot.workflows.map((item) => item.id)).toContain(workflow.id);
    expect(snapshot.forms.map((item) => item.id)).toContain(form.id);

    const started = await startWorkflowInstance({ workflowTemplateId: workflow.id, formTemplateId: form.id, formData: { title: '普通用户采购申请' } }, requester);
    expect(started.instance.status).toBe('running');
    expect(started.task?.assigneeEmail).toBe(admin.email);
  });

  it('does not leave a running instance behind when the first node has no approver', async () => {
    const workflow = await upsertWorkflowTemplate({
      code: 'missing_first_approver',
      name: '缺少审批人',
      status: 'published',
      launchMode: 'manual',
      assigneeRules: [{ nodeId: 'approve', mode: 'user', value: 'missing-user' }],
    }, admin);

    await expect(startWorkflowInstance({ workflowTemplateId: workflow.id }, requester)).rejects.toThrow(/未找到处理人/);
    expect(await getStore().workflowInstances.list({ tenantId: 'tenant-a' })).toHaveLength(0);
    expect(await getStore().workflowFormInstances.list({ tenantId: 'tenant-a' })).toHaveLength(0);
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
