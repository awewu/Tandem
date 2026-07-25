import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, isInDriveOrgScope, scopeBreadcrumbs } from '@/lib/drive/org-scope';
import { buildAncestorChain, canRead } from '@/lib/drive/acl';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getStore } from '@/lib/storage/repository';
import { listDepts } from '@/lib/org/departments';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import { buildDriveDeptTree, type DriveDeptTreeNode } from '@/lib/drive/org-tree';
import { buildFolderSizeMap } from '@/lib/drive/folder-size';

function deptIdOf(folder: DriveFile): string | null {
  for (const principal of folder.permissions?.read ?? []) {
    if (principal.startsWith('dept:')) return principal.slice(5);
  }
  return null;
}

function isDeptRoot(folder: DriveFile): boolean {
  if (!folder.isFolder || folder.deletedAt) return false;
  if (folder.nodeRole === 'dept_root') return true;
  return folder.ownerId === '__company__'
    && (folder.permissions?.read ?? []).some((principal) => (
      principal.startsWith('dept:') && (folder.permissions?.write ?? []).includes(principal)
    ));
}

function isPersonalHomeForOwner(folder: DriveFile, ownerId: string): boolean {
  return (
    folder.isFolder
    && !folder.deletedAt
    && folder.ownerId === ownerId
    && (
      folder.nodeRole === 'personal_home'
      || (
        (folder.permissions?.read ?? []).includes(`user:${ownerId}`)
        && (folder.permissions?.write ?? []).includes(`user:${ownerId}`)
        && (folder.name === '我的工作区' || folder.name.endsWith(' 的工作区'))
      )
    )
  );
}

