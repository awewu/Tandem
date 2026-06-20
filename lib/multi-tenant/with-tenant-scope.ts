/**
 * withTenantScope · 统一租户隔离包装 (宪章 §23 铁律 #1: 租户隔离零信任)
 *
 * 把任意 Repository<T> 包成"只能访问单一租户"的 scoped 仓储, 收敛此前逐路由
 * 手写的 `tenantId` 过滤 (审计 P2-A: 散落 87 文件, 已漏 2 处)。
 *
 * 关键安全约束:
 *   - tenantId **必须**来自鉴权上下文 (requireAuth → JWT claim), 绝不来自请求体 / header。
 *   - create: tenantId 由本层强制注入, 覆盖调用方传入的任何值 (防 P0-A 写注入)。
 *   - list:   强制按 tenantId 过滤 (防 P0-B 读泄露)。
 *   - get/update/delete: 命中他租户记录视同不存在 (get→null, update/delete→抛错)。
 *
 * 用法:
 *   const auth = requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const approvals = withTenantScope(getStore().approvals, auth.tenantId);
 *   await approvals.create({ ... });   // tenantId 自动注入
 *   await approvals.list();            // 自动只返回本租户
 */

import type { ListOptions, Repository } from '../storage/repository';

/** withTenantScope 适用的记录: 必须有 id, 可带 tenantId (缺省视为 'default')。 */
export interface TenantScopedRecord {
  id: string;
  tenantId?: string;
}

/** 跨租户访问既有记录时抛出 (update/delete 命中他租户)。 */
export class TenantScopeViolationError extends Error {
  constructor(public readonly recordId: string) {
    super(`tenant scope violation: record ${recordId} not in caller tenant`);
    this.name = 'TenantScopeViolationError';
  }
}

const DEFAULT_TENANT = 'default';

export function withTenantScope<T extends TenantScopedRecord>(
  repo: Repository<T>,
  tenantId: string,
): Repository<T> {
  const belongs = (row: T | null): row is T =>
    !!row && (row.tenantId ?? DEFAULT_TENANT) === tenantId;

  return {
    async get(id: string): Promise<T | null> {
      const row = await repo.get(id);
      return belongs(row) ? row : null;
    },

    async list(filter?: Partial<T>, opts?: ListOptions): Promise<T[]> {
      if (tenantId !== DEFAULT_TENANT) {
        // 真实租户: tenantId 注入到 filter 下推存储层 (pushdown 友好, P1-B),
        // 最后注入使调用方无法借 filter 覆盖隔离 (即便传了 tenantId 也被强制覆盖)。
        return repo.list({ ...(filter ?? {}), tenantId } as Partial<T>, opts);
      }
      // 默认租户 (自用单租户): 兼容历史无 tenantId 行 (?? 'default'), 与 belongs() 语义一致。
      const rows = await repo.list(filter, opts);
      return rows.filter((r) => (r.tenantId ?? DEFAULT_TENANT) === DEFAULT_TENANT);
    },

    async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
      // tenantId 强制取自鉴权上下文, 覆盖 body 注入值 (防 P0-A)。
      return repo.create({ ...(data as object), tenantId } as Omit<T, 'id'> & { id?: string });
    },

    async update(id: string, data: Partial<T>): Promise<T> {
      const existing = await repo.get(id);
      if (!belongs(existing)) throw new TenantScopeViolationError(id);
      // 不允许通过 update 改写 tenantId (防越界搬移)。
      const { tenantId: _ignore, ...rest } = data as Partial<T> & { tenantId?: string };
      return repo.update(id, rest as Partial<T>);
    },

    async delete(id: string): Promise<void> {
      const existing = await repo.get(id);
      if (!belongs(existing)) throw new TenantScopeViolationError(id);
      return repo.delete(id);
    },
  };
}
