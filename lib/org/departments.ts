/**
 * lib/org/departments.ts · HR 部门树
 * 存 KvStore (collection=org_hr_depts), 与三省六部治理模板完全独立。
 */

import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { kvStore } from '@/lib/infra/drizzle-schema';
import { generateId } from '@/lib/storage/repository';

export interface HrDept {
  id: string;
  name: string;
  parentId: string | null;
  headId: string | null;
  description: string;
  order: number;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

const COLL = 'org_hr_depts';

function row2dept(r: { data: unknown }): HrDept {
  return r.data as HrDept;
}

export async function listDepts(tenantId: string): Promise<HrDept[]> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.tenantId, tenantId)))
    .orderBy(desc(kvStore.updatedAt));
  return rows.map(row2dept).sort((a, b) => a.order - b.order);
}

export async function getDept(id: string, tenantId?: string): Promise<HrDept | null> {
  const cond = tenantId
    ? and(eq(kvStore.collection, COLL), eq(kvStore.id, id), eq(kvStore.tenantId, tenantId))
    : and(eq(kvStore.collection, COLL), eq(kvStore.id, id));
  const rows = await db.select().from(kvStore)
    .where(cond).limit(1);
  return rows[0] ? row2dept(rows[0]) : null;
}

async function assertValidParent(parentId: string | null, tenantId: string, selfId?: string): Promise<void> {
  if (!parentId) return;
  if (parentId === selfId) throw new Error('parent cannot be self');
  const all = await listDepts(tenantId);
  const byId = new Map(all.map((d) => [d.id, d]));
  if (!byId.has(parentId)) throw new Error('parent department not found');
  let cur = byId.get(parentId);
  while (cur) {
    if (cur.id === selfId) throw new Error('parent cannot be a child department');
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
}

export async function createDept(
  input: Omit<HrDept, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<HrDept> {
  await assertValidParent(input.parentId, input.tenantId);
  const now = new Date().toISOString();
  const id = generateId('dept');
  const item: HrDept = { ...input, id, createdAt: now, updatedAt: now };
  await db.insert(kvStore)
    .values({ collection: COLL, id, data: item as object, tenantId: input.tenantId })
    .onConflictDoUpdate({
      target: [kvStore.collection, kvStore.id],
      set: { data: item as object, updatedAt: new Date() },
    });
  return item;
}

export async function updateDept(id: string, tenantId: string, patch: Partial<HrDept>): Promise<HrDept> {
  const rows = await db.select().from(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id), eq(kvStore.tenantId, tenantId))).limit(1);
  if (!rows[0]) throw new Error(`Dept ${id} not found`);
  if (patch.parentId !== undefined) await assertValidParent(patch.parentId, tenantId, id);
  const updated: HrDept = { ...row2dept(rows[0]), ...patch, id, updatedAt: new Date().toISOString() };
  await db.update(kvStore)
    .set({ data: updated as object, updatedAt: new Date() })
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id), eq(kvStore.tenantId, tenantId)));
  return updated;
}

export async function collectDeptTreeIds(id: string, tenantId: string): Promise<string[]> {
  const all = await listDepts(tenantId);
  if (!all.some((d) => d.id === id)) throw new Error(`Dept ${id} not found`);
  const children = new Map<string | null, HrDept[]>();
  for (const d of all) {
    const key = d.parentId;
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(d);
  }
  const ids: string[] = [];
  const visit = (deptId: string) => {
    ids.push(deptId);
    for (const child of children.get(deptId) ?? []) visit(child.id);
  };
  visit(id);
  return ids;
}

export async function deleteDeptTree(id: string, tenantId: string): Promise<string[]> {
  const ids = await collectDeptTreeIds(id, tenantId);
  for (const deptId of ids) {
    await db.delete(kvStore).where(and(eq(kvStore.collection, COLL), eq(kvStore.id, deptId), eq(kvStore.tenantId, tenantId)));
  }
  return ids;
}