function buildSubtreePeopleCounts(
  depts: Array<{ id: string; parentId: string | null }>,
  directPeopleByDeptId: Map<string, number>,
): Map<string, number> {
  const deptIds = new Set(depts.map((dept) => dept.id));
  const childrenByParent = new Map<string | null, Array<{ id: string; parentId: string | null }>>();
  for (const dept of depts) {
    const parentId = dept.parentId && deptIds.has(dept.parentId) ? dept.parentId : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), dept]);
  }

  const totals = new Map<string, number>();
  const visiting = new Set<string>();
  const totalFor = (deptId: string): number => {
    if (totals.has(deptId)) return totals.get(deptId) ?? 0;
    if (visiting.has(deptId)) return directPeopleByDeptId.get(deptId) ?? 0;
    visiting.add(deptId);
    let total = directPeopleByDeptId.get(deptId) ?? 0;
    for (const child of childrenByParent.get(deptId) ?? []) {
      total += totalFor(child.id);
    }
    visiting.delete(deptId);
    totals.set(deptId, total);
    return total;
  };

  for (const dept of depts) totalFor(dept.id);
  return totals;
}

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const requestedFolderId = searchParams.get('folderId');
  const ctx = createAppContext();
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const all = (await ctx.driveRepo.list({ tenantId: auth.tenantId })).filter((file) => !file.deletedAt);
  const byId = new Map(all.map((file) => [file.id, file]));
  const folderSizeById = buildFolderSizeMap(all);
  const users = (await getStore().auth.users.list({ tenantId: auth.tenantId })).filter((user) => !user.disabled);
  const userById = new Map(users.map((user) => [user.id, user]));
  const depts = await listDepts(auth.tenantId);
  const deptById = new Map(depts.map((dept) => [dept.id, dept]));

  const visibleDeptFolders = all
    .filter(isDeptRoot)
    .filter((folder) => scope.isAdmin || isInDriveOrgScope(all, folder.id, scope))
    .filter((folder) => canRead(buildAncestorChain(folder.id, byId), actor));
  const foldersByDeptId = new Map<string, DriveFile[]>();
  for (const folder of visibleDeptFolders) {
    const deptId = deptIdOf(folder);
    if (!deptId || !deptById.has(deptId)) continue;
    foldersByDeptId.set(deptId, [...(foldersByDeptId.get(deptId) ?? []), folder]);
  }

  const peopleFolders = all
    .filter((folder) => {
      const owner = userById.get(folder.ownerId);
      return Boolean(owner && isPersonalHomeForOwner(folder, owner.id));
    })
    .filter((folder) => scope.isAdmin || isInDriveOrgScope(all, folder.parentId, scope));

  const peopleByDeptId = new Map<string, number>();
  const peopleByFolderId = new Map<string, number>();
  for (const folder of peopleFolders) {
    if (!folder.parentId) continue;
    peopleByFolderId.set(folder.parentId, (peopleByFolderId.get(folder.parentId) ?? 0) + 1);
    const parent = byId.get(folder.parentId);
    const deptId = parent ? deptIdOf(parent) : null;
    if (!deptId || !deptById.has(deptId)) continue;
    peopleByDeptId.set(deptId, (peopleByDeptId.get(deptId) ?? 0) + 1);
  }

  const canonicalFolderByDeptId = new Map<string, DriveFile>();
  for (const [deptId, folders] of Array.from(foldersByDeptId.entries())) {
    canonicalFolderByDeptId.set(
      deptId,
      [...folders].sort((a, b) => {
        const peopleDelta = (peopleByFolderId.get(b.id) ?? 0) - (peopleByFolderId.get(a.id) ?? 0);
        return peopleDelta || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
      })[0],
    );
  }

  const requestedFolder = requestedFolderId ? byId.get(requestedFolderId) : undefined;
  const requestedDeptId = requestedFolder ? deptIdOf(requestedFolder) : null;
  const firstDeptId = depts.find((dept) => canonicalFolderByDeptId.has(dept.id))?.id ?? null;
  const selectedDeptId = requestedDeptId && canonicalFolderByDeptId.has(requestedDeptId)
    ? requestedDeptId
    : requestedFolderId
    ? null
    : firstDeptId;
  const selectedDept = selectedDeptId ? deptById.get(selectedDeptId) ?? null : null;
  const selectedFolder = selectedDeptId ? canonicalFolderByDeptId.get(selectedDeptId) ?? null : null;
  const selectedFolderIds = selectedDeptId ? new Set((foldersByDeptId.get(selectedDeptId) ?? []).map((folder) => folder.id)) : new Set<string>();
  const selectedId = selectedFolder?.id ?? null;

  const childCountByParent = new Map<string, number>();
  for (const item of all) {
    if (!item.parentId) continue;
    childCountByParent.set(item.parentId, (childCountByParent.get(item.parentId) ?? 0) + 1);
  }
  const selectedPeople = selectedId
    ? peopleFolders
        .filter((folder) => folder.parentId && selectedFolderIds.has(folder.parentId))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        .map((folder) => {
          const owner = userById.get(folder.ownerId);
          const childCount = childCountByParent.get(folder.id) ?? 0;
          const hasDeleteRole = (actor.roles ?? []).some((role) => role === 'admin' || role === 'owner') || folder.ownerId === actor.id;
          const canDeleteItem = hasDeleteRole && childCount === 0;
          const canMoveItem = folder.ownerId === actor.id;
          return {
            ...folder,
            size: folderSizeById.get(folder.id) ?? 0,
            ownerName: owner?.name ?? folder.name.replace(/\s*的工作区$/, ''),
            departmentId: owner?.departmentId ?? selectedDeptId,
            childCount,
            canDelete: canDeleteItem,
            deleteDisabledReason: canDeleteItem
              ? null
              : !hasDeleteRole
              ? '仅管理员或创建者可删除'
              : '文件夹不为空，不能删除',
            canRename: false,
            renameDisabledReason: '人员文件夹由组织架构生成，不可改名',
            canMove: canMoveItem,
            moveDisabledReason: canMoveItem ? null : '只能移动自己的人员文件夹',
          };
        })
    : [];

  const breadcrumbs = selectedId
    ? scopeBreadcrumbs(buildAncestorChain(selectedId, byId).slice().reverse().map((file) => ({ id: file.id, name: file.name })), scope)
    : [];

  return NextResponse.json({
    scope,
    selectedDeptId: selectedId,
    selectedHrDeptId: selectedDeptId,
    selectedDeptName: selectedDept?.name ?? selectedFolder?.name ?? null,
    selectedIsDept: Boolean(selectedFolder),
    breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : [{ id: 'root', name: '我的工作云盘' }],
    tree: buildDriveDeptTree(depts, canonicalFolderByDeptId, buildSubtreePeopleCounts(depts, peopleByDeptId)),
    people: selectedPeople,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive/org-tree' });
