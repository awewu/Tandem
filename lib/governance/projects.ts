/**
 * Governance Projects · 战略项目 CRUD + 模板复制
 *
 * 设计:
 *   - 公司级总治理模板 (projectId = 'default') 始终存在, ensureDefault 时自动创建
 *   - 新项目创建 = 复制 default 模板 + 新建 Project 记录
 *   - 模板编辑 = 整体替换 departments 字段
 *   - 项目归档 = status='archived', 不删数据 (审计追溯)
 */

import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import {
  DEFAULT_PROJECT_ID,
  defaultDepartments,
  validateProjectOkrAnchor,
  type Department,
  type GovernanceProject,
  type GovernanceProjectStatus,
  type GovernanceTemplate,
  type GovernanceTemplateVersion,
} from '../types/governance';

export class GovernanceError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Default 模板自举
// ---------------------------------------------------------------------------

/**
 * 保证 default 项目 + 模板存在 (幂等). 首次访问任何 governance API 时调用.
 */
export async function ensureDefaultProject(tenantId = 'default'): Promise<{
  project: GovernanceProject;
  template: GovernanceTemplate;
}> {
  const store = getStore();
  const now = new Date().toISOString();

  let project = await store.governanceProjects.get(DEFAULT_PROJECT_ID);
  if (!project) {
    project = await store.governanceProjects.create({
      id: DEFAULT_PROJECT_ID,
      name: '公司级总治理模板',
      description: '所有战略项目的默认协同骨架. 新项目创建时复制本模板.',
      status: 'active',
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  let template = await store.governanceTemplates.get(DEFAULT_PROJECT_ID);
  if (!template) {
    template = await store.governanceTemplates.create({
      id: DEFAULT_PROJECT_ID,
      projectId: DEFAULT_PROJECT_ID,
      departments: defaultDepartments(),
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { project, template };
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string;
  ownerId?: string;
  northStar?: string;
  primaryObjectiveId?: string;
  noOkrReason?: string;
  /** 是否从指定项目复制模板 (默认从 'default' 复制) */
  copyFromProjectId?: string;
  createdBy?: string;
  tenantId?: string;
}

export async function createProject(input: CreateProjectInput): Promise<{
  project: GovernanceProject;
  template: GovernanceTemplate;
}> {
  const name = input.name?.trim();
  if (!name) throw new GovernanceError('name_required', '项目名称不能为空', 400);
  if (name.length > 100) {
    throw new GovernanceError('name_too_long', '项目名称过长 (上限 100)', 400);
  }

  const tenantId = input.tenantId ?? 'default';
  await ensureDefaultProject(tenantId);

  const id = generateId('gprj');
  const now = new Date().toISOString();

  const sourceId = input.copyFromProjectId ?? DEFAULT_PROJECT_ID;
  const source = await getStore().governanceTemplates.get(sourceId);
  if (!source) {
    throw new GovernanceError('copy_source_not_found', `源模板 ${sourceId} 不存在`, 400);
  }

  // OKR Anchor 校验: status='draft' 自动豁免, 但若提供了字段仍校验语义合法性
  const primaryObjectiveId = input.primaryObjectiveId?.trim() || undefined;
  const noOkrReason = input.noOkrReason?.trim() || undefined;
  if (primaryObjectiveId && noOkrReason) {
    throw new GovernanceError('both_present', '请只选其一: 关联 Objective 或 填写理由', 400);
  }

  const project = await getStore().governanceProjects.create({
    id,
    name,
    description: input.description?.trim() || undefined,
    status: 'draft',
    ownerId: input.ownerId,
    northStar: input.northStar?.trim() || undefined,
    primaryObjectiveId,
    noOkrReason,
    tenantId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  });

  // 深拷贝 source.departments 防共享引用
  const template = await getStore().governanceTemplates.create({
    id,
    projectId: id,
    departments: structuredClone(source.departments),
    tenantId,
    createdAt: now,
    updatedAt: now,
  });

  await audit('governance.project_created', input.createdBy ?? 'system', {
    targetId: id,
    metadata: { name, copiedFrom: sourceId },
  });

  return { project, template };
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: GovernanceProjectStatus;
  ownerId?: string;
  northStar?: string;
  primaryObjectiveId?: string | null;
  noOkrReason?: string | null;
  updatedBy?: string;
}

export type LinkKind = 'objective' | 'decision';

const LINK_FIELD: Record<LinkKind, 'linkedObjectiveIds' | 'linkedDecisionIds'> = {
  objective: 'linkedObjectiveIds',
  decision: 'linkedDecisionIds',
};

export async function addLink(
  projectId: string,
  kind: LinkKind,
  targetId: string,
  actorId = 'system',
): Promise<GovernanceProject> {
  const id = targetId.trim();
  if (!id) throw new GovernanceError('invalid_target', 'targetId 不能为空', 400);

  const store = getStore();
  const existing = await store.governanceProjects.get(projectId);
  if (!existing) throw new GovernanceError('not_found', '项目不存在', 404);

  const field = LINK_FIELD[kind];
  const arr = existing[field] ?? [];
  if (arr.includes(id)) return existing; // 幂等

  const updated = await store.governanceProjects.update(projectId, {
    [field]: [...arr, id],
    updatedAt: new Date().toISOString(),
  });

  await audit('governance.project_updated', actorId, {
    targetId: projectId,
    metadata: { action: 'link', kind, targetId: id },
  });

  return updated;
}

export async function removeLink(
  projectId: string,
  kind: LinkKind,
  targetId: string,
  actorId = 'system',
): Promise<GovernanceProject> {
  const store = getStore();
  const existing = await store.governanceProjects.get(projectId);
  if (!existing) throw new GovernanceError('not_found', '项目不存在', 404);

  const field = LINK_FIELD[kind];
  const arr = existing[field] ?? [];
  if (!arr.includes(targetId)) return existing; // 幂等

  const updated = await store.governanceProjects.update(projectId, {
    [field]: arr.filter((x) => x !== targetId),
    updatedAt: new Date().toISOString(),
  });

  await audit('governance.project_updated', actorId, {
    targetId: projectId,
    metadata: { action: 'unlink', kind, targetId },
  });

  return updated;
}

export async function updateProject(
  id: string,
  patch: UpdateProjectInput,
): Promise<GovernanceProject> {
  if (id === DEFAULT_PROJECT_ID && patch.status === 'archived') {
    throw new GovernanceError('cannot_archive_default', '公司级总模板不可归档', 409);
  }
  const existing = await getStore().governanceProjects.get(id);
  if (!existing) throw new GovernanceError('not_found', '项目不存在', 404);

  // 计算下一状态的 OKR Anchor 字段 (允许 null 显式清空)
  const nextStatus = patch.status ?? existing.status;
  const nextPrimaryObjId =
    patch.primaryObjectiveId === null
      ? undefined
      : patch.primaryObjectiveId?.trim() || existing.primaryObjectiveId;
  const nextNoOkrReason =
    patch.noOkrReason === null
      ? undefined
      : patch.noOkrReason?.trim() || existing.noOkrReason;

  // OKR Anchor 严绑定守门: 切到 active/archived 时必须满足
  if (nextStatus === 'active' || nextStatus === 'archived') {
    const check = validateProjectOkrAnchor({
      projectId: id,
      status: nextStatus,
      primaryObjectiveId: nextPrimaryObjId,
      noOkrReason: nextNoOkrReason,
    });
    if (!check.ok) {
      throw new GovernanceError(check.code, check.message, 400);
    }
  }

  const updated = await getStore().governanceProjects.update(id, {
    name: patch.name?.trim() ?? existing.name,
    description: patch.description?.trim() ?? existing.description,
    status: nextStatus,
    ownerId: patch.ownerId ?? existing.ownerId,
    northStar: patch.northStar?.trim() ?? existing.northStar,
    primaryObjectiveId: nextPrimaryObjId,
    noOkrReason: nextNoOkrReason,
    updatedAt: new Date().toISOString(),
  });

  await audit('governance.project_updated', patch.updatedBy ?? 'system', {
    targetId: id,
    metadata: {
      ...(patch as Record<string, unknown>),
      anchorState: nextPrimaryObjId
        ? 'anchored'
        : nextNoOkrReason
          ? 'unanchored_with_reason'
          : 'exempt',
    },
  });

  return updated;
}

export async function deleteProject(id: string, actorId = 'system'): Promise<void> {
  if (id === DEFAULT_PROJECT_ID) {
    throw new GovernanceError('cannot_delete_default', '公司级总模板不可删除', 409);
  }
  const store = getStore();
  const existing = await store.governanceProjects.get(id);
  if (!existing) throw new GovernanceError('not_found', '项目不存在', 404);

  await store.governanceProjects.delete(id);
  await store.governanceTemplates.delete(id);

  await audit('governance.project_deleted', actorId, {
    targetId: id,
    metadata: { name: existing.name },
  });
}

export async function listProjects(filter?: {
  status?: GovernanceProjectStatus;
  tenantId?: string;
}): Promise<GovernanceProject[]> {
  const tenantId = filter?.tenantId ?? 'default';
  await ensureDefaultProject(tenantId);
  const all = await getStore().governanceProjects.list();
  let arr = all.filter((p) => p.tenantId === tenantId);
  if (filter?.status) arr = arr.filter((p) => p.status === filter.status);
  // default 永远排首位, 其余按 updatedAt 倒序
  return arr.sort((a, b) => {
    if (a.id === DEFAULT_PROJECT_ID) return -1;
    if (b.id === DEFAULT_PROJECT_ID) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export async function getTemplate(projectId: string): Promise<GovernanceTemplate | null> {
  if (projectId === DEFAULT_PROJECT_ID) {
    await ensureDefaultProject();
  }
  return getStore().governanceTemplates.get(projectId);
}

export async function saveTemplate(
  projectId: string,
  departments: Department[],
  actorId = 'system',
  opts?: { note?: string; action?: 'save' | 'rollback' | 'create'; rolledBackFrom?: number },
): Promise<GovernanceTemplate> {
  const store = getStore();
  const existing = await store.governanceTemplates.get(projectId);
  if (!existing && projectId !== DEFAULT_PROJECT_ID) {
    throw new GovernanceError('not_found', '模板不存在', 404);
  }
  if (!existing && projectId === DEFAULT_PROJECT_ID) {
    await ensureDefaultProject();
  }

  validateDepartments(departments);
  const now = new Date().toISOString();
  const updated = await store.governanceTemplates.update(projectId, {
    departments,
    updatedAt: now,
  });

  // 同步项目 updatedAt + 取 tenantId
  const project = await store.governanceProjects.get(projectId);
  if (project) {
    await store.governanceProjects.update(projectId, { updatedAt: now });
  }
  const tenantId = project?.tenantId ?? existing?.tenantId ?? 'default';

  // 写版本快照
  const nextVersion = (await listVersionsRaw(projectId)).length + 1;
  await store.governanceTemplateVersions.create({
    id: `${projectId}:${nextVersion}`,
    projectId,
    version: nextVersion,
    departments: structuredClone(departments),
    note: opts?.note,
    action: opts?.action ?? 'save',
    rolledBackFrom: opts?.rolledBackFrom,
    createdBy: actorId,
    tenantId,
    createdAt: now,
  });

  await audit('governance.template_saved', actorId, {
    targetId: projectId,
    metadata: {
      pillars: departments.map((d) => d.pillar).filter(Boolean),
      ministryCount: departments.reduce((n, d) => n + d.ministries.length, 0),
      version: nextVersion,
      action: opts?.action ?? 'save',
    },
  });

  return updated;
}

async function listVersionsRaw(projectId: string): Promise<GovernanceTemplateVersion[]> {
  const all = await getStore().governanceTemplateVersions.list();
  return all.filter((v) => v.projectId === projectId);
}

/** 列出某项目的全部版本 (新到旧) */
export async function listTemplateVersions(
  projectId: string,
): Promise<GovernanceTemplateVersion[]> {
  const arr = await listVersionsRaw(projectId);
  return arr.sort((a, b) => b.version - a.version);
}

export async function getTemplateVersion(
  projectId: string,
  version: number,
): Promise<GovernanceTemplateVersion | null> {
  return getStore().governanceTemplateVersions.get(`${projectId}:${version}`);
}

/** 回滚到指定版本 — 实质 = 用该版本 departments 触发一次新 save (审计可追溯) */
export async function rollbackTemplate(
  projectId: string,
  toVersion: number,
  actorId = 'system',
): Promise<GovernanceTemplate> {
  const target = await getTemplateVersion(projectId, toVersion);
  if (!target) {
    throw new GovernanceError('version_not_found', `版本 ${toVersion} 不存在`, 404);
  }
  return saveTemplate(projectId, structuredClone(target.departments), actorId, {
    note: `rollback to v${toVersion}`,
    action: 'rollback',
    rolledBackFrom: toVersion,
  });
}

/**
 * 模板结构基本校验:
 *   - 每个三省 (decision/review/execution) 至少一个 department (软警告) — 仅在前端 UI 提示
 *   - 所有 id 唯一
 *   - 不能空 departments
 */
function validateDepartments(departments: Department[]): void {
  if (!Array.isArray(departments) || departments.length === 0) {
    throw new GovernanceError('empty_template', '模板不能为空', 400);
  }
  const ids = new Set<string>();
  const minIds = new Set<string>();
  for (const dept of departments) {
    if (!dept.id || !dept.name) {
      throw new GovernanceError('invalid_department', '省必须有 id 和 name', 400);
    }
    if (ids.has(dept.id)) {
      throw new GovernanceError('duplicate_department_id', `省 id 重复: ${dept.id}`, 400);
    }
    ids.add(dept.id);
    if (!Array.isArray(dept.ministries)) {
      throw new GovernanceError('invalid_ministries', `${dept.name} 缺 ministries`, 400);
    }
    for (const m of dept.ministries) {
      if (!m.id || !m.name) {
        throw new GovernanceError('invalid_ministry', '部必须有 id 和 name', 400);
      }
      if (minIds.has(m.id)) {
        throw new GovernanceError('duplicate_ministry_id', `部 id 重复: ${m.id}`, 400);
      }
      minIds.add(m.id);
    }
  }
}
