/**
 * 测试专用：内存版 DataSource / Repository 替身（零新依赖，仅供 *.nodetest.ts 用）。
 *
 * 目的：让依赖 `withRlsTransaction(this.ds, work)` 的服务方法能在**不连真库**的前提下
 * 被单元测试——`withRlsTransaction` 内部只调用 `dataSource.transaction(cb)` 并在事务里
 * 跑 `manager.query('SELECT set_config...')`，故此替身实现 `transaction` + `getRepository`
 * + `query` 即可承载真实服务逻辑（状态机/版本锚点/幂等/校验分支）。
 *
 * 仅实现服务实际用到的 Repository 子集：create / save / find / findOne / findOneBy。
 * `where` 仅支持平铺等值匹配（本仓服务的 where 均为平铺条件 + 展开的 ownershipScope）。
 */

type Row = Record<string, any>;
type WhereClause = Record<string, any> | Record<string, any>[];

let idSeq = 1;
function nextId(): string {
  return `test-id-${idSeq++}`;
}

function matchesOne(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true; // 忽略 undefined（等价于未约束）
    return row[k] === v;
  });
}

function matches(row: Row, where?: WhereClause): boolean {
  if (!where) return true;
  if (Array.isArray(where)) return where.some((w) => matchesOne(row, w));
  return matchesOne(row, where);
}

export class InMemoryRepository<T extends Row = Row> {
  readonly rows: T[] = [];

  create(obj: Partial<T> = {}): T {
    return { ...(obj as T) };
  }

  async save(obj: T): Promise<T> {
    const r = obj as Row;
    const existing = r.id ? this.rows.find((x) => (x as Row).id === r.id) : undefined;
    const now = new Date();
    if (existing) {
      Object.assign(existing, obj, { updatedAt: now });
      return existing;
    }
    if (!r.id) r.id = nextId();
    if (!r.createdAt) r.createdAt = now;
    r.updatedAt = now;
    this.rows.push(obj);
    return obj;
  }

  async find(opts: { where?: WhereClause; order?: Record<string, 'ASC' | 'DESC'> } = {}): Promise<T[]> {
    let out = this.rows.filter((r) => matches(r, opts.where));
    const order = opts.order;
    if (order) {
      const [key, dir] = Object.entries(order)[0];
      out = [...out].sort((a, b) => {
        const av = a[key]; const bv = b[key];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return dir === 'DESC' ? -cmp : cmp;
      });
    }
    return out;
  }

  async findOne(opts: { where?: WhereClause } = {}): Promise<T | null> {
    return this.rows.find((r) => matches(r, opts.where)) ?? null;
  }

  async findOneBy(where: Record<string, any>): Promise<T | null> {
    return this.rows.find((r) => matchesOne(r, where)) ?? null;
  }

  async findOneByOrFail(where: Record<string, any>): Promise<T> {
    const row = this.rows.find((r) => matchesOne(r, where));
    if (!row) throw new Error('EntityNotFound: findOneByOrFail matched no rows');
    return row;
  }

  /** 测试辅助：直接注入初始数据（绕过 create/save 语义）。 */
  seed(...rows: T[]): this {
    for (const row of rows) {
      const r = row as Row;
      if (!r.id) r.id = nextId();
      this.rows.push(row);
    }
    return this;
  }
}

export class FakeEntityManager {
  private readonly repos = new Map<unknown, InMemoryRepository>();
  constructor(seedRepos?: Map<unknown, InMemoryRepository>) {
    if (seedRepos) this.repos = seedRepos;
  }
  getRepository<T extends Row = Row>(entity: unknown): InMemoryRepository<T> {
    let repo = this.repos.get(entity);
    if (!repo) { repo = new InMemoryRepository(); this.repos.set(entity, repo); }
    return repo as InMemoryRepository<T>;
  }
  async query(): Promise<any[]> { return []; } // set_config no-op
}

/**
 * 构造内存 DataSource 替身。可预置各实体的 repo（用于测试前 seed 数据）。
 * 返回 { ds, manager, repoFor } 便于断言。
 */
export function makeFakeDataSource(seed?: Array<[unknown, InMemoryRepository]>) {
  const repos = new Map<unknown, InMemoryRepository>();
  if (seed) for (const [e, r] of seed) repos.set(e, r);
  const manager = new FakeEntityManager(repos);
  const ds: any = {
    transaction: async <R>(cb: (m: FakeEntityManager) => Promise<R>): Promise<R> => cb(manager),
  };
  return {
    ds,
    manager,
    repoFor: <T extends Row = Row>(entity: unknown) => manager.getRepository<T>(entity),
  };
}
