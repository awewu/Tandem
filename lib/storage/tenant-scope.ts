/**
 * Tenant Scope · 存储层租户隔离机制 (机制化收口, 2026-08)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的隐患 (代码审计 §1.4):
 *   旧状态: KvStore Repository.get(id) 只按 (collection, id) 查, 无租户校验;
 *           list() 仅当调用方主动传 filter.tenantId 才隔离.
 *           => 多租户隔离是"service 层约定", 不是"存储层机制".
 *           任一 service 忘传 tenantId, 或用已知 id 直取, 即可跨租户读.
 *
 *   本机制: 用 AsyncLocalStorage 挂一个"当前请求租户"作用域.
 *           作用域激活时:
 *             - get(id): 命中记录若带 tenantId 且与作用域不符 → 视为 not-found (返回 null),
 *                        不泄漏存在性; 记录无 tenantId 字段 (全局/共享) → 放行.
 *             - list(): 强制注入/覆盖 filter.tenantId 为作用域值.
 *           作用域未激活时 (单测 / 后台任务 / 中央 AI 跨公司读): 行为完全不变, 向后兼容.
 *
 * 设计原则:
 *   - 零签名改动: Repository<T> 接口不变, 现有 70+ 仓储与全部调用方无需改.
 *   - opt-in 强制: 只有显式 runInTenantScope 包裹的执行路径才启用隔离.
 *     API 边界 (requireAuth 拿到 tenantId 后) 包裹 handler 即全模块受保护.
 *   - 全局/共享数据 (无 tenantId 字段, 如 __company__ persona) 不误伤.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Repository, ListOptions } from './repository';

const tenantScopeStorage = new AsyncLocalStorage<string>();

/**
 * 在指定租户作用域内执行 fn. 期间所有走 TandemStore 的 get/list 自动按 tenantId 隔离.
 * 嵌套调用以最内层为准 (ALS 语义).
 */
export function runInTenantScope<R>(tenantId: string, fn: () => R): R {
  return tenantScopeStorage.run(tenantId, fn);
}

/** 当前激活的租户作用域; 未激活返回 undefined (= 不启用隔离, 行为不变). */
export function getActiveTenantScope(): string | undefined {
  return tenantScopeStorage.getStore();
}

/**
 * 记录的"有效租户": record.tenantId ?? 'default'.
 *
 * 与 KvStore.tenantId 列语义一致 —— DrizzleKvRepository.create() 把
 * `item.tenantId ?? 'default'` 落到列, 故无 tenantId 字段的记录 (如 ImMessage)
 * 有效租户即 'default'. memory-store 与 drizzle 必须用同一口径, 否则作用域激活时
 * memory 会把无 tenantId 字段的记录全部误滤 (drizzle 走列 eq 则命中 'default').
 */
export function effectiveTenantOf(record: unknown): string {
  if (record === null || typeof record !== 'object') return 'default';
  const t = (record as Record<string, unknown>).tenantId;
  return typeof t === 'string' ? t : 'default';
}

/**
 * get(id)/list() 的租户校验: 命中记录是否对当前作用域可见.
 *   - 无激活作用域 → 恒可见 (向后兼容).
 *   - 有效租户 (tenantId ?? 'default') 与作用域一致 → 可见; 否则不可见.
 */
export function isRecordVisibleInScope(record: unknown): boolean {
  const scope = getActiveTenantScope();
  if (scope === undefined) return true;
  return effectiveTenantOf(record) === scope;
}

/**
 * list(filter) 的租户注入 (DrizzleKvRepository 用, 走 KvStore.tenantId 列 eq):
 * 作用域激活时强制把 filter.tenantId 设为作用域值 (覆盖调用方传入值, 防越权列举).
 * 列恒有值 (create 默认 'default'), 故与 effectiveTenantOf 口径一致.
 * memory-store 不用此注入 (改用 isRecordVisibleInScope 逐条判定, 避免误滤无字段记录).
 * 返回可能被改写的 filter (浅拷贝, 不改原对象).
 */
export function applyTenantScopeToFilter<T>(filter?: Partial<T>): Partial<T> | undefined {
  const scope = getActiveTenantScope();
  if (scope === undefined) return filter;
  return { ...(filter ?? {}), tenantId: scope } as unknown as Partial<T>;
}

/**
 * 通用作用域强制装饰器: 包裹一个 Repository, 让其 get/list 在作用域激活时按有效租户过滤.
 *
 * 用于 drizzle 侧的强类型定制仓储 (KPI / agentTemplates 等) —— 它们不走
 * DrizzleKvRepository 的内建 scope 逻辑, 若不包裹会与 memory-store 的通用
 * InMemoryRepository (已 scope-aware) 产生"memory 隔离 / drizzle 不隔离"分歧.
 * 装饰器在 DB 查询后做 JS 逐条过滤 (这些表非热表, 且原实现本就全量+JS过滤, 无额外代价).
 * create/update/delete 透传 (内部 this.get 仍指向原仓储, 不受影响).
 */
export function enforceTenantScope<T extends { id: string }>(repo: Repository<T>): Repository<T> {
  return {
    async get(id: string) {
      const r = await repo.get(id);
      return r !== null && isRecordVisibleInScope(r) ? r : null;
    },
    async list(filter?: Partial<T>, opts?: ListOptions) {
      const rows = await repo.list(filter, opts);
      if (getActiveTenantScope() === undefined) return rows;
      return rows.filter((r) => isRecordVisibleInScope(r));
    },
    create: (data) => repo.create(data),
    update: (id, data) => repo.update(id, data),
    delete: (id) => repo.delete(id),
  };
}
