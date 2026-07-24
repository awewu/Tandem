/**
 * PMS · 线索开发服务 (Demand Gen)
 *
 * 业务: 早期线索 (报备前) → 分配 → 培育 → 转化为商机.
 * 状态机: new → assigned → nurturing → converted | dropped
 * 对齐 drizzle 表 pms_demand_gen_leads.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsDemandGenLeads } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

export type LeadStatus = 'new' | 'assigned' | 'nurturing' | 'converted' | 'dropped';

const LEAD_TRANSITIONS: Record<string, LeadStatus[]> = {
  new: ['assigned', 'dropped'],
  assigned: ['nurturing', 'converted', 'dropped'],
  nurturing: ['converted', 'dropped'],
  converted: [],
  dropped: [],
};

/** 线索状态流转是否合法 */
export function canTransitionLead(from: string, to: string): boolean {
  const allowed = LEAD_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as LeadStatus);
}

// --- DB ---

function mapLead(row: typeof pmsDemandGenLeads.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    source: row.source,
    customerName: row.customerName,
    contactPhone: row.contactPhone || undefined,
    region: row.region || undefined,
    status: row.status,
    assignedTo: row.assignedTo || undefined,
    convertedOpportunityId: row.convertedOpportunityId || undefined,
    convertedAt: row.convertedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createLead(input: {
  tenantId: string;
  source: string;
  customerName: string;
  contactPhone?: string;
  region?: string;
  assignedTo?: string;
}) {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsDemandGenLeads).values({
    id,
    tenantId: input.tenantId,
    source: input.source,
    customerName: input.customerName,
    contactPhone: input.contactPhone ?? null,
    region: input.region ?? null,
    status: input.assignedTo ? 'assigned' : 'new',
    assignedTo: input.assignedTo ?? null,
    convertedOpportunityId: null,
    convertedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, ...input, status: input.assignedTo ? 'assigned' : 'new', createdAt: now.toISOString() };
}

export async function listLeads(filters: {
  tenantId: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapLead>[]> {
  const conditions = [eq(pmsDemandGenLeads.tenantId, filters.tenantId)];
  if (filters.status) conditions.push(eq(pmsDemandGenLeads.status, filters.status));
  if (filters.source) conditions.push(eq(pmsDemandGenLeads.source, filters.source));
  if (filters.assignedTo) conditions.push(eq(pmsDemandGenLeads.assignedTo, filters.assignedTo));
  const rows = await db
    .select()
    .from(pmsDemandGenLeads)
    .where(and(...conditions))
    .orderBy(desc(pmsDemandGenLeads.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapLead);
}

/** 状态流转 (assign/nurture/drop). 转化用 convertLead. */
export async function transitionLead(input: {
  tenantId: string;
  id: string;
  toStatus: LeadStatus;
  assignedTo?: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsDemandGenLeads)
    .where(and(eq(pmsDemandGenLeads.id, input.id), eq(pmsDemandGenLeads.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('lead not found');
  if (!canTransitionLead(rows[0].status, input.toStatus)) {
    throw new Error(`illegal lead transition: ${rows[0].status} → ${input.toStatus}`);
  }
  const patch: Partial<typeof pmsDemandGenLeads.$inferInsert> = { status: input.toStatus, updatedAt: now };
  if (input.toStatus === 'assigned' && input.assignedTo) patch.assignedTo = input.assignedTo;
  await db
    .update(pmsDemandGenLeads)
    .set(patch)
    .where(eq(pmsDemandGenLeads.id, input.id));
  return { id: input.id, from: rows[0].status, to: input.toStatus, updatedAt: now.toISOString() };
}

/** 转化线索为商机 (记录 convertedOpportunityId) */
export async function convertLead(input: {
  tenantId: string;
  id: string;
  opportunityId: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsDemandGenLeads)
    .where(and(eq(pmsDemandGenLeads.id, input.id), eq(pmsDemandGenLeads.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('lead not found');
  if (!canTransitionLead(rows[0].status, 'converted')) {
    throw new Error('lead not convertible');
  }
  await db
    .update(pmsDemandGenLeads)
    .set({ status: 'converted', convertedOpportunityId: input.opportunityId, convertedAt: now, updatedAt: now })
    .where(eq(pmsDemandGenLeads.id, input.id));
  return { id: input.id, status: 'converted', convertedOpportunityId: input.opportunityId, convertedAt: now.toISOString() };
}
