/**
 * PMS · 定时任务 (每日扫描)
 *
 * 编排:
 *   1. 公海超时扫描/自动释放 (复用 scanExpiringOpportunities)
 *   2. 资质到期预警 → 告警 (dedup)
 *   3. 保修到期预警 → 告警 (dedup)
 *   4. 未处理告警 SLA 超时 → 升级 escalationLevel
 */

import { db } from '../infra/drizzle-client';
import {
  pmsDealerQualifications,
  pmsEquipmentSns,
  pmsAlerts,
  pmsNotificationRules,
} from '../infra/drizzle-schema';
import { and, eq, isNull } from 'drizzle-orm';
import { scanExpiringOpportunities } from './public-pool-service';
import { createAlert } from './alert-service';
import { shouldEscalate } from './alert-service';
import { rollupCurrentPeriodTargets } from './performance-target-service';
import { assembleQuotePricingReport } from './quote-insights-service';

// --- 纯函数 (可测) ---

/** 距目标日期的整天数 (负数=已过期); 非法 → null */
export function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + (dateStr.length === 10 ? 'T23:59:59Z' : ''));
  if (isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - now.getTime()) / 86400000);
}

/** 是否即将到期 (0 <= 剩余天数 <= withinDays); 已过期(<0) 也视为需预警 */
export function isExpiringSoon(dateStr: string | null | undefined, now: Date, withinDays: number): boolean {
  const d = daysUntil(dateStr, now);
  if (d == null) return false;
  return d <= withinDays;
}

// --- 扫描任务 ---

/** 是否已存在同实体未处理告警 (防重复) */
async function hasOpenAlert(tenantId: string, type: string, entityId: string): Promise<boolean> {
  const rows = await db
    .select({ id: pmsAlerts.id })
    .from(pmsAlerts)
    .where(and(
      eq(pmsAlerts.tenantId, tenantId),
      eq(pmsAlerts.type, type),
      eq(pmsAlerts.entityId, entityId),
      eq(pmsAlerts.acted, false),
    ))
    .limit(1);
  return rows.length > 0;
}

/** 资质到期预警 */
export async function scanQualificationExpiry(tenantId: string, now: Date, withinDays = 30): Promise<number> {
  const rows = await db
    .select()
    .from(pmsDealerQualifications)
    .where(and(eq(pmsDealerQualifications.tenantId, tenantId), eq(pmsDealerQualifications.status, 'approved')));

  let created = 0;
  for (const q of rows) {
    if (!isExpiringSoon(q.expiryDate, now, withinDays)) continue;
    if (await hasOpenAlert(tenantId, 'qualification_expiry', q.id)) continue;
    const days = daysUntil(q.expiryDate, now);
    await createAlert({
      tenantId,
      type: 'qualification_expiry',
      severity: days != null && days < 0 ? 'high' : 'medium',
      entityType: 'dealer_qualification',
      entityId: q.id,
      message: `经销商资质 ${q.type} ${days != null && days < 0 ? '已过期' : `将在 ${days} 天后到期`} (证号 ${q.certificateNumber ?? 'N/A'})`,
    });
    created++;
  }
  return created;
}

/** 保修到期预警 */
export async function scanWarrantyExpiry(tenantId: string, now: Date, withinDays = 30): Promise<number> {
  const rows = await db
    .select()
    .from(pmsEquipmentSns)
    .where(eq(pmsEquipmentSns.tenantId, tenantId));

  let created = 0;
  for (const sn of rows) {
    if (!sn.warrantyExpiresAt) continue;
    if (!isExpiringSoon(sn.warrantyExpiresAt, now, withinDays)) continue;
    if (await hasOpenAlert(tenantId, 'warranty_expiry', sn.id)) continue;
    const days = daysUntil(sn.warrantyExpiresAt, now);
    await createAlert({
      tenantId,
      type: 'warranty_expiry',
      severity: days != null && days < 0 ? 'high' : 'medium',
      entityType: 'equipment_sn',
      entityId: sn.id,
      message: `设备 ${sn.snCode} 保修${days != null && days < 0 ? '已到期' : `将在 ${days} 天后到期`}`,
    });
    created++;
  }
  return created;
}

