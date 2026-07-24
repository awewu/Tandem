/**
 * PMS · 分级推送服务 (告警 + 通知规则)
 *
 * 业务: 各模块产生告警 → 按 角色×紧急度×渠道 规则分发 → SLA 超时升级.
 * 对齐 drizzle 表 pms_alerts / pms_notification_rules.
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsAlerts, pmsNotificationRules } from '../infra/drizzle-schema';
import { and, eq, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

/** 严重度排序值 (越大越紧急) */
export function severityWeight(severity: string): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

/** 是否应升级: 未处理 且 已超过 SLA (分钟) */
export function shouldEscalate(
  createdAt: Date,
  slaMinutes: number | null | undefined,
  acted: boolean,
  now: Date,
): boolean {
  if (acted) return false;
  if (slaMinutes == null || slaMinutes <= 0) return false;
  const elapsedMin = (now.getTime() - createdAt.getTime()) / 60000;
  return elapsedMin >= slaMinutes;
}

/** 从匹配规则解析目标渠道 (去重, 保序) */
export function resolveChannels(rules: Array<{ channels: string[]; enabled: boolean }>): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    for (const c of r.channels || []) {
      if (!out.includes(c)) out.push(c);
    }
  }
  return out;
}

// --- DB ---

function mapAlert(row: typeof pmsAlerts.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    severity: row.severity,
    entityType: row.entityType,
    entityId: row.entityId,
    message: row.message,
    targetRole: row.targetRole || undefined,
    targetUserId: row.targetUserId || undefined,
    acted: row.acted,
    actedBy: row.actedBy || undefined,
    actedAt: row.actedAt?.toISOString() || undefined,
    escalationLevel: row.escalationLevel ?? 0,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRule(row: typeof pmsNotificationRules.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    alertType: row.alertType,
    severity: row.severity,
    targetRole: row.targetRole,
    channels: row.channels ?? [],
    escalationSLA: row.escalationSLA || undefined,
    enabled: row.enabled,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 失败降级发送告警: 供业务动作埋点调用. 告警写入失败不得影响主流程.
 */
export async function emitAlert(input: {
  tenantId: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  message: string;
  targetRole?: string;
  targetUserId?: string;
}): Promise<void> {
  try {
    await createAlert(input);
  } catch (e) {
    console.error('[pms] emitAlert failed (fail-soft):', e instanceof Error ? e.message : e);
  }
}

export async function createAlert(input: {
  tenantId: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  message: string;
  targetRole?: string;
  targetUserId?: string;
}) {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsAlerts).values({
    id,
    tenantId: input.tenantId,
    type: input.type,
    severity: input.severity,
    entityType: input.entityType,
    entityId: input.entityId,
    message: input.message,
    targetRole: input.targetRole ?? null,
    targetUserId: input.targetUserId ?? null,
    acted: false,
    actedBy: null,
    actedAt: null,
    escalationLevel: 0,
    createdAt: now,
  });
  return { id, ...input, acted: false, escalationLevel: 0, createdAt: now.toISOString() };
}

export async function listAlerts(filters: {
  tenantId: string;
  severity?: string;
  entityType?: string;
  entityId?: string;
  targetUserId?: string;
  acted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ReturnType<typeof mapAlert>[]> {
  const conditions = [eq(pmsAlerts.tenantId, filters.tenantId)];
  if (filters.severity) conditions.push(eq(pmsAlerts.severity, filters.severity));
  if (filters.entityType) conditions.push(eq(pmsAlerts.entityType, filters.entityType));
  if (filters.entityId) conditions.push(eq(pmsAlerts.entityId, filters.entityId));
  if (filters.targetUserId) conditions.push(eq(pmsAlerts.targetUserId, filters.targetUserId));
  if (filters.acted != null) conditions.push(eq(pmsAlerts.acted, filters.acted));
  const rows = await db
    .select()
    .from(pmsAlerts)
    .where(and(...conditions))
    .orderBy(desc(pmsAlerts.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  return rows.map(mapAlert);
}

/** 处理告警 (标记 acted) */
export async function ackAlert(input: {
  tenantId: string;
  id: string;
  actedBy: string;
}) {
  const now = new Date();
  const rows = await db
    .select()
    .from(pmsAlerts)
    .where(and(eq(pmsAlerts.id, input.id), eq(pmsAlerts.tenantId, input.tenantId)))
    .limit(1);
  if (rows.length === 0) throw new Error('alert not found');
  await db
    .update(pmsAlerts)
    .set({ acted: true, actedBy: input.actedBy, actedAt: now })
    .where(eq(pmsAlerts.id, input.id));
  return { id: input.id, acted: true, actedBy: input.actedBy, actedAt: now.toISOString() };
}

export interface CreateNotificationRuleInput {
  name: string;
  alertType: string;
  severity: string;
  targetRole: string;
  channels?: string[];
  escalationSLA?: number | null;
  enabled?: boolean;
  createdBy: string;
}

export async function createNotificationRule(
  tenantId: string,
  input: CreateNotificationRuleInput,
): Promise<CreateNotificationRuleInput & { id: string; tenantId: string; enabled: boolean; createdAt: string }> {
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsNotificationRules).values({
    id,
    tenantId,
    name: input.name,
    alertType: input.alertType,
    severity: input.severity,
    targetRole: input.targetRole,
    channels: input.channels ?? [],
    escalationSLA: input.escalationSLA ?? null,
    enabled: input.enabled ?? true,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return { id, tenantId, ...input, enabled: input.enabled ?? true, createdAt: now.toISOString() };
}

export async function listNotificationRules(filters: {
  tenantId: string;
  alertType?: string;
  severity?: string;
}): Promise<ReturnType<typeof mapRule>[]> {
  const conditions = [eq(pmsNotificationRules.tenantId, filters.tenantId)];
  if (filters.alertType) conditions.push(eq(pmsNotificationRules.alertType, filters.alertType));
  if (filters.severity) conditions.push(eq(pmsNotificationRules.severity, filters.severity));
  const rows = await db
    .select()
    .from(pmsNotificationRules)
    .where(and(...conditions))
    .orderBy(desc(pmsNotificationRules.createdAt));
  return rows.map(mapRule);
}
