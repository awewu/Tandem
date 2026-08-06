import { NextResponse } from 'next/server';
import { requireRole, type AuthContext } from '@/lib/auth/require-auth';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { listDepts, type HrDept } from '@/lib/org/departments';
import { getStore } from '@/lib/storage/repository';
import type { AuthUser, Repository } from '@/lib/storage/repository';
import type {
  BusinessFormInstance,
  BusinessWorkflowBinding,
  WorkflowAssigneeRule,
  WorkflowCc,
  WorkflowConfigStatus,
  WorkflowDecision,
  WorkflowEdge,
  WorkflowFormField,
  WorkflowFormTemplate,
  WorkflowInstance,
  WorkflowLaunchMode,
  WorkflowNode,
  WorkflowRuntimeSnapshot,
  WorkflowRuntimeStatus,
  WorkflowTask,
  WorkflowTaskForm,
  WorkflowTemplate,
} from '@/lib/types/workflow';

export type WorkflowConfigKind = 'form' | 'workflow' | 'binding';

export interface WorkflowActor {
  id: string;
  email: string;
  name?: string;
  tenantId: string;
  roles: string[];
  demo?: boolean;
}

const ADMIN_ROLES = ['owner', 'admin', 'steward'];
const CONFIG_STATUSES: WorkflowConfigStatus[] = ['draft', 'published', 'disabled'];

export function actorFromAuth(auth: AuthContext, name?: string): WorkflowActor {
  return {
    id: auth.userId,
    email: auth.email,
    name: name || auth.email,
    tenantId: auth.tenantId,
    roles: auth.roles,
    demo: auth.demo,
  };
}

export function requireWorkflowAdmin(auth: AuthContext): NextResponse | null {
  return requireRole(auth, ADMIN_ROLES);
}

