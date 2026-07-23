/**
 * 搭子手抄 · 数据库服务层 (库定义 + 行数据 CRUD, 按 ownerId 隔离).
 * 通过 TandemStore 访问 KvStore, 不直接依赖 DB 实现.
 */

import { getStore, generateId } from '../storage/repository';
import type {
  ShouchaoDatabase,
  ShouchaoRow,
  ShouchaoProperty,
  ShouchaoView,
  ShouchaoCellValue,
} from '../types/shouchao-db';

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 数据库定义
// ---------------------------------------------------------------------------

/** 新建数据库的默认属性 + 表格视图 (开箱即用). */
function defaultProperties(): ShouchaoProperty[] {
  return [
    { id: generateId('prop'), name: '名称', type: 'text' },
    { id: generateId('prop'), name: '状态', type: 'select', options: ['未开始', '进行中', '已完成'] },
    { id: generateId('prop'), name: '日期', type: 'date' },
  ];
}

export async function listDatabases(ownerId: string): Promise<ShouchaoDatabase[]> {
  const store = getStore();
  const all = await store.shouchaoDatabases.list({ ownerId } as Partial<ShouchaoDatabase>);
  return all
    .filter((d) => !d.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDatabase(ownerId: string, id: string): Promise<ShouchaoDatabase | null> {
  const store = getStore();
  const db = await store.shouchaoDatabases.get(id);
  if (!db || db.ownerId !== ownerId || db.deletedAt) return null;
  return db;
}

export async function createDatabase(input: {
  ownerId: string;
  tenantId: string;
  name?: string;
  icon?: string;
  parentId?: string;
}): Promise<ShouchaoDatabase> {
  const store = getStore();
  const ts = nowIso();
  const props = defaultProperties();
  const view: ShouchaoView = { id: generateId('view'), name: '表格', type: 'table' };
  return store.shouchaoDatabases.create({
    id: generateId('scdb'),
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    name: (input.name ?? '').trim() || '未命名数据库',
    icon: input.icon || undefined,
    properties: props,
    views: [view],
    parentId: input.parentId || undefined,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateDatabase(
  ownerId: string,
  id: string,
  patch: Partial<Pick<ShouchaoDatabase, 'name' | 'icon' | 'properties' | 'views'>>,
): Promise<ShouchaoDatabase | null> {
  const existing = await getDatabase(ownerId, id);
  if (!existing) return null;
  const store = getStore();
  const clean: Partial<ShouchaoDatabase> = { updatedAt: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim() || '未命名数据库';
  if (patch.icon !== undefined) clean.icon = patch.icon || undefined;
  if (patch.properties !== undefined) clean.properties = patch.properties;
  if (patch.views !== undefined) clean.views = patch.views;
  return store.shouchaoDatabases.update(id, clean);
}

/** 删除库 = 软删库 + 级联软删其行. */
export async function deleteDatabase(ownerId: string, id: string): Promise<boolean> {
  const existing = await getDatabase(ownerId, id);
  if (!existing) return false;
  const store = getStore();
  const ts = nowIso();
  await store.shouchaoDatabases.update(id, { deletedAt: ts, updatedAt: ts });
  const rows = await store.shouchaoRows.list({ ownerId, databaseId: id } as Partial<ShouchaoRow>);
  await Promise.all(
    rows.filter((r) => !r.deletedAt).map((r) => store.shouchaoRows.update(r.id, { deletedAt: ts, updatedAt: ts })),
  );
  return true;
}

// ---------------------------------------------------------------------------
// 行数据
// ---------------------------------------------------------------------------

export async function listRows(ownerId: string, databaseId: string): Promise<ShouchaoRow[]> {
  const store = getStore();
  const all = await store.shouchaoRows.list({ ownerId, databaseId } as Partial<ShouchaoRow>);
  return all
    .filter((r) => !r.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createRow(input: {
  ownerId: string;
  tenantId: string;
  databaseId: string;
  cells?: Record<string, ShouchaoCellValue>;
}): Promise<ShouchaoRow | null> {
  const db = await getDatabase(input.ownerId, input.databaseId);
  if (!db) return null; // 库不存在/无权 → 不建孤儿行
  const store = getStore();
  const ts = nowIso();
  return store.shouchaoRows.create({
    id: generateId('scrow'),
    databaseId: input.databaseId,
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    cells: input.cells ?? {},
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateRow(
  ownerId: string,
  id: string,
  cells: Record<string, ShouchaoCellValue>,
): Promise<ShouchaoRow | null> {
  const store = getStore();
  const existing = await store.shouchaoRows.get(id);
  if (!existing || existing.ownerId !== ownerId || existing.deletedAt) return null;
  return store.shouchaoRows.update(id, {
    cells: { ...existing.cells, ...cells },
    updatedAt: nowIso(),
  });
}

export async function deleteRow(ownerId: string, id: string): Promise<boolean> {
  const store = getStore();
  const existing = await store.shouchaoRows.get(id);
  if (!existing || existing.ownerId !== ownerId || existing.deletedAt) return false;
  await store.shouchaoRows.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
  return true;
}
