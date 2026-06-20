/**
 * KPI 实例 Excel 导入 · CHARTER-KPI-TTI §2.5
 *
 * POST /api/kpi/import?cycleId=xxx&dryRun=1
 *   multipart/form-data, field "file" (xlsx)
 *
 * 限制:
 *   - 周期必须 status=draft (CHARTER §2.3: active 后 target 锁死, 不接受批量改)
 *   - 仅写 target/scope/weight 等通道 A 字段, 永不写 currentValue
 *   - upsert 自然键: (subjectCode + level + assigneeId)
 *
 * 权限: kpi.write
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import {
  cellNumber,
  cellString,
  parseSheet,
  KPI_COLUMNS,
  type ImportSummary,
  type RowResult,
} from '@/lib/kpi/excel';
import type { Kpi } from '@/lib/types/kpi';

interface KpiPayload {
  subjectCode: string;
  level: 'company' | 'department' | 'individual';
  scope: 'bonus' | 'monitor';
  title: string;
  description?: string;
  assigneeId: string;
  departmentId?: string;
  measureType: 'numeric' | 'percentage' | 'currency' | 'count';
  startValue: number;
  targetValue: number;
  unit?: string;
  weight: number;
}

const LEVELS = new Set(['company', 'department', 'individual']);
const SCOPES = new Set(['bonus', 'monitor']);
const MEASURES = new Set(['numeric', 'percentage', 'currency', 'count']);

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  const dryRun = url.searchParams.get('dryRun') === '1';
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 });

  const store = getStore();
  const cycle = await withTenantScope(store.kpiCycles, auth.tenantId).get(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
  }
  if (cycle.status !== 'draft') {
    return NextResponse.json(
      { error: `cycle_locked: 周期已 ${cycle.status}, 仅 draft 状态可批量导入 (CHARTER §2.3)` },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows: rawRows, missingColumns } = parseSheet(buffer, KPI_COLUMNS);
  if (missingColumns.length > 0) {
    return NextResponse.json(
      { error: `missing_columns: ${missingColumns.join(', ')}` },
      { status: 400 },
    );
  }

  const subjects = (await withTenantScope(store.kpiSubjects, auth.tenantId).list()).filter(
    (s) => s.active,
  );
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
  const existingKpis = (await withTenantScope(store.kpis, auth.tenantId).list()).filter(
    (k) => k.cycleId === cycleId,
  );
  const naturalKey = (subjectCode: string, level: string, assigneeId: string) =>
    `${subjectCode}|${level}|${assigneeId}`;
  const existingByKey = new Map<string, Kpi>();
  for (const k of existingKpis) {
    const sc = subjects.find((s) => s.id === k.subjectId)?.code ?? '';
    existingByKey.set(naturalKey(sc, k.level, k.assigneeId), k);
  }

  // Parse + validate
  const parsed: Array<RowResult<KpiPayload>> = rawRows.map((r) => {
    const row = r.__row;
    const errors: string[] = [];

    const subjectCode = cellString(r.subjectCode);
    const level = cellString(r.level).toLowerCase();
    const scope = cellString(r.scope).toLowerCase();
    const title = cellString(r.title);
    const description = cellString(r.description);
    const assigneeId = cellString(r.assigneeId);
    const departmentId = cellString(r.departmentId);
    const measureType = cellString(r.measureType).toLowerCase();
    const startValue = cellNumber(r.startValue);
    const targetValue = cellNumber(r.targetValue);
    const unit = cellString(r.unit);
    const weight = cellNumber(r.weight);

    if (!subjectCode) errors.push('subjectCode 必填');
    else if (!subjectByCode.has(subjectCode))
      errors.push(`subjectCode "${subjectCode}" 不存在或未启用`);
    if (!LEVELS.has(level)) errors.push('level 必须是 company|department|individual');
    if (!SCOPES.has(scope)) errors.push('scope 必须是 bonus|monitor');
    if (!title) errors.push('title 必填');
    if (!assigneeId) errors.push('assigneeId 必填');
    if (!MEASURES.has(measureType))
      errors.push('measureType 必须是 numeric|percentage|currency|count');
    if (targetValue === null) errors.push('targetValue 必填且为数字');
    if (weight === null) errors.push('weight 必填 (0 表示 monitor scope)');
    if (scope === 'monitor' && weight !== null && weight !== 0)
      errors.push('monitor scope 时 weight 必须为 0');

    if (errors.length > 0) return { row, ok: false, errors };
    return {
      row,
      ok: true,
      errors: [],
      data: {
        subjectCode,
        level: level as KpiPayload['level'],
        scope: scope as KpiPayload['scope'],
        title,
        description: description || undefined,
        assigneeId,
        departmentId: departmentId || undefined,
        measureType: measureType as KpiPayload['measureType'],
        startValue: startValue ?? 0,
        targetValue: targetValue!,
        unit: unit || undefined,
        weight: weight ?? 0,
      },
    };
  });

  // 写入
  if (!dryRun) {
    for (const p of parsed) {
      if (!p.ok || !p.data) continue;
      try {
        const subject = subjectByCode.get(p.data.subjectCode)!;
        const key = naturalKey(p.data.subjectCode, p.data.level, p.data.assigneeId);
        const prev = existingByKey.get(key);
        const now = new Date().toISOString();

        if (prev) {
          const updated = await store.kpis.update(prev.id, {
            subjectId: subject.id,
            level: p.data.level,
            scope: p.data.scope,
            title: p.data.title,
            description: p.data.description,
            assigneeId: p.data.assigneeId,
            departmentId: p.data.departmentId,
            measureType: p.data.measureType,
            startValue: p.data.startValue,
            targetValue: p.data.targetValue,
            unit: p.data.unit,
            weight: p.data.weight,
            updatedAt: now,
          });
          p.createdId = updated.id;
          await audit('kpi.target_set', auth.userId, {
            targetId: updated.id,
            targetType: 'kpi',
            metadata: {
              source: 'excel_import',
              row: p.row,
              subjectCode: p.data.subjectCode,
              targetValue: p.data.targetValue,
              weight: p.data.weight,
              op: 'update',
            },
          });
        } else {
          const created = await store.kpis.create({
            cycleId,
            subjectId: subject.id,
            level: p.data.level,
            scope: p.data.scope,
            title: p.data.title,
            description: p.data.description,
            assigneeId: p.data.assigneeId,
            departmentId: p.data.departmentId,
            measureType: p.data.measureType,
            startValue: p.data.startValue,
            targetValue: p.data.targetValue,
            currentValue: 0,
            unit: p.data.unit,
            weight: p.data.weight,
            dataSource: 'pending',
            tenantId: auth.tenantId,
            createdBy: auth.userId,
            createdAt: now,
            updatedAt: now,
          } as Omit<Kpi, 'id'>);
          existingByKey.set(key, created);
          p.createdId = created.id;
          await audit('kpi.target_set', auth.userId, {
            targetId: created.id,
            targetType: 'kpi',
            metadata: {
              source: 'excel_import',
              row: p.row,
              subjectCode: p.data.subjectCode,
              targetValue: p.data.targetValue,
              weight: p.data.weight,
              op: 'create',
            },
          });
        }
      } catch (e) {
        p.ok = false;
        p.errors.push(`写入失败: ${(e as Error).message}`);
      }
    }
  }

  const summary: ImportSummary<KpiPayload> = {
    total: parsed.length,
    ok: parsed.filter((p) => p.ok).length,
    failed: parsed.filter((p) => !p.ok).length,
    rows: parsed,
    dryRun,
  };
  return NextResponse.json(summary);
}