/**
 * 异常低价预警 (P4 · management by exception):
 *   汇总全量已签发报价 → analyzeQuotePricing 检出 critical 异常 (破限价 / 深度离群) →
 *   沉淀为持久告警, 让管理层被动收到而非主动翻洞察页。经销商自由报价不受影响。
 *   dedup: 同一 (报价×产品) 的未处理告警不重复建。只报 critical, 避免噪音。
 */
export async function scanQuotePricingAnomalies(tenantId: string): Promise<number> {
  const report = await assembleQuotePricingReport(tenantId);
  let created = 0;
  for (const a of report.anomalies) {
    if (a.severity !== 'critical') continue;
    const entityId = `${a.quoteId}:${a.productKey}`;
    if (await hasOpenAlert(tenantId, 'quote_price_anomaly', entityId)) continue;
    await createAlert({
      tenantId,
      type: 'quote_price_anomaly',
      severity: 'high',
      entityType: 'pms_quote',
      entityId,
      message: `报价异常低价: ${a.productLabel} — ${a.detail}`,
    });
    created++;
  }
  return created;
}

/** 未处理告警 SLA 超时升级 */
export async function escalateOverdueAlerts(tenantId: string, now: Date): Promise<number> {
  const [alerts, rules] = await Promise.all([
    db.select().from(pmsAlerts).where(and(eq(pmsAlerts.tenantId, tenantId), eq(pmsAlerts.acted, false))),
    db.select().from(pmsNotificationRules).where(and(eq(pmsNotificationRules.tenantId, tenantId), eq(pmsNotificationRules.enabled, true))),
  ]);

  const slaByKey = new Map<string, number>();
  for (const r of rules) {
    if (r.escalationSLA != null) slaByKey.set(`${r.alertType}:${r.severity}`, r.escalationSLA);
  }

  let escalated = 0;
  for (const a of alerts) {
    const sla = slaByKey.get(`${a.type}:${a.severity}`);
    if (!shouldEscalate(a.createdAt, sla, a.acted, now)) continue;
    await db
      .update(pmsAlerts)
      .set({ escalationLevel: (a.escalationLevel ?? 0) + 1 })
      .where(eq(pmsAlerts.id, a.id));
    escalated++;
  }
  return escalated;
}

/** 每日综合扫描 */
export async function runPmsDailyScan(tenantId: string, now = new Date()): Promise<{
  poolReleased: number;
  poolWarned: number;
  qualificationAlerts: number;
  warrantyAlerts: number;
  priceAnomalyAlerts: number;
  escalated: number;
  targetsRolledUp: number;
}> {
  const pool = await scanExpiringOpportunities({
    tenantId,
    autoRelease: true,
    actorId: '__system__',
    protectionDays: 0,
  });
  const qualificationAlerts = await scanQualificationExpiry(tenantId, now);
  const warrantyAlerts = await scanWarrantyExpiry(tenantId, now);
  let priceAnomalyAlerts = 0;
  try {
    priceAnomalyAlerts = await scanQuotePricingAnomalies(tenantId);
  } catch (e) {
    console.error('[pms] scanQuotePricingAnomalies failed (fail-soft):', e instanceof Error ? e.message : e);
  }
  const escalated = await escalateOverdueAlerts(tenantId, now);
  // 业绩目标: 每日自动汇总当前存活周期 (本月/本季/本年) 实际达成 + 同环比
  let targetsRolledUp = 0;
  try {
    targetsRolledUp = await rollupCurrentPeriodTargets(tenantId, now);
  } catch (e) {
    console.error('[pms] rollupCurrentPeriodTargets failed (fail-soft):', e instanceof Error ? e.message : e);
  }
  return {
    poolReleased: pool?.released ?? 0,
    poolWarned: (pool?.yellow ?? 0) + (pool?.red ?? 0),
    qualificationAlerts,
    warrantyAlerts,
    priceAnomalyAlerts,
    escalated,
    targetsRolledUp,
  };
}
