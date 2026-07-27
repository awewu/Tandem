/**
 * 组织云盘 · 预设目录树 (幂等 provision)
 *
 * 设计: 云盘骨架映射 HR 部门树 (org_hr_depts), 而非治理三省六部。
 *   - company_share  公司共享区 (根, all 可读, 仅 admin 可写)
 *   - dept_root      每个 HR 部门一个根目录 (本部门可读写), 按 parentId 镜像层级
 *   - personal_home  员工个人主目录 —— 批量/懒创建 (ensurePersonalHome), 默认仅本人可见
 *
 * 幂等: 重复调用不产生重复目录 (以 nodeRole + dept principal 为指纹去重)。
 * 依赖注入 (repo/depts) → 纯逻辑可独立单测, 不绑定 DB。
 */
import type { DriveFile } from '@/lib/types/feishu-catchup';

/** provision 所需的最小仓储接口 (真实实现 = ctx.driveRepo)。 */
export interface DriveFolderRepoLike {
  list(opts?: { tenantId?: string }): Promise<DriveFile[]>;
  create(data: Omit<DriveFile, 'id'>): Promise<DriveFile>;
  move?(id: string, parentId: string | null): Promise<DriveFile>;
  softDelete?(id: string): Promise<void>;
}

/** provision 所需的最小部门画像 (真实实现 = HrDept)。 */
export interface ProvisionDept {
  id: string;
  name: string;
  parentId: string | null;
}

/** provision 所需的最小员工画像 (真实实现 = AuthUser)。 */
export interface ProvisionUser {
  id: string;
  name?: string | null;
  departmentId?: string | null;
  disabled?: boolean | null;
  deletedAt?: string | null;
}

/** 结构性目录的 owner (中央 AI persona, 非真人)。 */
export const DRIVE_SYSTEM_OWNER = '__company__';

const nowIso = () => new Date().toISOString();

