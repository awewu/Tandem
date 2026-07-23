/**
 * 组织云盘 · ACL (访问控制) 纯函数层
 *
 * 设计 (docs/ORG-DRIVE-DISTILLATION-DESIGN-2026-07-21.md §4):
 *   - 可见性由 ACL 管 (正交于「权威度」由组织记忆签批管)。
 *   - principal 取值: 'user:<id>' | 'dept:<id>' | 'ministry:<id>' | 'role:<r>' | 'all'。
 *   - 裸 userId 向后兼容, 按 'user:' 解释 (存量 permissions 零迁移)。
 *   - 目录继承: 子节点未显式设权 → 继承最近祖先目录的 ACL。
 *   - owner 恒可读写。
 *
 * 本文件不依赖 React / DB / 具体存储, 纯函数, 可独立单测。
 */

export type DrivePrincipal = string;

/** 鉴权所需的最小用户画像 (与 auth 类型解耦, 调用方适配)。 */
export interface DriveAclUser {
  id: string;
  departmentId?: string | null;
  ministryId?: string | null;
  roles?: string[];
}

/** ACL 解析所需的最小节点画像。 */
export interface DriveNodeLike {
  id: string;
  ownerId: string;
  parentId?: string | null;
  permissions?: { read?: string[]; write?: string[] };
}

/** 归一化: 裸 userId (无 ':' 且非 'all') 按 'user:' 解释。 */
export function normalizePrincipal(p: string): DrivePrincipal {
  const t = p.trim();
  if (!t) return t;
  if (t === 'all') return t;
  if (t.includes(':')) return t;
  return `user:${t}`;
}

/** 用户命中的全部 principal 集合 (用于与节点 ACL 求交)。 */
export function userPrincipals(user: DriveAclUser): Set<DrivePrincipal> {
  const set = new Set<DrivePrincipal>(['all', `user:${user.id}`]);
  if (user.departmentId) set.add(`dept:${user.departmentId}`);
  if (user.ministryId) set.add(`ministry:${user.ministryId}`);
  for (const r of user.roles ?? []) set.add(`role:${r}`);
  return set;
}

/**
 * 沿祖先链解析有效读/写 principal 集合。
 * chain[0] = 目标节点, 依次向上, 末尾 = 根。
 * 某维度 (read/write) 在最近一个"显式设置了非空集合"的节点处定值 (继承)。
 */
export function resolveEffectivePermissions(
  chain: DriveNodeLike[],
): { read: Set<DrivePrincipal>; write: Set<DrivePrincipal> } {
  let read: string[] | undefined;
  let write: string[] | undefined;
  for (const node of chain) {
    const r = node.permissions?.read;
    const w = node.permissions?.write;
    if (read === undefined && r && r.length > 0) read = r;
    if (write === undefined && w && w.length > 0) write = w;
    if (read !== undefined && write !== undefined) break;
  }
  return {
    read: new Set((read ?? []).map(normalizePrincipal)),
    write: new Set((write ?? []).map(normalizePrincipal)),
  };
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  // 迭代较小集合 (forEach 避免 downlevel iteration)
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let hit = false;
  small.forEach((x) => { if (big.has(x)) hit = true; });
  return hit;
}

/**
 * 用户能否读该节点。chain[0] = 节点, 向上到根 (用于继承解析)。
 * owner 恒可读; 否则命中有效 read 集合任一 principal 即可。
 */
export function canRead(chain: DriveNodeLike[], user: DriveAclUser): boolean {
  const node = chain[0];
  if (!node) return false;
  if (node.ownerId === user.id) return true;
  const { read } = resolveEffectivePermissions(chain);
  return intersects(read, userPrincipals(user));
}

/**
 * 用户能否写该节点。owner 恒可写; 否则命中有效 write 集合任一 principal。
 */
export function canWrite(chain: DriveNodeLike[], user: DriveAclUser): boolean {
  const node = chain[0];
  if (!node) return false;
  if (node.ownerId === user.id) return true;
  const { write } = resolveEffectivePermissions(chain);
  return intersects(write, userPrincipals(user));
}

/**
 * 从扁平节点集合构造某节点的祖先链 (含自身, 自身在前)。
 * 防环: 最多走 64 层。找不到 parent 即停止。
 */
export function buildAncestorChain<T extends DriveNodeLike>(
  nodeId: string,
  byId: Map<string, T>,
): T[] {
  const chain: T[] = [];
  let cur = byId.get(nodeId);
  let guard = 0;
  const seen = new Set<string>();
  while (cur && guard < 64 && !seen.has(cur.id)) {
    chain.push(cur);
    seen.add(cur.id);
    guard++;
    const pid = cur.parentId;
    if (!pid) break;
    cur = byId.get(pid);
  }
  return chain;
}
