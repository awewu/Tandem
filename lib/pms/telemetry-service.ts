/**
 * PMS · 设备 IoT 遥测服务
 *
 * 业务: 设备上报运行指标 → 阈值判定生成告警 → 时序存储供售后/预测性维保.
 * 对齐 drizzle 表 pms_equipment_telemetry (snCode + timestamp).
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsEquipmentTelemetry } from '../infra/drizzle-schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';

// --- 纯函数 (可测) ---

export interface TelemetryThreshold {
  min?: number;
  max?: number;
}

export interface TelemetryAlert {
  metric: string;
  value: number;
  type: 'below_min' | 'above_max';
  threshold: number;
}

/** 依阈值评估指标, 生成越界告警 */
export function evaluateTelemetryAlerts(
  metrics: Record<string, number>,
  thresholds: Record<string, TelemetryThreshold>,
): TelemetryAlert[] {
  const alerts: TelemetryAlert[] = [];
  for (const [metric, th] of Object.entries(thresholds || {})) {
    const value = metrics?.[metric];
    if (typeof value !== 'number' || isNaN(value)) continue;
    if (th.min != null && value < th.min) {
      alerts.push({ metric, value, type: 'below_min', threshold: th.min });
    } else if (th.max != null && value > th.max) {
      alerts.push({ metric, value, type: 'above_max', threshold: th.max });
    }
  }
  return alerts;
}

// --- DB ---

function mapTelemetry(row: typeof pmsEquipmentTelemetry.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    snCode: row.snCode,
    timestamp: row.timestamp.toISOString(),
    metrics: row.metrics,
    alerts: row.alerts ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

/** 采集一条遥测 (可选传阈值即时判定告警) */
export async function ingestTelemetry(input: {
  tenantId: string;
  snCode: string;
  timestamp?: string;
  metrics: Record<string, number>;
  thresholds?: Record<string, TelemetryThreshold>;
}): Promise<any> {
  const now = new Date();
  const id = nanoid();
  const ts = input.timestamp ? new Date(input.timestamp) : now;
  const alerts = input.thresholds ? evaluateTelemetryAlerts(input.metrics, input.thresholds) : [];
  await db.insert(pmsEquipmentTelemetry).values({
    id,
    tenantId: input.tenantId,
    snCode: input.snCode,
    timestamp: ts,
    metrics: input.metrics as any,
    alerts: alerts as any,
    createdAt: now,
  });
  return { id, snCode: input.snCode, timestamp: ts.toISOString(), alerts };
}

/** 查询遥测时序 (按 snCode + 时间范围) */
export async function listTelemetry(filters: {
  tenantId: string;
  snCode: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<any[]> {
  const conditions = [
    eq(pmsEquipmentTelemetry.tenantId, filters.tenantId),
    eq(pmsEquipmentTelemetry.snCode, filters.snCode),
  ];
  if (filters.from) conditions.push(gte(pmsEquipmentTelemetry.timestamp, new Date(filters.from)));
  if (filters.to) conditions.push(lte(pmsEquipmentTelemetry.timestamp, new Date(filters.to)));
  const rows = await db
    .select()
    .from(pmsEquipmentTelemetry)
    .where(and(...conditions))
    .orderBy(desc(pmsEquipmentTelemetry.timestamp))
    .limit(filters.limit ?? 200);
  return rows.map(mapTelemetry);
}