function baseFolder(
  partial: Pick<DriveFile, 'name' | 'parentId' | 'ownerId' | 'tenantId' | 'nodeRole' | 'permissions'>,
): Omit<DriveFile, 'id'> {
  const ts = nowIso();
  return {
    mimeType: 'application/x-directory',
    size: 0,
    storageKey: '',
    storageUrl: null,
    version: 1,
    isFolder: true,
    distillable: true,
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

function hasPrincipal(f: DriveFile, mode: 'read' | 'write', principal: string): boolean {
  return (f.permissions?.[mode] ?? []).includes(principal);
}

function descendantCount(rootId: string, folders: DriveFile[]): number {
  const childrenByParent = new Map<string, DriveFile[]>();
  for (const folder of folders) {
    if (!folder.isFolder || folder.deletedAt || !folder.parentId) continue;
    childrenByParent.set(folder.parentId, [...(childrenByParent.get(folder.parentId) ?? []), folder]);
  }
  let count = 0;
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const folder = stack.pop()!;
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    count++;
    stack.push(...(childrenByParent.get(folder.id) ?? []));
  }
  return count;
}

function preferPopulatedFolder(a: DriveFile, b: DriveFile, folders: DriveFile[]): DriveFile {
  const countDelta = descendantCount(b.id, folders) - descendantCount(a.id, folders);
  if (countDelta !== 0) return countDelta > 0 ? b : a;
  const roleDelta = Number(b.nodeRole === 'company_share' || b.nodeRole === 'dept_root')
    - Number(a.nodeRole === 'company_share' || a.nodeRole === 'dept_root');
  if (roleDelta !== 0) return roleDelta > 0 ? b : a;
  return a.createdAt.localeCompare(b.createdAt) <= 0 ? a : b;
}

/** 从现存目录里找 company_share 根。兼容真实库未持久化 nodeRole 的旧数据。 */
export function findCompanyShare(folders: DriveFile[]): DriveFile | undefined {
  const candidates = folders.filter((f) => (
    f.isFolder
    && !f.deletedAt
    && (
      f.nodeRole === 'company_share'
      || (
        !f.parentId
        && f.name === '公司共享区'
        && hasPrincipal(f, 'read', 'all')
      )
    )
  ));
  return candidates.reduce<DriveFile | undefined>(
    (best, candidate) => best ? preferPopulatedFolder(best, candidate, folders) : candidate,
    undefined,
  );
}

function preferDeptRoot(a: DriveFile, b: DriveFile, folders: DriveFile[]): DriveFile {
  const countDelta = descendantCount(b.id, folders) - descendantCount(a.id, folders);
  if (countDelta !== 0) return countDelta > 0 ? b : a;
  const roleDelta = Number(b.nodeRole === 'dept_root') - Number(a.nodeRole === 'dept_root');
  if (roleDelta !== 0) return roleDelta > 0 ? b : a;
  return a.createdAt.localeCompare(b.createdAt) <= 0 ? a : b;
}

function isDeptRootLike(f: DriveFile, principal: string): boolean {
  return (
    f.isFolder
    && !f.deletedAt
    && (
      f.nodeRole === 'dept_root'
      || (f.ownerId === DRIVE_SYSTEM_OWNER && hasPrincipal(f, 'write', principal))
    )
  );
}

/** 从现存目录里按 dept principal 建 deptId → dept_root 索引 (幂等指纹)。 */
export function indexDeptRoots(folders: DriveFile[]): Map<string, DriveFile> {
  const map = new Map<string, DriveFile>();
  for (const f of folders) {
    if (!f.isFolder || f.deletedAt) continue;
    for (const p of f.permissions?.read ?? []) {
      if (!p.startsWith('dept:')) continue;
      if (!isDeptRootLike(f, p)) continue;
      const deptId = p.slice(5);
      const current = map.get(deptId);
      map.set(deptId, current ? preferDeptRoot(current, f, folders) : f);
    }
  }
  return map;
}

export function findDeptRoot(folders: DriveFile[], departmentId?: string | null): DriveFile | undefined {
  if (!departmentId) return undefined;
  return indexDeptRoots(folders).get(departmentId);
}

function isPersonalHomeForUser(f: DriveFile, userId: string): boolean {
  return (
    f.isFolder
    && !f.deletedAt
    && f.ownerId === userId
    && (
      f.nodeRole === 'personal_home'
      || (
        hasPrincipal(f, 'read', `user:${userId}`)
        && hasPrincipal(f, 'write', `user:${userId}`)
        && (f.name === '我的工作区' || f.name.endsWith(' 的工作区'))
      )
    )
  );
}

async function ensurePersonalHomeFromSnapshot(opts: {
  tenantId: string;
  userId: string;
  userName?: string;
  departmentId?: string | null;
  repo: DriveFolderRepoLike;
  all: DriveFile[];
}): Promise<{ folder: DriveFile; created: boolean }> {
  const { tenantId, userId, repo } = opts;
  const folders = opts.all.filter((f) => f.isFolder && !f.deletedAt);

  // 挂载点: 本部门 dept_root → company_share → 根
  let parentId: string | null = null;
  if (opts.departmentId) {
    const deptRoot = indexDeptRoots(folders).get(opts.departmentId);
    if (deptRoot) parentId = deptRoot.id;
  }
  if (!parentId) parentId = findCompanyShare(folders)?.id ?? null;

  const existingHomes = folders
    .filter((f) => isPersonalHomeForUser(f, userId))
    .sort((a, b) => {
      const aCurrent = (a.parentId ?? null) === parentId;
      const bCurrent = (b.parentId ?? null) === parentId;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
  let existing = existingHomes[0];
  if (existing) {
    if ((existing.parentId ?? null) !== parentId && repo.move) {
      existing = await repo.move(existing.id, parentId);
      const idx = opts.all.findIndex((f) => f.id === existing!.id);
      if (idx >= 0) opts.all[idx] = existing;
    }
    if (repo.move && repo.softDelete && existingHomes.length > 1) {
      for (const duplicate of existingHomes.slice(1)) {
        for (const child of opts.all.filter((f) => !f.deletedAt && (f.parentId ?? null) === duplicate.id)) {
          const moved = await repo.move(child.id, existing.id);
          const idx = opts.all.findIndex((f) => f.id === moved.id);
          if (idx >= 0) opts.all[idx] = moved;
        }
        await repo.softDelete(duplicate.id);
        const idx = opts.all.findIndex((f) => f.id === duplicate.id);
        if (idx >= 0) opts.all[idx] = { ...opts.all[idx], deletedAt: nowIso() };
      }
    }
    return { folder: existing, created: false };
  }

  const folder = await repo.create(
    baseFolder({
      name: opts.userName ? `${opts.userName} 的工作区` : '我的工作区',
      parentId,
      ownerId: userId,
      tenantId,
      nodeRole: 'personal_home',
      // 策略: 仅本人可见, 需显式授权才共享
      permissions: { read: [`user:${userId}`], write: [`user:${userId}`] },
    }),
  );
  opts.all.push(folder);
  return { folder, created: true };
}

/**
 * 幂等确保 company_share + 每个部门 dept_root 存在。
 * 部门按 parentId 拓扑排序 (父先建), dept_root 挂到父部门 dept_root 之下, 顶层挂 company_share。
 */
export async function provisionOrgDrive(opts: {
  tenantId: string;
  depts: ProvisionDept[];
  users?: ProvisionUser[];
  repo: DriveFolderRepoLike;
  systemOwnerId?: string;
}): Promise<{ created: DriveFile[]; existingCount: number }> {
  const { tenantId, depts, repo } = opts;
  const owner = opts.systemOwnerId ?? DRIVE_SYSTEM_OWNER;
  const folders = (await repo.list({ tenantId })).filter((f) => f.isFolder);
  const created: DriveFile[] = [];

  // 1) company_share 根
  let companyShare = findCompanyShare(folders);
  if (!companyShare) {
    companyShare = await repo.create(
      baseFolder({
        name: '公司共享区',
        parentId: null,
        ownerId: owner,
        tenantId,
        nodeRole: 'company_share',
        permissions: { read: ['all'], write: ['role:admin', 'role:owner'] },
      }),
    );
    created.push(companyShare);
    folders.push(companyShare);
  }

  // 2) dept_root · 父先建 (拓扑)
  const deptRootByDeptId = indexDeptRoots(folders);
  const deptById = new Map(depts.map((d) => [d.id, d]));

  const ensureDeptRoot = async (dept: ProvisionDept, guard = 0): Promise<DriveFile> => {
    const existing = deptRootByDeptId.get(dept.id);
    if (existing) return existing;

    // 解析父挂载点: 父部门 dept_root (若父存在且未越界) 否则 company_share
    let parentFolderId = companyShare!.id;
    if (dept.parentId && guard < 64) {
      const parentDept = deptById.get(dept.parentId);
      if (parentDept) {
        const parentRoot = await ensureDeptRoot(parentDept, guard + 1);
        parentFolderId = parentRoot.id;
      }
    }

    const folder = await repo.create(
      baseFolder({
        name: dept.name,
        parentId: parentFolderId,
        ownerId: owner,
        tenantId,
        nodeRole: 'dept_root',
        permissions: { read: [`dept:${dept.id}`], write: [`dept:${dept.id}`] },
      }),
    );
    deptRootByDeptId.set(dept.id, folder);
    created.push(folder);
    folders.push(folder);
    return folder;
  };

  for (const dept of depts) {
    await ensureDeptRoot(dept);
  }

  // 3) personal_home · 当前组织人员每人一个工作区, 挂在其部门 dept_root 下
  for (const user of opts.users ?? []) {
    if (!user.id || user.disabled || user.deletedAt) continue;
    const result = await ensurePersonalHomeFromSnapshot({
      tenantId,
      userId: user.id,
      userName: user.name?.trim() || undefined,
      departmentId: user.departmentId ?? null,
      repo,
      all: folders,
    });
    if (result.created) created.push(result.folder);
  }

  return { created, existingCount: folders.length };
}

/**
 * 幂等确保某员工的 personal_home 存在, 默认【仅本人可见】(策略决定)。
 * 挂在其部门 dept_root 之下 (若可解析), 否则挂 company_share / 根。
 */
export async function ensurePersonalHome(opts: {
  tenantId: string;
  userId: string;
  userName?: string;
  departmentId?: string | null;
  repo: DriveFolderRepoLike;
}): Promise<DriveFile> {
  const all = (await opts.repo.list({ tenantId: opts.tenantId })).filter((f) => !f.deletedAt);
  const result = await ensurePersonalHomeFromSnapshot({ ...opts, userName: opts.userName, all });
  return result.folder;
}