export async function getWorkflowConfig(tenantId: string) {
  const repos = workflowRepos(tenantId);
  const [storedForms, storedWorkflows, storedBindings] = await Promise.all([
    repos.forms.list(),
    repos.workflows.list(),
    repos.bindings.list(),
  ]);
  const forms = mergeDefaults(storedForms, defaultForms(tenantId));
  const workflows = mergeDefaults(storedWorkflows, defaultWorkflows(tenantId));
  const bindings = mergeDefaults(storedBindings, defaultBindings(tenantId));
  return {
    forms: sortByUpdated(forms),
    workflows: sortByUpdated(workflows),
    businessWorkflowBindings: bindings.sort((a, b) => a.priority - b.priority || b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export async function upsertWorkflowForm(input: Partial<WorkflowFormTemplate>, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const now = new Date().toISOString();
  const id = clean(input.id) || `wf-form-${slug(input.code || input.name || 'form')}-${Date.now().toString(36)}`;
  const existing = await repos.forms.get(id);
  const record: WorkflowFormTemplate = {
    id,
    tenantId: actor.tenantId,
    code: slug(input.code || existing?.code || id),
    name: clean(input.name) || existing?.name || '新建表单',
    description: clean(input.description) || existing?.description,
    version: positiveInt(input.version, existing?.version ?? 1),
    status: normalizeStatus(input.status, existing?.status ?? 'draft'),
    fields: normalizeFields(input.fields ?? existing?.fields ?? []),
    createdBy: existing?.createdBy || actor.id,
    updatedBy: actor.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  validateFormTemplate(record);
  const saved = existing ? await repos.forms.update(id, record) : await repos.forms.create(record);
  await audit('workflow.form_saved', actor.id, { targetId: saved.id, targetType: 'workflow_form', tenantId: actor.tenantId });
  return saved;
}

export async function upsertWorkflowTemplate(input: Partial<WorkflowTemplate>, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const now = new Date().toISOString();
  const id = clean(input.id) || `wf-template-${slug(input.code || input.name || 'workflow')}-${Date.now().toString(36)}`;
  const existing = await repos.workflows.get(id);
  const record: WorkflowTemplate = {
    id,
    tenantId: actor.tenantId,
    code: slug(input.code || existing?.code || id),
    name: clean(input.name) || existing?.name || '新建流程',
    description: clean(input.description) || existing?.description,
    group: clean(input.group) || existing?.group || '通用流程',
    launchMode: normalizeLaunchMode(input.launchMode, existing?.launchMode ?? 'manual'),
    version: positiveInt(input.version, existing?.version ?? 1),
    status: normalizeStatus(input.status, existing?.status ?? 'draft'),
    nodes: normalizeNodes(input.nodes ?? existing?.nodes ?? defaultLinearNodes()),
    edges: normalizeEdges(input.edges ?? existing?.edges ?? defaultLinearEdges()),
    nodeForms: input.nodeForms ?? existing?.nodeForms ?? [],
    assigneeRules: normalizeAssigneeRules(input.assigneeRules ?? existing?.assigneeRules ?? [{ nodeId: 'approve', mode: 'admin' }]),
    createdBy: existing?.createdBy || actor.id,
    updatedBy: actor.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  validateWorkflowTemplate(record);
  const saved = existing ? await repos.workflows.update(id, record) : await repos.workflows.create(record);
  await audit('workflow.template_saved', actor.id, { targetId: saved.id, targetType: 'workflow_template', tenantId: actor.tenantId });
  return saved;
}

export async function upsertBusinessWorkflowBinding(input: Partial<BusinessWorkflowBinding>, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const config = await getWorkflowConfig(actor.tenantId);
  const now = new Date().toISOString();
  const businessType = slug(input.businessType || '');
  const action = slug(input.action || 'submit');
  if (!businessType) throw new Error('业务类型必填');
  if (!action) throw new Error('业务动作必填');
  const workflowTemplateId = clean(input.workflowTemplateId);
  if (!workflowTemplateId) throw new Error('流程模型必选');
  const workflow = config.workflows.find((item) => item.id === workflowTemplateId);
  if (!workflow) throw new Error('流程模型不存在');
  if (workflow.status !== 'published') throw new Error('只能绑定已发布流程模型');
  if (!['business', 'both'].includes(workflow.launchMode)) throw new Error('业务绑定只能选择 business 或 both 发起方式');
  if (!workflow.nodes.some((node) => node.type === 'approval')) throw new Error('流程模型至少需要一个审批节点');
  if (input.formTemplateId) {
    const form = config.forms.find((item) => item.id === input.formTemplateId);
    if (!form) throw new Error('表单模板不存在');
    if (form.status !== 'published') throw new Error('只能绑定已发布表单模板');
  }
  const id = clean(input.id) || `wf-binding-${businessType}-${action}`;
  const existing = await repos.bindings.get(id);
  const enabled = input.enabled !== false;
  if (enabled) {
    const duplicate = config.businessWorkflowBindings.find((item) =>
      item.id !== id &&
      item.enabled &&
      item.businessType === businessType &&
      item.action === action
    );
    if (duplicate) throw new Error('同一业务类型 + 动作只能启用一个默认绑定');
  }
  const record: BusinessWorkflowBinding = {
    id,
    tenantId: actor.tenantId,
    businessType,
    action,
    label: clean(input.label) || workflow.name,
    formTemplateId: clean(input.formTemplateId),
    workflowTemplateId,
    enabled,
    renderMode: input.renderMode === 'custom_page' ? 'custom_page' : 'dynamic_form',
    detailMode: input.detailMode === 'custom_provider' ? 'custom_provider' : 'form_data',
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 100,
    createdBy: existing?.createdBy || actor.id,
    updatedBy: actor.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const saved = existing ? await repos.bindings.update(id, record) : await repos.bindings.create(record);
  await audit('workflow.binding_saved', actor.id, { targetId: saved.id, targetType: 'workflow_binding', tenantId: actor.tenantId });
  return saved;
}

export async function setWorkflowConfigStatus(kind: WorkflowConfigKind, id: string, status: WorkflowConfigStatus, actor: WorkflowActor) {
  if (!CONFIG_STATUSES.includes(status)) throw new Error('配置状态无效');
  if (kind === 'form') return upsertWorkflowForm({ ...(await getRequired(workflowRepos(actor.tenantId).forms, id, '表单')), status }, actor);
  if (kind === 'workflow') {
    const workflow = await getRequired(workflowRepos(actor.tenantId).workflows, id, '流程模型');
    if (status === 'published') {
      const formIds = Array.from(new Set(workflow.nodeForms.flatMap((binding) => binding.formTemplateIds)));
      await Promise.all(formIds.map(async (formId) => {
        const form = await workflowRepos(actor.tenantId).forms.get(formId);
        if (form && form.status !== 'published') await upsertWorkflowForm({ ...form, status: 'published' }, actor);
      }));
    }
    return upsertWorkflowTemplate({ ...workflow, status }, actor);
  }
  const binding = await getRequired(workflowRepos(actor.tenantId).bindings, id, '业务绑定');
  return upsertBusinessWorkflowBinding({ ...binding, enabled: status !== 'disabled' }, actor);
}

export async function getWorkflowRuntimeSnapshot(actor: WorkflowActor): Promise<WorkflowRuntimeSnapshot> {
  const repos = workflowRepos(actor.tenantId);
  const canManageWorkflows = actor.demo || actor.roles.some((role) => ADMIN_ROLES.includes(role));
  const [instancesRaw, tasksRaw, ccsRaw, taskForms, config, directoryUsers] = await Promise.all([
    repos.instances.list(),
    repos.tasks.list(),
    repos.ccs.list(),
    repos.taskForms.list(),
    getWorkflowConfig(actor.tenantId),
    usersForTenant(actor.tenantId),
  ]);
  const actorUser = findWorkflowIdentity(directoryUsers, actor.id, actor.email);
  const launchActor = { ...actor, name: actorUser?.name || actor.name };
  const instanceById = new Map(instancesRaw.map((item) => [item.id, item]));
  const tasks = tasksRaw.map((task) => enrichTask(task, instanceById.get(task.instanceId)));
  const myStarted = instancesRaw.filter((item) => item.initiatorId === actor.id || sameEmail(item.initiatorEmail, actor.email));
  const myTodo = tasks.filter((item) => item.status === 'open' && (item.assigneeId === actor.id || sameEmail(item.assigneeEmail, actor.email)));
  const myCc = ccsRaw.filter((item) => item.receiverId === actor.id || sameEmail(item.receiverEmail, actor.email));
  const participantIds = new Set<string>();
  myStarted.forEach((item) => participantIds.add(item.id));
  tasks
    .filter((item) =>
      item.assigneeId === actor.id ||
      sameEmail(item.assigneeEmail, actor.email) ||
      item.completedById === actor.id ||
      sameEmail(item.completedByEmail, actor.email)
    )
    .forEach((item) => participantIds.add(item.instanceId));
  myCc.forEach((item) => participantIds.add(item.instanceId));
  const instances = canManageWorkflows ? instancesRaw : instancesRaw.filter((item) => participantIds.has(item.id));
  const visibleTasks = canManageWorkflows ? tasks : tasks.filter((item) => participantIds.has(item.instanceId));
  const workflows = config.workflows.filter((item) => item.status === 'published' && ['manual', 'both'].includes(item.launchMode));
  const launchFormIds = new Set(workflows.flatMap((workflow) => workflow.nodeForms.flatMap((binding) => binding.formTemplateIds)));
  const needsDepartments = workflows.some((workflow) => workflow.assigneeRules.some((rule) => rule.mode === 'orgLeader'));
  const directory = {
    users: directoryUsers,
    departments: needsDepartments ? await listDepts(actor.tenantId) : [],
  };
  const launchPreviews = await Promise.all(workflows.map(async (workflow) => ({
    workflowTemplateId: workflow.id,
    initiator: { id: launchActor.id, email: launchActor.email, name: launchActor.name },
    approvalNodes: await Promise.all(workflow.nodes
      .filter((node) => node.type === 'approval')
      .map(async (node) => {
        const rule = workflow.assigneeRules.find((item) => item.nodeId === node.id) || { nodeId: node.id, mode: 'admin' as const };
        return {
          nodeId: node.id,
          nodeLabel: node.label,
          mode: rule.mode,
          value: rule.value,
          people: await resolveAssignees(workflow, node, launchActor, {
            initiatorId: launchActor.id,
            initiatorEmail: launchActor.email,
            initiatorName: launchActor.name,
            formData: {},
            runtimeAssignees: {},
          }, directory),
        };
      })),
  })));
  return {
    instances: sortByUpdated(instances),
    myStarted: sortByUpdated(myStarted),
    myTodo: sortByUpdated(myTodo),
    myCc: myCc.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    visibleTasks,
    taskForms: canManageWorkflows ? taskForms : taskForms.filter((item) => participantIds.has(item.instanceId)),
    workflows,
    forms: config.forms.filter((item) => item.status === 'published' || launchFormIds.has(item.id)),
    launchPreviews,
    canManageWorkflows,
  };
}

export async function startWorkflowInstance(input: {
  workflowTemplateId?: string;
  title?: string;
  formTemplateId?: string;
  formData?: Record<string, unknown>;
  businessType?: string;
  businessId?: string;
  businessAction?: string;
  launchSource?: 'manual' | 'business';
  runtimeAssignees?: Record<string, string | string[]>;
}, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const config = await getWorkflowConfig(actor.tenantId);
  const workflow = resolveStartWorkflow(input, config.workflows, config.businessWorkflowBindings);
  const launchSource = input.launchSource === 'business' || input.businessType ? 'business' : 'manual';
  if (workflow.status !== 'published') throw new Error('只能发起已发布流程');
  if (launchSource === 'manual' && !['manual', 'both'].includes(workflow.launchMode)) throw new Error('该流程只能由业务页面发起');
  if (launchSource === 'business' && !['business', 'both'].includes(workflow.launchMode)) throw new Error('该流程不允许业务发起');

  const formTemplate = input.formTemplateId
    ? config.forms.find((item) => item.id === input.formTemplateId)
    : workflow.nodeForms[0]?.formTemplateIds[0]
      ? config.forms.find((item) => item.id === workflow.nodeForms[0].formTemplateIds[0])
      : undefined;
  const formData = cloneJson(input.formData || {});
  if (formTemplate) validateFormData(formTemplate, formData);
  const now = new Date().toISOString();
  const firstNode = firstRuntimeNode(workflow);
  const instanceId = `wf-inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const instance: WorkflowInstance = {
    id: instanceId,
    tenantId: actor.tenantId,
    code: `WF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`,
    title: clean(input.title) || `${workflow.name} - ${actor.name || actor.email}`,
    workflowTemplateId: workflow.id,
    workflowName: workflow.name,
    workflowCode: workflow.code,
    workflowVersion: workflow.version,
    workflowSnapshot: cloneJson(workflow),
    status: firstNode ? 'running' : 'completed',
    currentNodeId: firstNode?.id,
    currentNodeLabel: firstNode?.label,
    initiatorId: actor.id,
    initiatorEmail: actor.email,
    initiatorName: actor.name,
    businessType: slug(input.businessType || ''),
    businessId: clean(input.businessId),
    businessAction: slug(input.businessAction || ''),
    launchSource,
    formTemplateId: formTemplate?.id,
    formData,
    runtimeAssignees: cloneJson(input.runtimeAssignees || {}),
    createdAt: now,
    updatedAt: now,
    completedAt: firstNode ? undefined : now,
    history: [{ at: now, action: 'start', by: actor.email, note: launchSource === 'business' ? '业务动作发起流程' : '手工发起流程', nodeId: firstNode?.id, nodeLabel: firstNode?.label }],
  };

  let formInstance: BusinessFormInstance | null = null;
  if (formTemplate) {
    formInstance = await repos.formInstances.create({
      tenantId: actor.tenantId,
      businessType: instance.businessType || 'manual',
      action: instance.businessAction || 'submit',
      businessId: instance.businessId || instance.id,
      title: instance.title,
      formTemplateId: formTemplate.id,
      formTemplateVersion: formTemplate.version,
      formSnapshot: cloneJson(formTemplate),
      formData,
      status: firstNode ? 'in_review' : 'approved',
      workflowInstanceId: instance.id,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    });
    instance.businessFormInstanceId = formInstance.id;
  }
  const saved = await repos.instances.create(instance);
  let created: Awaited<ReturnType<typeof createWorkForNode>> = { tasks: [], cc: null };
  try {
    created = firstNode ? await createWorkForNode(saved, workflow, firstNode, actor, now) : created;
  } catch (error) {
    await repos.instances.delete(saved.id);
    if (formInstance) await repos.formInstances.delete(formInstance.id);
    throw error;
  }
  await audit('workflow.instance_started', actor.id, { targetId: saved.id, targetType: 'workflow_instance', tenantId: actor.tenantId });
  return { instance: saved, tasks: created.tasks, task: created.tasks[0] ?? null, cc: created.cc, formInstance };
}

export async function completeWorkflowTask(input: {
  taskId: string;
  decision: WorkflowDecision;
  comment?: string;
  formData?: Record<string, unknown>;
}, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const task = await getRequired(repos.tasks, input.taskId, '任务');
  if (task.status !== 'open') throw new Error('任务已处理');
  if (task.assigneeId !== actor.id && !sameEmail(task.assigneeEmail, actor.email)) throw new Error('只能处理分配给自己的任务');
  return completeTaskAs(task, input, actor, false);
}

export async function withdrawWorkflowInstance(input: { id: string; reason?: string }, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const instance = await getRequired(repos.instances, input.id, '流程实例');
  if (instance.status !== 'running') throw new Error('只能撤回运行中的流程');
  if (instance.initiatorId !== actor.id && !sameEmail(instance.initiatorEmail, actor.email)) throw new Error('只有发起人可以撤回流程');
  const now = new Date().toISOString();
  const next: WorkflowInstance = {
    ...instance,
    status: 'revoked',
    currentNodeId: undefined,
    currentNodeLabel: undefined,
    updatedAt: now,
    completedAt: now,
    revokedAt: now,
    revokedBy: actor.id,
    revokedReason: clean(input.reason),
    history: appendHistory(instance, { at: now, action: 'withdraw', by: actor.email, note: clean(input.reason) }),
  };
  const saved = await repos.instances.update(instance.id, next);
  await cancelOpenTasks(instance.id, actor, now);
  await syncFormInstanceStatus(saved, actor);
  await audit('workflow.instance_withdrawn', actor.id, { targetId: saved.id, targetType: 'workflow_instance', tenantId: actor.tenantId });
  return { instance: saved };
}

export async function adminTransferWorkflowTask(input: { taskId: string; assigneeId: string; reason: string }, actor: WorkflowActor) {
  const repos = workflowRepos(actor.tenantId);
  const reason = clean(input.reason);
  if (!reason) throw new Error('管理员转办必须填写原因');
  const task = await getRequired(repos.tasks, input.taskId, '任务');
  if (task.status !== 'open') throw new Error('只能转办未处理待办');
  const target = await findUser(actor.tenantId, input.assigneeId);
  if (!target) throw new Error('转办目标人员不存在');
  const now = new Date().toISOString();
  const nextTask = await repos.tasks.update(task.id, {
    assigneeId: target.id,
    assigneeEmail: target.email,
    assigneeName: target.name,
    updatedAt: now,
  });
  const instance = await repos.instances.get(task.instanceId);
  if (instance) {
    await repos.instances.update(instance.id, {
      history: appendHistory(instance, {
        at: now,
        action: 'admin_transfer',
        by: actor.email,
        note: reason,
        taskId: task.id,
        nodeId: task.nodeId,
        nodeLabel: task.nodeLabel,
        fromAssigneeId: task.assigneeId,
        toAssigneeId: target.id,
      }),
      updatedAt: now,
    });
  }
  await audit('workflow.task_admin_transfer', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
  return { task: nextTask };
}

export async function adminCompleteWorkflowTask(input: {
  taskId: string;
  decision: Exclude<WorkflowDecision, 'returned'>;
  comment?: string;
  reason: string;
  formData?: Record<string, unknown>;
}, actor: WorkflowActor) {
  const reason = clean(input.reason);
  if (!reason) throw new Error('管理员代办必须填写原因');
  const repos = workflowRepos(actor.tenantId);
  const task = await getRequired(repos.tasks, input.taskId, '任务');
  const result = await completeTaskAs(task, { ...input, comment: clean(input.comment) || reason }, actor, true);
  await audit('workflow.task_admin_completed', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
  return result;
}

export async function adminTerminateWorkflowInstance(input: { id: string; reason: string }, actor: WorkflowActor) {
  const reason = clean(input.reason);
  if (!reason) throw new Error('终止流程必须填写原因');
  const repos = workflowRepos(actor.tenantId);
  const instance = await getRequired(repos.instances, input.id, '流程实例');
  if (instance.status !== 'running') throw new Error('只能终止运行中的流程');
  const now = new Date().toISOString();
  const next = await repos.instances.update(instance.id, {
    status: 'cancelled',
    currentNodeId: undefined,
    currentNodeLabel: undefined,
    updatedAt: now,
    completedAt: now,
    history: appendHistory(instance, { at: now, action: 'admin_terminate', by: actor.email, note: reason }),
  });
  await cancelOpenTasks(instance.id, actor, now);
  await syncFormInstanceStatus(next, actor);
  await audit('workflow.instance_admin_terminated', actor.id, { targetId: instance.id, targetType: 'workflow_instance', tenantId: actor.tenantId });
  return { instance: next };
}

async function completeTaskAs(
  task: WorkflowTask,
  input: { decision: WorkflowDecision; comment?: string; formData?: Record<string, unknown> },
  actor: WorkflowActor,
  adminOverride: boolean,
) {
  const repos = workflowRepos(actor.tenantId);
  if (!['approved', 'rejected', 'returned'].includes(input.decision)) throw new Error('审批结果无效');
  const comment = clean(input.comment);
  if ((input.decision === 'rejected' || input.decision === 'returned') && !comment) throw new Error('驳回或退回必须填写原因');
  const instance = await getRequired(repos.instances, task.instanceId, '流程实例');
  if (instance.status !== 'running') throw new Error('流程实例不在运行中');
  const workflow = instance.workflowSnapshot;
  const nodeOperations = workflow.nodes.find((node) => node.id === task.nodeId)?.operationPermissions;
  const requiredOperation = input.decision === 'approved' ? 'complete' : input.decision === 'rejected' ? 'refuse' : 'back';
  if (nodeOperations?.[requiredOperation] === false) throw new Error('当前节点未开放此审批操作');
  const now = new Date().toISOString();
  const completedTask = await repos.tasks.update(task.id, {
    status: 'completed',
    decision: input.decision,
    comment,
    updatedAt: now,
    completedAt: now,
    completedById: actor.id,
    completedByEmail: actor.email,
    completedByName: actor.name,
  });
  await repos.taskForms.create({
    tenantId: actor.tenantId,
    taskId: task.id,
    instanceId: instance.id,
    nodeId: task.nodeId,
    nodeLabel: task.nodeLabel,
    formData: cloneJson(input.formData || {}),
    decision: input.decision,
    comment,
    signerId: actor.id,
    signerEmail: actor.email,
    signerName: actor.name,
    signedAt: now,
    createdBy: actor.id,
    createdAt: now,
  });

  if (input.decision === 'rejected') {
    await cancelOpenTasks(instance.id, actor, now);
    const rejected = await repos.instances.update(instance.id, {
      status: 'rejected',
      currentNodeId: undefined,
      currentNodeLabel: undefined,
      formData: { ...(instance.formData || {}), ...(input.formData || {}) },
      updatedAt: now,
      completedAt: now,
      rejectedAt: now,
      rejectedBy: actor.id,
      rejectedReason: comment,
      decision: input.decision,
      comment,
      history: appendHistory(instance, {
        at: now,
        action: adminOverride ? 'admin_rejected' : 'task_rejected',
        by: actor.email,
        note: comment,
        taskId: task.id,
        nodeId: task.nodeId,
        nodeLabel: task.nodeLabel,
      }),
    });
    await syncFormInstanceStatus(rejected, actor);
    await audit('workflow.task_completed', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
    return { instance: rejected, completedTask, nextTasks: [] };
  }

  if (input.decision === 'approved') {
    const node = workflow.nodes.find((item) => item.id === task.nodeId);
    if (node?.type === 'approval' && await keepApprovalNodeOpen(task, node, actor, now)) {
      const waiting = await repos.instances.update(instance.id, {
        formData: { ...(instance.formData || {}), ...(input.formData || {}) },
        updatedAt: now,
        decision: input.decision,
        comment,
        history: appendHistory(instance, {
          at: now,
          action: adminOverride ? 'admin_approved' : 'task_approved',
          by: actor.email,
          note: comment,
          taskId: task.id,
          nodeId: task.nodeId,
          nodeLabel: task.nodeLabel,
        }),
      });
      await syncFormInstanceStatus(waiting, actor);
      await audit('workflow.task_completed', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
      return { instance: waiting, completedTask, nextTasks: [] };
    }
  } else {
    await cancelSiblingTasks(task, actor, now);
  }

  const nextNode = input.decision === 'returned'
    ? previousRuntimeNode(workflow, task.nodeId)
    : nextRuntimeNode(workflow, task.nodeId);
  if (!nextNode) {
    const completed = await repos.instances.update(instance.id, {
      status: 'completed',
      currentNodeId: undefined,
      currentNodeLabel: undefined,
      formData: { ...(instance.formData || {}), ...(input.formData || {}) },
      updatedAt: now,
      completedAt: now,
      decision: input.decision,
      comment,
      history: appendHistory(instance, {
        at: now,
        action: adminOverride ? 'admin_approved' : 'task_approved',
        by: actor.email,
        note: comment,
        taskId: task.id,
        nodeId: task.nodeId,
        nodeLabel: task.nodeLabel,
      }),
    });
    await syncFormInstanceStatus(completed, actor);
    await audit('workflow.task_completed', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
    return { instance: completed, completedTask, nextTasks: [] };
  }

  const updated = await repos.instances.update(instance.id, {
    currentNodeId: nextNode.id,
    currentNodeLabel: nextNode.label,
    formData: { ...(instance.formData || {}), ...(input.formData || {}) },
    updatedAt: now,
    decision: input.decision,
    comment,
    history: appendHistory(instance, {
      at: now,
      action: input.decision === 'returned' ? 'task_returned' : adminOverride ? 'admin_approved' : 'task_approved',
      by: actor.email,
      note: comment,
      taskId: task.id,
      nodeId: task.nodeId,
      nodeLabel: task.nodeLabel,
    }),
  });
  const work = await createWorkForNode(updated, workflow, nextNode, actor, now);
  if (nextNode.type === 'end') {
    const completed = await repos.instances.update(instance.id, {
      status: 'completed',
      currentNodeId: undefined,
      currentNodeLabel: undefined,
      updatedAt: now,
      completedAt: now,
    });
    await syncFormInstanceStatus(completed, actor);
    return { instance: completed, completedTask, nextTasks: work.tasks };
  }
  await syncFormInstanceStatus(updated, actor);
  await audit('workflow.task_completed', actor.id, { targetId: task.id, targetType: 'workflow_task', tenantId: actor.tenantId });
  return { instance: updated, completedTask, nextTasks: work.tasks, cc: work.cc };
}

async function createWorkForNode(instance: WorkflowInstance, workflow: WorkflowTemplate, node: WorkflowNode, actor: WorkflowActor, now: string) {
  if (node.type === 'cc' || node.type === 'notify') {
    return { tasks: [], cc: await createCcForNode(instance, workflow, node, actor, now) };
  }
  if (node.type === 'end') return { tasks: [], cc: null };
  const assignees = await resolveAssignees(workflow, node, actor, instance);
  if (assignees.length === 0) throw new Error(`节点“${node.label}”未找到处理人，请检查组织上级、表单字段或发起人自选配置`);
  const repos = workflowRepos(actor.tenantId);
  const tasks: WorkflowTask[] = [];
  for (let assigneeOrder = 0; assigneeOrder < assignees.length; assigneeOrder += 1) {
    const assignee = assignees[assigneeOrder];
    tasks.push(await repos.tasks.create({
      tenantId: actor.tenantId,
      instanceId: instance.id,
      instanceCode: instance.code,
      title: instance.title,
      workflowTemplateId: workflow.id,
      workflowName: workflow.name,
      instanceStatus: instance.status,
      initiatorId: instance.initiatorId,
      initiatorEmail: instance.initiatorEmail,
      initiatorName: instance.initiatorName,
      businessType: instance.businessType,
      businessId: instance.businessId,
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      status: node.type === 'approval' && (node.multiApprovalMode || 'sequential') === 'sequential' && assigneeOrder > 0 ? 'queued' : 'open',
      assigneeId: assignee.id,
      assigneeEmail: assignee.email,
      assigneeName: assignee.name,
      assigneeMode: workflow.assigneeRules.find((rule) => rule.nodeId === node.id)?.mode,
      assigneeValue: workflow.assigneeRules.find((rule) => rule.nodeId === node.id)?.value,
      assigneeOrder,
      createdAt: now,
      updatedAt: now,
    }));
  }
  return { tasks, cc: null };
}

async function createCcForNode(instance: WorkflowInstance, workflow: WorkflowTemplate, node: WorkflowNode, actor: WorkflowActor, now: string) {
  const assignees = await resolveAssignees(workflow, node, actor, instance);
  const receiver = assignees[0];
  if (!receiver) return null;
  return workflowRepos(actor.tenantId).ccs.create({
    tenantId: actor.tenantId,
    instanceId: instance.id,
    instanceCode: instance.code,
    title: instance.title,
    workflowTemplateId: workflow.id,
    workflowName: workflow.name,
    nodeId: node.id,
    nodeLabel: node.label,
    status: 'unread',
    receiverId: receiver.id,
    receiverEmail: receiver.email,
    receiverName: receiver.name,
    createdAt: now,
  });
}

async function resolveAssignees(
  workflow: WorkflowTemplate,
  node: WorkflowNode,
  actor: WorkflowActor,
  instance: Pick<WorkflowInstance, 'initiatorId' | 'initiatorEmail' | 'initiatorName' | 'formData' | 'runtimeAssignees'>,
  directory?: { users: AuthUser[]; departments: HrDept[] },
): Promise<Array<{ id: string; email: string; name?: string }>> {
  const rule = workflow.assigneeRules.find((item) => item.nodeId === node.id) || { nodeId: node.id, mode: 'admin' } as WorkflowAssigneeRule;
  if (rule.mode === 'initiator') return [{ id: instance.initiatorId, email: instance.initiatorEmail, name: instance.initiatorName }];
  const users = directory?.users ?? await usersForTenant(actor.tenantId);
  if (rule.mode === 'admin') return adminAssignees(users, actor);
  if (rule.mode === 'user') return usersMatchingValues(users, rule.value);
  if (rule.mode === 'role') return usersMatchingRoles(users, rule.value);
  if (rule.mode === 'choice') return usersMatchingValues(users, instance.runtimeAssignees?.[node.id]);
  if (rule.mode === 'formUser') return usersMatchingValues(users, rule.value ? instance.formData?.[rule.value] : undefined);
  if (rule.mode === 'formRole') return usersMatchingRoles(users, rule.value ? instance.formData?.[rule.value] : undefined);
  if (rule.mode === 'leader') return resolveManagerAssignee(users, instance, node.leaderLevel ?? 1);
  if (rule.mode === 'orgLeader') return resolveDepartmentHeadAssignee(users, actor.tenantId, instance, node.orgLeaderLevel ?? 1, directory?.departments);
  return [];
}

function adminAssignees(users: AuthUser[], actor: WorkflowActor) {
  const admin = users.find((user) => (user.roles || []).some((role) => role === 'owner' || role === 'admin'));
  return admin ? [userSummary(admin)] : [{ id: actor.id, email: actor.email, name: actor.name }];
}

function valuesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(valuesFromUnknown);
  if (value && typeof value === 'object') return Object.values(value).flatMap(valuesFromUnknown);
  return normalizeUserList(String(value || ''));
}

function usersMatchingValues(users: AuthUser[], value: unknown) {
  const wanted = valuesFromUnknown(value);
  return users
    .filter((user) => wanted.includes(user.id.toLowerCase()) || wanted.includes(user.email.toLowerCase()))
    .map(userSummary);
}

function usersMatchingRoles(users: AuthUser[], value: unknown) {
  const roles = valuesFromUnknown(value);
  return users.filter((user) => (user.roles || []).some((role) => roles.includes(role.toLowerCase()))).map(userSummary);
}

function findWorkflowIdentity(users: AuthUser[], id: string, email: string) {
  return users.find((user) => user.id === id || sameEmail(user.email, email));
}

function resolveManagerAssignee(
  users: AuthUser[],
  instance: Pick<WorkflowInstance, 'initiatorId' | 'initiatorEmail'>,
  level: number,
) {
  let current = findWorkflowIdentity(users, instance.initiatorId, instance.initiatorEmail);
  for (let index = 0; index < Math.max(1, level); index += 1) {
    if (!current?.managerId) return [];
    current = users.find((user) => user.id === current?.managerId);
  }
  return current ? [userSummary(current)] : [];
}

async function resolveDepartmentHeadAssignee(
  users: AuthUser[],
  tenantId: string,
  instance: Pick<WorkflowInstance, 'initiatorId' | 'initiatorEmail'>,
  level: number,
  directoryDepartments?: HrDept[],
) {
  const initiator = findWorkflowIdentity(users, instance.initiatorId, instance.initiatorEmail);
  if (!initiator?.departmentId) return [];
  const departments = directoryDepartments ?? await listDepts(tenantId);
  const byId = new Map(departments.map((department) => [department.id, department]));
  let department = byId.get(initiator.departmentId);
  for (let index = 1; index < Math.max(1, level); index += 1) {
    department = department?.parentId ? byId.get(department.parentId) : undefined;
  }
  if (!department?.headId) return [];
  const head = users.find((user) => user.id === department?.headId);
  return head ? [userSummary(head)] : [];
}

async function syncFormInstanceStatus(instance: WorkflowInstance, actor: WorkflowActor) {
  if (!instance.businessFormInstanceId) return null;
  const repo = workflowRepos(actor.tenantId).formInstances;
  const form = await repo.get(instance.businessFormInstanceId);
  if (!form) return null;
  const status = formStatusFromInstance(instance.status);
  return repo.update(form.id, { status, workflowInstanceId: instance.id, updatedBy: actor.id, updatedAt: new Date().toISOString() });
}

async function cancelOpenTasks(instanceId: string, actor: WorkflowActor, now: string) {
  const repo = workflowRepos(actor.tenantId).tasks;
  const tasks = (await repo.list({ instanceId } as Partial<WorkflowTask>)).filter((task) => task.status === 'open' || task.status === 'queued');
  await Promise.all(tasks.map((task) => repo.update(task.id, { status: 'cancelled', updatedAt: now, completedAt: now, completedById: actor.id, completedByEmail: actor.email, completedByName: actor.name })));
}

async function cancelSiblingTasks(task: WorkflowTask, actor: WorkflowActor, now: string) {
  const repo = workflowRepos(actor.tenantId).tasks;
  const siblings = (await repo.list({ instanceId: task.instanceId, nodeId: task.nodeId } as Partial<WorkflowTask>))
    .filter((item) => item.id !== task.id && (item.status === 'open' || item.status === 'queued'));
  await Promise.all(siblings.map((item) => repo.update(item.id, { status: 'cancelled', updatedAt: now, completedAt: now, completedById: actor.id, completedByEmail: actor.email, completedByName: actor.name })));
}

async function keepApprovalNodeOpen(task: WorkflowTask, node: WorkflowNode, actor: WorkflowActor, now: string): Promise<boolean> {
  const repo = workflowRepos(actor.tenantId).tasks;
  const tasks = await repo.list({ instanceId: task.instanceId, nodeId: task.nodeId } as Partial<WorkflowTask>);
  const mode = node.multiApprovalMode || 'sequential';
  if (mode === 'single') {
    await cancelSiblingTasks(task, actor, now);
    return false;
  }
  if (mode === 'sequential') {
    const next = tasks
      .filter((item) => item.status === 'queued')
      .sort((a, b) => (a.assigneeOrder ?? 0) - (b.assigneeOrder ?? 0))[0];
    if (next) {
      await repo.update(next.id, { status: 'open', updatedAt: now });
      return true;
    }
    return tasks.some((item) => item.id !== task.id && item.status === 'open');
  }
  const approved = tasks.filter((item) => item.status === 'completed' && item.decision === 'approved').length;
  const required = Math.max(1, Math.ceil(tasks.length * Math.min(100, Math.max(1, node.multiApprovalPercent ?? 100)) / 100));
  if (approved < required) return true;
  await cancelSiblingTasks(task, actor, now);
  return false;
}

function workflowRepos(tenantId: string) {
  const store = getStore();
  return {
    forms: withTenantScope(store.workflowForms, tenantId),
    workflows: withTenantScope(store.workflowTemplates, tenantId),
    bindings: withTenantScope(store.workflowBindings, tenantId),
    formInstances: withTenantScope(store.workflowFormInstances, tenantId),
    instances: withTenantScope(store.workflowInstances, tenantId),
    tasks: withTenantScope(store.workflowTasks, tenantId),
    taskForms: withTenantScope(store.workflowTaskForms, tenantId),
    ccs: withTenantScope(store.workflowCcs, tenantId),
  };
}

async function getRequired<T extends { id: string }>(repo: Repository<T>, id: string, label: string): Promise<T> {
  const row = await repo.get(clean(id));
  if (!row) throw new Error(`${label}不存在`);
  return row;
}

async function usersForTenant(tenantId: string): Promise<AuthUser[]> {
  const users = await getStore().auth.users.list({ tenantId });
  return users.filter((user) => !user.disabled);
}

async function findUser(tenantId: string, idOrEmail: string): Promise<AuthUser | null> {
  const value = clean(idOrEmail).toLowerCase();
  return (await usersForTenant(tenantId)).find((user) => user.id === idOrEmail || user.email.toLowerCase() === value) || null;
}

function userSummary(user: AuthUser) {
  return { id: user.id, email: user.email, name: user.name };
}

function resolveStartWorkflow(input: { workflowTemplateId?: string; businessType?: string; businessAction?: string }, workflows: WorkflowTemplate[], bindings: BusinessWorkflowBinding[]) {
  if (input.workflowTemplateId) {
    const workflow = workflows.find((item) => item.id === input.workflowTemplateId);
    if (!workflow) throw new Error('流程模型不存在');
    return workflow;
  }
  const businessType = slug(input.businessType || '');
  const action = slug(input.businessAction || 'submit');
  const binding = bindings.find((item) => item.enabled && item.businessType === businessType && item.action === action);
  if (!binding) throw new Error('未配置业务流程绑定');
  const workflow = workflows.find((item) => item.id === binding.workflowTemplateId);
  if (!workflow) throw new Error('业务绑定的流程模型不存在');
  return workflow;
}

function firstRuntimeNode(workflow: WorkflowTemplate) {
  const start = workflow.nodes.find((node) => node.type === 'start');
  if (!start) return workflow.nodes.find((node) => node.type !== 'end') || null;
  return nextRuntimeNode(workflow, start.id);
}

function nextRuntimeNode(workflow: WorkflowTemplate, nodeId: string) {
  const edge = workflow.edges.find((item) => item.from === nodeId);
  return edge ? workflow.nodes.find((node) => node.id === edge.to) || null : null;
}

function previousRuntimeNode(workflow: WorkflowTemplate, nodeId: string) {
  const edge = [...workflow.edges].reverse().find((item) => item.to === nodeId);
  const previous = edge ? workflow.nodes.find((node) => node.id === edge.from) || null : null;
  return previous?.type === 'start' ? null : previous;
}

function appendHistory(instance: WorkflowInstance, item: WorkflowInstance['history'][number]) {
  return [...(instance.history || []), item];
}

function enrichTask(task: WorkflowTask, instance?: WorkflowInstance): WorkflowTask {
  if (!instance) return task;
  return {
    ...task,
    instanceStatus: instance.status,
    initiatorId: task.initiatorId || instance.initiatorId,
    initiatorEmail: task.initiatorEmail || instance.initiatorEmail,
    initiatorName: task.initiatorName || instance.initiatorName,
    businessType: task.businessType || instance.businessType,
    businessId: task.businessId || instance.businessId,
  };
}

function validateFormTemplate(form: WorkflowFormTemplate) {
  if (!form.code) throw new Error('表单编码必填');
  if (!form.name) throw new Error('表单名称必填');
  const ids = new Set<string>();
  for (const field of form.fields) {
    if (!field.id) throw new Error('字段编码必填');
    if (ids.has(field.id)) throw new Error(`字段编码重复：${field.id}`);
    ids.add(field.id);
    if (!field.label) throw new Error(`字段 ${field.id} 缺少名称`);
  }
}

function validateWorkflowTemplate(workflow: WorkflowTemplate) {
  if (!workflow.code) throw new Error('流程编码必填');
  if (!workflow.name) throw new Error('流程名称必填');
  if (!workflow.nodes.some((node) => node.type === 'start')) throw new Error('流程需要开始节点');
  if (!workflow.nodes.some((node) => node.type === 'end')) throw new Error('流程需要结束节点');
  if (!workflow.nodes.some((node) => node.type === 'approval')) throw new Error('流程至少需要一个审批节点');
}

function validateFormData(form: WorkflowFormTemplate, data: Record<string, unknown>) {
  const missing = form.fields.filter((field) => field.required && !field.hidden && !valueFilled(data[field.id])).map((field) => field.label);
  if (missing.length) throw new Error(`请填写必填字段：${missing.join('、')}`);
}

function valueFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).some(valueFilled);
  return Boolean(String(value || '').trim());
}

function normalizeFields(fields: WorkflowFormField[]): WorkflowFormField[] {
  return fields
    .map((field) => ({
      ...field,
      id: slug(field.id || field.label),
      label: clean(field.label) || clean(field.id) || '未命名字段',
      type: field.type || 'text',
      section: clean(field.section),
      options: Array.isArray(field.options) ? field.options.map(clean).filter(Boolean) : undefined,
    }))
    .filter((field) => field.id);
}

function normalizeNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({ ...node, id: slug(node.id || node.label), label: clean(node.label) || node.id, type: node.type || 'approval' }));
}

function normalizeEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.map((edge) => ({ ...edge, id: clean(edge.id) || `edge-${edge.from}-${edge.to}`, from: slug(edge.from), to: slug(edge.to), label: clean(edge.label) }));
}

function normalizeAssigneeRules(rules: WorkflowAssigneeRule[]): WorkflowAssigneeRule[] {
  return rules.map((rule) => ({ nodeId: slug(rule.nodeId), mode: rule.mode || 'admin', value: clean(rule.value) })).filter((rule) => rule.nodeId);
}

function normalizeStatus(status: unknown, fallback: WorkflowConfigStatus): WorkflowConfigStatus {
  return CONFIG_STATUSES.includes(status as WorkflowConfigStatus) ? status as WorkflowConfigStatus : fallback;
}

function normalizeLaunchMode(mode: unknown, fallback: WorkflowLaunchMode): WorkflowLaunchMode {
  return ['manual', 'business', 'both', 'disabled'].includes(String(mode)) ? mode as WorkflowLaunchMode : fallback;
}

function formStatusFromInstance(status: WorkflowRuntimeStatus): BusinessFormInstance['status'] {
  if (status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'running') return 'in_review';
  return 'draft';
}

function mergeDefaults<T extends { id: string }>(stored: T[], defaults: T[]) {
  const storedIds = new Set(stored.map((item) => item.id));
  return [...stored, ...defaults.filter((item) => !storedIds.has(item.id))];
}

function sortByUpdated<T extends { updatedAt?: string; createdAt?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function defaultForms(tenantId: string): WorkflowFormTemplate[] {
  const now = '2026-01-01T00:00:00.000Z';
  return [{
    id: 'wf-form-general-approval',
    tenantId,
    code: 'general_approval',
    name: '通用审批表单',
    description: '用于请假、报销、采购、事项确认等轻量流程。',
    version: 1,
    status: 'published',
    fields: [
      { id: 'title', label: '事项标题', type: 'text', required: true, section: '基本信息' },
      { id: 'type', label: '审批类型', type: 'select', required: true, section: '基本信息', options: ['请假', '报销', '采购', '合同', '其他'] },
      { id: 'reason', label: '申请说明', type: 'textarea', required: true, section: '基本信息' },
      { id: 'amount', label: '金额/数量', type: 'number', section: '补充信息' },
      { id: 'expectedDate', label: '期望完成日期', type: 'date', section: '补充信息' },
    ],
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  }];
}

function defaultWorkflows(tenantId: string): WorkflowTemplate[] {
  const now = '2026-01-01T00:00:00.000Z';
  return [{
    id: 'wf-template-general-approval',
    tenantId,
    code: 'general_approval',
    name: '通用审批流程',
    description: '发起人提交后，由管理员或指定角色审批。',
    group: '通用流程',
    launchMode: 'both',
    version: 1,
    status: 'published',
    nodes: defaultLinearNodes(),
    edges: defaultLinearEdges(),
    nodeForms: [{ nodeId: 'start', formTemplateIds: ['wf-form-general-approval'], required: true }],
    assigneeRules: [{ nodeId: 'approve', mode: 'admin' }],
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  }];
}

function defaultBindings(tenantId: string): BusinessWorkflowBinding[] {
  const now = '2026-01-01T00:00:00.000Z';
  return [{
    id: 'wf-binding-general-approval-submit',
    tenantId,
    businessType: 'general_approval',
    action: 'submit',
    label: '通用审批',
    formTemplateId: 'wf-form-general-approval',
    workflowTemplateId: 'wf-template-general-approval',
    enabled: true,
    renderMode: 'dynamic_form',
    detailMode: 'form_data',
    priority: 100,
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  }];
}

function defaultLinearNodes(): WorkflowNode[] {
  return [
    { id: 'start', label: '提交申请', type: 'start' },
    { id: 'approve', label: '审批', type: 'approval' },
    { id: 'end', label: '结束', type: 'end' },
  ];
}

function defaultLinearEdges(): WorkflowEdge[] {
  return [
    { id: 'edge-start-approve', from: 'start', to: 'approve' },
    { id: 'edge-approve-end', from: 'approve', to: 'end' },
  ];
}

function positiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeUserList(value: string) {
  return value.split(/[,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function sameEmail(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function slug(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '');
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
