export type WorkflowConfigStatus = 'draft' | 'published' | 'disabled';
export type WorkflowLaunchMode = 'manual' | 'business' | 'both' | 'disabled';

export type WorkflowFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'attachment'
  | 'user'
  | 'role';

export interface WorkflowFormField {
  id: string;
  label: string;
  type: WorkflowFormFieldType;
  section?: string;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
}

export interface WorkflowFormAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface WorkflowAttachmentRecord extends WorkflowFormAttachment {
  tenantId: string;
  ownerId: string;
  storageKey: string;
  createdAt: string;
}

export interface WorkflowFormTemplate {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowConfigStatus;
  fields: WorkflowFormField[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowNodeType = 'start' | 'form' | 'approval' | 'cc' | 'notify' | 'end';

export type WorkflowAssigneeMode =
  | 'user'
  | 'role'
  | 'initiator'
  | 'admin'
  | 'choice'
  | 'leader'
  | 'orgLeader'
  | 'formUser'
  | 'formRole'
  | 'autoReject';

export type WorkflowMultiApprovalMode = 'sequential' | 'joint' | 'single';
export type WorkflowEmptyAssigneeAction = 'pass' | 'reject' | 'admin' | 'assign';

export interface WorkflowNodeFormPermission {
  fieldId: string;
  readonly: boolean;
  required: boolean;
  hidden: boolean;
}

export interface WorkflowNodeOperationPermissions {
  complete: boolean;
  refuse: boolean;
  back: boolean;
  transfer: boolean;
  delegate: boolean;
  addMulti: boolean;
  minusMulti: boolean;
}

export interface WorkflowNodeListener {
  event: string;
  implementation: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: WorkflowNodeType;
  description?: string;
  initiatorChoiceMultiple?: boolean;
  leaderLevel?: number;
  orgLeaderLevel?: number;
  multiApprovalMode?: WorkflowMultiApprovalMode;
  multiApprovalPercent?: number;
  emptyAssigneeAction?: WorkflowEmptyAssigneeAction;
  emptyAssigneeValue?: string;
  formPermissions?: WorkflowNodeFormPermission[];
  operationPermissions?: WorkflowNodeOperationPermissions;
  taskListeners?: WorkflowNodeListener[];
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface WorkflowNodeFormBinding {
  nodeId: string;
  formTemplateIds: string[];
  required?: boolean;
}

export interface WorkflowAssigneeRule {
  nodeId: string;
  mode: WorkflowAssigneeMode;
  value?: string;
}

export interface WorkflowTemplate {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  group?: string;
  launchMode: WorkflowLaunchMode;
  version: number;
  status: WorkflowConfigStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeForms: WorkflowNodeFormBinding[];
  assigneeRules: WorkflowAssigneeRule[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessWorkflowBinding {
  id: string;
  tenantId: string;
  businessType: string;
  action: string;
  label?: string;
  formTemplateId?: string;
  workflowTemplateId: string;
  enabled: boolean;
  renderMode: 'dynamic_form' | 'custom_page';
  detailMode: 'form_data' | 'custom_provider';
  priority: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BusinessFormInstanceStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export interface BusinessFormInstance {
  id: string;
  tenantId: string;
  businessType: string;
  action: string;
  businessId: string;
  title: string;
  formTemplateId: string;
  formTemplateVersion: number;
  formSnapshot: WorkflowFormTemplate;
  formData: Record<string, unknown>;
  status: BusinessFormInstanceStatus;
  workflowInstanceId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRuntimeStatus = 'running' | 'completed' | 'cancelled' | 'rejected' | 'revoked';
export type WorkflowTaskStatus = 'queued' | 'open' | 'completed' | 'cancelled';
export type WorkflowCcStatus = 'unread' | 'read';
export type WorkflowDecision = 'approved' | 'rejected' | 'returned';

export interface WorkflowHistoryItem {
  at: string;
  action: string;
  by: string;
  note?: string;
  taskId?: string;
  nodeId?: string;
  nodeLabel?: string;
  fromAssigneeId?: string;
  toAssigneeId?: string;
}

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  workflowTemplateId: string;
  workflowName: string;
  workflowCode: string;
  workflowVersion: number;
  workflowSnapshot: WorkflowTemplate;
  status: WorkflowRuntimeStatus;
  currentNodeId?: string;
  currentNodeLabel?: string;
  initiatorId: string;
  initiatorEmail: string;
  initiatorName?: string;
  businessType?: string;
  businessId?: string;
  businessAction?: string;
  businessFormInstanceId?: string;
  launchSource: 'manual' | 'business';
  formTemplateId?: string;
  formData?: Record<string, unknown>;
  runtimeAssignees?: Record<string, string | string[]>;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  decision?: WorkflowDecision;
  comment?: string;
  history: WorkflowHistoryItem[];
}

export interface WorkflowTask {
  id: string;
  tenantId: string;
  instanceId: string;
  instanceCode: string;
  title: string;
  workflowTemplateId: string;
  workflowName: string;
  instanceStatus?: WorkflowRuntimeStatus;
  initiatorId?: string;
  initiatorEmail?: string;
  initiatorName?: string;
  businessType?: string;
  businessId?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType;
  status: WorkflowTaskStatus;
  assigneeId: string;
  assigneeEmail: string;
  assigneeName?: string;
  assigneeMode?: string;
  assigneeValue?: string;
  assigneeOrder?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedById?: string;
  completedByEmail?: string;
  completedByName?: string;
  decision?: WorkflowDecision;
  comment?: string;
}

export interface WorkflowTaskForm {
  id: string;
  tenantId: string;
  taskId: string;
  instanceId: string;
  nodeId: string;
  nodeLabel: string;
  formData: Record<string, unknown>;
  decision: WorkflowDecision;
  comment?: string;
  signerId: string;
  signerEmail: string;
  signerName?: string;
  signedAt: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowCc {
  id: string;
  tenantId: string;
  instanceId: string;
  instanceCode: string;
  title: string;
  workflowTemplateId: string;
  workflowName: string;
  nodeId: string;
  nodeLabel: string;
  status: WorkflowCcStatus;
  receiverId: string;
  receiverEmail: string;
  receiverName?: string;
  createdAt: string;
  readAt?: string;
}

export interface WorkflowLaunchPreviewPerson {
  id: string;
  email: string;
  name?: string;
}

export interface WorkflowLaunchPreviewNode {
  nodeId: string;
  nodeLabel: string;
  mode: WorkflowAssigneeMode;
  value?: string;
  people: WorkflowLaunchPreviewPerson[];
}

export interface WorkflowLaunchPreview {
  workflowTemplateId: string;
  initiator: WorkflowLaunchPreviewPerson;
  approvalNodes: WorkflowLaunchPreviewNode[];
}

export interface WorkflowRuntimeSnapshot {
  instances: WorkflowInstance[];
  myStarted: WorkflowInstance[];
  myTodo: WorkflowTask[];
  myCc: WorkflowCc[];
  visibleTasks: WorkflowTask[];
  taskForms: WorkflowTaskForm[];
  workflows: WorkflowTemplate[];
  forms: WorkflowFormTemplate[];
  launchPreviews: WorkflowLaunchPreview[];
  canManageWorkflows: boolean;
}
