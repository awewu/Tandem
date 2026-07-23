import type { DriveFile } from '@/lib/types/feishu-catchup';
import type { DriveFileRepository } from '@/lib/repositories/drive-repo';
import type { DriveAclUser } from '@/lib/drive/acl';
import { buildAncestorChain } from '@/lib/drive/acl';
import { listDepts } from '@/lib/org/departments';
import { ensurePersonalHome, findCompanyShare, findDeptRoot, provisionOrgDrive } from '@/lib/drive/provision';

export interface DriveOrgScope {
  rootFolderId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  hasDepartment: boolean;
  isAdmin: boolean;
}

export async function ensureDriveOrgScope(opts: {
  tenantId: string;
  userId: string;
  actor: DriveAclUser;
  repo: DriveFileRepository;
}): Promise<DriveOrgScope> {
  const depts = await listDepts(opts.tenantId).catch(() => []);
  await provisionOrgDrive({ tenantId: opts.tenantId, depts, repo: opts.repo });

  const folders = (await opts.repo.list({ tenantId: opts.tenantId })).filter((f) => f.isFolder && !f.deletedAt);
  const isAdmin = (opts.actor.roles ?? []).some((r) => r === 'admin' || r === 'owner');
  if (isAdmin) {
    const companyShare = findCompanyShare(folders);
    return {
      rootFolderId: companyShare?.id ?? null,
      departmentId: opts.actor.departmentId ?? null,
      departmentName: '全部组织',
      hasDepartment: true,
      isAdmin: true,
    };
  }

  const deptRoot = findDeptRoot(folders, opts.actor.departmentId);
  const dept = opts.actor.departmentId ? depts.find((d) => d.id === opts.actor.departmentId) : undefined;
  if (deptRoot) {
    await ensurePersonalHome({
      tenantId: opts.tenantId,
      userId: opts.userId,
      departmentId: opts.actor.departmentId,
      repo: opts.repo,
    });
  }

  return {
    rootFolderId: deptRoot?.id ?? null,
    departmentId: opts.actor.departmentId ?? null,
    departmentName: dept?.name ?? deptRoot?.name ?? null,
    hasDepartment: Boolean(opts.actor.departmentId && deptRoot),
    isAdmin: false,
  };
}

export function isInDriveOrgScope(
  files: DriveFile[],
  folderId: string | null | undefined,
  scope: DriveOrgScope,
): boolean {
  if (!folderId || !scope.rootFolderId) return false;
  if (folderId === scope.rootFolderId) return true;
  const byId = new Map(files.filter((f) => !f.deletedAt).map((f) => [f.id, f]));
  return buildAncestorChain(folderId, byId).some((f) => f.id === scope.rootFolderId);
}

export function scopeBreadcrumbs(
  chain: Array<{ id: string; name: string }>,
  scope: DriveOrgScope,
): Array<{ id: string; name: string }> {
  if (!scope.rootFolderId) return [];
  const rootIndex = chain.findIndex((c) => c.id === scope.rootFolderId);
  if (rootIndex >= 0) return chain.slice(rootIndex);
  return [];
}
