'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
  Edit3,
  GitBranch,
  Inbox,
  Layers3,
  Plus,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  StopCircle,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundMinus,
  UserRoundPlus,
  X,
} from 'lucide-react';
import type {
  BusinessWorkflowBinding,
  WorkflowAssigneeMode,
  WorkflowConfigStatus,
  WorkflowDecision,
  WorkflowEmptyAssigneeAction,
  WorkflowFormField,
  WorkflowFormTemplate,
  WorkflowInstance,
  WorkflowMultiApprovalMode,
  WorkflowNode,
  WorkflowNodeFormPermission,
  WorkflowNodeOperationPermissions,
  WorkflowNodeType,
  WorkflowRuntimeSnapshot,
  WorkflowTask,
  WorkflowTaskForm,
  WorkflowTemplate,
} from '@/lib/types/workflow';

type TabId = 'desk' | 'start' | 'started' | 'cc' | 'forms' | 'models' | 'bindings' | 'admin';
type ApprovalRuntimeTabId = 'start' | 'todo' | 'started' | 'cc' | 'running';

interface WorkflowDirectoryUser {
  id: string;
  email: string;
  name?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  jobTitle?: string | null;
  roles?: string[];
  disabled?: boolean;
}

interface WorkflowDirectoryDepartment {
  id: string;
  name: string;
  parentId?: string | null;
  order?: number;
}

interface WorkflowDirectoryRole {
  key: string;
  name: string;
}

interface WorkflowDepartmentTreeNode {
  id: string;
  name: string;
  path: string[];
  users: WorkflowDirectoryUser[];
  children: WorkflowDepartmentTreeNode[];
}

interface WorkflowConfigPayload {
  forms: WorkflowFormTemplate[];
  workflows: WorkflowTemplate[];
  businessWorkflowBindings: BusinessWorkflowBinding[];
}

const EMPTY_CONFIG: WorkflowConfigPayload = {
  forms: [],
  workflows: [],
  businessWorkflowBindings: [],
};

const EMPTY_SNAPSHOT: WorkflowRuntimeSnapshot = {
  instances: [],
  myStarted: [],
  myTodo: [],
  myCc: [],
  visibleTasks: [],
  taskForms: [],
  workflows: [],
  forms: [],
  canManageWorkflows: false,
};

const APPROVAL_PAGE_SIZE_OPTIONS = [5, 10, 20];

const WORKFLOW_SECTIONS: Array<{ id: TabId; label: string; description: string; icon: typeof Inbox; manager?: boolean }> = [
  { id: 'models', label: '流程模型', description: '模型、表单和流程图', icon: GitBranch, manager: true },
  { id: 'bindings', label: '业务绑定', description: '业务入口关联流程', icon: Layers3, manager: true },
];

const WORKFLOW_GROUP_OPTIONS = ['通用流程', '人事流程', '财务流程', '采购流程', '项目流程', '合同流程'];
const WORKFLOW_MODEL_PAGE_SIZE_OPTIONS = [8, 15, 30];
const WORKFLOW_CUSTOM_GROUPS_KEY = 'tandem.workflow.customGroups';

const BUSINESS_SCENE_PRESETS = [
  { businessType: 'general_approval', label: '通用审批', defaultLabel: '通用审批' },
  { businessType: 'okr_adjustment', label: 'OKR 调整', defaultLabel: 'OKR 调整审批' },
  { businessType: 'daily_report', label: '工作报告', defaultLabel: '工作报告审批' },
  { businessType: 'expense_claim', label: '费用报销', defaultLabel: '费用报销审批' },
  { businessType: 'purchase_request', label: '采购申请', defaultLabel: '采购申请审批' },
  { businessType: 'contract_review', label: '合同评审', defaultLabel: '合同评审审批' },
];

const BUSINESS_ACTION_OPTIONS = [
  { value: 'submit', label: '提交审批' },
  { value: 'resubmit', label: '重新提交' },
  { value: 'change', label: '变更申请' },
  { value: 'publish', label: '发布生效' },
  { value: 'close', label: '关闭确认' },
];

const BINDING_RENDER_MODE_LABELS: Record<string, string> = {
  dynamic_form: '动态表单',
  custom_page: '业务页面',
};

const BINDING_DETAIL_MODE_LABELS: Record<string, string> = {
  form_data: '表单数据',
  custom_provider: '业务详情服务',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
  running: '运行中',
  completed: '已完成',
  cancelled: '已终止',
  rejected: '已驳回',
  revoked: '已撤回',
  open: '待处理',
};

const DECISION_LABELS: Record<WorkflowDecision, string> = {
  approved: '同意',
  rejected: '驳回并终止',
  returned: '退回上一步',
};

const DEFAULT_FIELD_ROWS: WorkflowFormField[] = [
  { id: 'title', label: '事项标题', type: 'text', required: true, section: '基本信息' },
  { id: 'reason', label: '申请说明', type: 'textarea', required: true, section: '基本信息' },
];

const FIELD_TYPE_OPTIONS: Array<{ value: WorkflowFormField['type']; label: string }> = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '下拉选择' },
  { value: 'multiselect', label: '多选' },
  { value: 'checkbox', label: '勾选框' },
  { value: 'attachment', label: '附件' },
  { value: 'user', label: '人员' },
  { value: 'role', label: '角色' },
];

const NODE_TYPE_OPTIONS: Array<{ value: WorkflowNodeType; label: string }> = [
  { value: 'approval', label: '审批' },
  { value: 'cc', label: '抄送' },
  { value: 'notify', label: '通知' },
  { value: 'form', label: '办理/填表' },
];

type WorkflowEditorStep = 'basic' | 'form' | 'workflow' | 'advanced';

interface WorkflowNodeDraft extends WorkflowNode {
  assigneeMode?: WorkflowAssigneeMode;
  assigneeValue?: string;
}

function initialFormDraft() {
  return {
    id: '',
    code: '',
    name: '',
    description: '',
    version: 1,
    status: 'draft' as WorkflowConfigStatus,
    fields: cloneFields(DEFAULT_FIELD_ROWS),
  };
}

function initialWorkflowDraft() {
  const code = `workflow-${Date.now().toString(36)}`;
  return {
    id: '',
    code,
    name: '',
    description: '',
    group: '通用流程',
    launchMode: 'both',
    status: 'draft' as WorkflowConfigStatus,
    startFormTemplateId: '',
    startFormDraft: {
      id: '',
      code: defaultWorkflowFormCode(code),
      name: '',
      description: '',
      version: 1,
      status: 'draft' as WorkflowConfigStatus,
      fields: cloneFields(DEFAULT_FIELD_ROWS),
    },
    editorStep: 'basic' as WorkflowEditorStep,
    nodes: [
      { id: 'start', label: '提交申请', type: 'start' as WorkflowNodeType },
      {
        id: 'approve',
        label: '审批',
        type: 'approval' as WorkflowNodeType,
        assigneeMode: 'user' as const,
        assigneeValue: '',
        multiApprovalMode: 'sequential' as const,
        multiApprovalPercent: 100,
        emptyAssigneeAction: 'pass' as const,
        operationPermissions: defaultWorkflowOperationPermissions(),
      },
      { id: 'end', label: '结束', type: 'end' as WorkflowNodeType },
    ] as WorkflowNodeDraft[],
    assigneeMode: 'admin',
    assigneeValue: '',
  };
}

