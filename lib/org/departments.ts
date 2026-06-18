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

export async function getDept(id: string): Promise<HrDept | null> {
  const rows = await db.select().from(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id))).limit(1);
  return rows[0] ? row2dept(rows[0]) : null;
}

export async function createDept(
  input: Omit<HrDept, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<HrDept> {
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

export async function updateDept(id: string, patch: Partial<HrDept>): Promise<HrDept> {
  const rows = await db.select().from(kvStore)
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id))).limit(1);
  if (!rows[0]) throw new Error(`Dept ${id} not found`);
  const updated: HrDept = { ...row2dept(rows[0]), ...patch, id, updatedAt: new Date().toISOString() };
  await db.update(kvStore)
    .set({ data: updated as object, updatedAt: new Date() })
    .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id)));
  return updated;
}

export async function deleteDept(id: string): Promise<void> {
  await db.delete(kvStore).where(and(eq(kvStore.collection, COLL), eq(kvStore.id, id)));
}
