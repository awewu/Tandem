/**
 * Governance Projects · Phase 2 战略项目 CRUD + 模板复制测试
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  ensureDefaultProject,
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  getTemplate,
  saveTemplate,
  addLink,
  removeLink,
  listTemplateVersions,
  rollbackTemplate,
  GovernanceError,
} from '@/lib/governance/projects';
import { DEFAULT_PROJECT_ID, defaultDepartments } from '@/lib/types/governance';

beforeAll(() => setStore(createInMemoryStore()));
beforeEach(() => setStore(createInMemoryStore()));

describe('ensureDefaultProject', () => {
  it('幂等创建 default 项目 + 模板', async () => {
    const r1 = await ensureDefaultProject();
    expect(r1.project.id).toBe(DEFAULT_PROJECT_ID);
    expect(r1.project.name).toBe('公司级总治理模板');
    expect(r1.template.departments).toHaveLength(3); // 中书/门下/尚书

    const r2 = await ensureDefaultProject();
    expect(r2.project.createdAt).toBe(r1.project.createdAt); // 没重建
  });

  it('default 模板包含完整六部 + pillar 标签', async () => {
    const { template } = await ensureDefaultProject();
    const pillars = template.departments.map((d) => d.pillar);
    expect(pillars).toEqual(['decision', 'review', 'execution']);
    const exec = template.departments.find((d) => d.pillar === 'execution')!;
    expect(exec.ministries).toHaveLength(6); // 吏户礼兵刑工
  });
});

describe('createProject', () => {
  it('新项目从 default 复制模板 (深拷贝, 不共享引用)', async () => {
    const { project, template } = await createProject({
      name: 'Q3 客户成功升级',
      description: '提升净推荐分',
      ownerId: 'user-1',
      northStar: 'NPS ≥ 60',
      createdBy: 'admin-1',
    });
    expect(project.status).toBe('draft');
    expect(project.name).toBe('Q3 客户成功升级');
    expect(project.northStar).toBe('NPS ≥ 60');
    expect(template.departments).toHaveLength(3);

    // 修改新项目模板, default 不应受影响
    const newDepts = structuredClone(template.departments);
    newDepts[0].ministries.push({
      id: 'min-extra',
      name: '战略组',
      tag: 'strategy',
      description: '临时小组',
      agents: [],
    });
    await saveTemplate(project.id, newDepts);
    const defaultTpl = await getTemplate(DEFAULT_PROJECT_ID);
    expect(defaultTpl!.departments[0].ministries.find((m) => m.id === 'min-extra')).toBeUndefined();
  });

  it('拒绝空名称', async () => {
    await expect(createProject({ name: '   ' })).rejects.toMatchObject({
      code: 'name_required',
    });
  });

  it('拒绝过长名称', async () => {
    await expect(createProject({ name: 'x'.repeat(101) })).rejects.toMatchObject({
      code: 'name_too_long',
    });
  });

  it('支持从其他项目复制模板', async () => {
    const a = await createProject({ name: '项目 A', createdBy: 'admin' });
    // 改 A 的模板
    const newDepts = structuredClone(a.template.departments);
    newDepts[2].ministries[0].name = '吏部-定制';
    await saveTemplate(a.project.id, newDepts);

    const b = await createProject({
      name: '项目 B',
      copyFromProjectId: a.project.id,
      createdBy: 'admin',
    });
    expect(b.template.departments[2].ministries[0].name).toBe('吏部-定制');
  });

  it('copyFromProjectId 不存在 → 报错', async () => {
    await expect(
      createProject({ name: 'X', copyFromProjectId: 'no-such-id' }),
    ).rejects.toMatchObject({ code: 'copy_source_not_found' });
  });
});

describe('updateProject', () => {
  it('修改 name / status / northStar (含 OKR 严绑定)', async () => {
    const { project } = await createProject({ name: '原名', primaryObjectiveId: 'obj-1' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateProject(project.id, {
      name: '新名',
      status: 'active',
      northStar: '签约 100 客户',
    });
    expect(updated.name).toBe('新名');
    expect(updated.status).toBe('active');
    expect(updated.northStar).toBe('签约 100 客户');
    expect(updated.updatedAt).not.toBe(project.updatedAt);
  });

  it('default 模板不可归档', async () => {
    await ensureDefaultProject();
    await expect(
      updateProject(DEFAULT_PROJECT_ID, { status: 'archived' }),
    ).rejects.toMatchObject({ code: 'cannot_archive_default' });
  });

  it('不存在 → 404', async () => {
    await expect(updateProject('nope', { name: 'x' })).rejects.toMatchObject({
      code: 'not_found',
      httpStatus: 404,
    });
  });
});

describe('deleteProject', () => {
  it('删除项目同时清模板', async () => {
    const { project } = await createProject({ name: '待删' });
    await deleteProject(project.id);
    expect(await getTemplate(project.id)).toBeNull();
    const store = getStore();
    expect(await store.governanceProjects.get(project.id)).toBeNull();
  });

  it('default 模板不可删', async () => {
    await ensureDefaultProject();
    await expect(deleteProject(DEFAULT_PROJECT_ID)).rejects.toMatchObject({
      code: 'cannot_delete_default',
    });
  });
});

describe('listProjects', () => {
  it('default 永远排首位, 其余按 updatedAt 倒序', async () => {
    const a = await createProject({ name: 'A' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createProject({ name: 'B' });
    const items = await listProjects();
    expect(items[0].id).toBe(DEFAULT_PROJECT_ID);
    // B 后建, updatedAt 更晚
    expect(items[1].id).toBe(b.project.id);
    expect(items[2].id).toBe(a.project.id);
  });

  it('按 status 过滤 (default 也参与过滤)', async () => {
    await ensureDefaultProject();
    const a = await createProject({ name: 'A', primaryObjectiveId: 'obj-1' });
    await updateProject(a.project.id, { status: 'active' });
    const active = await listProjects({ status: 'active' });
    // default 是 active, a 是 active
    expect(active.map((p) => p.id).sort()).toEqual([DEFAULT_PROJECT_ID, a.project.id].sort());
    const drafts = await listProjects({ status: 'draft' });
    expect(drafts).toHaveLength(0);
  });
});

describe('saveTemplate', () => {
  it('拒绝空 departments', async () => {
    await ensureDefaultProject();
    await expect(saveTemplate(DEFAULT_PROJECT_ID, [])).rejects.toMatchObject({
      code: 'empty_template',
    });
  });

  it('拒绝重复 department id', async () => {
    await ensureDefaultProject();
    const dup = defaultDepartments();
    dup[1].id = dup[0].id;
    await expect(saveTemplate(DEFAULT_PROJECT_ID, dup)).rejects.toMatchObject({
      code: 'duplicate_department_id',
    });
  });

  it('拒绝重复 ministry id (跨省)', async () => {
    await ensureDefaultProject();
    const dup = defaultDepartments();
    dup[2].ministries[1].id = dup[2].ministries[0].id;
    await expect(saveTemplate(DEFAULT_PROJECT_ID, dup)).rejects.toMatchObject({
      code: 'duplicate_ministry_id',
    });
  });

  it('保存成功 → 更新 project.updatedAt', async () => {
    const { project } = await createProject({ name: 'X' });
    await new Promise((r) => setTimeout(r, 5));
    const newDepts = structuredClone(project) && defaultDepartments();
    newDepts[0].ministries[0].purpose = '为本项目起草战略提案';
    await saveTemplate(project.id, newDepts);
    const store = getStore();
    const p = await store.governanceProjects.get(project.id);
    expect(p!.updatedAt).not.toBe(project.updatedAt);
  });
});

describe('addLink / removeLink', () => {
  it('加 OKR 链接 → linkedObjectiveIds 累加', async () => {
    const { project } = await createProject({ name: 'P' });
    const a = await addLink(project.id, 'objective', 'obj-1');
    expect(a.linkedObjectiveIds).toEqual(['obj-1']);
    const b = await addLink(project.id, 'objective', 'obj-2');
    expect(b.linkedObjectiveIds).toEqual(['obj-1', 'obj-2']);
  });

  it('加 Decision 链接 → linkedDecisionIds 累加, 与 OKR 互不干扰', async () => {
    const { project } = await createProject({ name: 'P' });
    await addLink(project.id, 'objective', 'obj-1');
    const r = await addLink(project.id, 'decision', 'dc-1');
    expect(r.linkedObjectiveIds).toEqual(['obj-1']);
    expect(r.linkedDecisionIds).toEqual(['dc-1']);
  });

  it('重复加 → 幂等不变', async () => {
    const { project } = await createProject({ name: 'P' });
    await addLink(project.id, 'objective', 'obj-1');
    const r = await addLink(project.id, 'objective', 'obj-1');
    expect(r.linkedObjectiveIds).toEqual(['obj-1']);
  });

  it('removeLink → 移除目标 id', async () => {
    const { project } = await createProject({ name: 'P' });
    await addLink(project.id, 'objective', 'obj-1');
    await addLink(project.id, 'objective', 'obj-2');
    const r = await removeLink(project.id, 'objective', 'obj-1');
    expect(r.linkedObjectiveIds).toEqual(['obj-2']);
  });

  it('removeLink 不存在的 id → 幂等不报错', async () => {
    const { project } = await createProject({ name: 'P' });
    const r = await removeLink(project.id, 'objective', 'nonexistent');
    expect(r.linkedObjectiveIds ?? []).toEqual([]);
  });

  it('空 targetId → 报错', async () => {
    const { project } = await createProject({ name: 'P' });
    await expect(addLink(project.id, 'objective', '   ')).rejects.toMatchObject({
      code: 'invalid_target',
    });
  });

  it('项目不存在 → 404', async () => {
    await expect(addLink('no-such-project', 'objective', 'obj-1')).rejects.toMatchObject({
      code: 'not_found',
      httpStatus: 404,
    });
  });
});

describe('OKR Anchor 严绑定', () => {
  it('draft 阶段豁免, 可不填', async () => {
    const { project } = await createProject({ name: 'P' });
    expect(project.status).toBe('draft');
    expect(project.primaryObjectiveId).toBeUndefined();
  });

  it('default 项目豁免, 切 active 不需要 OKR', async () => {
    await ensureDefaultProject();
    // default 始终 active, 不应被严绑定挡住
    const updated = await updateProject(DEFAULT_PROJECT_ID, { name: '公司级总治理模板' });
    expect(updated.id).toBe('default');
  });

  it('普通项目切 active → 必须有 OKR Anchor 否则报错', async () => {
    const { project } = await createProject({ name: 'P' });
    await expect(updateProject(project.id, { status: 'active' })).rejects.toMatchObject({
      code: 'missing_both',
      httpStatus: 400,
    });
  });

  it('提供 primaryObjectiveId → 切 active 通过', async () => {
    const { project } = await createProject({ name: 'P', primaryObjectiveId: 'obj-99' });
    const updated = await updateProject(project.id, { status: 'active' });
    expect(updated.status).toBe('active');
    expect(updated.primaryObjectiveId).toBe('obj-99');
  });

  it('noOkrReason ≥ 30 字 → 切 active 通过', async () => {
    const reason = '本项目是纯探索性预研, 当前阶段不绑定具体 OKR, 待 Q4 立项再绑定 ABC';
    const { project } = await createProject({ name: 'P', noOkrReason: reason });
    const updated = await updateProject(project.id, { status: 'active' });
    expect(updated.status).toBe('active');
    expect(updated.noOkrReason).toBe(reason);
  });

  it('noOkrReason < 30 字 → 切 active 报错', async () => {
    const { project } = await createProject({ name: 'P' });
    await expect(
      updateProject(project.id, { status: 'active', noOkrReason: '太短' }),
    ).rejects.toMatchObject({ code: 'reason_too_short' });
  });

  it('同时给 primaryObjectiveId + noOkrReason → 报错', async () => {
    await expect(
      createProject({
        name: 'P',
        primaryObjectiveId: 'obj-1',
        noOkrReason: 'x'.repeat(40),
      }),
    ).rejects.toMatchObject({ code: 'both_present' });
  });
});

describe('模板版本化 + 回滚', () => {
  it('每次 saveTemplate 产生递增版本快照', async () => {
    const { project } = await createProject({ name: 'P' });
    // create 时 template 已存在, 第一次 save = v1
    const d1 = await getTemplate(project.id);
    await saveTemplate(project.id, d1!.departments);
    await saveTemplate(project.id, d1!.departments);
    const versions = await listTemplateVersions(project.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2); // 新到旧
    expect(versions[1].version).toBe(1);
    expect(versions.every((v) => v.action === 'save')).toBe(true);
  });

  it('rollbackTemplate 恢复指定版本 departments + 写新版本快照', async () => {
    const { project } = await createProject({ name: 'P' });
    const original = (await getTemplate(project.id))!.departments;

    // 改一下 → v1
    const v1Depts = structuredClone(original);
    v1Depts[0].ministries[0].name = 'V1-改名';
    await saveTemplate(project.id, v1Depts);

    // 再改 → v2
    const v2Depts = structuredClone(original);
    v2Depts[0].ministries[0].name = 'V2-再改名';
    await saveTemplate(project.id, v2Depts);

    // 回滚到 v1
    const rolled = await rollbackTemplate(project.id, 1);
    expect(rolled.departments[0].ministries[0].name).toBe('V1-改名');

    const versions = await listTemplateVersions(project.id);
    expect(versions).toHaveLength(3);
    expect(versions[0].action).toBe('rollback');
    expect(versions[0].rolledBackFrom).toBe(1);
  });

  it('回滚不存在的版本 → 404', async () => {
    const { project } = await createProject({ name: 'P' });
    await expect(rollbackTemplate(project.id, 99)).rejects.toMatchObject({
      code: 'version_not_found',
      httpStatus: 404,
    });
  });
});