function initialBindingDraft() {
  return {
    id: '',
    businessType: '',
    action: 'submit',
    label: '',
    formTemplateId: '',
    workflowTemplateId: '',
    renderMode: 'dynamic_form',
    detailMode: 'form_data',
    enabled: true,
    priority: 100,
  };
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('models');
  const [config, setConfig] = useState<WorkflowConfigPayload>(EMPTY_CONFIG);
  const [snapshot, setSnapshot] = useState<WorkflowRuntimeSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [startTitle, setStartTitle] = useState('');
  const [startFormData, setStartFormData] = useState<Record<string, unknown>>({});
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [taskFormData, setTaskFormData] = useState<Record<string, Record<string, unknown>>>({});
  const [formDraft, setFormDraft] = useState(initialFormDraft);
  const [workflowDraft, setWorkflowDraft] = useState(initialWorkflowDraft);
  const [bindingDraft, setBindingDraft] = useState(initialBindingDraft);
  const [modelEditing, setModelEditing] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<WorkflowDirectoryUser[]>([]);
  const [directoryDepartments, setDirectoryDepartments] = useState<WorkflowDirectoryDepartment[]>([]);
  const [directoryRoles, setDirectoryRoles] = useState<WorkflowDirectoryRole[]>([]);
  const [businessStartBindingId, setBusinessStartBindingId] = useState('');
  const [businessStartTitle, setBusinessStartTitle] = useState('');
  const [businessStartId, setBusinessStartId] = useState('');
  const [businessStartFormData, setBusinessStartFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'models' || tab === 'bindings') setActiveTab(tab);
  }, []);

  const selectedWorkflow = useMemo(
    () => snapshot.workflows.find((item) => item.id === selectedWorkflowId) ?? snapshot.workflows[0],
    [selectedWorkflowId, snapshot.workflows],
  );

  const selectedStartForm = useMemo(() => {
    const formId = selectedWorkflow?.nodeForms[0]?.formTemplateIds[0];
    return formId ? snapshot.forms.find((item) => item.id === formId) : undefined;
  }, [selectedWorkflow, snapshot.forms]);

  const selectedBusinessBinding = useMemo(
    () => config.businessWorkflowBindings.find((item) => item.id === businessStartBindingId) ?? config.businessWorkflowBindings.find((item) => item.enabled),
    [businessStartBindingId, config.businessWorkflowBindings],
  );

  const selectedBusinessWorkflow = useMemo(
    () => selectedBusinessBinding ? config.workflows.find((item) => item.id === selectedBusinessBinding.workflowTemplateId) : undefined,
    [config.workflows, selectedBusinessBinding],
  );

  const selectedBusinessForm = useMemo(() => {
    const formId = selectedBusinessBinding?.formTemplateId || selectedBusinessWorkflow?.nodeForms[0]?.formTemplateIds[0];
    return formId ? config.forms.find((item) => item.id === formId) : undefined;
  }, [config.forms, selectedBusinessBinding, selectedBusinessWorkflow]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedWorkflowId && snapshot.workflows[0]) {
      setSelectedWorkflowId(snapshot.workflows[0].id);
    }
  }, [selectedWorkflowId, snapshot.workflows]);

  useEffect(() => {
    if (!WORKFLOW_SECTIONS.some((section) => section.id === activeTab)) {
      setActiveTab('models');
    }
  }, [activeTab]);

  useEffect(() => {
    if (!loading && !snapshot.canManageWorkflows && activeTab === 'bindings') {
      setActiveTab('models');
    }
  }, [activeTab, loading, snapshot.canManageWorkflows]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [configRes, runtimeRes, usersRes, departmentsRes, rolesRes] = await Promise.all([
        fetch('/api/workflows/config', { credentials: 'include' }),
        fetch('/api/workflows/runtime', { credentials: 'include' }),
        fetch('/api/org/users', { credentials: 'include' }),
        fetch('/api/org/departments', { credentials: 'include' }),
        fetch('/api/admin/roles', { credentials: 'include' }),
      ]);
      const configJson = await configRes.json();
      const runtimeJson = await runtimeRes.json();
      const usersJson = await usersRes.json().catch(() => ({ users: [] }));
      const departmentsJson = await departmentsRes.json().catch(() => ({ depts: [] }));
      const rolesJson = await rolesRes.json().catch(() => ({ roles: [] }));
      if (!configRes.ok) throw new Error(configJson.error || '流程配置加载失败');
      if (!runtimeRes.ok) throw new Error(runtimeJson.error || '流程运行数据加载失败');
      setConfig(configJson.config ?? EMPTY_CONFIG);
      setSnapshot(runtimeJson.snapshot ?? EMPTY_SNAPSHOT);
      const users = Array.isArray(usersJson.users) ? usersJson.users.filter((user: WorkflowDirectoryUser) => !user.disabled) : [];
      const rolesFromApi = Array.isArray(rolesJson.roles)
        ? rolesJson.roles.map((role: { key?: string; name?: string }) => ({ key: String(role.key ?? ''), name: String(role.name ?? role.key ?? '') })).filter((role: WorkflowDirectoryRole) => role.key)
        : [];
      const roleKeysFromUsers = Array.from(new Set(users.flatMap((user: WorkflowDirectoryUser) => user.roles ?? [])));
      const mergedRoles = [
        ...rolesFromApi,
        ...roleKeysFromUsers.filter((key) => !rolesFromApi.some((role: WorkflowDirectoryRole) => role.key === key)).map((key) => ({ key, name: key })),
      ];
      setDirectoryUsers(users);
      setDirectoryDepartments(Array.isArray(departmentsJson.depts) ? departmentsJson.depts : []);
      setDirectoryRoles(mergedRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function apiPost(url: string, body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      await loadAll();
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(kind: 'form' | 'workflow' | 'binding', id: string, status: WorkflowConfigStatus) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/workflows/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '状态更新失败');
      setMessage('状态已更新');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function startWorkflow(e: FormEvent) {
    e.preventDefault();
    if (!selectedWorkflow) return;
    await apiPost('/api/workflows/runtime', {
      action: 'start',
      workflowTemplateId: selectedWorkflow.id,
      title: startTitle || selectedWorkflow.name,
      formTemplateId: selectedStartForm?.id,
      formData: startFormData,
      launchSource: 'manual',
    });
    setStartTitle('');
    setStartFormData({});
    setMessage('流程已发起');
    setActiveTab('desk');
  }

  async function startBusinessWorkflow(e: FormEvent) {
    e.preventDefault();
    if (!selectedBusinessBinding) {
      setError('请选择一个已启用的业务绑定');
      return;
    }
    await apiPost('/api/workflows/runtime', {
      action: 'start',
      launchSource: 'business',
      businessType: selectedBusinessBinding.businessType,
      businessAction: selectedBusinessBinding.action,
      businessId: businessStartId || `biz-${Date.now().toString(36)}`,
      title: businessStartTitle || selectedBusinessBinding.label || selectedBusinessWorkflow?.name,
      formTemplateId: selectedBusinessForm?.id,
      formData: businessStartFormData,
    });
    setBusinessStartTitle('');
    setBusinessStartId('');
    setBusinessStartFormData({});
    setMessage('业务流程已发起');
    setActiveTab('desk');
  }

  async function completeTask(task: WorkflowTask, decision: WorkflowDecision) {
    await apiPost('/api/workflows/runtime', {
      action: 'complete',
      taskId: task.id,
      decision,
      comment: taskComments[task.id] ?? '',
      formData: taskFormData[task.id] ?? {},
    });
    setMessage(`待办已处理：${DECISION_LABELS[decision]}`);
  }

  async function withdraw(instance: WorkflowInstance) {
    const reason = window.prompt('请输入撤回原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime', { action: 'withdraw', id: instance.id, reason });
    setMessage('流程已撤回');
  }

  async function saveFormTemplate(e: FormEvent) {
    e.preventDefault();
    if (formDraft.fields.length === 0) {
      setError('请至少添加一个表单字段');
      return;
    }
    await apiPost('/api/workflows/config', {
      kind: 'form',
      config: {
        id: formDraft.id || undefined,
        code: formDraft.code,
        name: formDraft.name,
        description: formDraft.description,
        version: formDraft.version,
        status: formDraft.status,
        fields: formDraft.fields,
      },
    });
    setFormDraft(initialFormDraft());
    setMessage('表单模板已保存');
  }

  async function saveWorkflowTemplate(e: FormEvent) {
    e.preventDefault();
    const nodes = normalizeWorkflowDraftNodes(workflowDraft.nodes);
    if (workflowDraft.startFormDraft.fields.length === 0) {
      setError('请至少为流程发起表单添加一个字段');
      return;
    }
    const formResult = await apiPost('/api/workflows/config', {
      kind: 'form',
      config: {
        id: workflowDraft.startFormDraft.id || workflowDraft.startFormTemplateId || undefined,
        code: workflowDraft.startFormDraft.code || defaultWorkflowFormCode(workflowDraft.code),
        name: workflowDraft.startFormDraft.name || defaultWorkflowFormName(workflowDraft.name),
        description: workflowDraft.startFormDraft.description,
        version: workflowDraft.startFormDraft.version,
        status: workflowDraft.startFormDraft.status,
        fields: workflowDraft.startFormDraft.fields,
      },
    });
    const savedForm = formResult.config as WorkflowFormTemplate;
    await apiPost('/api/workflows/config', {
      kind: 'workflow',
      config: {
        id: workflowDraft.id || undefined,
        code: workflowDraft.code,
        name: workflowDraft.name,
        description: workflowDraft.description,
        group: workflowDraft.group,
        launchMode: workflowDraft.launchMode,
        status: workflowDraft.status,
        nodes: nodes.map(({ assigneeMode: _mode, assigneeValue: _value, ...node }) => node),
        edges: linearEdges(nodes),
        nodeForms: [{ nodeId: 'start', formTemplateIds: [savedForm.id], required: true }],
        assigneeRules: nodes
          .filter((node) => ['approval', 'cc', 'notify', 'form'].includes(node.type))
          .map((node) => ({
            nodeId: node.id,
            mode: node.assigneeMode || 'admin',
            value: node.assigneeValue || '',
          })),
      },
    });
    setWorkflowDraft(initialWorkflowDraft());
    setMessage('流程模型已保存');
  }

  async function saveBinding(e: FormEvent) {
    e.preventDefault();
    await apiPost('/api/workflows/config', {
      kind: 'binding',
      config: bindingDraft,
    });
    setBindingDraft(initialBindingDraft());
    setMessage('业务流程绑定已保存');
  }

  async function adminTransfer(task: WorkflowTask) {
    const assigneeId = window.prompt('请输入转办目标用户 ID 或邮箱')?.trim();
    if (!assigneeId) return;
    const reason = window.prompt('请输入管理员转办原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'transfer', taskId: task.id, assigneeId, reason });
    setMessage('待办已转办');
  }

  async function adminComplete(task: WorkflowTask, decision: Exclude<WorkflowDecision, 'returned'>) {
    const reason = window.prompt('请输入管理员代办原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'complete', taskId: task.id, decision, reason });
    setMessage('待办已代办');
  }

  async function adminTerminate(instance: WorkflowInstance) {
    const reason = window.prompt('请输入终止异常流程的原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'terminate', id: instance.id, reason });
    setMessage('流程已终止');
  }

  const activeSection = WORKFLOW_SECTIONS.find((item) => item.id === activeTab) ?? WORKFLOW_SECTIONS[0];
  const showWorkflowHeader = !(activeTab === 'models' && modelEditing);

  return (
    <div className="min-h-screen bg-surface-1 px-4 py-4 text-ink-primary md:px-6">
      <main className="mx-auto max-w-[1540px] space-y-4">
        {showWorkflowHeader && (
        <section className="rounded-md border border-border bg-surface-0 shadow-soft-xs">
          <div className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-title-lg font-bold">流程中心</h1>
                <span className="rounded-full bg-brand-500/10 px-3 py-1 text-caption font-medium text-brand-600">
                  {activeSection.label}
                </span>
              </div>
              <p className="mt-1 text-body text-ink-secondary">维护流程模型、表单设计、流程图和业务绑定；审批处理从左侧“流程中心”进入。</p>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="grid overflow-hidden rounded-md border border-border bg-surface-0 sm:grid-cols-2">
                {WORKFLOW_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const active = activeTab === section.id;
                  const disabled = Boolean(section.manager && !snapshot.canManageWorkflows);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setActiveTab(section.id)}
                      className={`flex min-h-12 items-center gap-2 border-r border-border px-4 text-left transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-45 ${
                        active ? 'bg-brand-500/10 text-brand-600' : 'bg-surface-0 text-ink-primary hover:bg-surface-1'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-semibold">{section.label}</span>
                        <span className="block truncate text-caption text-ink-tertiary">{section.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button variant="outline" onClick={() => { window.location.href = '/approvals'; }} className="h-12 px-5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回流程中心
              </Button>
              <Button variant="outline" onClick={() => void loadAll()} disabled={loading} className="h-12 px-5">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </section>
        )}

        {(message || error) && (
          <div className={`rounded-md border px-4 py-3 text-caption ${error ? 'border-danger/30 bg-danger/10 text-danger' : 'border-success/30 bg-success/10 text-success'}`}>
            {error || message}
          </div>
        )}

          {!loading && !snapshot.canManageWorkflows && (
            <Card className="rounded-md">
              <CardContent className="p-6">
                <EmptyState text="当前账号没有工作流设计权限；审批处理请从左侧进入“流程中心”。" />
              </CardContent>
            </Card>
          )}

          {(loading || snapshot.canManageWorkflows) && activeTab === 'models' && (
            <ModelsTab
              workflows={config.workflows}
              forms={config.forms}
              users={directoryUsers}
              departments={directoryDepartments}
              roles={directoryRoles}
              draft={workflowDraft}
              setDraft={setWorkflowDraft}
              saving={saving}
              onEditingChange={setModelEditing}
              onSubmit={saveWorkflowTemplate}
              onStatus={updateStatus}
              onEdit={(workflow) => {
                const startFormTemplateId = workflow.nodeForms[0]?.formTemplateIds[0] ?? '';
                const startForm = config.forms.find((form) => form.id === startFormTemplateId);
                setWorkflowDraft({
                  id: workflow.id,
                  code: workflow.code,
                  name: workflow.name,
                  description: workflow.description ?? '',
                  group: workflow.group ?? '通用流程',
                  launchMode: workflow.launchMode,
                  status: workflow.status,
                  startFormTemplateId,
                  startFormDraft: startForm
                    ? {
                        id: startForm.id,
                        code: startForm.code,
                        name: startForm.name,
                        description: startForm.description ?? '',
                        version: startForm.version,
                        status: startForm.status,
                        fields: cloneFields(startForm.fields),
                      }
                    : {
                        id: '',
                        code: defaultWorkflowFormCode(workflow.code),
                        name: defaultWorkflowFormName(workflow.name),
                        description: '',
                        version: 1,
                        status: workflow.status,
                        fields: cloneFields(DEFAULT_FIELD_ROWS),
                      },
                  editorStep: 'basic',
                  nodes: workflow.nodes.map((node) => {
                    const rule = workflow.assigneeRules.find((item) => item.nodeId === node.id);
                    return {
                      ...node,
                      assigneeMode: rule?.mode,
                      assigneeValue: rule?.value ?? '',
                    };
                  }),
                  assigneeMode: workflow.assigneeRules.find((rule) => rule.nodeId === 'approve')?.mode ?? 'admin',
                  assigneeValue: workflow.assigneeRules.find((rule) => rule.nodeId === 'approve')?.value ?? '',
                });
              }}
            />
          )}

          {(loading || snapshot.canManageWorkflows) && activeTab === 'bindings' && (
            <BindingsTab
              bindings={config.businessWorkflowBindings}
              workflows={config.workflows}
              forms={config.forms}
              selectedBindingId={selectedBusinessBinding?.id ?? ''}
              businessTitle={businessStartTitle}
              businessId={businessStartId}
              businessFormData={businessStartFormData}
              selectedForm={selectedBusinessForm}
              draft={bindingDraft}
              setDraft={setBindingDraft}
              setSelectedBindingId={setBusinessStartBindingId}
              setBusinessTitle={setBusinessStartTitle}
              setBusinessId={setBusinessStartId}
              setBusinessFormData={setBusinessStartFormData}
              saving={saving}
              onSubmit={saveBinding}
              onBusinessStart={startBusinessWorkflow}
              onStatus={updateStatus}
              onEdit={(binding) => setBindingDraft({
                id: binding.id,
                businessType: binding.businessType,
                action: binding.action,
                label: binding.label ?? '',
                formTemplateId: binding.formTemplateId ?? '',
                workflowTemplateId: binding.workflowTemplateId,
                renderMode: binding.renderMode,
                detailMode: binding.detailMode,
                enabled: binding.enabled,
                priority: binding.priority,
              })}
            />
          )}
      </main>
    </div>
  );
}

export function ApprovalRuntimeWorkbench() {
  const [snapshot, setSnapshot] = useState<WorkflowRuntimeSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [startTitle, setStartTitle] = useState('');
  const [startFormData, setStartFormData] = useState<Record<string, unknown>>({});
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [taskFormData, setTaskFormData] = useState<Record<string, Record<string, unknown>>>({});
  const [activeRuntimeTab, setActiveRuntimeTab] = useState<ApprovalRuntimeTabId>('start');

  const selectedWorkflow = useMemo(
    () => snapshot.workflows.find((item) => item.id === selectedWorkflowId) ?? snapshot.workflows[0],
    [selectedWorkflowId, snapshot.workflows],
  );

  const selectedStartForm = useMemo(() => {
    const formId = selectedWorkflow?.nodeForms[0]?.formTemplateIds[0];
    return formId ? snapshot.forms.find((item) => item.id === formId) : undefined;
  }, [selectedWorkflow, snapshot.forms]);

  useEffect(() => {
    void loadRuntime();
  }, []);

  useEffect(() => {
    if (!selectedWorkflowId && snapshot.workflows[0]) {
      setSelectedWorkflowId(snapshot.workflows[0].id);
    }
  }, [selectedWorkflowId, snapshot.workflows]);

  async function loadRuntime() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows/runtime', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '审批运行数据加载失败');
      setSnapshot(data.snapshot ?? EMPTY_SNAPSHOT);
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批运行数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function apiPost(url: string, body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      await loadRuntime();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function startWorkflow(e: FormEvent) {
    e.preventDefault();
    if (!selectedWorkflow) return;
    await apiPost('/api/workflows/runtime', {
      action: 'start',
      workflowTemplateId: selectedWorkflow.id,
      title: startTitle || selectedWorkflow.name,
      formTemplateId: selectedStartForm?.id,
      formData: startFormData,
      launchSource: 'manual',
    });
    setStartTitle('');
    setStartFormData({});
    setStartDialogOpen(false);
    setMessage('流程已发起');
  }

  async function completeTask(task: WorkflowTask, decision: WorkflowDecision) {
    await apiPost('/api/workflows/runtime', {
      action: 'complete',
      taskId: task.id,
      decision,
      comment: taskComments[task.id] ?? '',
      formData: taskFormData[task.id] ?? {},
    });
    setMessage(`待办已处理：${DECISION_LABELS[decision]}`);
  }

  async function withdraw(instance: WorkflowInstance) {
    const reason = window.prompt('请输入撤回原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime', { action: 'withdraw', id: instance.id, reason });
    setMessage('流程已撤回');
  }

  async function adminTransfer(task: WorkflowTask) {
    const assigneeId = window.prompt('请输入转办目标用户 ID 或邮箱')?.trim();
    if (!assigneeId) return;
    const reason = window.prompt('请输入管理员转办原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'transfer', taskId: task.id, assigneeId, reason });
    setMessage('待办已转办');
  }

  async function adminComplete(task: WorkflowTask, decision: Exclude<WorkflowDecision, 'returned'>) {
    const reason = window.prompt('请输入管理员代办原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'complete', taskId: task.id, decision, reason });
    setMessage('待办已代办');
  }

  async function adminTerminate(instance: WorkflowInstance) {
    const reason = window.prompt('请输入终止异常流程的原因')?.trim();
    if (!reason) return;
    await apiPost('/api/workflows/runtime/admin', { action: 'terminate', id: instance.id, reason });
    setMessage('流程已终止');
  }

  const runningInstances = snapshot.instances.filter((item) => item.status === 'running');
  const runtimeTabs: Array<{ id: ApprovalRuntimeTabId; label: string; prefix: string; count?: number }> = [
    { id: 'start', label: '发起流程', prefix: '发' },
    { id: 'todo', label: '我的待办', prefix: '办', count: snapshot.myTodo.length },
    { id: 'started', label: '我发起的', prefix: '我', count: snapshot.myStarted.length },
    { id: 'cc', label: '抄送我的', prefix: '抄', count: snapshot.myCc.length },
    { id: 'running', label: '运行中流程', prefix: '数', count: runningInstances.length },
  ];

  return (
    <div
      className="min-h-screen bg-surface-1 px-4 py-5 text-ink-primary md:px-6"
    >
      <main className="w-full space-y-4">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-title-lg font-bold">流程中心</h1>
            <p className="mt-1 text-body text-ink-secondary">普通用户处理我的事务；管理员可维护流程模型和表单。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadRuntime()} disabled={loading} className="h-10 px-4">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = '/'; }} className="h-10 px-4">
              返回工作台
            </Button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-130px)] gap-3 overflow-hidden bg-surface-1 lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="self-start rounded-md border border-border bg-surface-0 p-3">
            <p className="mb-3 text-caption font-medium text-ink-tertiary">流程管理</p>
            <div className="space-y-1">
              <RuntimeSideNavButton label="流程模型" prefix="流" onClick={() => { window.location.href = '/workflows?tab=models'; }} />
              <RuntimeSideNavButton label="业务流程绑定" prefix="绑" onClick={() => { window.location.href = '/workflows?tab=bindings'; }} />
              <RuntimeSideNavButton label="流程数据" prefix="数" active={activeRuntimeTab === 'running'} onClick={() => setActiveRuntimeTab('running')} />
            </div>
            <p className="mb-3 mt-8 text-caption font-medium text-ink-tertiary">我的事务</p>
            <div className="space-y-1">
              {runtimeTabs.filter((tab) => tab.id !== 'running').map((tab) => (
                <RuntimeSideNavButton
                  key={tab.id}
                  label={tab.label}
                  prefix={tab.prefix}
                  count={tab.count}
                  active={activeRuntimeTab === tab.id}
                  onClick={() => setActiveRuntimeTab(tab.id)}
                />
              ))}
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden">
            {(message || error) && (
              <div className={`mb-4 rounded-md border px-4 py-3 text-caption ${error ? 'border-danger/30 bg-danger/10 text-danger' : 'border-success/30 bg-success/10 text-success'}`}>
                {error || message}
              </div>
            )}

            {loading ? (
              <EmptyState text="审批数据加载中..." />
            ) : (
              <>
                {activeRuntimeTab === 'start' && (
                  <StartTab
                    workflows={snapshot.workflows}
                    forms={snapshot.forms}
                    selectedWorkflow={selectedWorkflow}
                    selectedStartForm={selectedStartForm}
                    selectedWorkflowId={selectedWorkflowId}
                    setSelectedWorkflowId={setSelectedWorkflowId}
                    startTitle={startTitle}
                    setStartTitle={setStartTitle}
                    startFormData={startFormData}
                    setStartFormData={setStartFormData}
                    workflowSearch={workflowSearch}
                    setWorkflowSearch={setWorkflowSearch}
                    startDialogOpen={startDialogOpen}
                    setStartDialogOpen={setStartDialogOpen}
                    saving={saving}
                    onStart={startWorkflow}
                  />
                )}
                {activeRuntimeTab === 'todo' && (
                  <TodoTab
                    snapshot={snapshot}
                    forms={snapshot.forms}
                    taskComments={taskComments}
                    taskFormData={taskFormData}
                    saving={saving}
                    setTaskComments={setTaskComments}
                    setTaskFormData={setTaskFormData}
                    onComplete={completeTask}
                  />
                )}
                {activeRuntimeTab === 'started' && <StartedTab snapshot={snapshot} forms={snapshot.forms} onWithdraw={withdraw} />}
                {activeRuntimeTab === 'cc' && <CcTab snapshot={snapshot} />}
                {activeRuntimeTab === 'running' && (
                  <RunningProcessesTab
                    instances={runningInstances}
                    forms={snapshot.forms}
                    canManage={snapshot.canManageWorkflows}
                    saving={saving}
                    onTerminate={adminTerminate}
                  />
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function usePagedItems<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(APPROVAL_PAGE_SIZE_OPTIONS[0]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return { currentPage, pageSize, pageStart, pagedItems, setPage, setPageSize, totalPages };
}

function RuntimePagination(props: {
  total: number;
  pageStart: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
}) {
  if (props.total === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-caption text-ink-secondary md:flex-row md:items-center md:justify-between">
      <span>
        显示 {props.pageStart + 1}-{Math.min(props.pageStart + props.pageSize, props.total)} 条，共 {props.total} 条
      </span>
      <div className="flex items-center gap-2">
        <select
          value={props.pageSize}
          onChange={(e) => props.onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-caption"
          aria-label="每页条数"
        >
          {APPROVAL_PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} 条/页</option>)}
        </select>
        <Button variant="outline" size="sm" disabled={props.currentPage <= 1} onClick={() => props.onPageChange(props.currentPage - 1)}>
          上一页
        </Button>
        <span className="min-w-[68px] text-center">{props.currentPage} / {props.totalPages}</span>
        <Button variant="outline" size="sm" disabled={props.currentPage >= props.totalPages} onClick={() => props.onPageChange(props.currentPage + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}

function RuntimeSideNavButton(props: {
  label: string;
  prefix: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-body font-semibold transition-colors ${
        props.active ? 'border border-brand-500/20 bg-brand-500/10 text-brand-600' : 'text-ink-primary hover:bg-surface-0'
      }`}
    >
      <span className={`w-5 shrink-0 text-center font-bold ${props.active ? 'text-brand-600' : 'text-ink-primary'}`}>{props.prefix}</span>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {typeof props.count === 'number' && <span className="rounded-full bg-surface-0 px-2 py-0.5 text-caption text-ink-tertiary">{props.count}</span>}
    </button>
  );
}

function TodoTab(props: {
  snapshot: WorkflowRuntimeSnapshot;
  forms: WorkflowFormTemplate[];
  taskComments: Record<string, string>;
  taskFormData: Record<string, Record<string, unknown>>;
  saving: boolean;
  setTaskComments: (next: Record<string, string>) => void;
  setTaskFormData: (next: Record<string, Record<string, unknown>>) => void;
  onComplete: (task: WorkflowTask, decision: WorkflowDecision) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const keyword = query.trim().toLowerCase();
  const rows = props.snapshot.myTodo
    .filter((task) => {
      if (!keyword) return true;
      return [task.id, task.title, task.workflowName, task.nodeLabel, task.assigneeName, task.assigneeEmail]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const { currentPage, pageSize, pageStart, pagedItems, setPage, setPageSize, totalPages } = usePagedItems(rows);
  const selectedInstance = selectedTask ? props.snapshot.instances.find((item) => item.id === selectedTask.instanceId) : undefined;
  return (
    <RuntimeTablePanel
      title="我的待办"
      description="展示当前登录人需要处理的审批、填写、确认等任务。"
      count={rows.length}
      query={query}
      onQueryChange={setQuery}
      placeholder="请输入标题 / 编号"
    >
      <RuntimeDataTable
        columns={[
          { key: 'id', label: '任务编号', width: '18%' },
          { key: 'title', label: '标题', width: '24%' },
          { key: 'workflow', label: '流程模型', width: '18%' },
          { key: 'node', label: '当前节点', width: '16%' },
          { key: 'createdAt', label: '到达时间', width: '16%' },
          { key: 'action', label: '操作', width: '8%', align: 'right' },
        ]}
        emptyText="暂无待办。发起流程后，如果当前节点需要你处理，会显示在这里。"
        colSpan={6}
      >
        {pagedItems.map((task) => (
          <tr key={task.id} className="border-b border-border last:border-0">
            <RuntimeDataCell value={task.id} />
            <RuntimeDataCell value={task.title} strong />
            <RuntimeDataCell value={task.workflowName} />
            <RuntimeDataCell value={task.nodeLabel} />
            <RuntimeDataCell value={formatDateTime(task.createdAt)} />
            <td className="px-3 py-2 text-right">
              <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setSelectedTask(task)}>
                查看详情
              </Button>
            </td>
          </tr>
        ))}
      </RuntimeDataTable>
      <RuntimePagination
        total={rows.length}
        pageStart={pageStart}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      {selectedTask && (
        <WorkflowTaskDetailDialog
          task={selectedTask}
          instance={selectedInstance}
          forms={props.forms}
          comments={props.taskComments}
          formData={props.taskFormData}
          saving={props.saving}
          setComments={props.setTaskComments}
          setFormData={props.setTaskFormData}
          onClose={() => setSelectedTask(null)}
          onComplete={async (task, decision) => {
            await props.onComplete(task, decision);
            setSelectedTask(null);
          }}
        />
      )}
    </RuntimeTablePanel>
  );
}

function StartedTab(props: { snapshot: WorkflowRuntimeSnapshot; forms: WorkflowFormTemplate[]; onWithdraw: (instance: WorkflowInstance) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const keyword = query.trim().toLowerCase();
  const rows = props.snapshot.myStarted.filter((item) => {
    if (!keyword) return true;
    return [item.code, item.title, item.workflowName, item.currentNodeLabel, item.status]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const { currentPage, pageSize, pageStart, pagedItems, setPage, setPageSize, totalPages } = usePagedItems(rows);
  return (
    <RuntimeTablePanel
      title="我发起的"
      description="展示当前登录人发起过的流程实例和当前进度。"
      count={rows.length}
      query={query}
      onQueryChange={setQuery}
      placeholder="请输入标题 / 编号"
    >
      <RuntimeDataTable
        columns={[
          { key: 'code', label: '编号', width: '16%' },
          { key: 'title', label: '标题', width: '22%' },
          { key: 'workflow', label: '流程模型', width: '18%' },
          { key: 'node', label: '当前节点', width: '14%' },
          { key: 'status', label: '状态', width: '10%' },
          { key: 'createdAt', label: '发起时间', width: '12%' },
          { key: 'action', label: '操作', width: '8%', align: 'right' },
        ]}
        emptyText="暂无你发起的流程。请先到“发起流程”里选择一个已发布流程模型发起。"
        colSpan={7}
      >
        {pagedItems.map((item) => (
          <tr key={item.id} className="border-b border-border last:border-0">
            <RuntimeDataCell value={item.code} />
            <RuntimeDataCell value={item.title} strong />
            <RuntimeDataCell value={item.workflowName} />
            <RuntimeDataCell value={item.currentNodeLabel || '-'} />
            <td className="border-r border-border px-3 py-2"><StatusBadge status={item.status} /></td>
            <RuntimeDataCell value={formatDateTime(item.createdAt)} />
            <td className="px-3 py-2">
              <div className="flex justify-end gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setSelectedInstance(item)}>详情</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 px-3" disabled={item.status !== 'running'} onClick={() => void props.onWithdraw(item)}>撤回</Button>
              </div>
            </td>
          </tr>
        ))}
      </RuntimeDataTable>
      <RuntimePagination
        total={rows.length}
        pageStart={pageStart}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      {selectedInstance && (
        <WorkflowInstanceDetailDialog
          instance={selectedInstance}
          forms={props.forms}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </RuntimeTablePanel>
  );
}

function CcTab(props: { snapshot: WorkflowRuntimeSnapshot }) {
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLowerCase();
  const rows = props.snapshot.myCc.filter((cc) => {
    if (!keyword) return true;
    return [cc.instanceCode, cc.title, cc.workflowName, cc.nodeLabel, cc.status]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const { currentPage, pageSize, pageStart, pagedItems, setPage, setPageSize, totalPages } = usePagedItems(rows);
  return (
    <RuntimeTablePanel
      title="抄送我的"
      description="展示流程中抄送给当前登录人的通知和只读事项。"
      count={rows.length}
      query={query}
      onQueryChange={setQuery}
      placeholder="请输入标题 / 编号"
    >
      <RuntimeDataTable
        columns={[
          { key: 'code', label: '编号', width: '18%' },
          { key: 'title', label: '标题', width: '24%' },
          { key: 'workflow', label: '流程模型', width: '20%' },
          { key: 'node', label: '抄送节点', width: '16%' },
          { key: 'createdAt', label: '抄送时间', width: '14%' },
          { key: 'status', label: '状态', width: '8%' },
        ]}
        emptyText="暂无抄送事项。"
        colSpan={6}
      >
        {pagedItems.map((cc) => (
          <tr key={cc.id} className="border-b border-border last:border-0">
            <RuntimeDataCell value={cc.instanceCode} />
            <RuntimeDataCell value={cc.title} strong />
            <RuntimeDataCell value={cc.workflowName} />
            <RuntimeDataCell value={cc.nodeLabel} />
            <RuntimeDataCell value={formatDateTime(cc.createdAt)} />
            <td className="px-3 py-2"><StatusBadge status={cc.status} /></td>
          </tr>
        ))}
      </RuntimeDataTable>
      <RuntimePagination
        total={rows.length}
        pageStart={pageStart}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </RuntimeTablePanel>
  );
}

function RunningProcessesTab(props: {
  instances: WorkflowInstance[];
  forms: WorkflowFormTemplate[];
  canManage: boolean;
  saving: boolean;
  onTerminate: (instance: WorkflowInstance) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const keyword = query.trim().toLowerCase();
  const rows = props.instances.filter((item) => {
    if (!keyword) return true;
    return [item.code, item.title, item.workflowName, item.currentNodeLabel, item.initiatorName, item.initiatorEmail]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
  const { currentPage, pageSize, pageStart, pagedItems, setPage, setPageSize, totalPages } = usePagedItems(rows);
  return (
    <RuntimeTablePanel
      title="流程数据"
      description="展示当前仍在流转中的流程实例，管理员可处理异常流程。"
      count={rows.length}
      query={query}
      onQueryChange={setQuery}
      placeholder="请输入标题 / 编号"
    >
      <RuntimeDataTable
        columns={[
          { key: 'code', label: '编号', width: '16%' },
          { key: 'title', label: '标题', width: '22%' },
          { key: 'workflow', label: '流程模型', width: '16%' },
          { key: 'node', label: '当前节点', width: '14%' },
          { key: 'initiator', label: '发起人', width: '12%' },
          { key: 'createdAt', label: '发起时间', width: '12%' },
          { key: 'action', label: '操作', width: '8%', align: 'right' },
        ]}
        emptyText="暂无运行中的流程。"
        colSpan={7}
      >
        {pagedItems.map((item) => (
          <tr key={item.id} className="border-b border-border last:border-0">
            <RuntimeDataCell value={item.code} />
            <RuntimeDataCell value={item.title} strong />
            <RuntimeDataCell value={item.workflowName} />
            <RuntimeDataCell value={item.currentNodeLabel || '-'} />
            <RuntimeDataCell value={item.initiatorName || item.initiatorEmail || '-'} />
            <RuntimeDataCell value={formatDateTime(item.createdAt)} />
            <td className="px-3 py-2">
              <div className="flex justify-end gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setSelectedInstance(item)}>详情</Button>
                {props.canManage && (
                  <Button type="button" variant="destructive" size="sm" className="h-8 px-3" disabled={props.saving} onClick={() => void props.onTerminate(item)}>
                    终止
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </RuntimeDataTable>
      <RuntimePagination
        total={rows.length}
        pageStart={pageStart}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      {selectedInstance && (
        <WorkflowInstanceDetailDialog
          instance={selectedInstance}
          forms={props.forms}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </RuntimeTablePanel>
  );
}

function RuntimeTablePanel(props: {
  title: string;
  description: string;
  count: number;
  query: string;
  placeholder: string;
  onQueryChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-surface-0 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-title-3 font-bold text-ink-primary">{props.title}</h2>
          <p className="mt-1 text-body text-ink-secondary">{props.description}</p>
        </div>
        <Badge variant="outline" className="h-8 rounded-md px-3 text-caption">{props.count} 条</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder={props.placeholder}
          className="h-9 max-w-[260px]"
        />
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface-0">
        {props.children}
      </div>
    </div>
  );
}

function RuntimeDataTable(props: {
  columns: Array<{ key: string; label: string; width: string; align?: 'left' | 'right' }>;
  emptyText: string;
  colSpan: number;
  children: ReactNode;
}) {
  const hasRows = Array.isArray(props.children) ? props.children.length > 0 : Boolean(props.children);
  return (
    <table className="w-full table-fixed border-collapse text-caption">
      <colgroup>
        {props.columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}
      </colgroup>
      <thead className="bg-surface-1 text-left text-caption text-ink-secondary">
        <tr>
          {props.columns.map((column) => (
            <th key={column.key} className={`border-b border-r border-border px-3 py-2 font-bold last:border-r-0 ${column.align === 'right' ? 'text-right' : ''}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hasRows ? props.children : (
          <tr>
            <td colSpan={props.colSpan} className="px-4 py-12 text-center text-body text-ink-tertiary">{props.emptyText}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function RuntimeDataCell(props: { value?: string; strong?: boolean }) {
  return (
    <td className="min-w-0 border-r border-border px-3 py-2 text-ink-secondary last:border-r-0">
      <span className={`block truncate ${props.strong ? 'font-semibold text-ink-primary' : ''}`} title={props.value || '-'}>
        {props.value || '-'}
      </span>
    </td>
  );
}

function WorkflowTaskDetailDialog(props: {
  task: WorkflowTask;
  instance?: WorkflowInstance;
  forms: WorkflowFormTemplate[];
  comments: Record<string, string>;
  formData: Record<string, Record<string, unknown>>;
  saving: boolean;
  setComments: (next: Record<string, string>) => void;
  setFormData: (next: Record<string, Record<string, unknown>>) => void;
  onClose: () => void;
  onComplete: (task: WorkflowTask, decision: WorkflowDecision) => Promise<void>;
}) {
  const instanceForm = props.instance?.formTemplateId ? props.forms.find((form) => form.id === props.instance?.formTemplateId) : undefined;
  const nodeConfig = props.instance?.workflowSnapshot.nodes.find((node) => node.id === props.task.nodeId);
  const formPermissionById = new Map((nodeConfig?.formPermissions ?? []).map((permission) => [permission.fieldId, permission]));
  const effectiveForm = instanceForm ? {
    ...instanceForm,
    fields: instanceForm.fields.map((field) => ({ ...field, ...(formPermissionById.get(field.id) ?? {}) })),
  } : undefined;
  const operationPermissions = { ...defaultWorkflowOperationPermissions(), ...(nodeConfig?.operationPermissions ?? {}) };
  const approvalFormData = props.formData[props.task.id] ?? {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={props.onClose}>
      <div className="grid max-h-[88vh] w-full max-w-[980px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-border bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-title-3 font-bold text-ink-primary">待办详情</h3>
            <p className="mt-1 text-body text-ink-secondary">{props.task.workflowName} / {props.task.nodeLabel}</p>
          </div>
          <Button type="button" variant="outline" disabled={props.saving} onClick={props.onClose}>关闭</Button>
        </div>

        <div className="min-h-0 overflow-auto p-5">
          <div className="grid gap-4">
            <section className="rounded-md border border-border bg-surface-0 p-4">
              <h4 className="mb-3 text-body font-bold text-ink-primary">流程信息</h4>
              <div className="grid gap-3 text-body md:grid-cols-2">
                <InfoCell label="任务编号" value={props.task.id} />
                <InfoCell label="流程编号" value={props.task.instanceCode} />
                <InfoCell label="流程标题" value={props.task.title} />
                <InfoCell label="发起人" value={props.task.initiatorName || props.task.initiatorEmail || '-'} />
                <InfoCell label="当前节点" value={props.task.nodeLabel} />
                <InfoCell label="当前处理人" value={props.task.assigneeName || props.task.assigneeEmail || '-'} />
                <InfoCell label="到达时间" value={formatDateTime(props.task.createdAt)} />
                <InfoCell label="业务单据" value={props.task.businessType || props.task.businessId ? `${props.task.businessType || '-'} / ${props.task.businessId || '-'}` : '-'} />
              </div>
            </section>
            {props.instance && (
              <SubmittedFormPanel
                title="发起表单"
                form={effectiveForm}
                data={props.instance.formData ?? {}}
              />
            )}
            {effectiveForm && (
              <section className="rounded-md border border-border bg-surface-0 p-4">
                <h4 className="mb-3 text-body font-bold text-ink-primary">审批补充数据</h4>
                <DynamicForm
                  form={effectiveForm}
                  value={approvalFormData}
                  onChange={(value) => props.setFormData({ ...props.formData, [props.task.id]: value })}
                />
              </section>
            )}
            {props.instance && (
              <section className="rounded-md border border-border bg-surface-0 p-4">
                <h4 className="mb-3 text-body font-bold text-ink-primary">审批流程</h4>
                <WorkflowHistoryTimeline instance={props.instance} compact />
              </section>
            )}
            <section className="rounded-md border border-border bg-surface-0 p-4">
              <h4 className="mb-3 text-body font-bold text-ink-primary">审批意见</h4>
              <Textarea
                value={props.comments[props.task.id] ?? ''}
                onChange={(e) => props.setComments({ ...props.comments, [props.task.id]: e.target.value })}
                placeholder="审批意见；退回或驳回时建议填写原因"
                className="min-h-[84px]"
              />
            </section>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface-0 px-5 py-4">
          {operationPermissions.back && <Button type="button" variant="outline" disabled={props.saving} onClick={() => void props.onComplete(props.task, 'returned')}>退回</Button>}
          {operationPermissions.refuse && <Button type="button" variant="destructive" disabled={props.saving} onClick={() => void props.onComplete(props.task, 'rejected')}>驳回</Button>}
          {operationPermissions.complete && <Button type="button" disabled={props.saving} className="bg-brand-500 text-white hover:bg-brand-600" onClick={() => void props.onComplete(props.task, 'approved')}>通过</Button>}
        </div>
      </div>
    </div>
  );
}

function WorkflowInstanceDetailDialog(props: { instance: WorkflowInstance; forms: WorkflowFormTemplate[]; onClose: () => void }) {
  const form = props.instance.formTemplateId ? props.forms.find((item) => item.id === props.instance.formTemplateId) : undefined;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={props.onClose}>
      <div className="grid max-h-[88vh] w-full max-w-[920px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-title-3 font-bold text-ink-primary">流程详情</h3>
            <p className="mt-1 text-body text-ink-secondary">{props.instance.workflowName} / {props.instance.currentNodeLabel || '-'}</p>
          </div>
          <Button type="button" variant="outline" onClick={props.onClose}>关闭</Button>
        </div>
        <div className="min-h-0 overflow-auto p-5">
          <div className="grid gap-4">
            <section className="rounded-md border border-border bg-surface-0 p-4">
              <h4 className="mb-3 text-body font-bold text-ink-primary">流程信息</h4>
              <div className="grid gap-3 text-body md:grid-cols-2">
                <InfoCell label="编号" value={props.instance.code} />
                <InfoCell label="标题" value={props.instance.title} />
                <InfoCell label="流程模型" value={props.instance.workflowName} />
                <InfoCell label="当前节点" value={props.instance.currentNodeLabel || '-'} />
                <InfoCell label="状态" value={STATUS_LABELS[props.instance.status] || props.instance.status} />
                <InfoCell label="发起时间" value={formatDateTime(props.instance.createdAt)} />
                <InfoCell label="发起人" value={props.instance.initiatorName || props.instance.initiatorEmail || '-'} />
                <InfoCell label="业务单据" value={props.instance.businessType || props.instance.businessId ? `${props.instance.businessType || '-'} / ${props.instance.businessId || '-'}` : '-'} />
              </div>
            </section>
            <SubmittedFormPanel title="发起表单" form={form} data={props.instance.formData ?? {}} />
            <section className="rounded-md border border-border bg-surface-0 p-4">
              <h4 className="mb-3 text-body font-bold text-ink-primary">审批流程</h4>
              <WorkflowHistoryTimeline instance={props.instance} compact />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StartTab(props: {
  workflows: WorkflowTemplate[];
  forms: WorkflowFormTemplate[];
  selectedWorkflow?: WorkflowTemplate;
  selectedStartForm?: WorkflowFormTemplate;
  selectedWorkflowId: string;
  setSelectedWorkflowId: (id: string) => void;
  startTitle: string;
  setStartTitle: (value: string) => void;
  startFormData: Record<string, unknown>;
  setStartFormData: (value: Record<string, unknown>) => void;
  workflowSearch: string;
  setWorkflowSearch: (value: string) => void;
  startDialogOpen: boolean;
  setStartDialogOpen: (open: boolean) => void;
  saving: boolean;
  onStart: (e: FormEvent) => Promise<void>;
}) {
  const query = props.workflowSearch.trim().toLowerCase();
  const availableWorkflows = props.workflows.filter((workflow) => workflow.status === 'published' && ['manual', 'both'].includes(workflow.launchMode || 'manual'));
  const workflows = query
    ? availableWorkflows.filter((workflow) => [workflow.name, workflow.description, workflow.group, workflow.code].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
    : availableWorkflows;
  const grouped = workflows.reduce<Record<string, WorkflowTemplate[]>>((acc, workflow) => {
    const group = workflow.group || '未分组';
    acc[group] = [...(acc[group] || []), workflow];
    return acc;
  }, {});

  function selectWorkflow(workflow: WorkflowTemplate) {
    const launchFormId = workflow.nodeForms[0]?.formTemplateIds[0];
    const launchForm = launchFormId ? props.forms.find((form) => form.id === launchFormId) : undefined;
    if (!launchForm) return;
    props.setSelectedWorkflowId(workflow.id);
    props.setStartTitle(workflow.name);
    props.setStartFormData({});
    props.setStartDialogOpen(true);
  }

  return (
    <div className="rounded-md border border-border bg-surface-0 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-title-3 font-bold text-ink-primary">发起流程</h2>
          <p className="mt-1 text-body text-ink-secondary">从已发布的流程模型中选择一个流程发起。</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-md px-3 py-2 text-body">可发起 {availableWorkflows.length}</Badge>
      </div>

      <Input
        value={props.workflowSearch}
        onChange={(e) => props.setWorkflowSearch(e.target.value)}
        placeholder="请输入流程名称"
        className="mt-4 h-10 max-w-[260px]"
      />

      {availableWorkflows.length === 0 ? (
        <div className="mt-5"><EmptyState text="暂无可手工发起的已发布流程模型。" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="mt-5"><EmptyState text="没有匹配的流程。" /></div>
      ) : (
        <div className="mt-5 space-y-5">
          {Object.entries(grouped).map(([group, rows]) => (
            <section key={group} className="border-t border-border pt-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-brand-500 pl-2 text-body font-bold text-ink-primary">{group} ({rows.length})</h3>
                <span className="text-caption text-ink-tertiary">⌄</span>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-10">
                {rows.map((workflow) => {
                  const selected = props.selectedWorkflowId === workflow.id;
                  const launchFormId = workflow.nodeForms[0]?.formTemplateIds[0];
                  const launchForm = launchFormId ? props.forms.find((form) => form.id === launchFormId) : undefined;
                  const disabled = !launchForm;
                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      disabled={disabled || props.saving}
                      title={launchForm ? `${workflow.name} / ${workflow.code}` : `${workflow.name}：未找到已发布发起表单`}
                      onClick={() => selectWorkflow(workflow)}
                      className="group min-w-0 text-center disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-md text-title-3 font-bold transition-colors ${
                        selected ? 'bg-brand-500/10 text-brand-600' : 'bg-surface-1 text-ink-tertiary group-hover:bg-brand-500/10 group-hover:text-brand-600'
                      }`}>
                        {workflowInitial(workflow.name)}
                      </span>
                      <span className={`mt-2 block truncate text-caption ${selected ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}`}>{workflow.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <WorkflowStartDialog
        open={props.startDialogOpen}
        workflow={props.selectedWorkflow}
        form={props.selectedStartForm}
        title={props.startTitle}
        formData={props.startFormData}
        saving={props.saving}
        onTitleChange={props.setStartTitle}
        onFormDataChange={props.setStartFormData}
        onClose={() => props.setStartDialogOpen(false)}
        onStart={props.onStart}
      />
    </div>
  );
}

function WorkflowStartDialog(props: {
  open: boolean;
  workflow?: WorkflowTemplate;
  form?: WorkflowFormTemplate;
  title: string;
  formData: Record<string, unknown>;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onFormDataChange: (value: Record<string, unknown>) => void;
  onClose: () => void;
  onStart: (e: FormEvent) => Promise<void>;
}) {
  if (!props.open || !props.workflow) return null;
  const approvalNodes = normalizeWorkflowDraftNodes(props.workflow.nodes as WorkflowNodeDraft[])
    .filter((node) => node.type === 'approval');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={props.onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-md border border-border bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-title-3 font-bold text-ink-primary">发起流程</h2>
            <p className="mt-1 truncate text-body text-ink-secondary">{props.workflow.name} · {props.form?.name || '流程发起表'}</p>
          </div>
          <Button type="button" variant="outline" onClick={props.onClose}>关闭</Button>
        </div>

        <form className="min-h-0 overflow-auto" onSubmit={(e) => void props.onStart(e)}>
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="runtime-start-title">流程标题</Label>
                <Input
                  id="runtime-start-title"
                  value={props.title}
                  onChange={(e) => props.onTitleChange(e.target.value)}
                  placeholder="请输入本次流程标题"
                  className="h-10"
                />
              </div>
              <DynamicForm form={props.form} value={props.formData} onChange={props.onFormDataChange} />
            </div>

            <aside className="border-l border-border pl-5">
              <p className="mb-4 text-body font-bold text-ink-primary">审批流程</p>
              <div className="space-y-4">
                <RuntimeLaunchPreviewRow title="发起人" people={['当前登录人']} active hasNext />
                {approvalNodes.map((node) => {
                  const rule = props.workflow?.assigneeRules.find((item) => item.nodeId === node.id);
                  return (
                    <RuntimeLaunchPreviewRow
                      key={node.id}
                      title={node.label || '审批人'}
                      people={assigneeRulePeople(rule)}
                      hasNext
                    />
                  );
                })}
                {approvalNodes.length === 0 && <p className="text-caption text-ink-tertiary">当前流程还没有配置审批节点。</p>}
                <RuntimeLaunchPreviewRow title="流程结束" people={[]} />
              </div>
            </aside>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-surface-0 px-5 py-4">
            <Button type="button" variant="outline" onClick={props.onClose}>取消</Button>
            <Button type="submit" disabled={props.saving} className="bg-brand-500 text-white hover:bg-brand-600">
              <Send className="mr-2 h-4 w-4" />
              {props.saving ? '提交中...' : '提交并发起'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormsTab(props: {
  forms: WorkflowFormTemplate[];
  draft: ReturnType<typeof initialFormDraft>;
  setDraft: (draft: ReturnType<typeof initialFormDraft>) => void;
  saving: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
  onStatus: (kind: 'form', id: string, status: WorkflowConfigStatus) => Promise<void>;
  onEdit: (form: WorkflowFormTemplate) => void;
}) {
  return (
    <ConfigLayout
      list={<ConfigList rows={props.forms} type="form" onEdit={props.onEdit} onStatus={props.onStatus} />}
      editor={(
        <form className="space-y-4" onSubmit={(e) => void props.onSubmit(e)}>
          <EditorHeader title={props.draft.id ? '编辑表单模板' : '新建表单模板'} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="表单名称" value={props.draft.name} onChange={(name) => props.setDraft({ ...props.draft, name })} required />
          </div>
          <TextInput label="说明" value={props.draft.description} onChange={(description) => props.setDraft({ ...props.draft, description })} />
          <SelectInput label="状态" value={props.draft.status} options={['draft', 'published', 'disabled']} labels={STATUS_LABELS} onChange={(status) => props.setDraft({ ...props.draft, status: status as WorkflowConfigStatus })} />
          <FormFieldDesigner
            fields={props.draft.fields}
            onChange={(fields) => props.setDraft({ ...props.draft, fields })}
          />
          <Button type="submit" disabled={props.saving}>
            <Save className="mr-2 h-4 w-4" />
            保存表单
          </Button>
        </form>
      )}
    />
  );
}

function ModelsTab(props: {
  workflows: WorkflowTemplate[];
  forms: WorkflowFormTemplate[];
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  draft: ReturnType<typeof initialWorkflowDraft>;
  setDraft: (draft: ReturnType<typeof initialWorkflowDraft>) => void;
  saving: boolean;
  onEditingChange: (editing: boolean) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  onStatus: (kind: 'workflow', id: string, status: WorkflowConfigStatus) => Promise<void>;
  onEdit: (workflow: WorkflowTemplate) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('');
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(WORKFLOW_MODEL_PAGE_SIZE_OPTIONS[0]);

  const groups = useMemo(() => {
    const counts = props.workflows.reduce<Record<string, number>>((acc, workflow) => {
      const group = workflow.group || '未分组';
      acc[group] = (acc[group] ?? 0) + 1;
      return acc;
    }, {});
    const groupNames = Array.from(new Set([...customGroups, ...Object.keys(counts)].filter(Boolean)));
    return groupNames.map((name) => ({ name, count: counts[name] ?? 0 }));
  }, [customGroups, props.workflows]);

  const filteredWorkflows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return props.workflows.filter((workflow) => {
      const group = workflow.group || '未分组';
      const matchGroup = !groupFilter || group === groupFilter;
      const matchStatus = statusFilter === 'all' || workflow.status === statusFilter;
      const matchKeyword = !keyword || `${workflow.name} ${workflow.code}`.toLowerCase().includes(keyword);
      return matchGroup && matchStatus && matchKeyword;
    });
  }, [groupFilter, props.workflows, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedWorkflows = filteredWorkflows.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [groupFilter, pageSize, search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WORKFLOW_CUSTOM_GROUPS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCustomGroups(parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()));
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  function persistCustomGroups(next: string[]) {
    setCustomGroups(next);
    try {
      window.localStorage.setItem(WORKFLOW_CUSTOM_GROUPS_KEY, JSON.stringify(next));
    } catch {
      /* localStorage may be unavailable */
    }
  }

  function saveGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const exists = groups.some((group) => group.name === name);
    if (!exists) persistCustomGroups([...customGroups, name]);
    setGroupFilter(name);
    setNewGroupName('');
    setAddingGroup(false);
  }

  function startNewModel() {
    const next = initialWorkflowDraft();
    if (groupFilter) next.group = groupFilter;
    props.setDraft(next);
    setEditing(true);
    props.onEditingChange(true);
  }

  function startEditModel(workflow: WorkflowTemplate) {
    props.onEdit(workflow);
    setEditing(true);
    props.onEditingChange(true);
  }

  if (editing) {
    return (
      <WorkflowModelEditor
        forms={props.forms}
        workflows={props.workflows}
        users={props.users}
        departments={props.departments}
        roles={props.roles}
        draft={props.draft}
        setDraft={props.setDraft}
        saving={props.saving}
        onSubmit={props.onSubmit}
        onBack={() => {
          setEditing(false);
          props.onEditingChange(false);
        }}
        onStatus={(status) => props.draft.id ? props.onStatus('workflow', props.draft.id, status) : Promise.resolve()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-title-lg font-bold">流程模型管理</h2>
          <p className="mt-1 text-body text-ink-secondary">统一维护流程模型，按分组管理模型，并配置基础信息、表单、流程图和高级规则。</p>
        </div>
        <Button type="button" onClick={startNewModel} className="bg-[rgb(var(--danger))] text-white hover:bg-[rgb(var(--danger))]">
          <Plus className="mr-2 h-4 w-4" />
          新增模型
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[276px_minmax(0,1fr)]">
        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
            <CardTitle className="text-title-3">流程分组</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setAddingGroup(true);
                setNewGroupName('');
              }}
              aria-label="新增流程分组"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {addingGroup && (
              <div className="rounded-md border border-border bg-surface-1 p-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveGroup();
                    if (e.key === 'Escape') {
                      setAddingGroup(false);
                      setNewGroupName('');
                    }
                  }}
                  placeholder="输入分组名称"
                  className="h-9"
                  autoFocus
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddingGroup(false);
                      setNewGroupName('');
                    }}
                  >
                    取消
                  </Button>
                  <Button type="button" size="sm" onClick={saveGroup} disabled={!newGroupName.trim()}>
                    保存
                  </Button>
                </div>
              </div>
            )}
            {groups.map((group) => (
              <button
                key={group.name}
                type="button"
                onClick={() => setGroupFilter((current) => current === group.name ? '' : group.name)}
                className={`flex h-12 w-full items-center justify-between rounded-md border px-3 text-left text-body font-medium ${
                  groupFilter === group.name ? 'border-[rgb(var(--danger) / 0.3)] bg-[rgb(var(--danger) / 0.05)] text-ink-primary' : 'border-transparent hover:bg-surface-1'
                }`}
              >
                <span>{group.name}</span>
                <span className="text-caption font-semibold">{group.count}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-md">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
              <label className="relative block min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="请输入模型名称或编码" className="pl-9" />
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-body"
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="disabled">已停用</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-body"
                aria-label="每页条数"
              >
                {WORKFLOW_MODEL_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>每页 {size} 条</option>
                ))}
              </select>
              <span className="text-body text-ink-secondary">共 {filteredWorkflows.length} 个模型</span>
            </div>

            {filteredWorkflows.length === 0 ? (
              <div className="p-5"><EmptyState text="没有匹配的流程模型。" /></div>
            ) : (
              <>
                <table className="w-full table-fixed border-collapse text-body">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[16%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-surface-1 text-left text-caption text-ink-secondary">
                    <tr>
                      <th className="border-b border-border px-4 py-3 font-medium">模型</th>
                      <th className="border-b border-border px-4 py-3 font-medium">分组</th>
                      <th className="border-b border-border px-4 py-3 font-medium">版本</th>
                      <th className="border-b border-border px-4 py-3 font-medium">状态</th>
                      <th className="border-b border-border px-4 py-3 font-medium">更新时间</th>
                      <th className="border-b border-border px-4 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWorkflows.map((workflow) => (
                      <tr key={workflow.id} className="border-b border-border last:border-0">
                        <td className="min-w-0 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-body font-semibold text-brand-600">
                              {workflow.name.slice(0, 1)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink-primary">{workflow.name}</p>
                              <p className="mt-1 truncate text-caption text-ink-tertiary">{workflow.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-0 px-4 py-3">
                          <span className="inline-flex h-8 max-w-full items-center rounded-md border border-input bg-surface-0 px-3 text-ink-secondary">
                            <span className="truncate">
                            {workflow.group || '未分组'}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-brand-500/10 px-2 py-1 text-caption font-semibold text-brand-600">v{workflow.version}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={workflow.status} /></td>
                        <td className="px-4 py-3 text-ink-secondary">
                          <span className="block truncate">{formatDateTime(workflow.updatedAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => startEditModel(workflow)} aria-label="编辑模型">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => void props.onStatus('workflow', workflow.id, workflow.status === 'published' ? 'disabled' : 'published')}
                              aria-label={workflow.status === 'published' ? '停用模型' : '发布模型'}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-danger/40 text-danger" disabled aria-label="删除模型">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-caption text-ink-secondary">
                    显示 {filteredWorkflows.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filteredWorkflows.length)} 条，共 {filteredWorkflows.length} 条
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      上一页
                    </Button>
                    <span className="min-w-16 text-center text-caption text-ink-secondary">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkflowModelEditor(props: {
  forms: WorkflowFormTemplate[];
  workflows: WorkflowTemplate[];
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  draft: ReturnType<typeof initialWorkflowDraft>;
  setDraft: (draft: ReturnType<typeof initialWorkflowDraft>) => void;
  saving: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
  onBack: () => void;
  onStatus: (status: WorkflowConfigStatus) => Promise<void>;
}) {
  const steps: Array<{ id: WorkflowEditorStep; label: string }> = [
    { id: 'basic', label: '1 基础设置' },
    { id: 'form', label: '2 表单设计' },
    { id: 'workflow', label: '3 流程设计' },
    { id: 'advanced', label: '4 高级设置' },
  ];
  const groupOptions = Array.from(new Set([...WORKFLOW_GROUP_OPTIONS, ...props.workflows.map((workflow) => workflow.group || '').filter(Boolean), props.draft.group].filter(Boolean)));
  return (
    <form className="overflow-hidden rounded-md border border-border bg-surface-0 shadow-soft-xs" onSubmit={(e) => void props.onSubmit(e)}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={props.onBack}
            className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-surface-0 text-caption font-semibold text-ink-primary hover:bg-surface-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-body font-semibold text-brand-600">
            {props.draft.name ? props.draft.name.slice(0, 1) : '新'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-title-3 font-bold text-ink-primary">{props.draft.name || '新建流程模型'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-500/10 px-2 py-1 text-caption font-semibold text-brand-600">当前版本: v1</span>
              <StatusBadge status={props.draft.status} />
            </div>
          </div>
        </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-md border border-border sm:min-w-[520px] sm:grid-cols-4">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => props.setDraft({ ...props.draft, editorStep: step.id })}
                className={`h-10 border-r border-border px-3 text-body font-semibold last:border-r-0 ${
                  props.draft.editorStep === step.id ? 'bg-brand-500/10 text-brand-600 ring-1 ring-inset ring-brand-500' : 'bg-surface-0 text-ink-primary hover:bg-surface-1'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={props.saving} variant="outline" className="h-10 px-5">
              保存
            </Button>
            <Button
              type="button"
              disabled={props.saving || !props.draft.id}
              variant="outline"
              className="h-10 px-5"
              onClick={() => void props.onStatus(props.draft.status === 'published' ? 'disabled' : 'published')}
            >
              {props.draft.status === 'published' ? '停用' : '发布'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {props.draft.editorStep === 'basic' && (
          <div className="mx-auto max-w-[960px] rounded-md border border-border bg-surface-0 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="标识" value={props.draft.code} onChange={(code) => props.setDraft({ ...props.draft, code })} required />
              <TextInput label="名称" value={props.draft.name} onChange={(name) => props.setDraft({ ...props.draft, name })} required />
              <SelectInput
                label="发起方式"
                value={props.draft.launchMode}
                options={['business', 'manual', 'both', 'disabled']}
                labels={{ business: 'business - 仅业务页面发起', manual: 'manual - 仅手工发起', both: 'both - 业务和手工发起', disabled: 'disabled - 禁止发起' }}
                onChange={(launchMode) => props.setDraft({ ...props.draft, launchMode })}
              />
              <SelectInput label="流程分组" value={props.draft.group} options={groupOptions} onChange={(group) => props.setDraft({ ...props.draft, group })} />
              <div className="md:col-span-2">
                <Label htmlFor="workflow-description">描述</Label>
                <Textarea
                  id="workflow-description"
                  value={props.draft.description}
                  onChange={(e) => props.setDraft({ ...props.draft, description: e.target.value })}
                  className="min-h-[92px]"
                />
              </div>
              <SelectInput label="状态" value={props.draft.status} options={['draft', 'published', 'disabled']} labels={STATUS_LABELS} onChange={(status) => props.setDraft({ ...props.draft, status: status as WorkflowConfigStatus })} />
            </div>
          </div>
        )}
        {props.draft.editorStep === 'form' && (
          <WorkflowFormBindingDesigner
            forms={props.forms}
            selectedFormId={props.draft.startFormTemplateId}
            formDraft={props.draft.startFormDraft}
            workflowCode={props.draft.code}
            workflowName={props.draft.name}
            onChange={(startFormDraft) => props.setDraft({ ...props.draft, startFormDraft })}
            onSelectTemplate={(form) => props.setDraft({
              ...props.draft,
              startFormTemplateId: form.id,
              startFormDraft: {
                id: form.id,
                code: form.code,
                name: form.name,
                description: form.description ?? '',
                version: form.version,
                status: form.status,
                fields: cloneFields(form.fields),
              },
            })}
          />
        )}
        {props.draft.editorStep === 'workflow' && (
          <WorkflowNodeDesigner
            nodes={props.draft.nodes}
            fields={props.draft.startFormDraft.fields}
            users={props.users}
            departments={props.departments}
            roles={props.roles}
            onChange={(nodes) => props.setDraft({ ...props.draft, nodes })}
          />
        )}
        {props.draft.editorStep === 'advanced' && <WorkflowAdvancedPanel draft={props.draft} setDraft={props.setDraft} />}
      </div>
    </form>
  );
}

function BindingsTab(props: {
  bindings: BusinessWorkflowBinding[];
  workflows: WorkflowTemplate[];
  forms: WorkflowFormTemplate[];
  selectedBindingId: string;
  businessTitle: string;
  businessId: string;
  businessFormData: Record<string, unknown>;
  selectedForm?: WorkflowFormTemplate;
  draft: ReturnType<typeof initialBindingDraft>;
  setDraft: (draft: ReturnType<typeof initialBindingDraft>) => void;
  setSelectedBindingId: (id: string) => void;
  setBusinessTitle: (value: string) => void;
  setBusinessId: (value: string) => void;
  setBusinessFormData: (value: Record<string, unknown>) => void;
  saving: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
  onBusinessStart: (e: FormEvent) => Promise<void>;
  onStatus: (kind: 'binding', id: string, status: WorkflowConfigStatus) => Promise<void>;
  onEdit: (binding: BusinessWorkflowBinding) => void;
}) {
  const [showBindingAdvanced, setShowBindingAdvanced] = useState(false);
  const enabledBindings = props.bindings.filter((binding) => binding.enabled);
  const workflowNames = Object.fromEntries(props.workflows.map((item) => [item.id, item.name]));
  const businessSceneOptions = [
    '',
    ...BUSINESS_SCENE_PRESETS.map((item) => item.businessType),
    ...props.bindings
      .map((binding) => binding.businessType)
      .filter((businessType) => businessType && !BUSINESS_SCENE_PRESETS.some((preset) => preset.businessType === businessType)),
  ];
  const businessSceneLabels: Record<string, string> = {
    '': '请选择业务场景',
    ...Object.fromEntries(BUSINESS_SCENE_PRESETS.map((item) => [item.businessType, item.label])),
    ...Object.fromEntries(props.bindings.map((binding) => [binding.businessType, binding.label || binding.businessType])),
  };
  const actionLabels: Record<string, string> = Object.fromEntries(BUSINESS_ACTION_OPTIONS.map((item) => [item.value, item.label]));
  const selectedScene = BUSINESS_SCENE_PRESETS.find((item) => item.businessType === props.draft.businessType);
  const selectedBinding = enabledBindings.find((binding) => binding.id === props.selectedBindingId) ?? enabledBindings[0];
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  async function submitBinding(e: FormEvent) {
    await props.onSubmit(e);
    setBindingDialogOpen(false);
  }
  async function submitBusinessStart(e: FormEvent) {
    await props.onBusinessStart(e);
    setValidationDialogOpen(false);
  }
  return (
    <div className="space-y-4">
      <BindingList
        bindings={props.bindings}
        workflows={props.workflows}
        forms={props.forms}
        onEdit={(binding) => {
          props.onEdit(binding);
          setShowBindingAdvanced(false);
          setBindingDialogOpen(true);
        }}
        onStatus={props.onStatus}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                props.setDraft(initialBindingDraft());
                setShowBindingAdvanced(false);
                setBindingDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建绑定
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setValidationDialogOpen(true)}>
              <Play className="mr-2 h-4 w-4" />
              绑定验证
            </Button>
          </div>
        )}
      />

      <Dialog open={bindingDialogOpen} onOpenChange={setBindingDialogOpen}>
        <DialogContent className="max-h-[86vh] w-[calc(100vw-2rem)] max-w-[480px] overflow-hidden bg-white p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>{props.draft.id ? '编辑业务绑定' : '新建业务绑定'}</DialogTitle>
            <DialogDescription>选择业务场景和触发动作，关联一个已发布的流程模型。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(86vh-88px)] overflow-y-auto px-5 py-4">
            <form className="space-y-4" onSubmit={(e) => void submitBinding(e)}>
              <SelectInput
                label="业务场景"
                value={props.draft.businessType}
                options={businessSceneOptions}
                labels={businessSceneLabels}
                required
                onChange={(businessType) => {
                  const scene = BUSINESS_SCENE_PRESETS.find((item) => item.businessType === businessType);
                  props.setDraft({
                    ...props.draft,
                    businessType,
                    action: props.draft.action || 'submit',
                    label: scene && (!props.draft.label || selectedScene?.defaultLabel === props.draft.label) ? scene.defaultLabel : props.draft.label,
                  });
                }}
              />
              <SelectInput
                label="触发动作"
                value={props.draft.action}
                options={BUSINESS_ACTION_OPTIONS.map((item) => item.value)}
                labels={actionLabels}
                required
                onChange={(action) => props.setDraft({ ...props.draft, action })}
              />
              <TextInput label="显示名称" value={props.draft.label} onChange={(label) => props.setDraft({ ...props.draft, label })} placeholder={selectedScene?.defaultLabel || '例如：通用审批'} />
              <SelectInput label="流程模型" value={props.draft.workflowTemplateId} options={['', ...props.workflows.map((item) => item.id)]} labels={{ '': '请选择流程模型', ...Object.fromEntries(props.workflows.map((item) => [item.id, item.name])) }} required onChange={(workflowTemplateId) => props.setDraft({ ...props.draft, workflowTemplateId })} />
              <SelectInput label="表单模板" value={props.draft.formTemplateId} options={['', ...props.forms.map((item) => item.id)]} labels={{ '': '不绑定表单', ...Object.fromEntries(props.forms.map((item) => [item.id, item.name])) }} onChange={(formTemplateId) => props.setDraft({ ...props.draft, formTemplateId })} />
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-left text-caption font-medium text-ink-secondary hover:bg-surface-2"
                onClick={() => setShowBindingAdvanced((value) => !value)}
              >
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  高级选项
                </span>
                <span>{showBindingAdvanced ? '收起' : '展开'}</span>
              </button>
              {showBindingAdvanced && (
                <div className="space-y-4 rounded-md border border-border bg-surface-1 p-3">
                  <SelectInput label="渲染方式" value={props.draft.renderMode} options={['dynamic_form', 'custom_page']} labels={BINDING_RENDER_MODE_LABELS} onChange={(renderMode) => props.setDraft({ ...props.draft, renderMode })} />
                  <SelectInput label="详情来源" value={props.draft.detailMode} options={['form_data', 'custom_provider']} labels={BINDING_DETAIL_MODE_LABELS} onChange={(detailMode) => props.setDraft({ ...props.draft, detailMode })} />
                  <TextInput label="优先级" type="number" value={String(props.draft.priority)} onChange={(priority) => props.setDraft({ ...props.draft, priority: Number(priority) || 100 })} />
                  <label className="flex items-center gap-2 text-caption text-ink-secondary">
                    <input type="checkbox" checked={props.draft.enabled} onChange={(e) => props.setDraft({ ...props.draft, enabled: e.target.checked })} />
                    启用绑定
                  </label>
                </div>
              )}
              <Button type="submit" disabled={props.saving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                保存绑定
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent className="max-h-[86vh] w-[calc(100vw-2rem)] max-w-[560px] overflow-hidden bg-white p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>绑定验证</DialogTitle>
            <DialogDescription>用于管理员模拟业务动作发起流程，不作为正式业务菜单。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(86vh-88px)] overflow-y-auto px-5 py-4">
            {enabledBindings.length === 0 ? (
              <EmptyState text="暂无已启用业务绑定。请先绑定一个已发布流程模型。" />
            ) : (
              <form className="space-y-3" onSubmit={(e) => void submitBusinessStart(e)}>
                <SelectInput
                  label="业务绑定"
                  value={props.selectedBindingId}
                  options={enabledBindings.map((binding) => binding.id)}
                  labels={Object.fromEntries(enabledBindings.map((binding) => [binding.id, `${binding.label || businessSceneLabels[binding.businessType] || binding.businessType} · ${actionLabels[binding.action] || binding.action}`]))}
                  onChange={(id) => {
                    props.setSelectedBindingId(id);
                    props.setBusinessFormData({});
                  }}
                />
                <TextInput label="业务单号" value={props.businessId} onChange={props.setBusinessId} placeholder="留空自动生成测试单号" />
                <TextInput label="流程标题" value={props.businessTitle} onChange={props.setBusinessTitle} placeholder="留空使用绑定名称" />
                <div className="rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-secondary">
                  流程模型：{workflowNames[selectedBinding?.workflowTemplateId ?? ''] || '-'}
                </div>
                <DynamicForm form={props.selectedForm} value={props.businessFormData} onChange={props.setBusinessFormData} />
                <Button type="submit" disabled={props.saving} variant="outline" className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  验证发起
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminTab(props: {
  snapshot: WorkflowRuntimeSnapshot;
  saving: boolean;
  onTransfer: (task: WorkflowTask) => Promise<void>;
  onComplete: (task: WorkflowTask, decision: Exclude<WorkflowDecision, 'returned'>) => Promise<void>;
  onTerminate: (instance: WorkflowInstance) => Promise<void>;
}) {
  const running = props.snapshot.instances.filter((item) => item.status === 'running');
  const openTasks = props.snapshot.visibleTasks.filter((item) => item.status === 'open');
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4">
          <SectionTitle title="运行中流程" description="用于处理卡住、异常或需要终止的流程实例。" />
          {running.length === 0 ? <EmptyState text="暂无运行中的流程。" /> : running.map((item) => (
            <Card key={item.id} className="rounded-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink-primary">{item.title}</p>
                    <p className="text-caption text-ink-tertiary">{item.code} · {item.currentNodeLabel || '-'}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <WorkflowHistoryTimeline instance={item} compact />
                <Button variant="destructive" size="sm" disabled={props.saving} onClick={() => void props.onTerminate(item)}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  终止流程
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="space-y-4">
          <SectionTitle title="打开的待办" description="管理员可转办或代审批。" />
          {openTasks.length === 0 ? <EmptyState text="暂无打开的待办。" /> : openTasks.map((task) => (
            <Card key={task.id} className="rounded-md">
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="text-body font-medium text-ink-primary">{task.title}</p>
                  <p className="text-caption text-ink-tertiary">{task.workflowName} · {task.nodeLabel} · {task.assigneeName || task.assigneeEmail}</p>
                  {(task.businessType || task.businessId) && (
                    <p className="mt-1 text-caption text-ink-secondary">业务：{task.businessType || '-'} / {task.businessId || '-'}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={props.saving} onClick={() => void props.onTransfer(task)}>转办</Button>
                  <Button size="sm" disabled={props.saving} onClick={() => void props.onComplete(task, 'approved')}>代同意</Button>
                  <Button variant="destructive" size="sm" disabled={props.saving} onClick={() => void props.onComplete(task, 'rejected')}>代驳回</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
      <WorkflowRuntimeLedger snapshot={props.snapshot} />
    </div>
  );
}

function FormFieldDesigner(props: {
  fields: WorkflowFormField[];
  onChange: (fields: WorkflowFormField[]) => void;
}) {
  function addField(type: WorkflowFormField['type']) {
    const index = props.fields.length + 1;
    props.onChange([
      ...props.fields,
      {
        id: `field_${index}`,
        label: FIELD_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? '字段',
        type,
        section: '基本信息',
        required: false,
        options: type === 'select' || type === 'multiselect' ? ['选项一', '选项二'] : undefined,
      },
    ]);
  }

  function updateField(index: number, patch: Partial<WorkflowFormField>) {
    props.onChange(props.fields.map((field, i) => i === index ? { ...field, ...patch } : field));
  }

  function moveField(index: number, offset: -1 | 1) {
    const next = [...props.fields];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    props.onChange(next);
  }

  function removeField(index: number) {
    props.onChange(props.fields.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-4 rounded-md border border-border bg-surface-1 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-body font-medium text-ink-primary">字段组件</p>
          <p className="mt-1 text-caption text-ink-secondary">选择组件后会添加到当前表单，可直接调整属性。</p>
        </div>
        <span className="text-caption text-ink-tertiary">{props.fields.length} 个字段</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FIELD_TYPE_OPTIONS.map((type) => (
          <Button key={type.value} type="button" variant="outline" size="sm" onClick={() => addField(type.value)}>
            {type.label}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {props.fields.length === 0 ? (
          <EmptyState text="还没有字段，请从上方字段组件中添加。" />
        ) : props.fields.map((field, index) => (
          <div key={`${field.id}-${index}`} className="rounded-md border border-border bg-surface-0 p-3">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-500/10 text-caption font-medium text-brand-500">{index + 1}</span>
                <strong className="text-body text-ink-primary">{field.label || field.id}</strong>
                <StatusBadge status={field.hidden ? 'disabled' : 'published'} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveField(index, -1)}>上移</Button>
                <Button type="button" variant="outline" size="sm" disabled={index === props.fields.length - 1} onClick={() => moveField(index, 1)}>下移</Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeField(index)}>删除</Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="字段名称" value={field.label} onChange={(label) => updateField(index, { label })} required />
              <SelectInput label="字段类型" value={field.type} options={FIELD_TYPE_OPTIONS.map((item) => item.value)} labels={Object.fromEntries(FIELD_TYPE_OPTIONS.map((item) => [item.value, item.label]))} onChange={(type) => updateField(index, { type: type as WorkflowFormField['type'] })} />
              <TextInput label="分组" value={field.section ?? ''} onChange={(section) => updateField(index, { section })} />
              <TextInput label="占位提示" value={field.placeholder ?? ''} onChange={(placeholder) => updateField(index, { placeholder })} />
              <TextInput label="说明" value={field.helpText ?? ''} onChange={(helpText) => updateField(index, { helpText })} />
              {(field.type === 'select' || field.type === 'multiselect' || field.type === 'checkbox') && (
                <TextInput label="选项" value={(field.options ?? []).join('，')} onChange={(value) => updateField(index, { options: splitOptions(value) })} placeholder="用逗号分隔" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-caption text-ink-secondary">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateField(index, { required: e.target.checked })} />必填</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(field.readonly)} onChange={(e) => updateField(index, { readonly: e.target.checked })} />只读</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(field.hidden)} onChange={(e) => updateField(index, { hidden: e.target.checked })} />隐藏</label>
            </div>
            <div className="mt-3 rounded-md border border-dashed border-border bg-surface-1 p-3">
              <FieldInput field={field} value={field.defaultValue ?? ''} onChange={() => undefined} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowFormBindingDesigner(props: {
  forms: WorkflowFormTemplate[];
  selectedFormId: string;
  formDraft: ReturnType<typeof initialFormDraft>;
  workflowCode: string;
  workflowName: string;
  onChange: (formDraft: ReturnType<typeof initialFormDraft>) => void;
  onSelectTemplate: (form: WorkflowFormTemplate) => void;
}) {
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
  const [propertyTab, setPropertyTab] = useState<'field' | 'form'>('field');
  const [leftPanelTab, setLeftPanelTab] = useState<'components' | 'templates'>('components');
  const selectedField = props.formDraft.fields[selectedFieldIndex];
  const formName = props.formDraft.name || defaultWorkflowFormName(props.workflowName);

  useEffect(() => {
    if (selectedFieldIndex >= props.formDraft.fields.length) {
      setSelectedFieldIndex(Math.max(0, props.formDraft.fields.length - 1));
    }
  }, [props.formDraft.fields.length, selectedFieldIndex]);

  function patchForm(patch: Partial<ReturnType<typeof initialFormDraft>>) {
    props.onChange({ ...props.formDraft, ...patch });
  }

  function addField(type: WorkflowFormField['type']) {
    const index = props.formDraft.fields.length + 1;
    const label = FIELD_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? '字段';
    const field: WorkflowFormField = {
      id: `${type}_${index}`,
      label,
      type,
      section: '基本信息',
      required: false,
      options: type === 'select' || type === 'multiselect' || type === 'checkbox' ? ['选项一', '选项二'] : undefined,
    };
    props.onChange({ ...props.formDraft, fields: [...props.formDraft.fields, field] });
    setSelectedFieldIndex(props.formDraft.fields.length);
    setPropertyTab('field');
    setLeftPanelTab('components');
  }

  function updateField(index: number, patch: Partial<WorkflowFormField>) {
    props.onChange({
      ...props.formDraft,
      fields: props.formDraft.fields.map((field, i) => i === index ? { ...field, ...patch } : field),
    });
  }

  function moveField(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= props.formDraft.fields.length) return;
    const next = [...props.formDraft.fields];
    [next[index], next[target]] = [next[target], next[index]];
    props.onChange({ ...props.formDraft, fields: next });
    setSelectedFieldIndex(target);
  }

  function duplicateField(index: number) {
    const source = props.formDraft.fields[index];
    if (!source) return;
    const copy: WorkflowFormField = {
      ...source,
      id: `${source.id}_copy_${Date.now().toString(36).slice(-4)}`,
      label: `${source.label}副本`,
      options: source.options ? [...source.options] : undefined,
    };
    const next = [...props.formDraft.fields.slice(0, index + 1), copy, ...props.formDraft.fields.slice(index + 1)];
    props.onChange({ ...props.formDraft, fields: next });
    setSelectedFieldIndex(index + 1);
  }

  function removeField(index: number) {
    const next = props.formDraft.fields.filter((_, i) => i !== index);
    props.onChange({ ...props.formDraft, fields: next });
    setSelectedFieldIndex(Math.max(0, index - 1));
  }

  return (
    <div className="grid min-h-[520px] overflow-hidden rounded-md border border-border bg-surface-0 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
      <aside className="border-r border-border bg-surface-1">
        <div className="grid grid-cols-2 border-b border-border">
          <button
            type="button"
            onClick={() => setLeftPanelTab('components')}
            className={`h-10 border-r border-border text-body font-semibold ${leftPanelTab === 'components' ? 'bg-surface-0 text-brand-600' : 'text-ink-secondary hover:bg-surface-0'}`}
          >
            组件库
          </button>
          <button
            type="button"
            onClick={() => setLeftPanelTab('templates')}
            className={`h-10 text-body font-semibold ${leftPanelTab === 'templates' ? 'bg-surface-0 text-brand-600' : 'text-ink-secondary hover:bg-surface-0'}`}
          >
            模板
          </button>
        </div>
        <div className="space-y-5 p-3">
          {leftPanelTab === 'components' ? (
          <div>
            <p className="mb-3 text-caption font-semibold text-ink-primary">基础字段</p>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPE_OPTIONS.slice(0, 10).map((field) => (
                <button
                  key={field.value}
                  type="button"
                  onClick={() => addField(field.value)}
                  className="h-9 rounded-md border border-border bg-surface-0 px-2 text-caption font-medium hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
          ) : (
          <div>
            <p className="mb-3 text-caption font-semibold text-ink-primary">套用已保存表单</p>
            <div className="space-y-2">
              {props.forms.length === 0 ? (
                <EmptyState text="暂无可套用模板。" />
              ) : props.forms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => {
                    props.onSelectTemplate(form);
                    setSelectedFieldIndex(0);
                    setPropertyTab('form');
                    setLeftPanelTab('templates');
                  }}
                  className={`w-full rounded-md border p-3 text-left ${
                    props.selectedFormId === form.id ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface-0 hover:bg-surface-1'
                  }`}
                >
                  <p className="truncate text-body font-semibold text-ink-primary">{form.name}</p>
                  <p className="mt-1 truncate text-caption text-ink-tertiary">{form.code} · {form.fields.length} 字段</p>
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 overflow-hidden border-r border-border">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              props.onChange({
                id: '',
                code: '',
                name: '',
                description: '',
                version: 1,
                status: 'draft' as WorkflowConfigStatus,
                fields: cloneFields(DEFAULT_FIELD_ROWS),
              });
              setSelectedFieldIndex(0);
            }}
          >
            新建表单
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLeftPanelTab('templates');
              setPropertyTab('form');
            }}
          >
            已保存表单({props.forms.length})
          </Button>
          <Button type="button" variant="outline" onClick={() => setPropertyTab('field')}>当前字段 {props.formDraft.fields.length}</Button>
          <span className="flex-1" />
          <Button type="button" variant="outline" onClick={() => setPropertyTab('form')}>表单属性</Button>
          <Button type="button" variant="outline" onClick={() => patchForm({ id: '', version: props.formDraft.version + 1, status: 'draft' })}>复制为新版本</Button>
          <Button type="button" variant="outline" onClick={() => patchForm({ status: props.formDraft.status === 'disabled' ? 'draft' : 'disabled' })}>
            {props.formDraft.status === 'disabled' ? '启用' : '停用'}
          </Button>
        </div>
        <div className="border-b border-border p-4">
          <Input value={formName} onChange={(e) => patchForm({ name: e.target.value })} placeholder="表单名称" />
        </div>
        <div className="overflow-hidden bg-[rgb(var(--surface-2))] p-4">
          {props.formDraft.fields.length === 0 ? (
            <EmptyState text="请从左侧组件库添加表单字段。" />
          ) : (
            <div className="space-y-3">
              {props.formDraft.fields.map((field, index) => (
                <div
                  key={`${field.id}-${index}`}
                  onClick={() => {
                    setSelectedFieldIndex(index);
                    setPropertyTab('field');
                  }}
                  className={`grid w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden border bg-surface-0 p-3 text-left lg:grid-cols-[112px_minmax(0,1fr)_116px] ${
                    selectedFieldIndex === index && propertyTab === 'field' ? 'border-brand-500 shadow-soft-xs' : 'border-dashed border-[rgb(var(--brand-100))] hover:border-brand-300'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-danger">{field.required ? '*' : ''}</span>
                    <span className="truncate font-semibold text-ink-primary">{field.label}</span>
                  </div>
                  <div className="min-w-0">
                    <CompactFieldPreview field={field} />
                  </div>
                  <div className="flex min-w-0 justify-end gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveField(index, -1); }} aria-label="上移">↑</Button>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" disabled={index === props.formDraft.fields.length - 1} onClick={(e) => { e.stopPropagation(); moveField(index, 1); }} aria-label="下移">↓</Button>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); duplicateField(index); }} aria-label="复制">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0 border-danger/30 text-danger" onClick={(e) => { e.stopPropagation(); removeField(index); }} aria-label="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="bg-surface-1">
        <div className="border-b border-border bg-surface-1 p-2">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setPropertyTab('field')}
            className={`h-9 rounded-md text-body font-semibold transition-colors ${
              propertyTab === 'field' ? 'bg-white text-brand-600 shadow-soft-xs' : 'text-ink-secondary hover:bg-white/70'
            }`}
          >
            组件属性
          </button>
          <button
            type="button"
            onClick={() => setPropertyTab('form')}
            className={`h-9 rounded-md text-body font-semibold transition-colors ${
              propertyTab === 'form' ? 'bg-white text-brand-600 shadow-soft-xs' : 'text-ink-secondary hover:bg-white/70'
            }`}
          >
            表单属性
          </button>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {propertyTab === 'field' && selectedField ? (
            <>
              <p className="text-body font-semibold text-ink-primary">组件属性</p>
              <TextInput label="字段名称" value={selectedField.label} onChange={(label) => updateField(selectedFieldIndex, { label })} required />
              <SelectInput
                label="字段类型"
                value={selectedField.type}
                options={FIELD_TYPE_OPTIONS.map((item) => item.value)}
                labels={Object.fromEntries(FIELD_TYPE_OPTIONS.map((item) => [item.value, item.label]))}
                onChange={(type) => updateField(selectedFieldIndex, {
                  type: type as WorkflowFormField['type'],
                  options: ['select', 'multiselect', 'checkbox'].includes(type) ? selectedField.options ?? ['选项一', '选项二'] : undefined,
                })}
              />
              <TextInput label="分组" value={selectedField.section ?? ''} onChange={(section) => updateField(selectedFieldIndex, { section })} />
              <TextInput label="占位提示" value={selectedField.placeholder ?? ''} onChange={(placeholder) => updateField(selectedFieldIndex, { placeholder })} />
              <TextInput label="默认值" value={selectedField.defaultValue ?? ''} onChange={(defaultValue) => updateField(selectedFieldIndex, { defaultValue })} />
              <div>
                <Label htmlFor="workflow-field-help">说明</Label>
                <Textarea
                  id="workflow-field-help"
                  value={selectedField.helpText ?? ''}
                  onChange={(e) => updateField(selectedFieldIndex, { helpText: e.target.value })}
                  className="min-h-[92px]"
                />
              </div>
              {(selectedField.type === 'select' || selectedField.type === 'multiselect' || selectedField.type === 'checkbox') && (
                <TextInput label="选项" value={(selectedField.options ?? []).join('，')} onChange={(value) => updateField(selectedFieldIndex, { options: splitOptions(value) })} placeholder="用逗号分隔" />
              )}
              <div className="grid gap-2 text-caption text-ink-secondary">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(selectedField.required)} onChange={(e) => updateField(selectedFieldIndex, { required: e.target.checked })} />必填</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(selectedField.readonly)} onChange={(e) => updateField(selectedFieldIndex, { readonly: e.target.checked })} />只读</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(selectedField.hidden)} onChange={(e) => updateField(selectedFieldIndex, { hidden: e.target.checked })} />隐藏</label>
              </div>
            </>
          ) : (
            <>
              <p className="text-body font-semibold text-ink-primary">表单属性</p>
              <div>
                <Label htmlFor="bound-form-name">表单名称</Label>
                <Input id="bound-form-name" value={formName} onChange={(e) => patchForm({ name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="form-bind-desc">说明</Label>
                <Textarea id="form-bind-desc" value={props.formDraft.description} onChange={(e) => patchForm({ description: e.target.value })} className="min-h-[128px]" />
              </div>
              <SelectInput label="表单状态" value={props.formDraft.status} options={['draft', 'published', 'disabled']} labels={STATUS_LABELS} onChange={(status) => patchForm({ status: status as WorkflowConfigStatus })} />
              <div className="rounded-md border border-border bg-surface-0 p-3 text-caption text-ink-secondary">
                保存流程模型时会先保存此表单模板，再自动绑定到开始节点。
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function WorkflowNodeDesigner(props: {
  nodes: WorkflowNodeDraft[];
  fields: WorkflowFormField[];
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  onChange: (nodes: WorkflowNodeDraft[]) => void;
}) {
  const nodes = normalizeWorkflowDraftNodes(props.nodes);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const selectedNode = selectedIndex === null ? undefined : nodes[Math.min(selectedIndex, nodes.length - 1)];

  function updateNode(index: number, patch: Partial<WorkflowNodeDraft>) {
    props.onChange(nodes.map((node, i) => i === index ? { ...node, ...patch } : node));
  }

  function changeZoom(delta: number) {
    setZoom((value) => Math.min(130, Math.max(70, value + delta)));
  }

  function addNode(type: WorkflowNodeType, insertIndex = Math.max(1, nodes.length - 1)) {
    const insertAt = Math.min(Math.max(1, insertIndex), Math.max(1, nodes.length - 1));
    const id = `${type}_${Date.now().toString(36)}`;
    const label = NODE_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? '节点';
    const node: WorkflowNodeDraft = {
      id,
      label,
      type,
      assigneeMode: type === 'form' ? 'initiator' : 'user',
      assigneeValue: '',
      multiApprovalMode: 'sequential',
      multiApprovalPercent: 100,
      emptyAssigneeAction: 'pass',
      operationPermissions: defaultWorkflowOperationPermissions(),
    };
    props.onChange([...nodes.slice(0, insertAt), node, ...nodes.slice(insertAt)]);
    setSelectedIndex(insertAt);
  }

  function removeNode(index: number) {
    const node = nodes[index];
    if (node.type === 'start' || node.type === 'end') return;
    props.onChange(nodes.filter((_, i) => i !== index));
    setSelectedIndex(null);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <p className="mr-2 text-body font-semibold text-ink-primary">Lowflow 设计</p>
        <Button type="button" variant="outline" onClick={() => addNode('approval')}>审批</Button>
        <Button type="button" variant="outline" onClick={() => addNode('form')}>办理/填表</Button>
        <Button type="button" variant="outline" onClick={() => addNode('cc')}>抄送</Button>
        <Button type="button" variant="outline" onClick={() => addNode('notify')}>通知</Button>
        <Button type="button" variant="outline" disabled title="当前运行引擎仍按线性边执行，条件分支不会保存为可运行路径。">条件分支</Button>
        <Button type="button" variant="outline" disabled title="当前运行引擎仍按线性边执行，并行分支不会保存为可运行路径。">并行分支</Button>
        <Button type="button" variant="outline" disabled title="等待节点需要运行引擎支持定时唤醒后再启用。">等待</Button>
        <Button type="button" variant="outline" disabled title="跳转节点需要运行引擎支持非线性回边后再启用。">跳转</Button>
        <Button type="button" variant="outline" disabled={selectedIndex === null || !selectedNode || selectedNode.type === 'start' || selectedNode.type === 'end'} onClick={() => selectedIndex !== null && removeNode(selectedIndex)}>
          删除节点
        </Button>
        <span className="ml-auto text-caption text-ink-tertiary">当前保存为串行可执行流</span>
      </div>

      <div className="min-h-[520px]">
        <section className="relative min-h-[520px] overflow-auto bg-[rgb(var(--surface-2))] p-6">
          <div className="absolute left-6 top-6 z-10 inline-flex items-center rounded-md border border-border bg-surface-0 shadow-soft-xs">
            <button
              type="button"
              onClick={() => changeZoom(10)}
              disabled={zoom >= 130}
              className="flex h-9 w-9 items-center justify-center border-r border-border text-body disabled:cursor-not-allowed disabled:text-ink-tertiary"
              aria-label="放大流程图"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="h-9 min-w-[54px] px-3 text-body hover:bg-surface-1"
              aria-label="重置流程图缩放"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => changeZoom(-10)}
              disabled={zoom <= 70}
              className="flex h-9 w-9 items-center justify-center border-l border-border text-body disabled:cursor-not-allowed disabled:text-ink-tertiary"
              aria-label="缩小流程图"
            >
              -
            </button>
          </div>

          <div className="flex justify-center pt-16">
            <div
              className="flex w-full max-w-[360px] origin-top flex-col items-center transition-transform"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              {nodes.map((node, index) => {
                const fixed = node.type === 'start' || node.type === 'end';
                const selected = selectedIndex === index;
                const isStart = node.type === 'start';
                const isEnd = node.type === 'end';
                const headerClass = isStart
                  ? 'bg-[rgb(var(--rheem-charcoal))]'
                  : isEnd
                    ? 'bg-transparent'
                    : node.type === 'approval'
                      ? 'bg-brand-500'
                      : node.type === 'cc'
                        ? 'bg-[rgb(var(--rheem-steel))]'
                        : 'bg-[rgb(var(--brand-600))]';
                return (
                  <div key={`${node.id}-${index}`} className="flex w-full flex-col items-center">
                    {isEnd ? (
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`mt-1 text-caption ${selected ? 'font-semibold text-brand-600' : 'text-ink-primary'}`}
                      >
                        {node.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`w-[240px] overflow-hidden rounded-sm bg-surface-0 text-left shadow-soft transition ${selected ? 'ring-2 ring-brand-500' : 'hover:ring-1 hover:ring-brand-500'}`}
                      >
                        <div className={`flex h-10 items-center justify-between px-3 text-body font-semibold text-white ${headerClass}`}>
                          <span className="truncate text-white">{node.label}</span>
                          {fixed ? <Settings2 className="h-5 w-5 text-white" /> : <Plus className="h-6 w-6 rounded-full border border-white text-white" />}
                        </div>
                        <div className="px-3 py-3 text-caption text-ink-primary">
                          <p className="line-clamp-2">{fixed ? '发起人' : assigneeLabel(node, props.users)}</p>
                          {node.description && <p className="mt-1 line-clamp-2 text-caption text-ink-tertiary">{node.description}</p>}
                        </div>
                      </button>
                    )}
                    {index < nodes.length - 1 && (
                      <div className="flex flex-col items-center">
                        <div className="h-5 w-px bg-[rgb(var(--border))]" />
                        <button
                          type="button"
                          onClick={() => addNode('approval', index + 1)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-body font-semibold text-white shadow hover:bg-brand-600"
                          aria-label="添加审批节点"
                        >
                          +
                        </button>
                        <div className="h-5 w-px bg-[rgb(var(--border))]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      {selectedNode && selectedIndex !== null && (
        <WorkflowNodeEditorDrawer
          node={selectedNode}
          nodeIndex={selectedIndex}
          fields={props.fields}
          users={props.users}
          departments={props.departments}
          roles={props.roles}
          onChange={(patch) => updateNode(selectedIndex, patch)}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}

type WorkflowNodeEditorTab = 'assignee' | 'form' | 'operation';

const ASSIGNEE_MODE_OPTIONS: Array<{ value: WorkflowAssigneeMode; label: string }> = [
  { value: 'user', label: '指定人员' },
  { value: 'role', label: '指定角色' },
  { value: 'choice', label: '发起人自选' },
  { value: 'initiator', label: '发起人自己' },
  { value: 'leader', label: '直属上级' },
  { value: 'orgLeader', label: '组织主管' },
  { value: 'formUser', label: '表单内人员' },
  { value: 'formRole', label: '表单内角色' },
  { value: 'autoReject', label: '自动拒绝' },
];

function WorkflowNodeEditorDrawer(props: {
  node: WorkflowNodeDraft;
  nodeIndex: number;
  fields: WorkflowFormField[];
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  onChange: (patch: Partial<WorkflowNodeDraft>) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkflowNodeEditorTab>('assignee');
  const fixed = props.node.type === 'start' || props.node.type === 'end';
  const firstTabLabel = props.node.type === 'approval' ? '审批人' : '处理人';

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={props.onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="节点编辑"
        tabIndex={-1}
        autoFocus
        className="ml-auto flex h-full w-full max-w-[720px] flex-col border-l border-border bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === 'Escape') props.onClose(); }}
      >
        <header className="flex h-[70px] shrink-0 items-center gap-3 border-b border-border px-6">
          <button type="button" onClick={props.onClose} className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-secondary hover:text-ink-primary" aria-label="关闭节点编辑">
            <X className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              value={props.node.label}
              onChange={(event) => props.onChange({ label: event.target.value })}
              aria-label="节点名称"
              className="h-10 max-w-[360px] border-0 bg-transparent px-1 text-title-3 font-semibold text-brand-600 shadow-none focus-visible:ring-0"
            />
            <Edit3 className="h-4 w-4 shrink-0 text-brand-600" />
          </div>
          <span className="shrink-0 text-caption text-ink-tertiary">{nodeTypeLabel(props.node.type)} · 第 {props.nodeIndex + 1} 步</span>
        </header>

        {fixed ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-[520px]">
              <Label htmlFor="workflow-fixed-node-desc">节点说明</Label>
              <Textarea id="workflow-fixed-node-desc" value={props.node.description ?? ''} onChange={(event) => props.onChange({ description: event.target.value })} className="mt-1 min-h-[100px]" />
            </div>
          </div>
        ) : (
          <>
            <nav className="flex h-[80px] shrink-0 items-end justify-center gap-10 border-b border-border px-6" aria-label="节点配置选项卡">
              {([
                ['assignee', firstTabLabel],
                ['form', '表单权限'],
                ['operation', '操作权限'],
              ] as Array<[WorkflowNodeEditorTab, string]>).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`h-12 border-b-2 px-1 text-body font-semibold ${activeTab === tab ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-primary hover:text-brand-600'}`}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto px-7 py-6">
              {activeTab === 'assignee' && <WorkflowNodeAssigneePanel node={props.node} fields={props.fields} users={props.users} departments={props.departments} roles={props.roles} onChange={props.onChange} />}
              {activeTab === 'form' && <WorkflowNodeFormPermissionsPanel node={props.node} fields={props.fields} onChange={props.onChange} />}
              {activeTab === 'operation' && <WorkflowNodeOperationPermissionsPanel node={props.node} onChange={props.onChange} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function WorkflowNodeAssigneePanel(props: {
  node: WorkflowNodeDraft;
  fields: WorkflowFormField[];
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  onChange: (patch: Partial<WorkflowNodeDraft>) => void;
}) {
  const mode = props.node.assigneeMode || 'admin';
  const [emptyUserPickerOpen, setEmptyUserPickerOpen] = useState(false);
  const [listenerOpen, setListenerOpen] = useState(false);
  const userFields = props.fields.filter((field) => field.type === 'user');
  const roleFields = props.fields.filter((field) => field.type === 'role');

  return (
    <div className="space-y-8">
      <NodeEditorSection title={props.node.type === 'approval' ? '审批对象' : '处理对象'}>
        <div className="grid grid-cols-3 gap-x-5 gap-y-3">
          {ASSIGNEE_MODE_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-body text-ink-primary">
              <input type="radio" name={`workflow-assignee-${props.node.id}`} checked={mode === option.value} onChange={() => props.onChange({ assigneeMode: option.value, assigneeValue: '' })} className="h-4 w-4 accent-brand-500" />
              {option.label}
            </label>
          ))}
        </div>
      </NodeEditorSection>

      {mode === 'user' && (
        <AssigneeValueInput node={props.node} users={props.users} departments={props.departments} roles={props.roles} onChange={(assigneeValue) => props.onChange({ assigneeValue })} />
      )}
      {mode === 'role' && (
        <NodeEditorSection title="指定角色">
          <select value={props.node.assigneeValue ?? ''} onChange={(event) => props.onChange({ assigneeValue: event.target.value })} className="h-10 w-[260px] max-w-full rounded-md border border-input bg-background px-3 text-body">
            <option value="">请选择角色</option>
            {props.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
          </select>
        </NodeEditorSection>
      )}
      {mode === 'choice' && (
        <NodeEditorSection title="发起人自选">
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {[['false', '单选'], ['true', '多选']].map(([value, label]) => {
              const active = Boolean(props.node.initiatorChoiceMultiple) === (value === 'true');
              return <button key={value} type="button" onClick={() => props.onChange({ initiatorChoiceMultiple: value === 'true' })} className={`h-9 min-w-[80px] px-4 text-body ${active ? 'bg-brand-500 text-white' : 'bg-surface-0 text-ink-primary hover:bg-surface-1'}`}>{label}</button>;
            })}
          </div>
        </NodeEditorSection>
      )}
      {(mode === 'leader' || mode === 'orgLeader') && (
        <NodeEditorSection title={mode === 'leader' ? '多级上级' : '组织主管'}>
          <select value={String(mode === 'leader' ? props.node.leaderLevel ?? 1 : props.node.orgLeaderLevel ?? 1)} onChange={(event) => props.onChange(mode === 'leader' ? { leaderLevel: Number(event.target.value) } : { orgLeaderLevel: Number(event.target.value) })} className="h-10 w-[260px] max-w-full rounded-md border border-input bg-background px-3 text-body">
            {Array.from({ length: 11 }, (_, index) => <option key={index + 1} value={index + 1}>{index === 0 ? (mode === 'leader' ? '直属上级' : '直属主管') : `${index + 1} 级${mode === 'leader' ? '上级' : '主管'}`}</option>)}
          </select>
        </NodeEditorSection>
      )}
      {mode === 'formUser' && (
        <NodeEditorSection title="表单内人员">
          <select value={props.node.assigneeValue ?? ''} onChange={(event) => props.onChange({ assigneeValue: event.target.value })} className="h-10 w-[260px] max-w-full rounded-md border border-input bg-background px-3 text-body">
            <option value="">选择表单内人员字段</option>
            {userFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
          </select>
        </NodeEditorSection>
      )}
      {mode === 'formRole' && (
        <NodeEditorSection title="表单内角色">
          <select value={props.node.assigneeValue ?? ''} onChange={(event) => props.onChange({ assigneeValue: event.target.value })} className="h-10 w-[260px] max-w-full rounded-md border border-input bg-background px-3 text-body">
            <option value="">选择表单内角色字段</option>
            {roleFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
          </select>
        </NodeEditorSection>
      )}

      {props.node.type === 'approval' && (
        <>
          <NodeEditorSection title="多人审批方式">
            <div className="space-y-3">
              {([['sequential', '依次审批（按顺序审批）'], ['joint', '会签（需要所有审批人都通过）'], ['single', '或签（其中一名审批人通过即可）']] as Array<[WorkflowMultiApprovalMode, string]>).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-body text-ink-primary"><input type="radio" name={`workflow-multi-${props.node.id}`} checked={(props.node.multiApprovalMode || 'sequential') === value} onChange={() => props.onChange({ multiApprovalMode: value })} className="h-4 w-4 accent-brand-500" />{label}</label>
              ))}
            </div>
            {props.node.multiApprovalMode === 'joint' && (
              <label className="mt-4 flex items-center gap-2 text-body text-ink-secondary">
                通过比例
                <Input type="number" min={1} max={100} value={props.node.multiApprovalPercent ?? 100} onChange={(event) => props.onChange({ multiApprovalPercent: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })} className="h-9 w-20" />
                %
              </label>
            )}
          </NodeEditorSection>
          <NodeEditorSection title="审批人为空">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {([['pass', '自动通过'], ['assign', '指定人员'], ['reject', '自动拒绝'], ['admin', '转交流程管理员']] as Array<[WorkflowEmptyAssigneeAction, string]>).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-body text-ink-primary"><input type="radio" name={`workflow-empty-${props.node.id}`} checked={(props.node.emptyAssigneeAction || 'pass') === value} onChange={() => props.onChange({ emptyAssigneeAction: value })} className="h-4 w-4 accent-brand-500" />{label}</label>
              ))}
            </div>
            {props.node.emptyAssigneeAction === 'assign' && <div className="mt-4"><WorkflowUserSelectorButton users={props.users} values={parseAssigneeValues(props.node.emptyAssigneeValue ?? '')} placeholder="请选择审批人为空时的处理人" onClick={() => setEmptyUserPickerOpen(true)} /></div>}
          </NodeEditorSection>
          <NodeEditorSection title="任务监听器">
            <Button type="button" variant="outline" size="sm" onClick={() => setListenerOpen(true)}><Settings2 className="mr-2 h-4 w-4" />配置</Button>
          </NodeEditorSection>
        </>
      )}

      <WorkflowUserPickerDialog open={emptyUserPickerOpen} onOpenChange={setEmptyUserPickerOpen} users={props.users} departments={props.departments} value={parseAssigneeValues(props.node.emptyAssigneeValue ?? '')} onConfirm={(values) => props.onChange({ emptyAssigneeValue: values.join(',') })} />
      <WorkflowTaskListenerDialog open={listenerOpen} onOpenChange={setListenerOpen} node={props.node} onChange={props.onChange} />
    </div>
  );
}

function NodeEditorSection(props: { title: string; children: ReactNode }) {
  return <section><h3 className="mb-3 text-body font-semibold text-ink-primary">{props.title}</h3>{props.children}</section>;
}

function WorkflowUserSelectorButton(props: { users: WorkflowDirectoryUser[]; values: string[]; placeholder: string; onClick: () => void }) {
  const selected = props.values.map((value) => findWorkflowUser(props.users, value)).filter((user): user is WorkflowDirectoryUser => Boolean(user));
  return (
    <button type="button" onClick={props.onClick} className="flex min-h-10 max-w-full items-center gap-2 text-left text-body text-ink-primary hover:text-brand-600">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-surface-1"><UserRound className="h-5 w-5" /></span>
      <span className={selected.length ? 'font-medium' : 'text-ink-tertiary'}>{selected.length === 0 ? props.placeholder : selected.length === 1 ? formatWorkflowUserDisplay(selected[0]) : `已选择 ${selected.length} 人`}</span>
    </button>
  );
}

function AssigneeValueInput(props: {
  node: WorkflowNodeDraft;
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  roles: WorkflowDirectoryRole[];
  onChange: (value: string) => void;
}) {
  const mode = props.node.assigneeMode || 'admin';
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const selectedUserValues = parseAssigneeValues(props.node.assigneeValue ?? '');
  const userOptions = useMemo(() => props.users.filter((user) => !user.disabled), [props.users]);
  const selectedUserEntries = selectedUserValues.map((value) => ({
    value,
    user: userOptions.find((user) => user.id === value || user.email.toLowerCase() === value.toLowerCase()) ?? { id: value, email: value },
  }));

  function removeUser(value: string) {
    props.onChange(selectedUserValues.filter((item) => item !== value).join(','));
  }

  if (mode === 'admin' || mode === 'initiator') {
    return (
      <div className="rounded-md border border-border bg-surface-1 p-3 text-caption text-ink-secondary">
        {mode === 'admin' ? '运行时会分配给当前租户管理员。' : '运行时会分配给流程发起人。'}
      </div>
    );
  }
  if (mode === 'role' && props.roles.length > 0) {
    return (
      <SelectInput
        label="指定角色"
        value={props.node.assigneeValue ?? ''}
        options={['', ...props.roles.map((role) => role.key)]}
        labels={{ '': '请选择角色', ...Object.fromEntries(props.roles.map((role) => [role.key, `${role.name} (${role.key})`])) }}
        onChange={props.onChange}
      />
    );
  }
  if (mode === 'user') {
    return (
      <NodeEditorSection title="指定人员">
        <WorkflowUserSelectorButton users={props.users} values={selectedUserValues} placeholder="请选择审批人" onClick={() => setUserPickerOpen(true)} />
        {selectedUserEntries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedUserEntries.map(({ value, user }) => {
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => removeUser(value)}
                  className="max-w-full rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-caption font-medium text-brand-700"
                  title="点击移除"
                >
                  <span className="inline-block max-w-[280px] truncate align-bottom">{formatWorkflowUserDisplay(user)}</span>
                  <span className="ml-1">×</span>
                </button>
              );
            })}
          </div>
        )}
        <WorkflowUserPickerDialog open={userPickerOpen} onOpenChange={setUserPickerOpen} users={props.users} departments={props.departments} value={selectedUserValues} onConfirm={(values) => props.onChange(values.join(','))} />
      </NodeEditorSection>
    );
  }
  return (
    <TextInput
      label="规则值"
      value={props.node.assigneeValue ?? ''}
      onChange={props.onChange}
      placeholder={mode === 'role' ? '角色编码' : '用户 ID 或邮箱'}
    />
  );
}

function WorkflowUserPickerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: WorkflowDirectoryUser[];
  departments: WorkflowDirectoryDepartment[];
  value: string[];
  onConfirm: (value: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(props.value);
  const valueKey = props.value.join(',');
  const users = useMemo(() => props.users.filter((user) => !user.disabled), [props.users]);
  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => !keyword || `${user.name ?? ''} ${user.email} ${user.departmentName ?? ''} ${user.jobTitle ?? ''}`.toLowerCase().includes(keyword));
  }, [query, users]);
  const tree = useMemo(() => buildWorkflowUserTree(filteredUsers, props.departments), [filteredUsers, props.departments]);
  const selectedSet = new Set(draft.flatMap((value) => [value, value.toLowerCase()]));

  useEffect(() => {
    if (props.open) {
      setDraft(parseAssigneeValues(valueKey));
      setQuery('');
    }
  }, [props.open, valueKey]);

  function isSelected(user: WorkflowDirectoryUser) {
    return selectedSet.has(user.id) || selectedSet.has(user.email.toLowerCase());
  }

  function toggleUser(user: WorkflowDirectoryUser) {
    const aliases = new Set([user.id, user.email.toLowerCase()]);
    setDraft((current) => {
      const next = current.filter((value) => !aliases.has(value) && !aliases.has(value.toLowerCase()));
      if (!selectedSet.has(user.id) && !selectedSet.has(user.email.toLowerCase())) next.push(user.id);
      return next;
    });
  }

  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={() => props.onOpenChange(false)}>
      <div role="dialog" aria-modal="true" aria-label="选择用户" className="flex h-[540px] w-full max-w-[560px] flex-col overflow-hidden rounded-md border border-border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-title-3 font-semibold text-ink-primary">选择用户</h2>
          <button type="button" onClick={() => props.onOpenChange(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink-secondary hover:bg-surface-1" aria-label="关闭用户选择"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 pb-3"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入姓名、邮箱或部门搜索" className="h-10" autoFocus /></div>
        <div className="mx-6 flex items-center justify-between border-b border-border pb-3 text-caption text-ink-secondary"><span>已选择 {draft.length} 人</span><span>匹配 {filteredUsers.length} 人</span></div>
        <div className="mx-6 min-h-0 flex-1 overflow-y-auto py-3">
          {tree.length === 0 ? <p className="py-12 text-center text-body text-ink-tertiary">没有匹配人员</p> : tree.map((node) => <WorkflowUserTreeNodeView key={node.id} node={node} depth={0} isUserSelected={isSelected} onToggleUser={toggleUser} />)}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>取消</Button>
          <Button type="button" onClick={() => { props.onConfirm(draft); props.onOpenChange(false); }}>确认</Button>
        </div>
      </div>
    </div>
  );
}

function WorkflowTaskListenerDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; node: WorkflowNodeDraft; onChange: (patch: Partial<WorkflowNodeDraft>) => void }) {
  const listeners = props.node.taskListeners ?? [];
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[560px] bg-white">
        <DialogHeader><DialogTitle>任务监听器</DialogTitle><DialogDescription>配置节点创建、分配或完成时调用的监听实现。</DialogDescription></DialogHeader>
        <div className="max-h-[360px] space-y-3 overflow-y-auto">
          {listeners.map((listener, index) => (
            <div key={`${listener.event}-${index}`} className="grid grid-cols-[140px_minmax(0,1fr)_36px] gap-2">
              <select value={listener.event} onChange={(event) => props.onChange({ taskListeners: listeners.map((item, itemIndex) => itemIndex === index ? { ...item, event: event.target.value } : item) })} className="h-10 rounded-md border border-input bg-background px-2 text-body">
                <option value="create">任务创建</option><option value="assignment">任务分配</option><option value="complete">任务完成</option>
              </select>
              <Input value={listener.implementation} onChange={(event) => props.onChange({ taskListeners: listeners.map((item, itemIndex) => itemIndex === index ? { ...item, implementation: event.target.value } : item) })} placeholder="实现类或表达式" className="h-10" />
              <button type="button" onClick={() => props.onChange({ taskListeners: listeners.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-10 w-9 items-center justify-center text-danger" aria-label="删除监听器"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {listeners.length === 0 && <p className="py-6 text-center text-body text-ink-tertiary">暂无任务监听器</p>}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => props.onChange({ taskListeners: [...listeners, { event: 'create', implementation: '' }] })}><Plus className="mr-2 h-4 w-4" />添加监听器</Button>
          <Button type="button" onClick={() => props.onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowNodeFormPermissionsPanel(props: { node: WorkflowNodeDraft; fields: WorkflowFormField[]; onChange: (patch: Partial<WorkflowNodeDraft>) => void }) {
  const permissions = workflowNodeFormPermissions(props.node, props.fields);

  function updatePermission(fieldId: string, key: 'readonly' | 'required' | 'hidden', checked: boolean) {
    props.onChange({ formPermissions: permissions.map((permission) => permission.fieldId === fieldId ? exclusiveWorkflowPermission(permission, key, checked) : permission) });
  }

  function updateAll(key: 'readonly' | 'required' | 'hidden', checked: boolean) {
    props.onChange({ formPermissions: permissions.map((permission) => exclusiveWorkflowPermission(permission, key, checked)) });
  }

  if (props.fields.length === 0) return <p className="py-16 text-center text-body text-ink-tertiary">当前发起表单暂无字段</p>;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full table-fixed text-body">
        <thead className="bg-surface-1 text-ink-secondary"><tr><th className="w-[46%] px-4 py-3 text-left font-semibold">字段</th>{(['readonly', 'required', 'hidden'] as const).map((key) => <th key={key} className="px-2 py-3 text-center font-semibold"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={permissions.length > 0 && permissions.every((item) => item[key])} onChange={(event) => updateAll(key, event.target.checked)} className="h-4 w-4 accent-brand-500" />{{ readonly: '只读', required: '必填', hidden: '隐藏' }[key]}</label></th>)}</tr></thead>
        <tbody>
          {props.fields.map((field) => {
            const permission = permissions.find((item) => item.fieldId === field.id)!;
            return <tr key={field.id} className="border-t border-border"><td className="px-4 py-3"><p className="font-medium text-ink-primary">{field.label}</p><p className="mt-0.5 text-caption text-ink-tertiary">{FIELD_TYPE_OPTIONS.find((item) => item.value === field.type)?.label ?? field.type}</p></td>{(['readonly', 'required', 'hidden'] as const).map((key) => <td key={key} className="px-2 py-3 text-center"><input type="checkbox" checked={permission[key]} onChange={(event) => updatePermission(field.id, key, event.target.checked)} className="h-4 w-4 accent-brand-500" /></td>)}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowNodeOperationPermissionsPanel(props: { node: WorkflowNodeDraft; onChange: (patch: Partial<WorkflowNodeDraft>) => void }) {
  const permissions = { ...defaultWorkflowOperationPermissions(), ...(props.node.operationPermissions ?? {}) };
  const operations: Array<{ key: keyof WorkflowNodeOperationPermissions; title: string; description: string; icon: ReactNode }> = [
    { key: 'complete', title: '同意', description: '审批通过，流转到下一个节点', icon: <CheckCircle2 className="h-6 w-6" /> },
    { key: 'refuse', title: '拒绝', description: '拒绝任务时终止当前流程', icon: <Ban className="h-6 w-6" /> },
    { key: 'back', title: '退回', description: '将任务退回至历史节点', icon: <ArrowLeft className="h-6 w-6" /> },
    { key: 'transfer', title: '转交', description: '将当前任务移交给其他人处理', icon: <UserRoundCheck className="h-6 w-6" /> },
    { key: 'delegate', title: '委派', description: '临时委托他人处理后再交回', icon: <ShieldCheck className="h-6 w-6" /> },
    { key: 'addMulti', title: '加签', description: '在当前任务上额外增加处理人', icon: <UserRoundPlus className="h-6 w-6" /> },
    { key: 'minusMulti', title: '减签', description: '减少当前任务处理人', icon: <UserRoundMinus className="h-6 w-6" /> },
  ];
  return <div className="divide-y divide-border">{operations.map((operation) => <div key={operation.key} className="flex items-center gap-4 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-1 text-brand-600">{operation.icon}</span><div className="min-w-0 flex-1"><p className="font-semibold text-ink-primary">{operation.title}</p><p className="mt-1 text-caption text-ink-secondary">{operation.description}</p></div><Switch checked={permissions[operation.key]} onCheckedChange={(checked) => props.onChange({ operationPermissions: { ...permissions, [operation.key]: checked } })} aria-label={`${operation.title}权限`} /></div>)}</div>;
}

function WorkflowUserTreeNodeView(props: {
  node: WorkflowDepartmentTreeNode;
  depth: number;
  isUserSelected: (user: WorkflowDirectoryUser) => boolean;
  onToggleUser: (user: WorkflowDirectoryUser) => void;
}) {
  const total = countWorkflowTreeUsers(props.node);
  return (
    <details open className="group/tree">
      <summary
        className="flex cursor-pointer list-none items-center justify-between rounded-md py-1.5 pr-2 text-caption font-semibold text-ink-primary hover:bg-surface-1"
        style={{ paddingLeft: `${Math.min(props.depth * 16 + 4, 72)}px` }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary transition-transform group-open/tree:rotate-90" />
          <span className="truncate">{props.node.name}</span>
        </span>
        <span className="shrink-0 text-caption font-medium text-ink-tertiary">{total} 人</span>
      </summary>
      <div>
        {props.node.children.map((child) => (
          <WorkflowUserTreeNodeView
            key={child.id}
            node={child}
            depth={props.depth + 1}
            isUserSelected={props.isUserSelected}
            onToggleUser={props.onToggleUser}
          />
        ))}
        {props.node.users.map((user) => (
          <label
            key={user.id}
            className="flex cursor-pointer items-start gap-2 rounded-md py-1.5 pr-2 hover:bg-surface-1"
            style={{ paddingLeft: `${Math.min((props.depth + 1) * 16 + 28, 96)}px` }}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={props.isUserSelected(user)}
              onChange={() => props.onToggleUser(user)}
            />
            <span className="min-w-0">
              <span className="block truncate text-caption font-medium text-ink-primary">{formatWorkflowUserName(user)}</span>
              <span className="block truncate text-caption text-ink-tertiary">
                {user.email}{user.jobTitle ? ` · ${user.jobTitle}` : ''}
              </span>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

function WorkflowAdvancedPanel(props: {
  draft: ReturnType<typeof initialWorkflowDraft>;
  setDraft: (draft: ReturnType<typeof initialWorkflowDraft>) => void;
}) {
  const runtimeNodes = normalizeWorkflowDraftNodes(props.draft.nodes).filter((node) => node.type !== 'start' && node.type !== 'end');
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-md border border-border bg-surface-0 p-5">
        <p className="text-title-3 font-semibold text-ink-primary">高级设置</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SelectInput
            label="模型状态"
            value={props.draft.status}
            options={['draft', 'published', 'disabled']}
            labels={STATUS_LABELS}
            onChange={(status) => props.setDraft({ ...props.draft, status: status as WorkflowConfigStatus })}
          />
          <SelectInput
            label="发起范围"
            value={props.draft.launchMode}
            options={['business', 'manual', 'both', 'disabled']}
            labels={{ business: '仅业务页面', manual: '仅手工发起', both: '业务和手工发起', disabled: '禁止发起' }}
            onChange={(launchMode) => props.setDraft({ ...props.draft, launchMode })}
          />
        </div>
        <div className="mt-4 grid gap-3 text-caption text-ink-secondary">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked readOnly />允许发起人撤回运行中的流程</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked readOnly />审批意见、办理表单和流转历史全量留痕</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked readOnly />业务绑定按 businessType + action 触发</label>
        </div>
        <div className="mt-4 rounded-md border border-dashed border-border bg-surface-1 p-3 text-caption text-ink-secondary">
          当前运行引擎按线性边执行；条件、并行、等待、跳转在界面中保留为能力占位，但不会保存成可运行路径。
        </div>
      </div>

      <aside className="rounded-md border border-border bg-surface-1 p-4">
        <p className="text-body font-semibold text-ink-primary">发布前检查</p>
        <div className="mt-4 space-y-3 text-caption">
          <InfoCell label="发起表单" value={`${props.draft.startFormDraft.fields.length} 个字段`} />
          <InfoCell label="流程节点" value={`${runtimeNodes.length} 个运行节点`} />
          <InfoCell label="审批节点" value={`${runtimeNodes.filter((node) => node.type === 'approval').length} 个`} />
          <InfoCell label="处理人规则" value={`${runtimeNodes.filter((node) => node.assigneeMode).length} 条`} />
        </div>
      </aside>
    </div>
  );
}

function WorkflowRuntimeLedger({ snapshot }: { snapshot: WorkflowRuntimeSnapshot }) {
  const taskFormsByInstance = snapshot.taskForms.reduce<Record<string, WorkflowTaskForm[]>>((acc, item) => {
    acc[item.instanceId] = [...(acc[item.instanceId] || []), item];
    return acc;
  }, {});
  const tasksByInstance = snapshot.visibleTasks.reduce<Record<string, WorkflowTask[]>>((acc, item) => {
    acc[item.instanceId] = [...(acc[item.instanceId] || []), item];
    return acc;
  }, {});
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b border-border p-5">
        <CardTitle>流程实例总账</CardTitle>
        <p className="text-caption text-ink-secondary">用于核对流程实例、业务来源、当前节点、任务生成和签批留痕。</p>
      </CardHeader>
      <CardContent className="p-0">
        {snapshot.instances.length === 0 ? (
          <div className="p-5"><EmptyState text="暂无流程实例。" /></div>
        ) : (
          <div className="divide-y divide-border">
            {snapshot.instances.map((instance) => (
              <div key={instance.id} className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-title-3 font-semibold text-ink-primary">{instance.title}</p>
                        <StatusBadge status={instance.status} />
                      </div>
                      <p className="mt-1 text-caption text-ink-tertiary">
                        {instance.code} · {instance.workflowName} v{instance.workflowVersion} · {instance.launchSource === 'business' ? '业务发起' : '手工发起'}
                      </p>
                    </div>
                    <div className="text-caption text-ink-secondary md:text-right">
                      <p>当前节点：{instance.currentNodeLabel || '-'}</p>
                      <p>更新时间：{formatDateTime(instance.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoCell label="业务类型" value={instance.businessType || '-'} />
                    <InfoCell label="业务动作" value={instance.businessAction || '-'} />
                    <InfoCell label="业务单号" value={instance.businessId || '-'} />
                  </div>
                  <SubmittedFormPanel title="业务表单数据" form={instance.formTemplateId ? snapshot.forms.find((form) => form.id === instance.formTemplateId) : undefined} data={instance.formData ?? {}} />
                  <WorkflowHistoryTimeline instance={instance} />
                </div>
                <aside className="space-y-4">
                  <div className="rounded-md border border-border bg-surface-1 p-4">
                    <p className="mb-3 text-caption font-medium text-ink-secondary">任务</p>
                    {(tasksByInstance[instance.id] || []).length === 0 ? (
                      <p className="text-caption text-ink-tertiary">暂无任务。</p>
                    ) : (
                      <div className="space-y-2">
                        {tasksByInstance[instance.id].map((task) => (
                          <div key={task.id} className="rounded-md border border-border bg-surface-0 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-caption font-medium text-ink-primary">{task.nodeLabel}</p>
                                <p className="mt-1 truncate text-caption text-ink-tertiary">{task.assigneeName || task.assigneeEmail}</p>
                              </div>
                              <StatusBadge status={task.status} />
                            </div>
                            {task.decision && <p className="mt-2 text-caption text-ink-secondary">结果：{DECISION_LABELS[task.decision]}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border border-border bg-surface-1 p-4">
                    <p className="mb-3 text-caption font-medium text-ink-secondary">签批记录</p>
                    {(taskFormsByInstance[instance.id] || []).length === 0 ? (
                      <p className="text-caption text-ink-tertiary">暂无签批记录。</p>
                    ) : (
                      <div className="space-y-2">
                        {taskFormsByInstance[instance.id].map((form) => (
                          <div key={form.id} className="rounded-md border border-border bg-surface-0 p-3 text-caption">
                            <p className="font-medium text-ink-primary">{form.nodeLabel} · {DECISION_LABELS[form.decision]}</p>
                            <p className="mt-1 text-ink-tertiary">{form.signerName || form.signerEmail} · {formatDateTime(form.signedAt)}</p>
                            {form.comment && <p className="mt-2 text-ink-secondary">意见：{form.comment}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowHistoryTimeline({ instance, compact }: { instance: WorkflowInstance; compact?: boolean }) {
  const rows = compact ? instance.history.slice(-3) : instance.history;
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {!compact && <p className="text-caption font-medium text-ink-secondary">流转历史</p>}
      <div className="space-y-2">
        {rows.map((item, index) => (
          <div key={`${item.at}-${index}`} className="flex gap-3 text-caption">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            <div className="min-w-0">
              <p className="text-ink-primary">{historyActionLabel(item.action)} · {item.nodeLabel || '-'}</p>
              <p className="text-ink-tertiary">{item.by} · {formatDateTime(item.at)}</p>
              {item.note && <p className="mt-1 text-ink-secondary">{item.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmittedFormPanel({ title, form, data }: { title: string; form?: WorkflowFormTemplate; data: Record<string, unknown> }) {
  const entries = form
    ? form.fields.filter((field) => !field.hidden).map((field) => ({ label: field.label, value: data[field.id] }))
    : Object.entries(data).map(([label, value]) => ({ label, value }));
  return (
    <div className="rounded-md border border-border bg-surface-1 p-4">
      <p className="mb-3 text-caption font-medium text-ink-secondary">{title}</p>
      {entries.length === 0 ? (
        <p className="text-caption text-ink-tertiary">暂无表单数据。</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <InfoCell key={entry.label} label={entry.label} value={formatFieldValue(entry.value)} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-0 px-3 py-2">
      <p className="text-caption text-ink-tertiary">{label}</p>
      <p className="mt-1 break-words text-body font-medium text-ink-primary">{value}</p>
    </div>
  );
}

function DynamicForm(props: {
  form?: WorkflowFormTemplate;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (!props.form) return <EmptyState text="该流程没有绑定发起表单。" />;
  const grouped = props.form.fields.reduce<Record<string, WorkflowFormField[]>>((acc, field) => {
    const group = field.section || '表单信息';
    acc[group] = [...(acc[group] || []), field];
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([section, fields]) => (
        <div key={section} className="space-y-3 rounded-md border border-border bg-surface-1 p-4">
          <p className="text-caption font-medium text-ink-secondary">{section}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.filter((field) => !field.hidden).map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                value={props.value[field.id]}
                onChange={(value) => props.onChange({ ...props.value, [field.id]: value })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactFieldPreview({ field }: { field: WorkflowFormField }) {
  const common = 'h-9 w-full rounded-md border border-input bg-background px-3 text-caption text-ink-secondary';
  if (field.type === 'textarea') {
    return <textarea className={`${common} min-h-[56px] py-2`} placeholder={field.placeholder || field.label} readOnly />;
  }
  if (field.type === 'select' || field.type === 'multiselect') {
    return (
      <select className={common} value="" disabled>
        <option>{field.placeholder || '请选择'}</option>
      </select>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className="inline-flex h-9 items-center gap-2 text-caption text-ink-secondary">
        <input type="checkbox" disabled />
        {field.placeholder || field.label}
      </label>
    );
  }
  if (field.type === 'attachment') {
    return <div className={`${common} flex items-center`}>上传附件</div>;
  }
  if (field.type === 'user' || field.type === 'role') {
    return <div className={`${common} flex items-center`}>{field.type === 'user' ? '选择人员' : '选择角色'}</div>;
  }
  return <input className={common} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} placeholder={field.placeholder || field.label} readOnly />;
}

function FieldInput({ field, value, onChange }: { field: WorkflowFormField; value: unknown; onChange: (value: unknown) => void }) {
  const id = `field-${field.id}`;
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.type === 'textarea') {
    return (
      <div className="md:col-span-2">
        <Label htmlFor={id}>{label}</Label>
        <Textarea id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} readOnly={field.readonly} />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} required={field.required} disabled={field.readonly} className="h-10 w-full rounded-md border border-input bg-background px-3 text-body">
          <option value="">请选择</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 pt-6 text-caption text-ink-secondary">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} disabled={field.readonly} />
        {label}
      </label>
    );
  }
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={String(value ?? '')} onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={field.placeholder} required={field.required} readOnly={field.readonly} />
    </div>
  );
}

function ConfigLayout({ list, editor }: { list: ReactNode; editor: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section>{list}</section>
      <Card className="rounded-md">
        <CardContent className="p-5">{editor}</CardContent>
      </Card>
    </div>
  );
}

function ConfigList<T extends WorkflowFormTemplate | WorkflowTemplate, K extends 'form' | 'workflow'>(props: {
  rows: T[];
  type: K;
  onEdit: (row: T) => void;
  onStatus: (kind: K, id: string, status: WorkflowConfigStatus) => Promise<void>;
}) {
  const title = props.type === 'form' ? '表单模板' : '流程模型';
  return (
    <div className="space-y-3">
      <SectionTitle title={title} description="默认配置会自动合并展示，编辑后会生成当前租户自己的配置。" />
      {props.rows.length === 0 ? <EmptyState text={`暂无${title}。`} /> : props.rows.map((row) => (
        <Card key={row.id} className="rounded-md">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-ink-primary">{row.name}</p>
                <StatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-caption text-ink-tertiary">{row.code} · v{row.version}</p>
              <p className="mt-1 text-caption text-ink-secondary">{row.description || '-'}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => props.onEdit(row)}>编辑</Button>
              <Button variant="outline" size="sm" onClick={() => void props.onStatus(props.type, row.id, row.status === 'published' ? 'disabled' : 'published')}>
                {row.status === 'published' ? '停用' : '发布'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BindingList(props: {
  bindings: BusinessWorkflowBinding[];
  workflows: WorkflowTemplate[];
  forms: WorkflowFormTemplate[];
  onEdit: (binding: BusinessWorkflowBinding) => void;
  onStatus: (kind: 'binding', id: string, status: WorkflowConfigStatus) => Promise<void>;
  actions?: ReactNode;
}) {
  const workflowNames = Object.fromEntries(props.workflows.map((item) => [item.id, item.name]));
  const formNames = Object.fromEntries(props.forms.map((item) => [item.id, item.name]));
  const sceneLabels = Object.fromEntries(BUSINESS_SCENE_PRESETS.map((item) => [item.businessType, item.label]));
  const actionLabels = Object.fromEntries(BUSINESS_ACTION_OPTIONS.map((item) => [item.value, item.label]));
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <SectionTitle title="业务流程绑定" description="把业务类型和动作映射到可发起的流程模型。" />
        {props.actions}
      </div>
      {props.bindings.length === 0 ? <EmptyState text="暂无业务流程绑定。" /> : props.bindings.map((binding) => (
        <Card key={binding.id} className="rounded-md">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-ink-primary">{binding.label || `${sceneLabels[binding.businessType] || binding.businessType} · ${actionLabels[binding.action] || binding.action}`}</p>
                <StatusBadge status={binding.enabled ? 'published' : 'disabled'} />
              </div>
              <p className="mt-1 text-caption text-ink-tertiary">业务场景：{sceneLabels[binding.businessType] || binding.businessType} · 触发动作：{actionLabels[binding.action] || binding.action}</p>
              <p className="mt-1 text-caption text-ink-secondary">流程：{workflowNames[binding.workflowTemplateId] || binding.workflowTemplateId} · 表单：{binding.formTemplateId ? formNames[binding.formTemplateId] || binding.formTemplateId : '未绑定'}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => props.onEdit(binding)}>编辑</Button>
              <Button variant="outline" size="sm" onClick={() => void props.onStatus('binding', binding.id, binding.enabled ? 'disabled' : 'published')}>
                {binding.enabled ? '停用' : '启用'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TextInput(props: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string }) {
  const id = `input-${props.label}`;
  return (
    <div>
      <Label htmlFor={id}>{props.label}{props.required ? ' *' : ''}</Label>
      <Input id={id} type={props.type ?? 'text'} value={props.value} onChange={(e) => props.onChange(e.target.value)} required={props.required} placeholder={props.placeholder} className="h-9" />
    </div>
  );
}

function SelectInput(props: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void; required?: boolean }) {
  const id = `select-${props.label}`;
  return (
    <div>
      <Label htmlFor={id}>{props.label}{props.required ? ' *' : ''}</Label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value)} required={props.required} className="h-9 w-full rounded-md border border-input bg-background px-3 text-body">
        {props.options.map((option) => <option key={option} value={option}>{props.labels?.[option] ?? option}</option>)}
      </select>
    </div>
  );
}

function EditorHeader({ title }: { title: string }) {
  return <h2 className="text-title-3 font-semibold text-ink-primary">{title}</h2>;
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-title-3 font-semibold text-ink-primary">{title}</h2>
      {description && <p className="mt-1 text-caption text-ink-secondary">{description}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-1 px-4 py-8 text-center text-caption text-ink-tertiary">
      {text}
    </div>
  );
}

function cloneFields(fields: WorkflowFormField[]): WorkflowFormField[] {
  return fields.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

function defaultWorkflowOperationPermissions(): WorkflowNodeOperationPermissions {
  return {
    complete: true,
    refuse: true,
    back: true,
    transfer: true,
    delegate: false,
    addMulti: false,
    minusMulti: false,
  };
}

function workflowNodeFormPermissions(node: WorkflowNodeDraft, fields: WorkflowFormField[]): WorkflowNodeFormPermission[] {
  return fields.map((field) => {
    const existing = node.formPermissions?.find((item) => item.fieldId === field.id);
    return existing ?? {
      fieldId: field.id,
      readonly: Boolean(field.readonly),
      required: Boolean(field.required),
      hidden: Boolean(field.hidden),
    };
  });
}

function exclusiveWorkflowPermission(
  permission: WorkflowNodeFormPermission,
  key: 'readonly' | 'required' | 'hidden',
  checked: boolean,
): WorkflowNodeFormPermission {
  if (!checked) return { ...permission, [key]: false };
  return {
    ...permission,
    readonly: key === 'readonly',
    required: key === 'required',
    hidden: key === 'hidden',
  };
}

function splitOptions(value: string): string[] {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAssigneeValues(value: string): string[] {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitWorkflowDepartmentPath(value?: string | null): string[] {
  return String(value ?? '')
    .split(/\s*(?:\/|>|＞|\\|｜|\|)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function workflowDepartmentPathById(departmentId: string | null | undefined, departments: WorkflowDirectoryDepartment[]): string[] {
  if (!departmentId) return [];
  const byId = new Map(departments.map((department) => [department.id, department]));
  const path: string[] = [];
  let current = byId.get(departmentId);
  let fallback = departmentId;
  let guard = 0;
  while (current && guard < 20) {
    path.unshift(current.name);
    fallback = current.name;
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }
  return path.length > 0 ? path : splitWorkflowDepartmentPath(fallback);
}

function workflowUserDepartmentPath(user: Pick<WorkflowDirectoryUser, 'departmentId' | 'departmentName'>, departments: WorkflowDirectoryDepartment[]): string[] {
  const fromDepartmentId = workflowDepartmentPathById(user.departmentId, departments);
  if (fromDepartmentId.length > 0) return fromDepartmentId;
  const fromName = splitWorkflowDepartmentPath(user.departmentName);
  return fromName.length > 0 ? fromName : ['未分部门'];
}

function buildWorkflowUserTree(users: WorkflowDirectoryUser[], departments: WorkflowDirectoryDepartment[]): WorkflowDepartmentTreeNode[] {
  const roots: WorkflowDepartmentTreeNode[] = [];
  const nodeByPath = new Map<string, WorkflowDepartmentTreeNode>();

  function ensureNode(path: string[]): WorkflowDepartmentTreeNode {
    const key = path.join('/');
    const existing = nodeByPath.get(key);
    if (existing) return existing;
    const node: WorkflowDepartmentTreeNode = {
      id: `dept-${key || 'root'}`,
      name: path[path.length - 1] || '未分部门',
      path,
      users: [],
      children: [],
    };
    nodeByPath.set(key, node);
    if (path.length <= 1) {
      roots.push(node);
    } else {
      ensureNode(path.slice(0, -1)).children.push(node);
    }
    return node;
  }

  users.forEach((user) => {
    const path = workflowUserDepartmentPath(user, departments);
    ensureNode(path).users.push(user);
  });

  function sortNode(node: WorkflowDepartmentTreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    node.users.sort((a, b) => formatWorkflowUserName(a).localeCompare(formatWorkflowUserName(b), 'zh-CN'));
    node.children.forEach(sortNode);
  }

  roots.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  roots.forEach(sortNode);
  return roots;
}

function countWorkflowTreeUsers(node: WorkflowDepartmentTreeNode): number {
  return node.users.length + node.children.reduce((total, child) => total + countWorkflowTreeUsers(child), 0);
}

function findWorkflowUser(users: WorkflowDirectoryUser[], value: string): WorkflowDirectoryUser | undefined {
  const normalized = value.toLowerCase();
  return users.find((user) => user.id === value || user.email.toLowerCase() === normalized);
}

function formatWorkflowUserName(user: Pick<WorkflowDirectoryUser, 'email' | 'name'>): string {
  return user.name || user.email;
}

function formatWorkflowUserDisplay(user: Pick<WorkflowDirectoryUser, 'email' | 'name'>): string {
  return user.name ? `${user.name} <${user.email}>` : user.email;
}

function formatAssigneeValue(value: string, users: WorkflowDirectoryUser[]): string {
  const user = findWorkflowUser(users, value);
  return user ? formatWorkflowUserDisplay(user) : value;
}

function defaultWorkflowFormCode(workflowCode: string): string {
  const base = workflowCode.trim() || 'workflow';
  return `${base}-form`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'workflow-form';
}

function defaultWorkflowFormName(workflowName: string): string {
  return workflowName.trim() ? `${workflowName.trim()}发起表` : '流程发起表';
}

function workflowInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '流';
}

function assigneeRulePeople(rule?: WorkflowTemplate['assigneeRules'][number]): string[] {
  if (!rule) return ['待分配'];
  if (rule.mode === 'initiator') return ['发起人自己'];
  if (rule.mode === 'admin') return ['流程管理员'];
  if (rule.mode === 'role') return [rule.value ? `角色：${rule.value}` : '指定角色'];
  if (rule.mode === 'choice') return ['发起人自选'];
  if (rule.mode === 'leader') return ['直属上级'];
  if (rule.mode === 'orgLeader') return ['组织主管'];
  if (rule.mode === 'formUser') return ['表单内人员'];
  if (rule.mode === 'formRole') return ['表单内角色'];
  if (rule.mode === 'autoReject') return ['自动拒绝'];
  const people = parseAssigneeValues(rule.value ?? '');
  return people.length ? people : ['指定人员'];
}

function RuntimeLaunchPreviewRow(props: { title: string; people: string[]; active?: boolean; hasNext?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-0.5 h-4 w-4 rounded-full border-4 ${props.active ? 'border-brand-500 bg-brand-500/20' : 'border-surface-2 bg-surface-0'}`} />
        {props.hasNext && <span className="mt-1 h-10 w-px bg-border" />}
      </div>
      <div className="min-w-0 pb-3">
        <p className="text-body font-semibold text-ink-primary">{props.title}</p>
        {props.people.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.people.map((person) => (
              <span key={person} title={person} className="max-w-[160px] truncate rounded-full bg-surface-1 px-2 py-1 text-caption text-ink-secondary">
                {person}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeWorkflowDraftNodes(nodes: WorkflowNodeDraft[]): WorkflowNodeDraft[] {
  const cleanNodes = nodes.filter((node) => node.id && node.label);
  const withoutFixed = cleanNodes.filter((node) => node.type !== 'start' && node.type !== 'end');
  const start = cleanNodes.find((node) => node.type === 'start') ?? { id: 'start', label: '提交申请', type: 'start' as WorkflowNodeType };
  const end = cleanNodes.find((node) => node.type === 'end') ?? { id: 'end', label: '结束', type: 'end' as WorkflowNodeType };
  return [start, ...withoutFixed, end];
}

function linearEdges(nodes: WorkflowNodeDraft[]) {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${nodes[index + 1].id}`,
    from: node.id,
    to: nodes[index + 1].id,
  }));
}

function nodeTypeLabel(type: WorkflowNodeType): string {
  if (type === 'start') return '开始';
  if (type === 'end') return '结束';
  return NODE_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

function assigneeLabel(node: WorkflowNodeDraft, users: WorkflowDirectoryUser[] = []): string {
  if (node.assigneeMode === 'initiator') return '发起人自己';
  if (node.assigneeMode === 'choice') return `发起人自选（${node.initiatorChoiceMultiple ? '多选' : '单选'}）`;
  if (node.assigneeMode === 'leader') return node.leaderLevel && node.leaderLevel > 1 ? `${node.leaderLevel} 级上级` : '直属上级';
  if (node.assigneeMode === 'orgLeader') return node.orgLeaderLevel && node.orgLeaderLevel > 1 ? `${node.orgLeaderLevel} 级主管` : '组织主管';
  if (node.assigneeMode === 'formUser') return node.assigneeValue ? `表单人员：${node.assigneeValue}` : '表单内人员';
  if (node.assigneeMode === 'formRole') return node.assigneeValue ? `表单角色：${node.assigneeValue}` : '表单内角色';
  if (node.assigneeMode === 'autoReject') return '自动拒绝';
  if (node.assigneeMode === 'role') return node.assigneeValue ? `角色：${node.assigneeValue}` : '指定角色';
  if (node.assigneeMode === 'user') {
    const values = parseAssigneeValues(node.assigneeValue ?? '');
    if (values.length > 1) {
      const preview = values.slice(0, 2).map((value) => formatAssigneeValue(value, users)).join('，');
      return values.length > 2 ? `人员：${preview} 等 ${values.length} 人` : `人员：${preview}`;
    }
    return values[0] ? `人员：${formatAssigneeValue(values[0], users)}` : '指定人员';
  }
  return '流程管理员';
}

function historyActionLabel(action: string): string {
  const labels: Record<string, string> = {
    start: '发起',
    task_approved: '审批同意',
    task_rejected: '审批驳回',
    task_returned: '退回',
    withdraw: '撤回',
    admin_transfer: '管理员转办',
    admin_approved: '管理员代同意',
    admin_rejected: '管理员代驳回',
    admin_terminate: '管理员终止',
  };
  return labels[action] ?? action;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map(formatFieldValue).join('，');
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'published' || status === 'completed'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'running' || status === 'open'
        ? 'border-brand-500/30 bg-brand-500/10 text-brand-500'
        : status === 'rejected' || status === 'cancelled'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : 'border-border bg-surface-2 text-ink-secondary';
  return (
    <Badge variant="outline" className={`rounded-full ${tone}`}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
