/**
 * 组织云盘 · 预设目录树 (幂等 provision)
 *
 * 设计: 云盘骨架映射 HR 部门树 (org_hr_depts), 而非治理三省六部。
 *   - company_share  公司共享区 (根, all 可读, 仅 admin 可写)
 *   - dept_root      每个 HR 部门一个根目录 (本部门可读写), 按 parentId 镜像层级
 *   - personal_home  员工个人主目录 —— 懒创建 (ensurePersonalHome), 默认仅本人可见
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

/** 从现存目录里找 company_share 根。兼容真实库未持久化 nodeRole 的旧数据。 */
export function findCompanyShare(folders: DriveFile[]): DriveFile | undefined {
  return folders.find((f) => f.isFolder && f.nodeRole === 'company_share' && !f.deletedAt)
    ?? folders.find((f) => (
      f.isFolder
      && !f.deletedAt
      && !f.parentId
      && f.name === '公司共享区'
      && hasPrincipal(f, 'read', 'all')
    ));
}

/** 从现存目录里按 dept principal 建 deptId → dept_root 索引 (幂等指纹)。 */
export function indexDeptRoots(folders: DriveFile[]): Map<string, DriveFile> {
  const map = new Map<string, DriveFile>();
  for (const f of folders) {
    if (!f.isFolder || f.deletedAt) continue;
    for (const p of f.permissions?.read ?? []) {
      if (!p.startsWith('dept:')) continue;
      const deptId = p.slice(5);
      const looksLikeDeptRoot = f.nodeRole === 'dept_root'
        || (f.ownerId === DRIVE_SYSTEM_OWNER && hasPrincipal(f, 'write', p));
      if (looksLikeDeptRoot) map.set(deptId, f);
    }
  }
  return map;
}

export function findDeptRoot(folders: DriveFile[], departmentId?: string | null): DriveFile | undefined {
  if (!departmentId) return undefined;
  return indexDeptRoots(folders).get(departmentId);
}

function isPersonalHomeForUser(f: DriveFile, userId: string, parentId: string | null): boolean {
  return (
    f.isFolder
    && !f.deletedAt
    && f.ownerId === userId
    && (f.parentId ?? null) === parentId
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

/**
 * 幂等确保 company_share + 每个部门 dept_root 存在。
 * 部门按 parentId 拓扑排序 (父先建), dept_root 挂到父部门 dept_root 之下, 顶层挂 company_share。
 */
export async function provisionOrgDrive(opts: {
  tenantId: string;
  depts: ProvisionDept[];
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
    return folder;
  };

  for (const dept of depts) {
    await ensureDeptRoot(dept);
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
  const { tenantId, userId, repo } = opts;
  const all = (await repo.list({ tenantId })).filter((f) => !f.deletedAt);
  const folders = all.filter((f) => f.isFolder);

  // 挂载点: 本部门 dept_root → company_share → 根
  let parentId: string | null = null;
  if (opts.departmentId) {
    const deptRoot = indexDeptRoots(folders).get(opts.departmentId);
    if (deptRoot) parentId = deptRoot.id;
  }
  if (!parentId) parentId = findCompanyShare(folders)?.id ?? null;

  const existingHomes = folders
    .filter((f) => isPersonalHomeForUser(f, userId, parentId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const existing = existingHomes[0];
  if (existing) {
    if (repo.move && repo.softDelete && existingHomes.length > 1) {
      for (const duplicate of existingHomes.slice(1)) {
        for (const child of all.filter((f) => (f.parentId ?? null) === duplicate.id)) {
          await repo.move(child.id, existing.id);
        }
        await repo.softDelete(duplicate.id);
      }
    }
    return existing;
  }

  return repo.create(
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
}
